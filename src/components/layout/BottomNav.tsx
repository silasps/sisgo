'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ICON_MAP } from './Sidebar'
import { MoreHorizontal, X } from 'lucide-react'
import { usePlatform, type Platform } from '@/hooks/usePlatform'
import { useAllApps } from './all-apps-context'

export type BottomBarItem = {
  href: string
  label: string
  icon: string
  alert?: boolean
  isMore?: boolean
}

const tabBarExtra: Record<Platform, string> = {
  ios: '',
  android: 'shadow-[0_-1px_3px_rgba(0,0,0,0.08),0_-2px_8px_rgba(0,0,0,0.04)]',
  web: '',
}

const tabActiveStyles: Record<Platform, string> = {
  ios: 'text-brand-500',
  android: 'text-brand-500',
  web: 'text-brand-500',
}

const tabInactiveStyles: Record<Platform, string> = {
  ios: 'text-gray-400',
  android: 'text-gray-500',
  web: 'text-gray-400',
}

const tabPressStyles: Record<Platform, string> = {
  ios: 'active:opacity-60',
  android: 'active:bg-brand-500/8',
  web: 'active:bg-gray-50',
}

export function BottomNav({ items }: { items: BottomBarItem[] }) {
  const pathname = usePathname()
  const platform = usePlatform()
  const { items: allItems, open: allAppsOpen, openAllApps, closeAllApps } = useAllApps()

  // Item tem alerta pendente mas não está entre as abas visíveis? "Mais" herda o aviso.
  const barIcons = new Set(items.filter(i => !i.isMore).map(i => i.icon))
  const hasOverflowAlert = allItems.some(i => !('divider' in i) && !barIcons.has(i.icon) && i.alert)

  const iconSize = platform === 'ios' ? 24 : 22
  const labelClass =
    platform === 'ios'
      ? 'text-[10px] font-medium leading-none tracking-tight'
      : platform === 'android'
        ? 'text-[12px] font-medium leading-none'
        : 'text-[10px] font-medium leading-none'

  return (
    <>
      {/* Tab Bar — fixed overlay so content scrolls behind (glass effect) */}
      {/* Glass/opaque styling comes from .bottom-nav-bar in globals.css via @supports */}
      <nav
        className={`bottom-nav-bar fixed bottom-0 inset-x-0 z-40 md:hidden pb-[env(safe-area-inset-bottom)] ${tabBarExtra[platform]}`}
      >
        <div
          className={`flex items-stretch ${platform === 'android' ? 'h-20' : 'h-16'}`}
        >
          {items.map((item) => {
            if (item.isMore) {
              return (
                <button
                  key="more"
                  onClick={() => (allAppsOpen ? closeAllApps() : openAllApps())}
                  className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${tabPressStyles[platform]} ${
                    allAppsOpen
                      ? tabActiveStyles[platform]
                      : tabInactiveStyles[platform]
                  }`}
                  aria-label={
                    allAppsOpen ? 'Fechar menu' : 'Ver tudo'
                  }
                >
                  <span className="relative">
                    {allAppsOpen ? (
                      <X size={iconSize} aria-hidden />
                    ) : (
                      <MoreHorizontal size={iconSize} aria-hidden />
                    )}
                    {!allAppsOpen && (item.alert || hasOverflowAlert) && (
                      <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    )}
                  </span>
                  <span className={labelClass}>
                    {allAppsOpen ? 'Fechar' : 'Mais'}
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
                className={`flex-1 flex flex-col items-center justify-center transition-colors ${tabPressStyles[platform]} ${
                  active
                    ? tabActiveStyles[platform]
                    : tabInactiveStyles[platform]
                } ${platform === 'ios' ? 'gap-0.5' : 'gap-1'}`}
              >
                <span className="relative">
                  {Icon && (
                    <Icon
                      size={iconSize}
                      strokeWidth={
                        active && platform === 'ios' ? 2.2 : 1.8
                      }
                      aria-hidden
                    />
                  )}
                  {item.alert && !active && (
                    <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  )}
                </span>
                <span className={labelClass}>{item.label}</span>
              </Link>
            )
          })}
        </div>

        {/* Android: ink ripple indicator on active tab */}
        {platform === 'android' && (
          <div className="absolute top-0 left-0 right-0 flex h-[3px]">
            {items.map((item) => {
              const active = item.isMore
                ? allAppsOpen
                : pathname === item.href ||
                  pathname.startsWith(item.href + '/')
              return (
                <div key={item.href ?? 'more'} className="flex-1 flex justify-center">
                  <div
                    className={`h-full rounded-b-full transition-all duration-300 ${
                      active
                        ? 'w-1/2 bg-brand-500'
                        : 'w-0 bg-transparent'
                    }`}
                  />
                </div>
              )
            })}
          </div>
        )}
      </nav>
    </>
  )
}
