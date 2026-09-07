import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'

type Props = { params: Promise<{ slug: string; schoolSlug: string; classId: string }> }

// Link único e reaproveitável por turma — só pra escolas do tipo "seminario".
// Cada visita cria uma school_applications nova (rascunho, sem interest_form_id)
// e manda a pessoa direto pro formulário completo — sem pré-inscrição prévia,
// diferente do fluxo normal de ETED. enviarFormulario() detecta a ausência de
// interest_form_id + school_type='seminario' e matricula automaticamente ao
// enviar, sem precisar de aprovação manual do DH.
export default async function MatriculaDiretaPage({ params }: Props) {
  const { slug, schoolSlug, classId } = await params
  const sb = createAdminClient()

  const { data: org } = await sb
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .eq('active', true)
    .single()
  if (!org) notFound()

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(schoolSlug)
  const schoolQuery = sb
    .from('schools')
    .select('id, school_type')
    .eq('organization_id', org.id)
    .eq('active', true)
    .eq('is_public', true)
  const { data: school } = await (isUUID
    ? schoolQuery.eq('id', schoolSlug).single()
    : schoolQuery.eq('slug', schoolSlug).single())
  if (!school || school.school_type !== 'seminario') notFound()

  const { data: turma } = await sb
    .from('school_classes')
    .select('id')
    .eq('id', classId)
    .eq('school_id', school.id)
    .eq('active', true)
    .eq('registrations_open', true)
    .single()
  if (!turma) notFound()

  const { data: newApp, error } = await sb
    .from('school_applications')
    .insert({
      organization_id: org.id,
      school_id: school.id,
      class_id: classId,
      status: 'rascunho',
    })
    .select('token')
    .single()
  if (error || !newApp) notFound()

  redirect(`/${slug}/formulario/${newApp.token}`)
}
