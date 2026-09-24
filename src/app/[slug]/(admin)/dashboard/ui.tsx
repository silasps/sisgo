import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'

// Blocos visuais compartilhados entre o dashboard (page.tsx) e os painéis de
// área (areas.tsx) — ficam num módulo à parte porque page.tsx não pode
// exportar nada além do componente da página.

const colorMap = {
  blue:   { bg: 'bg-blue-50',    icon: 'text-blue-500',   num: 'text-blue-700',   label: 'text-blue-500'   },
  green:  { bg: 'bg-green-50',   icon: 'text-green-500',  num: 'text-green-700',  label: 'text-green-500'  },
  purple: { bg: 'bg-purple-50',  icon: 'text-purple-500', num: 'text-purple-700', label: 'text-purple-500' },
  orange: { bg: 'bg-brand-50',   icon: 'text-brand-500',  num: 'text-brand-700',  label: 'text-brand-500'  },
  pink:   { bg: 'bg-pink-50',    icon: 'text-pink-500',   num: 'text-pink-700',   label: 'text-pink-500'   },
  teal:   { bg: 'bg-teal-50',    icon: 'text-teal-500',   num: 'text-teal-700',   label: 'text-teal-500'   },
}

export function StatCard({ label, value, icon: Icon, href, color }: {
  label: string; value: number; icon: LucideIcon; href: string; color: keyof typeof colorMap
}) {
  const c = colorMap[color]
  return (
    <Link
      href={href}
      title={label}
      className={`${c.bg} rounded-xl p-2.5 flex items-center gap-2.5 min-w-0 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm`}
    >
      <Icon className={`size-5 shrink-0 ${c.icon}`} />
      <div className="min-w-0">
        <p className={`text-xl font-bold leading-none ${c.num}`}><AnimatedNumber value={value} /></p>
        <p className={`text-[11px] font-semibold uppercase tracking-wide truncate ${c.label}`}>{label}</p>
      </div>
    </Link>
  )
}

export function SectionCard({ title, children, badge, href, linkLabel }: {
  title: string; children: React.ReactNode; badge?: number; href?: string; linkLabel?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
          {badge !== undefined && badge > 0 && (
            <span className="text-xs font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full leading-none">{badge}</span>
          )}
        </div>
        {href && linkLabel && (
          <Link href={href} className="text-xs text-brand-600 hover:underline font-medium">{linkLabel} →</Link>
        )}
      </div>
      <div className="p-4 flex-1">{children}</div>
    </div>
  )
}

export function EmptyState({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 gap-2 text-gray-400">
      <Icon className="size-8 opacity-40" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
