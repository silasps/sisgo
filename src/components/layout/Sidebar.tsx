'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, AlertTriangle, Users, Church, GraduationCap,
  ClipboardList, Music2, BedDouble, UtensilsCrossed, Landmark,
  ChefHat, Package, Boxes, DollarSign, Receipt, Settings, LogOut,
  UserCheck, CalendarDays, Wrench, Building2, Eye, Code2, Inbox, CookingPot,
  Hotel, DoorOpen, WashingMachine, Shirt, IdCard, Megaphone,
  ChevronsLeft, ChevronsRight, Search,
  type LucideIcon,
} from 'lucide-react'
import { useAllApps } from './all-apps-context'

type NavItem = { href: string; label: string; icon: string; alert?: boolean } | { divider: true; label: string }
type SidebarProps = {
  items: NavItem[]
  isOpen?: boolean
  onClose?: () => void
  user?: { name?: string; email: string; badge?: string }
  collapsed?: boolean
  onToggleCollapsed?: () => void
}

export const ICON_MAP: Record<string, LucideIcon> = {
  dashboard:      Home,
  calendario:     CalendarDays,
  pendentes:      AlertTriangle,
  comunicacao:    Megaphone,
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
  'minha-lavanderia': Shirt,
  refeicoes:      UtensilsCrossed,
  caixa:          Landmark,
  cozinha:        ChefHat,
  estoque:        Package,
  'estoque-manutencao': Boxes,
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

function NavIcon({ name, className, size = 16 }: { name: string; className?: string; size?: number }) {
  const Icon = ICON_MAP[name]
  if (!Icon) return null
  return <Icon size={size} className={className} aria-hidden />
}

export function Sidebar({ items, isOpen = false, onClose, user, collapsed = false, onToggleCollapsed }: SidebarProps) {
  const pathname = usePathname()
  const [hovering, setHovering] = useState(false)
  const { items: allAppsItems, openAllApps } = useAllApps()

  // `collapsed` é a preferência fixada (persistida) pelo usuário. Em telas
  // grandes, passar o mouse por cima expande temporariamente por cima do
  // conteúdo (overlay — não empurra o layout, que continua calculado a
  // partir de `collapsed`) só pra dar uma espiada nos rótulos; ao tirar o
  // mouse, volta a recolher — a menos que o usuário tenha fixado aberto.
  const expanded = !collapsed || hovering

  return (
    <aside
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={[
        'fixed inset-y-0 z-30 w-64 bg-dark-950 flex flex-col',
        'right-0 border-l border-dark-800',
        'md:left-0 md:right-auto md:border-l-0 md:border-r md:border-dark-800',
        'transition-[transform,width] duration-200 ease-in-out',
        expanded ? 'md:w-60' : 'md:w-16',
        collapsed && hovering ? 'md:shadow-2xl md:shadow-black/50' : '',
        'md:translate-x-0',
        isOpen ? 'translate-x-0' : 'translate-x-full',
      ].join(' ')}
    >
      <div className="flex items-center border-b border-dark-800 shrink-0">
        <button
          onClick={onToggleCollapsed}
          className="hidden md:flex flex-1 items-center justify-center py-4 text-gray-500 hover:text-white transition-colors"
          aria-label={collapsed ? 'Fixar menu aberto' : 'Recolher menu'}
          title={collapsed ? 'Fixar menu aberto' : 'Recolher menu'}
        >
          {collapsed ? <ChevronsRight size={18} aria-hidden /> : <ChevronsLeft size={18} aria-hidden />}
        </button>
        <button
          onClick={onClose}
          className="md:hidden ml-auto p-4 text-gray-500 hover:text-white transition-colors flex-shrink-0"
          aria-label="Fechar menu"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {allAppsItems.length > 0 && (
        <div className="px-3 pt-3 shrink-0">
          <button
            onClick={openAllApps}
            title={!expanded ? 'Pesquisar' : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-gray-400 bg-dark-800/50 hover:bg-dark-800 hover:text-white transition-colors ${
              !expanded ? 'md:justify-center md:px-0' : ''
            }`}
          >
            <Search size={18} aria-hidden className="shrink-0" />
            <span className={!expanded ? 'md:hidden' : ''}>Pesquisar menus…</span>
          </button>
        </div>
      )}

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {items.map((item, idx) => {
          if ('divider' in item) {
            return (
              <div key={`div-${idx}`} className="pt-3 pb-1 mx-1">
                <div className="border-t border-dark-800 mb-2" />
                {expanded && (
                  <span className="px-2 text-[10px] font-semibold uppercase tracking-widest text-gray-600 select-none">
                    {item.label}
                  </span>
                )}
              </div>
            )
          }
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              title={!expanded ? item.label : undefined}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                !expanded ? 'md:justify-center md:px-0' : ''
              } ${
                active
                  ? 'bg-brand-500 text-white font-medium'
                  : 'text-gray-400 hover:bg-brand-500/10 hover:text-white'
              }`}
            >
              {item.alert && !active && (
                <span className="absolute inset-0 rounded-lg bg-red-500/30 animate-pulse" />
              )}
              <NavIcon name={item.icon} className="relative shrink-0" size={20} />
              <span className={`relative ${!expanded ? 'md:hidden' : ''}`}>{item.label}</span>
              {item.alert && !active && (
                <span className={`relative ml-auto w-2 h-2 rounded-full bg-red-500 animate-pulse ${!expanded ? 'md:hidden' : ''}`} />
              )}
            </Link>
          )
        })}
      </nav>

      {user && (
        <div className="px-3 pt-3 pb-1 border-t border-dark-800">
          <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg bg-dark-800/50 ${!expanded ? 'md:justify-center md:px-0' : ''}`}>
            <div className="w-7 h-7 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 text-xs font-bold flex-shrink-0 uppercase">
              {(user.name ?? user.email).charAt(0)}
            </div>
            <div className={`min-w-0 flex-1 ${!expanded ? 'md:hidden' : ''}`}>
              {user.name && <p className="text-xs font-medium text-gray-200 truncate">{user.name}</p>}
              <p className="text-[11px] text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
          {user.badge && expanded && (
            <p className="mt-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-brand-400">{user.badge}</p>
          )}
        </div>
      )}
      {user && <LogoutButton expanded={expanded} />}
    </aside>
  )
}

function LogoutButton({ expanded }: { expanded?: boolean }) {
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
        title={!expanded ? 'Sair' : undefined}
        className={`flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-gray-500 hover:bg-dark-800 hover:text-white transition-colors ${!expanded ? 'md:justify-center md:px-0' : ''}`}
      >
        <LogOut size={16} aria-hidden className="shrink-0" />
        <span className={!expanded ? 'md:hidden' : ''}>Sair</span>
      </button>
    </div>
  )
}
