import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getRolePreview } from '@/lib/role-preview'
import { Pencil } from 'lucide-react'

type Props = { params: Promise<{ slug: string; id: string }> }

type FormSection = { title: string; fields: { label: string; key: string; type?: 'textarea' }[] }

const SECTIONS: FormSection[] = [
  {
    title: 'E-mail',
    fields: [{ label: 'E-mail', key: 'email' }],
  },
  {
    title: 'Dados pessoais',
    fields: [
      { label: 'Nome completo', key: 'nome' },
      { label: 'Sexo', key: 'sexo' },
      { label: 'Nascimento', key: 'data_nascimento' },
      { label: 'Estado civil', key: 'estado_civil' },
      { label: 'Brasileiro(a)?', key: 'is_brasileiro' },
      { label: 'Nacionalidade', key: 'nacionalidade' },
      { label: 'Fluência em português', key: 'fluencia_portugues' },
      { label: 'Escolaridade', key: 'escolaridade' },
      { label: 'Profissão', key: 'profissao' },
      { label: 'Habilidades', key: 'habilidades', type: 'textarea' },
      { label: 'Especialização profissional', key: 'especializacao_profissional' },
      { label: 'Escolas/especializações JOCUM', key: 'escolas_jocum' },
      { label: 'Português', key: 'idioma_portugues' },
      { label: 'Inglês', key: 'idioma_ingles' },
      { label: 'Espanhol', key: 'idioma_espanhol' },
      { label: 'Outro idioma', key: 'outro_idioma' },
      { label: 'RG', key: 'rg' },
      { label: 'CPF', key: 'cpf' },
      { label: 'Passaporte', key: 'passaporte' },
      { label: 'CEP', key: 'cep' },
      { label: 'Endereço', key: 'endereco' },
      { label: 'Bairro', key: 'bairro' },
      { label: 'Cidade', key: 'cidade' },
      { label: 'Estado', key: 'estado' },
      { label: 'País', key: 'pais' },
      { label: 'Celular', key: 'celular' },
      { label: 'E-mail de contato', key: 'email_contato' },
      { label: 'Instagram', key: 'instagram' },
      { label: 'Facebook', key: 'facebook' },
      { label: 'TikTok', key: 'tiktok' },
      { label: 'LinkedIn', key: 'linkedin' },
      { label: 'Emergência — Nome', key: 'emergencia_nome' },
      { label: 'Emergência — Parentesco', key: 'emergencia_parentesco' },
      { label: 'Emergência — Telefone', key: 'emergencia_telefone' },
      { label: 'Emergência — E-mail', key: 'emergencia_email' },
    ],
  },
  {
    title: 'Família',
    fields: [
      { label: 'Estado civil', key: 'estado_civil_atual' },
      { label: 'Nome do cônjuge', key: 'conjuge_nome' },
      { label: 'Nascimento do cônjuge', key: 'conjuge_nascimento' },
      { label: 'Tempo casados', key: 'tempo_casados' },
      { label: 'Cônjuge virá para a base?', key: 'conjuge_vira' },
      { label: 'Tem filhos?', key: 'tem_filhos' },
      { label: 'Dados dos filhos', key: 'filhos_dados', type: 'textarea' },
      { label: 'Filhos virão?', key: 'filhos_virao' },
    ],
  },
  {
    title: 'Igreja e vida espiritual',
    fields: [
      { label: 'Igreja', key: 'igreja_nome' },
      { label: 'Cidade da igreja', key: 'igreja_cidade' },
      { label: 'Tempo na igreja', key: 'tempo_igreja' },
      { label: 'Membro oficial?', key: 'membro_oficial' },
      { label: 'Participa de ministério?', key: 'tem_ministerio' },
      { label: 'Qual ministério', key: 'ministerio_qual' },
      { label: 'Tem liderança?', key: 'tem_lideranca' },
      { label: 'Cargo de liderança', key: 'lideranca_cargo' },
      { label: 'Nome do pastor', key: 'pastor_nome' },
      { label: 'Cargo do pastor', key: 'pastor_cargo' },
      { label: 'E-mail do pastor', key: 'pastor_email' },
      { label: 'Telefone do pastor', key: 'pastor_telefone' },
      { label: 'Conversou com o pastor?', key: 'conversou_pastor' },
      { label: 'Pastor concorda?', key: 'pastor_concorda' },
      { label: 'Igreja está ciente?', key: 'igreja_ciente' },
    ],
  },
  {
    title: 'Experiência missionária',
    fields: [
      { label: 'Serviu em projeto missionário?', key: 'serviu_missao' },
      { label: 'Descrição da experiência', key: 'missao_descricao', type: 'textarea' },
      { label: 'Organização/base', key: 'missao_organizacao' },
      { label: 'Duração', key: 'missao_duracao' },
      { label: 'Líder responsável', key: 'missao_lider_nome' },
      { label: 'E-mail do líder', key: 'missao_lider_email' },
      { label: 'Telefone do líder', key: 'missao_lider_tel' },
      { label: 'Conhece alguém na base?', key: 'conhece_alguem' },
      { label: 'Tipo de vínculo', key: 'vinculo_tipo' },
      { label: 'Nome da pessoa', key: 'vinculo_nome' },
      { label: 'Descrição do vínculo', key: 'vinculo_descricao', type: 'textarea' },
    ],
  },
  {
    title: 'Servir na base',
    fields: [
      { label: 'Modalidade de serviço', key: 'modalidade_servico' },
      { label: 'Tempo pretendido', key: 'tempo_servico' },
      { label: 'Data prevista de chegada', key: 'data_chegada' },
      { label: 'Ministério escolhido', key: 'ministerio_escolhido' },
      { label: 'Motivação', key: 'motivacao', type: 'textarea' },
    ],
  },
  {
    title: 'Saúde',
    fields: [
      { label: 'Problema de saúde?', key: 'problema_saude' },
      { label: 'Descrição', key: 'problema_saude_descricao', type: 'textarea' },
      { label: 'Limitação física?', key: 'limitacao_fisica' },
      { label: 'Descrição', key: 'limitacao_fisica_descricao', type: 'textarea' },
      { label: 'Remédio controlado?', key: 'remedio_controlado' },
      { label: 'Descrição', key: 'remedio_controlado_descricao', type: 'textarea' },
      { label: 'Alergia?', key: 'tem_alergia' },
      { label: 'Descrição', key: 'alergia_descricao', type: 'textarea' },
    ],
  },
  {
    title: 'Questões jurídicas',
    fields: [
      { label: 'Pendência judicial?', key: 'pendencia_judicial' },
      { label: 'Descrição', key: 'pendencia_judicial_descricao', type: 'textarea' },
    ],
  },
  {
    title: 'Finanças',
    fields: [
      { label: 'Tem apoio financeiro?', key: 'tem_apoio_financeiro' },
      { label: 'Descrição dos apoios', key: 'apoio_financeiro_descricao', type: 'textarea' },
      { label: 'Situação financeira', key: 'situacao_financeira', type: 'textarea' },
      { label: 'Possui dívidas?', key: 'tem_dividas' },
    ],
  },
]

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group bg-white rounded-xl border border-gray-200 overflow-hidden" open>
      <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none list-none hover:bg-gray-50">
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        <span className="text-gray-400 text-xs transition-transform group-open:rotate-180">▼</span>
      </summary>
      <div className="px-5 pb-5 border-t border-gray-100">
        {children}
      </div>
    </details>
  )
}

