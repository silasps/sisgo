'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export type UnitRef = { type: 'school'; id: string } | { type: 'ministry'; id: string }

// Escola OU ministério onde a pessoa já serve ativamente, se houver algum
// diferente da unidade de destino (`exclude`) — usado pra decidir se
// adicionar em outro lugar é direto ou vira pendência de empréstimo (ver
// addSchoolStaffChecked/addMemberChecked nos respectivos actions.ts).
export async function findActiveUnit(orgId: string, personId: string, exclude: UnitRef): Promise<UnitRef | null> {
  const sb = createAdminClient()
  const [{ data: schoolRows }, { data: ministryRows }] = await Promise.all([
    sb.from('school_staff').select('school_id, schools(organization_id)').eq('person_id', personId).eq('active', true),
    sb.from('ministry_members').select('ministry_id, ministries(organization_id)').eq('person_id', personId).eq('active', true),
  ])
  for (const r of (schoolRows ?? []) as unknown as Array<{ school_id: string; schools: { organization_id: string } | null }>) {
    if (r.schools?.organization_id === orgId && !(exclude.type === 'school' && r.school_id === exclude.id)) {
      return { type: 'school', id: r.school_id }
    }
  }
  for (const r of (ministryRows ?? []) as unknown as Array<{ ministry_id: string; ministries: { organization_id: string } | null }>) {
    if (r.ministries?.organization_id === orgId && !(exclude.type === 'ministry' && r.ministry_id === exclude.id)) {
      return { type: 'ministry', id: r.ministry_id }
    }
  }
  return null
}

export async function createStaffLoan(params: {
  orgId: string
  personId: string
  from: UnitRef
  to: UnitRef
  role: string | null
  requestedBy: string
  startsOn: string
  endsOn: string | null
}) {
  const sb = createAdminClient()
  const { error } = await sb.from('staff_loans').insert({
    organization_id: params.orgId,
    person_id: params.personId,
    from_unit_type: params.from.type,
    from_school_id: params.from.type === 'school' ? params.from.id : null,
    from_ministry_id: params.from.type === 'ministry' ? params.from.id : null,
    to_unit_type: params.to.type,
    to_school_id: params.to.type === 'school' ? params.to.id : null,
    to_ministry_id: params.to.type === 'ministry' ? params.to.id : null,
    role: params.role,
    starts_on: params.startsOn,
    ends_on: params.endsOn,
    requested_by: params.requestedBy,
  })
  if (error) throw new Error(error.message)
}

// Aprovação/rejeição em si — chamadas a partir do hub de Pendências, que já
// é o lugar neutro que importa server actions de escolas/ministérios pra
// vários tipos de pendência (ver src/app/[slug]/(admin)/pendentes/page.tsx).
export async function approveStaffLoan(loanId: string, reviewerId: string, recommendation: string | null) {
  const sb = createAdminClient()
  const { data: loan } = await sb.from('staff_loans').select('*').eq('id', loanId).eq('status', 'pendente').single()
  if (!loan) throw new Error('Empréstimo não encontrado ou já respondido.')

  if (loan.to_unit_type === 'school') {
    const { addSchoolStaff } = await import('@/app/[slug]/(admin)/escolas/[id]/actions')
    await addSchoolStaff(loan.to_school_id as string, loan.person_id, loan.role ?? 'Obreiro')
  } else {
    const { addMember } = await import('@/app/[slug]/(admin)/ministerios/[id]/actions')
    await addMember(loan.to_ministry_id as string, loan.person_id, null)
  }

  await sb.from('staff_loans').update({
    status: 'aprovado', reviewed_by: reviewerId, reviewed_at: new Date().toISOString(), recommendation,
  }).eq('id', loanId)
}

export async function rejectStaffLoan(loanId: string, reviewerId: string, recommendation: string | null) {
  const sb = createAdminClient()
  await sb.from('staff_loans')
    .update({ status: 'rejeitado', reviewed_by: reviewerId, reviewed_at: new Date().toISOString(), recommendation })
    .eq('id', loanId).eq('status', 'pendente')
}
