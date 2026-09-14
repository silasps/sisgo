'use server'

import { createAdminClient } from '@/lib/supabase/admin'

// ── Resolução de pendências de hospedagem (obreiro/aluno) ──────────────────────

export type AvailableRoom = {
  roomId: string
  roomName: string
  blockName: string | null
  floorName: string | null
  defaultMode: 'cama' | 'quarto' // padrão sugerido do quarto — não trava mais a oferta, ver getAvailableRoomsInternal
  wholeRoomAvailable: boolean // 100% das camas ativas livres na janela — pode coexistir com availableBeds não-vazio
  availableBeds: { id: string; label: string }[]
  totalBeds: number // pra decidir se uma família cabe no quarto inteiro
  genderConstraint: string | null
}

// Quartos com vaga real na janela de datas pedida — reaproveita a mesma regra
// de sobreposição já usada em ReservationTimeline (check_in < checkOut E check_out > checkIn).
export async function getAvailableRooms(params: {
  organizationId: string
  guestType: 'obreiro' | 'aluno'
  checkIn: string
  checkOut: string
}): Promise<AvailableRoom[]> {
  return getAvailableRoomsInternal({ ...params, destinations: [params.guestType] })
}

// Mesma disponibilidade, sem restringir por destino do quarto — usado pela
// aprovação de reserva ad-hoc (Reservas), onde o hóspede não é
// necessariamente aluno/obreiro (pode ser visita) e o revisor está
// escolhendo manualmente, então não faz sentido esconder opção nenhuma.
export async function getAvailableRoomsAnyDestination(params: {
  organizationId: string
  checkIn: string
  checkOut: string
}): Promise<AvailableRoom[]> {
  return getAvailableRoomsInternal({ ...params, destinations: null })
}

async function getAvailableRoomsInternal(params: {
  organizationId: string
  destinations: Array<'obreiro' | 'aluno' | 'visita'> | null
  checkIn: string
  checkOut: string
}): Promise<AvailableRoom[]> {
  const sb = createAdminClient()

  let roomsQuery = sb
    .from('rooms')
    .select('id, name, capacity, allocation_mode, gender_constraint, destination, floors(name, blocks(name))')
    .eq('organization_id', params.organizationId)
    .eq('status', 'ativo')
    .order('display_order', { ascending: true })
  if (params.destinations) roomsQuery = roomsQuery.in('destination', params.destinations)
  const { data: rooms } = await roomsQuery

  const roomList = (rooms ?? []) as unknown as Array<{
    id: string; name: string; capacity: number; allocation_mode: 'cama' | 'quarto'; gender_constraint: string | null
    floors: { name: string; blocks: { name: string } | null } | null
  }>
  if (roomList.length === 0) return []

  const roomIds = roomList.map(r => r.id)

  const { data: overlapping } = await sb
    .from('room_allocations')
    .select('room_id, bed_id')
    .eq('organization_id', params.organizationId)
    .in('room_id', roomIds)
    .neq('status', 'cancelada')
    .lt('check_in', params.checkOut)
    .gt('check_out', params.checkIn)

  const occupiedRoomIds = new Set<string>()
  const occupiedBedIds = new Set<string>()
  for (const a of (overlapping ?? []) as Array<{ room_id: string; bed_id: string | null }>) {
    occupiedRoomIds.add(a.room_id)
    if (a.bed_id) occupiedBedIds.add(a.bed_id)
  }

  // Busca camas de TODO quarto (não só os de modo "cama") — o modo agora é
  // só uma sugestão de UI, não trava mais quais quartos podem virar "quarto
  // inteiro" ou oferecer camas avulsas: isso é decidido pela ocupação real.
  const { data: beds } = await sb.from('beds')
    .select('id, room_id, label, status')
    .in('room_id', roomIds)
    .neq('status', 'manutencao')
  const totalBedsByRoom = new Map<string, number>()
  const bedsByRoom = new Map<string, { id: string; label: string }[]>()
  for (const b of (beds ?? []) as Array<{ id: string; room_id: string; label: string; status: string }>) {
    totalBedsByRoom.set(b.room_id, (totalBedsByRoom.get(b.room_id) ?? 0) + 1)
    if (b.status === 'disponivel' && !occupiedBedIds.has(b.id)) {
      bedsByRoom.set(b.room_id, [...(bedsByRoom.get(b.room_id) ?? []), { id: b.id, label: b.label }])
    }
  }

  const result: AvailableRoom[] = []
  for (const r of roomList) {
    const totalBeds = totalBedsByRoom.get(r.id) ?? 0
    const availableBeds = bedsByRoom.get(r.id) ?? []
    const wholeRoomAvailable = totalBeds > 0 && !occupiedRoomIds.has(r.id)
    if (wholeRoomAvailable || availableBeds.length > 0) {
      result.push({
        roomId: r.id, roomName: r.name,
        blockName: r.floors?.blocks?.name ?? null, floorName: r.floors?.name ?? null,
        defaultMode: r.allocation_mode,
        wholeRoomAvailable, availableBeds, totalBeds, genderConstraint: r.gender_constraint,
      })
    }
  }
  return result
}

