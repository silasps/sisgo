import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { SearchBar } from '@/components/ui/SearchBar'
import { ConfirmSubmitButton } from '@/components/ui/ConfirmSubmitButton'
import { notFound, redirect } from 'next/navigation'
import { createReservation, updateReservationStatus, cancelReservation, cancelApprovedReservation, updateReservationFormSettings } from './actions'
import { getAvailableRoomsAnyDestination, createAllocation, allocateWholeRoom, cancelAllocation, type AvailableRoom } from '../hospedagem/actions'
import { getRolePreview } from '@/lib/role-preview'
import { ReservationFormSettingsEditor } from './ReservationFormSettingsEditor'
import { isManagementRole, isOperationalManager } from '@/lib/auth/permissions'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ tab?: string; msg?: string; q?: string; date_from?: string; date_to?: string }>
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

// created_at/reviewed_at têm hora de verdade (timestamptz); check-in/check-out
// só têm dia (date) — não existe horário de estadia salvo no banco.
function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default async function ReservasPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { tab = 'todas', msg, q, date_from, date_to } = await searchParams

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
    reviewed_at?: string | null
    // Presentes só em linha "sintética" — cama alocada direto em Hospedagem/
    // Pendentes, sem ter nascido de um pedido em `reservations` (ver bloco
    // abaixo). Cancelar essa linha cancela a alocação, não uma reserva.
    allocationId?: string
    allocationRoomId?: string
    allocationBedId?: string | null
    allocationNotes?: string | null
    actualCheckIn?: string | null
    actualCheckOut?: string | null
  }

  let reservations: ResRow[] = []

  if (isManagement) {
    const baseQuery = supabase.from('reservations').select('*').eq('organization_id', org.id).order('created_at', { ascending: false })
    const { data } = tab === 'espacos' ? await baseQuery.eq('type', 'espaco')
      : tab === 'quartos' ? await baseQuery.eq('type', 'quarto')
      : await baseQuery
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

  // Uma cama pode ficar ocupada sem nunca ter passado por um pedido em
  // Reservas (alocada direto no mapa de camas de Hospedagem, ou resolvida
  // via Pendentes na admissão de aluno/obreiro) — pro revisor, essas linhas
  // entram na mesma lista (o hóspede pra quem tem check-in aguardando não
  // some só porque não veio de uma "reserva" formal).
  if (isManagement || isHospitalidade) {
    let allocQuery = supabase.from('room_allocations')
      .select('id, room_id, bed_id, guest_name, guest_type, check_in, check_out, actual_check_in, actual_check_out, notes, status, created_at, rooms(name)')
      .eq('organization_id', org.id)
      .is('reservation_id', null)
      .in('status', ['confirmada', 'checkin'])
      .order('created_at', { ascending: false })
    if (tab === 'espacos') allocQuery = allocQuery.eq('id', 'no-match') // alocação de cama nunca é "espaço"
    const { data: allocRows } = await allocQuery

    const synthetic: ResRow[] = ((allocRows ?? []) as unknown as Array<{
      id: string; room_id: string; bed_id: string | null; guest_name: string; guest_type: string
      check_in: string; check_out: string; actual_check_in: string | null; actual_check_out: string | null
      notes: string | null; status: string; created_at: string
      rooms: { name: string } | null
    }>).map(a => ({
      id: `alloc-${a.id}`,
      type: 'quarto',
      title: a.guest_name,
      description: null,
      requester_type: 'person',
      starts_at: a.check_in,
      ends_at: a.check_out,
      guests_count: null,
      guests_description: a.guest_name,
      resource_description: [
        a.rooms?.name,
        a.status === 'checkin' ? 'hóspede em estadia' : 'aguardando check-in',
        'alocado direto (sem pedido formal)',
      ].filter(Boolean).join(' — '),
      final_cost: null,
      status: 'aprovada',
      review_notes: null,
      created_at: a.created_at,
      requested_by: '',
      form_answers: null,
      allocationId: a.id,
      allocationRoomId: a.room_id,
      allocationBedId: a.bed_id,
      allocationNotes: a.notes,
      actualCheckIn: a.actual_check_in,
      actualCheckOut: a.actual_check_out,
    }))

    reservations = [...reservations, ...synthetic]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  // Busca por nome da reserva (título) ou nome do hóspede/participante —
  // pra achar rápido numa lista que pode crescer bastante.
  if (q?.trim()) {
    const needle = q.trim().toLowerCase()
    reservations = reservations.filter(r =>
      r.title.toLowerCase().includes(needle) ||
      r.guests_description?.toLowerCase().includes(needle) ||
      r.description?.toLowerCase().includes(needle)
    )
  }

  // ── Histórico completo (aba própria, só gestão) ─────────────────────────────
  // Junta TODO status (não só as ativas): reservas de qualquer status +
  // alocações diretas de qualquer status (incluindo já finalizadas/
  // canceladas) — as que já têm reservation_id ficam de fora daqui pra não
  // contar duas vezes o mesmo hóspede (a reserva já representa elas).
  let historico: ResRow[] = []
  const historicoStatusDetail: Record<string, string> = {
    confirmada: 'aguardando check-in',
    checkin: 'hóspede em estadia',
    checkout: 'estadia concluída',
    cancelada: 'cancelado',
  }
  if ((isManagement || isHospitalidade) && tab === 'historico') {
    let histResQuery = supabase.from('reservations').select('*').eq('organization_id', org.id).order('created_at', { ascending: false })
    if (!isManagement) histResQuery = histResQuery.eq('type', 'quarto') // hospitalidade só vê quarto, igual na aba ativa
    if (date_from) histResQuery = histResQuery.gte('created_at', date_from)
    if (date_to) histResQuery = histResQuery.lte('created_at', `${date_to}T23:59:59`)
    const { data: histResRows } = await histResQuery

    let histAllocQuery = supabase.from('room_allocations')
      .select('id, room_id, bed_id, guest_name, guest_type, check_in, check_out, actual_check_in, actual_check_out, notes, status, created_at, rooms(name)')
      .eq('organization_id', org.id)
      .is('reservation_id', null)
      .order('created_at', { ascending: false })
    if (date_from) histAllocQuery = histAllocQuery.gte('created_at', date_from)
    if (date_to) histAllocQuery = histAllocQuery.lte('created_at', `${date_to}T23:59:59`)
    const { data: histAllocRows } = await histAllocQuery

    const histSynthetic: ResRow[] = ((histAllocRows ?? []) as unknown as Array<{
      id: string; room_id: string; bed_id: string | null; guest_name: string; guest_type: string
      check_in: string; check_out: string; actual_check_in: string | null; actual_check_out: string | null
      notes: string | null; status: string; created_at: string
      rooms: { name: string } | null
    }>).map(a => ({
      id: `alloc-${a.id}`,
      type: 'quarto',
      title: a.guest_name,
      description: null,
      requester_type: 'person',
      starts_at: a.check_in,
      ends_at: a.check_out,
      guests_count: null,
      guests_description: a.guest_name,
      resource_description: [a.rooms?.name, historicoStatusDetail[a.status], 'alocado direto (sem pedido formal)'].filter(Boolean).join(' — '),
      final_cost: null,
      status: a.status === 'cancelada' ? 'cancelada' : 'aprovada',
      review_notes: null,
      created_at: a.created_at,
      requested_by: '',
      form_answers: null,
      allocationId: a.id,
      allocationRoomId: a.room_id,
      allocationBedId: a.bed_id,
      allocationNotes: a.notes,
      actualCheckIn: a.actual_check_in,
      actualCheckOut: a.actual_check_out,
    }))

    historico = [...((histResRows ?? []) as ResRow[]), ...histSynthetic]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    if (q?.trim()) {
      const needle = q.trim().toLowerCase()
      historico = historico.filter(r =>
        r.title.toLowerCase().includes(needle) ||
        r.guests_description?.toLowerCase().includes(needle) ||
        r.description?.toLowerCase().includes(needle)
      )
    }
  }

  const kpiTotal = historico.length
  const kpiCanceladas = historico.filter(r => r.status === 'cancelada').length
  const kpiRejeitadas = historico.filter(r => r.status === 'rejeitada').length
  const kpiAprovadas = historico.filter(r => r.status === 'aprovada').length
  const kpiTaxaCancelamento = kpiTotal > 0 ? Math.round((kpiCanceladas / kpiTotal) * 100) : 0

  const displayList = tab === 'historico' ? historico : reservations
  // Histórico é relatório — só leitura, sem botão de aprovar/rejeitar/cancelar
  // (a mesma reserva continua gerenciável normalmente pelas outras abas).
  const isHistoricoView = tab === 'historico'

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
    const reservationId = formData.get('reservation_id') as string
    const costRaw = formData.get('final_cost') as string
    await updateReservationStatus(
      reservationId,
      'aprovada',
      user.id,
      (formData.get('review_notes') as string) || null,
      costRaw ? parseFloat(costRaw) : null,
    )

    // Se o revisor já escolheu quarto/cama no mesmo formulário, aloca na
    // hora — evita ter que digitar o mesmo hóspede de novo depois em
    // Hospedagem. "Não atribuir agora" (valor vazio) preserva o
    // comportamento de antes: aprova só a solicitação.
    const roomChoice = (formData.get('room_choice') as string) || ''
    if (roomChoice) {
      const [mode, roomId, bedId] = roomChoice.split(':')
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const { data: resv } = await createAdminClient().from('reservations')
        .select('title, guests_description, starts_at, ends_at')
        .eq('id', reservationId).single()
      if (resv) {
        const checkIn = resv.starts_at.split('T')[0]
        const checkOut = resv.ends_at.split('T')[0]
        const guestName = resv.guests_description?.trim() || resv.title
        if (mode === 'cama') {
          await createAllocation({
            organizationId: org.id, roomId, bedId: bedId ?? null, reservationId,
            personId: null, guestName, guestType: 'convidado',
            checkIn, checkOut, notes: null, createdBy: user.id,
          })
        } else if (mode === 'quarto') {
          await allocateWholeRoom({
            organizationId: org.id, roomId, guestName, guestType: 'convidado',
            schoolId: null, checkIn, checkOut, notes: null, createdBy: user.id,
            reservationId,
          })
        }
      }
    }

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

  const handleReviewerCancel = async (formData: FormData) => {
    'use server'
    await cancelApprovedReservation(
      formData.get('reservation_id') as string,
      org.id,
      user.id,
      (formData.get('review_notes') as string) || null,
    )
    redirect(`/${slug}/reservas?tab=${tab}`)
  }

  // Cancela uma linha "sintética" (cama alocada direto, sem reserva por
  // trás) — mesma ação já usada no detalhe do quarto em Hospedagem, só
  // acessível também aqui, que é onde o revisor está procurando.
  const handleCancelAllocationDirect = async (formData: FormData) => {
    'use server'
    await cancelAllocation({
      id: formData.get('allocation_id') as string,
      organizationId: org.id,
      bedId: (formData.get('bed_id') as string) || null,
      reason: (formData.get('reason') as string) || null,
    })
    redirect(`/${slug}/reservas?tab=${tab}`)
  }

  const isReviewer = canWrite || isHospitalidade
  const canRequest = canWrite || (!isReviewer && !!requesterId)

  // Pra cada reserva de quarto pendente, busca quarto/cama livre na janela de
  // data dela — alimenta o seletor "atribuir agora" no Aprovar (Parte 2: liga
  // aprovação de reserva à alocação de cama, em vez de digitar tudo de novo
  // depois em Hospedagem). Lista de pendentes costuma ser pequena, uma query
  // por item é aceitável aqui.
  const availableRoomsByReservation = new Map<string, AvailableRoom[]>()
  if (isReviewer) {
    for (const r of reservations) {
      if (r.type !== 'quarto' || r.status !== 'pendente') continue
      const options = await getAvailableRoomsAnyDestination({
        organizationId: org.id,
        checkIn: r.starts_at.split('T')[0],
        checkOut: r.ends_at.split('T')[0],
      })
      availableRoomsByReservation.set(r.id, options)
    }
  }

  const msgInfo: Record<string, string> = {
    criada: 'Solicitação enviada. A equipe responsável será notificada.',
    formulario_atualizado: 'Formulário de reservas atualizado.',
    campos_obrigatorios: 'Preencha todos os campos obrigatórios do formulário.',
  }

  return (
    <>
      <Header
        title="Reservas"
        actions={
          (isManagement || isHospitalidade) && (
            <Link
              href={`/${slug}/hospedagem`}
              className="text-sm text-gray-300 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              Mapa de quartos →
            </Link>
          )
        }
      />
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

        {/* Tabs — gestão vê Todas/Espaços/Quartos/Histórico; hospitalidade só
            vê quarto mesmo (sua lista já é sempre type=quarto), então o
            recorte aqui é só Ativas/Histórico. */}
        {(isManagement || isHospitalidade) && (
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            {(isManagement
              ? [['todas', 'Todas'], ['espacos', 'Espaços'], ['quartos', 'Quartos'], ['historico', 'Histórico']]
              : [['todas', 'Ativas'], ['historico', 'Histórico']]
            ).map(([key, label]) => (
              <a key={key} href={`?tab=${key}`}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                {label}
              </a>
            ))}
          </div>
        )}

        {/* Histórico: resumo + filtro de período */}
        {(isManagement || isHospitalidade) && tab === 'historico' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl border border-gray-200 p-3">
                <p className="text-xl font-bold text-gray-900">{kpiTotal}</p>
                <p className="text-[10px] text-gray-400 font-medium">Total no período</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-3">
                <p className="text-xl font-bold text-green-600">{kpiAprovadas}</p>
                <p className="text-[10px] text-gray-400 font-medium">Aprovadas</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-3">
                <p className="text-xl font-bold text-gray-500">{kpiCanceladas + kpiRejeitadas}</p>
                <p className="text-[10px] text-gray-400 font-medium">Canceladas/Rejeitadas</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-3">
                <p className="text-xl font-bold text-red-500">{kpiTaxaCancelamento}%</p>
                <p className="text-[10px] text-gray-400 font-medium">Taxa de cancelamento</p>
              </div>
            </div>

            <form className="flex flex-wrap items-end gap-2 bg-white rounded-xl border border-gray-200 p-3">
              <input type="hidden" name="tab" value="historico" />
              {q && <input type="hidden" name="q" value={q} />}
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">De</label>
                <input type="date" name="date_from" defaultValue={date_from ?? ''}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Até</label>
                <input type="date" name="date_to" defaultValue={date_to ?? ''}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <button type="submit" className="px-4 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-lg transition-colors">
                Filtrar
              </button>
              {(date_from || date_to) && (
                <a href="?tab=historico" className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5">Limpar</a>
              )}
            </form>
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
        <SearchBar placeholder="Buscar por nome da reserva ou do hóspede..." />

        {displayList.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            {q?.trim() ? `Nada encontrado para "${q}".` : tab === 'historico' ? 'Nada no período selecionado.' : isReviewer ? 'Nenhuma reserva encontrada.' : 'Você ainda não fez nenhuma solicitação.'}
          </div>
        ) : (
          <ul className="space-y-3">
            {displayList.map(r => {
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

                  <div className="text-xs text-gray-500 space-y-0.5">
                    <p className="text-gray-400">Criada em: {fmtDateTime(r.created_at)}</p>
                    {r.reviewed_at && (
                      <p className="text-gray-400">
                        {r.status === 'cancelada' ? 'Cancelada em' : r.status === 'rejeitada' ? 'Recusada em' : 'Avaliada em'}: {fmtDateTime(r.reviewed_at)}
                      </p>
                    )}
                    {r.resource_description && <p>Local: {r.resource_description}</p>}
                    {r.guests_count != null && <p>Pessoas: {r.guests_count}</p>}
                    {r.guests_description && <p>Hóspedes/participantes: {r.guests_description}</p>}
                    {formAnswers.map(answer => (
                      <p key={answer.id}>{answer.label}: {answer.value}</p>
                    ))}
                    {r.final_cost != null && (
                      <p className="text-green-700 font-medium">Custo aprovado: R$ {r.final_cost.toFixed(2)}</p>
                    )}
                    {(r.actualCheckIn || r.actualCheckOut) && (
                      <p>Check-in/checkout real: {r.actualCheckIn ? fmt(r.actualCheckIn) : '—'} → {r.actualCheckOut ? fmt(r.actualCheckOut) : '—'}</p>
                    )}
                    {r.review_notes && (
                      <p className="italic text-gray-400">
                        {r.status === 'cancelada' ? 'Motivo do cancelamento' : r.status === 'rejeitada' ? 'Motivo da recusa' : 'Nota'}: &ldquo;{r.review_notes}&rdquo;
                      </p>
                    )}
                    {r.allocationNotes && (
                      <p className="italic text-gray-400">Observações: &ldquo;{r.allocationNotes}&rdquo;</p>
                    )}
                  </div>

                  {/* Aprovar/Rejeitar (reviewer) */}
                  {isReviewer && isPending && !isHistoricoView && (
                    <div className="border-t border-gray-100 pt-3 grid sm:grid-cols-2 gap-2">
                      <form action={handleApprove} className="space-y-2">
                        <input type="hidden" name="reservation_id" value={r.id} />
                        {r.type === 'quarto' && (
                          <select name="room_choice" defaultValue=""
                            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white">
                            <option value="">Não atribuir quarto agora</option>
                            {(availableRoomsByReservation.get(r.id) ?? []).map(room => (
                              room.allocationMode === 'quarto'
                                ? (
                                  <option key={room.roomId} value={`quarto:${room.roomId}`}>
                                    {room.roomName} (quarto inteiro)
                                  </option>
                                )
                                : room.availableBeds.map(bed => (
                                  <option key={bed.id} value={`cama:${room.roomId}:${bed.id}`}>
                                    {room.roomName} — {bed.label}
                                  </option>
                                ))
                            ))}
                          </select>
                        )}
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

                  {/* Cancelar (revisor, reserva já aprovada) */}
                  {isReviewer && r.status === 'aprovada' && !r.allocationId && !isHistoricoView && (
                    <div className="border-t border-gray-100 pt-3">
                      <form action={handleReviewerCancel} className="flex flex-col sm:flex-row gap-2">
                        <input type="hidden" name="reservation_id" value={r.id} />
                        <input name="review_notes" placeholder="Motivo do cancelamento (opcional)"
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                        <ConfirmSubmitButton
                          confirmMessage={`Cancelar a reserva "${r.title}"? Essa ação não pode ser desfeita.`}
                          className="px-4 py-1.5 border border-red-200 text-red-500 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap">
                          Cancelar reserva
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  )}

                  {/* Cancelar (revisor, cama alocada direto — sem reserva por trás) */}
                  {isReviewer && r.allocationId && !isHistoricoView && (
                    <div className="border-t border-gray-100 pt-3">
                      <form action={handleCancelAllocationDirect} className="flex flex-col sm:flex-row gap-2">
                        <input type="hidden" name="allocation_id" value={r.allocationId} />
                        <input type="hidden" name="bed_id" value={r.allocationBedId ?? ''} />
                        <input name="reason" placeholder="Motivo do cancelamento (opcional)"
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                        <ConfirmSubmitButton
                          confirmMessage={`Cancelar a alocação de "${r.title}"? Essa ação não pode ser desfeita.`}
                          className="px-4 py-1.5 border border-red-200 text-red-500 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap">
                          Cancelar alocação
                        </ConfirmSubmitButton>
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
