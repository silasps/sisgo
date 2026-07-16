'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { insertStageAdvance } from '@/lib/pipelineStageAdvance'

async function assertCanManage(organizationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('unauthorized')

  const { data: orgUsers } = await supabase
    .from('organization_users')
    .select('organization_id, roles(name)')
    .eq('user_id', user.id)
    .eq('active', true)

  const memberships = (orgUsers ?? []) as unknown as Array<{ organization_id: string | null; roles: { name: string } | null }>
  const role = memberships.find(m => m.roles?.name === 'superadmin')?.roles?.name
    ?? memberships.find(m => m.organization_id === organizationId)?.roles?.name
    ?? ''
  if (!['superadmin', 'admin_base', 'lider_base', 'dh'].includes(role)) throw new Error('forbidden')

  return user.id
}

async function assertDh(organizationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('unauthorized')

  const { data: orgUsers } = await supabase
    .from('organization_users')
    .select('organization_id, roles(name)')
    .eq('user_id', user.id)
    .eq('active', true)

  const memberships = (orgUsers ?? []) as unknown as Array<{ organization_id: string | null; roles: { name: string } | null }>
  const role = memberships.find(m => m.roles?.name === 'superadmin')?.roles?.name
    ?? memberships.find(m => m.organization_id === organizationId)?.roles?.name
    ?? ''
  if (!['superadmin', 'admin_base', 'dh'].includes(role)) throw new Error('forbidden')

  return user.id
}

export async function pularReferenciaPastor(params: {
  staffApplicationId: string
  organizationId: string
  slug: string
  reason: string
}) {
  if (!params.reason.trim()) throw new Error('Justificativa obrigatória')
  const userId = await assertDh(params.organizationId)
  const sb = createAdminClient()
  await sb.from('staff_applications').update({
    pastor_reference_skip_reason: params.reason.trim(),
    pastor_reference_skipped_by: userId,
    pastor_reference_skipped_at: new Date().toISOString(),
  }).eq('id', params.staffApplicationId)
  revalidatePath(`/${params.slug}/inscricoes/formulario-obreiro/${params.staffApplicationId}`)
}

export async function avancarEtapaObreiro(params: {
  applicationId: string
  organizationId: string
  slug: string
  fromStage: string
  toStage: string
  reason: string
}) {
  if (!params.reason.trim()) throw new Error('Justificativa obrigatória')
  const userId = await assertDh(params.organizationId)
  await insertStageAdvance(createAdminClient(), {
    organizationId: params.organizationId,
    applicationType: 'obreiro',
    applicationId: params.applicationId,
    fromStage: params.fromStage,
    toStage: params.toStage,
    reason: params.reason.trim(),
    userId,
  })
  revalidatePath(`/${params.slug}/inscricoes/formulario-obreiro/${params.applicationId}`)
}

async function assertCanHandoffHospedagem(organizationId: string, ministryId: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('unauthorized')

  const { data: orgUsers } = await supabase
    .from('organization_users')
    .select('organization_id, roles(name)')
    .eq('user_id', user.id)
    .eq('active', true)

  const memberships = (orgUsers ?? []) as unknown as Array<{ organization_id: string | null; roles: { name: string } | null }>
  const role = memberships.find(m => m.roles?.name === 'superadmin')?.roles?.name
    ?? memberships.find(m => m.organization_id === organizationId)?.roles?.name
    ?? ''

  if (['superadmin', 'admin_base', 'lider_base', 'dh'].includes(role)) return { userId: user.id, role }

  if (role === 'lider_ministerio' && ministryId) {
    const { data: leaderRow } = await supabase
      .from('ministry_leaders')
      .select('id')
      .eq('user_id', user.id)
      .eq('ministry_id', ministryId)
      .maybeSingle()
    if (leaderRow) return { userId: user.id, role }
  }

  throw new Error('forbidden')
}