export type HospedagemKpis = {
  totalRooms: number
  occupiedBeds: number
  availableBeds: number
  arrivalsToday: number
  departuresToday: number
}

// Mesmos números do dashboard de Hospedagem (/hospedagem) — reusa a mesma
// regra ali (só conta cama de quarto em modo "cama" pra disponibilidade,
// quarto "inteiro" é alocado de uma vez só) pra não mostrar um número
// diferente aqui na tela de alocação de pendências.
export async function getHospedagemKpis(organizationId: string): Promise<HospedagemKpis> {
  const sb = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [{ data: rooms }, { data: beds }, { data: allocs }] = await Promise.all([
    sb.from('rooms').select('id, allocation_mode').eq('organization_id', organizationId).neq('status', 'inativo'),
    sb.from('beds').select('id, room_id, status').eq('organization_id', organizationId),
    sb.from('room_allocations').select('bed_id, check_in, check_out')
      .eq('organization_id', organizationId).in('status', ['confirmada', 'checkin']),
  ])

  const roomList = (rooms ?? []) as Array<{ id: string; allocation_mode: string }>
  const bedList = (beds ?? []) as Array<{ id: string; room_id: string; status: string }>
  const allocList = (allocs ?? []) as Array<{ bed_id: string | null; check_in: string; check_out: string }>

  const camaRoomIds = new Set(roomList.filter(r => r.allocation_mode === 'cama').map(r => r.id))
  const activeBeds = bedList.filter(b => b.status !== 'manutencao' && camaRoomIds.has(b.room_id))
  const bedsOccupiedToday = new Set(
    allocList.filter(a => a.bed_id && a.check_in <= today && a.check_out > today).map(a => a.bed_id),
  )

  return {
    totalRooms: roomList.length,
    occupiedBeds: bedsOccupiedToday.size,
    availableBeds: activeBeds.length - bedsOccupiedToday.size,
    arrivalsToday: allocList.filter(a => a.check_in === today).length,
    departuresToday: allocList.filter(a => a.check_out === today).length,
  }
}

async function markServiceRequestResolved(requestId: string, reviewedBy: string) {
  const sb = createAdminClient()
  await sb.from('service_requests').update({
    status: 'resolvido',
    reviewed_by: reviewedBy,
    reviewed_at: new Date().toISOString(),
  }).eq('id', requestId)
}

export async function resolverHospedagemComAlocacao(params: {
  requestId: string
  organizationId: string
  roomId: string
  bedId: string | null
  personId: string | null
  guestName: string
  guestType: 'obreiro' | 'aluno'
  checkIn: string
  checkOut: string
  reviewedBy: string
}) {
  await createAllocation({
    organizationId: params.organizationId,
    roomId: params.roomId,
    bedId: params.bedId,
    reservationId: null,
    personId: params.personId,
    guestName: params.guestName,
    guestType: params.guestType,
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    notes: null,
    createdBy: params.reviewedBy,
  })
  await markServiceRequestResolved(params.requestId, params.reviewedBy)
}

