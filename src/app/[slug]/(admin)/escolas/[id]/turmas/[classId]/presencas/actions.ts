'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveAttendance(formData: FormData) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return

  const db = createAdminClient()
  const classId = formData.get('class_id') as string
  const date = formData.get('date') as string
  const slug = formData.get('slug') as string
  const schoolId = formData.get('school_id') as string

  const personIds = formData.getAll('person_ids[]') as string[]
  const presentIds = new Set(formData.getAll('present[]') as string[])

  if (!classId || !date || !personIds.length) return

  const rows = personIds.map(personId => ({
    class_id: classId,
    person_id: personId,
    date,
    present: presentIds.has(personId),
    recorded_by: user.id,
  }))

  await db.from('class_attendance').upsert(rows, { onConflict: 'class_id,person_id,date' })

  revalidatePath(`/${slug}/escolas/${schoolId}/turmas/${classId}/presencas`)
}
