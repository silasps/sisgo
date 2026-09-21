import { createAdminClient } from '@/lib/supabase/admin'
import { getPersonFinanceSummary } from './personFinanceStatus'
import { sendFinancePendingEmail } from '@/lib/email/sendFinancePendingEmail'

type Params = {
  organizationId: string
  personId: string
  personName: string
  notifyCandidate: boolean
  notifyLeaderEmail: string | null
  language?: string | null
}

// Best-effort, chamada depois da mudança de estado principal (transferência
// efetivada, matrícula feita, obreiro aprovado) — reverifica a pendência na
// hora do envio (pode ter sido resolvida entre o carregamento da página e o
// clique) e nunca deixa uma falha de e-mail interferir na ação principal,
// que já terminou.
export async function notifyFinancePendency(params: Params): Promise<void> {
  if (!params.notifyCandidate && !params.notifyLeaderEmail) return

  const summary = await getPersonFinanceSummary(params.organizationId, params.personId)
  if (summary.pendingCount === 0 && summary.overdueCount === 0) return

  const db = createAdminClient()
  const { data: org } = await db.from('organizations').select('name, email').eq('id', params.organizationId).maybeSingle()
  const organizationName = org?.name ?? 'Organização'
  const replyTo = org?.email || 'noreply@sisgomission.com'

  const sends: Promise<unknown>[] = []

  if (params.notifyCandidate) {
    sends.push((async () => {
      const { data: contact } = await db.from('person_contacts')
        .select('value').eq('person_id', params.personId).eq('type', 'email')
        .order('is_primary', { ascending: false }).limit(1).maybeSingle()
      if (!contact?.value) return
      await sendFinancePendingEmail({
        to: contact.value,
        recipientName: params.personName,
        recipientKind: 'candidate',
        organizationName,
        organizationId: params.organizationId,
        personName: params.personName,
        overdueAmount: summary.overdueAmount,
        pendingCount: summary.pendingCount,
        replyTo,
        language: params.language,
      })
    })().catch(() => {}))
  }

  if (params.notifyLeaderEmail) {
    sends.push(sendFinancePendingEmail({
      to: params.notifyLeaderEmail,
      recipientName: 'Líder',
      recipientKind: 'leader',
      organizationName,
      organizationId: params.organizationId,
      personName: params.personName,
      overdueAmount: summary.overdueAmount,
      pendingCount: summary.pendingCount,
      replyTo,
      language: params.language,
    }).catch(() => {}))
  }

  await Promise.all(sends)
}
