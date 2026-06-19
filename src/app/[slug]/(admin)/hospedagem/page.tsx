import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { EmptyState } from '@/components/ui/EmptyState'
import { notFound, redirect } from 'next/navigation'
import { getRolePreview } from '@/lib/role-preview'
import { isManagementRole, canSeeHospedagem } from '@/lib/auth/permissions'
import {
  createAllocation, updateAllocationStatus,
  allocateWholeRoom, checkinWholeRoom, checkoutWholeRoom,
  toggleRoomMaintenance, toggleBedMaintenance, updateAdvanceHours,
} from './actions'
import { BedGrid } from './BedGrid'
import { Hotel, BedDouble, DoorOpen, LogIn, LogOut } from 'lucide-react'
import Link from 'next/link'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ msg?: string }>
}

export default async function HospedagemPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { msg } = await searchParams

  const supabase = await createClient()
  const sbAdmin = createAdminClient()

  const [{ data: { user } }, { data: org }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('organizations').select('id, hospedagem_advance_hours').eq('slug', slug).single(),
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

  // ── Data ────────────────────────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0]

  const [{ data: rooms }, { data: beds }, { data: allocations }, { data: schoolsData }] = await Promise.all([
    sbAdmin.from('rooms')
      .select('id, name, floor, block, type, gender_constraint, destination, allocation_mode, capacity, status')
      .eq('organization_id', org.id)
      .neq('status', 'inativo')
      .order('block', { nullsFirst: false })
      .order('display_order')
      .order('name'),
    sbAdmin.from('beds')
      .select('id, room_id, label, type, status')
      .eq('organization_id', org.id),
    sbAdmin.from('room_allocations')
      .select('id, room_id, bed_id, guest_name, guest_type, check_in, check_out, status, school_id')
      .eq('organization_id', org.id)
      .in('status', ['confirmada', 'checkin'])
      .order('check_in'),
    sbAdmin.from('schools')
      .select('id, name')
      .eq('organization_id', org.id)
      .eq('active', true)
      .order('name'),
  ])

  type RoomRow  = { id: string; name: string; floor: string | null; block: string | null; type: string; gender_constraint: string | null; destination: string; allocation_mode: string; capacity: number; status: string }
  type BedRow   = { id: string; room_id: string; label: string; type: string; status: string }
  type AllocRow = { id: string; room_id: string; bed_id: string | null; guest_name: string; guest_type: string; check_in: string; check_out: string; status: string; school_id: string | null }

  const roomsList  = (rooms ?? []) as RoomRow[]
  const bedsList   = (beds ?? []) as BedRow[]
  const allocsList = (allocations ?? []) as AllocRow[]
  const schools    = (schoolsData ?? []) as Array<{ id: string; name: string }>

  // School name map for display
  const schoolMap = new Map(schools.map(s => [s.id, s.name]))
  const advanceHours = (org as { hospedagem_advance_hours?: number }).hospedagem_advance_hours ?? 120

  // ── KPIs (ocupação real de HOJE, não pelo status da cama) ────────────────
  const activeBeds = bedsList.filter(b => b.status !== 'manutencao')
  const bedsOccupiedToday = new Set(
    allocsList
      .filter(a => a.bed_id && a.check_in <= today && a.check_out > today)
      .map(a => a.bed_id)
  )
  const occupiedBeds = bedsOccupiedToday.size
  const availBeds    = activeBeds.length - occupiedBeds
  const arrivalsToday  = allocsList.filter(a => a.check_in === today).length
  const departuresToday = allocsList.filter(a => a.check_out === today).length

  // ── Data for BedGrid ────────────────────────────────────────────────────────
  const roomMap = new Map(roomsList.map(r => [r.id, r]))

  const gridRooms = roomsList.map(r => ({
    id: r.id,
    name: r.name,
    floor: r.floor,
    block: r.block,
    gender: r.gender_constraint,
    destination: r.destination,
    allocationMode: r.allocation_mode,
    status: r.status,
  }))

  const gridBeds = bedsList
    .filter(b => roomMap.has(b.room_id))
    .map(b => {
      const room = roomMap.get(b.room_id)!
      return {
        id: b.id,
        roomId: b.room_id,
        roomName: room.name,
        roomFloor: room.floor,
        roomGender: room.gender_constraint,
        label: b.label,
        type: b.type,
        status: b.status,
      }
    })

  const gridAllocs = allocsList
    .map(a => ({
      id: a.id,
      bedId: a.bed_id,
      roomId: a.room_id,
      guestName: a.guest_name,
      guestType: a.guest_type,
      checkIn: a.check_in,
      checkOut: a.check_out,
      allocStatus: a.status,
      schoolName: a.school_id ? (schoolMap.get(a.school_id) ?? null) : null,
    }))

  // ── Server actions ──────────────────────────────────────────────────────────
  const handleAllocate = async (formData: FormData) => {
    'use server'
    const guestName = (formData.get('guest_name') as string).trim()
    if (!guestName) return
    await createAllocation({
      organizationId: org.id,
      roomId:     formData.get('room_id') as string,
      bedId:      (formData.get('bed_id') as string) || null,
      reservationId: null, personId: null,
      guestName,
      guestType:  formData.get('guest_type') as string,
      checkIn:    formData.get('check_in') as string,
      checkOut:   formData.get('check_out') as string,
      notes:      (formData.get('notes') as string)?.trim() || null,
      createdBy:  user.id,
    })
    redirect(`/${slug}/hospedagem?msg=alocado`)
  }

  const handleAllocateRoom = async (formData: FormData) => {
    'use server'
    const guestName = (formData.get('guest_name') as string).trim()
    if (!guestName) return
    await allocateWholeRoom({
      organizationId: org.id,
      roomId:     formData.get('room_id') as string,
      guestName,
      guestType:  formData.get('guest_type') as string,
      schoolId:   (formData.get('school_id') as string) || null,
      checkIn:    formData.get('check_in') as string,
      checkOut:   formData.get('check_out') as string,
      notes:      null,
      createdBy:  user.id,
    })
    redirect(`/${slug}/hospedagem?msg=alocado`)
  }

  const handleCheckin = async (formData: FormData) => {
    'use server'
    await updateAllocationStatus({
      id: formData.get('id') as string,
      organizationId: org.id,
      status: 'checkin',
      bedId: (formData.get('bed_id') as string) || null,
    })
    redirect(`/${slug}/hospedagem?msg=checkin`)
  }

  const handleCheckout = async (formData: FormData) => {
    'use server'
    await updateAllocationStatus({
      id: formData.get('id') as string,
      organizationId: org.id,
      status: 'checkout',
      bedId: (formData.get('bed_id') as string) || null,
    })
    redirect(`/${slug}/hospedagem?msg=checkout`)
  }

  const handleCheckinRoom = async (formData: FormData) => {
    'use server'
    await checkinWholeRoom({
      organizationId: org.id,
      roomId: formData.get('room_id') as string,
    })
    redirect(`/${slug}/hospedagem?msg=checkin`)
  }

  const handleCheckoutRoom = async (formData: FormData) => {
    'use server'
    await checkoutWholeRoom({
      organizationId: org.id,
      roomId: formData.get('room_id') as string,
    })
    redirect(`/${slug}/hospedagem?msg=checkout`)
  }

  const handleToggleRoomMaintenance = async (formData: FormData) => {
    'use server'
    await toggleRoomMaintenance(
      formData.get('room_id') as string,
      org.id,
      formData.get('enable') === 'true',
    )
    redirect(`/${slug}/hospedagem`)
  }

  const handleToggleBedMaintenance = async (formData: FormData) => {
    'use server'
    await toggleBedMaintenance(
      formData.get('bed_id') as string,
      org.id,
      formData.get('enable') === 'true',
    )
    redirect(`/${slug}/hospedagem`)
  }

  const kpis = [
    { label: 'Quartos',           value: roomsList.length, icon: Hotel,     color: 'text-gray-600' },
    { label: 'Camas Ocupadas',    value: occupiedBeds,     icon: BedDouble, color: 'text-blue-600' },
    { label: 'Camas Disponíveis', value: availBeds,        icon: DoorOpen,  color: 'text-green-600' },
    { label: 'Chegadas Hoje',     value: arrivalsToday,    icon: LogIn,     color: 'text-orange-600' },
    { label: 'Saídas Hoje',       value: departuresToday,  icon: LogOut,    color: 'text-purple-600' },
  ]

  const handleUpdateAdvanceHours = async (formData: FormData) => {
    'use server'
    const hours = parseInt(formData.get('hours') as string)
    if (isNaN(hours) || hours < 0) return
    await updateAdvanceHours(org.id, hours)
    redirect(`/${slug}/hospedagem?msg=config_salva`)
  }

  const msgInfo: Record<string, string> = {
    alocado:      'Hóspede alocado com sucesso.',
    checkin:      'Check-in realizado.',
    checkout:     'Check-out realizado. Cama(s) liberada(s).',
    config_salva: 'Configuração atualizada.',
  }

  return (
    <>
      <Header title="Hospedagem" />
      <main className="p-4 md:p-6 space-y-5 max-w-6xl">
        {msg && msgInfo[msg] && (
          <div className="border rounded-lg px-4 py-3 text-sm bg-blue-50 border-blue-200 text-blue-700">
            {msgInfo[msg]}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {kpis.map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-gray-50 ${k.color}`}>
                <k.icon size={18} />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{k.value}</p>
                <p className="text-[10px] text-gray-400 font-medium">{k.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Occupancy bar */}
        {activeBeds.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-4">
            <div className="flex-1">
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    occupiedBeds / activeBeds.length >= 0.9 ? 'bg-red-400'
                      : occupiedBeds / activeBeds.length >= 0.6 ? 'bg-yellow-400'
                      : 'bg-green-400'
                  }`}
                  style={{ width: `${(occupiedBeds / activeBeds.length) * 100}%` }}
                />
              </div>
            </div>
            <span className="text-sm font-bold text-gray-700 whitespace-nowrap">
              {Math.round((occupiedBeds / activeBeds.length) * 100)}% ocupação
            </span>
          </div>
        )}

        {/* Advance hours config */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="font-medium text-gray-700">Antecedência de reservas:</span>
            <span>mostrar no mapa com quanto tempo antes do check-in?</span>
          </div>
          <form action={handleUpdateAdvanceHours} className="flex items-center gap-2">
            <select
              name="hours"
              defaultValue={advanceHours}
              className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              <option value="6">6 horas antes</option>
              <option value="12">12 horas antes</option>
              <option value="24">1 dia antes</option>
              <option value="48">2 dias antes</option>
              <option value="72">3 dias antes</option>
              <option value="120">5 dias antes</option>
              <option value="168">7 dias antes</option>
              <option value="336">14 dias antes</option>
              <option value="720">30 dias antes</option>
            </select>
            <button type="submit" className="px-3 py-1 text-xs font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors">
              Salvar
            </button>
          </form>
        </div>

        {/* Bed Grid */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-gray-800">Mapa de Quartos e Camas</h2>
          <div className="flex gap-3">
            <Link
              href={`/${slug}/hospedagem/agenda`}
              className="text-xs font-medium text-brand-500 hover:text-brand-700 transition-colors"
            >
              Agenda de reservas →
            </Link>
            <Link
              href={`/${slug}/hospedagem/quartos`}
              className="text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
            >
              Gerenciar quartos →
            </Link>
          </div>
        </div>

        {roomsList.length === 0 ? (
          <EmptyState
            icon={Hotel}
            title="Nenhum quarto cadastrado"
            description="Cadastre os quartos e camas da base para começar."
            cta={{ label: 'Cadastrar quartos', href: `/${slug}/hospedagem/quartos` }}
          />
        ) : gridBeds.length === 0 ? (
          <EmptyState
            icon={BedDouble}
            title="Nenhuma cama cadastrada"
            description="Os quartos existem mas não têm camas. Adicione camas para gerenciar."
            cta={{ label: 'Ir para quartos', href: `/${slug}/hospedagem/quartos` }}
          />
        ) : (
          <BedGrid
            rooms={gridRooms}
            beds={gridBeds}
            allocs={gridAllocs}
            schools={schools}
            today={today}
            advanceHours={advanceHours}
            slug={slug}
            allocateAction={handleAllocate}
            allocateRoomAction={handleAllocateRoom}
            checkinAction={handleCheckin}
            checkoutAction={handleCheckout}
            checkinRoomAction={handleCheckinRoom}
            checkoutRoomAction={handleCheckoutRoom}
            toggleRoomMaintenanceAction={handleToggleRoomMaintenance}
            toggleBedMaintenanceAction={handleToggleBedMaintenance}
          />
        )}
      </main>
    </>
  )
}
