import { redirect } from 'next/navigation'

type Props = { params: Promise<{ slug: string }> }

// Gestão de acesso de obreiro virou a aba "Acesso" dentro do perfil da
// pessoa (pessoas/[personId]/acesso) — essa rota só existe pra não quebrar
// links/favoritos antigos.
export default async function ObreirosPage({ params }: Props) {
  const { slug } = await params
  redirect(`/${slug}/pessoas?tab=obreiros`)
}
