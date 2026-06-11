import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const ROLE_PREVIEW_COOKIE = 'sisgo_preview_role'
export const ROLE_PREVIEW_SCHOOL_COOKIE = 'sisgo_preview_school'
export const ROLE_PREVIEW_MINISTRY_COOKIE = 'sisgo_preview_ministry'

export const ROLE_PREVIEW_OPTIONS = [
  { value: 'superadmin', label: 'Super admin' },
  { value: 'lider_base', label: 'Líder da Base' },
  { value: 'dh', label: 'DH' },
  { value: 'secretaria', label: 'Secretaria / Administrativo' },
  { value: 'hospitalidade', label: 'Hospitalidade' },
  { value: 'cozinha', label: 'Cozinha' },
  { value: 'lider_eted', label: 'Líder de Escola' },
  { value: 'obreiro_eted', label: 'Obreiro de Escola' },
  { value: 'aluno', label: 'Aluno' },
  { value: 'associado', label: 'Associado' },
  { value: 'lider_ministerio', label: 'Líder de Ministério' },
  { value: 'obreiro_ministerio', label: 'Obreiro de Ministério' },
] as const

const ROLE_VALUES = new Set(ROLE_PREVIEW_OPTIONS.map(option => option.value))

export type RolePreviewValue = (typeof ROLE_PREVIEW_OPTIONS)[number]['value']

export type RolePreview = {
  role: RolePreviewValue
  schoolId: string | null
  ministryId: string | null
}

function safeRedirectTo(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null
  if (!value.startsWith('/') || value.startsWith('//')) return null
  return value
}

async function currentUserIsSuperAdmin() {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data } = await supabase
    .from('organization_users')
    .select('roles(name)')
    .eq('user_id', user.id)
    .eq('active', true)

  return (data ?? []).some(row => (row.roles as unknown as { name: string } | null)?.name === 'superadmin')
}

export async function getRolePreview(realRole: string): Promise<RolePreview | null> {
  if (realRole !== 'superadmin') return null

  const cookieStore = await cookies()
  const role = cookieStore.get(ROLE_PREVIEW_COOKIE)?.value
  if (!role || !ROLE_VALUES.has(role as RolePreviewValue)) return null

  return {
    role: role as RolePreviewValue,
    schoolId: cookieStore.get(ROLE_PREVIEW_SCHOOL_COOKIE)?.value ?? null,
    ministryId: cookieStore.get(ROLE_PREVIEW_MINISTRY_COOKIE)?.value ?? null,
  }
}

export async function setRolePreview(formData: FormData) {
  'use server'
  if (!await currentUserIsSuperAdmin()) return

  const role = formData.get('role') as string
  const scopeId = (formData.get('scope_id') as string | null) || ''
  const redirectTo = safeRedirectTo(formData.get('redirect_to'))
  const cookieStore = await cookies()

  if (!ROLE_VALUES.has(role as RolePreviewValue)) return
  const schoolId = role === 'lider_eted' || role === 'obreiro_eted' || role === 'aluno' ? scopeId : ''
  const ministryId = role === 'lider_ministerio' || role === 'obreiro_ministerio' ? scopeId : ''

  const options = { path: '/', sameSite: 'lax' as const }
  cookieStore.set(ROLE_PREVIEW_COOKIE, role, options)
  cookieStore.set(ROLE_PREVIEW_SCHOOL_COOKIE, schoolId, options)
  cookieStore.set(ROLE_PREVIEW_MINISTRY_COOKIE, ministryId, options)

  if (redirectTo) redirect(redirectTo)
}

export async function clearRolePreview(formData: FormData) {
  'use server'
  const cookieStore = await cookies()
  const redirectTo = safeRedirectTo(formData.get('redirect_to'))

  if (!await currentUserIsSuperAdmin()) return
  cookieStore.delete(ROLE_PREVIEW_COOKIE)
  cookieStore.delete(ROLE_PREVIEW_SCHOOL_COOKIE)
  cookieStore.delete(ROLE_PREVIEW_MINISTRY_COOKIE)

  if (redirectTo) redirect(redirectTo)
}
