import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RevealBackground } from '@/components/RevealBackground'
import { MarketingHeader } from '@/components/marketing/MarketingHeader'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'
import { Hero } from '@/components/marketing/Hero'
import { StatsBar } from '@/components/marketing/StatsBar'
import { FeaturesSection } from '@/components/marketing/FeaturesSection'
import { HowItWorksSection } from '@/components/marketing/HowItWorksSection'
import { ActiveBasesSection } from '@/components/marketing/ActiveBasesSection'
import { FinalCta } from '@/components/marketing/FinalCta'

type Props = { searchParams: Promise<{ code?: string }> }

export default async function LandingPage({ searchParams }: Props) {
  const { code } = await searchParams
  if (code) redirect(`/auth/callback?code=${code}`)
  let orgs: { id: string; name: string; slug: string; city: string | null; state: string | null; logo_url: string | null }[] | null = null
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('organizations')
      .select('id, name, slug, city, state, logo_url')
      .eq('active', true)
      .order('name')
    orgs = data
  } catch {
    // Stale auth session — render as anonymous
  }

  return (
    <>
      {/* Força background escuro no body para evitar flash branco */}
      <style>{`html,body{background:#06120f}`}</style>

    <div className="min-h-screen text-white flex flex-col antialiased">
      <div className="shrink-0 h-[env(safe-area-inset-top)] bg-[#060a0a]" />

      {/* ── Backgrounds fixos (z-0) ── */}
      <RevealBackground />

      {/* Grain overlay */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[9998]"
        style={{
          opacity: 0.025,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '200px',
        }}
      />

      {/* ── Todo o conteúdo em z-[1] para ficar ACIMA dos backgrounds fixos ── */}
      <div className="relative z-[1] flex flex-col flex-1">
        <MarketingHeader />
        <Hero />
        <StatsBar />
        <FeaturesSection />
        <HowItWorksSection />
        {orgs && <ActiveBasesSection orgs={orgs} />}
        <FinalCta />
        <MarketingFooter />
      </div>
    </div>
    </>
  )
}
