import { createAdminClient } from '@/lib/supabase/admin'

type Params = {
  to: string
  candidateName: string
  organizationId: string
  organizationName: string
  password: string
  loginUrl: string
}

function buildHtml(p: Params): string {
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
            <h1 style="margin:0;font-size:26px;font-weight:800;color:#fff;line-height:1.2;">Seu acesso ao sisgo</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#111827;">Olá, ${p.candidateName}!</p>
            <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
              Seu cadastro em ${p.organizationName} já está ativo no sisgo. Use os dados abaixo para acessar:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0;margin-bottom:24px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 8px;font-size:14px;color:#166534;"><strong>Email:</strong> ${p.to}</p>
                  <p style="margin:0;font-size:14px;color:#166534;"><strong>Senha:</strong> ${p.password}</p>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
              No primeiro acesso você vai precisar trocar essa senha. Depois, complete seu cadastro
              — dá pra fazer aos poucos, em várias visitas.
            </p>
            <table cellpadding="0" cellspacing="0">
              <tr><td style="background:#16a34a;border-radius:8px;">
                <a href="${p.loginUrl}" style="display:inline-block;padding:12px 24px;color:#fff;text-decoration:none;font-size:14px;font-weight:600;">Acessar o sisgo</a>
              </td></tr>
            </table>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function sendImportWelcomeEmail(params: Params): Promise<void> {
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
        subject: `Seu acesso ao sisgo — ${params.organizationName}`,
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
