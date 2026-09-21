import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeLang } from '@/lib/i18n/forms'
import { getFinancePendingDict, type EmailLang } from '@/lib/i18n/emails'
import { getEmailQuota } from './getEmailQuota'

type Params = {
  to: string
  recipientName: string
  recipientKind: 'candidate' | 'leader'
  organizationName: string
  organizationId: string
  personName: string
  overdueAmount: number
  pendingCount: number
  replyTo: string
  language?: string | null
}

function fmtAmount(p: Params): string {
  if (p.overdueAmount > 0) {
    return p.overdueAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + ' em atraso'
  }
  return `${p.pendingCount} cobrança${p.pendingCount > 1 ? 's' : ''} pendente${p.pendingCount > 1 ? 's' : ''}`
}

function buildHtml(p: Params): string {
  const lang = normalizeLang(p.language) as EmailLang
  const d = getFinancePendingDict(lang)
  const amount = fmtAmount(p)
  const body = p.recipientKind === 'candidate'
    ? d.bodyCandidate.replace('{org}', p.organizationName).replace('{amount}', amount)
    : d.bodyLeader.replace('{person}', p.personName).replace('{org}', p.organizationName).replace('{amount}', amount)

  return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#b45309;padding:40px 40px 32px;text-align:center;">
            <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.1em;">${p.organizationName}</p>
            <h1 style="margin:0;font-size:24px;font-weight:800;color:#fff;line-height:1.2;">${d.title}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#111827;">${d.greeting.replace('{name}', p.recipientName)}</p>
            <p style="margin:0;font-size:15px;color:#6b7280;line-height:1.6;">${body}</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 40px;text-align:center;">
            <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">
              ${d.contact} <a href="mailto:${p.replyTo}" style="color:#b45309;">${p.replyTo}</a>
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

export async function sendFinancePendingEmail(params: Params): Promise<{ success: boolean; error?: string }> {
  const quota = await getEmailQuota()
  if (quota.exceeded) return { success: false, error: 'quota_atingida' }

  const apiKey = process.env.BREVO_API_KEY
  const fromEmail = process.env.BREVO_FROM_EMAIL ?? 'noreply@sisgomission.com'
  if (!apiKey) return { success: false, error: 'E-mail não configurado.' }

  const lang = normalizeLang(params.language) as EmailLang
  const subject = getFinancePendingDict(lang).subject.replace('{org}', params.organizationName)

  let status: 'sent' | 'failed' = 'sent'
  let errorMsg: string | undefined

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: params.organizationName, email: fromEmail },
        to: [{ email: params.to, name: params.recipientName }],
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
      to_email: params.to,
      status,
      error: errorMsg ?? null,
    })
  } catch { /* log failure não bloqueia */ }

  return status === 'sent' ? { success: true } : { success: false, error: errorMsg }
}
