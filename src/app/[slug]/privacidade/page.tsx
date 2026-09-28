import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { MarketingHeader } from '@/components/marketing/MarketingHeader'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'
import { PrivacyPolicyContent } from '@/components/marketing/PrivacyPolicyContent'

type Props = { params: Promise<{ slug: string }> }

// Mesma política de /privacidade, só que com o contato da própria
// organização na seção 11 — linkada nos formulários de inscrição de
// aluno/obreiro (o e-mail vem de organizations.email, configurável em
// /configuracoes por líder/admin da base).
export default async function OrgPrivacidadePage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('name, email, active')
    .eq('slug', slug)
    .single()

  if (!org?.active) notFound()

  return (
    <div className="min-h-screen bg-dark-950 text-white flex flex-col">
      <MarketingHeader />
      <PrivacyPolicyContent org={{ name: org.name, email: org.email }} />
      <MarketingFooter />
    </div>
  )
}
