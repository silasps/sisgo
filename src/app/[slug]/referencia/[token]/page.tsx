import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { FormularioReferencia } from './FormularioReferencia'
import { normalizeLang, getFormDict } from '@/lib/i18n/forms'

type Props = {
  params: Promise<{ slug: string; token: string }>
  searchParams: Promise<{ lang?: string }>
}

export default async function ReferenciaPage({ params, searchParams }: Props) {
  const { slug, token } = await params
  const { lang: langParam } = await searchParams
  const lang = normalizeLang(langParam)
  const d = getFormDict(lang)
  const sb = createAdminClient()

  const { data: ref } = await sb
    .from('reference_forms')
    .select(`
      id, type, status, token_expires_at,
      school_applications(
        id, organization_id,
        schools(name),
        school_interest_forms(full_name)
      )
    `)
    .eq('token', token)
    .single()

  if (!ref) notFound()

  const app = ref.school_applications as unknown as {
    id: string
    organization_id: string
    schools: { name: string } | null
    school_interest_forms: { full_name: string } | null
  } | null

  if (!app) notFound()

  const { data: org } = await sb
    .from('organizations')
    .select('slug, active')
    .eq('id', app.organization_id)
    .single()

  if (!org?.active || org.slug !== slug) notFound()

  const escolaNome = app.schools?.name ?? 'JOCUM'
  const candidatoNome = app.school_interest_forms?.full_name ?? 'o(a) candidato(a)'
  const tipoLabel = ref.type === 'pastor' ? d.ref.form_type_pastor : d.ref.form_type_amigo

  if (new Date(ref.token_expires_at) < new Date()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow p-10 max-w-md text-center">
          <p className="text-4xl mb-4">⏰</p>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{d.ref.expired_title}</h1>
          <p className="text-gray-500 text-sm">{d.ref.expired_body}</p>
        </div>
      </div>
    )
  }

  if (ref.status === 'enviado') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow p-10 max-w-md text-center">
          <p className="text-4xl mb-4">✅</p>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{d.ref.already_sent_title}</h1>
          <p className="text-gray-500 text-sm">{d.ref.already_sent_body}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4">
        <div className="max-w-2xl mx-auto">
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">
            Jovens Com Uma Missão
          </p>
          <h1 className="text-lg font-bold text-gray-900 mt-0.5">
            Formulário {tipoLabel}
          </h1>
          <p className="text-sm text-gray-400">{escolaNome}</p>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-5">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
          <p className="text-sm text-amber-800 leading-relaxed">
            {d.ref.confidential}
          </p>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 pb-16">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 md:p-8">
          <FormularioReferencia
            token={token}
            tipo={ref.type as 'pastor' | 'amigo'}
            candidatoNome={candidatoNome}
            escolaNome={escolaNome}
            initialLang={langParam}
          />
        </div>
        <p className="text-center text-xs text-gray-400 mt-6">
          {d.ref.footer}
        </p>
      </main>
    </div>
  )
}
