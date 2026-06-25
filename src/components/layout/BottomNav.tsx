'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ICON_MAP } from './Sidebar'
import { MoreHorizontal, X } from 'lucide-react'
import { usePlatform, type Platform } from '@/hooks/usePlatform'

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

const tabBarStyles: Record<Platform, string> = {
  ios: [
    'bg-white/72 backdrop-blur-xl',
    'border-t border-black/[0.08]',
    'supports-[backdrop-filter]:bg-white/72',
  ].join(' '),
  android: [
    'bg-white',
    'shadow-[0_-1px_3px_rgba(0,0,0,0.08),0_-2px_8px_rgba(0,0,0,0.04)]',
  ].join(' '),
  web: 'bg-white border-t border-gray-200',
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

export function BottomNav({
  items,
  overflowItems,
}: {
  items: BottomBarItem[]
  overflowItems: NavItem[]
}) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const touchStartY = useRef(0)
  const sheetRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const platform = usePlatform()

  useEffect(() => {
    setSheetOpen(false)
  }, [pathname])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
    setIsDragging(true)
    setDragY(0)
  }, [])

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return
      const deltaY = e.touches[0].clientY - touchStartY.current
      if (deltaY > 0) {
        setDragY(deltaY)
      }
    },
    [isDragging],
  )

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
    if (dragY > 80) {
      setSheetOpen(false)
    }
    setDragY(0)
  }, [dragY])

  const iconSize = platform === 'ios' ? 24 : 22
  const labelClass =
    platform === 'ios'
      ? 'text-[10px] font-medium leading-none tracking-tight'
      : platform === 'android'
        ? 'text-[12px] font-medium leading-none'
        : 'text-[10px] font-medium leading-none'

  return (
    <>
      {/* Overlay */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden transition-opacity duration-300"
          style={{
            opacity: isDragging ? Math.max(0, 1 - dragY / 200) : 1,
          }}
          onClick={() => setSheetOpen(false)}
        />
      )}

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className="fixed inset-x-0 bottom-0 z-30 md:hidden"
        style={{
          transform: sheetOpen
            ? `translateY(${dragY}px)`
            : 'translateY(100%)',
          transition: isDragging ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        <div className="bg-dark-950 rounded-t-2xl shadow-xl max-h-[50vh] flex flex-col pb-[calc(5rem+env(safe-area-inset-bottom))]">
          {/* Drag handle */}
          <div
            className="shrink-0 bg-dark-950 rounded-t-2xl pt-3 pb-3 cursor-grab active:cursor-grabbing touch-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="w-10 h-1.5 bg-dark-700 rounded-full mx-auto" />
          </div>

          <nav className="px-3 pb-2 space-y-0.5 overflow-y-auto flex-1">
            {overflowItems.map((item, idx) => {
              if ('divider' in item) {
                return (
                  <div key={`div-${idx}`} className="pt-2 pb-1 mx-1">
                    <div className="border-t border-dark-800 mb-2" />
                    <span className="px-2 text-[10px] font-semibold uppercase tracking-widest text-gray-600 select-none">
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
                      ? 'bg-brand-500 text-white font-medium'
                      : 'text-gray-400 hover:bg-brand-500/10 hover:text-white active:bg-brand-500/10'
                  }`}
                >
                  {item.alert && !active && (
                    <span className="absolute inset-0 rounded-xl bg-red-500/30 animate-pulse" />
                  )}
                  {Icon && (
                    <Icon
                      size={20}
                      className="relative shrink-0"
                      aria-hidden
                    />
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

      {/* Tab Bar — fixed overlay so content scrolls behind (glass effect) */}
      <nav
        className={`fixed bottom-0 inset-x-0 z-40 md:hidden pb-[env(safe-area-inset-bottom)] ${tabBarStyles[platform]}`}
      >
        <div
          className={`flex items-stretch ${platform === 'android' ? 'h-20' : 'h-16'}`}
        >
          {items.map((item) => {
            if (item.isMore) {
              return (
                <button
                  key="more"
                  onClick={() => setSheetOpen((prev) => !prev)}
                  className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${tabPressStyles[platform]} ${
                    sheetOpen
                      ? tabActiveStyles[platform]
                      : tabInactiveStyles[platform]
                  }`}
                  aria-label={
                    sheetOpen ? 'Fechar menu' : 'Abrir menu completo'
                  }
                >
                  <span className="relative">
                    {sheetOpen ? (
                      <X size={iconSize} aria-hidden />
                    ) : (
                      <MoreHorizontal size={iconSize} aria-hidden />
                    )}
                    {!sheetOpen && item.alert && (
                      <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    )}
                  </span>
                  <span className={labelClass}>
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
                ? sheetOpen
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
