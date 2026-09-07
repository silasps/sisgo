import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { XCircle, Clock, CheckCircle2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Props = { params: Promise<{ token: string }> }

export default async function VerificarCadastroPage({ params }: Props) {
  const { token } = await params
  const db = createAdminClient()

  const { data: org } = await db
    .from('organizations')
    .select('id, name, slug, email, signup_verification_expires_at')
    .eq('signup_verification_token', token)
    .maybeSingle()

  if (!org) {
    return <Result icon={XCircle} color="text-red-500" title="Link inválido" description="Este link de verificação não existe ou já foi usado." />
  }

  const expired = org.signup_verification_expires_at
    ? new Date(org.signup_verification_expires_at) < new Date()
    : true

  if (expired) {
    return <Result icon={Clock} color="text-amber-500" title="Link expirado" description="Este link expirou, mas sua organização já está ativa — acesse o painel normalmente." slug={org.slug} />
  }

  await db
    .from('organizations')
    .update({
      contact_email_verified: true,
      signup_verification_token: null,
      signup_verification_expires_at: null,
    })
    .eq('id', org.id)

  return (
    <Result
      icon={CheckCircle2}
      color="text-green-500"
      title="E-mail verificado!"
      description={`O endereço ${org.email ?? ''} foi confirmado para a organização ${org.name}.`}
      slug={org.slug}
    />
  )
}

function Result({ icon: Icon, color, title, description, slug }: {
  icon: LucideIcon
  color: string
  title: string
  description: string
  slug?: string
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 max-w-md w-full text-center">
        <Icon className={`size-12 mx-auto mb-4 ${color}`} />
        <h1 className="text-xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-sm text-gray-500 leading-relaxed mb-8">{description}</p>
        <Link
          href={slug ? `/${slug}/pessoas` : '/login'}
          className="inline-block px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {slug ? 'Ir para o painel' : 'Ir para o login'}
        </Link>
      </div>
    </div>
  )
}
