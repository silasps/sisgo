import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { notFound, redirect } from 'next/navigation'
import { createReservation, updateReservationStatus, cancelReservation, updateReservationFormSettings } from './actions'
import { getRolePreview } from '@/lib/role-preview'
import { ReservationFormSettingsEditor } from './ReservationFormSettingsEditor'
import { isManagementRole, isOperationalManager } from '@/lib/auth/permissions'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ tab?: string; msg?: string }>
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pendente:  { label: 'Pendente',  cls: 'bg-yellow-100 text-yellow-700' },
  aprovada:  { label: 'Aprovada',  cls: 'bg-green-100 text-green-700' },
  rejeitada: { label: 'Rejeitada', cls: 'bg-red-100 text-red-600' },
  cancelada: { label: 'Cancelada', cls: 'bg-gray-100 text-gray-500' },
}

const RESERVATION_FORM_FIELDS = [
  { key: 'resource_description', defaultLabel: 'Espaço/quarto desejado', placeholder: 'Ex: Sala grande, quarto individual...' },
  { key: 'guests_count', defaultLabel: 'Nº de pessoas', placeholder: 'Ex: 2' },
  { key: 'guests_description', defaultLabel: 'Nome(s) do(s) hóspede(s) / participantes', placeholder: 'Ex: João da Silva - Missionário convidado' },
  { key: 'description', defaultLabel: 'Descrição / Motivo', placeholder: 'Contexto, finalidade, informações adicionais...' },
] as const

const CUSTOM_FIELD_TYPES = [
  { value: 'text', label: 'Aberto' },
  { value: 'textarea', label: 'Aberto longo' },
  { value: 'date', label: 'Data' },
  { value: 'number', label: 'Número' },
  { value: 'tel', label: 'Telefone' },
  { value: 'email', label: 'E-mail' },
  { value: 'boolean', label: 'Sim/Não' },
] as const

type ReservationFormFieldKey = typeof RESERVATION_FORM_FIELDS[number]['key']
type CustomFieldType = typeof CUSTOM_FIELD_TYPES[number]['value']
type ReservationFormField = { label: string; visible: boolean; required: boolean; placeholder: string }
type ReservationFormConfig = Record<ReservationFormFieldKey, ReservationFormField>
type CustomReservationField = { id: string; label: string; type: CustomFieldType; visible: boolean; required: boolean }
type ReservationFormSettings = { fixedFields: ReservationFormConfig; customFields: CustomReservationField[] }

const CUSTOM_FIELD_LIMIT = 10

function slugifyFieldId(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return normalized || 'campo'
}

function isCustomFieldType(value: string): value is CustomFieldType {
  return CUSTOM_FIELD_TYPES.some(type => type.value === value)
}

function normalizeFormSettings(raw: unknown): ReservationFormSettings {
  const source = raw && typeof raw === 'object' ? raw as Record<string, Partial<ReservationFormField>> : {}
  const fixedFields = RESERVATION_FORM_FIELDS.reduce((acc, field) => {
    const saved = source[field.key] ?? {}
    acc[field.key] = {
      label: typeof saved.label === 'string' && saved.label.trim() ? saved.label.trim() : field.defaultLabel,
      visible: typeof saved.visible === 'boolean' ? saved.visible : true,
      required: typeof saved.required === 'boolean' ? saved.required : false,
      placeholder: field.placeholder,
    }
    return acc
  }, {} as ReservationFormConfig)

  const rawCustomFields = Array.isArray(source.custom_fields) ? source.custom_fields : []
  const seen = new Set<string>()
  const customFields = rawCustomFields.flatMap((field, index) => {
    if (!field || typeof field !== 'object') return []
    const item = field as Partial<CustomReservationField>
    const label = typeof item.label === 'string' ? item.label.trim() : ''
    if (!label) return []
    const type = typeof item.type === 'string' && isCustomFieldType(item.type) ? item.type : 'text'
    const baseId = typeof item.id === 'string' && item.id.trim() ? slugifyFieldId(item.id) : slugifyFieldId(label)
    let id = baseId
    if (seen.has(id)) id = `${baseId}_${index + 1}`
    seen.add(id)
    return [{
      id,
      label,
      type,
      visible: typeof item.visible === 'boolean' ? item.visible : true,
      required: typeof item.required === 'boolean' ? item.required : false,
    }]
  }).slice(0, CUSTOM_FIELD_LIMIT)

  return { fixedFields, customFields }
}

