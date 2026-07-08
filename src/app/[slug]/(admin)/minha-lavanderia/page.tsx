import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { notFound } from 'next/navigation'
import { loadLaundryClientData } from '@/lib/laundry/public-data'
import { PublicLaundry } from '@/app/[slug]/lavanderia/PublicLaundry'

type Props = {
  params: Promise<{ slug: string }>
}

// Lavanderia como cliente, para qualquer usuário logado: mesma experiência da
// página pública, mas a sessão já nasce identificada com o nome do usuário
// (visível só para a hospitalidade no painel).
export default async function MinhaLavanderiaPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const sbAdmin = createAdminClient()

  const [{ data: { user } }, { data: org }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('organizations').select('id, name, laundry_enabled').eq('slug', slug).single(),
  ])
  if (!user || !org) notFound()

  const laundryEnabled = (org as { laundry_enabled?: boolean }).laundry_enabled ?? false
  if (!laundryEnabled) notFound()

  const [{ data: staff }, { data: student }, { data: associado }] = await Promise.all([
    sbAdmin.from('staff_profiles').select('person_id').eq('user_id', user.id).eq('organization_id', org.id).maybeSingle(),
    sbAdmin.from('student_profiles').select('person_id').eq('user_id', user.id).eq('organization_id', org.id).maybeSingle(),
    sbAdmin.from('associado_profiles').select('person_id').eq('user_id', user.id).eq('organization_id', org.id).maybeSingle(),
  ])
  const personId = staff?.person_id ?? student?.person_id ?? associado?.person_id ?? null

  let payerName: string | null = null
  if (personId) {
    const { data: person } = await sbAdmin.from('people').select('full_name').eq('id', personId).maybeSingle()
    payerName = person?.full_name ?? null
  }
  payerName = payerName
    ?? (user.user_metadata?.full_name as string | undefined)
    ?? (user.user_metadata?.name as string | undefined)
    ?? user.email?.split('@')[0]
    ?? null

  const data = await loadLaundryClientData(sbAdmin, org.id, user.id)

  return (
    <>
      <Header title="Lavanderia" />
      <main className="p-4 md:p-6">
        <PublicLaundry
          slug={slug}
          orgName={org.name}
          machines={data.machines}
          pricing={data.pricing}
          paymentsEnabled={data.paymentsEnabled}
          payerName={payerName}
          embedded
        />
      </main>
    </>
  )
}