// Igual a resolverHospedagemComAlocacao, mas pro caso de família: usa
// allocateWholeRoom (uma linha por cama) em vez do createAllocation(bedId:
// null) do path de cama avulsa — mantém o mesmo modelo de ocupação por cama
// usado no resto da tela de Hospedagem (status de cama, check-in/checkout).
export async function resolverHospedagemComAlocacaoQuarto(params: {
  requestId: string
  organizationId: string
  roomId: string
  guestName: string
  guestType: 'obreiro' | 'aluno'
  checkIn: string
  checkOut: string
  reviewedBy: string
}) {
  await allocateWholeRoom({
    organizationId: params.organizationId,
    roomId: params.roomId,
    guestName: params.guestName,
    guestType: params.guestType,
    schoolId: null,
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    notes: null,
    createdBy: params.reviewedBy,
  })
  await markServiceRequestResolved(params.requestId, params.reviewedBy)
}


// ── Blocos e Andares ────────────────────────────────────────────────────────
// Hierarquia real: Bloco > Andar > Quarto > Cama. Andar carrega um público/
// gênero *padrão* (só pré-preenche o formulário de quarto novo — não trava
// nem é reaplicado depois); cada quarto pode sobrescrever à vontade.

export async function createBlock(data: { organizationId: string; name: string; createdBy: string }) {
  const sb = createAdminClient()
  const { error } = await sb.from('blocks').insert({
    organization_id: data.organizationId,
    name: data.name,
    created_by: data.createdBy,
  })
  if (error) throw new Error(error.message)
}

export async function updateBlock(data: { id: string; organizationId: string; name: string }) {
  const sb = createAdminClient()
  const { error } = await sb.from('blocks')
    .update({ name: data.name })
    .eq('id', data.id).eq('organization_id', data.organizationId)
  if (error) throw new Error(error.message)
}

// Bloqueia a exclusão em cascata se sobrar hóspede com estadia ativa em
// algum quarto da área (bloco/andar/quarto) — isso a cascata não deveria
// levar junto silenciosamente, mesmo com o usuário já tendo confirmado.
async function assertNoActiveAllocations(sb: ReturnType<typeof createAdminClient>, roomIds: string[]) {
  if (roomIds.length === 0) return
  const { count } = await sb.from('room_allocations')
    .select('id', { count: 'exact', head: true })
    .in('room_id', roomIds)
    .in('status', ['confirmada', 'checkin'])
  if ((count ?? 0) > 0) throw new Error('Tem hóspede alocado em algum quarto dessa área — resolva a alocação antes de apagar.')
}

export async function deleteBlock(data: { id: string; organizationId: string }) {
  const sb = createAdminClient()

  const { data: floors } = await sb.from('floors').select('id')
    .eq('block_id', data.id).eq('organization_id', data.organizationId)
  const floorIds = (floors ?? []).map(f => f.id)

  if (floorIds.length > 0) {
    const { data: rooms } = await sb.from('rooms').select('id')
      .in('floor_id', floorIds).eq('organization_id', data.organizationId)
    const roomIds = (rooms ?? []).map(r => r.id)
    await assertNoActiveAllocations(sb, roomIds)
    // beds e room_allocations têm ON DELETE CASCADE a partir de rooms —
    // apagar os quartos já leva tudo isso junto.
    if (roomIds.length > 0) await sb.from('rooms').delete().in('id', roomIds)
    await sb.from('floors').delete().in('id', floorIds)
  }

  const { error } = await sb.from('blocks').delete().eq('id', data.id).eq('organization_id', data.organizationId)
  if (error) throw new Error(error.message)
}

export async function createFloor(data: {
  organizationId: string
  blockId: string
  name: string
  destination: string | null
  genderConstraint: string | null
  createdBy: string
}) {
  const sb = createAdminClient()
  const { error } = await sb.from('floors').insert({
    organization_id: data.organizationId,
    block_id: data.blockId,
    name: data.name,
    destination: data.destination,
    gender_constraint: data.genderConstraint,
    created_by: data.createdBy,
  })
  if (error) throw new Error(error.message)
}