function FieldRow({ label, value, type }: { label: string; value: unknown; type?: 'textarea' }) {
  const str = typeof value === 'string' ? value.trim() : ''
  if (!str) return null
  return (
    <div className="py-2.5 border-b border-gray-50 last:border-0">
      <p className="text-xs font-medium text-gray-400 mb-0.5">{label}</p>
      {type === 'textarea'
        ? <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{str}</p>
        : <p className="text-sm text-gray-800">{str}</p>
      }
    </div>
  )
}

const STATUS_COLORS: Record<string, string> = {
  rascunho: 'bg-gray-100 text-gray-600',
  enviado: 'bg-blue-100 text-blue-700',
  em_analise: 'bg-yellow-100 text-yellow-700',
  aprovado: 'bg-green-100 text-green-700',
  reprovado: 'bg-red-100 text-red-700',
  cancelado: 'bg-gray-100 text-gray-500',
}

export default async function FormularioObreiroViewerPage({ params }: Props) {
  const { slug, id } = await params

  const supabase = await createClient()
  const sb = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .single()
  if (!org) notFound()

  const { data: orgUsers } = await supabase
    .from('organization_users')
    .select('organization_id, roles(name)')
    .eq('user_id', user.id)
    .eq('active', true)
  const memberships = (orgUsers ?? []) as unknown as Array<{ organization_id: string | null; roles: { name: string } | null }>
  const superadminRow = memberships.find(r => r.roles?.name === 'superadmin')
  const currentOrgRow = memberships.find(r => r.organization_id === org.id)
  const realRole = superadminRow?.roles?.name ?? currentOrgRow?.roles?.name ?? ''
  const preview = await getRolePreview(realRole)
  const userRole = preview?.role ?? realRole
  const allowed = ['superadmin', 'admin_base', 'lider_base', 'dh', 'lider_eted', 'lider_ministerio'].includes(userRole)
  if (!allowed) notFound()

  const { data: app } = await sb
    .from('staff_applications')
    .select(`
      id, status, form_data, applied_at,
      organization_id, ministry_id,
      people(full_name),
      ministries(name),
      staff_interest_forms(full_name, email, phone)
    `)
    .eq('id', id)
    .eq('organization_id', org.id)
    .single()

  if (!app) notFound()

  const formData = (app.form_data as Record<string, unknown>) ?? {}
  const ministry = app.ministries as unknown as { name: string } | null
  const preform = app.staff_interest_forms as unknown as { full_name?: string; email?: string; phone?: string } | null
  const pessoa = app.people as unknown as { full_name: string } | null
  const nomeCandidato = (formData.s2 as Record<string, string> | undefined)?.nome ?? preform?.full_name ?? pessoa?.full_name ?? '—'

  const { data: refs } = await sb
    .from('reference_forms')
    .select('type, status, form_data')
    .eq('staff_application_id', id)
    .order('created_at', { ascending: true })

  const pastorRef = refs?.find(r => r.type === 'pastor')
  const amigoRef = refs?.find(r => r.type === 'amigo')

  const sectionData = Object.entries(formData)
    .filter(([k]) => k.startsWith('s'))
    .reduce<Record<string, Record<string, string>>>((acc, [k, v]) => {
      acc[k] = (v as Record<string, string>) ?? {}
      return acc
    }, {})

  const allFields = Object.values(sectionData).reduce<Record<string, string>>((acc, sec) => ({ ...acc, ...sec }), {})

  return (
    <>
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <Link href={`/${slug}/inscricoes?tab=obreiro`} className="text-xs text-gray-400 hover:text-gray-600">
              ← Voltar às inscrições
            </Link>
            <h1 className="text-lg font-bold text-gray-900 mt-0.5">{nomeCandidato}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[app.status] ?? 'bg-gray-100 text-gray-500'}`}>
                {app.status}
              </span>
              {ministry && <span className="text-xs text-gray-400">{ministry.name}</span>}
              <span className="text-xs text-gray-300">
                {new Date(app.applied_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {Object.keys(formData).length <= 1 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
            <p className="text-sm text-amber-800 font-medium">Formulário ainda não preenchido pelo candidato.</p>
            <p className="text-xs text-amber-600 mt-1">O candidato receberá um link para preencher o formulário completo.</p>
          </div>
        )}

        {SECTIONS.map((section, sIdx) => {
          const sKey = `s${sIdx + 1}`
          const sData = sectionData[sKey] ?? {}
          const hasData = section.fields.some(f => {
            const v = sData[f.key] ?? allFields[f.key]
            return typeof v === 'string' && v.trim()
          })
          if (!hasData && sIdx > 0) return null

          return (
            <SectionCard key={sKey} title={section.title}>
              {section.fields.map(f => (
                <FieldRow key={f.key} label={f.label} value={sData[f.key] ?? allFields[f.key]} type={f.type} />
              ))}
            </SectionCard>
          )
        })}

        {/* Referências */}
        {(pastorRef || amigoRef) && (
          <SectionCard title="Referências">
            {pastorRef && (
              <div className="py-2">
                <p className="text-xs font-semibold text-gray-500 mb-1">Pastor / Líder</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pastorRef.status === 'enviado' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {pastorRef.status === 'enviado' ? 'Enviado' : 'Pendente'}
                </span>
                {pastorRef.status === 'enviado' && pastorRef.form_data && (
                  <div className="mt-2 space-y-1">
                    {Object.entries(pastorRef.form_data as Record<string, string>).map(([k, v]) => (
                      <FieldRow key={k} label={k.replace(/_/g, ' ')} value={v} />
                    ))}
                  </div>
                )}
              </div>
            )}
            {amigoRef && (
              <div className="py-2 border-t border-gray-50">
                <p className="text-xs font-semibold text-gray-500 mb-1">Amigo</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${amigoRef.status === 'enviado' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {amigoRef.status === 'enviado' ? 'Enviado' : 'Pendente'}
                </span>
                {amigoRef.status === 'enviado' && amigoRef.form_data && (
                  <div className="mt-2 space-y-1">
                    {Object.entries(amigoRef.form_data as Record<string, string>).map(([k, v]) => (
                      <FieldRow key={k} label={k.replace(/_/g, ' ')} value={v} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </SectionCard>
        )}
      </main>
    </>
  )
}
