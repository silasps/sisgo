'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { NAV_MODE_COOKIE, type NavMode } from './nav-mode'

function safePath(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return '/'
  if (!value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

export async function setNavMode(formData: FormData) {
  const mode: NavMode = formData.get('mode') === 'administracao' ? 'administracao' : 'pessoal'
  const path = safePath(formData.get('redirect_to'))
  const cookieStore = await cookies()

  cookieStore.set(NAV_MODE_COOKIE, mode, { path: '/', sameSite: 'lax' })
  revalidatePath(path)
}
