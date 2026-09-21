'use client'

export type WizardPlan = {
  id: string
  slug: string
  name: string
  price_cents: number
  max_people: number | null
}

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function PlanoSection({ plans, data }: { plans: WizardPlan[]; data?: Record<string, string> }) {
  return (
    <div className="space-y-5">
      <h2 className="font-semibold text-gray-900">Escolha um plano</h2>
      <p className="text-xs text-gray-500 -mt-3">
        Todos os planos começam com trial de 30 dias, sem cartão de crédito.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {plans.map((p, i) => (
          <label
            key={p.id}
            className="flex flex-col gap-1 px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-sm cursor-pointer has-[:checked]:border-brand-500 has-[:checked]:bg-brand-500/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              <input
                type="radio"
                name="plan_id"
                value={p.id}
                defaultChecked={(data?.plan_id ?? plans[Math.min(1, plans.length - 1)]?.id) === p.id || (!data?.plan_id && i === 1)}
                required
                className="accent-brand-500"
              />
              <span className="font-semibold text-gray-900">{p.name}</span>
            </div>
            <span className="text-gray-500 text-xs">
              {formatBRL(p.price_cents)}/mês · {p.max_people ? `até ${p.max_people} pessoas` : 'ilimitado'}
            </span>
          </label>
        ))}
      </div>

      <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800 leading-relaxed">
        Você começa com um trial de 30 dias neste plano. Ainda não cobramos automaticamente —
        nossa equipe entra em contato antes do fim do trial para combinar a assinatura.
      </div>
    </div>
  )
}
