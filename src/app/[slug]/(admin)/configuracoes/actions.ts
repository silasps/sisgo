'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ACCENT_COLORS } from '@/lib/accent-colors'
import { revalidatePath } from 'next/cache'
import { asLooseClient } from '@/lib/supabase/loose-client'

async function verifyAccess(orgId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: memberships } = await supabase
    .from('organization_users')
    .select('organization_id, roles(name)')
    .eq('user_id', user.id)
    .eq('active', true)

  type Membership = { organization_id: string; roles: unknown }
  const getRoleName = (m: Membership) => (m.roles as { name: string } | null)?.name
  const list = (memberships ?? []) as Membership[]
  const isSuperAdmin = list.some(m => getRoleName(m) === 'superadmin')
  const isLiderBase  = list.some(m =>
    getRoleName(m) === 'lider_base' && m.organization_id === orgId
  )

  if (!isSuperAdmin && !isLiderBase) return null
  return createAdminClient()
}

export async function updateAccentColor(orgId: string, slug: string, colorKey: string) {
  if (!(colorKey in ACCENT_COLORS)) return
  const admin = await verifyAccess(orgId)
  if (!admin) return
  await admin.from('organizations').update({ accent_color: colorKey }).eq('id', orgId)
  revalidatePath(`/${slug}/configuracoes`)
}

export async function updateLogoUrl(orgId: string, slug: string, logoUrl: string) {
  const admin = await verifyAccess(orgId)
  if (!admin) return
  await admin.from('organizations').update({ logo_url: logoUrl }).eq('id', orgId)
  revalidatePath(`/${slug}/configuracoes`)
}

export async function updateAreaCashScopes(orgId: string, slug: string, formData: FormData) {
  const verifiedAdmin = await verifyAccess(orgId)
  if (!verifiedAdmin) return
  const admin = asLooseClient(verifiedAdmin)

  const { data: { user } } = await (await createClient()).auth.getUser()
  const enabled = new Set(formData.getAll('cash_scopes').map(String))

  const [{ data: schools }, { data: ministries }] = await Promise.all([
    admin.from('schools').select('id, name').eq('organization_id', orgId).eq('active', true),
    admin.from('ministries').select('id, name').eq('organization_id', orgId).eq('active', true),
  ])

  for (const school of (schools ?? []) as Array<{ id: string; name: string }>) {
    const isEnabled = enabled.has(`school:${school.id}`)
    const payload = {
      organization_id: orgId,
      entity_type: 'school',
      school_id: school.id,
      ministry_id: null,
      enabled: isEnabled,
      name_snapshot: school.name,
      configured_by: user?.id ?? null,
      configured_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const { data: existingData } = await admin
      .from('finance_cash_scopes')
      .select('id')
      .eq('organization_id', orgId)
      .eq('entity_type', 'school')
      .eq('school_id', school.id)
      .maybeSingle()
    const existing = existingData as { id: string } | null | undefined

    if (existing?.id) {
      await admin.from('finance_cash_scopes').update(payload).eq('id', existing.id)
    } else {
      await admin.from('finance_cash_scopes').insert(payload)
    }
  }

  for (const ministry of (ministries ?? []) as Array<{ id: string; name: string }>) {
    const isEnabled = enabled.has(`ministry:${ministry.id}`)
    const payload = {
      organization_id: orgId,
      entity_type: 'ministry',
      school_id: null,
      ministry_id: ministry.id,
      enabled: isEnabled,
      name_snapshot: ministry.name,
      configured_by: user?.id ?? null,
      configured_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const { data: existingData } = await admin
      .from('finance_cash_scopes')
      .select('id')
      .eq('organization_id', orgId)
      .eq('entity_type', 'ministry')
      .eq('ministry_id', ministry.id)
      .maybeSingle()
    const existing = existingData as { id: string } | null | undefined

    if (existing?.id) {
      await admin.from('finance_cash_scopes').update(payload).eq('id', existing.id)
    } else {
      await admin.from('finance_cash_scopes').insert(payload)
    }
  }

  revalidatePath(`/${slug}/configuracoes`)
  revalidatePath(`/${slug}/financeiro`)
  revalidatePath(`/${slug}/caixa`)
}
