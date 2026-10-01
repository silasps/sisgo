import type { createAdminClient } from '@/lib/supabase/admin'
import type { ObreiroOption } from './GuestTypeFields'

// Lista de obreiros da base pro "Tipo = Obreiro" dos modais de alocar
// hóspede, cada um com o endereço de onde já está alocado — o modal avisa,
// não bloqueia. Usado pela tela de Hospedagem e pelo detalhe do quarto.

type StaffRow = { person_id: string | null; people: { full_name: string } | null }
type AllocRow = { room_id: string; bed_id: string | null; person_id: string | null; guest_name: string; check_in: string; check_out: string }
type RoomRow = { id: string; name: string; floors: { name: string; blocks: { name: string } | null } | null }
type BedRow = { id: string; label: string }

function normName(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function fmtDate(d: string) {
  return d.split('-').reverse().join('/')
}

// activeAllocs: só alocações confirmada/check-in (quem ainda vai ficar ou está).
export function buildObreiroOptions(staff: StaffRow[], activeAllocs: AllocRow[], rooms: RoomRow[], beds: BedRow[]): ObreiroOption[] {
  const roomById = new Map(rooms.map(r => [r.id, r]))
  const bedLabelById = new Map(beds.map(b => [b.id, b.label]))

  // Quarto inteiro grava uma linha por cama com o mesmo hóspede e datas —
  // agrupa pra virar um endereço só ("quarto inteiro") em vez de um por cama.
  const groups = new Map<string, { alloc: AllocRow; bedIds: string[] }>()
  for (const a of activeAllocs) {
    const key = `${a.person_id ?? normName(a.guest_name)}|${a.room_id}|${a.check_in}|${a.check_out}`
    const group = groups.get(key)
    if (group) { if (a.bed_id) group.bedIds.push(a.bed_id) }
    else groups.set(key, { alloc: a, bedIds: a.bed_id ? [a.bed_id] : [] })
  }
  const places = [...groups.values()].map(({ alloc: a, bedIds }) => {
    const room = roomById.get(a.room_id)
    const bedPart = bedIds.length === 1 ? bedLabelById.get(bedIds[0]) : bedIds.length > 1 ? 'quarto inteiro' : null
    const where = [room?.floors?.blocks?.name, room?.floors?.name, room?.name, bedPart].filter(Boolean).join(' · ')
    return { personId: a.person_id, name: normName(a.guest_name), address: `${where} (${fmtDate(a.check_in)} → ${fmtDate(a.check_out)})` }
  })

  const byPerson = new Map<string, ObreiroOption>()
  for (const s of staff) {
    const name = s.people?.full_name?.trim()
    // staff_profiles pode ter mais de um perfil pra mesma pessoa na base.
    if (!s.person_id || !name || byPerson.has(s.person_id)) continue
    const n = normName(name)
    byPerson.set(s.person_id, {
      personId: s.person_id,
      name,
      // Alocação antiga não guardava person_id — nesses casos casa pelo nome.
      allocatedAt: places.filter(p => (p.personId ? p.personId === s.person_id : p.name === n)).map(p => p.address),
    })
  }
  return [...byPerson.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

// Pra telas que não têm esses dados carregados (Gerenciar quartos e detalhe
// do quarto) — a tela de Hospedagem já tem tudo e chama buildObreiroOptions.
export async function loadObreiroOptions(sb: ReturnType<typeof createAdminClient>, organizationId: string) {
  const [{ data: staff }, { data: allocs }, { data: rooms }, { data: beds }] = await Promise.all([
    sb.from('staff_profiles').select('person_id, people(full_name)').eq('organization_id', organizationId).eq('active', true),
    sb.from('room_allocations')
      .select('room_id, bed_id, person_id, guest_name, check_in, check_out')
      .eq('organization_id', organizationId)
      .in('status', ['confirmada', 'checkin']),
    sb.from('rooms').select('id, name, floors(name, blocks(name))').eq('organization_id', organizationId),
    sb.from('beds').select('id, label').eq('organization_id', organizationId),
  ])
  return buildObreiroOptions(
    (staff ?? []) as unknown as StaffRow[],
    (allocs ?? []) as AllocRow[],
    (rooms ?? []) as unknown as RoomRow[],
    (beds ?? []) as BedRow[],
  )
}