function fmt(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

export default async function ReservasPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { tab = 'todas', msg } = await searchParams

  const supabase = await createClient()

  const [{ data: { user } }, { data: org }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('organizations').select('id').eq('slug', slug).single(),
  ])
  if (!user || !org) notFound()

  const { data: orgUser } = await supabase
    .from('organization_users')
    .select('roles(name)')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()
  const realRole        = (orgUser?.roles as unknown as { name: string } | null)?.name ?? ''
  const preview         = await getRolePreview(realRole)
  const role            = preview?.role ?? realRole
  const isManagement    = isManagementRole(role)
  const canWrite        = isOperationalManager(role)
  const isHospitalidade = role === 'hospitalidade'
  const isLiderEted     = role === 'lider_eted'
  const isObreiroEted   = role === 'obreiro_eted'
  const isAluno         = role === 'aluno'
  const isAssociado     = role === 'associado'
  const isLiderMin      = role === 'lider_ministerio'
  const isObreiro       = role === 'obreiro_ministerio'

  if (!isManagement && !isHospitalidade && !isLiderEted && !isObreiroEted && !isAluno && !isAssociado && !isLiderMin && !isObreiro) notFound()

  // ── Contexto do solicitante ──────────────────────────────────────────────────
  let requesterType: 'ministry' | 'school' | 'person' = 'person'
  let requesterId: string | null = null
  let requesterLabel = ''

  if (isLiderMin) {
    const { data: lm } = preview?.ministryId
      ? await supabase
        .from('ministries')
        .select('id, name')
        .eq('id', preview.ministryId)
        .single()
        .then(result => ({ data: result.data ? { ministry_id: result.data.id, ministries: { name: result.data.name } } : null }))
      : await supabase
        .from('ministry_leaders').select('ministry_id, ministries(name)').eq('user_id', user.id).single()
    if (lm) {
      requesterType  = 'ministry'
      requesterId    = lm.ministry_id
      requesterLabel = (lm.ministries as unknown as { name: string } | null)?.name ?? 'Ministério'
    }
  } else if (isLiderEted || isObreiroEted || isAluno) {
    const { data: sl } = preview?.schoolId
      ? await supabase
        .from('schools')
        .select('id, name')
        .eq('id', preview.schoolId)
        .single()
        .then(result => ({ data: result.data ? { school_id: result.data.id, schools: { name: result.data.name } } : null }))
      : await supabase
        .from('school_leaders').select('school_id, schools(name)').eq('user_id', user.id).single()
    if (sl) {
      requesterType  = 'school'
      requesterId    = sl.school_id
      requesterLabel = (sl.schools as unknown as { name: string } | null)?.name ?? 'Escola'
    }
  } else if (isObreiro) {
    const { data: sp } = await supabase
      .from('staff_profiles').select('person_id, people(full_name)').eq('user_id', user.id).single()
    if (sp?.person_id) {
      requesterId    = sp.person_id
      requesterLabel = (sp.people as unknown as { full_name: string } | null)?.full_name ?? 'Obreiro'
    }
  }

  // ── Para management: busca ministérios e escolas para o dropdown "Em nome de"
  type OptionItem = { id: string; name: string }
  let ministriesForForm: OptionItem[] = []
  let schoolsForForm: OptionItem[] = []

  if (isManagement) {
    const [{ data: mData }, { data: sData }] = await Promise.all([
      supabase.from('ministries').select('id, name').eq('organization_id', org.id).eq('active', true).order('name'),
      supabase.from('schools').select('id, name').eq('organization_id', org.id).order('name'),
    ])
    ministriesForForm = (mData ?? []) as OptionItem[]
    schoolsForForm    = (sData ?? []) as OptionItem[]
  }

  const { data: formSettingsRaw } = await supabase
    .from('reservation_form_settings')
    .select('fields')
    .eq('organization_id', org.id)
    .maybeSingle()

  const formSettings = normalizeFormSettings((formSettingsRaw as { fields?: unknown } | null)?.fields)
  const formConfig = formSettings.fixedFields
  const customFields = formSettings.customFields

  // ── Fetch reservas ───────────────────────────────────────────────────────────
  type ResRow = {
    id: string; type: string; title: string; description: string | null
    requester_type: string; starts_at: string; ends_at: string
    guests_count: number | null; guests_description: string | null
    resource_description: string | null
    final_cost: number | null; status: string
    review_notes: string | null; created_at: string
    requested_by: string
    form_answers: Array<{ id: string; label: string; type: string; value: string }> | null
  }

  let reservations: ResRow[] = []

  if (isManagement) {
    const q = supabase.from('reservations').select('*').eq('organization_id', org.id).order('created_at', { ascending: false })
    const { data } = tab === 'espacos' ? await q.eq('type', 'espaco')
      : tab === 'quartos' ? await q.eq('type', 'quarto')
      : await q
    reservations = (data ?? []) as ResRow[]
  } else if (isHospitalidade) {
    const { data } = await supabase.from('reservations').select('*')
      .eq('organization_id', org.id).eq('type', 'quarto').order('created_at', { ascending: false })
    reservations = (data ?? []) as ResRow[]
  } else {
    const { data } = await supabase.from('reservations').select('*')
      .eq('organization_id', org.id).eq('requested_by', user.id).order('created_at', { ascending: false })
    reservations = (data ?? []) as ResRow[]
  }

  // ── Server actions ───────────────────────────────────────────────────────────

  const handleCreate = async (formData: FormData) => {
    'use server'
    const type  = formData.get('type') as 'espaco' | 'quarto'
    const title = (formData.get('title') as string).trim()
    if (!title) return

    const missingRequired = RESERVATION_FORM_FIELDS.some(field => {
      const config = formConfig[field.key]
      if (!config.visible || !config.required) return false
      return !String(formData.get(field.key) ?? '').trim()
    }) || customFields.some(field => {
      if (!field.visible || !field.required) return false
      return !String(formData.get(`custom_${field.id}`) ?? '').trim()
    })
    if (missingRequired) redirect(`/${slug}/reservas?msg=campos_obrigatorios`)

    const formAnswers = customFields
      .filter(field => field.visible)
      .map(field => ({
        id: field.id,
        label: field.label,
        type: field.type,
        value: String(formData.get(`custom_${field.id}`) ?? '').trim(),
      }))
      .filter(answer => answer.value)

    let finalRequesterType: 'ministry' | 'school' | 'person' = requesterType
    let finalRequesterId = requesterId

    // Management seleciona a entidade via "requester_ref" (ex: "ministry:uuid")
    const requesterRef = formData.get('requester_ref') as string | null
    if (requesterRef && requesterRef.includes(':')) {
      const colonIdx = requesterRef.indexOf(':')
      const refType  = requesterRef.slice(0, colonIdx)
      const refId    = requesterRef.slice(colonIdx + 1)
      if (refType === 'ministry') { finalRequesterType = 'ministry'; finalRequesterId = refId }
      else if (refType === 'school') { finalRequesterType = 'school'; finalRequesterId = refId }
    }

    if (!finalRequesterId) return

    await createReservation({
      organizationId:      org.id,
      type,
      title,
      description:         (formData.get('description') as string) || null,
      requesterType:       finalRequesterType,
      requesterId:         finalRequesterId,
      requestedBy:         user.id,
      startsAt:            formData.get('starts_at') as string,
      endsAt:              formData.get('ends_at') as string,
      resourceDescription: (formData.get('resource_description') as string) || null,
      guestsCount:         formData.get('guests_count') ? Number(formData.get('guests_count')) : null,
      guestsDescription:   (formData.get('guests_description') as string) || null,
      formAnswers,
    })
    redirect(`/${slug}/reservas?msg=criada`)
  }

  const handleUpdateFormSettings = async (formData: FormData) => {
    'use server'
    if (!canWrite && !isHospitalidade) return

    const fields = RESERVATION_FORM_FIELDS.reduce((acc, field) => {
      const label = String(formData.get(`${field.key}_label`) ?? '').trim()
      acc[field.key] = {
        label: label || field.defaultLabel,
        visible: formData.get(`${field.key}_visible`) === 'on',
        required: formData.get(`${field.key}_required`) === 'on',
      }
      return acc
    }, {} as Record<string, unknown>)

    const custom_fields = Array.from({ length: CUSTOM_FIELD_LIMIT }, (_, index) => {
      const previousId = String(formData.get(`custom_field_${index}_id`) ?? '').trim()
      const label = String(formData.get(`custom_field_${index}_label`) ?? '').trim()
      const rawType = String(formData.get(`custom_field_${index}_type`) ?? 'text')
      if (!label) return null
      return {
        id: previousId.startsWith('novo_') ? `${slugifyFieldId(label)}_${index + 1}` : slugifyFieldId(previousId || label),
        label,
        type: isCustomFieldType(rawType) ? rawType : 'text',
        visible: formData.get(`custom_field_${index}_visible`) === 'on',
        required: formData.get(`custom_field_${index}_required`) === 'on',
      }
    }).filter(Boolean)

    fields.custom_fields = custom_fields

    await updateReservationFormSettings({
      organizationId: org.id,
      fields,
      updatedBy: user.id,
    })
    redirect(`/${slug}/reservas?msg=formulario_atualizado`)
  }

  const handleApprove = async (formData: FormData) => {
    'use server'
    const costRaw = formData.get('final_cost') as string
    await updateReservationStatus(
      formData.get('reservation_id') as string,
      'aprovada',
      user.id,
      (formData.get('review_notes') as string) || null,
      costRaw ? parseFloat(costRaw) : null,
    )
    redirect(`/${slug}/reservas?tab=${tab}`)
  }

  const handleReject = async (formData: FormData) => {
    'use server'
    await updateReservationStatus(
      formData.get('reservation_id') as string,
      'rejeitada',
      user.id,
      (formData.get('review_notes') as string) || null,
      null,
    )
    redirect(`/${slug}/reservas?tab=${tab}`)
  }

  const handleCancel = async (formData: FormData) => {
    'use server'
    await cancelReservation(formData.get('reservation_id') as string, user.id)
    redirect(`/${slug}/reservas`)
  }

  const isReviewer = canWrite || isHospitalidade
  const canRequest = canWrite || (!isReviewer && !!requesterId)

  const msgInfo: Record<string, string> = {
    criada: 'Solicitação enviada. A equipe responsável será notificada.',
    formulario_atualizado: 'Formulário de reservas atualizado.',
    campos_obrigatorios: 'Preencha todos os campos obrigatórios do formulário.',
  }

  return (
    <>
      <Header title="Reservas" />
      <main className="p-4 md:p-6 space-y-6 max-w-3xl">

        {msg && msgInfo[msg] && (
          <div className="border rounded-lg px-4 py-3 text-sm bg-blue-50 border-blue-200 text-blue-700">
            {msgInfo[msg]}
          </div>
        )}

        {(canWrite || isHospitalidade) && (
          <ReservationFormSettingsEditor
            action={handleUpdateFormSettings}
            fixedFields={RESERVATION_FORM_FIELDS.map(field => ({
              key: field.key,
              defaultLabel: field.defaultLabel,
              label: formConfig[field.key].label,
              visible: formConfig[field.key].visible,
              required: formConfig[field.key].required,
            }))}
            customFields={customFields}
            limit={CUSTOM_FIELD_LIMIT}
          />
        )}

        {/* Tabs (management) */}
        {isManagement && (
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            {[['todas', 'Todas'], ['espacos', 'Espaços'], ['quartos', 'Quartos']].map(([key, label]) => (
              <a key={key} href={`?tab=${key}`}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                {label}
              </a>
            ))}
          </div>
        )}

        {/* Formulário de nova reserva — colapsado atrás de um botão "+", igual ao padrão de Solicitações */}
        {canRequest && (
          <details className="group bg-white rounded-xl border border-gray-200 overflow-hidden [&_summary::-webkit-details-marker]:hidden">
            <summary className="cursor-pointer list-none px-5 py-3 flex items-center justify-between text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <span className="flex items-center gap-2">
                <span className="text-brand-500 font-semibold">+</span> Nova reserva
                {!canWrite && requesterLabel && <span className="text-xs text-gray-400 font-normal">({requesterLabel})</span>}
              </span>
              <span className="text-xs text-gray-400 group-open:hidden">abrir</span>
              <span className="hidden text-xs text-gray-400 group-open:inline">fechar</span>
            </summary>
            <form action={handleCreate} className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                {/* Management: seleciona a entidade solicitante */}
                {canWrite && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Em nome de *</label>
                    <select name="requester_ref" required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                      <option value="">Selecione a entidade solicitante...</option>
                      {ministriesForForm.length > 0 && (
                        <optgroup label="Ministérios">
                          {ministriesForForm.map(m => (
                            <option key={m.id} value={`ministry:${m.id}`}>{m.name}</option>
                          ))}
                        </optgroup>
                      )}
                      {schoolsForForm.length > 0 && (
                        <optgroup label="Escolas">
                          {schoolsForForm.map(s => (
                            <option key={s.id} value={`school:${s.id}`}>{s.name}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                  <select name="type" required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                    {!isObreiro && <option value="espaco">Espaço (evento, reunião)</option>}
                    <option value="quarto">Quarto (hóspede/visitante)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Título / Evento *</label>
                  <input name="title" required placeholder="Ex: Reunião de avaliação"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Data de início *</label>
                  <input name="starts_at" type="date" required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Data de fim / saída *</label>
                  <input name="ends_at" type="date" required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
                {formConfig.resource_description.visible && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {formConfig.resource_description.label}{formConfig.resource_description.required && ' *'}
                    </label>
                    <input name="resource_description" required={formConfig.resource_description.required} placeholder={formConfig.resource_description.placeholder}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                  </div>
                )}
                {formConfig.guests_count.visible && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {formConfig.guests_count.label}{formConfig.guests_count.required && ' *'}
                    </label>
                    <input name="guests_count" type="number" min="1" required={formConfig.guests_count.required} placeholder={formConfig.guests_count.placeholder}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                  </div>
                )}
                {formConfig.guests_description.visible && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {formConfig.guests_description.label}{formConfig.guests_description.required && ' *'}
                    </label>
                    <input name="guests_description" required={formConfig.guests_description.required} placeholder={formConfig.guests_description.placeholder}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                  </div>
                )}
                {formConfig.description.visible && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {formConfig.description.label}{formConfig.description.required && ' *'}
                    </label>
                    <textarea name="description" rows={2} required={formConfig.description.required} placeholder={formConfig.description.placeholder}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none" />
                  </div>
                )}
                {customFields.filter(field => field.visible).map(field => {
                  const fieldName = `custom_${field.id}`
                  const label = `${field.label}${field.required ? ' *' : ''}`

                  if (field.type === 'textarea') {
                    return (
                      <div key={field.id} className="sm:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                        <textarea name={fieldName} rows={2} required={field.required}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none" />
                      </div>
                    )
                  }

                  if (field.type === 'boolean') {
                    return (
                      <div key={field.id}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                        <select name={fieldName} required={field.required}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                          <option value="">Selecione...</option>
                          <option value="Sim">Sim</option>
                          <option value="Não">Não</option>
                        </select>
                      </div>
                    )
                  }

                  return (
                    <div key={field.id}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                      <input name={fieldName} type={field.type} required={field.required}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                    </div>
                  )
                })}
              </div>
              <button type="submit"
                className="w-full px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors">
                Enviar Solicitação
              </button>
            </form>
          </details>
        )}

        {/* Lista de reservas */}
        {reservations.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            {isReviewer ? 'Nenhuma reserva encontrada.' : 'Você ainda não fez nenhuma solicitação.'}
          </div>
        ) : (
          <ul className="space-y-3">
            {reservations.map(r => {
              const st       = STATUS_LABELS[r.status] ?? STATUS_LABELS.pendente
              const typeLabel = r.type === 'espaco' ? 'Espaço' : 'Quarto'
              const isPending = r.status === 'pendente'
              const formAnswers = Array.isArray(r.form_answers) ? r.form_answers.filter(answer => answer.value) : []
              return (
                <li key={r.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {typeLabel}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.cls}`}>
                          {st.label}
                        </span>
                      </div>
                      <p className="font-medium text-gray-900">{r.title}</p>
                      {r.description && <p className="text-sm text-gray-500 mt-0.5">{r.description}</p>}
                    </div>
                    <p className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                      {fmt(r.starts_at)} → {fmt(r.ends_at)}
                    </p>
                  </div>

                  {(r.resource_description || r.guests_count || r.guests_description || formAnswers.length > 0 || r.final_cost != null || r.review_notes) && (
                    <div className="text-xs text-gray-500 space-y-0.5">
                      {r.resource_description && <p>Local: {r.resource_description}</p>}
                      {r.guests_count != null && <p>Pessoas: {r.guests_count}</p>}
                      {r.guests_description && <p>Hóspedes/participantes: {r.guests_description}</p>}
                      {formAnswers.map(answer => (
                        <p key={answer.id}>{answer.label}: {answer.value}</p>
                      ))}
                      {r.final_cost != null && (
                        <p className="text-green-700 font-medium">Custo aprovado: R$ {r.final_cost.toFixed(2)}</p>
                      )}
                      {r.review_notes && (
                        <p className="italic text-gray-400">&ldquo;{r.review_notes}&rdquo;</p>
                      )}
                    </div>
                  )}

                  {/* Aprovar/Rejeitar (reviewer) */}
                  {isReviewer && isPending && (
                    <div className="border-t border-gray-100 pt-3 grid sm:grid-cols-2 gap-2">
                      <form action={handleApprove} className="space-y-2">
                        <input type="hidden" name="reservation_id" value={r.id} />
                        <input name="final_cost" type="number" step="0.01" placeholder="Custo R$ (opcional)"
                          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                        <input name="review_notes" placeholder="Nota (opcional)"
                          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                        <button type="submit"
                          className="w-full px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-lg transition-colors">
                          Aprovar
                        </button>
                      </form>
                      <form action={handleReject} className="space-y-2">
                        <input type="hidden" name="reservation_id" value={r.id} />
                        <input name="review_notes" placeholder="Motivo da recusa (opcional)"
                          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                        <button type="submit"
                          className="w-full px-4 py-1.5 border border-red-200 text-red-500 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors">
                          Rejeitar
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Cancelar (solicitante) */}
                  {!isReviewer && isPending && r.requested_by === user.id && (
                    <div className="border-t border-gray-100 pt-2">
                      <form action={handleCancel}>
                        <input type="hidden" name="reservation_id" value={r.id} />
                        <button type="submit" className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                          Cancelar solicitação
                        </button>
                      </form>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </>
  )
}