export async function updateFloor(data: {
  id: string
  organizationId: string
  name: string
  destination: string | null
  genderConstraint: string | null
}) {
  const sb = createAdminClient()
  const { error } = await sb.from('floors')
    .update({ name: data.name, destination: data.destination, gender_constraint: data.genderConstraint })
    .eq('id', data.id).eq('organization_id', data.organizationId)
  if (error) throw new Error(error.message)
}

export async function deleteFloor(data: { id: string; organizationId: string }) {
  const sb = createAdminClient()

  const { data: rooms } = await sb.from('rooms').select('id')
    .eq('floor_id', data.id).eq('organization_id', data.organizationId)
  const roomIds = (rooms ?? []).map(r => r.id)
  await assertNoActiveAllocations(sb, roomIds)
  if (roomIds.length > 0) await sb.from('rooms').delete().in('id', roomIds)

  const { error } = await sb.from('floors').delete().eq('id', data.id).eq('organization_id', data.organizationId)
  if (error) throw new Error(error.message)
}

// ── Holds (reserva de bloco/andar inteiro) ──────────────────────────────────
// Só um bloqueio/aviso — "Reservado pro Grupo X, de tal a tal data". Não
// aloca cama nenhuma sozinho; a distribuição cama a cama continua vindo de
// createAllocation/allocateWholeRoom, sem relação direta com isso.

export async function createHold(data: {
  organizationId: string
  scope: 'block' | 'floor' | 'room'
  blockId: string
  floorId: string | null
  roomId: string | null
  groupName: string
  startsAt: string
  endsAt: string
  notes: string | null
  createdBy: string
}) {
  const sb = createAdminClient()
  const { error } = await sb.from('space_holds').insert({
    organization_id: data.organizationId,
    scope: data.scope,
    block_id: data.blockId,
    floor_id: data.scope === 'floor' ? data.floorId : null,
    room_id: data.scope === 'room' ? data.roomId : null,
    group_name: data.groupName,
    starts_at: data.startsAt,
    ends_at: data.endsAt,
    notes: data.notes,
    created_by: data.createdBy,
  })
  if (error) throw new Error(error.message)
}

export async function cancelHold(data: { id: string; organizationId: string; reason: string | null }) {
  const sb = createAdminClient()
  const { error } = await sb.from('space_holds').update({
    status: 'cancelado',
    cancel_reason: data.reason,
    cancelled_at: new Date().toISOString(),
  }).eq('id', data.id).eq('organization_id', data.organizationId)
  if (error) throw new Error(error.message)
}

// ── Rooms ────────────────────────────────────────────────────────────────────

export async function createRoom(data: {
  organizationId: string
  name: string
  floorId: string
  type: string
  genderConstraint: string | null
  destination: string
  allocationMode: string
  notes: string | null
  createdBy: string
}) {
  const sb = createAdminClient()
  const { error } = await sb.from('rooms').insert({
    organization_id:   data.organizationId,
    name:              data.name,
    floor_id:          data.floorId,
    type:              data.type,
    gender_constraint: data.genderConstraint,
    destination:       data.destination,
    allocation_mode:   data.allocationMode,
    capacity:          0,
    notes:             data.notes,
    created_by:        data.createdBy,
  })
  if (error) throw new Error(error.message)
}

export async function updateRoom(data: {
  id: string
  organizationId: string
  name: string
  floorId: string
  type: string
  genderConstraint: string | null
  destination: string
  allocationMode: string
  status: string
  notes: string | null
}) {
  const sb = createAdminClient()
  const { error } = await sb.from('rooms').update({
    name:              data.name,
    floor_id:          data.floorId,
    type:              data.type,
    gender_constraint: data.genderConstraint,
    destination:       data.destination,
    allocation_mode:   data.allocationMode,
    status:            data.status,
    notes:             data.notes,
    updated_at:        new Date().toISOString(),
  }).eq('id', data.id).eq('organization_id', data.organizationId)
  if (error) throw new Error(error.message)
}

