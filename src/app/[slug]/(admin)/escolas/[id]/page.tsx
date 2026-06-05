import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'

type Props = { params: Promise<{ slug: string; id: string }> }

const SCHOOL_TYPES = [
  { value: 'eted', label: 'ETED — Escola de Treinamento e Discipulado' },
  { value: 'udn', label: 'UDN — Universidade das Nações' },
  { value: 'seminario', label: 'Seminário' },
  { value: 'curso_online', label: 'Curso Online' },
  { value: 'voluntariado', label: 'Voluntariado' },
  { value: 'outro', label: 'Outro' },
]

export default async function EditarEscolaPage({ params }: Props) {
  const { slug, id } = await params
  const supabase = await createClient()

  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single()
  if (!org) notFound()

  const { data: escola } = await supabase
    .from('schools')
    .select('*')
    .eq('id', id)
    .eq('organization_id', org.id)
    .single()
  if (!escola) notFound()

  const { data: turmas } = await supabase
    .from('school_classes')
    .select('id, name, year, semester, starts_at, active')
    .eq('school_id', id)
    .order('starts_at', { ascending: false })

  async function updateSchool(formData: FormData) {
    'use server'
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const sb = createAdminClient()

    const objectives = (formData.get('objectives') as string ?? '')
      .split('\n').map(s => s.trim()).filter(Boolean)
    const prerequisites = (formData.get('prerequisites') as string ?? '')
      .split('\n').map(s => s.trim()).filter(Boolean)

    const updatePayload: Record<string, unknown> = {
      name: formData.get('name') as string,
      acronym: (formData.get('acronym') as string) || null,
      slug: (formData.get('slug') as string) || null,
      school_type: formData.get('school_type') as string,
      subtitle: (formData.get('subtitle') as string) || null,
      long_description: (formData.get('long_description') as string) || null,
      target_audience: (formData.get('target_audience') as string) || null,
      duration_description: (formData.get('duration_description') as string) || null,
      hero_image_url: (formData.get('hero_image_url') as string) || null,
      promo_video_url: (formData.get('promo_video_url') as string) || null,
      objectives: objectives.length ? objectives : null,
      prerequisites: prerequisites.length ? prerequisites : null,
      is_public: formData.get('is_public') === 'on',
      active: formData.get('active') === 'on',
      contact_email: (formData.get('contact_email') as string) || null,
    }
    // Só atualiza senha se o líder digitou algo novo (campo em branco = manter a anterior)
    const newPassword = (formData.get('smtp_password') as string)?.trim()
    if (newPassword) updatePayload.smtp_password = newPassword

    await sb.from('schools').update(updatePayload).eq('id', id)

    redirect(`/${slug}/escolas/${id}`)
  }

  async function createTurma(formData: FormData) {
    'use server'
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const sb = createAdminClient()
    const { data: newClass, error } = await sb.from('school_classes').insert({
      school_id: id,
      name: formData.get('name') as string,
      year: formData.get('year') ? Number(formData.get('year')) : null,
      semester: formData.get('semester') ? Number(formData.get('semester')) : null,
      active: true,
    }).select('id').single()

    if (error || !newClass) {
      console.error('[createTurma] falha ao inserir turma:', error)
      redirect(`/${slug}/escolas/${id}`)
    }

    redirect(`/${slug}/escolas/${id}/turmas/${newClass.id}`)
  }

  const publicUrl = escola.slug
    ? `/${slug}/escola/${escola.slug}`
    : null

  return (
    <>
      <Header
        title={escola.name}
        actions={
          publicUrl && (escola as unknown as { is_public: boolean }).is_public ? (
            <Link href={publicUrl} target="_blank"
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Ver página pública ↗
            </Link>
          ) : undefined
        }
      />
      <main className="p-4 md:p-6 space-y-8">

        {/* Formulário da escola */}
        <form action={updateSchool} className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">

          <div className="p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Informações gerais</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Field label="Nome da escola *" name="name" defaultValue={escola.name} required />
              </div>
              <Field label="Sigla / Acrônimo" name="acronym" defaultValue={escola.acronym ?? ''} placeholder="Ex: ETED" />
              <Field label="Slug (URL pública)" name="slug" defaultValue={(escola as unknown as { slug: string | null }).slug ?? ''} placeholder="ex: eted-almirante" />
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de escola</label>
                <select name="school_type" defaultValue={(escola as unknown as { school_type: string }).school_type}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                  {SCHOOL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <Field label="Subtítulo" name="subtitle" defaultValue={(escola as unknown as { subtitle: string | null }).subtitle ?? ''} placeholder="Uma frase que resume o propósito da escola" />
              </div>
              <Field label="Duração" name="duration_description" defaultValue={(escola as unknown as { duration_description: string | null }).duration_description ?? ''} placeholder="Ex: 20 semanas (5 meses)" />
              <Field label="URL da imagem hero" name="hero_image_url" defaultValue={(escola as unknown as { hero_image_url: string | null }).hero_image_url ?? ''} placeholder="https://..." />
              <Field label="URL do vídeo promocional" name="promo_video_url" defaultValue={(escola as unknown as { promo_video_url: string | null }).promo_video_url ?? ''} placeholder="https://youtube.com/..." />
            </div>
          </div>

          <div className="p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Conteúdo público</h2>
            <div className="space-y-4">
              <TextArea label="Descrição completa" name="long_description"
                defaultValue={(escola as unknown as { long_description: string | null }).long_description ?? ''}
                placeholder="O que é esta escola? Qual o objetivo do programa?" rows={5} />
              <TextArea label="Público-alvo" name="target_audience"
                defaultValue={(escola as unknown as { target_audience: string | null }).target_audience ?? ''}
                placeholder="Para quem é indicada esta escola?" rows={3} />
              <TextArea label="Objetivos (1 por linha)" name="objectives"
                defaultValue={((escola as unknown as { objectives: string[] | null }).objectives ?? []).join('\n')}
                placeholder={'Crescer no relacionamento com Deus\nSer desafiado para as missões\nConhecer os valores da JOCUM'} rows={4} />
              <TextArea label="Pré-requisitos (1 por linha)" name="prerequisites"
                defaultValue={((escola as unknown as { prerequisites: string[] | null }).prerequisites ?? []).join('\n')}
                placeholder={'Cristão com 2+ anos de fé\nEnvolvido em uma igreja\nAprovação do pastor'} rows={4} />
            </div>
          </div>

          <div className="p-5" id="email-eted">
            <h2 className="font-semibold text-gray-900 mb-1">E-mail da ETED</h2>
            <p className="text-xs text-gray-400 mb-4">
              Usado para enviar o formulário de inscrição automaticamente aos candidatos.
              Configure o e-mail da ETED e uma{' '}
              <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer"
                className="text-brand-500 hover:underline">senha de app do Gmail</a>{' '}
              (não use sua senha principal).
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field
                label="E-mail da ETED"
                name="contact_email"
                defaultValue={(escola as unknown as { contact_email: string | null }).contact_email ?? ''}
                placeholder="eted.suabase@gmail.com"
              />
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Senha de app{' '}
                  <span className="font-normal text-gray-400">(deixe em branco para manter a atual)</span>
                </label>
                <input
                  name="smtp_password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="xxxx xxxx xxxx xxxx"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
            </div>
            {(escola as unknown as { contact_email: string | null }).contact_email && (
              <p className="mt-2 text-xs text-green-600 flex items-center gap-1">
                <span>●</span> E-mail configurado: {(escola as unknown as { contact_email: string }).contact_email}
              </p>
            )}
          </div>

          <div className="p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Visibilidade</h2>
            <div className="flex flex-col gap-3">
              <Toggle name="is_public" label="Página pública ativa"
                description="Aparece na listagem pública da base e a URL da escola fica acessível"
                defaultChecked={(escola as unknown as { is_public: boolean }).is_public} />
              <Toggle name="active" label="Escola ativa"
                description="Escola aparece no sistema de gestão"
                defaultChecked={escola.active ?? true} />
            </div>
          </div>

          <div className="p-5 flex justify-end gap-3">
            <Link href={`/${slug}/escolas`} className="px-5 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Cancelar
            </Link>
            <button type="submit" className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors">
              Salvar alterações
            </button>
          </div>
        </form>

        {/* Turmas */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Turmas</h2>
          </div>

          {turmas && turmas.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 mb-4">
              {turmas.map(t => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{t.name}</p>
                    <p className="text-xs text-gray-400">
                      {[t.year, t.semester ? `${t.semester}º sem.` : null].filter(Boolean).join(' · ')}
                      {t.starts_at ? ` · Início: ${new Date(t.starts_at).toLocaleDateString('pt-BR')}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {t.active ? 'Ativa' : 'Encerrada'}
                    </span>
                    <Link href={`/${slug}/escolas/${id}/turmas/${t.id}`}
                      className="text-xs font-medium text-brand-500 hover:text-brand-600 px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors">
                      Editar
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Nova turma */}
          <form action={createTurma} className="bg-white rounded-xl border border-dashed border-gray-300 p-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Nova turma</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="sm:col-span-3">
                <input name="name" required placeholder="Nome da turma (ex: ETED Julho 2026)"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <input name="year" type="number" placeholder="Ano (ex: 2026)"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              <input name="semester" type="number" min="1" max="2" placeholder="Semestre (1 ou 2)"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              <button type="submit"
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors">
                Criar turma
              </button>
            </div>
          </form>
        </section>

      </main>
    </>
  )
}

function Field({ label, name, defaultValue, placeholder, required }: {
  label: string; name: string; defaultValue?: string; placeholder?: string; required?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input name={name} defaultValue={defaultValue} placeholder={placeholder} required={required}
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
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative mt-0.5">
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
