'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { insertStageAdvance } from '@/lib/pipelineStageAdvance'

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

async function assertCanRequestHospedagem(organizationId: string) {
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
  if (!['superadmin', 'admin_base', 'lider_base', 'dh', 'lider_eted'].includes(role)) throw new Error('forbidden')

  return { userId: user.id, role }
}

export async function solicitarHospedagemAluno(params: {
  slug: string
  organizationId: string
  ministryId: string | null
  staffApplicationId: string // reaproveita o nome de campo do componente compartilhado — na prática é o applicationId (school_applications.id)
  guestName: string
  arrivalDate: string
  departureDate?: string | null
  notes: string | null
}) {
  const { userId, role } = await assertCanRequestHospedagem(params.organizationId)
  const sb = createAdminClient()
  const applicationId = params.staffApplicationId

  const { data: existing } = await sb
    .from('service_requests')
    .select('id')
    .eq('school_application_id', applicationId)
    .eq('request_type', 'hospedagem_aluno')
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
      request_type: 'hospedagem_aluno',
      subject: `Hospedagem — ${params.guestName}`,
      description: params.notes,
      school_application_id: applicationId,
      requested_arrival_date: params.arrivalDate,
      requested_departure_date: params.departureDate || null,
    })
  }

  revalidatePath(`/${params.slug}/inscricoes/formulario/${applicationId}`)
  revalidatePath(`/${params.slug}/inscricoes`)
  revalidatePath(`/${params.slug}/pendentes`)
}

export async function avancarEtapaAluno(params: {
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
    applicationType: 'aluno',
    applicationId: params.applicationId,
    fromStage: params.fromStage,
    toStage: params.toStage,
    reason: params.reason.trim(),
    userId,
  })
  revalidatePath(`/${params.slug}/inscricoes/formulario/${params.applicationId}`)
}
