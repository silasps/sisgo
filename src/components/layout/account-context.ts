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

// Overlays fixos (modais) usam isso pra não cobrir a sidebar — precisa
// bater com a largura real dela (md:w-16 recolhida / md:w-60 expandida em
// Sidebar.tsx), senão sobra uma faixa do conteúdo sem o overlay por cima.
export function useSidebarLeftClass() {
  const { collapsed } = useBrand()
  return collapsed ? 'md:left-16' : 'md:left-60'
}
