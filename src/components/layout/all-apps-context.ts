'use client'

import { createContext, useContext } from 'react'

export type NavItem = { href: string; label: string; icon: string; alert?: boolean } | { divider: true; label: string }

export type AllAppsState = {
  items: NavItem[]
  /** Conjunto completo pra busca — inclui o que já está fixo na sidebar
   * (a busca promete achar "tudo", diferente da grade de navegação, que só
   * mostra o complemento pra não duplicar atalho já visível). */
  searchItems: NavItem[]
  open: boolean
  openAllApps: () => void
  closeAllApps: () => void
}

const defaultState: AllAppsState = {
  items: [],
  searchItems: [],
  open: false,
  openAllApps: () => {},
  closeAllApps: () => {},
}

export const AllAppsCtx = createContext<AllAppsState>(defaultState)
export const useAllApps = () => useContext(AllAppsCtx)
