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
