'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ACCENT_COLORS } from '@/lib/accent-colors'
import { revalidatePath } from 'next/cache'

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
