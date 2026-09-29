import { redirect } from 'next/navigation'

type Props = { params: Promise<{ slug: string; id: string }> }

// O mural do ministério chegou a aparecer no Chat como "grupo"; voltou pra
// página do ministério. Endereço mantido só pra links antigos (notificação,
// favorito) não quebrarem.
export default async function MinistryGroupChatRedirect({ params }: Props) {
  const { slug, id } = await params
  redirect(`/${slug}/ministerios/${id}`)
}
