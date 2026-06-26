import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { accentCssVars } from '@/lib/accent-colors'

type Props = { children: React.ReactNode; params: Promise<{ slug: string }> }

export default async function PublicSlugLayout({ children, params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, slug, city, state, email, phone, website, logo_url, accent_color')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (!org) notFound()

  return (
    <>
      <style>{`:root{${accentCssVars(org.accent_color ?? 'laranja')}}`}</style>
      {children}
    </>
  )
}
