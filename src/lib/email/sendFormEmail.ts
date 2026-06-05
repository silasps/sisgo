import nodemailer from 'nodemailer'

type SendFormEmailParams = {
  to: string               // candidato email
  candidateName: string
  schoolName: string
  formUrl: string
  expiresAt: string        // ISO date string
  fromEmail: string        // ETED email
  smtpPassword: string     // Gmail App Password
}

function getSmtpConfig(email: string) {
  const domain = email.split('@')[1]?.toLowerCase() ?? ''
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return { host: 'smtp.gmail.com', port: 587, secure: false }
  }
  if (['outlook.com', 'hotmail.com', 'live.com', 'msn.com'].includes(domain)) {
    return { host: 'smtp-mail.outlook.com', port: 587, secure: false }
  }
  if (domain === 'yahoo.com' || domain === 'yahoo.com.br') {
    return { host: 'smtp.mail.yahoo.com', port: 587, secure: false }
  }
  // Fallback genérico (tentativa)
  return { host: `smtp.${domain}`, port: 587, secure: false }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function buildHtml(p: SendFormEmailParams): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Formulário de Inscrição — ${p.schoolName}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:40px 40px 32px;text-align:center;">
            <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.1em;">
              Jovens Com Uma Missão
            </p>
            <h1 style="margin:0;font-size:26px;font-weight:800;color:#ffffff;line-height:1.2;">
              ${p.schoolName}
            </h1>
            <p style="margin:12px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">
              Formulário de Inscrição
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#111827;">
              Olá, ${p.candidateName}! 👋
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
              Seu formulário de inscrição para a <strong style="color:#111827;">${p.schoolName}</strong> está disponível.
              Clique no botão abaixo para acessá-lo e preencher com atenção.
            </p>

            <!-- CTA Button -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 32px;">
                  <a href="${p.formUrl}"
                    style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:16px 40px;border-radius:12px;letter-spacing:0.01em;">
                    Acessar meu formulário →
                  </a>
                </td>
              </tr>
            </table>

            <!-- Info box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:10px;border:1px solid #e5e7eb;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.05em;">
                    Informações importantes
                  </p>
                  <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">
                    ⏰ <strong>Validade do link:</strong> ${formatDate(p.expiresAt)}
                  </p>
                  <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">
                    📝 <strong>Tempo estimado:</strong> 30 a 45 minutos
                  </p>
                  <p style="margin:0;font-size:14px;color:#6b7280;">
                    💾 <strong>Progresso salvo:</strong> Você pode pausar e continuar depois.
                  </p>
                </td>
              </tr>
            </table>

            <p style="margin:28px 0 0;font-size:13px;color:#9ca3af;line-height:1.6;">
              Se o botão acima não funcionar, copie e cole este link no seu navegador:<br />
              <a href="${p.formUrl}" style="color:#4f46e5;word-break:break-all;">${p.formUrl}</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 40px;text-align:center;">
            <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">
              Dúvidas? Entre em contato:
              <a href="mailto:${p.fromEmail}" style="color:#4f46e5;">${p.fromEmail}</a>
            </p>
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              Este e-mail foi enviado automaticamente. O preenchimento do formulário não garante aceitação.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function sendFormEmail(params: SendFormEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const smtpConfig = getSmtpConfig(params.fromEmail)

    const transporter = nodemailer.createTransport({
      ...smtpConfig,
      auth: {
        user: params.fromEmail,
        pass: params.smtpPassword,
      },
    })

    await transporter.sendMail({
      from: `"${params.schoolName}" <${params.fromEmail}>`,
      to: params.to,
      subject: `Seu formulário de inscrição — ${params.schoolName}`,
      html: buildHtml(params),
    })

    return { success: true }
  } catch (err) {
    console.error('[sendFormEmail] erro:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erro ao enviar e-mail.',
    }
  }
}
