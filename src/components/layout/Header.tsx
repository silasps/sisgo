'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AccountMenu } from './AccountMenu'
import { AllAppsMenu } from './AllAppsMenu'
import { SisgoLogo } from './Logo'
import { useBrand } from './account-context'

type HeaderProps = {
  title: string
  backHref?: string
  actions?: React.ReactNode
}

export function Header({ title, backHref, actions }: HeaderProps) {
  const { logoUrl, sisgoLogo, collapsed } = useBrand()

  return (
    <header className="h-16 shrink-0 border-b border-dark-800 bg-dark-950 flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex shrink-0 items-center h-8">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo tem proporção variável por organização; largura livre preserva o aspecto
            <img src={logoUrl} alt="Logo" className="h-full w-auto max-w-[140px] object-contain" />
          ) : sisgoLogo ? (
            <SisgoLogo size={26} />
          ) : (
            // Marca padrão do sisgo. No mobile é sempre o ícone compacto (o
            // espaço ali é do título da página, igual Instagram/Slack/Notion
            // no topo mobile). No desktop (md+), troca pra wordmark quando a
            // sidebar colapsa e sobra espaço no header.
            <>
              <img
                src="/images/logo-at-icon-white.png"
                alt="JOCUM Almirante Tamandaré"
                className={`h-full w-8 object-contain ${collapsed ? 'md:hidden' : ''}`}
              />
              <img
                src="/images/logo-at-full-white.png"
                alt="JOCUM Almirante Tamandaré"
                className={`hidden h-full w-auto object-contain ${collapsed ? 'md:block' : ''}`}
              />
            </>
          )}
        </span>
        {backHref && (
          <Link
            href={backHref}
            className="p-1.5 -ml-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            aria-label="Voltar"
          >
            <ArrowLeft className="size-5" />
          </Link>
        )}
        <h1 className="text-lg font-semibold text-white truncate">{title}</h1>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
        {actions}
        <AllAppsMenu />
        <AccountMenu />
      </div>
    </header>
  )
}

export function BtnPrimary({
  children,
  onClick,
  type = 'button',
  disabled,
}: {
  children: React.ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60 whitespace-nowrap"
    >
      {children}
    </button>
  )
}

export function BtnSecondary({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
    >
      {children}
    </button>
  )
}
