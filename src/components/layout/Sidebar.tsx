'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'

type NavItem = { href: string; label: string; icon: string }
type SidebarProps = {
  items: NavItem[]
  subtitle?: string
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ items, subtitle, isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={[
        'fixed inset-y-0 left-0 z-30 w-64 bg-dark-950 flex flex-col border-r border-dark-800',
        'transition-transform duration-200 ease-in-out',
        'md:w-60 md:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}
    >
      <div className="px-5 py-5 border-b border-dark-800 flex items-start justify-between gap-2">
        <div>
          <Image
            src="/images/logo-white.png"
            alt="JOCUM A.T."
            width={110}
            height={38}
            className="object-contain"
            priority
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
          {subtitle && (
            <p className="text-xs text-brand-400 mt-1.5 font-medium">{subtitle}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="md:hidden p-1 text-gray-500 hover:text-white transition-colors"
          aria-label="Fechar menu"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {items.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-brand-500 text-white font-medium'
                  : 'text-gray-400 hover:bg-dark-800 hover:text-white'
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <LogoutButton />
    </aside>
  )
}

function LogoutButton() {
  async function logout() {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="px-3 py-4 border-t border-dark-800">
      <button
        onClick={logout}
        className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-gray-500 hover:bg-dark-800 hover:text-white transition-colors"
      >
        <span className="text-base leading-none">↩</span>
        Sair
      </button>
    </div>
  )
}
