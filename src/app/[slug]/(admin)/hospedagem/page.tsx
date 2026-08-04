import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { EmptyState } from '@/components/ui/EmptyState'
import { notFound, redirect } from 'next/navigation'
import { getRolePreview } from '@/lib/role-preview'
import { isManagementRole, isOperationalManager, canSeeHospedagem } from '@/lib/auth/permissions'
import {
  createAllocation, updateAllocationStatus, cancelAllocation,
  allocateWholeRoom, checkinWholeRoom, checkoutWholeRoom,
  toggleRoomMaintenance, toggleBedMaintenance, updateAdvanceHours,
  createHold, cancelHold,
} from './actions'
import { BedGrid } from './BedGrid'
import { ReservationTimeline } from './agenda/ReservationTimeline'
import { BlockCard } from './BlockCard'
import { FloorCard } from './FloorCard'
import { HoldForm } from './HoldForm'
import { HoldBanner } from './HoldBanner'
import { Hotel, BedDouble, DoorOpen, LogIn, LogOut } from 'lucide-react'
import Link from 'next/link'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ msg?: string; view?: string; block?: string; floor?: string }>
}

export default async function HospedagemPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { msg, view: viewParam, block: blockId, floor: floorId } = await searchParams
  const view = viewParam === 'timeline' ? 'timeline' : 'grid'

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
  const canWrite = isOperationalManager(role) || role === 'hospitalidade'

  // ── Data ────────────────────────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0]

  const [{ data: rooms }, { data: beds }, { data: allocations }, { data: schoolsData }, { data: blocksData }, { data: floorsData }, { data: holdsData }] = await Promise.all([
    sbAdmin.from('rooms')
      .select('id, name, floor_id, type, gender_constraint, destination, allocation_mode, capacity, status, floors(name, block_id, blocks(name))')
      .eq('organization_id', org.id)
      .neq('status', 'inativo')
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
    sbAdmin.from('blocks').select('id, name').eq('organization_id', org.id).order('display_order').order('name'),
    sbAdmin.from('floors').select('id, block_id, name, destination, gender_constraint').eq('organization_id', org.id).order('display_order').order('name'),
    sbAdmin.from('space_holds').select('id, scope, block_id, floor_id, group_name, starts_at, ends_at').eq('organization_id', org.id).eq('status', 'ativo'),
  ])

  type RoomRow  = { id: string; name: string; floor_id: string | null; type: string; gender_constraint: string | null; destination: string; allocation_mode: string; capacity: number; status: string; floors: { name: string; block_id: string; blocks: { name: string } | null } | null }
  type BedRow   = { id: string; room_id: string; label: string; type: string; status: string }
  type AllocRow = { id: string; room_id: string; bed_id: string | null; guest_name: string; guest_type: string; check_in: string; check_out: string; status: string; school_id: string | null }
  type BlockRow = { id: string; name: string }
  type FloorRow = { id: string; block_id: string; name: string; destination: string | null; gender_constraint: string | null }
  type HoldRow  = { id: string; scope: string; block_id: string; floor_id: string | null; group_name: string; starts_at: string; ends_at: string }

  const roomsList  = (rooms ?? []) as unknown as RoomRow[]
  const bedsList   = (beds ?? []) as BedRow[]
  const allocsList = (allocations ?? []) as AllocRow[]
  const schools    = (schoolsData ?? []) as Array<{ id: string; name: string }>
  const blocksList = (blocksData ?? []) as BlockRow[]
  const floorsList = (floorsData ?? []) as FloorRow[]
  const holdsList  = (holdsData ?? []) as HoldRow[]

  const holdByBlock = new Map(holdsList.filter(h => h.scope === 'block').map(h => [h.block_id, h]))
  const holdByFloor = new Map(holdsList.filter(h => h.scope === 'floor' && h.floor_id).map(h => [h.floor_id as string, h]))

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

  // ── Agregação por Bloco/Andar (pros cards de navegação) ─────────────────────
  const roomsByFloor = new Map<string, RoomRow[]>()
  for (const r of roomsList) {
    if (!r.floor_id) continue
    const list = roomsByFloor.get(r.floor_id) ?? []
    list.push(r)
    roomsByFloor.set(r.floor_id, list)
  }
  const floorsByBlock = new Map<string, FloorRow[]>()
  for (const f of floorsList) {
    const list = floorsByBlock.get(f.block_id) ?? []
    list.push(f)
    floorsByBlock.set(f.block_id, list)
  }
  function bedStatsForRooms(roomsIn: RoomRow[]) {
    const roomIds = new Set(roomsIn.map(r => r.id))
    const beds = bedsList.filter(b => roomIds.has(b.room_id) && b.status !== 'manutencao')
    const occupied = beds.filter(b => bedsOccupiedToday.has(b.id)).length
    return { total: beds.length, occupied }
  }
  function floorStats(floorId: string) {
    return bedStatsForRooms(roomsByFloor.get(floorId) ?? [])
  }
  function blockStats(blockIdIn: string) {
    const blockFloors = floorsByBlock.get(blockIdIn) ?? []
    const blockRooms = blockFloors.flatMap(f => roomsByFloor.get(f.id) ?? [])
    return bedStatsForRooms(blockRooms)
  }

  // ── Data for BedGrid ────────────────────────────────────────────────────────
  const roomMap = new Map(roomsList.map(r => [r.id, r]))

  const gridRooms = roomsList.map(r => ({
    id: r.id,
    name: r.name,
    floorName: r.floors?.name ?? null,
    blockName: r.floors?.blocks?.name ?? null,
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
        roomFloorName: room.floors?.name ?? null,
        roomBlockName: room.floors?.blocks?.name ?? null,
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

  // ── Data for ReservationTimeline (visão "Linha do tempo", ex-página Agenda —
  // mesmos dados do BedGrid acima, só remodelados; não tem ação própria) ──────
  const bedCountByRoom = new Map<string, number>()
  for (const b of bedsList) {
    bedCountByRoom.set(b.room_id, (bedCountByRoom.get(b.room_id) ?? 0) + 1)
  }

  const timelineRooms = roomsList.map(r => ({
    id: r.id,
    name: r.name,
    blockName: r.floors?.blocks?.name ?? null,
    floorName: r.floors?.name ?? null,
    gender: r.gender_constraint,
    destination: r.destination,
    allocationMode: r.allocation_mode,
    bedCount: bedCountByRoom.get(r.id) ?? 0,
  }))

  const timelineAllocs = allocsList.map(a => ({
    id: a.id,
    roomId: a.room_id,
    bedId: a.bed_id,
    guestName: a.guest_name,
    guestType: a.guest_type,
    checkIn: a.check_in,
    checkOut: a.check_out,
    status: a.status,
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

  // Cancela uma alocação direto pela Agenda (clicou na barra → gerenciar).
  const handleCancelAllocation = async (formData: FormData) => {
    'use server'
    await cancelAllocation({
      id: formData.get('id') as string,
      organizationId: org.id,
      bedId: (formData.get('bed_id') as string) || null,
      reason: (formData.get('reason') as string) || null,
    })
    redirect(`/${slug}/hospedagem?view=timeline&msg=alocacao_cancelada`)
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

  const handleCreateHold = async (formData: FormData) => {
    'use server'
    const groupName = (formData.get('group_name') as string).trim()
    const scope = formData.get('scope') as 'block' | 'floor' | 'room'
    const blockIdForm = formData.get('block_id') as string
    if (!groupName || !blockIdForm) return
    const floorIdForm = (formData.get('floor_id') as string) || null
    const roomIdForm = (formData.get('room_id') as string) || null
    await createHold({
      organizationId: org.id,
      scope,
      blockId: blockIdForm,
      floorId: scope !== 'block' ? floorIdForm : null,
      roomId: scope === 'room' ? roomIdForm : null,
      groupName,
      startsAt: formData.get('starts_at') as string,
      endsAt: formData.get('ends_at') as string,
      notes: (formData.get('notes') as string)?.trim() || null,
      createdBy: user.id,
    })
    // Fica no mesmo nível de navegação onde o botão foi clicado, pra ver o
    // selo aparecer no card certo.
    const backTo = scope === 'block' ? '' : scope === 'floor' ? `block=${blockIdForm}` : `block=${blockIdForm}&floor=${floorIdForm}`
    redirect(`/${slug}/hospedagem${backTo ? `?${backTo}&msg=hold_criado` : '?msg=hold_criado'}`)
  }

  const handleCancelHold = async (formData: FormData) => {
    'use server'
    await cancelHold({
      id: formData.get('id') as string,
      organizationId: org.id,
      reason: (formData.get('reason') as string) || null,
    })
    const backBlockId = (formData.get('back_block') as string) || ''
    const backFloorId = (formData.get('back_floor') as string) || ''
    const backTo = backFloorId ? `block=${backBlockId}&floor=${backFloorId}` : backBlockId ? `block=${backBlockId}` : ''
    redirect(`/${slug}/hospedagem?${backTo}&msg=hold_cancelado`)
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
    alocacao_cancelada: 'Alocação cancelada.',
    hold_criado: 'Reserva registrada.',
    hold_cancelado: 'Reserva cancelada.',
  }

  // ── Navegação por camada: sem bloco selecionado → cards de bloco; só
  // bloco → cards de andar; bloco+andar → mapa de camas escopado a ele ────────
  const currentBlock = blockId ? blocksList.find(b => b.id === blockId) : null
  const currentFloor = floorId ? floorsList.find(f => f.id === floorId) : null
  const currentBlockHold = blockId ? holdByBlock.get(blockId) : undefined
  const currentFloorHold = floorId ? (holdByFloor.get(floorId) ?? currentBlockHold) : undefined
  const floorsOfCurrentBlock = blockId ? (floorsByBlock.get(blockId) ?? []) : []
  const roomIdsOfCurrentFloor = floorId ? new Set((roomsByFloor.get(floorId) ?? []).map(r => r.id)) : null
  const scopedGridRooms = roomIdsOfCurrentFloor ? gridRooms.filter(r => roomIdsOfCurrentFloor.has(r.id)) : gridRooms
  const scopedGridBeds = roomIdsOfCurrentFloor ? gridBeds.filter(b => roomIdsOfCurrentFloor.has(b.roomId)) : gridBeds
  const scopedGridAllocs = roomIdsOfCurrentFloor ? gridAllocs.filter(a => roomIdsOfCurrentFloor.has(a.roomId)) : gridAllocs

  return (
    <>
      <Header
        title="Hospedagem"
        actions={
          <Link
            href={`/${slug}/reservas`}
            className="text-sm text-gray-300 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            Ver reservas →
          </Link>
        }
      />
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
          {canWrite ? (
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
          ) : (
            <span className="text-xs text-gray-400">{advanceHours}h antes</span>
          )}
        </div>

        {/* Bed Grid / Linha do tempo — mesma tela, duas visões dos mesmos dados
            (a Agenda separada foi unificada aqui, não tinha ação própria) */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            <Link
              href={`/${slug}/hospedagem?view=grid`}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${view === 'grid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Mapa de Quartos e Camas
            </Link>
            <Link
              href={`/${slug}/hospedagem?view=timeline`}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${view === 'timeline' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Agenda
            </Link>
          </div>
          <Link
            href={`/${slug}/hospedagem/quartos`}
            className="text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
          >
            Gerenciar quartos →
          </Link>
        </div>

        {view === 'timeline' ? (
          <ReservationTimeline
            rooms={timelineRooms}
            beds={gridBeds}
            allocs={timelineAllocs}
            schools={schools}
            today={today}
            allocateAction={handleAllocate}
            allocateRoomAction={handleAllocateRoom}
            checkinAction={handleCheckin}
            checkoutAction={handleCheckout}
            cancelAction={handleCancelAllocation}
          />
        ) : roomsList.length === 0 ? (
          <EmptyState
            icon={Hotel}
            title="Nenhum quarto cadastrado"
            description="Cadastre os quartos e camas da base para começar."
            cta={{ label: 'Cadastrar quartos', href: `/${slug}/hospedagem/quartos` }}
          />
        ) : !blockId ? (
          /* Nível 1: cards de Bloco */
          <div className="space-y-4">
            {canWrite && blocksList.length > 0 && (
              <div className="flex justify-end">
                <HoldForm
                  createAction={handleCreateHold}
                  scope="block"
                  label=""
                  blockOptions={blocksList.map(b => ({ id: b.id, name: b.name }))}
                />
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {blocksList.map(b => {
              const floorsCount = (floorsByBlock.get(b.id) ?? []).length
              const roomsCount = (floorsByBlock.get(b.id) ?? []).reduce((sum, f) => sum + (roomsByFloor.get(f.id) ?? []).length, 0)
              const stats = blockStats(b.id)
              const hold = holdByBlock.get(b.id)
              return (
                <BlockCard
                  key={b.id}
                  href={`/${slug}/hospedagem?block=${b.id}`}
                  name={b.name}
                  floorCount={floorsCount}
                  roomCount={roomsCount}
                  occupiedBeds={stats.occupied}
                  totalBeds={stats.total}
                  hold={hold ? { groupName: hold.group_name } : null}
                />
              )
            })}
            </div>
          </div>
        ) : !floorId ? (
          /* Nível 2: cards de Andar dentro do bloco selecionado */
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Link href={`/${slug}/hospedagem`} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                ← Todos os blocos
              </Link>
              {canWrite && currentBlock && floorsOfCurrentBlock.length > 0 && (
                <HoldForm
                  createAction={handleCreateHold}
                  scope="floor"
                  blockId={currentBlock.id}
                  label={currentBlock.name}
                  floorOptions={floorsOfCurrentBlock.map(f => ({ id: f.id, name: f.name }))}
                />
              )}
            </div>
            {currentBlockHold && (
              <HoldBanner
                cancelAction={handleCancelHold}
                holdId={currentBlockHold.id}
                groupName={currentBlockHold.group_name}
                startsAt={currentBlockHold.starts_at}
                endsAt={currentBlockHold.ends_at}
                scopeLabel="este bloco"
                backBlockId={blockId}
              />
            )}
            {floorsOfCurrentBlock.length === 0 ? (
              <EmptyState
                icon={Hotel}
                title="Nenhum andar neste bloco"
                description="Crie um andar em Gerenciar quartos antes de cadastrar quartos aqui."
                cta={{ label: 'Gerenciar quartos', href: `/${slug}/hospedagem/quartos` }}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {floorsOfCurrentBlock.map(f => {
                  const stats = floorStats(f.id)
                  const hold = holdByFloor.get(f.id) ?? currentBlockHold
                  return (
                    <FloorCard
                      key={f.id}
                      href={`/${slug}/hospedagem?block=${blockId}&floor=${f.id}`}
                      name={f.name}
                      destination={f.destination}
                      genderConstraint={f.gender_constraint}
                      roomCount={(roomsByFloor.get(f.id) ?? []).length}
                      occupiedBeds={stats.occupied}
                      totalBeds={stats.total}
                      hold={hold ? { groupName: hold.group_name } : null}
                    />
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          /* Nível 3: mapa de camas escopado a este andar */
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Link href={`/${slug}/hospedagem?block=${blockId}`} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                ← {currentBlock?.name ?? 'Voltar'}
              </Link>
              {canWrite && currentBlock && currentFloor && scopedGridRooms.length > 0 && (
                <HoldForm
                  createAction={handleCreateHold}
                  scope="room"
                  blockId={currentBlock.id}
                  floorId={currentFloor.id}
                  label={currentFloor.name}
                  roomOptions={scopedGridRooms.map(r => ({ id: r.id, name: r.name }))}
                />
              )}
            </div>
            {currentFloorHold && (
              <HoldBanner
                cancelAction={handleCancelHold}
                holdId={currentFloorHold.id}
                groupName={currentFloorHold.group_name}
                startsAt={currentFloorHold.starts_at}
                endsAt={currentFloorHold.ends_at}
                scopeLabel="este andar"
                backBlockId={blockId}
                backFloorId={floorId}
              />
            )}
            {scopedGridRooms.length === 0 ? (
              <EmptyState
                icon={Hotel}
                title="Nenhum quarto neste andar"
                description="Cadastre um quarto pra este andar em Gerenciar quartos."
                cta={{ label: 'Gerenciar quartos', href: `/${slug}/hospedagem/quartos` }}
              />
            ) : scopedGridBeds.length === 0 && scopedGridRooms.every(r => r.allocationMode === 'cama') ? (
              <EmptyState
                icon={BedDouble}
                title="Nenhuma cama cadastrada"
                description="Os quartos existem mas não têm camas. Adicione camas para gerenciar."
                cta={{ label: 'Ir para quartos', href: `/${slug}/hospedagem/quartos` }}
              />
            ) : (
              <BedGrid
                rooms={scopedGridRooms}
                beds={scopedGridBeds}
                allocs={scopedGridAllocs}
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
          </div>
        )}
      </main>
    </>
  )
}
