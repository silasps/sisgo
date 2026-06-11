'use server'

import { createAdminClient } from '@/lib/supabase/admin'

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
