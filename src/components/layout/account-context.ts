'use client'

import { createContext, useContext } from 'react'
import type { NavMode } from '@/lib/nav-mode'

export type AccountInfo = {
  name: string | null
  email: string
  avatarUrl: string | null
  orgSlug: string
  orgName: string
  orgs: Array<{ slug: string; name: string }>
  canSwitchMode: boolean
  mode: NavMode
}

export const AccountCtx = createContext<AccountInfo | null>(null)
export const useAccount = () => useContext(AccountCtx)

export type BrandInfo = { logoUrl?: string; sisgoLogo?: boolean; subtitle?: string; collapsed?: boolean }
export const BrandCtx = createContext<BrandInfo>({})
export const useBrand = () => useContext(BrandCtx)

/** Classe de offset (`md:left-*`) que acompanha a largura atual da sidebar
 * (recolhida = `md:w-16`, expandida = `md:w-60`), para overlays de modal que
 * não devem cobrir a sidebar. Usar no lugar de um `md:left-60` fixo, que fica
 * com um vão sem escurecer quando a sidebar está recolhida. */
export const useSidebarOffsetClass = () => (useBrand().collapsed ? 'md:left-16' : 'md:left-60')
