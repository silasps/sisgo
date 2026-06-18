'use client'

type HeaderProps = {
  title: string
  actions?: React.ReactNode
}

export function Header({ title, actions }: HeaderProps) {
  return (
    <header className="h-16 shrink-0 border-b border-gray-200 bg-white flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-lg font-semibold text-gray-900 truncate">{title}</h1>
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {actions}
        </div>
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
