'use client'

import { createContext, useContext } from 'react'

export type NavItem = { href: string; label: string; icon: string; alert?: boolean } | { divider: true; label: string }

export type AllAppsState = {
  items: NavItem[]
  open: boolean
  openAllApps: () => void
  closeAllApps: () => void
}

const defaultState: AllAppsState = {
  items: [],
  open: false,
  openAllApps: () => {},
  closeAllApps: () => {},
}

export const AllAppsCtx = createContext<AllAppsState>(defaultState)
export const useAllApps = () => useContext(AllAppsCtx)
