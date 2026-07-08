'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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
