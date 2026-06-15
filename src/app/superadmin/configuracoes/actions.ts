'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { ACCENT_COLORS } from '@/lib/accent-colors'
import { revalidatePath } from 'next/cache'

export async function updateSuperAdminAccentColor(colorKey: string) {
  if (!(colorKey in ACCENT_COLORS)) return
  const db = createAdminClient()
  await db.from('system_settings').upsert({ key: 'superadmin_accent_color', value: colorKey })
  revalidatePath('/superadmin')
}

export async function updateSuperAdminLogoUrl(logoUrl: string) {
  const db = createAdminClient()
  await db.from('system_settings').upsert({ key: 'superadmin_logo_url', value: logoUrl })
  revalidatePath('/superadmin')
}
