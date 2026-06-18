'use server'

import { createAdminClient } from '@/lib/supabase/admin'

// ── Rooms ────────────────────────────────────────────────────────────────────

export async function createRoom(data: {
  organizationId: string
  name: string
  floor: string | null
  type: string
  genderConstraint: string | null
  notes: string | null
  createdBy: string
}) {
  const sb = createAdminClient()
  const { error } = await sb.from('rooms').insert({
    organization_id:   data.organizationId,
    name:              data.name,
    floor:             data.floor,
    type:              data.type,
    gender_constraint: data.genderConstraint,
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
  type: string
  genderConstraint: string | null
  status: string
  notes: string | null
}) {
  const sb = createAdminClient()
  const { error } = await sb.from('rooms').update({
    name:              data.name,
    floor:             data.floor,
    type:              data.type,
    gender_constraint: data.genderConstraint,
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
    await sb.from('beds').update({
      status: 'ocupada',
      updated_at: new Date().toISOString(),
    }).eq('id', data.bedId).eq('organization_id', data.organizationId)
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
