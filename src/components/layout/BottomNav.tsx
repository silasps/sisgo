'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ICON_MAP } from './Sidebar'
import { MoreHorizontal, X } from 'lucide-react'

export type BottomBarItem = {
  href: string
  label: string
  icon: string
  alert?: boolean
  isMore?: boolean
}

type NavItem =
  | { href: string; label: string; icon: string; alert?: boolean }
  | { divider: true; label: string }

export function BottomNav({
  items,
  overflowItems,
}: {
  items: BottomBarItem[]
  overflowItems: NavItem[]
}) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setSheetOpen(false)
  }, [pathname])

  return (
    <>
      {/* Overlay */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setSheetOpen(false)}
        />
      )}

      {/* Bottom Sheet */}
      <div
        className={`fixed inset-x-0 bottom-0 z-30 md:hidden transition-transform duration-300 ease-out ${
          sheetOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="bg-white rounded-t-2xl shadow-xl max-h-[50vh] overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom))]">
          <div className="sticky top-0 bg-white rounded-t-2xl pt-3 pb-2">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto" />
          </div>

          <nav className="px-3 pb-2 space-y-0.5">
            {overflowItems.map((item, idx) => {
              if ('divider' in item) {
                return (
                  <div key={`div-${idx}`} className="pt-2 pb-1 mx-1">
                    <div className="border-t border-gray-200 mb-2" />
                    <span className="px-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400 select-none">
                      {item.label}
                    </span>
                  </div>
                )
              }
              const active =
                pathname === item.href ||
                pathname.startsWith(item.href + '/')
              const Icon = ICON_MAP[item.icon]
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-3 px-4 py-3.5 rounded-xl text-base transition-colors ${
                    active
                      ? 'bg-brand-50 text-brand-600 font-medium'
                      : 'text-gray-700 active:bg-gray-100'
                  }`}
                >
                  {item.alert && !active && (
                    <span className="absolute inset-0 rounded-xl bg-red-500/10" />
                  )}
                  {Icon && (
                    <Icon size={20} className="relative shrink-0" aria-hidden />
                  )}
                  <span className="relative">{item.label}</span>
                  {item.alert && !active && (
                    <span className="relative ml-auto w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  )}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Tab Bar */}
      <nav className="relative shrink-0 z-40 bg-white border-t border-gray-200 md:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="flex h-16 items-stretch">
          {items.map((item) => {
            if (item.isMore) {
              return (
                <button
                  key="more"
                  onClick={() => setSheetOpen((prev) => !prev)}
                  className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors active:bg-gray-50 ${
                    sheetOpen ? 'text-brand-500' : 'text-gray-400'
                  }`}
                  aria-label={
                    sheetOpen ? 'Fechar menu' : 'Abrir menu completo'
                  }
                >
                  <span className="relative">
                    {sheetOpen ? (
                      <X size={22} aria-hidden />
                    ) : (
                      <MoreHorizontal size={22} aria-hidden />
                    )}
                    {!sheetOpen && item.alert && (
                      <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    )}
                  </span>
                  <span className="text-[10px] font-medium leading-none">
                    {sheetOpen ? 'Fechar' : 'Mais'}
                  </span>
                </button>
              )
            }

            const Icon = ICON_MAP[item.icon]
            const active =
              pathname === item.href ||
              pathname.startsWith(item.href + '/')

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors active:bg-gray-50 ${
                  active ? 'text-brand-500' : 'text-gray-400'
                }`}
              >
                <span className="relative">
                  {Icon && <Icon size={22} aria-hidden />}
                  {item.alert && !active && (
                    <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  )}
                </span>
                <span className="text-[10px] font-medium leading-none">
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
