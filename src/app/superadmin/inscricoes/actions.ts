'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const PENDING_ROLE_NAME = 'pendente_alocacao'

export async function pushUserToBase(formData: FormData) {
  const userId = formData.get('user_id') as string
  const orgId = formData.get('org_id') as string
  if (!userId || !orgId) return

  const supabase = await createClient()
  const { data: { user: viewer } } = await supabase.auth.getUser()
  if (!viewer) return

  const { data: viewerRoles } = await supabase
    .from('organization_users')
    .select('roles(name)')
    .eq('user_id', viewer.id)
    .eq('active', true)

  const isSuperAdmin = (viewerRoles ?? []).some(
    row => (row.roles as unknown as { name: string } | null)?.name === 'superadmin'
  )
  if (!isSuperAdmin) return

  const admin = createAdminClient()

  const { data: org } = await admin
    .from('organizations')
    .select('id, slug')
    .eq('id', orgId)
    .eq('active', true)
    .single()
  if (!org) return

  const { data: pendingRole } = await admin
    .from('roles')
    .select('id')
    .eq('name', PENDING_ROLE_NAME)
    .single()
  if (!pendingRole) return

  const { data: targetUser } = await admin.auth.admin.getUserById(userId)
  if (!targetUser?.user) return

  const fullName = (targetUser.user.user_metadata?.full_name
    ?? targetUser.user.user_metadata?.name
    ?? '') as string
  const personName = fullName || targetUser.user.email || 'Usuário'

  const { data: existingOrgUser } = await admin
    .from('organization_users')
    .select('id')
    .eq('user_id', userId)
    .eq('organization_id', orgId)
    .maybeSingle()

  let orgUserId: string | undefined = existingOrgUser?.id

  if (existingOrgUser) {
    await admin
      .from('organization_users')
      .update({ role_id: pendingRole.id, active: true, updated_at: new Date().toISOString() })
      .eq('id', existingOrgUser.id)
  } else {
    const { data: inserted } = await admin
      .from('organization_users')
      .insert({ user_id: userId, organization_id: orgId, role_id: pendingRole.id, active: true })
      .select('id')
      .single()
    orgUserId = inserted?.id
  }

  if (!orgUserId) return

  const { data: existingProfile } = await admin
    .from('staff_profiles')
    .select('id')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existingProfile) {
    await admin.from('staff_profiles').update({ active: true }).eq('id', existingProfile.id)
  } else {
    const { data: person } = await admin
      .from('people')
      .insert({ organization_id: orgId, full_name: personName })
      .select('id')
      .single()

    if (person) {
      await admin.from('staff_profiles').insert({
        organization_id: orgId,
        person_id: person.id,
        user_id: userId,
        active: true,
      })
    }
  }

  // Avisa o DH da base para definir a área/função dessa pessoa.
  await admin.from('notification_events').insert({
    event_type: 'staff_assigned',
    payload: {
      table_name: 'organization_users',
      operation: existingOrgUser ? 'UPDATE' : 'INSERT',
      record_id: orgUserId,
      organization_id: orgId,
      person_name: personName,
    },
  })

  revalidatePath('/superadmin/inscricoes')
  revalidatePath(`/${org.slug}/obreiros`)
}
