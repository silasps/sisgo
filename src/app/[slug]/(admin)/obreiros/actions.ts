'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { triggerSiteRevalidation } from '@/lib/revalidate-webhook'

const BLOCKED_ROLE_NAMES = ['superadmin', 'admin_base', 'lider_base']
const REQUIRED_STAFF_ROLES: Record<string, { label: string; description: string }> = {
  lider_eted: {
    label: 'Líder de Escola',
    description: 'Gestão da sua escola: alunos, inscrições, obreiros e turmas',
  },
  obreiro_eted: {
    label: 'Obreiro de Escola',
    description: 'Acesso restrito à escola onde serve',
  },
}

async function resolveRole(admin: ReturnType<typeof createAdminClient>, rawRoleId: string) {
  if (rawRoleId.startsWith('role:')) {
    const roleName = rawRoleId.slice('role:'.length)
    const config = REQUIRED_STAFF_ROLES[roleName]
    if (!config) return null

    await admin
      .from('roles')
      .upsert({
        name: roleName,
        label: config.label,
        description: config.description,
      }, { onConflict: 'name' })

    const { data } = await admin
      .from('roles')
      .select('id, name')
      .eq('name', roleName)
      .single()
    return data
  }

  const { data } = await admin.from('roles').select('id, name').eq('id', rawRoleId).single()
  return data
}

export async function changeRole(formData: FormData) {
  const orgUserId = formData.get('org_user_id') as string
  const userId = formData.get('user_id') as string
  const roleId = formData.get('role_id') as string
  const currentRoleId = formData.get('current_role_id') as string
  const area = (formData.get('area') as string | null)?.trim() ?? null
  const roleTitleInput = (formData.get('role_title') as string | null)?.trim()
  const roleTitleFallback = (formData.get('role_title_fallback') as string | null)?.trim()
  const roleTitle = roleTitleInput || roleTitleFallback || null
  const slug = formData.get('slug') as string
  const orgId = formData.get('org_id') as string

  if (!roleId) return

  const admin = createAdminClient()
  const role = await resolveRole(admin, roleId)
  if (!role || BLOCKED_ROLE_NAMES.includes(role.name)) return

  if (role.id !== currentRoleId) {
    await admin
      .from('organization_users')
      .update({ role_id: role.id, updated_at: new Date().toISOString() })
      .eq('id', orgUserId)
  }

  if (area !== null && userId) {
    const { data: existingProfile } = await admin
      .from('staff_profiles')
      .select('id')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .maybeSingle()

    if (existingProfile) {
      await admin.from('staff_profiles').update({ area, role_title: roleTitle || null }).eq('id', existingProfile.id)
    }
  }

  redirect(`/${slug}/obreiros`)
}

export async function createStaffUser(formData: FormData) {
  const fullName = (formData.get('full_name') as string).trim()
  const email = (formData.get('email') as string).trim().toLowerCase()
  const password = formData.get('password') as string
  const roleId = formData.get('role_id') as string
  const area = (formData.get('area') as string | null)?.trim() ?? null
  const roleTitle = (formData.get('role_title') as string | null)?.trim() ?? null
  const slug = formData.get('slug') as string
  const orgId = formData.get('org_id') as string

  if (!fullName || !email || !password || !roleId) return

  const admin = createAdminClient()

  const role = await resolveRole(admin, roleId)
  if (!role || BLOCKED_ROLE_NAMES.includes(role.name)) return

  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const existingAuthUser = users.find(u => u.email?.toLowerCase() === email)
  let userId = existingAuthUser?.id

  if (!userId) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      user_metadata: { full_name: fullName },
      email_confirm: true,
    })
    if (error || !created.user) return
    userId = created.user.id
  }

  const { data: existingOrgUser } = await admin
    .from('organization_users')
    .select('id')
    .eq('user_id', userId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (existingOrgUser) {
    await admin
      .from('organization_users')
      .update({ role_id: role.id, active: true, updated_at: new Date().toISOString() })
      .eq('id', existingOrgUser.id)
  } else {
    await admin.from('organization_users').insert({
      user_id: userId,
      organization_id: orgId,
      role_id: role.id,
      active: true,
    })
  }

  const { data: existingProfile } = await admin
    .from('staff_profiles')
    .select('id, person_id')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .maybeSingle()

  let personId = existingProfile?.person_id
  if (!personId) {
    const { data: person } = await admin
      .from('people')
      .insert({ organization_id: orgId, full_name: fullName })
      .select('id')
      .single()
    personId = person?.id
  }

  if (personId) {
    const payload = {
      organization_id: orgId,
      person_id: personId,
      user_id: userId,
      role_title: roleTitle || null,
      area: area || null,
      active: true,
      accepted_at: new Date().toISOString(),
    }

    if (existingProfile) {
      await admin.from('staff_profiles').update(payload).eq('id', existingProfile.id)
    } else {
      await admin.from('staff_profiles').insert(payload)
    }
  }

  redirect(`/${slug}/obreiros`)
}

export async function updateExtraRoles(formData: FormData) {
  const orgUserId = formData.get('org_user_id') as string
  const orgId = formData.get('org_id') as string
  const slug = formData.get('slug') as string
  const extraRoles = formData.getAll('extra_roles').map(String).filter(Boolean)

  if (!orgUserId || !orgId) return

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: memberships } = await supabase
    .from('organization_users')
    .select('organization_id, roles(name)')
    .eq('user_id', user.id)
    .eq('active', true)

  type M = { organization_id: string | null; roles: { name: string } | null }
  const list = (memberships ?? []) as unknown as M[]
  const isSuperAdmin = list.some(m => m.roles?.name === 'superadmin')
  const isDH = list.some(m => m.roles?.name === 'dh' && m.organization_id === orgId)
  if (!isSuperAdmin && !isDH) return

  const admin = createAdminClient()
  await admin
    .from('organization_users')
    .update({ extra_roles: extraRoles, updated_at: new Date().toISOString() })
    .eq('id', orgUserId)
    .eq('organization_id', orgId)

  redirect(`/${slug}/obreiros`)
}

export async function toggleActive(formData: FormData) {
  const orgUserId = formData.get('org_user_id') as string
  const active = formData.get('active') === 'true'
  const slug = formData.get('slug') as string
  const sentAsMissionary = formData.get('sent_as_missionary') === 'on'
  const sentTo = (formData.get('sent_to') as string | null)?.trim() || null

  const admin = createAdminClient()
  await admin
    .from('organization_users')
    .update({ active: !active, updated_at: new Date().toISOString() })
    .eq('id', orgUserId)

  // Desligamento (active → inativo): registra se a pessoa foi enviada como
  // missionária, pra alimentar a estatística pública "missionários enviados".
  if (active) {
    const { data: orgUser } = await admin
      .from('organization_users')
      .select('organization_id, user_id')
      .eq('id', orgUserId)
      .single()

    if (orgUser?.user_id && orgUser.organization_id) {
      await admin
        .from('staff_profiles')
        .update({
          active: false,
          left_at: new Date().toISOString().slice(0, 10),
          sent_as_missionary: sentAsMissionary,
          sent_to: sentTo,
          updated_at: new Date().toISOString(),
        })
        .eq('organization_id', orgUser.organization_id)
        .eq('user_id', orgUser.user_id)

      if (sentAsMissionary) await triggerSiteRevalidation(orgUser.organization_id, 'stats')
    }
  }

  redirect(`/${slug}/obreiros`)
}
