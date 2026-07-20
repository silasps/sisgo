'use client'

import { useEffect, useMemo, useState } from 'react'
import { Sidebar } from './Sidebar'
import { BottomNav, type BottomBarItem } from './BottomNav'
import { NavCtx } from './nav-context'
import { AccountCtx, BrandCtx, type AccountInfo } from './account-context'
import { AllAppsCtx } from './all-apps-context'
import { AllAppsPanel } from './AllAppsMenu'

const SIDEBAR_COLLAPSED_KEY = 'sisgo_sidebar_collapsed'
export { useMobileNav } from './nav-context'

type NavItem = { href: string; label: string; icon: string; alert?: boolean } | { divider: true; label: string }

export function AppShell({
  items,
  bottomBarItems,
  subtitle,
  logoUrl,
  sisgoLogo,
  className,
  children,
  user,
  account,
  allNavItems,
}: {
  items: NavItem[]
  bottomBarItems?: BottomBarItem[]
  subtitle?: string
  logoUrl?: string
  sisgoLogo?: boolean
  className?: string
  children: React.ReactNode
  user?: { name?: string; email: string; badge?: string }
  account?: AccountInfo
  allNavItems?: NavItem[]
}) {
  const [open, setOpen] = useState(false)
  const [allAppsOpen, setAllAppsOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    if (stored !== null) setCollapsed(stored === '1')
  }, [])

  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
      return next
    })
  }

  const allAppsValue = useMemo(() => ({
    items: allNavItems ?? [],
    open: allAppsOpen,
    openAllApps: () => setAllAppsOpen(true),
    closeAllApps: () => setAllAppsOpen(false),
  }), [allNavItems, allAppsOpen])

  return (
    <AccountCtx.Provider value={account ?? null}>
      <BrandCtx.Provider value={{ logoUrl, sisgoLogo, subtitle, collapsed }}>
        <AllAppsCtx.Provider value={allAppsValue}>
          <NavCtx.Provider value={{ openNav: () => setOpen(true) }}>
            <div className={className ?? 'flex h-dvh overflow-hidden'}>
              {open && (
                <div
                  className="fixed inset-0 z-20 bg-black/50 md:hidden"
                  onClick={() => setOpen(false)}
                />
              )}

              <Sidebar
                items={items}
                isOpen={open}
                onClose={() => setOpen(false)}
                user={user}
                collapsed={collapsed}
                onToggleCollapsed={toggleCollapsed}
              />

              <div className={`flex-1 flex flex-col overflow-auto scroll-smooth min-w-0 ${collapsed ? 'md:ml-16' : 'md:ml-60'} ${bottomBarItems ? 'pb-20 md:pb-0' : ''}`}>
                {children}
              </div>
            </div>

            {bottomBarItems && <BottomNav items={bottomBarItems} />}
            <AllAppsPanel />
          </NavCtx.Provider>
        </AllAppsCtx.Provider>
      </BrandCtx.Provider>
    </AccountCtx.Provider>
  )
}
