import { createAdminClient } from '@/lib/supabase/admin'
import { getEmailQuota } from './getEmailQuota'

type RecommenderRole = 'pastor' | 'lideranca_experiencia'

type Params = {
  to: string
  recommenderRole: RecommenderRole
  candidateName: string
  contextLabel: string
  formUrl: string
  expiresAt: string
  replyTo: string
  organizationId: string
}

function buildHtml(p: Params): string {
  const isPastor = p.recommenderRole === 'pastor'
  const title = isPastor ? 'Pedido de recomendação pastoral' : 'Pedido de avaliação'
  const intro = isPastor
    ? `<strong style="color:#111827;">${p.candidateName}</strong> informou você como pastor(a) ao se candidatar para servir como obreiro(a) em <strong style="color:#111827;">${p.contextLabel}</strong>. Precisamos da sua recomendação para dar continuidade ao processo.`
    : `<strong style="color:#111827;">${p.candidateName}</strong> indicou seu contato como liderança responsável durante sua passagem por <strong style="color:#111827;">${p.contextLabel}</strong>, ao se candidatar para servir como obreiro(a). Gostaríamos da sua avaliação sobre esse período.`

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:40px 40px 32px;text-align:center;">
            <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.1em;">${p.contextLabel}</p>
            <h1 style="margin:0;font-size:24px;font-weight:800;color:#fff;line-height:1.2;">${title}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">${intro}</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 8px;">
                  <a href="${p.formUrl}"
                    style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:16px 40px;border-radius:12px;">
                    Responder recomendação
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:20px 0 0;font-size:13px;color:#9ca3af;line-height:1.6;">
              Se o botão não funcionar, copie e cole este link no navegador:<br />
              <a href="${p.formUrl}" style="color:#4f46e5;word-break:break-all;">${p.formUrl}</a>
            </p>
            <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;">
              Este link expira em ${new Date(p.expiresAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 40px;text-align:center;">
            <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">
              Dúvidas? Entre em contato: <a href="mailto:${p.replyTo}" style="color:#4f46e5;">${p.replyTo}</a>
            </p>
            <p style="margin:0;font-size:12px;color:#9ca3af;">Este link é pessoal e de uso único para este processo.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function sendReferenceRequestEmail(params: Params): Promise<{ success: boolean; error?: string }> {
  const quota = await getEmailQuota()
  if (quota.exceeded) {
    return { success: false, error: 'quota_atingida' }
  }

  const apiKey = process.env.BREVO_API_KEY
  const fromEmail = process.env.BREVO_FROM_EMAIL ?? 'noreply@sisgomission.com'
  const subject = params.recommenderRole === 'pastor'
    ? `Recomendação de ${params.candidateName} — ${params.contextLabel}`
    : `Avaliação de ${params.candidateName} — ${params.contextLabel}`

  let status: 'sent' | 'failed' = 'sent'
  let errorMsg: string | undefined

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey ?? '', 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: params.contextLabel, email: fromEmail },
        to: [{ email: params.to }],
        replyTo: { email: params.replyTo },
        subject,
        htmlContent: buildHtml(params),
      }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      status = 'failed'
      errorMsg = (body as { message?: string }).message ?? `HTTP ${res.status}`
    }
  } catch (err) {
    status = 'failed'
    errorMsg = err instanceof Error ? err.message : 'Erro ao enviar e-mail.'
  }

  try {
    const db = createAdminClient()
    await db.from('email_logs').insert({
      organization_id: params.organizationId,
      to_email: params.to,
      status,
      error: errorMsg ?? null,
    })
  } catch (logErr) {
    console.error('[sendReferenceRequestEmail] falha ao registrar log:', logErr)
  }

  if (status === 'failed') {
    console.error('[sendReferenceRequestEmail] erro:', errorMsg)
    return { success: false, error: errorMsg }
  }

  return { success: true }
}
