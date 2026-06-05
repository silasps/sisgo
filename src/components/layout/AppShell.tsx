'use client'

import { createContext, useContext, useState } from 'react'
import { Sidebar } from './Sidebar'

type NavItem = { href: string; label: string; icon: string }

const NavCtx = createContext<{ openNav: () => void }>({ openNav: () => {} })
export const useMobileNav = () => useContext(NavCtx)

export function AppShell({
  items,
  subtitle,
  className,
  children,
}: {
  items: NavItem[]
  subtitle?: string
  className?: string
  children: React.ReactNode
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
          isOpen={open}
          onClose={() => setOpen(false)}
        />

        <div className="flex-1 md:ml-60 flex flex-col overflow-auto scroll-smooth min-w-0">
          {children}
        </div>
      </div>
    </NavCtx.Provider>
  )
}
