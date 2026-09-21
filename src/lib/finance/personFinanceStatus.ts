import { createAdminClient } from '@/lib/supabase/admin'

export type PersonFinanceSummary = {
  personId: string
  pendingCount: number
  overdueCount: number
  pendingAmount: number
  overdueAmount: number
}

function emptySummary(personId: string): PersonFinanceSummary {
  return { personId, pendingCount: 0, overdueCount: 0, pendingAmount: 0, overdueAmount: 0 }
}

// Cobrança 'pending' com due_date já vencida conta como atraso mesmo que
// ninguém tenha clicado em "marcar como atrasada" na tela de Financeiro —
// essa marcação é manual, não automática, e o aviso pro DH precisa refletir
// a situação real no momento da decisão, não a última vez que alguém passou
// por aquela tela.
export async function getPeopleFinanceSummaries(organizationId: string, personIds: string[]): Promise<Map<string, PersonFinanceSummary>> {
  const map = new Map<string, PersonFinanceSummary>()
  if (personIds.length === 0) return map

  const sb = createAdminClient()
  const { data } = await sb
    .from('finance_charges')
    .select('person_id, amount, status, due_date')
    .eq('organization_id', organizationId)
    .in('person_id', personIds)
    .in('status', ['pending', 'overdue'])

  const today = new Date().toISOString().slice(0, 10)
  for (const row of (data ?? []) as Array<{ person_id: string; amount: number; status: string; due_date: string }>) {
    const summary = map.get(row.person_id) ?? emptySummary(row.person_id)
    const isOverdue = row.status === 'overdue' || (row.status === 'pending' && row.due_date < today)
    if (isOverdue) {
      summary.overdueCount += 1
      summary.overdueAmount += Number(row.amount)
    } else {
      summary.pendingCount += 1
      summary.pendingAmount += Number(row.amount)
    }
    map.set(row.person_id, summary)
  }
  return map
}

export async function getPersonFinanceSummary(organizationId: string, personId: string): Promise<PersonFinanceSummary> {
  const map = await getPeopleFinanceSummaries(organizationId, [personId])
  return map.get(personId) ?? emptySummary(personId)
}
