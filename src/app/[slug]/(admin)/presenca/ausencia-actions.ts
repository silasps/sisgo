'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const SPECIAL_MINISTRIES: Record<string, { label: string; roleName: string }> = {
  dh: { label: 'DH', roleName: 'dh' },
  secretaria: { label: 'Secretaria', roleName: 'secretaria' },
  hospitalidade: { label: 'Hospitalidade', roleName: 'hospitalidade' },
  cozinha: { label: 'Cozinha', roleName: 'cozinha' },
}

function normalize(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function isObreiroTitle(value: string | null | undefined) {
  const title = normalize(value)
  return title === 'obreiro' || title === 'voluntário' || title === 'voluntario'
}

async function canDeclareAbsenceFor(db: ReturnType<typeof createAdminClient>, orgId: string, userId: string, targetPersonId: string) {
  const { data: orgUser } = await db
    .from('organization_users')
    .select('roles(name)')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .eq('active', true)
    .maybeSingle()
  const role = (orgUser?.roles as unknown as { name: string } | null)?.name ?? ''
  if (['superadmin', 'admin_base', 'lider_base', 'dh'].includes(role)) return true

  const { data: currentProfile } = await db
    .from('staff_profiles')
    .select('person_id, area, role_title')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .eq('active', true)
    .maybeSingle()

  const currentPersonId = (currentProfile as { person_id: string | null } | null)?.person_id
  if (!currentPersonId) return false
  if (currentPersonId === targetPersonId) return true

  if (role === 'lider_eted') {
    const { data: leaderSchools } = await db
      .from('school_leaders')
      .select('school_id')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
    const schoolIds = (leaderSchools ?? []).map(row => row.school_id)
    if (schoolIds.length === 0) return false
    const { count } = await db
      .from('school_staff')
      .select('*', { count: 'exact', head: true })
      .eq('person_id', targetPersonId)
      .eq('active', true)
      .in('school_id', schoolIds)
    return (count ?? 0) > 0
  }

  if (role === 'lider_ministerio') {
    const { data: leaderMinistries } = await db
      .from('ministry_leaders')
      .select('ministry_id')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
    const ministryIds = (leaderMinistries ?? []).map(row => row.ministry_id)
    if (ministryIds.length === 0) return false
    const { count } = await db
      .from('ministry_members')
      .select('*', { count: 'exact', head: true })
      .eq('person_id', targetPersonId)
      .eq('active', true)
      .in('ministry_id', ministryIds)
    return (count ?? 0) > 0
  }

  const special = Object.values(SPECIAL_MINISTRIES).find(item => item.roleName === role)
  if (special && !isObreiroTitle((currentProfile as { role_title: string | null } | null)?.role_title)) {
    const { data: targetProfile } = await db
      .from('staff_profiles')
      .select('area')
      .eq('organization_id', orgId)
      .eq('person_id', targetPersonId)
      .eq('active', true)
      .maybeSingle()
    return normalize((targetProfile as { area: string | null } | null)?.area) === normalize(special.label)
  }

  return false
}

export async function declareAbsence(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const db = createAdminClient()
  const orgId     = formData.get('org_id')     as string
  const personId  = formData.get('person_id')  as string
  const startDate = formData.get('start_date') as string
  const endDate   = formData.get('end_date')   as string
  const reasonType  = formData.get('reason_type')  as string
  const reasonNotes = formData.get('reason_notes') as string | null

  if (!orgId || !personId || !startDate || !endDate || !reasonType) return
  if (!await canDeclareAbsenceFor(db, orgId, user.id, personId)) return

  await db.from('absence_declarations').insert({
    organization_id: orgId,
    person_id: personId,
    start_date: startDate,
    end_date: endDate,
    reason_type: reasonType,
    reason_notes: reasonNotes || null,
    declared_by: user.id,
  })

  revalidatePath(`/${formData.get('slug')}/presenca`)
}

export async function cancelAbsence(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const db = createAdminClient()
  const id    = formData.get('id')     as string
  const orgId = formData.get('org_id') as string
  const slug  = formData.get('slug')   as string

  if (!id || !orgId) return

  await db.from('absence_declarations').delete()
    .eq('id', id)
    .eq('organization_id', orgId)

  revalidatePath(`/${slug}/presenca`)
}
