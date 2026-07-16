'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { PROFILE_ROLES } from '@/lib/auth/permissions'
import { revalidatePath } from 'next/cache'

async function verifyAccess(orgId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { role } = await getCurrentOrganizationRole(supabase, user.id, orgId)
  if (!PROFILE_ROLES.includes(role as never)) return null

  return createAdminClient()
}

export async function generateCardToken(orgId: string, personId: string, slug: string) {
  const admin = await verifyAccess(orgId)
  if (!admin) return

  await admin.from('person_public_tokens').update({ revoked_at: new Date().toISOString() })
    .eq('person_id', personId).is('revoked_at', null)

  await admin.from('person_public_tokens').insert({ organization_id: orgId, person_id: personId })

  revalidatePath(`/${slug}/pessoas/${personId}/carteirinha`)
}

export async function revokeCardToken(orgId: string, personId: string, slug: string) {
  const admin = await verifyAccess(orgId)
  if (!admin) return

  await admin.from('person_public_tokens').update({ revoked_at: new Date().toISOString() })
    .eq('person_id', personId).is('revoked_at', null)

  revalidatePath(`/${slug}/pessoas/${personId}/carteirinha`)
}

export async function updatePersonPhoto(orgId: string, personId: string, slug: string, formData: FormData) {
  const admin = await verifyAccess(orgId)
  if (!admin) return

  const photoUrl = (formData.get('photo_url') as string | null)?.trim() || null
  await admin.from('people').update({ photo_url: photoUrl }).eq('id', personId).eq('organization_id', orgId)

  revalidatePath(`/${slug}/pessoas/${personId}/carteirinha`)
}