export async function deleteRoom(data: { id: string; organizationId: string }) {
  const sb = createAdminClient()
  await assertNoActiveAllocations(sb, [data.id])
  // beds tem ON DELETE CASCADE a partir de rooms — apagar o quarto já leva
  // as camas cadastradas nele junto.
  const { error } = await sb.from('rooms').delete().eq('id', data.id).eq('organization_id', data.organizationId)
  if (error) throw new Error(error.message)
}

// ── Beds ─────────────────────────────────────────────────────────────────────

export async function createBed(data: {
  roomId: string
  organizationId: string
  label: string
  type: string
  notes: string | null
}) {
  const sb = createAdminClient()
  const { error } = await sb.from('beds').insert({
    room_id:         data.roomId,
    organization_id: data.organizationId,
    label:           data.label,
    type:            data.type,
    notes:           data.notes,
  })
  if (error) throw new Error(error.message)
  await syncRoomCapacity(data.roomId, data.organizationId)
}

export async function updateBed(data: {
  id: string
  organizationId: string
  label: string
  type: string
  status: string
  notes: string | null
}) {
  const sb = createAdminClient()
  const { error } = await sb.from('beds').update({
    label:      data.label,
    type:       data.type,
    status:     data.status,
    notes:      data.notes,
    updated_at: new Date().toISOString(),
  }).eq('id', data.id).eq('organization_id', data.organizationId)
  if (error) throw new Error(error.message)
}

export async function removeBed(data: {
  id: string
  roomId: string
  organizationId: string
}) {
  const sb = createAdminClient()
  const { error } = await sb.from('beds')
    .delete()
    .eq('id', data.id)
    .eq('organization_id', data.organizationId)
  if (error) throw new Error(error.message)
  await syncRoomCapacity(data.roomId, data.organizationId)
}

async function syncRoomCapacity(roomId: string, organizationId: string) {
  const sb = createAdminClient()
  const { count } = await sb.from('beds')
    .select('*', { count: 'exact', head: true })
    .eq('room_id', roomId)
    .eq('organization_id', organizationId)
    .neq('status', 'manutencao')
  await sb.from('rooms').update({
    capacity:   count ?? 0,
    updated_at: new Date().toISOString(),
  }).eq('id', roomId).eq('organization_id', organizationId)
}

// ── Allocations ──────────────────────────────────────────────────────────────

export async function createAllocation(data: {
  organizationId: string
  roomId: string
  bedId: string | null
  reservationId: string | null
  personId: string | null
  guestName: string
  guestType: string
  checkIn: string
  checkOut: string
  notes: string | null
  createdBy: string
}) {
  const sb = createAdminClient()
  const { error } = await sb.from('room_allocations').insert({
    organization_id: data.organizationId,
    room_id:         data.roomId,
    bed_id:          data.bedId,
    reservation_id:  data.reservationId,
    person_id:       data.personId,
    guest_name:      data.guestName,
    guest_type:      data.guestType,
    check_in:        data.checkIn,
    check_out:       data.checkOut,
    notes:           data.notes,
    created_by:      data.createdBy,
  })
  if (error) throw new Error(error.message)

  if (data.bedId) {
    const now = new Date()
    const checkInDate = new Date(data.checkIn + 'T00:00:00')
    const hoursUntil = (checkInDate.getTime() - now.getTime()) / 3_600_000
    const { data: orgRow } = await sb.from('organizations')
      .select('hospedagem_advance_hours').eq('id', data.organizationId).single()
    const advanceHours = (orgRow as { hospedagem_advance_hours?: number } | null)?.hospedagem_advance_hours ?? 120
    const bedStatus = hoursUntil <= 0 ? 'ocupada' : hoursUntil <= advanceHours ? 'reservada' : 'disponivel'
    if (bedStatus !== 'disponivel') {
      await sb.from('beds').update({
        status: bedStatus,
        updated_at: new Date().toISOString(),
      }).eq('id', data.bedId).eq('organization_id', data.organizationId)
    }
  }
}

