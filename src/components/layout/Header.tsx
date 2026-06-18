'use client'

import { useMobileNav } from './AppShell'

type HeaderProps = {
  title: string
  actions?: React.ReactNode
}

export function Header({ title, actions }: HeaderProps) {
  const { openNav } = useMobileNav()

  return (
    <header className="border-b border-gray-200 bg-white flex items-center justify-between px-4 md:px-6 sticky top-0 z-10 h-[calc(3.5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={openNav}
          className="md:hidden p-1.5 -ml-1 text-gray-500 hover:text-gray-900 transition-colors flex-shrink-0"
          aria-label="Abrir menu"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </button>
        <h1 className="font-semibold text-gray-900 truncate">{title}</h1>
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">{actions}</div>
      )}
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
