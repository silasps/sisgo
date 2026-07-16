import { createAdminClient } from '@/lib/supabase/admin'

type Params = {
  to: string
  candidateName: string
  organizationName: string
  ministryName: string | null
  replyTo: string
  organizationId: string
  leaderWord?: string | null
}

function buildHtml(p: Params): string {
  const areaLine = p.ministryName
    ? `no ministério <strong style="color:#111827;">${p.ministryName}</strong>`
    : `na equipe da <strong style="color:#111827;">${p.organizationName}</strong>`

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#16a34a 0%,#15803d 100%);padding:40px 40px 32px;text-align:center;">
            <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.1em;">${p.organizationName}</p>
            <h1 style="margin:0;font-size:26px;font-weight:800;color:#fff;line-height:1.2;">Parabéns, você foi aceito!</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#111827;">Olá, ${p.candidateName}! 🎉</p>
            <p style="margin:0;font-size:15px;color:#6b7280;line-height:1.6;">
              Temos uma ótima notícia: sua inscrição como obreiro foi analisada e você foi
              <strong style="color:#16a34a;">aceito(a)</strong> ${areaLine}.
              Em breve você receberá mais informações sobre os próximos passos.
            </p>
          </td>
        </tr>
        ${p.leaderWord ? `<tr>
          <td style="padding:0 40px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fefce8;border-radius:10px;border:1px solid #fde68a;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#92400e;text-transform:uppercase;letter-spacing:0.05em;">Uma palavra da liderança</p>
                  <p style="margin:0;font-size:14px;color:#78350f;line-height:1.6;white-space:pre-wrap;">${p.leaderWord}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>` : ''}
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 40px;text-align:center;">
            <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">
              Dúvidas? Entre em contato: <a href="mailto:${p.replyTo}" style="color:#16a34a;">${p.replyTo}</a>
            </p>
            <p style="margin:0;font-size:12px;color:#9ca3af;">Este e-mail foi enviado automaticamente após sua aprovação.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function sendStaffApprovalEmail(params: Params): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY
  const fromEmail = process.env.BREVO_FROM_EMAIL ?? 'noreply@sisgomission.com'
  if (!apiKey) return

  let status: 'sent' | 'failed' = 'sent'
  let errorMsg: string | undefined

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: params.organizationName, email: fromEmail },
        to: [{ email: params.to, name: params.candidateName }],
        replyTo: { email: params.replyTo },
        subject: `Você foi aceito(a) como obreiro — ${params.organizationName}`,
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
    errorMsg = err instanceof Error ? err.message : 'Erro desconhecido'
  }

  try {
    const db = createAdminClient()
    await db.from('email_logs').insert({
      organization_id: params.organizationId,
      to_email: params.to,
      status,
      error: errorMsg ?? null,
    })
  } catch { /* log failure não bloqueia */ }
}
