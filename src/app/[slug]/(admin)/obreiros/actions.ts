'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { triggerSiteRevalidation } from '@/lib/revalidate-webhook'
import { assignLeader, addMember } from '../ministerios/[id]/actions'
import { addSchoolStaff } from '../escolas/[id]/actions'

type AdminClient = ReturnType<typeof createAdminClient>

// "Criar obreiro direto" e "Editar função" só setavam staff_profiles.area
// (texto livre) — isso nunca criou o vínculo de verdade em ministry_members/
// school_staff, que é o que "Serve em:" na página da pessoa de fato lê.
// Resultado: escolher uma área no formulário não vinculava a pessoa a
// nada (bug relatado: Sirlei criada direto no ministério Intercessão
// aparecia "Nenhum vínculo").
async function linkPersonToUnitByName(
  admin: AdminClient, orgId: string, personId: string,
  unitType: string, areaName: string | null, roleTitle: string | null,
) {
  if (!areaName) return
  if (unitType === 'ministry') {
    const { data: ministry } = await admin.from('ministries').select('id').eq('organization_id', orgId).eq('name', areaName).maybeSingle()
    if (ministry) await addMember(ministry.id, personId, null)
  } else if (unitType === 'school') {
    const { data: school } = await admin.from('schools').select('id').eq('organization_id', orgId).eq('name', areaName).maybeSingle()
    if (school) await addSchoolStaff(school.id, personId, roleTitle || 'Obreiro')
  }
}
import { type AccountCredentials, lookupPersonPhone, buildWelcomeWhatsappMessage } from '@/lib/staff/accountCredentials'

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
  const unitType = (formData.get('unit_type') as string | null) ?? ''
  const roleTitleInput = (formData.get('role_title') as string | null)?.trim()
  const roleTitleFallback = (formData.get('role_title_fallback') as string | null)?.trim()
  const roleTitle = roleTitleInput || roleTitleFallback || null
  const slug = formData.get('slug') as string
  const orgId = formData.get('org_id') as string
  const redirectTo = (formData.get('redirect_to') as string | null) || `/${slug}/obreiros`

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
      .select('id, person_id')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .maybeSingle()

    if (existingProfile) {
      await admin.from('staff_profiles').update({ area, role_title: roleTitle || null }).eq('id', existingProfile.id)
      await linkPersonToUnitByName(admin, orgId, existingProfile.person_id, unitType, area, roleTitle)
    }
  }

  redirect(redirectTo)
}

export type CreatedStaffUser = AccountCredentials & { ok: true; orgUserId: string; personId: string | null }

// Cria login + vínculo + perfil de obreiro direto (sem passar por pré-
// inscrição/análise). Devolve e-mail/senha/telefone prontos pra entregar na
// hora (ver AccountCredentialsCard em NovaPessoaButton) em vez de redirecionar
// direto — sem isso a pessoa saía sem ver a senha gerada em lugar nenhum, só
// dava pra recuperar depois via "Redefinir senha" em Pessoas > Acesso.
export async function createStaffUser(formData: FormData): Promise<{ error: string } | CreatedStaffUser> {
  const fullName = (formData.get('full_name') as string).trim()
  const email = (formData.get('email') as string).trim().toLowerCase()
  const password = formData.get('password') as string
  const roleId = formData.get('role_id') as string
  const area = (formData.get('area') as string | null)?.trim() ?? null
  const unitType = (formData.get('unit_type') as string | null) ?? ''
  const roleTitle = (formData.get('role_title') as string | null)?.trim() ?? null
  const slug = formData.get('slug') as string
  const orgId = formData.get('org_id') as string

  if (!fullName || !email || !password || !roleId) return { error: 'Preencha nome, e-mail, senha e função.' }

  const admin = createAdminClient()

  const role = await resolveRole(admin, roleId)
  if (!role || BLOCKED_ROLE_NAMES.includes(role.name)) return { error: 'Função inválida.' }

  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const existingAuthUser = users.find(u => u.email?.toLowerCase() === email)
  let userId = existingAuthUser?.id

  if (!userId) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      user_metadata: { full_name: fullName, must_change_password: true },
      email_confirm: true,
    })
    if (error || !created.user) return { error: error?.message ?? 'Não foi possível criar o login.' }
    userId = created.user.id
  }

  const { data: existingOrgUser } = await admin
    .from('organization_users')
    .select('id')
    .eq('user_id', userId)
    .eq('organization_id', orgId)
    .maybeSingle()

  let orgUserId = existingOrgUser?.id ?? ''
  if (existingOrgUser) {
    await admin
      .from('organization_users')
      .update({ role_id: role.id, active: true, updated_at: new Date().toISOString() })
      .eq('id', existingOrgUser.id)
  } else {
    const { data: newOrgUser } = await admin.from('organization_users').insert({
      user_id: userId,
      organization_id: orgId,
      role_id: role.id,
      active: true,
    }).select('id').single()
    orgUserId = newOrgUser?.id ?? ''
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
    // Pessoa nova (não reaproveitada): sem isso o cadastro ficava sem
    // NENHUM contato, nem o e-mail que acabou de ser digitado aqui.
    if (personId) {
      await admin.from('person_contacts').insert({ person_id: personId, type: 'email', value: email, is_primary: true })
    }
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

    await linkPersonToUnitByName(admin, orgId, personId, unitType, area, roleTitle)
  }

  const phone = personId ? await lookupPersonPhone(admin, personId) : null
  const { data: org } = await admin.from('organizations').select('name').eq('id', orgId).single()
  const loginUrl = `https://www.sisgomission.com/${slug}`
  const whatsappMessage = buildWelcomeWhatsappMessage({ fullName, orgName: org?.name ?? 'sua base', loginUrl, email, password })

  return { ok: true, email, password, phone, orgUserId, personId: personId ?? null, whatsappMessage }
}

