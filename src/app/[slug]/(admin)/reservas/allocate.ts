import { createAdminClient } from '@/lib/supabase/admin'
import { createAllocation, allocateWholeRoom, cancelAllocation } from '../hospedagem/actions'

// Escolha feita no seletor de quarto (ReviewActions.tsx): quarto inteiro ou
// uma ou mais camas de um mesmo quarto.
export type RoomChoice =
  | { mode: 'quarto'; roomId: string }
  | { mode: 'camas'; roomId: string; bedIds: string[] }

export function parseRoomChoice(formData: FormData): RoomChoice | null {
  const mode = formData.get('room_mode')
  const roomId = String(formData.get('room_id') ?? '')
  if (!roomId) return null
  if (mode === 'quarto') return { mode, roomId }
  const bedIds = [...new Set(String(formData.get('bed_ids') ?? '').split(',').filter(Boolean))]
  if (mode === 'camas' && bedIds.length > 0) return { mode, roomId, bedIds }
  return null
}

/**
 * Aloca o quarto/camas escolhidos pra reserva. `false` = a vaga não está
 * mais livre (outra pessoa da equipe alocou nesse meio tempo) — e aí nada
 * fica alocado pela metade.
 */
export async function allocateReservationRoom(params: {
  organizationId: string
  reservationId: string
  choice: RoomChoice
  guestName: string
  checkIn: string
  checkOut: string
  createdBy: string
}): Promise<boolean> {
  const { organizationId, reservationId, choice, guestName, checkIn, checkOut, createdBy } = params

  if (choice.mode === 'quarto') {
    try {
      // allocateWholeRoom já confere se o quarto está 100% livre na janela.
      await allocateWholeRoom({
        organizationId, roomId: choice.roomId, guestName, guestType: 'convidado',
        schoolId: null, checkIn, checkOut, notes: null, createdBy, reservationId,
      })
      return true
    } catch {
      return false
    }
  }

  // createAllocation não confere sobreposição — sem isto, duas pessoas
  // aprovando ao mesmo tempo punham dois hóspedes na mesma cama.
  const sb = createAdminClient()
  const [{ data: beds }, { count: taken }] = await Promise.all([
    sb.from('beds').select('id')
      .eq('organization_id', organizationId)
      .eq('room_id', choice.roomId)
      .in('id', choice.bedIds)
      .neq('status', 'manutencao'),
    sb.from('room_allocations').select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .in('bed_id', choice.bedIds)
      .in('status', ['confirmada', 'checkin'])
      .lt('check_in', checkOut)
      .gt('check_out', checkIn),
  ])
  if ((beds ?? []).length !== choice.bedIds.length || (taken ?? 0) > 0) return false

  try {
    for (const bedId of choice.bedIds) {
      await createAllocation({
        organizationId, roomId: choice.roomId, bedId, reservationId, personId: null,
        guestName, guestType: 'convidado', checkIn, checkOut, notes: null, createdBy,
      })
    }
    return true
  } catch {
    // Desfaz as camas que chegaram a entrar antes do erro.
    const { data: created } = await sb.from('room_allocations')
      .select('id, bed_id')
      .eq('reservation_id', reservationId)
      .in('bed_id', choice.bedIds)
      .eq('status', 'confirmada')
    for (const allocation of created ?? []) {
      await cancelAllocation({ id: allocation.id, organizationId, bedId: allocation.bed_id })
    }
    return false
  }
}
