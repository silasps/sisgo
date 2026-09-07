import { createClient } from '@/lib/supabase/server'
import { MarketingHeader } from '@/components/marketing/MarketingHeader'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'
import { OpportunityCard, type OpportunitySchool } from '@/components/marketing/OpportunityCard'
import { OpportunityFilters } from '@/components/marketing/OpportunityFilters'
import { SCHOOL_TYPES } from '@/lib/schools'

type Props = { searchParams: Promise<{ type?: string; q?: string; org?: string }> }

export default async function OportunidadesPage({ searchParams }: Props) {
  const { type, q, org } = await searchParams
  const supabase = await createClient()

  const { data } = await supabase
    .from('schools')
    .select(`
      id, slug, name, acronym, school_type, subtitle, hero_image_url,
      organizations!inner ( slug, name, city, state, logo_url, active )
    `)
    .eq('is_public', true)
    .eq('active', true)
    .order('name')

  const schools = ((data ?? []) as unknown as OpportunitySchool[])
    .filter(s => s.organizations?.active)

  const orgOptions = Array.from(
    new Map(schools.map(s => [s.organizations!.slug, s.organizations!.name])).entries()
  )
    .map(([slug, name]) => ({ slug, name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const filtered = schools.filter(s => {
    if (type && s.school_type !== type) return false
    if (org && s.organizations?.slug !== org) return false
    if (q && !`${s.name} ${s.acronym ?? ''}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  })

  return (
    <div className="min-h-screen bg-dark-950 text-white flex flex-col">
      <MarketingHeader />

      <section className="px-5 sm:px-8 pt-16 pb-6 max-w-6xl mx-auto w-full text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-400 mb-3">Oportunidades</p>
        <h1 className="text-3xl sm:text-5xl font-bold mb-4">Escolas abertas para inscrição</h1>
        <p className="text-zinc-400 max-w-xl mx-auto text-sm sm:text-base">
          Explore escolas e programas de organizações missionárias em todo o sistema.
        </p>
      </section>

      <section className="px-5 sm:px-8 pb-16 max-w-6xl mx-auto w-full">
        <OpportunityFilters types={SCHOOL_TYPES} orgs={orgOptions} />

        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8 animate-stagger">
            {filtered.map(s => <OpportunityCard key={s.id} school={s} />)}
          </div>
        ) : (
          <p className="text-center text-zinc-500 py-16">Nenhuma escola encontrada com esses filtros.</p>
        )}
      </section>

      <MarketingFooter />
    </div>
  )
}