export async function updateExtraRoles(formData: FormData) {
  const orgUserId = formData.get('org_user_id') as string
  const orgId = formData.get('org_id') as string
  const slug = formData.get('slug') as string
  const redirectTo = (formData.get('redirect_to') as string | null) || `/${slug}/obreiros`
  const extraRoles = formData.getAll('extra_roles').map(String).filter(Boolean)
  const liderMinisterioId = (formData.get('lider_ministerio_id') as string | null) || null

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

  // "Líder de Ministério" como função adicional precisa saber de QUAL
  // ministério — reaproveita o mesmo assignLeader() da tela do ministério
  // (substitui quem já era líder desse ministério, igual lá).
  if (extraRoles.includes('lider_ministerio') && liderMinisterioId) {
    const { data: orgUser } = await admin.from('organization_users').select('user_id').eq('id', orgUserId).single()
    if (orgUser?.user_id) {
      await assignLeader(orgId, liderMinisterioId, orgUser.user_id)
    }
  }

  redirect(redirectTo)
}

export async function toggleActive(formData: FormData) {
  const orgUserId = formData.get('org_user_id') as string
  const active = formData.get('active') === 'true'
  const slug = formData.get('slug') as string
  const redirectTo = (formData.get('redirect_to') as string | null) || `/${slug}/obreiros`
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
      const { data: profile } = await admin
        .from('staff_profiles')
        .select('id, person_id')
        .eq('organization_id', orgUser.organization_id)
        .eq('user_id', orgUser.user_id)
        .maybeSingle()

      if (profile) {
        await admin
          .from('staff_profiles')
          .update({
            active: false,
            left_at: new Date().toISOString().slice(0, 10),
            sent_as_missionary: sentAsMissionary,
            sent_to: sentTo,
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.id)

        // Fecha o período em aberto no histórico da pessoa (aberto em
        // finalizarObreiro, src/app/[slug]/(admin)/inscricoes/page.tsx) — é
        // o que permite mostrar, se ela voltar anos depois, desde quando/até
        // quando foi obreira da última vez.
        const { data: openHistory } = await admin
          .from('person_status_history')
          .select('id')
          .eq('person_id', profile.person_id)
          .eq('status', 'obreiro')
          .is('ended_at', null)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (openHistory) {
          await admin.from('person_status_history')
            .update({
              ended_at: new Date().toISOString(),
              notes: sentAsMissionary ? `Enviado como missionário${sentTo ? ` — ${sentTo}` : ''}` : null,
            })
            .eq('id', openHistory.id)
        }
      }

      if (sentAsMissionary) await triggerSiteRevalidation(orgUser.organization_id, 'stats')
    }
  }

  redirect(redirectTo)
}
