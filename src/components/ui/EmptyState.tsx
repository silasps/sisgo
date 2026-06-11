import { type LucideIcon } from 'lucide-react'
import Link from 'next/link'

type Props = {
  icon?: LucideIcon
  title: string
  description?: string
  cta?: {
    label: string
    href?: string
    onClick?: () => void
  }
}

export function EmptyState({ icon: Icon, title, description, cta }: Props) {
  return (
    <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center flex flex-col items-center gap-3">
      {Icon && (
        <div className="p-3 rounded-full bg-gray-50">
          <Icon size={24} className="text-gray-300" />
        </div>
      )}
      <p className="text-gray-600 font-medium text-sm">{title}</p>
      {description && (
        <p className="text-gray-400 text-xs max-w-xs">{description}</p>
      )}
      {cta && (
        cta.href ? (
          <Link
            href={cta.href}
            className="mt-1 text-xs font-medium text-brand-500 hover:text-brand-700 hover:underline transition-colors"
          >
            {cta.label} →
          </Link>
        ) : (
          <button
            type="button"
            onClick={cta.onClick}
            className="mt-1 text-xs font-medium text-brand-500 hover:text-brand-700 transition-colors"
          >
            {cta.label} →
          </button>
        )
      )}
    </div>
  )
}
