import { redirect } from 'next/navigation'

// A Agenda foi unificada em /hospedagem (alterna "Mapa de Quartos e Camas" /
// "Linha do tempo" na mesma tela) — não tinha nenhuma ação própria, só
// reexibia os mesmos dados como linha do tempo. Redirect preserva link/
// favorito antigo em vez de virar 404.
type Props = { params: Promise<{ slug: string }> }

export default async function AgendaRedirectPage({ params }: Props) {
  const { slug } = await params
  redirect(`/${slug}/hospedagem?view=timeline`)
}
