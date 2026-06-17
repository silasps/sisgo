import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { XCircle, Clock, CheckCircle2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Props = { params: Promise<{ slug: string; token: string }> }

export default async function VerificarEmailPage({ params }: Props) {
  const { slug, token } = await params
  const db = createAdminClient()

  const { data: escola } = await db
    .from('schools')
    .select('id, name, contact_email, contact_email_token_expires_at')
    .eq('contact_email_token', token)
    .maybeSingle()

  if (!escola) {
    return <Result icon={XCircle} color="text-red-500" title="Link inválido" description="Este link de verificação não existe ou já foi usado." slug={slug} />
  }

  const expired = escola.contact_email_token_expires_at
    ? new Date(escola.contact_email_token_expires_at) < new Date()
    : true

  if (expired) {
    return <Result icon={Clock} color="text-amber-500" title="Link expirado" description="Este link expirou. Acesse as configurações da escola e solicite um novo." slug={slug} />
  }

  await db
    .from('schools')
    .update({
      contact_email_verified: true,
      contact_email_token: null,
      contact_email_token_expires_at: null,
    })
    .eq('id', escola.id)

  return (
    <Result
      icon={CheckCircle2}
      color="text-green-500"
      title="E-mail verificado!"
      description={`O endereço ${escola.contact_email} foi confirmado e está ativo como e-mail de contato da ${escola.name}.`}
      slug={slug}
    />
  )
}

function Result({ icon: Icon, color, title, description, slug }: {
  icon: LucideIcon
  color: string
  title: string
  description: string
  slug: string
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 max-w-md w-full text-center">
        <Icon className={`size-12 mx-auto mb-4 ${color}`} />
        <h1 className="text-xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-sm text-gray-500 leading-relaxed mb-8">{description}</p>
        <Link
          href={`/${slug}/escolas`}
          className="inline-block px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Voltar para as escolas
        </Link>
      </div>
    </div>
  )
}
