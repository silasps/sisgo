import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { AtividadesExtrasSection } from './AtividadesExtrasSection'
import { DirectEnrollLinkBox } from './DirectEnrollLinkBox'
import { CurrencyField } from '@/components/ui/CurrencyField'
import { IntegerField } from '@/components/ui/IntegerField'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { isDirectEnrollmentType, participantNoun } from '@/lib/schools'

type Props = { params: Promise<{ slug: string; id: string; classId: string }> }

export default async function EditarTurmaPage({ params }: Props) {
  const { slug, id, classId } = await params
  const supabase = await createClient()

  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single()
  if (!org) notFound()

  const { data: escola } = await supabase
    .from('schools')
    .select('id, name, slug, school_type, is_public')
    .eq('id', id)
    .eq('organization_id', org.id)
    .single()
  if (!escola) notFound()

  const { data: turma } = await supabase
    .from('school_classes')
    .select('*')
    .eq('id', classId)
    .eq('school_id', id)
    .single()
  if (!turma) notFound()

  // Programas disponíveis na org
  const { data: allPrograms } = await supabase
    .from('school_programs')
    .select('id, name, description, icon, image_url, additional_cost')
    .eq('organization_id', org.id)
    .eq('active', true)
    .order('sort_order')

  // Programas já vinculados à turma
  const { data: classPrograms } = await supabase
    .from('school_class_programs')
    .select('program_id')
    .eq('class_id', classId)

  const selectedProgramIds = new Set((classPrograms ?? []).map(cp => cp.program_id))

  async function updateTurma(formData: FormData) {
    'use server'
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const sb = createAdminClient()

    await sb.from('school_classes').update({
      name: formData.get('name') as string,
      year: formData.get('year') ? Number(formData.get('year')) : null,
      semester: formData.get('semester') ? Number(formData.get('semester')) : null,
      starts_at: (formData.get('starts_at') as string) || null,
      ends_at: (formData.get('ends_at') as string) || null,
      registration_deadline: (formData.get('registration_deadline') as string) || null,
      base_cost: formData.get('base_cost') ? Number(formData.get('base_cost')) : null,
      daily_rate: formData.get('daily_rate') ? Number(formData.get('daily_rate')) : null,
      cost_description: (formData.get('cost_description') as string) || null,
      location: (formData.get('location') as string) || null,
      public_description: (formData.get('public_description') as string) || null,
      max_students: formData.get('max_students') ? Number(formData.get('max_students')) : null,
      quota_homens: formData.get('quota_homens') ? Number(formData.get('quota_homens')) : null,
      quota_mulheres: formData.get('quota_mulheres') ? Number(formData.get('quota_mulheres')) : null,
      quota_casais: formData.get('quota_casais') ? Number(formData.get('quota_casais')) : null,
      registrations_open: formData.get('registrations_open') === 'on',
      online_applications: formData.get('online_applications') === 'on',
      active: formData.get('active') === 'on',
    }).eq('id', classId)

    redirect(`/${slug}/escolas/${id}/turmas/${classId}`)
  }

  async function handleToggleProgram(formData: FormData) {
    'use server'
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const { revalidatePath } = await import('next/cache')
    const sb = createAdminClient()
    const programId = formData.get('program_id') as string
    const cId = formData.get('class_id') as string
    const actionType = formData.get('action_type') as string

    if (actionType === 'add') {
      await sb.from('school_class_programs').upsert({ class_id: cId, program_id: programId })
    } else {
      await sb.from('school_class_programs').delete().eq('class_id', cId).eq('program_id', programId)
    }
    revalidatePath(`/${slug}/escolas/${id}/turmas/${classId}`)
  }

  async function handleEditProgram(formData: FormData) {
    'use server'
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const sb = createAdminClient()
    const programId = formData.get('program_id') as string

    await sb.from('school_programs').update({
      name: (formData.get('name') as string).trim(),
      description: (formData.get('description') as string).trim() || null,
      icon: (formData.get('icon') as string).trim() || null,
      additional_cost: formData.get('additional_cost') ? Number(formData.get('additional_cost')) : null,
    }).eq('id', programId)

    redirect(`/${slug}/escolas/${id}/turmas/${classId}`)
  }

  async function handleDeleteProgram(formData: FormData) {
    'use server'
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const sb = createAdminClient()
    const programId = formData.get('program_id') as string

    await sb.from('school_programs').delete().eq('id', programId)
    redirect(`/${slug}/escolas/${id}/turmas/${classId}`)
  }

  const toDateInput = (v: string | null) => v ? v.slice(0, 10) : ''
  const schoolSlug = (escola as unknown as { slug: string | null }).slug
  const formConfigConfirmed = (turma as unknown as { form_config_confirmed: boolean }).form_config_confirmed

  return (
    <>
      <main className="p-4 md:p-6 space-y-6">

        <nav className="text-xs text-gray-400 flex items-center gap-1">
          <Link href={`/${slug}/escolas`} className="hover:text-gray-700">Escolas</Link>
          <span>/</span>
          <Link href={`/${slug}/escolas/${id}`} className="hover:text-gray-700">{escola.name}</Link>
          <span>/</span>
          <span className="text-gray-600">{turma.name}</span>
        </nav>

        {!formConfigConfirmed && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 uppercase tracking-wide">
              <AlertTriangle size={14} className="flex-shrink-0" /> Cadastro incompleto
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-amber-700">
              <span>O formulário desta turma ainda não foi revisado — está usando o padrão da escola.</span>
              <Link href={`/${slug}/escolas/${id}/turmas/${classId}/formulario`}
                className="flex-shrink-0 text-xs font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2">
                Configurar formulário →
              </Link>
            </div>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <Link
            href={`/${slug}/escolas/${id}/turmas/${classId}/formulario`}
            className="px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            Formulário →
          </Link>
          <Link
            href={`/${slug}/escolas/${id}/turmas/${classId}/alunos`}
            className="px-3 py-1.5 text-xs font-medium text-brand-600 border border-brand-200 rounded-lg hover:bg-brand-50 transition-colors"
          >
            {participantNoun(escola.school_type, { plural: true })} →
          </Link>
          <Link
            href={`/${slug}/escolas/${id}/turmas/${classId}/presencas`}
            className="px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Presenças →
          </Link>
          <a
            href="#atividades-extras"
            className="px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Atividades ↓
          </a>
          {schoolSlug && (
            escola.is_public ? (
              <Link href={`/${slug}/escola/${schoolSlug}`} target="_blank"
                className="px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Ver página pública ↗
              </Link>
            ) : (
              <Link href={`/${slug}/escolas/${id}/configuracoes#visibilidade`}
                className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors">
                Ativar página pública →
              </Link>
            )
          )}
        </div>

        <form action={updateTurma} className="space-y-6">

          {/* Identificação */}
          <section className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            <div className="p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Identificação</h2>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="sm:col-span-3">
                  <Field label="Nome da turma *" name="name" defaultValue={turma.name} required />
                </div>
                <Field label="Ano" name="year" type="number" defaultValue={turma.year?.toString() ?? ''} placeholder="2026" />
                <Field label="Semestre" name="semester" type="number" defaultValue={turma.semester?.toString() ?? ''} placeholder="1 ou 2" />
                <IntegerField label={`Máx. de ${participantNoun(escola.school_type, { plural: true, lowercase: true })}`} name="max_students" defaultValue={turma.max_students?.toString() ?? ''} />
              </div>
            </div>

            {/* Vagas por categoria */}
            <div className="p-5">
              <h2 className="font-semibold text-gray-900 mb-1">Vagas por categoria</h2>
              <p className="text-xs text-gray-500 mb-4">
                Opcional — limita quantas pessoas de cada categoria podem ser aceitas nessa turma
                (além do máx. de {participantNoun(escola.school_type, { plural: true, lowercase: true })} acima). Em branco = sem limite nessa categoria. Pode ser
                ajustado a qualquer momento, inclusive pra abrir uma vaga extra depois de esgotada.
              </p>
              <div className="grid sm:grid-cols-3 gap-4">
                <IntegerField label="Homens" name="quota_homens"
                  defaultValue={(turma as unknown as { quota_homens: number | null }).quota_homens?.toString() ?? ''} />
                <IntegerField label="Mulheres" name="quota_mulheres"
                  defaultValue={(turma as unknown as { quota_mulheres: number | null }).quota_mulheres?.toString() ?? ''} />
                <div>
                  <IntegerField label="Casais sem filhos (nº de casais)" name="quota_casais"
                    defaultValue={(turma as unknown as { quota_casais: number | null }).quota_casais?.toString() ?? ''} />
                  <p className="text-xs text-gray-400 mt-1">Cada casal ocupa 2 vagas de pessoas.</p>
                </div>
              </div>
            </div>

            {/* Datas */}
            <div className="p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Datas</h2>
              <div className="grid sm:grid-cols-3 gap-4">
                <Field label="Data de início" name="starts_at" type="date" defaultValue={toDateInput(turma.starts_at)} />
                <Field label="Data de término" name="ends_at" type="date" defaultValue={toDateInput(turma.ends_at)} />
                <Field label="Prazo de inscrição" name="registration_deadline" type="date" defaultValue={toDateInput((turma as unknown as { registration_deadline: string | null }).registration_deadline)} />
              </div>
            </div>

            {/* Financeiro */}
            <div className="p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Valores e pagamento</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <CurrencyField label="Valor base (R$)" name="base_cost" defaultValue={(turma as unknown as { base_cost: number | null }).base_cost ?? null} />
                <div>
                  <CurrencyField label="Valor da diária por pessoa (R$)" name="daily_rate" defaultValue={(turma as unknown as { daily_rate: number | null }).daily_rate ?? null} />
                  <p className="text-xs text-gray-400 mt-1">
                    Opcional — com ela, a tela de pagamento calcula o total pelas datas de chegada e saída
                    (noites × diária, casal conta 2 pessoas), sem passar do valor base por pessoa.
                  </p>
                </div>
                <Field label="Local / Endereço" name="location" defaultValue={(turma as unknown as { location: string | null }).location ?? ''} placeholder="Ex: Rua das Flores, 123 - Cidade/UF" />
                <div className="sm:col-span-2">
                  <TextArea label="Descrição de pagamento" name="cost_description"
                    defaultValue={(turma as unknown as { cost_description: string | null }).cost_description ?? ''}
                    placeholder="Ex: Inclui hospedagem e 3 refeições. Parcelamento disponível." rows={3} />
                </div>
                <div className="sm:col-span-2">
                  <TextArea label="Descrição pública da turma" name="public_description"
                    defaultValue={(turma as unknown as { public_description: string | null }).public_description ?? ''}
                    placeholder="Informações adicionais que aparecerão na página pública." rows={3} />
                </div>
              </div>
            </div>

            {/* Flags */}
            <div className="p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Status</h2>
              <div className="flex flex-col gap-3">
                <Toggle name="registrations_open" label="Inscrições abertas"
                  description="Exibe botão de inscrição na página pública"
                  defaultChecked={(turma as unknown as { registrations_open: boolean }).registrations_open} />
                <Toggle name="online_applications" label="Formulário online habilitado"
                  description="Permite pré-inscrição pelo formulário na página pública"
                  defaultChecked={(turma as unknown as { online_applications: boolean }).online_applications} />
                <Toggle name="active" label="Turma ativa"
                  description="Turma aparece no sistema de gestão"
                  defaultChecked={turma.active ?? true} />
              </div>

              <div className="mt-4 pt-4 border-t border-gray-50">
                {(turma as unknown as { online_applications: boolean }).online_applications ? (
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                    </span>
                    <span className="text-xs font-semibold text-green-700">Formulário online</span>
                    <span className="text-xs text-gray-400">— visível no formulário público</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                    </span>
                    <span className="text-xs font-semibold text-red-700">Oculto no formulário público</span>
                    <span className="text-xs text-gray-400">— turma não aparece nas opções</span>
                  </div>
                )}
              </div>
            </div>
          </section>

          <div className="flex justify-end gap-3 pb-6">
            <Link href={`/${slug}/escolas/${id}`}
              className="px-5 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Cancelar
            </Link>
            <SubmitButton
              pendingText="Salvando..."
              className="px-5 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Salvar alterações
            </SubmitButton>
          </div>
        </form>

        {isDirectEnrollmentType(escola.school_type) && (
          <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <div>
              <h2 className="font-semibold text-gray-900">Link de matrícula direta</h2>
              <p className="text-xs text-gray-500 mt-1">
                Diferente de um programa completo, essa categoria não tem pré-inscrição — este
                link único já abre o formulário completo desta turma. Depois de enviado, aparece
                em Inscrições aguardando aprovação do DH/liderança, igual ao fluxo normal.
                Compartilhe no WhatsApp ou coloque num site. Só funciona com &ldquo;Inscrições
                abertas&rdquo; ligado acima.
              </p>
            </div>
            {escola.is_public && turma.registrations_open ? (
              <DirectEnrollLinkBox path={`/${slug}/escola/${escola.slug ?? escola.id}/turma/${classId}/matricula`} />
            ) : (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {!escola.is_public ? (
                  <>
                    A escola precisa estar com &ldquo;Página pública ativa&rdquo; pra esse link funcionar —{' '}
                    <Link href={`/${slug}/escolas/${id}/configuracoes#visibilidade`} className="underline font-medium hover:text-amber-800">
                      ativar em Configurações
                    </Link>.
                  </>
                ) : (
                  'Ative "Inscrições abertas" acima pra esse link funcionar.'
                )}
              </p>
            )}
          </section>
        )}

        <AtividadesExtrasSection
          programs={(allPrograms ?? []).map(p => ({
            id: p.id,
            name: p.name,
            description: p.description ?? null,
            icon: (p as unknown as { icon: string | null }).icon ?? null,
            image_url: (p as unknown as { image_url: string | null }).image_url ?? null,
            additional_cost: (p as unknown as { additional_cost: number | null }).additional_cost ?? null,
            isSelected: selectedProgramIds.has(p.id),
          }))}
          classId={classId}
          orgId={org.id}
          slug={slug}
          toggleAction={handleToggleProgram}
          editAction={handleEditProgram}
          deleteAction={handleDeleteProgram}
        />

      </main>
    </>
  )
}

function Field({ label, name, defaultValue, placeholder, type, required }: {
  label: string; name: string; defaultValue?: string; placeholder?: string; type?: string; required?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input name={name} type={type ?? 'text'} defaultValue={defaultValue} placeholder={placeholder} required={required}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
    </div>
  )
}

function TextArea({ label, name, defaultValue, placeholder, rows }: {
  label: string; name: string; defaultValue?: string; placeholder?: string; rows?: number
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <textarea name={name} defaultValue={defaultValue} placeholder={placeholder} rows={rows ?? 3}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none" />
    </div>
  )
}

function Toggle({ name, label, description, defaultChecked }: {
  name: string; label: string; description?: string; defaultChecked?: boolean
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <div className="relative mt-0.5 flex-shrink-0">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="sr-only peer" />
        <div className="w-10 h-6 bg-gray-200 peer-checked:bg-brand-500 rounded-full transition-colors" />
        <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
    </label>
  )
}