export async function solicitarHospedagemObreiro(params: {
  slug: string
  organizationId: string
  ministryId: string | null
  staffApplicationId: string
  guestName: string
  arrivalDate: string
  departureDate?: string | null
  notes: string | null
}) {
  const { userId, role } = await assertCanHandoffHospedagem(params.organizationId, params.ministryId)
  const sb = createAdminClient()

  const { data: existing } = await sb
    .from('service_requests')
    .select('id')
    .eq('staff_application_id', params.staffApplicationId)
    .eq('request_type', 'hospedagem_obreiro')
    .in('status', ['pendente', 'em_analise'])
    .maybeSingle()

  if (existing) {
    await sb.from('service_requests').update({
      requested_arrival_date: params.arrivalDate,
      requested_departure_date: params.departureDate || null,
      description: params.notes,
    }).eq('id', existing.id)
  } else {
    await sb.from('service_requests').insert({
      organization_id: params.organizationId,
      requester_id: userId,
      requester_role: role,
      target_department: 'hospitalidade',
      request_type: 'hospedagem_obreiro',
      subject: `Hospedagem — ${params.guestName}`,
      description: params.notes,
      staff_application_id: params.staffApplicationId,
      requested_arrival_date: params.arrivalDate,
      requested_departure_date: params.departureDate || null,
    })
  }

  revalidatePath(`/${params.slug}/inscricoes/formulario-obreiro/${params.staffApplicationId}`)
  revalidatePath(`/${params.slug}/inscricoes`)
  revalidatePath(`/${params.slug}/pendentes`)
}

export async function pularHospedagem(params: {
  staffApplicationId: string
  organizationId: string
  slug: string
  reason: string
}) {
  if (!params.reason.trim()) throw new Error('Justificativa obrigatória')
  const userId = await assertDh(params.organizationId)
  const sb = createAdminClient()
  await sb.from('staff_applications').update({
    hospedagem_skip_reason: params.reason.trim(),
    hospedagem_skipped_by: userId,
    hospedagem_skipped_at: new Date().toISOString(),
  }).eq('id', params.staffApplicationId)
  revalidatePath(`/${params.slug}/inscricoes/formulario-obreiro/${params.staffApplicationId}`)
}

export async function criarAlocacaoObreiro(params: {
  slug: string
  organizationId: string
  ministryId: string | null
  staffApplicationId: string
  personId: string | null
  guestName: string
  roomId: string
  bedId: string | null
  checkIn: string
  checkOut: string
  notes: string | null
}) {
  const { userId } = await assertCanHandoffHospedagem(params.organizationId, params.ministryId)
  const { createAllocation } = await import('@/app/[slug]/(admin)/hospedagem/actions')
  await createAllocation({
    organizationId: params.organizationId,
    roomId: params.roomId,
    bedId: params.bedId,
    reservationId: null,
    personId: params.personId,
    guestName: params.guestName,
    guestType: 'obreiro',
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    notes: params.notes,
    createdBy: userId,
  })
  revalidatePath(`/${params.slug}/inscricoes/formulario-obreiro/${params.staffApplicationId}`)
}

export async function updateBackgroundCheck(params: {
  id: string
  organizationId: string
  slug: string
  staffApplicationId: string
  status: string
  notes: string
  issuedAt: string
  expiresAt: string
  flaggedConcern: boolean
}) {
  const userId = await assertCanManage(params.organizationId)
  const sb = createAdminClient()
  await sb.from('background_checks').update({
    status: params.status,
    notes: params.notes || null,
    issued_at: params.issuedAt || null,
    expires_at: params.expiresAt || null,
    flagged_concern: params.flaggedConcern,
    reviewed_by: userId,
    reviewed_at: new Date().toISOString(),
  }).eq('id', params.id)
  revalidatePath(`/${params.slug}/inscricoes/formulario-obreiro/${params.staffApplicationId}`)
}

export async function addBackgroundCheck(params: {
  organizationId: string
  slug: string
  staffApplicationId: string
  personId: string | null
  checkType: string
  country: string
}) {
  await assertCanManage(params.organizationId)
  const sb = createAdminClient()
  await sb.from('background_checks').insert({
    organization_id: params.organizationId,
    staff_application_id: params.staffApplicationId,
    person_id: params.personId,
    check_type: params.checkType,
    country: params.country || null,
  })
  revalidatePath(`/${params.slug}/inscricoes/formulario-obreiro/${params.staffApplicationId}`)
}
