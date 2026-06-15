import { createAdminClient } from '@/lib/supabase/admin'
import { getEmailQuota } from './getEmailQuota'
import { normalizeLang } from '@/lib/i18n/forms'
import { getEmailDict, emailLocale, type EmailLang } from '@/lib/i18n/emails'

type SendFormEmailParams = {
  to: string
  candidateName: string
  schoolName: string
  formUrl: string
  expiresAt: string
  replyTo: string        // e-mail da ETED (usado como reply-to)
  language?: string | null
  organizationId?: string
  schoolId?: string
}

function formatDate(iso: string, lang: EmailLang) {
  return new Date(iso).toLocaleDateString(emailLocale(lang), { day: '2-digit', month: 'long', year: 'numeric' })
}

function buildHtml(p: SendFormEmailParams): string {
  const lang = normalizeLang(p.language) as EmailLang
  const d = getEmailDict(lang)
  const date = formatDate(p.expiresAt, lang)

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${d.subtitle} — ${p.schoolName}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:40px 40px 32px;text-align:center;">
            <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.1em;">
              ${d.org}
            </p>
            <h1 style="margin:0;font-size:26px;font-weight:800;color:#ffffff;line-height:1.2;">
              ${p.schoolName}
            </h1>
            <p style="margin:12px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">
              ${d.subtitle}
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#111827;">
              ${d.greeting.replace('{name}', p.candidateName)}
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
              ${d.body.replace('{school}', p.schoolName)}
            </p>

            <!-- CTA Button -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 32px;">
                  <a href="${p.formUrl}"
                    style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:16px 40px;border-radius:12px;letter-spacing:0.01em;">
                    ${d.cta}
                  </a>
                </td>
              </tr>
            </table>

            <!-- Info box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:10px;border:1px solid #e5e7eb;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.05em;">
                    ${d.infoTitle}
                  </p>
                  <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">
                    ${d.validity.replace('{date}', date)}
                  </p>
                  <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">
                    ${d.time}
                  </p>
                  <p style="margin:0;font-size:14px;color:#6b7280;">
                    ${d.progress}
                  </p>
                </td>
              </tr>
            </table>

            <p style="margin:28px 0 0;font-size:13px;color:#9ca3af;line-height:1.6;">
              ${d.fallback}<br />
              <a href="${p.formUrl}" style="color:#4f46e5;word-break:break-all;">${p.formUrl}</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 40px;text-align:center;">
            <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">
              ${d.contact}
              <a href="mailto:${p.replyTo}" style="color:#4f46e5;">${p.replyTo}</a>
            </p>
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              ${d.disclaimer}
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
  const quota = await getEmailQuota()
  if (quota.exceeded) {
    return { success: false, error: 'quota_atingida' }
  }

  const apiKey = process.env.BREVO_API_KEY
  const fromEmail = process.env.BREVO_FROM_EMAIL ?? 'noreply@sisgomission.com'
  const lang = normalizeLang(params.language) as EmailLang
  const subject = lang === 'en'
    ? `Your application form — ${params.schoolName}`
    : lang === 'es'
      ? `Tu formulario de inscripción — ${params.schoolName}`
      : `Seu formulário de inscrição — ${params.schoolName}`

  let status: 'sent' | 'failed' = 'sent'
  let errorMsg: string | undefined

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey ?? '',
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: params.schoolName, email: fromEmail },
        to: [{ email: params.to, name: params.candidateName }],
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

  // Registra o envio (sucesso ou falha) para controle de quota
  try {
    const db = createAdminClient()
    await db.from('email_logs').insert({
      organization_id: params.organizationId ?? null,
      school_id: params.schoolId ?? null,
      to_email: params.to,
      status,
      error: errorMsg ?? null,
    })
  } catch (logErr) {
    console.error('[sendFormEmail] falha ao registrar log:', logErr)
  }

  if (status === 'failed') {
    console.error('[sendFormEmail] erro:', errorMsg)
    return { success: false, error: errorMsg }
  }

  return { success: true }
}
