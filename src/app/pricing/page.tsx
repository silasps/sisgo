import { createClient } from '@/lib/supabase/server'
import { MarketingHeader } from '@/components/marketing/MarketingHeader'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'
import { FinalCta } from '@/components/marketing/FinalCta'
import { PricingTierCard, type Plan } from '@/components/marketing/PricingTierCard'
import { PricingComparisonTable } from '@/components/marketing/PricingComparisonTable'
import { PricingFaq } from '@/components/marketing/PricingFaq'

export default async function PricingPage() {
  const supabase = await createClient()
  const { data: plans } = await supabase
    .from('plans')
    .select('id, slug, name, modules, max_people, price_cents, extra_people_step, extra_people_price_cents')
    .eq('is_active', true)
    .order('sort_order')

  const typedPlans = (plans ?? []) as Plan[]

  return (
    <div className="min-h-screen bg-dark-950 text-white flex flex-col">
      <MarketingHeader />

      <section className="px-5 sm:px-8 pt-16 pb-4 max-w-6xl mx-auto w-full text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-400 mb-3">Planos</p>
        <h1 className="text-3xl sm:text-5xl font-bold mb-4">Um plano para cada tamanho de organização</h1>
        <p className="text-zinc-400 max-w-xl mx-auto text-sm sm:text-base">
          Comece pequeno e cresça — os módulos e o número de pessoas acompanham
          o tamanho da sua organização. Todos os planos incluem trial de 30 dias, sem cartão.
        </p>
      </section>

      <section className="px-5 sm:px-8 py-12 max-w-6xl mx-auto w-full">
        {typedPlans.length > 0 ? (
          <>
            <div className="grid sm:grid-cols-3 gap-6 sm:gap-4 items-start">
              {typedPlans.map(plan => (
                <PricingTierCard key={plan.id} plan={plan} highlight={plan.slug === 'escolas'} />
              ))}
            </div>
            <PricingComparisonTable plans={typedPlans} />
            <PricingFaq />
          </>
        ) : (
          <p className="text-center text-zinc-500 py-16">
            Nenhum plano disponível no momento.
          </p>
        )}
      </section>

      <FinalCta />
      <MarketingFooter />
    </div>
  )
}
