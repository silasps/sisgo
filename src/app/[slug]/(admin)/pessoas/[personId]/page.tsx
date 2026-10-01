import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { MANAGEMENT_ROLES } from '@/lib/auth/permissions'

type Props = { params: Promise<{ slug: string; personId: string }> }

export default async function PessoaIndexPage({ params }: Props) {
  const { slug, personId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single()
  const { role } = user && org
    ? await getCurrentOrganizationRole(supabase, user.id, org.id)
    : { role: '' }

  // Hospitalidade só enxerga a aba de Hospedagem — as outras abas do perfil
  // completo (carteirinha, financeiro etc.) barram esse papel.
  if (role === 'hospitalidade') redirect(`/${slug}/pessoas/${personId}/hospedagem`)

  // Gestão abre direto em "Dados" (visão geral + documentos do formulário) —
  // é a primeira aba agora, pensada pra ser o ponto de partida de quem olha
  // o cadastro completo pela primeira vez.
  if (MANAGEMENT_ROLES.includes(role as never)) redirect(`/${slug}/pessoas/${personId}/dados`)

  redirect(`/${slug}/pessoas/${personId}/carteirinha`)
}
