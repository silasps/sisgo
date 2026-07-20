'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, ArrowLeftRight, Loader2, LogOut, User, Briefcase, Settings } from 'lucide-react'
import { useAccount, type AccountInfo } from './account-context'
import { setNavMode } from '@/lib/nav-mode-actions'

export function AccountMenu() {
  const account = useAccount()
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => setOpen(false), [pathname])

  if (!account) return null

  const initial = (account.name ?? account.email).charAt(0).toUpperCase()

  async function logout() {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative w-8 h-8 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 text-xs font-bold uppercase shrink-0 hover:bg-brand-100 transition-colors overflow-hidden"
        aria-label={`Minha conta — modo ${account.mode === 'administracao' ? 'Administração' : 'Pessoal'}`}
      >
        {account.avatarUrl
          ? <img src={account.avatarUrl} alt="" className="w-full h-full object-cover" />
          : initial}
        {account.canSwitchMode && (
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${
              account.mode === 'administracao' ? 'bg-brand-500' : 'bg-gray-400'
            }`}
          >
            {account.mode === 'administracao'
              ? <Briefcase size={9} className="text-white" strokeWidth={2.5} />
              : <User size={9} className="text-white" strokeWidth={2.5} />}
          </span>
        )}
      </button>

      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[90] bg-black/30" onClick={() => setOpen(false)} />

          {/* Desktop: popover */}
          <div className="hidden md:block fixed right-4 md:right-6 top-16 z-[100] w-72 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
            <PanelContent account={account} pathname={pathname} onLogout={logout} onModeSwitched={() => setOpen(false)} />
          </div>

          {/* Mobile: bottom sheet */}
          <div className="md:hidden fixed inset-x-0 bottom-0 z-[100]">
            <div className="bg-white rounded-t-2xl shadow-xl max-h-[70vh] overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <div className="pt-3 pb-1 flex justify-center">
                <div className="w-10 h-1.5 bg-gray-200 rounded-full" />
              </div>
              <PanelContent account={account} pathname={pathname} onLogout={logout} onModeSwitched={() => setOpen(false)} />
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  )
}

function PanelContent({
  account,
  pathname,
  onLogout,
  onModeSwitched,
}: {
  account: AccountInfo
  pathname: string
  onLogout: () => void
  onModeSwitched: () => void
}) {
  return (
    <div className="p-2">
      <div className="flex items-center gap-3 px-3 py-3">
        <div className="w-10 h-10 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 text-sm font-bold uppercase shrink-0 overflow-hidden">
          {account.avatarUrl
            ? <img src={account.avatarUrl} alt="" className="w-full h-full object-cover" />
            : (account.name ?? account.email).charAt(0)}
        </div>
        <div className="min-w-0">
          {account.name && <p className="text-sm font-semibold text-gray-900 truncate">{account.name}</p>}
          <p className="text-xs text-gray-500 truncate">{account.email}</p>
        </div>
      </div>

      <div className="px-3 pb-2">
        <Link
          href={`/${account.orgSlug}/conta`}
          className="flex items-center gap-2 px-3 py-2 -mx-3 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Settings size={15} className="shrink-0" />
          Configurações da conta
        </Link>
      </div>

      {account.canSwitchMode && (
        <div className="px-3 pb-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              account.mode === 'administracao'
                ? 'bg-brand-50 text-brand-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {account.mode === 'administracao' ? <Briefcase size={12} /> : <User size={12} />}
            Você está em: {account.mode === 'administracao' ? 'Administração' : 'Pessoal'}
          </span>
        </div>
      )}

      {account.orgs.length > 1 && (
        <div className="border-t border-gray-100 pt-1 mt-1">
          <p className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            Trocar de base
          </p>
          {account.orgs.map(org => (
            <Link
              key={org.slug}
              href={`/${org.slug}/dashboard`}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                org.slug === account.orgSlug
                  ? 'text-brand-600 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Building2 size={15} className="shrink-0" />
              <span className="truncate">{org.name}</span>
            </Link>
          ))}
        </div>
      )}

      {account.canSwitchMode && (
        <div className="border-t border-gray-100 pt-1 mt-1">
          <form action={setNavMode}>
            <input type="hidden" name="redirect_to" value={pathname} />
            <input
              type="hidden"
              name="mode"
              value={account.mode === 'administracao' ? 'pessoal' : 'administracao'}
            />
            <ModeToggleButton mode={account.mode} onSettled={onModeSwitched} />
          </form>
        </div>
      )}

      <div className="border-t border-gray-100 pt-1 mt-1">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut size={15} className="shrink-0" />
          Sair
        </button>
      </div>
    </div>
  )
}

function ModeToggleButton({ mode, onSettled }: { mode: AccountInfo['mode']; onSettled: () => void }) {
  const { pending } = useFormStatus()
  const wasPending = useRef(false)

  useEffect(() => {
    if (wasPending.current && !pending) onSettled()
    wasPending.current = pending
  }, [pending, onSettled])

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-wait"
    >
      {pending
        ? <Loader2 size={15} className="shrink-0 animate-spin" />
        : <ArrowLeftRight size={15} className="shrink-0" />}
      {pending
        ? 'Alternando...'
        : (mode === 'administracao' ? 'Alternar para Pessoal' : 'Alternar para Administração')}
    </button>
  )
}
