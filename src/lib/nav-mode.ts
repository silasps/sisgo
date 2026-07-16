import { cookies } from 'next/headers'

export const NAV_MODE_COOKIE = 'sisgo_nav_mode'

export type NavMode = 'pessoal' | 'administracao'

export async function getNavMode(): Promise<NavMode> {
  const cookieStore = await cookies()
  return cookieStore.get(NAV_MODE_COOKIE)?.value === 'administracao' ? 'administracao' : 'pessoal'
}