export async function updateAllocationStatus(data: {
  id: string
  organizationId: string
  status: 'checkin' | 'checkout' | 'cancelada'
  bedId: string | null
}) {
  const sb = createAdminClient()
  const now = new Date().toISOString()
  const today = now.split('T')[0]

  const updates: Record<string, unknown> = {
    status: data.status,
    updated_at: now,
  }
  if (data.status === 'checkin') updates.actual_check_in = today
  if (data.status === 'checkout') updates.actual_check_out = today

  const { error } = await sb.from('room_allocations')
    .update(updates)
    .eq('id', data.id)
    .eq('organization_id', data.organizationId)
  if (error) throw new Error(error.message)

  if (data.bedId && (data.status === 'checkout' || data.status === 'cancelada')) {
    await sb.from('beds').update({
      status: 'disponivel',
      updated_at: now,
    }).eq('id', data.bedId).eq('organization_id', data.organizationId)
  }
}

export async function cancelAllocation(data: {
  id: string
  organizationId: string
  bedId: string | null
  reason?: string | null
}) {
  // Motivo do cancelamento não tem coluna própria — junta na `notes` já
  // existente, marcado, pra não perder o que já estava anotado ali.
  if (data.reason?.trim()) {
    const sb = createAdminClient()
    const { data: current } = await sb.from('room_allocations').select('notes').eq('id', data.id).single()
    const tag = `[Cancelado] ${data.reason.trim()}`
    const notes = current?.notes ? `${current.notes}\n${tag}` : tag
    await sb.from('room_allocations').update({ notes }).eq('id', data.id).eq('organization_id', data.organizationId)
  }

  return updateAllocationStatus({
    id: data.id,
    organizationId: data.organizationId,
    status: 'cancelada',
    bedId: data.bedId,
  })
}

// ── Whole-room allocation (visitas, alunos/ETED) ─────────────────────────────

// Antes só quartos travados permanentemente em modo "quarto" chegavam aqui
// (a UI garantia isso). Agora que qualquer quarto 100% livre pode virar
// "quarto inteiro" sob demanda, essa checagem vira obrigatória — sem ela dá
// pra sobrepor uma alocação em cima de cama já ocupada.
async function assertRoomFullyFreeForWindow(
  sb: ReturnType<typeof createAdminClient>, organizationId: string, roomId: string, checkIn: string, checkOut: string,
) {
  const { count } = await sb.from('room_allocations')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('room_id', roomId)
    .neq('status', 'cancelada')
    .lt('check_in', checkOut)
    .gt('check_out', checkIn)
  if ((count ?? 0) > 0) throw new Error('Quarto já tem hóspede alocado nessa janela de datas — não dá pra alocar como quarto inteiro.')
}

export async function allocateWholeRoom(data: {
  organizationId: string
  roomId: string
  guestName: string
  guestType: string
  schoolId: string | null
  checkIn: string
  checkOut: string
  notes: string | null
  createdBy: string
  reservationId?: string | null
}) {
  const sb = createAdminClient()

  await assertRoomFullyFreeForWindow(sb, data.organizationId, data.roomId, data.checkIn, data.checkOut)

  const { data: roomBeds } = await sb.from('beds')
    .select('id')
    .eq('room_id', data.roomId)
    .eq('organization_id', data.organizationId)
    .neq('status', 'manutencao')

  const now = new Date()
  const checkInDate = new Date(data.checkIn + 'T00:00:00')
  const hoursUntil = (checkInDate.getTime() - now.getTime()) / 3_600_000
  const { data: orgRow } = await sb.from('organizations')
    .select('hospedagem_advance_hours').eq('id', data.organizationId).single()
  const advanceHours = (orgRow as { hospedagem_advance_hours?: number } | null)?.hospedagem_advance_hours ?? 120
  const bedStatus = hoursUntil <= 0 ? 'ocupada' : hoursUntil <= advanceHours ? 'reservada' : 'disponivel'

  for (const bed of (roomBeds ?? [])) {
    await sb.from('room_allocations').insert({
      organization_id: data.organizationId,
      room_id:         data.roomId,
      bed_id:          bed.id,
      reservation_id:  data.reservationId ?? null,
      guest_name:      data.guestName,
      guest_type:      data.guestType,
      school_id:       data.schoolId,
      check_in:        data.checkIn,
      check_out:       data.checkOut,
      notes:           data.notes,
      created_by:      data.createdBy,
    })
    if (bedStatus !== 'disponivel') {
      await sb.from('beds').update({
        status: bedStatus,
        updated_at: new Date().toISOString(),
      }).eq('id', bed.id)
    }
  }
}

