import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { notFound } from 'next/navigation'
import { getRolePreview } from '@/lib/role-preview'
import { isManagementRole, canSeeHospedagem } from '@/lib/auth/permissions'
import { ReservationTimeline } from './ReservationTimeline'
import Link from 'next/link'

type Props = {
  params: Promise<{ slug: string }>
}

export default async function AgendaPage({ params }: Props) {
  const { slug } = await params

  const supabase = await createClient()
  const sbAdmin = createAdminClient()

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
  const realRole = (orgUser?.roles as unknown as { name: string } | null)?.name ?? ''
  const preview  = await getRolePreview(realRole)
  const role     = preview?.role ?? realRole

  if (!isManagementRole(role) && !canSeeHospedagem(role)) notFound()

  const today = new Date().toISOString().split('T')[0]

  const [{ data: rooms }, { data: beds }, { data: allocations }, { data: schoolsData }] = await Promise.all([
    sbAdmin.from('rooms')
      .select('id, name, block, gender_constraint, destination, allocation_mode, status')
      .eq('organization_id', org.id)
      .neq('status', 'inativo')
      .order('block', { nullsFirst: false })
      .order('display_order')
      .order('name'),
    sbAdmin.from('beds')
      .select('id, room_id')
      .eq('organization_id', org.id),
    sbAdmin.from('room_allocations')
      .select('id, room_id, guest_name, guest_type, check_in, check_out, status, school_id')
      .eq('organization_id', org.id)
      .in('status', ['confirmada', 'checkin'])
      .order('check_in'),
    sbAdmin.from('schools')
      .select('id, name')
      .eq('organization_id', org.id)
      .eq('active', true),
  ])

  type RoomRow = { id: string; name: string; block: string | null; gender_constraint: string | null; destination: string; allocation_mode: string; status: string }
  type AllocRow = { id: string; room_id: string; guest_name: string; guest_type: string; check_in: string; check_out: string; status: string; school_id: string | null }

  const roomsList = (rooms ?? []) as RoomRow[]
  const bedsList = (beds ?? []) as Array<{ id: string; room_id: string }>
  const allocsList = (allocations ?? []) as AllocRow[]
  const schoolMap = new Map((schoolsData ?? []).map((s: { id: string; name: string }) => [s.id, s.name]))

  const bedCountByRoom = new Map<string, number>()
  for (const b of bedsList) {
    bedCountByRoom.set(b.room_id, (bedCountByRoom.get(b.room_id) ?? 0) + 1)
  }

  const gridRooms = roomsList.map(r => ({
    id: r.id,
    name: r.name,
    block: r.block,
    gender: r.gender_constraint,
    destination: r.destination,
    allocationMode: r.allocation_mode,
    bedCount: bedCountByRoom.get(r.id) ?? 0,
  }))

  const gridAllocs = allocsList.map(a => ({
    id: a.id,
    roomId: a.room_id,
    guestName: a.guest_name,
    guestType: a.guest_type,
    checkIn: a.check_in,
    checkOut: a.check_out,
    status: a.status,
    schoolName: a.school_id ? (schoolMap.get(a.school_id) ?? null) : null,
  }))

  return (
    <>
      <Header
        title="Agenda de Reservas"
        actions={
          <Link href={`/${slug}/hospedagem`} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            ← Mapa de camas
          </Link>
        }
      />
      <main className="p-4 md:p-6 space-y-4">
        <ReservationTimeline
          rooms={gridRooms}
          allocs={gridAllocs}
          today={today}
        />
      </main>
    </>
  )
}
