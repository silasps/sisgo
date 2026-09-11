import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { FormularioInscricao } from './FormularioInscricao'
import { CheckCircle2 } from 'lucide-react'
import { getFormDict, normalizeLang } from '@/lib/i18n/forms'

type Props = {
  params: Promise<{ slug: string; token: string }>
  searchParams: Promise<{ print?: string; lang?: string }>
}

export default async function FormularioPage({ params, searchParams }: Props) {
  const { slug, token } = await params
  const { print, lang } = await searchParams
  const printMode = print === '1'
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
    .select('slug, active, name, student_communication_languages')
    .eq('id', app.organization_id)
    .single()

  if (!org?.active || org.slug !== slug) notFound()

  // Sem `?lang=` na URL e sem idioma salvo no formulário, o padrão segue os
  // idiomas de comunicação configurados pela organização (pt se disponível,
  // senão o primeiro da lista) em vez de cair direto para 'pt' fixo.
  const orgStudentLanguages = (org.student_communication_languages as string[] | null) ?? []
  const orgDefaultLang = orgStudentLanguages.includes('pt') ? 'pt' : (orgStudentLanguages[0] ?? 'pt')

  const preform = app.school_interest_forms as unknown as {
    full_name?: string; email?: string; phone?: string; language?: string
  } | null
  const formData = (app.form_data as Record<string, unknown>) ?? {}
  const prefillFromForm = (formData.prefill as Record<string, string | undefined>) ?? {}

  // Documentos da seção 15 (bucket application-documents) já enviados em
  // visitas anteriores — bucket privado, então precisam de URL assinada pra
  // mostrar a miniatura de volta no formulário em vez de "nenhum arquivo
  // escolhido" de novo. (O comprovante de pagamento não entra aqui: a tela
  // que pede ele só aparece quando ainda não existe um salvo.)
  type DocMeta = { path: string; name: string; type: string; size?: number }
  const documentUrls: Record<string, { url: string; name: string; type: string; size?: number }> = {}
  const s15Entries = Object.entries((formData.s15 as Record<string, unknown>) ?? {})
    .filter((entry): entry is [string, DocMeta] => {
      const doc = entry[1] as DocMeta | undefined
      return !!doc?.path && !!doc.name && !!doc.type
    })
  if (s15Entries.length) {
    const signedUrls = await Promise.all(
      s15Entries.map(([, doc]) => sb.storage.from('application-documents').createSignedUrl(doc.path, 3600))
    )
    s15Entries.forEach(([key, doc], i) => {
      const url = signedUrls[i].data?.signedUrl
      if (url) documentUrls[key] = { url, name: doc.name, type: doc.type, size: doc.size }
    })
  }
  const prefill = {
    nome:     preform?.full_name  ?? prefillFromForm.nome,
    email:    preform?.email      ?? prefillFromForm.email,
    telefone: preform?.phone      ?? prefillFromForm.telefone,
    idioma:   preform?.language   ?? prefillFromForm.idioma,
  }

  const pageLang = normalizeLang(lang ?? prefill.idioma ?? orgDefaultLang)
  const d = getFormDict(pageLang).bigFormChrome

  // Valida expiração
  if (new Date(app.token_expires_at) < new Date()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow p-10 max-w-md text-center">
          <p className="text-4xl mb-4">⏰</p>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{d.link_expired_title}</h1>
          <p className="text-gray-500 text-sm">{d.link_expired_body}</p>
        </div>
      </div>
    )
  }

  if (app.status === 'enviado' || app.status === 'em_analise' || app.status === 'aprovado') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow p-10 max-w-md text-center">
          <CheckCircle2 className="size-12 mx-auto mb-4 text-green-500" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">{d.already_sent_title}</h1>
          <p className="text-gray-500 text-sm">{d.already_sent_body}</p>
        </div>
      </div>
    )
  }

  const escola = app.schools as unknown as { id: string; name: string; organization_id: string } | null
  const turma  = app.school_classes as unknown as { name: string } | null

  // Busca config de campos da escola
  const hiddenFields: string[] = []
  let paymentInfo: string | null = null
  if (escola?.id) {
    const { data: schoolConfig } = await sb
      .from('schools')
      .select('form_config')
      .eq('id', escola.id)
      .single()
    const cfg = (schoolConfig?.form_config as { hidden_fields?: string[]; payment_info?: string }) ?? {}
    hiddenFields.push(...(cfg.hidden_fields ?? []))
    paymentInfo = cfg.payment_info ?? null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4">
        <div className="max-w-2xl mx-auto">
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">
            {org.name ?? d.org_label}
          </p>
          <h1 className="text-lg font-bold text-gray-900 mt-0.5">
            {escola?.name ?? d.fallback_title}
          </h1>
          {turma && <p className="text-sm text-gray-400">{turma.name}</p>}
        </div>
      </header>

      {/* Orientação */}
      <div className="print:hidden max-w-2xl mx-auto px-4 sm:px-6 pt-5 sm:pt-6">
        <div className="bg-indigo-600 text-white rounded-2xl p-5 mb-6">
          <h2 className="font-bold text-base mb-1">{d.welcome_title}</h2>
          <p className="text-sm text-indigo-100 leading-relaxed">
            {printMode ? d.welcome_body_print : d.welcome_body_online}
          </p>
        </div>
      </div>

      {/* Form */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pb-28 sm:pb-24">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 md:p-8">
          <FormularioInscricao
            slug={slug}
            token={token}
            applicationId={app.id}
            schoolName={escola?.name ?? ''}
            orgName={org.name}
            className={turma?.name}
            prefill={prefill}
            initialSection={app.current_section ?? 1}
            initialData={formData}
            hiddenFields={hiddenFields}
            paymentInfo={paymentInfo}
            initialLang={pageLang}
            printMode={printMode}
            documentUrls={documentUrls}
          />
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          {d.footer_contact}
        </p>
      </main>
    </div>
  )
}
