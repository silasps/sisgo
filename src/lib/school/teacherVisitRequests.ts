'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { resolvePerson } from '@/lib/people/resolvePerson'

type ActionResult = { error?: string }

// A base "tem hospitalidade" se alguém carrega o papel hospitalidade (direto
// na organization_users) ou se há um ministério marcado com linked_role
// 'hospitalidade' (ex: ministério de Hospitalidade que também é o
// departamento) — existência basta, não precisa ter membro ativo agora.
export async function orgHasHospitalidade(organizationId: string): Promise<boolean> {
  const db = createAdminClient()
  const { data: roleRow } = await db.from('roles').select('id').eq('name', 'hospitalidade').maybeSingle()
  if (roleRow) {
    const { count } = await db.from('organization_users')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId).eq('role_id', roleRow.id).eq('active', true)
    if ((count ?? 0) > 0) return true
  }
  const { count: linkedCount } = await db.from('ministries')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId).eq('linked_role', 'hospitalidade')
  return (linkedCount ?? 0) > 0
}

type CreateParams = {
  organizationId: string
  schoolId: string
  requestedBy: string
  fullName: string
  email: string
  phone: string
  phoneCountry: string | null
  teachStartDate: string
  teachEndDate: string
  arrivalAt: string
  departureAt: string
  needsLodging: boolean
}

export async function createTeacherVisitRequest(params: CreateParams): Promise<ActionResult> {
  const fullName = params.fullName.trim()
  const email = params.email.trim().toLowerCase()
  const phone = params.phone.trim()
  if (!fullName || !email || !phone) return { error: 'Preencha nome, e-mail e telefone do professor.' }
  if (!params.teachStartDate || !params.teachEndDate || !params.arrivalAt || !params.departureAt) {
    return { error: 'Preencha o período de aula e as datas de chegada/saída.' }
  }

  const hospedagemStatus = params.needsLodging && (await orgHasHospitalidade(params.organizationId))
    ? 'aguardando'
    : null

  const db = createAdminClient()
  const { error } = await db.from('teacher_visit_requests').insert({
    organization_id: params.organizationId,
    school_id: params.schoolId,
    requested_by: params.requestedBy,
    full_name: fullName,
    email,
    phone,
    phone_country: params.phoneCountry,
    teach_start_date: params.teachStartDate,
    teach_end_date: params.teachEndDate,
    arrival_at: params.arrivalAt,
    departure_at: params.departureAt,
    needs_lodging: params.needsLodging,
    hospedagem_status: hospedagemStatus,
  })
  if (error) return { error: 'Não foi possível criar a solicitação.' }
  return {}
}

export async function respondHospedagemTeacherVisit(params: {
  requestId: string
  respondedBy: string
  available: boolean
  notes: string | null
}): Promise<ActionResult> {
  const db = createAdminClient()
  const { data: req } = await db.from('teacher_visit_requests')
    .select('id, needs_lodging').eq('id', params.requestId).maybeSingle()
  if (!req || !req.needs_lodging) return { error: 'Solicitação não encontrada.' }

  const { error } = await db.from('teacher_visit_requests').update({
    hospedagem_status: params.available ? 'disponivel' : 'sem_disponibilidade',
    hospedagem_notes: params.notes?.trim() || null,
    hospedagem_responded_by: params.respondedBy,
    hospedagem_responded_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', params.requestId)
  if (error) return { error: 'Não foi possível registrar a resposta.' }
  return {}
}

// Autoriza a vinda do professor — resolve ou cria a pessoa (sem vínculo de
// equipe/staff: é só pra não duplicar cadastro se esse professor já passou
// pelo sistema antes, ver src/lib/people/resolvePerson.ts), mesmo que a
// hospitalidade tenha respondido que não há vaga: a passagem da pessoa pela
// base precisa ficar registrada, então a autorização não fica bloqueada.
export async function authorizeTeacherVisitRequest(params: {
  requestId: string
  authorizedBy: string
}): Promise<ActionResult> {
  const db = createAdminClient()
  const { data: req } = await db.from('teacher_visit_requests')
    .select('id, organization_id, full_name, email, phone, status')
    .eq('id', params.requestId).maybeSingle()
  if (!req) return { error: 'Solicitação não encontrada.' }
  if (req.status !== 'pendente') return { error: 'Essa solicitação já foi autorizada ou cancelada.' }

  let personId: string | null = null
  const resolved = await resolvePerson({ organizationId: req.organization_id, email: req.email, phone: req.phone })
  if (resolved) {
    personId = resolved.personId
  } else {
    const { data: person } = await db.from('people')
      .insert({ organization_id: req.organization_id, full_name: req.full_name })
      .select('id').single()
    personId = person?.id ?? null
    if (personId) {
      await db.from('person_contacts').insert({ person_id: personId, type: 'email', value: req.email, is_primary: true })
      await db.from('person_contacts').insert({ person_id: personId, type: 'phone', value: req.phone, is_primary: false })
    }
  }

  const { error } = await db.from('teacher_visit_requests').update({
    status: 'autorizado',
    authorized_by: params.authorizedBy,
    authorized_at: new Date().toISOString(),
    person_id: personId,
    updated_at: new Date().toISOString(),
  }).eq('id', params.requestId)
  if (error) return { error: 'Não foi possível autorizar a solicitação.' }
  return {}
}

export async function cancelTeacherVisitRequest(params: {
  requestId: string
  cancelledBy: string
  reason: string | null
}): Promise<ActionResult> {
  const db = createAdminClient()
  const { error } = await db.from('teacher_visit_requests').update({
    status: 'cancelado',
    cancelled_by: params.cancelledBy,
    cancelled_at: new Date().toISOString(),
    cancel_reason: params.reason?.trim() || null,
    updated_at: new Date().toISOString(),
  }).eq('id', params.requestId).eq('status', 'pendente')
  if (error) return { error: 'Não foi possível cancelar a solicitação.' }
  return {}
}

// Permissão que o líder dá a um obreiro específico pra ver a hospedagem do
// professor visitante desta escola — por padrão ninguém além de líder/DH vê.
export async function setTeacherLodgingAccess(params: {
  organizationId: string
  schoolId: string
  personId: string
  canView: boolean
  setBy: string
}): Promise<ActionResult> {
  const db = createAdminClient()
  const { error } = await db.from('school_teacher_lodging_access').upsert({
    organization_id: params.organizationId,
    school_id: params.schoolId,
    person_id: params.personId,
    can_view: params.canView,
    set_by: params.setBy,
    set_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'school_id,person_id' })
  if (error) return { error: 'Não foi possível salvar a permissão.' }
  return {}
}

export async function getTeacherLodgingAccessMap(schoolId: string, personIds: string[]): Promise<Map<string, boolean>> {
  if (personIds.length === 0) return new Map()
  const db = createAdminClient()
  const { data } = await db.from('school_teacher_lodging_access')
    .select('person_id, can_view').eq('school_id', schoolId).in('person_id', personIds)
  return new Map((data ?? []).map(r => [r.person_id, r.can_view]))
}

export async function personCanViewTeacherLodging(schoolId: string, personId: string): Promise<boolean> {
  const db = createAdminClient()
  const { data } = await db.from('school_teacher_lodging_access')
    .select('can_view').eq('school_id', schoolId).eq('person_id', personId).maybeSingle()
  return data?.can_view ?? false
}
