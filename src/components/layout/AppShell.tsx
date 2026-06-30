'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { BottomNav, type BottomBarItem } from './BottomNav'
import { NavCtx } from './nav-context'
export { useMobileNav } from './nav-context'

type NavItem = { href: string; label: string; icon: string; alert?: boolean } | { divider: true; label: string }

export function AppShell({
  items,
  bottomBarItems,
  overflowItems,
  subtitle,
  logoUrl,
  sisgoLogo,
  className,
  children,
  user,
}: {
  items: NavItem[]
  bottomBarItems?: BottomBarItem[]
  overflowItems?: NavItem[]
  subtitle?: string
  logoUrl?: string
  sisgoLogo?: boolean
  className?: string
  children: React.ReactNode
  user?: { name?: string; email: string; badge?: string }
}) {
  const [open, setOpen] = useState(false)

  return (
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
          subtitle={subtitle}
          logoUrl={logoUrl}
          sisgoLogo={sisgoLogo}
          isOpen={open}
          onClose={() => setOpen(false)}
          user={user}
        />

        <div className={`flex-1 md:ml-60 flex flex-col overflow-auto scroll-smooth min-w-0 ${bottomBarItems ? 'pb-20 md:pb-0' : ''}`}>
          {children}
        </div>
      </div>

      {bottomBarItems && overflowItems && (
        <BottomNav items={bottomBarItems} overflowItems={overflowItems} />
      )}
    </NavCtx.Provider>
  )
}
