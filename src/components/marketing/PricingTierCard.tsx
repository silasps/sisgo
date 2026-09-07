import Link from 'next/link'
import { Check } from 'lucide-react'
import { moduleLabel } from '@/lib/pricing-content'

export type Plan = {
  id: string
  slug: string
  name: string
  modules: string[]
  max_people: number | null
  price_cents: number
  extra_people_step: number | null
  extra_people_price_cents: number | null
}

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function PricingTierCard({ plan, highlight }: { plan: Plan; highlight?: boolean }) {
  return (
    <div
      className={`relative glass-card rounded-2xl p-7 flex flex-col ${
        highlight ? 'border-[#F47920]/40 sm:-translate-y-2 sm:shadow-xl sm:shadow-[#F47920]/10' : ''
      }`}
    >
      {highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#F47920] text-white text-xs font-semibold px-3 py-1 rounded-full">
          Mais popular
        </span>
      )}

      <h3 className="text-lg font-semibold">{plan.name}</h3>
      <p className="mt-3 text-3xl font-bold">
        {formatBRL(plan.price_cents)}
        <span className="text-sm font-normal text-zinc-500">/mês</span>
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        {plan.max_people ? `Até ${plan.max_people} pessoas` : 'Pessoas ilimitadas'}
        {plan.extra_people_step && plan.extra_people_price_cents ? (
          <> · +{formatBRL(plan.extra_people_price_cents)} a cada {plan.extra_people_step} extras</>
        ) : null}
      </p>

      <ul className="mt-6 space-y-2.5 flex-1">
        {plan.modules.map(m => (
          <li key={m} className="flex items-center gap-2 text-sm text-zinc-300">
            <Check className="size-4 text-brand-400 flex-shrink-0" />
            {moduleLabel(m)}
          </li>
        ))}
      </ul>

      <Link
        href={`/cadastro?plan=${plan.slug}`}
        className={`mt-8 w-full text-center px-5 py-3 rounded-xl font-semibold text-sm transition-all ${
          highlight
            ? 'bg-[#F47920] hover:bg-[#e05e0a] text-white'
            : 'bg-brand-500 hover:bg-brand-600 text-white'
        }`}
      >
        Começar trial de 30 dias
      </Link>
    </div>
  )
}
