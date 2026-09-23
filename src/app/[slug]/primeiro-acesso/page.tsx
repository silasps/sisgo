import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TrocarSenhaInicialForm } from './TrocarSenhaInicialForm'

type Props = { params: Promise<{ slug: string }> }

export default async function PrimeiroAcessoPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const mustChangePassword = (user.user_metadata as Record<string, unknown> | null)?.must_change_password === true
  if (!mustChangePassword) redirect(`/${slug}/dashboard`)

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl border border-gray-200 p-6">
        <h1 className="text-lg font-semibold text-gray-900">Defina sua senha</h1>
        <p className="text-sm text-gray-500 mt-1 mb-5">
          Sua conta foi criada com uma senha padrão. Antes de continuar, defina uma senha só sua.
        </p>
        <TrocarSenhaInicialForm slug={slug} />
      </div>
    </div>
  )
}
