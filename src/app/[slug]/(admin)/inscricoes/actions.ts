'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { SCHOOL_APPLICATION_TYPES } from '@/lib/schools'

export async function criarPreInscricaoManual(orgId: string, slug: string, formData: FormData) {
  const db = createAdminClient()

  const classIdVal = (formData.get('class_id') as string | null) || null
  let schoolIdVal: string | null = null

  if (classIdVal) {
    const { data: cls } = await db.from('school_classes').select('school_id').eq('id', classIdVal).single()
    schoolIdVal = cls?.school_id ?? null
  }

  // Fallback: usar primeira escola disponível da org
  if (!schoolIdVal) {
    const { data: school } = await db.from('schools')
      .select('id').eq('organization_id', orgId).in('school_type', [...SCHOOL_APPLICATION_TYPES]).limit(1).single()
    schoolIdVal = school?.id ?? null
  }

  if (!schoolIdVal) return

  await db.from('school_interest_forms').insert({
    organization_id: orgId,
    school_id: schoolIdVal,
    class_id: classIdVal,
    full_name: (formData.get('full_name') as string).trim(),
    email: (formData.get('email') as string)?.trim() || null,
    phone: (formData.get('phone') as string)?.trim() || null,
    message: (formData.get('message') as string)?.trim() || null,
    status: 'pendente',
  })

  revalidatePath(`/${slug}/inscricoes`)
  revalidatePath(`/${slug}/pessoas`)
}

// Contagem barata das tabelas que alimentam a lista de inscrições —
// usada pelo polling do cliente pra detectar novos registros (ex.:
// pré-inscrição pública enviada enquanto o admin está com a página
// aberta) sem precisar reconsultar tudo a cada verificação.
export async function checkInscricoesUpdates(orgId: string): Promise<number> {
  const db = createAdminClient()
  const [interest, students, staffInterest, staffApps] = await Promise.all([
    db.from('school_interest_forms').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
    db.from('student_applications').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
    db.from('staff_interest_forms').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
    db.from('staff_applications').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
  ])
  return (interest.count ?? 0) + (students.count ?? 0) + (staffInterest.count ?? 0) + (staffApps.count ?? 0)
}

export async function criarPreInscricaoObreiroManual(orgId: string, slug: string, formData: FormData) {
  const db = createAdminClient()

  const destination = (formData.get('destination') as string) || ''
  const [destType, destId] = destination.includes(':') ? destination.split(':') : [null, null]

  await db.from('staff_interest_forms').insert({
    organization_id: orgId,
    ministry_id: destType === 'ministry' ? destId : null,
    school_id: destType === 'school' ? destId : null,
    full_name: (formData.get('full_name') as string).trim(),
    email: (formData.get('email') as string)?.trim() || '',
    phone: (formData.get('phone') as string)?.trim() || null,
    message: (formData.get('message') as string)?.trim() || null,
    status: 'pendente',
  })

  revalidatePath(`/${slug}/inscricoes`)
  revalidatePath(`/${slug}/pessoas`)
}
