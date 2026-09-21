import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { isManagementRole } from '@/lib/auth/permissions'
import { SurveyLinkBox } from './SurveyLinkBox'
import { MessageCircle } from 'lucide-react'

type Props = { params: Promise<{ slug: string; id: string }> }

type SurveyResponse = {
  id: string
  respondent_name: string | null
  experience_feedback: string
  favorite_class_feedback: string
  improvement_suggestion: string
  created_at: string
}

export default async function EscolaPesquisaPage({ params }: Props) {
  const { slug, id } = await params
  const supabase = await createClient()

  const [{ data: { user } }, { data: org }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('organizations').select('id').eq('slug', slug).single(),
  ])
  if (!user || !org) notFound()

  const { role } = await getCurrentOrganizationRole(supabase, user.id, org.id)
  const isManagement = isManagementRole(role)
  const isLiderEted = role === 'lider_eted'
  if (!isManagement && !isLiderEted) notFound()

  const { data: escola } = await supabase
    .from('schools')
    .select('id, slug')
    .eq('id', id)
    .eq('organization_id', org.id)
    .single()
  if (!escola) notFound()

  const { data: responses } = await supabase
    .from('hospitality_seminar_survey_responses')
    .select('id, respondent_name, experience_feedback, favorite_class_feedback, improvement_suggestion, created_at')
    .eq('school_id', escola.id)
    .order('created_at', { ascending: false })

  const items = (responses ?? []) as SurveyResponse[]
  const linkPath = `/${slug}/pesquisa-hospitalidade/${escola.slug || escola.id}`

  return (
    <main className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <p className="text-sm text-gray-500 mb-2">
          Compartilhe este link com quem participou para coletar as respostas:
        </p>
        <SurveyLinkBox path={linkPath} />
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <MessageCircle className="size-8 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 text-sm">Nenhuma resposta recebida ainda.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            {items.length} {items.length === 1 ? 'resposta' : 'respostas'}
          </p>
          {items.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3 gap-3">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {r.respondent_name || 'Anônimo'}
                </p>
                <p className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(r.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-0.5">Como foi a experiência</p>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{r.experience_feedback}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-0.5">Aula que mais falou</p>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{r.favorite_class_feedback}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-0.5">Sugestão de melhoria</p>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{r.improvement_suggestion}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
