import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { StaffRegistrationForm } from '../StaffRegistrationForm'
import { IframeResizer } from '@/components/ui/IframeResizer'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ lang?: string }>
}

export default async function ServirEmbedPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { lang: langParam } = await searchParams

  const sb = createAdminClient()

  const { data: org } = await sb
    .from('organizations')
    .select('id, name')
    .eq('slug', slug)
    .eq('active', true)
    .single()
  if (!org) notFound()

  const { data: ministriesRaw } = await sb
    .from('ministries')
    .select('id, name')
    .eq('organization_id', org.id)
    .eq('active', true)
    .order('name')

  const ministries = (ministriesRaw ?? []) as { id: string; name: string }[]

  return (
    <div className="min-h-screen bg-white">
      <IframeResizer>
        <div className="px-4 py-8 max-w-2xl mx-auto">
          <div className="mb-6 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-1">Pré-inscrição</p>
            <h1 className="text-2xl font-black text-gray-900">Venha servir conosco</h1>
            <p className="text-sm text-gray-500 mt-1">{org.name}</p>
          </div>

          <StaffRegistrationForm
            slug={slug}
            ministries={ministries}
            initialLang={langParam}
          />

          <p className="text-center text-xs text-gray-300 mt-8">
            Powered by <span className="font-semibold">SISGO</span>
          </p>
        </div>
      </IframeResizer>
    </div>
  )
}
