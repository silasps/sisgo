import { cookies } from 'next/headers'

export const NAV_MODE_COOKIE = 'sisgo_nav_mode'

export type NavMode = 'pessoal' | 'administracao'

export async function getNavMode(defaultMode: NavMode = 'pessoal'): Promise<NavMode> {
  const cookieStore = await cookies()
  const stored = cookieStore.get(NAV_MODE_COOKIE)?.value
  if (stored === 'administracao' || stored === 'pessoal') return stored
  return defaultMode
}
