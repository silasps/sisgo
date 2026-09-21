'use server'

import { createAdminClient } from '@/lib/supabase/admin'

type SurveyInput = {
  slug: string
  schoolSlug: string
  respondentName: string | null
  experienceFeedback: string
  favoriteClassFeedback: string
  improvementSuggestion: string
}

export async function enviarRespostaPesquisaHospitalidade(input: SurveyInput) {
  const experienceFeedback = input.experienceFeedback.trim()
  const favoriteClassFeedback = input.favoriteClassFeedback.trim()
  const improvementSuggestion = input.improvementSuggestion.trim()

  if (!experienceFeedback || !favoriteClassFeedback || !improvementSuggestion) {
    return { error: 'Por favor, responda todas as perguntas.' }
  }

  const sb = createAdminClient()

  const { data: org } = await sb
    .from('organizations')
    .select('id')
    .eq('slug', input.slug)
    .eq('active', true)
    .single()

  if (!org) return { error: 'Base não encontrada.' }

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.schoolSlug)
  const schoolQuery = sb.from('schools').select('id').eq('organization_id', org.id)
  const { data: school } = await (isUUID
    ? schoolQuery.eq('id', input.schoolSlug).single()
    : schoolQuery.eq('slug', input.schoolSlug).single())

  if (!school) return { error: 'Seminário não encontrado.' }

  const { error } = await sb.from('hospitality_seminar_survey_responses').insert({
    organization_id: org.id,
    school_id: school.id,
    respondent_name: input.respondentName?.trim() || null,
    experience_feedback: experienceFeedback,
    favorite_class_feedback: favoriteClassFeedback,
    improvement_suggestion: improvementSuggestion,
  })

  if (error) return { error: 'Não foi possível enviar sua resposta. Tente novamente.' }

  return { success: true }
}
