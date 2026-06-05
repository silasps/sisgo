'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function createProgramForClass(formData: FormData) {
  const orgId = formData.get('org_id') as string
  const slug = formData.get('slug') as string
  if (!orgId) return

  const sb = createAdminClient()

  const base = {
    organization_id: orgId,
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || null,
    icon: (formData.get('icon') as string) || null,
    additional_cost: formData.get('additional_cost') ? Number(formData.get('additional_cost')) : null,
  }

  const imageUrl = (formData.get('image_url') as string) || null
  const { error } = await sb.from('school_programs').insert({ ...base, image_url: imageUrl })
  if (error) {
    await sb.from('school_programs').insert(base)
  }

  revalidatePath(`/${slug}/escolas`, 'layout')
}
