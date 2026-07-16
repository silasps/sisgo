'use server'

import { createAdminClient } from '@/lib/supabase/admin'

// ── Resolução de pendências de hospedagem (obreiro/aluno) ──────────────────────

export type AvailableRoom = {
  roomId: string
  roomName: string
  allocationMode: 'cama' | 'quarto'
  genderConstraint: string | null
  availableBeds: { id: string; label: string }[] // vazio quando allocationMode === 'quarto'
}

// Quartos com vaga real na janela de datas pedida — reaproveita a mesma regra
// de sobreposição já usada em ReservationTimeline (check_in < checkOut E check_out > checkIn).
export async function getAvailableRooms(params: {
  organizationId: string
  guestType: 'obreiro' | 'aluno'
  checkIn: string
  checkOut: string
}): Promise<AvailableRoom[]> {
  const sb = createAdminClient()

  const { data: rooms } = await sb
    .from('rooms')
    .select('id, name, capacity, allocation_mode, gender_constraint, destination')
    .eq('organization_id', params.organizationId)
    .eq('status', 'ativo')
    .eq('destination', params.guestType)
    .order('display_order', { ascending: true })

  const roomList = (rooms ?? []) as Array<{ id: string; name: string; capacity: number; allocation_mode: 'cama' | 'quarto'; gender_constraint: string | null }>
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

  const camaRoomIds = roomList.filter(r => r.allocation_mode === 'cama').map(r => r.id)
  const { data: beds } = camaRoomIds.length > 0
    ? await sb.from('beds').select('id, room_id, label').in('room_id', camaRoomIds).eq('status', 'disponivel')
    : { data: [] }
  const bedsByRoom = new Map<string, { id: string; label: string }[]>()
  for (const b of (beds ?? []) as Array<{ id: string; room_id: string; label: string }>) {
    if (occupiedBedIds.has(b.id)) continue
    bedsByRoom.set(b.room_id, [...(bedsByRoom.get(b.room_id) ?? []), { id: b.id, label: b.label }])
  }

  const result: AvailableRoom[] = []
  for (const r of roomList) {
    if (r.allocation_mode === 'quarto') {
      if (!occupiedRoomIds.has(r.id)) {
        result.push({ roomId: r.id, roomName: r.name, allocationMode: 'quarto', genderConstraint: r.gender_constraint, availableBeds: [] })
      }
    } else {
      const free = bedsByRoom.get(r.id) ?? []
      if (free.length > 0) {
        result.push({ roomId: r.id, roomName: r.name, allocationMode: 'cama', genderConstraint: r.gender_constraint, availableBeds: free })
      }
    }
  }
  return result
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

  const sb = createAdminClient()
  await sb.from('service_requests').update({
    status: 'resolvido',
    reviewed_by: params.reviewedBy,
    reviewed_at: new Date().toISOString(),
  }).eq('id', params.requestId)
}

// Confirma que há vaga (desbloqueia a candidatura) sem travar na escolha do
// quarto específico agora — isso vira uma pendência só da hospitalidade,
// separada do processo de admissão.
export async function resolverHospedagemSemAlocacao(params: {
  requestId: string
  organizationId: string
  guestName: string
  staffApplicationId: string | null
  schoolApplicationId: string | null
  requestedArrivalDate: string | null
  reviewedBy: string
}) {
  const sb = createAdminClient()

  await sb.from('service_requests').update({
    status: 'resolvido',
    reviewed_by: params.reviewedBy,
    reviewed_at: new Date().toISOString(),
  }).eq('id', params.requestId)

  await sb.from('service_requests').insert({
    organization_id: params.organizationId,
    requester_id: params.reviewedBy,
    requester_role: 'hospitalidade',
    target_department: 'hospitalidade',
    request_type: 'alocar_quarto',
    subject: `Definir quarto — ${params.guestName}`,
    description: 'Disponibilidade já confirmada — falta escolher o quarto/cama específico.',
    staff_application_id: params.staffApplicationId,
    school_application_id: params.schoolApplicationId,
    requested_arrival_date: params.requestedArrivalDate,
  })
}

// ── Rooms ────────────────────────────────────────────────────────────────────

export async function createRoom(data: {
  organizationId: string
  name: string
  floor: string | null
  block: string | null
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
    floor:             data.floor,
    block:             data.block,
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
  floor: string | null
  block: string | null
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
    floor:             data.floor,
    block:             data.block,
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
}) {
  return updateAllocationStatus({
    id: data.id,
    organizationId: data.organizationId,
    status: 'cancelada',
    bedId: data.bedId,
  })
}

// ── Whole-room allocation (visitas, alunos/ETED) ─────────────────────────────

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
}) {
  const sb = createAdminClient()

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
