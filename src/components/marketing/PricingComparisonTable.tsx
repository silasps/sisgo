import { Check } from 'lucide-react'
import { MODULE_ORDER, moduleLabel } from '@/lib/pricing-content'
import type { Plan } from './PricingTierCard'

export function PricingComparisonTable({ plans }: { plans: Plan[] }) {
  return (
    <div className="mt-16">
      <h3 className="text-xl font-semibold text-center mb-8">Compare os módulos incluídos</h3>

      {/* Desktop: tabela */}
      <div className="hidden sm:block glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left font-medium text-zinc-400 px-6 py-4">Módulo</th>
              {plans.map(p => (
                <th key={p.id} className="text-center font-semibold px-4 py-4">{p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULE_ORDER.map(mod => (
              <tr key={mod} className="border-b border-white/5 last:border-0">
                <td className="px-6 py-3 text-zinc-300">{moduleLabel(mod)}</td>
                {plans.map(p => (
                  <td key={p.id} className="text-center px-4 py-3">
                    {p.modules.includes(mod) && <Check className="size-4 text-brand-400 inline" />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: uma lista empilhada por plano */}
      <div className="sm:hidden space-y-4">
        {plans.map(p => (
          <div key={p.id} className="glass-card rounded-2xl p-5">
            <p className="font-semibold mb-3">{p.name}</p>
            <ul className="space-y-2">
              {MODULE_ORDER.filter(mod => p.modules.includes(mod)).map(mod => (
                <li key={mod} className="flex items-center gap-2 text-sm text-zinc-300">
                  <Check className="size-4 text-brand-400 flex-shrink-0" />
                  {moduleLabel(mod)}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
