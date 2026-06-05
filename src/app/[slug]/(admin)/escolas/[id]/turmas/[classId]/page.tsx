import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'

type Props = { params: Promise<{ slug: string; id: string; classId: string }> }

export default async function EditarTurmaPage({ params }: Props) {
  const { slug, id, classId } = await params
  const supabase = await createClient()

  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single()
  if (!org) notFound()

  const { data: escola } = await supabase
    .from('schools')
    .select('id, name, slug')
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
  const activePrograms = (allPrograms ?? []).filter(p => selectedProgramIds.has(p.id))

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
      cost_description: (formData.get('cost_description') as string) || null,
      location: (formData.get('location') as string) || null,
      public_description: (formData.get('public_description') as string) || null,
      max_students: formData.get('max_students') ? Number(formData.get('max_students')) : null,
      registrations_open: formData.get('registrations_open') === 'on',
      online_applications: formData.get('online_applications') === 'on',
      active: formData.get('active') === 'on',
    }).eq('id', classId)

    // Atualizar programas extras: delete todos e reinserir os selecionados
    const selectedIds = formData.getAll('programs') as string[]
    await sb.from('school_class_programs').delete().eq('class_id', classId)
    if (selectedIds.length > 0) {
      await sb.from('school_class_programs').insert(
        selectedIds.map(pid => ({ class_id: classId, program_id: pid }))
      )
    }

    redirect(`/${slug}/escolas/${id}/turmas/${classId}`)
  }

  const toDateInput = (v: string | null) => v ? v.slice(0, 10) : ''
  const schoolSlug = (escola as unknown as { slug: string | null }).slug

  return (
    <>
      <Header
        title={turma.name}
        actions={
          schoolSlug ? (
            <Link href={`/${slug}/escola/${schoolSlug}`} target="_blank"
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Ver página pública ↗
            </Link>
          ) : undefined
        }
      />
      <main className="p-4 md:p-6 space-y-6">

        <nav className="text-xs text-gray-400 flex items-center gap-1">
          <Link href={`/${slug}/escolas`} className="hover:text-gray-700">Escolas</Link>
          <span>/</span>
          <Link href={`/${slug}/escolas/${id}`} className="hover:text-gray-700">{escola.name}</Link>
          <span>/</span>
          <span className="text-gray-600">{turma.name}</span>
        </nav>

        {/* Preview: atividades extras ativas desta turma */}
        {activePrograms.length > 0 && (
          <section className="bg-gradient-to-br from-brand-50 to-indigo-50 rounded-xl border border-brand-200 p-5">
            <div className="mb-4">
              <h2 className="font-semibold text-gray-900">Atividades extras desta turma</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {activePrograms.length} atividade{activePrograms.length > 1 ? 's' : ''} complementar{activePrograms.length > 1 ? 'es' : ''} ativa{activePrograms.length > 1 ? 's' : ''}
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activePrograms.map(prog => (
                <div key={prog.id} className="bg-white rounded-xl border border-white/80 p-4 shadow-sm flex gap-3 items-start">
                  <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-brand-50 flex items-center justify-center">
                    {(prog as unknown as { image_url: string | null }).image_url
                      ? <img src={(prog as unknown as { image_url: string }).image_url} alt={prog.name} className="w-full h-full object-cover" />
                      : <span className="text-2xl">{prog.icon ?? '⭐'}</span>}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{prog.name}</p>
                    {prog.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{prog.description}</p>}
                    {prog.additional_cost && (
                      <p className="text-xs font-semibold text-brand-600 mt-1">
                        + R$ {Number(prog.additional_cost).toFixed(2).replace('.', ',')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

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
                <Field label="Máx. de alunos" name="max_students" type="number" defaultValue={turma.max_students?.toString() ?? ''} />
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
                <Field label="Valor base (R$)" name="base_cost" type="number" defaultValue={(turma as unknown as { base_cost: number | null }).base_cost?.toString() ?? ''} placeholder="0,00" />
                <Field label="Local / Endereço" name="location" defaultValue={(turma as unknown as { location: string | null }).location ?? ''} placeholder="Base JOCUM, Almirante Tamandaré/PR" />
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
            </div>
          </section>

          {/* Atividades extras */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-1">Atividades extras</h2>
            <p className="text-xs text-gray-400 mb-4">
              Selecione quais atividades fazem parte desta turma. Elas aparecerão na página pública.
              <Link href={`/${slug}/escolas/programas`} className="ml-2 text-brand-500 hover:underline">Gerenciar atividades →</Link>
            </p>

            {!allPrograms?.length ? (
              <p className="text-sm text-gray-400">
                Nenhuma atividade cadastrada.{' '}
                <Link href={`/${slug}/escolas/programas`} className="text-brand-500 hover:underline">Cadastrar atividades</Link>
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {allPrograms.map(prog => {
                  const imageUrl = (prog as unknown as { image_url: string | null }).image_url
                  return (
                    <label key={prog.id} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:border-brand-200 cursor-pointer has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50 transition-all">
                      <input
                        type="checkbox"
                        name="programs"
                        value={prog.id}
                        defaultChecked={selectedProgramIds.has(prog.id)}
                        className="mt-0.5 accent-brand-500"
                      />
                      <div className="flex items-start gap-2 min-w-0">
                        <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 flex items-center justify-center">
                          {imageUrl
                            ? <img src={imageUrl} alt={prog.name} className="w-full h-full object-cover" />
                            : <span className="text-lg">{prog.icon ?? '⭐'}</span>}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{prog.name}</p>
                          {prog.description && <p className="text-xs text-gray-500 line-clamp-2">{prog.description}</p>}
                          {prog.additional_cost && (
                            <p className="text-xs text-brand-500 font-medium mt-0.5">
                              + R$ {Number(prog.additional_cost).toFixed(2).replace('.', ',')}
                            </p>
                          )}
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </section>

          <div className="flex justify-end gap-3 pb-6">
            <Link href={`/${slug}/escolas/${id}`}
              className="px-5 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Cancelar
            </Link>
            <button type="submit"
              className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors">
              Salvar alterações
            </button>
          </div>
        </form>
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
