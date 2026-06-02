'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'

type NavItem = { href: string; label: string; icon: string }
type SidebarProps = { items: NavItem[]; subtitle?: string }

export function Sidebar({ items, subtitle }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-dark-950 flex flex-col border-r border-dark-800">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-dark-800">
        <div className="flex items-center gap-3">
          <Image
            src="/images/logo-white.png"
            alt="JOCUM A.T."
            width={110}
            height={38}
            className="object-contain"
            priority
            onError={(e) => {
              // fallback caso a logo não esteja no public ainda
              e.currentTarget.style.display = 'none'
            }}
          />
        </div>
        {subtitle && (
          <p className="text-xs text-brand-400 mt-1.5 font-medium">{subtitle}</p>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {items.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
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
        className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-gray-500 hover:bg-dark-800 hover:text-white transition-colors"
      >
        <span className="text-base leading-none">↩</span>
        Sair
      </button>
    </div>
  )
}
