import { createAdminClient } from '@/lib/supabase/admin'

type Params = {
  to: string
  orgName: string
  verifyUrl: string
}

export async function sendOrgSignupVerificationEmail({ to, orgName, verifyUrl }: Params): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY
  const fromEmail = process.env.BREVO_FROM_EMAIL ?? 'noreply@sisgomission.com'

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#1d6b67 0%,#2fa09b 100%);padding:36px 40px;text-align:center;">
            <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.1em;">SISGO</p>
            <h1 style="margin:0;font-size:22px;font-weight:800;color:#ffffff;">Confirme seu e-mail</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
              Você criou a conta da <strong>${orgName}</strong> no SISGO.
              Clique no botão abaixo para confirmar seu e-mail de responsável.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 28px;">
                  <a href="${verifyUrl}"
                    style="display:inline-block;background:#1d6b67;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;">
                    Confirmar meu e-mail →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;">
              Este link expira em <strong>7 dias</strong>. Sua organização já está ativa e utilizável mesmo antes da confirmação.
            </p>
            <p style="margin:0;font-size:12px;color:#d1d5db;word-break:break-all;">
              ${verifyUrl}
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey ?? '',
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'SISGO', email: fromEmail },
        to: [{ email: to }],
        subject: `Confirme seu e-mail — ${orgName}`,
        htmlContent: html,
      }),
    })

    const db = createAdminClient()

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      const error = (body as { message?: string }).message ?? `HTTP ${res.status}`
      console.error('[sendOrgSignupVerificationEmail] erro Brevo:', error, '| to:', to)
      try { await db.from('email_logs').insert({ to_email: to, status: 'failed', error }) } catch { /* log failure não bloqueia */ }
      return { success: false, error }
    }

    try { await db.from('email_logs').insert({ to_email: to, status: 'sent', error: null }) } catch { /* log failure não bloqueia */ }
    return { success: true }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[sendOrgSignupVerificationEmail] exceção:', error, '| to:', to)
    return { success: false, error }
  }
}
