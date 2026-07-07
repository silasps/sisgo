import { redirect } from 'next/navigation'

type Props = { params: Promise<{ slug: string; personId: string }> }

export default async function PessoaIndexPage({ params }: Props) {
  const { slug, personId } = await params
  redirect(`/${slug}/pessoas/${personId}/carteirinha`)
}
