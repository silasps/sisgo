import { redirect } from 'next/navigation'

type Props = { params: Promise<{ slug: string; id: string }> }

// O mural da escola chegou a aparecer no Chat como "grupo"; voltou pra
// página da escola. Endereço mantido só pra links antigos (notificação,
// favorito) não quebrarem.
export default async function SchoolGroupChatRedirect({ params }: Props) {
  const { slug, id } = await params
  redirect(`/${slug}/escolas/${id}`)
}
