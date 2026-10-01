import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUsers } from '@/lib/notifications/push'

type AdminClient = ReturnType<typeof createAdminClient>

// starts_at/ends_at são `date` (YYYY-MM-DD) — sem fuso pra converter.
function fmtDate(d: string) {
  const [y, m, day] = d.slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}

/**
 * Quarto/cama que a hospitalidade definiu pra cada reserva (alocação ligada
 * por reservation_id). Admin porque quem pediu (líder de ministério, aluno…)
 * não lê room_allocations pela RLS — os ids já vêm filtrados pela página.
 * Quarto inteiro vira uma alocação por cama, daí o agrupamento por quarto.
 */
export async function getAllocatedRoomLabels(sb: AdminClient, reservationIds: string[]): Promise<Map<string, string>> {
  const rows: Array<{ reservation_id: string; rooms: { name: string } | null; beds: { label: string } | null }> = []
  // Lotes de 100 — o histórico pode ter centenas de ids e o `in` vai na URL.
  for (let start = 0; start < reservationIds.length; start += 100) {
    const { data } = await sb.from('room_allocations')
      .select('reservation_id, rooms(name), beds(label)')
      .in('reservation_id', reservationIds.slice(start, start + 100))
      .in('status', ['confirmada', 'checkin', 'checkout'])
    rows.push(...((data ?? []) as unknown as typeof rows))
  }

  const bedsByRoomByReservation = new Map<string, Map<string, string[]>>()
  for (const row of rows) {
    const byRoom = bedsByRoomByReservation.get(row.reservation_id) ?? new Map<string, string[]>()
    const roomName = row.rooms?.name ?? 'Quarto'
    byRoom.set(roomName, [...(byRoom.get(roomName) ?? []), ...(row.beds?.label ? [row.beds.label] : [])])
    bedsByRoomByReservation.set(row.reservation_id, byRoom)
  }

  const labels = new Map<string, string>()
  for (const [reservationId, byRoom] of bedsByRoomByReservation) {
    labels.set(reservationId, [...byRoom].map(([room, beds]) =>
      beds.length > 1 ? `${room} (quarto inteiro)` : beds.length === 1 ? `${room} — ${beds[0]}` : room,
    ).join(', '))
  }
  return labels
}

/**
 * Quem cuida das reservas na base: papel `hospitalidade` (principal, extra
 * ou acumulado) ou vínculo — líder ou membro — com ministério de
 * linked_role 'hospitalidade'; mesmo cálculo do menu (layout.tsx). Base sem
 * ninguém assim cai pra admin da base/DH, que também aprovam — senão o
 * pedido fica sem ninguém avisado.
 */
async function getReservationReviewerIds(sb: AdminClient, orgId: string): Promise<string[]> {
  const [{ data: org }, { data: roles }, { data: orgUsers }, { data: ministries }] = await Promise.all([
    sb.from('organizations').select('role_accumulations').eq('id', orgId).single(),
    sb.from('roles').select('id, name'),
    sb.from('organization_users').select('user_id, role_id, extra_roles').eq('organization_id', orgId).eq('active', true),
    sb.from('ministries').select('id').eq('organization_id', orgId).eq('linked_role', 'hospitalidade'),
  ])

  const accumulations = (org?.role_accumulations as Record<string, string[]> | null) ?? {}
  const roleNameById = new Map((roles ?? []).map(r => [r.id as string, r.name as string]))
  const activeUsers = ((orgUsers ?? []) as Array<{ user_id: string; role_id: string; extra_roles: unknown }>)
    .map(ou => ({ userId: ou.user_id, roleName: roleNameById.get(ou.role_id) ?? '', extraRoles: Array.isArray(ou.extra_roles) ? ou.extra_roles as string[] : [] }))
  const activeUserIds = new Set(activeUsers.map(u => u.userId))

  const hospitality = new Set(activeUsers
    .filter(u => u.roleName === 'hospitalidade' || (accumulations[u.roleName] ?? []).includes('hospitalidade') || u.extraRoles.includes('hospitalidade'))
    .map(u => u.userId))

  const ministryIds = (ministries ?? []).map(m => m.id as string)
  if (ministryIds.length > 0) {
    const [{ data: leaders }, { data: members }] = await Promise.all([
      sb.from('ministry_leaders').select('user_id').in('ministry_id', ministryIds),
      sb.from('ministry_members').select('person_id').in('ministry_id', ministryIds).eq('active', true),
    ])
    for (const l of leaders ?? []) hospitality.add(l.user_id)
    const personIds = (members ?? []).map(m => m.person_id as string)
    if (personIds.length > 0) {
      const { data: profiles } = await sb.from('staff_profiles').select('user_id').eq('organization_id', orgId).in('person_id', personIds)
      for (const p of profiles ?? []) if (p.user_id) hospitality.add(p.user_id)
    }
  }

  // Vínculo de ministério sozinho não garante que a pessoa segue ativa na base.
  const reviewers = [...hospitality].filter(id => activeUserIds.has(id))
  if (reviewers.length > 0) return reviewers
  return activeUsers.filter(u => u.roleName === 'admin_base' || u.roleName === 'dh').map(u => u.userId)
}

// Push nativo direto, mesmo esquema do Chat (sem a fila notification_events).
// Quem não tem o app instalado não recebe — a reserva continua na tela.

export async function notifyNewReservation(params: {
  organizationId: string
  slug: string
  createdBy: string
  requesterLabel: string
  type: 'espaco' | 'quarto'
  title: string
  startsAt: string
  endsAt: string
}) {
  const sb = createAdminClient()
  const recipients = (await getReservationReviewerIds(sb, params.organizationId)).filter(id => id !== params.createdBy)
  await sendPushToUsers(recipients, {
    title: 'Nova solicitação de reserva',
    body: `${params.requesterLabel ? `${params.requesterLabel} · ` : ''}${params.type === 'espaco' ? 'Espaço' : 'Quarto'}: "${params.title}" · ${fmtDate(params.startsAt)} → ${fmtDate(params.endsAt)}`,
    data: { url: `/${params.slug}/reservas` },
  })
}

/** Avisa quem pediu que a reserva foi concluída (confirmada, recusada ou cancelada). */
export async function notifyReservationDecision(params: { reservationId: string; slug: string; actorId: string }) {
  const sb = createAdminClient()
  const { data: r } = await sb.from('reservations')
    .select('title, status, starts_at, ends_at, requested_by, review_notes')
    .eq('id', params.reservationId)
    .single()
  if (!r || r.requested_by === params.actorId) return

  let title: string
  let body: string
  if (r.status === 'aprovada') {
    const room = (await getAllocatedRoomLabels(sb, [params.reservationId])).get(params.reservationId)
    title = 'Reserva confirmada'
    body = `"${r.title}" · ${fmtDate(r.starts_at)} → ${fmtDate(r.ends_at)}${room ? ` · ${room}` : ''}`
  } else if (r.status === 'rejeitada' || r.status === 'cancelada') {
    title = r.status === 'rejeitada' ? 'Reserva recusada' : 'Reserva cancelada'
    body = `"${r.title}"${r.review_notes ? ` — ${r.review_notes}` : ''}`
  } else {
    return
  }

  await sendPushToUsers([r.requested_by], { title, body, data: { url: `/${params.slug}/reservas` } })
}
