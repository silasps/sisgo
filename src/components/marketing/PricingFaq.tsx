import { PRICING_FAQ } from '@/lib/pricing-content'

export function PricingFaq() {
  return (
    <div className="mt-20 max-w-2xl mx-auto">
      <h3 className="text-xl font-semibold text-center mb-8">Perguntas frequentes</h3>
      <div className="space-y-3">
        {PRICING_FAQ.map(item => (
          <details key={item.q} className="glass-card rounded-xl p-5 group">
            <summary className="font-medium text-sm cursor-pointer list-none flex items-center justify-between gap-4">
              {item.q}
              <span className="text-zinc-500 group-open:rotate-45 transition-transform text-lg leading-none">+</span>
            </summary>
            <p className="mt-3 text-sm text-zinc-400 leading-relaxed">{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  )
}
