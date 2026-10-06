import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { MANAGEMENT_ROLES } from '@/lib/auth/permissions'
import { ptDict } from '@/lib/i18n/staff-forms'
import { atualizarNomePessoa, atualizarContatoPessoa, substituirDocumentoPessoa, atualizarCampoFormulario } from './actions'
import { EditNameCard } from './EditNameCard'
import { EditContactCard } from './EditContactCard'
import { DocumentField } from './DocumentField'
import { EditableFormField } from './EditableFormField'

type Props = { params: Promise<{ slug: string; personId: string }> }

const DOCUMENT_KEYS = new Set([
  'doc_foto', 'doc_rg_frente', 'doc_rg_verso', 'doc_cnh',
  'doc_passaporte', 'doc_passaporte_opcional', 'doc_certidao_casamento', 'doc_certidao_casamento_s10',
])
// Chaves de controle interno do formulário, não dado da pessoa em si —
// não faz sentido mostrar na área de "Dados".
const SKIP_KEYS = new Set(['prefill'])

type DocValue = { path: string; name: string; type: string; size: number; uploaded_at: string }

function isDocValue(v: unknown): v is DocValue {
  return typeof v === 'object' && v !== null && 'path' in v && typeof (v as DocValue).path === 'string'
}

function renderPlainValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (Array.isArray(value)) return value.length ? value.map(String).join(', ') : '—'
  if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.length ? `${parsed.length} item(ns)` : '—'
    } catch { /* não era JSON de verdade, mostra como texto mesmo */ }
  }
  return String(value)
}

export default async function DadosPessoaPage({ params }: Props) {
  const { slug, personId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single()
  if (!org) notFound()

  const { role } = await getCurrentOrganizationRole(supabase, user.id, org.id)
  if (!MANAGEMENT_ROLES.includes(role as never)) redirect(`/${slug}/pessoas/${personId}/carteirinha`)

  const db = createAdminClient()
  const [{ data: person }, { data: contacts }, { data: application }] = await Promise.all([
    db.from('people').select('id, full_name').eq('id', personId).eq('organization_id', org.id).single(),
    db.from('person_contacts').select('type, value, is_primary').eq('person_id', personId),
    db.from('staff_applications')
      .select('id, form_data, status, applied_at')
      .eq('organization_id', org.id).eq('person_id', personId)
      .order('applied_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (!person) notFound()

  const currentEmail = (contacts ?? []).find(c => c.type === 'email')?.value ?? ''
  // Pode haver mais de um contato de telefone (ex.: "phone" de uma
  // pré-inscrição antiga + "whatsapp" mais recente) — prioriza o marcado
  // como principal em vez do primeiro que aparecer na consulta.
  const phoneContacts = (contacts ?? []).filter(c => c.type === 'whatsapp' || c.type === 'phone')
  const currentPhone = (phoneContacts.find(c => c.is_primary) ?? phoneContacts[0])?.value ?? ''

  const formData = (application?.form_data as Record<string, unknown>) ?? {}
  const sections = Object.keys(formData).filter(k => !SKIP_KEYS.has(k) && typeof formData[k] === 'object')

  // URLs assinadas pra tudo que for documento — gera de uma vez, não por
  // campo (lista pequena, não compensa paralelizar com mais round-trips).
  const docPaths: string[] = []
  for (const s of sections) {
    const sectionData = formData[s] as Record<string, unknown>
    for (const [key, value] of Object.entries(sectionData)) {
      if (DOCUMENT_KEYS.has(key) && isDocValue(value)) docPaths.push(value.path)
    }
  }
  const signedUrls = new Map<string, string>()
  if (docPaths.length) {
    const { data: signed } = await db.storage.from('staff-application-documents').createSignedUrls(docPaths, 60 * 60)
    for (const row of signed ?? []) {
      if (row.signedUrl && row.path) signedUrls.set(row.path, row.signedUrl)
    }
  }

  return (
    <main className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <EditNameCard fullName={person.full_name} action={atualizarNomePessoa.bind(null, personId)} />
      <EditContactCard currentEmail={currentEmail} currentPhone={currentPhone} action={atualizarContatoPessoa.bind(null, personId)} />

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-1">Dados do formulário</h2>
        {!application ? (
          <p className="text-sm text-gray-400">
            Essa pessoa não tem nenhuma inscrição de obreiro registrada — provavelmente foi criada
            direto (sem passar pelo formulário completo).
          </p>
        ) : (
          <div className="space-y-5 mt-3">
            {sections.map(sectionKey => {
              const sectionDict = (ptDict as unknown as Record<string, Record<string, string>>)[sectionKey] ?? {}
              const sectionData = formData[sectionKey] as Record<string, unknown>
              const entries = Object.entries(sectionData).filter(([k, v]) =>
                v !== null && v !== undefined && v !== '' && k !== 'escolas_instituicao' && !k.endsWith('_country'))
              if (!entries.length) return null
              return (
                <div key={sectionKey} className="border-t border-gray-100 pt-4 first:border-t-0 first:pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                    {entries.map(([key, value]) => {
                      const label = sectionDict[key] ?? key
                      if (DOCUMENT_KEYS.has(key) && isDocValue(value)) {
                        return (
                          <DocumentField
                            key={key}
                            label={label}
                            fileName={value.name}
                            url={signedUrls.get(value.path) ?? null}
                            replaceAction={substituirDocumentoPessoa.bind(null, personId, org.id)}
                            section={sectionKey}
                            fieldKey={key}
                          />
                        )
                      }
                      // Array/objeto (idiomas, filhos etc.) fica só leitura — editar uma
                      // lista estruturada num campo de texto solto seria mais confuso
                      // que útil. Escalar (texto, data, boolean "sim/nao") é editável.
                      const isComplex = Array.isArray(value) || (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{')))
                      if (isComplex) {
                        return (
                          <div key={key} className="text-sm">
                            <p className="text-xs text-gray-400">{label}</p>
                            <p className="text-gray-800">{renderPlainValue(value)}</p>
                          </div>
                        )
                      }
                      return (
                        <EditableFormField
                          key={key}
                          label={label}
                          value={renderPlainValue(value)}
                          section={sectionKey}
                          fieldKey={key}
                          action={atualizarCampoFormulario.bind(null, personId, org.id)}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
