import { createAdminClient } from '@/lib/supabase/admin'
import { getEmailQuota } from './getEmailQuota'
import { normalizeLang } from '@/lib/i18n/forms'

type Params = {
  to: string
  orgName: string
  rulesText: string
  organizationId: string
  language?: string | null
}

const LABELS: Record<'pt' | 'en' | 'es', { subject: string; title: string; intro: string }> = {
  pt: {
    subject: 'Regras e valores da instituição',
    title: 'Regras e valores',
    intro: 'Aqui está o texto que você pediu para receber por e-mail:',
  },
  en: {
    subject: 'Institution rules and values',
    title: 'Rules and values',
    intro: "Here's the text you asked to receive by email:",
  },
  es: {
    subject: 'Reglas y valores de la institución',
    title: 'Reglas y valores',
    intro: 'Aquí está el texto que pediste recibir por correo:',
  },
}

function buildHtml(p: Params): string {
  const lang = normalizeLang(p.language) as 'pt' | 'en' | 'es'
  const l = LABELS[lang]
  const escaped = p.rulesText
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#374151;padding:32px 40px;text-align:center;">
            <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.1em;">${p.orgName}</p>
            <h1 style="margin:0;font-size:22px;font-weight:800;color:#fff;line-height:1.2;">${l.title}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">${l.intro}</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:10px;border:1px solid #e5e7eb;">
              <tr>
                <td style="padding:24px;">
                  <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;white-space:pre-wrap;">${escaped}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function sendInstitutionRulesEmail(params: Params): Promise<{ success: boolean; error?: string }> {
  const quota = await getEmailQuota()
  if (quota.exceeded) return { success: false, error: 'quota_atingida' }

  const apiKey = process.env.BREVO_API_KEY
  const fromEmail = process.env.BREVO_FROM_EMAIL ?? 'noreply@sisgomission.com'
  if (!apiKey) return { success: false, error: 'E-mail não configurado.' }

  const lang = normalizeLang(params.language) as 'pt' | 'en' | 'es'
  const subject = `${params.orgName} — ${LABELS[lang].subject}`

  let status: 'sent' | 'failed' = 'sent'
  let errorMsg: string | undefined

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: params.orgName, email: fromEmail },
        to: [{ email: params.to }],
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
      to_email: params.to,
      status,
      error: errorMsg ?? null,
    })
  } catch { /* log failure não bloqueia */ }

  if (status === 'failed') return { success: false, error: errorMsg }
  return { success: true }
}
