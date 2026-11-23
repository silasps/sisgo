import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeLang } from '@/lib/i18n/forms'
import { getApplicationReceivedDict, type EmailLang } from '@/lib/i18n/emails'

type Params = {
  to: string
  candidateName: string
  organizationName: string
  schoolName: string
  className: string
  replyTo: string
  organizationId: string
  schoolId: string
  eventInfo?: string | null
  eventInfoPdfUrl?: string | null
  language?: string | null
}

function buildHtml(p: Params): string {
  const lang = normalizeLang(p.language) as EmailLang
  const d = getApplicationReceivedDict(lang)
  const hasInfo = !!p.eventInfo || !!p.eventInfoPdfUrl
  const infoBox = hasInfo ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border-radius:10px;border:1px solid #fde68a;margin-bottom:24px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#92400e;text-transform:uppercase;letter-spacing:0.05em;">${d.infoTitle}</p>
                  ${p.eventInfo ? `<p style="margin:0 0 12px;font-size:14px;color:#78350f;line-height:1.6;white-space:pre-wrap;">${p.eventInfo}</p>` : ''}
                  ${p.eventInfoPdfUrl ? `<a href="${p.eventInfoPdfUrl}" style="display:inline-block;font-size:13px;font-weight:600;color:#92400e;">${d.pdfCta}</a>` : ''}
                </td>
              </tr>
            </table>` : ''
  return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5 0%,#4338ca 100%);padding:40px 40px 32px;text-align:center;">
            <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.1em;">${p.organizationName || d.title}</p>
            <h1 style="margin:0;font-size:26px;font-weight:800;color:#fff;line-height:1.2;">${d.title}</h1>
            <p style="margin:12px 0 0;font-size:14px;color:rgba(255,255,255,0.85);">${p.schoolName}${p.className ? ` — ${p.className}` : ''}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#111827;">${d.greeting.replace('{name}', p.candidateName)}</p>
            <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
              ${d.body.replace('{school}', p.schoolName)}
            </p>
            ${infoBox}
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 40px;text-align:center;">
            <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">
              ${d.contact} <a href="mailto:${p.replyTo}" style="color:#4f46e5;">${p.replyTo}</a>
            </p>
            <p style="margin:0;font-size:12px;color:#9ca3af;">${d.disclaimer}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function sendApplicationReceivedEmail(params: Params): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY
  const fromEmail = process.env.BREVO_FROM_EMAIL ?? 'noreply@sisgomission.com'
  if (!apiKey) return

  const lang = normalizeLang(params.language) as EmailLang
  const subject = getApplicationReceivedDict(lang).subject.replace('{school}', params.schoolName)

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
