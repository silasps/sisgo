import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { FormularioObreiro } from './FormularioObreiro'
import { CheckCircle2 } from 'lucide-react'

type Props = { params: Promise<{ slug: string; token: string }> }

export default async function FormularioObreiroPage({ params }: Props) {
  const { slug, token } = await params
  const sb = createAdminClient()

  const { data: app } = await sb
    .from('staff_applications')
    .select(`
      id, status, current_section, form_data, token_expires_at,
      organization_id, ministry_id,
      staff_interest_forms(full_name, email, phone, language),
      ministries(name)
    `)
    .eq('token', token)
    .single()

  if (!app) notFound()

  const { data: org } = await sb
    .from('organizations')
    .select('slug, active, name')
    .eq('id', app.organization_id)
    .single()

  if (!org?.active || org.slug !== slug) notFound()

  if (new Date(app.token_expires_at!) < new Date()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow p-10 max-w-md text-center">
          <p className="text-4xl mb-4">⏰</p>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link expirado</h1>
          <p className="text-gray-500 text-sm">
            Este link de formulário expirou. Entre em contato com a equipe da base para solicitar um novo link.
          </p>
        </div>
      </div>
    )
  }

  if (app.status === 'enviado' || app.status === 'em_analise' || app.status === 'aprovado') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow p-10 max-w-md text-center">
          <CheckCircle2 className="size-12 mx-auto mb-4 text-green-500" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Formulário já enviado</h1>
          <p className="text-gray-500 text-sm">
            Seu formulário já foi enviado e está em análise. A equipe entrará em contato em breve.
          </p>
        </div>
      </div>
    )
  }

  const ministry = app.ministries as unknown as { name: string } | null
  const preform = app.staff_interest_forms as unknown as {
    full_name?: string; email?: string; phone?: string; language?: string
  } | null

  const formData = (app.form_data as Record<string, unknown>) ?? {}
  const prefillFromForm = (formData.prefill as Record<string, string | undefined>) ?? {}

  const prefill = {
    nome: preform?.full_name ?? prefillFromForm.nome,
    email: preform?.email ?? prefillFromForm.email,
    telefone: preform?.phone ?? prefillFromForm.telefone,
    idioma: preform?.language ?? prefillFromForm.idioma,
  }

  const { data: ministriesRaw } = await sb
    .from('ministries')
    .select('id, name')
    .eq('organization_id', app.organization_id)
    .eq('active', true)
    .order('name')

  const ministries = (ministriesRaw ?? []) as { id: string; name: string }[]

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">

      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4">
        <div className="max-w-2xl mx-auto">
          <p className="text-xs font-bold text-amber-600 uppercase tracking-widest">
            {org.name}
          </p>
          <h1 className="text-lg font-bold text-gray-900 mt-0.5">
            Inscrição de Obreiro
          </h1>
          {ministry && <p className="text-sm text-gray-400">{ministry.name}</p>}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-5 sm:pt-6">
        <div className="bg-amber-600 text-white rounded-2xl p-5 mb-6">
          <h2 className="font-bold text-base mb-1">Bem-vindo(a) ao formulário de inscrição!</h2>
          <p className="text-sm text-amber-100 leading-relaxed">
            Este formulário faz parte do processo de avaliação para servir na base.
            Responda com atenção e sinceridade.
            Seu progresso é salvo automaticamente a cada seção. Tempo estimado: <strong>20 a 30 minutos</strong>.
          </p>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 md:p-8">
          <FormularioObreiro
            slug={slug}
            token={token}
            applicationId={app.id}
            orgName={org.name}
            ministryName={ministry?.name}
            ministryId={app.ministry_id}
            ministries={ministries}
            prefill={prefill}
            initialSection={app.current_section ?? 1}
            initialData={formData}
            initialLang={prefill.idioma}
          />
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Dúvidas? Entre em contato com a equipe responsável pela base.
        </p>
      </main>
    </div>
  )
}
