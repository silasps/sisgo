'use server'

import { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

async function grantSchoolLeaderRole(sb: AdminClient, orgId: string, schoolId: string, userId: string) {
  const { data: role } = await sb.from('roles').select('id').eq('name', 'lider_eted').single()
  if (role) {
    await sb.from('organization_users')
      .update({ role_id: role.id, updated_at: new Date().toISOString() })
      .eq('user_id', userId).eq('organization_id', orgId)
  }

  // Preenche a área em staff_profiles (mesmo padrão já usado em
  // confirmTransferAsDH pra transferência entre ministérios) — sem isso o
  // card em Obreiros/Pessoas fica sem área e o formulário de "Editar função"
  // nasce com o seletor de área vazio, mesmo com o vínculo já existindo em
  // school_leaders.
  const { data: school } = await sb.from('schools').select('name').eq('id', schoolId).single()
  if (school) {
    await sb.from('staff_profiles')
      .update({ area: school.name, role_title: 'Líder', updated_at: new Date().toISOString() })
      .eq('organization_id', orgId).eq('user_id', userId)
  }
}

// "Atribuir líder" — usado quando a escola ainda não tem nenhum. Substitui
// qualquer liderança anterior (histórico: era o único fluxo, "trocar líder").
export async function assignSchoolLeader(orgId: string, schoolId: string, userId: string) {
  const sb = createAdminClient()
  await sb.from('school_leaders').delete().eq('school_id', schoolId)
  await sb.from('school_leaders').insert({ organization_id: orgId, school_id: schoolId, user_id: userId })
  await grantSchoolLeaderRole(sb, orgId, schoolId, userId)
}

// "Adicionar colíder" — soma à liderança existente em vez de substituir.
// school_leaders permite N líderes por escola (unique é (school_id, user_id),
// não escola sozinha) — getMySchools/getSchoolLink já tratam qualquer linha
// como acesso de líder, então múltiplas linhas já funcionavam no lado de
// leitura; só faltava um jeito de inserir sem apagar os demais.
export async function addSchoolCoLeader(orgId: string, schoolId: string, userId: string) {
  const sb = createAdminClient()
  const { error } = await sb.from('school_leaders').insert({ organization_id: orgId, school_id: schoolId, user_id: userId })
  if (error) throw new Error(error.message)
  await grantSchoolLeaderRole(sb, orgId, schoolId, userId)
}

export async function removeSchoolLeader(schoolId: string, userId: string) {
  const sb = createAdminClient()
  await sb.from('school_leaders').delete().eq('school_id', schoolId).eq('user_id', userId)
}

export async function addSchoolStaff(schoolId: string, personId: string, role: string) {
  const sb = createAdminClient()
  const { data: existing } = await sb
    .from('school_staff').select('id').eq('school_id', schoolId).eq('person_id', personId).single()
  if (existing) {
    await sb.from('school_staff').update({ active: true, role, joined_at: new Date().toISOString() }).eq('id', existing.id)
  } else {
    await sb.from('school_staff').insert({ school_id: schoolId, person_id: personId, role })
  }
}

// Adiciona só se a pessoa não estiver ativa em outra escola/ministério da
// mesma organização — se estiver, não adiciona direto: cria um empréstimo
// pendente (staff_loans) que só efetiva quando o líder de origem aprova
// (ver src/lib/staff-loans.ts e o hub de Pendências).
export async function addSchoolStaffChecked(params: {
  orgId: string; schoolId: string; personId: string; role: string
  requestedBy: string; startsOn: string; endsOn: string
}): Promise<'added' | 'pending_loan'> {
  const { findActiveUnit, createStaffLoan } = await import('@/lib/staff-loans')
  const from = await findActiveUnit(params.orgId, params.personId, { type: 'school', id: params.schoolId })
  if (!from) {
    await addSchoolStaff(params.schoolId, params.personId, params.role)
    return 'added'
  }
  await createStaffLoan({
    orgId: params.orgId, personId: params.personId, from, to: { type: 'school', id: params.schoolId },
    role: params.role, requestedBy: params.requestedBy, startsOn: params.startsOn, endsOn: params.endsOn,
  })
  return 'pending_loan'
}

// Adiciona vários obreiros de uma vez (ex.: DH selecionando um lote no
// MultiSelectModal) — cada pessoa é independente, roda em paralelo. Retorna
// quantos entraram direto vs. quantos viraram pendência de empréstimo.
export async function addSchoolStaffBatch(params: {
  orgId: string; schoolId: string; personIds: string[]; role: string
  requestedBy: string; startsOn: string; endsOn: string
}): Promise<{ added: number; pendingLoans: number }> {
  const results = await Promise.all(params.personIds.map(personId =>
    addSchoolStaffChecked({ ...params, personId })
  ))
  return {
    added: results.filter(r => r === 'added').length,
    pendingLoans: results.filter(r => r === 'pending_loan').length,
  }
}

export async function removeSchoolStaff(staffId: string) {
  const sb = createAdminClient()
  await sb.from('school_staff').update({ active: false }).eq('id', staffId)
}

// ── Workflow de solicitação (lider_eted → DH) ─────────────────────────────────

export async function submitSchoolObreiroRequest(
  orgId: string, schoolId: string, requestedBy: string,
  personId: string, role: string, notes: string | null,
) {
  const sb = createAdminClient()
  const { error } = await sb.from('school_pending_requests').insert({
    organization_id: orgId, school_id: schoolId,
    requested_by: requestedBy, person_id: personId, role, notes,
  })
  if (error) throw new Error(error.message)
}

export async function approveSchoolObreiroRequest(requestId: string, reviewedBy: string) {
  const sb = createAdminClient()
  const { data: req } = await sb.from('school_pending_requests').select('*').eq('id', requestId).single()
  if (!req || !req.person_id) throw new Error('Solicitação inválida')
  await addSchoolStaff(req.school_id, req.person_id, req.role)
  await sb.from('school_pending_requests').update({
    status: 'aprovado', reviewed_by: reviewedBy, reviewed_at: new Date().toISOString(),
  }).eq('id', requestId)
}

export async function rejectSchoolObreiroRequest(requestId: string, reviewedBy: string, reviewNotes: string | null) {
  const sb = createAdminClient()
  await sb.from('school_pending_requests').update({
    status: 'rejeitado', reviewed_by: reviewedBy,
    reviewed_at: new Date().toISOString(), review_notes: reviewNotes,
  }).eq('id', requestId)
}

export async function cancelSchoolObreiroRequest(requestId: string) {
  const sb = createAdminClient()
  await sb.from('school_pending_requests')
    .update({ status: 'cancelado' })
    .eq('id', requestId).eq('status', 'pendente')
}

export async function toggleTurmaActive(classId: string, active: boolean) {
  const sb = createAdminClient()
  await sb.from('school_classes').update({ active: !active }).eq('id', classId)
}

export async function deleteTurma(classId: string) {
  const sb = createAdminClient()
  const { count } = await sb
    .from('school_class_enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('class_id', classId)
  if (count && count > 0) throw new Error('Turma possui alunos matriculados.')
  await sb.from('school_classes').delete().eq('id', classId)
}

// Exclusão de escola cascateia turmas, inscrições e pré-inscrições (FKs "on
// delete cascade"). Por segurança, só permite excluir uma escola vazia —
// serve pra limpar duplicatas criadas por engano, não pra apagar histórico.
export async function deleteSchool(schoolId: string) {
  const sb = createAdminClient()
  const [{ count: turmasCount }, { count: applicationsCount }, { count: interestCount }] = await Promise.all([
    sb.from('school_classes').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
    sb.from('school_applications').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
    sb.from('school_interest_forms').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
  ])
  if (turmasCount) throw new Error('Escola possui turmas cadastradas — remova as turmas antes de excluir.')
  if (applicationsCount) throw new Error('Escola possui inscrições cadastradas.')
  if (interestCount) throw new Error('Escola possui pré-inscrições cadastradas.')
  await sb.from('schools').delete().eq('id', schoolId)
}
