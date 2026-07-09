'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import {
  LayoutDashboard, AlertTriangle, Users, Church, GraduationCap,
  ClipboardList, Music2, BedDouble, UtensilsCrossed, Landmark,
  ChefHat, Package, DollarSign, Receipt, Settings, LogOut,
  UserCheck, CalendarDays, Wrench, Building2, Eye, Code2, Inbox, CookingPot,
  Hotel, DoorOpen, WashingMachine, IdCard,
  type LucideIcon,
} from 'lucide-react'
import { SisgoLogo } from './Logo'

type NavItem = { href: string; label: string; icon: string; alert?: boolean } | { divider: true; label: string }
type SidebarProps = {
  items: NavItem[]
  subtitle?: string
  logoUrl?: string
  sisgoLogo?: boolean
  isOpen?: boolean
  onClose?: () => void
  user?: { name?: string; email: string; badge?: string }
}

export const ICON_MAP: Record<string, LucideIcon> = {
  dashboard:      LayoutDashboard,
  calendario:     CalendarDays,
  pendentes:      AlertTriangle,
  pessoas:        Users,
  presenca:       UserCheck,
  obreiros:       Church,
  escolas:        GraduationCap,
  inscricoes:     ClipboardList,
  ministerios:    Music2,
  reservas:       BedDouble,
  hospedagem:     Hotel,
  quartos:        DoorOpen,
  agenda:         CalendarDays,
  lavanderia:     WashingMachine,
  'minha-lavanderia': WashingMachine,
  refeicoes:      UtensilsCrossed,
  caixa:          Landmark,
  cozinha:        ChefHat,
  estoque:        Package,
  receitas:       CookingPot,
  manutencao:     Wrench,
  solicitacoes:   Inbox,
  financeiro:     DollarSign,
  contas:         Receipt,
  carteirinha:    IdCard,
  configuracoes:  Settings,
  bases:          Building2,
  supervisao:     Eye,
  dev:            Code2,
}

function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name]
  if (!Icon) return null
  return <Icon size={16} className={className} aria-hidden />
}

export function Sidebar({ items, subtitle, logoUrl, sisgoLogo = false, isOpen = false, onClose, user }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={[
        'fixed inset-y-0 z-30 w-64 bg-dark-950 flex flex-col',
        'right-0 border-l border-dark-800',
        'md:left-0 md:right-auto md:border-l-0 md:border-r md:border-dark-800',
        'transition-transform duration-200 ease-in-out',
        'md:w-60 md:translate-x-0',
        isOpen ? 'translate-x-0' : 'translate-x-full',
      ].join(' ')}
    >
      <div className="px-5 py-5 border-b border-dark-800 flex items-start justify-between gap-2 flex-row-reverse md:flex-row">
        <div className="flex-1 min-w-0">
          {sisgoLogo && !logoUrl ? (
            <SisgoLogo size={34} />
          ) : (
            <Image
              src={logoUrl ?? '/images/logo-white.png'}
              alt={subtitle ?? 'Logo'}
              width={110}
              height={38}
              className="object-contain"
              priority
              unoptimized={!!logoUrl}
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          )}
          {subtitle && (
            <p className="text-xs text-brand-400 mt-1.5 font-medium">{subtitle}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="md:hidden p-1 text-gray-500 hover:text-white transition-colors flex-shrink-0"
          aria-label="Fechar menu"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {items.map((item, idx) => {
          if ('divider' in item) {
            return (
              <div key={`div-${idx}`} className="pt-3 pb-1 mx-1">
                <div className="border-t border-dark-800 mb-2" />
                <span className="px-2 text-[10px] font-semibold uppercase tracking-widest text-gray-600 select-none">
                  {item.label}
                </span>
              </div>
            )
          }
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-brand-500 text-white font-medium'
                  : 'text-gray-400 hover:bg-brand-500/10 hover:text-white'
              }`}
            >
              {item.alert && !active && (
                <span className="absolute inset-0 rounded-lg bg-red-500/30 animate-pulse" />
              )}
              <NavIcon name={item.icon} className="relative shrink-0" />
              <span className="relative">{item.label}</span>
              {item.alert && !active && (
                <span className="relative ml-auto w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
            </Link>
          )
        })}
      </nav>

      {user && (
        <div className="px-3 pt-3 pb-1 border-t border-dark-800">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-dark-800/50">
            <div className="w-7 h-7 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 text-xs font-bold flex-shrink-0 uppercase">
              {(user.name ?? user.email).charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              {user.name && <p className="text-xs font-medium text-gray-200 truncate">{user.name}</p>}
              <p className="text-[11px] text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
          {user.badge && (
            <p className="mt-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-brand-400">{user.badge}</p>
          )}
        </div>
      )}
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
        <LogOut size={16} aria-hidden />
        Sair
      </button>
    </div>
  )
}