export async function checkoutWholeRoom(data: {
  organizationId: string
  roomId: string
}) {
  const sb = createAdminClient()
  const now = new Date().toISOString()
  const today = now.split('T')[0]

  await sb.from('room_allocations').update({
    status: 'checkout',
    actual_check_out: today,
    updated_at: now,
  })
    .eq('room_id', data.roomId)
    .eq('organization_id', data.organizationId)
    .in('status', ['confirmada', 'checkin'])

  await sb.from('beds').update({
    status: 'disponivel',
    updated_at: now,
  })
    .eq('room_id', data.roomId)
    .eq('organization_id', data.organizationId)
    .eq('status', 'ocupada')
}

export async function checkinWholeRoom(data: {
  organizationId: string
  roomId: string
}) {
  const sb = createAdminClient()
  const now = new Date().toISOString()
  const today = now.split('T')[0]

  await sb.from('room_allocations').update({
    status: 'checkin',
    actual_check_in: today,
    updated_at: now,
  })
    .eq('room_id', data.roomId)
    .eq('organization_id', data.organizationId)
    .eq('status', 'confirmada')
}

// ── Toggle manutenção ────────────────────────────────────────────────────────

export async function toggleRoomMaintenance(roomId: string, organizationId: string, enable: boolean) {
  const sb = createAdminClient()
  await sb.from('rooms').update({
    status: enable ? 'manutencao' : 'ativo',
    updated_at: new Date().toISOString(),
  }).eq('id', roomId).eq('organization_id', organizationId)
}

export async function updateAdvanceHours(organizationId: string, hours: number) {
  const sb = createAdminClient()
  await sb.from('organizations').update({
    hospedagem_advance_hours: hours,
  }).eq('id', organizationId)
}

export async function toggleBedMaintenance(bedId: string, organizationId: string, enable: boolean) {
  const sb = createAdminClient()
  await sb.from('beds').update({
    status: enable ? 'manutencao' : 'disponivel',
    updated_at: new Date().toISOString(),
  }).eq('id', bedId).eq('organization_id', organizationId)
}

// ── Importação em lote (bloco > andar > quarto > cama) ──────────────────────
// Usado pela tela /quartos/importar — uma linha de planilha por cama, com
// bloco/andar/quarto repetidos entre linhas. Get-or-create por nome (case-
// insensitive) em cada nível, pra permitir rodar de novo e só completar o
// que faltar sem duplicar bloco/andar/quarto já existentes.

export type BulkImportRow = {
  bloco: string
  andar: string
  andarDestino: string | null
  andarGenero: string | null
  quarto: string
  quartoTipo: string
  quartoGenero: string | null
  quartoDestino: string
  quartoModo: string
  camaRotulo: string | null
  camaTipo: string
}

