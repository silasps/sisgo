'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { cancelAllocation } from '../hospedagem/actions'

export async function createReservation(data: {
  organizationId: string
  type: 'espaco' | 'quarto'
  title: string
  description: string | null
  requesterType: 'ministry' | 'school' | 'person'
  requesterId: string
  requestedBy: string
  startsAt: string
  endsAt: string
  resourceDescription: string | null
  guestsCount: number | null
  guestsDescription: string | null
  formAnswers: Array<{ id: string; label: string; type: string; value: string }>
}) {
  const sb = createAdminClient()
  const { error } = await sb.from('reservations').insert({
    organization_id:      data.organizationId,
    type:                 data.type,
    title:                data.title,
    description:          data.description,
    requester_type:       data.requesterType,
    requester_id:         data.requesterId,
    requested_by:         data.requestedBy,
    starts_at:            data.startsAt,
    ends_at:              data.endsAt,
    resource_description: data.resourceDescription,
    guests_count:         data.guestsCount,
    guests_description:   data.guestsDescription,
    form_answers:         data.formAnswers,
  })
  if (error) throw new Error(error.message)
}

export async function updateReservationStatus(
  id: string,
  status: 'aprovada' | 'rejeitada',
  reviewedBy: string,
  reviewNotes: string | null,
  finalCost: number | null,
) {
  const sb = createAdminClient()
  await sb.from('reservations').update({
    status,
    reviewed_by:  reviewedBy,
    reviewed_at:  new Date().toISOString(),
    review_notes: reviewNotes,
    final_cost:   finalCost,
    updated_at:   new Date().toISOString(),
  }).eq('id', id)
}

// Cancela uma reserva já aprovada (quem aprova/gerencia, não o solicitante —
// esse caso é `cancelReservation` acima, só enquanto pendente). Se a reserva
// já tinha cama alocada (Parte 2: aprovar reserva de quarto pode alocar na
// hora), cancela a alocação junto, pra liberar a cama de verdade.
export async function cancelApprovedReservation(
  id: string,
  organizationId: string,
  reviewedBy: string,
  reviewNotes: string | null,
) {
  const sb = createAdminClient()
  await sb.from('reservations').update({
    status: 'cancelada',
    reviewed_by:  reviewedBy,
    reviewed_at:  new Date().toISOString(),
    review_notes: reviewNotes,
    updated_at:   new Date().toISOString(),
  }).eq('id', id)

  const { data: allocation } = await sb.from('room_allocations')
    .select('id, bed_id')
    .eq('reservation_id', id)
    .neq('status', 'cancelada')
    .maybeSingle()

  if (allocation) {
    await cancelAllocation({ id: allocation.id, organizationId, bedId: allocation.bed_id })
  }
}

export async function cancelReservation(id: string, requestedBy: string) {
  const sb = createAdminClient()
  await sb.from('reservations')
    .update({ status: 'cancelada', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('requested_by', requestedBy)
    .eq('status', 'pendente')
}

export async function updateReservationFormSettings(data: {
  organizationId: string
  fields: Record<string, unknown>
  updatedBy: string
}) {
  const sb = createAdminClient()
  const { error } = await sb.from('reservation_form_settings').upsert({
    organization_id: data.organizationId,
    fields:          data.fields,
    updated_by:      data.updatedBy,
    updated_at:      new Date().toISOString(),
  }, { onConflict: 'organization_id' })

  if (error) throw new Error(error.message)
}
