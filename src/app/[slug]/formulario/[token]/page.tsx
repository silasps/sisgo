import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { FormularioInscricao } from './FormularioInscricao'
import { CheckCircle2 } from 'lucide-react'

type Props = { params: Promise<{ slug: string; token: string }> }

export default async function FormularioPage({ params }: Props) {
  const { slug, token } = await params
  const sb = createAdminClient()

  const { data: app } = await sb
    .from('school_applications')
    .select(`
      id, status, current_section, form_data, token_expires_at,
      organization_id,
      schools(id, name, organization_id),
      school_classes(name),
      school_interest_forms(full_name, email, phone, language)
    `)
    .eq('token', token)
    .single()

  if (!app) notFound()

  const { data: org } = await sb
    .from('organizations')
    .select('slug, active')
    .eq('id', app.organization_id)
    .single()

  if (!org?.active || org.slug !== slug) notFound()

  // Valida expiração
  if (new Date(app.token_expires_at) < new Date()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow p-10 max-w-md text-center">
          <p className="text-4xl mb-4">⏰</p>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link expirado</h1>
          <p className="text-gray-500 text-sm">
            Este link de formulário expirou. Entre em contato com a equipe da escola para solicitar um novo link.
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

  const escola = app.schools as unknown as { id: string; name: string; organization_id: string } | null
  const turma  = app.school_classes as unknown as { name: string } | null

  // Busca config de campos da escola
  const hiddenFields: string[] = []
  if (escola?.id) {
    const { data: schoolConfig } = await sb
      .from('schools')
      .select('form_config')
      .eq('id', escola.id)
      .single()
    const cfg = (schoolConfig?.form_config as { hidden_fields?: string[] }) ?? {}
    hiddenFields.push(...(cfg.hidden_fields ?? []))
  }
  const preform = app.school_interest_forms as unknown as {
    full_name?: string; email?: string; phone?: string; language?: string
  } | null

  const formData = (app.form_data as Record<string, unknown>) ?? {}
  const prefillFromForm = (formData.prefill as Record<string, string | undefined>) ?? {}

  const prefill = {
    nome:     preform?.full_name  ?? prefillFromForm.nome,
    email:    preform?.email      ?? prefillFromForm.email,
    telefone: preform?.phone      ?? prefillFromForm.telefone,
    idioma:   preform?.language   ?? prefillFromForm.idioma,
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4">
        <div className="max-w-2xl mx-auto">
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">
            Jovens Com Uma Missão
          </p>
          <h1 className="text-lg font-bold text-gray-900 mt-0.5">
            {escola?.name ?? 'Inscrição'}
          </h1>
          {turma && <p className="text-sm text-gray-400">{turma.name}</p>}
        </div>
      </header>

      {/* Orientação */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-5 sm:pt-6">
        <div className="bg-indigo-600 text-white rounded-2xl p-5 mb-6">
          <h2 className="font-bold text-base mb-1">Bem-vindo(a) ao formulário de inscrição!</h2>
          <p className="text-sm text-indigo-100 leading-relaxed">
            Este formulário faz parte do processo seletivo. Responda com atenção e sinceridade.
            Seu progresso é salvo automaticamente a cada seção. Tempo estimado: <strong>30 a 45 minutos</strong>.
          </p>
        </div>
      </div>

      {/* Form */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 md:p-8">
          <FormularioInscricao
            slug={slug}
            token={token}
            applicationId={app.id}
            schoolName={escola?.name ?? ''}
            className={turma?.name}
            prefill={prefill}
            initialSection={app.current_section ?? 1}
            initialData={formData}
            hiddenFields={hiddenFields}
            initialLang={prefill.idioma}
          />
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Dúvidas? Entre em contato com a equipe responsável pela escola.
        </p>
      </main>
    </div>
  )
}
