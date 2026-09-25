'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

// Compartilhado entre /comunicacao (form de gestão) e /anuncios (histórico
// aberto a qualquer usuário da org) — por isso checa permissão aqui dentro
// em vez de confiar num `canManageAnnouncements` calculado na página que
// chamou; quem chama só decide se MOSTRA o botão, nunca se a exclusão é
// permitida de verdade.
async function assertCanManageAnnouncements(orgId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { role, linkedRoles } = await getCurrentOrganizationRole(supabase, user.id, orgId)
  if (role !== 'superadmin' && role !== 'lider_base' && !linkedRoles.includes('comunicacao')) {
    throw new Error('Sem permissão para gerenciar anúncios.')
  }
}

// Mesma validação de role-preview.ts (safeRedirectTo) — `redirect_to` vem de
// um input escondido no form, então é tecnicamente editável via devtools;
// sem essa checagem, um valor tipo "https://evil.com" viraria redirect
// externo de verdade.
function safeRedirectTo(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null
  if (!value.startsWith('/') || value.startsWith('//')) return null
  return value
}

export async function deleteAnnouncement(formData: FormData) {
  const id = formData.get('announcement_id') as string
  const orgId = formData.get('organization_id') as string
  const redirectTo = safeRedirectTo(formData.get('redirect_to'))
  const path = formData.get('revalidate_path') as string | null
  if (!id || !orgId) return
  await assertCanManageAnnouncements(orgId)

  const db = createAdminClient()
  await db.from('base_announcements').delete().eq('organization_id', orgId).eq('id', id)
  if (path) revalidatePath(path)
  if (redirectTo) redirect(redirectTo)
}
