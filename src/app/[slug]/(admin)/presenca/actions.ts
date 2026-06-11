'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function checkIn(formData: FormData) {
  const db = createAdminClient()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const personId = formData.get('person_id') as string
  const orgId    = formData.get('org_id') as string
  if (!personId || !orgId || !user) return

  await db.from('person_presence').insert({
    organization_id: orgId,
    person_id: personId,
    checked_in_by: user.id,
  })

  revalidatePath(`/${formData.get('slug')}/presenca`)
  revalidatePath(`/${formData.get('slug')}/dashboard`)
}

export async function checkOut(formData: FormData) {
  const db = createAdminClient()

  const presenceId = formData.get('presence_id') as string
  if (!presenceId) return

  await db.from('person_presence')
    .update({ checked_out_at: new Date().toISOString() })
    .eq('id', presenceId)

  revalidatePath(`/${formData.get('slug')}/presenca`)
  revalidatePath(`/${formData.get('slug')}/dashboard`)
}
