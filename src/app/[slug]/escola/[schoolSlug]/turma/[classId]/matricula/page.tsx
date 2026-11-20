import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import { isRegistrationOpen } from '@/lib/students/classCapacity'
import { isDirectEnrollmentType } from '@/lib/schools'

type Props = { params: Promise<{ slug: string; schoolSlug: string; classId: string }> }

// Link único e reaproveitável por turma — só pra escolas tipo "seminario" ou
// "evento" (isDirectEnrollmentType). Cada visita cria uma school_applications
// nova (rascunho, sem interest_form_id) e manda a pessoa direto pro
// formulário completo — sem pré-inscrição prévia, diferente do fluxo normal
// de ETED. enviarFormulario() detecta a ausência de interest_form_id + esse
// tipo de escola e cria a pré-inscrição só na hora do envio, sem exigir
// aprovação manual prévia.
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
  if (!school || !isDirectEnrollmentType(school.school_type)) notFound()

  const { data: turma } = await sb
    .from('school_classes')
    .select('id, registrations_open, registration_deadline')
    .eq('id', classId)
    .eq('school_id', school.id)
    .eq('active', true)
    .single()
  if (!turma || !isRegistrationOpen(turma)) notFound()

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
