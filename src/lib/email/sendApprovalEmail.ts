import { createAdminClient } from '@/lib/supabase/admin'

type Params = {
  to: string
  candidateName: string
  schoolName: string
  className: string
  startsAt: string | null
  replyTo: string
  organizationId: string
  schoolId: string
  decisionNote?: string | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function buildHtml(p: Params): string {
  const dateInfo = p.startsAt
    ? `<p style="margin:0 0 8px;font-size:14px;color:#6b7280;">📅 <strong>Início:</strong> ${formatDate(p.startsAt)}</p>`
    : ''
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#16a34a 0%,#15803d 100%);padding:40px 40px 32px;text-align:center;">
            <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.1em;">Jovens Com Uma Missão</p>
            <h1 style="margin:0;font-size:26px;font-weight:800;color:#fff;line-height:1.2;">Parabéns, você foi aceito!</h1>
            <p style="margin:12px 0 0;font-size:14px;color:rgba(255,255,255,0.85);">${p.schoolName} — ${p.className}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#111827;">Olá, ${p.candidateName}! 🎉</p>
            <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
              Temos uma ótima notícia: sua inscrição para a <strong style="color:#111827;">${p.schoolName}</strong>
              foi analisada e você foi <strong style="color:#16a34a;">aceito(a)</strong> na turma <strong style="color:#111827;">${p.className}</strong>.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0;margin-bottom:24px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#166534;text-transform:uppercase;letter-spacing:0.05em;">Informações da turma</p>
                  <p style="margin:0 0 8px;font-size:14px;color:#166534;">🏫 <strong>Escola:</strong> ${p.schoolName}</p>
                  <p style="margin:0 0 8px;font-size:14px;color:#166534;">📚 <strong>Turma:</strong> ${p.className}</p>
                  ${dateInfo}
                </td>
              </tr>
            </table>
            <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
              Em breve você receberá mais informações sobre os próximos passos.
              Caso tenha dúvidas, responda este e-mail ou entre em contato diretamente.
            </p>
            ${p.decisionNote ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fefce8;border-radius:10px;border:1px solid #fde68a;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#92400e;text-transform:uppercase;letter-spacing:0.05em;">Uma palavra da liderança</p>
                  <p style="margin:0;font-size:14px;color:#78350f;line-height:1.6;white-space:pre-wrap;">${p.decisionNote}</p>
                </td>
              </tr>
            </table>` : ''}
          </td>
        </tr>
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

export async function sendApprovalEmail(params: Params): Promise<void> {
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
        sender: { name: params.schoolName, email: fromEmail },
        to: [{ email: params.to, name: params.candidateName }],
        replyTo: { email: params.replyTo },
        subject: `Você foi aceito(a) — ${params.schoolName} · ${params.className}`,
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
      school_id: params.schoolId,
      to_email: params.to,
      status,
      error: errorMsg ?? null,
    })
  } catch { /* log failure não bloqueia */ }
}
