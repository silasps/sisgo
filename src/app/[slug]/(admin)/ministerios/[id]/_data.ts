import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { getMinistryLink, type MinistryLink } from '@/lib/auth/unit-access'
import type { RolePreview } from '@/lib/role-preview'

// O layout, o chat e o Quadro de Obreiros deste workspace precisam do mesmo
// usuário/organização/papel/ministério — sem cache por requisição, cada um
// desses arquivos refazia essas consultas do zero, multiplicando as idas ao
// banco (e o tempo até renderizar) a cada navegação dentro do ministério.
export const getWorkspaceClient = cache(createClient)

export const getOrgAndUser = cache(async (slug: string) => {
  const supabase = await getWorkspaceClient()
  const [{ data: { user } }, { data: org }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('organizations').select('id').eq('slug', slug).single(),
  ])
  return { user, orgId: org?.id ?? null }
})

export const getWorkspaceRole = cache(async (userId: string, orgId: string) => {
  const supabase = await getWorkspaceClient()
  return getCurrentOrganizationRole(supabase, userId, orgId)
})

export const getWorkspaceMinistryLink = cache(
  (userId: string, orgId: string, role: string, preview: RolePreview | null, ministryId: string): Promise<MinistryLink | null> =>
    getMinistryLink({ userId, orgId, role, preview }, ministryId)
)

export const getWorkspaceMinistry = cache(async (orgId: string, ministryId: string) => {
  const supabase = await getWorkspaceClient()
  const { data } = await supabase
    .from('ministries')
    .select('id, name, long_name, description, description_translations, active, linked_role, slug, subtitle, subtitle_translations, hero_image_url, is_public')
    .eq('id', ministryId)
    .eq('organization_id', orgId)
    .single()
  return data
})
