import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { loadLaundryClientData } from '@/lib/laundry/public-data'
import { PublicLaundry } from './PublicLaundry'

type Props = {
  params: Promise<{ slug: string }>
}

export default async function PublicLaundryPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const sbAdmin = createAdminClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, laundry_enabled')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (!org) notFound()
  const laundryEnabled = (org as { laundry_enabled?: boolean }).laundry_enabled ?? false
  if (!laundryEnabled) notFound()

  const data = await loadLaundryClientData(sbAdmin, org.id)

  return (
    <PublicLaundry
      slug={slug}
      orgName={org.name}
      machines={data.machines}
      pricing={data.pricing}
      paymentsEnabled={data.paymentsEnabled}
    />
  )
}