export async function bulkImportHospedagemStructure(params: {
  organizationId: string
  createdBy: string
  rows: BulkImportRow[]
}): Promise<{ blocksCreated: number; floorsCreated: number; roomsCreated: number; bedsCreated: number; warnings: string[] }> {
  const sb = createAdminClient()
  const warnings: string[] = []

  const [{ data: existingBlocks }, { data: existingFloors }, { data: existingRooms }, { data: existingBeds }] = await Promise.all([
    sb.from('blocks').select('id, name').eq('organization_id', params.organizationId),
    sb.from('floors').select('id, block_id, name').eq('organization_id', params.organizationId),
    sb.from('rooms').select('id, floor_id, name').eq('organization_id', params.organizationId),
    sb.from('beds').select('room_id, label').eq('organization_id', params.organizationId),
  ])

  const blockByName = new Map<string, string>()
  for (const b of (existingBlocks ?? []) as Array<{ id: string; name: string }>) blockByName.set(b.name.trim().toLowerCase(), b.id)

  const floorByKey = new Map<string, string>()
  for (const f of (existingFloors ?? []) as Array<{ id: string; block_id: string; name: string }>) {
    floorByKey.set(`${f.block_id}::${f.name.trim().toLowerCase()}`, f.id)
  }

  const roomByKey = new Map<string, string>()
  for (const r of (existingRooms ?? []) as Array<{ id: string; floor_id: string; name: string }>) {
    roomByKey.set(`${r.floor_id}::${r.name.trim().toLowerCase()}`, r.id)
  }

  const bedKeys = new Set<string>()
  for (const b of (existingBeds ?? []) as Array<{ room_id: string; label: string }>) {
    bedKeys.add(`${b.room_id}::${b.label.trim().toLowerCase()}`)
  }

  let blocksCreated = 0, floorsCreated = 0, roomsCreated = 0, bedsCreated = 0
  const roomsTouched = new Set<string>()

  for (const row of params.rows) {
    const blockKey = row.bloco.trim().toLowerCase()
    let blockId = blockByName.get(blockKey)
    if (!blockId) {
      const { data, error } = await sb.from('blocks').insert({
        organization_id: params.organizationId, name: row.bloco.trim(), created_by: params.createdBy,
      }).select('id').single()
      if (error) throw new Error(`Bloco "${row.bloco}": ${error.message}`)
      blockId = (data as { id: string }).id
      blockByName.set(blockKey, blockId)
      blocksCreated++
    }

    const floorKey = `${blockId}::${row.andar.trim().toLowerCase()}`
    let floorId = floorByKey.get(floorKey)
    if (!floorId) {
      const { data, error } = await sb.from('floors').insert({
        organization_id: params.organizationId, block_id: blockId, name: row.andar.trim(),
        destination: row.andarDestino, gender_constraint: row.andarGenero, created_by: params.createdBy,
      }).select('id').single()
      if (error) throw new Error(`Andar "${row.andar}" (bloco "${row.bloco}"): ${error.message}`)
      floorId = (data as { id: string }).id
      floorByKey.set(floorKey, floorId)
      floorsCreated++
    }

    const roomKey = `${floorId}::${row.quarto.trim().toLowerCase()}`
    let roomId = roomByKey.get(roomKey)
    if (!roomId) {
      const { data, error } = await sb.from('rooms').insert({
        organization_id: params.organizationId, floor_id: floorId, name: row.quarto.trim(),
        type: row.quartoTipo, gender_constraint: row.quartoGenero, destination: row.quartoDestino,
        allocation_mode: row.quartoModo, capacity: 0, notes: null, created_by: params.createdBy,
      }).select('id').single()
      if (error) throw new Error(`Quarto "${row.quarto}" (andar "${row.andar}"): ${error.message}`)
      roomId = (data as { id: string }).id
      roomByKey.set(roomKey, roomId)
      roomsCreated++
    }

    const label = row.camaRotulo?.trim()
    if (label) {
      const bedKey = `${roomId}::${label.toLowerCase()}`
      if (bedKeys.has(bedKey)) {
        warnings.push(`Cama "${label}" já existia no quarto "${row.quarto}" — não duplicada.`)
      } else {
        const { error } = await sb.from('beds').insert({
          room_id: roomId, organization_id: params.organizationId, label, type: row.camaTipo, notes: null,
        })
        if (error) throw new Error(`Cama "${label}" (quarto "${row.quarto}"): ${error.message}`)
        bedKeys.add(bedKey)
        bedsCreated++
        roomsTouched.add(roomId)
      }
    }
  }

  for (const roomId of roomsTouched) await syncRoomCapacity(roomId, params.organizationId)

  return { blocksCreated, floorsCreated, roomsCreated, bedsCreated, warnings }
}
