import { redirect } from 'next/navigation'

type Props = { params: Promise<{ slug: string }> }

export default async function ObreirosPage({ params }: Props) {
  const { slug } = await params
  redirect(`/${slug}/pessoas?tab=obreiros`)
}
