import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { EmptyState } from '@/components/ui/EmptyState'
import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { isManagementRole, userHasAnyRole, HOSPEDAGEM_ROLES } from '@/lib/auth/permissions'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import {
  createRoom, updateRoom, deleteRoom,
  createBlock, updateBlock, deleteBlock,
  createFloor, updateFloor, deleteFloor,
  createBed, updateBed, removeBed,
  createAllocation, updateAllocationStatus, cancelAllocation,
} from '../actions'
import { QuartosExplorer } from './QuartosExplorer'
import { Building2 } from 'lucide-react'
import Link from 'next/link'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ status?: string }>
}

export default async function QuartosPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { status: filterStatus } = await searchParams

  const supabase = await createClient()
  const sbAdmin = createAdminClient()

  const [{ data: { user } }, { data: org }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('organizations').select('id').eq('slug', slug).single(),
  ])
  if (!user || !org) notFound()

  const { role, allRoles } = await getCurrentOrganizationRole(supabase, user.id, org.id)

  if (!isManagementRole(role) && !userHasAnyRole(allRoles, HOSPEDAGEM_ROLES)) notFound()

  // ── Fetch bloco > andar > quarto ─────────────────────────────────────────────
  const [{ data: blocksData }, { data: floorsData }, roomsQuery] = await Promise.all([
    sbAdmin.from('blocks').select('id, name, display_order').eq('organization_id', org.id).order('display_order').order('name'),
    sbAdmin.from('floors').select('id, block_id, name, destination, gender_constraint, display_order').eq('organization_id', org.id).order('display_order').order('name'),
    (async () => {
      let query = sbAdmin.from('rooms')
        .select('id, name, floor_id, type, gender_constraint, destination, allocation_mode, capacity, status, notes, display_order')
        .eq('organization_id', org.id)
        .order('display_order')
        .order('name')
      if (filterStatus && filterStatus !== 'todos') query = query.eq('status', filterStatus)
      return query
    })(),
  ])
  const { data: rooms } = roomsQuery

  const blocksList = (blocksData ?? []) as Array<{ id: string; name: string; display_order: number }>
  const floorsList = (floorsData ?? []) as Array<{ id: string; block_id: string; name: string; destination: string | null; gender_constraint: string | null; display_order: number }>
  const roomsList = (rooms ?? []) as Array<{
    id: string; name: string; floor_id: string; type: string
    gender_constraint: string | null; destination: string; allocation_mode: string; capacity: number; status: string
    notes: string | null; display_order: number
  }>

  // ── Fetch beds e alocações por quarto (detalhe, não só agregado — o
  // drill-down até cama/ocupante precisa disso) ────────────────────────────────
  const roomIds = roomsList.map(r => r.id)
  const [{ data: bedsData }, { data: allocsData }] = roomIds.length > 0
    ? await Promise.all([
        sbAdmin.from('beds')
          .select('id, room_id, label, status, type, notes')
          .eq('organization_id', org.id)
          .in('room_id', roomIds),
        sbAdmin.from('room_allocations')
          .select('id, room_id, guest_name, guest_type, bed_id, check_in, check_out, actual_check_in, actual_check_out, status, notes')
          .eq('organization_id', org.id)
          .in('room_id', roomIds)
          .order('check_in', { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }]

  // Objeto plano (não Map) porque isso cruza a fronteira server → client
  // component pro QuartosExplorer.
  const bedsByRoom: Record<string, Array<{ id: string; label: string; status: string; type: string; notes: string | null }>> = {}
  for (const bed of (bedsData ?? []) as Array<{ id: string; room_id: string; label: string; status: string; type: string; notes: string | null }>) {
    ;(bedsByRoom[bed.room_id] ??= []).push(bed)
  }

  const allocationsByRoom: Record<string, Array<{
    id: string; guest_name: string; guest_type: string; bed_id: string | null; bed_label: string | null
    check_in: string; check_out: string; actual_check_in: string | null; actual_check_out: string | null
    status: string; notes: string | null
  }>> = {}
  for (const a of (allocsData ?? []) as Array<{
    id: string; room_id: string; guest_name: string; guest_type: string; bed_id: string | null
    check_in: string; check_out: string; actual_check_in: string | null; actual_check_out: string | null
    status: string; notes: string | null
  }>) {
    const bedLabel = a.bed_id ? bedsByRoom[a.room_id]?.find(b => b.id === a.bed_id)?.label ?? null : null
    ;(allocationsByRoom[a.room_id] ??= []).push({ ...a, bed_label: bedLabel })
  }

  // ── Contagem de status não-filtrada, pro dashboard (não deve mudar quando
  // o usuário clica numa aba de filtro, senão perde a noção do total) ────────
  const { data: allRoomsStatus } = await sbAdmin.from('rooms')
    .select('status')
    .eq('organization_id', org.id)
  const statusCounts = { ativo: 0, manutencao: 0, inativo: 0 }
  for (const r of (allRoomsStatus ?? []) as Array<{ status: string }>) {
    if (r.status in statusCounts) statusCounts[r.status as keyof typeof statusCounts]++
  }
  const totalRoomsCount = (allRoomsStatus ?? []).length

  // Também não filtrado por aba — mesma lógica do totalRoomsCount acima.
  const { count: totalBedsCount } = await sbAdmin.from('beds')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', org.id)

  const floorOptions = floorsList.map(f => ({
    id: f.id,
    name: f.name,
    blockName: blocksList.find(b => b.id === f.block_id)?.name ?? '—',
    destination: f.destination,
    genderConstraint: f.gender_constraint,
  }))

  // ── Server actions ──────────────────────────────────────────────────────────
  // Sem redirect: fica na mesma tela, só invalida o cache do RSC — o client
  // component fecha o modal na hora (não espera reload nenhum) e mostra um
  // toast local; ver QuartosExplorer/BlockForm/FloorForm/RoomForm.
  const quartosPath = `/${slug}/hospedagem/quartos`

  const handleCreateBlock = async (formData: FormData) => {
    'use server'
    const name = (formData.get('name') as string).trim()
    if (!name) return
    await createBlock({ organizationId: org.id, name, createdBy: user.id })
    revalidatePath(quartosPath)
  }

  const handleEditBlock = async (formData: FormData) => {
    'use server'
    const name = (formData.get('name') as string).trim()
    if (!name) return
    await updateBlock({ id: formData.get('id') as string, organizationId: org.id, name })
    revalidatePath(quartosPath)
  }

  const handleDeleteBlock = async (id: string) => {
    'use server'
    await deleteBlock({ id, organizationId: org.id })
    revalidatePath(quartosPath)
  }

  const handleCreateFloor = async (formData: FormData) => {
    'use server'
    const name = (formData.get('name') as string).trim()
    if (!name) return
    await createFloor({
      organizationId: org.id,
      blockId: formData.get('block_id') as string,
      name,
      destination: (formData.get('destination') as string) || null,
      genderConstraint: (formData.get('gender_constraint') as string) || null,
      createdBy: user.id,
    })
    revalidatePath(quartosPath)
  }

  const handleEditFloor = async (formData: FormData) => {
    'use server'
    const name = (formData.get('name') as string).trim()
    if (!name) return
    await updateFloor({
      id: formData.get('id') as string,
      organizationId: org.id,
      name,
      destination: (formData.get('destination') as string) || null,
      genderConstraint: (formData.get('gender_constraint') as string) || null,
    })
    revalidatePath(quartosPath)
  }

  const handleDeleteFloor = async (id: string) => {
    'use server'
    await deleteFloor({ id, organizationId: org.id })
    revalidatePath(quartosPath)
  }

  const handleDeleteRoom = async (id: string) => {
    'use server'
    await deleteRoom({ id, organizationId: org.id })
    revalidatePath(quartosPath)
  }

  const handleCreate = async (formData: FormData) => {
    'use server'
    const name = (formData.get('name') as string).trim()
    const floorId = formData.get('floor_id') as string
    if (!name || !floorId) return
    await createRoom({
      organizationId:   org.id,
      name,
      floorId,
      type:             formData.get('type') as string,
      genderConstraint: (formData.get('gender_constraint') as string) || null,
      destination:      formData.get('destination') as string ?? 'visita',
      allocationMode:   formData.get('allocation_mode') as string ?? 'cama',
      notes:            (formData.get('notes') as string)?.trim() || null,
      createdBy:        user.id,
    })
    revalidatePath(quartosPath)
  }

  const handleEdit = async (formData: FormData) => {
    'use server'
    const id   = formData.get('id') as string
    const name = (formData.get('name') as string).trim()
    const floorId = formData.get('floor_id') as string
    if (!name || !floorId) return
    await updateRoom({
      id,
      organizationId:   org.id,
      name,
      floorId,
      type:             formData.get('type') as string,
      genderConstraint: (formData.get('gender_constraint') as string) || null,
      destination:      formData.get('destination') as string ?? 'visita',
      allocationMode:   formData.get('allocation_mode') as string ?? 'cama',
      status:           formData.get('status') as string ?? 'ativo',
      notes:            (formData.get('notes') as string)?.trim() || null,
    })
    revalidatePath(quartosPath)
  }

  const handleCreateBed = async (formData: FormData) => {
    'use server'
    const roomId = formData.get('room_id') as string
    const label = (formData.get('label') as string).trim()
    if (!roomId || !label) return
    await createBed({
      roomId,
      organizationId: org.id,
      label,
      type: formData.get('type') as string,
      notes: null,
    })
    revalidatePath(quartosPath)
  }

  const handleEditBed = async (formData: FormData) => {
    'use server'
    const id = formData.get('id') as string
    const label = (formData.get('label') as string).trim()
    if (!id || !label) return
    await updateBed({
      id,
      organizationId: org.id,
      label,
      type: formData.get('type') as string,
      status: formData.get('status') as string,
      notes: (formData.get('notes') as string)?.trim() || null,
    })
    revalidatePath(quartosPath)
  }

  const handleDeleteBed = async (id: string, roomId: string) => {
    'use server'
    await removeBed({ id, roomId, organizationId: org.id })
    revalidatePath(quartosPath)
  }

  const handleCreateAllocation = async (roomId: string, formData: FormData) => {
    'use server'
    const guestName = (formData.get('guest_name') as string).trim()
    if (!guestName) return
    await createAllocation({
      organizationId: org.id,
      roomId,
      bedId:          (formData.get('bed_id') as string) || null,
      reservationId:  null,
      personId:       null,
      guestName,
      guestType:      formData.get('guest_type') as string,
      checkIn:        formData.get('check_in') as string,
      checkOut:       formData.get('check_out') as string,
      notes:          (formData.get('notes') as string)?.trim() || null,
      createdBy:      user.id,
    })
    revalidatePath(quartosPath)
  }

  const handleCheckin = async (formData: FormData) => {
    'use server'
    await updateAllocationStatus({
      id: formData.get('id') as string, organizationId: org.id,
      status: 'checkin', bedId: (formData.get('bed_id') as string) || null,
    })
    revalidatePath(quartosPath)
  }

  const handleCheckout = async (formData: FormData) => {
    'use server'
    await updateAllocationStatus({
      id: formData.get('id') as string, organizationId: org.id,
      status: 'checkout', bedId: (formData.get('bed_id') as string) || null,
    })
    revalidatePath(quartosPath)
  }

  const handleCancelAllocation = async (formData: FormData) => {
    'use server'
    await cancelAllocation({
      id: formData.get('id') as string, organizationId: org.id,
      bedId: (formData.get('bed_id') as string) || null,
    })
    revalidatePath(quartosPath)
  }

  const activeTab = filterStatus || 'todos'

  const kpiTiles: Array<{ key: string; label: string; value: number; href?: string; valueCls?: string }> = [
    { key: 'blocos',  label: 'Blocos',  value: blocksList.length },
    { key: 'andares', label: 'Andares', value: floorsList.length },
    { key: 'camas',   label: 'Camas',   value: totalBedsCount ?? 0 },
    { key: 'todos',       label: 'Todos',      value: totalRoomsCount,        href: '?status=todos' },
    { key: 'ativo',       label: 'Ativos',     value: statusCounts.ativo,      href: '?status=ativo',      valueCls: 'text-green-600' },
    { key: 'manutencao',  label: 'Manutenção', value: statusCounts.manutencao, href: '?status=manutencao', valueCls: 'text-yellow-600' },
    { key: 'inativo',     label: 'Inativos',   value: statusCounts.inativo,    href: '?status=inativo',    valueCls: 'text-gray-500' },
  ]

  return (
    <>
      <Header title="Quartos" backHref={`/${slug}/hospedagem`} />
      <main className="p-4 md:p-6 space-y-6 max-w-4xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-gray-500">Visão geral</h2>
          <Link
            href={`/${slug}/hospedagem/quartos/importar`}
            className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors"
          >
            Importar em lote
          </Link>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
          {kpiTiles.map(tile => {
            const isActive = !!tile.href && activeTab === tile.key
            const cls = `rounded-xl border px-3 py-2.5 transition-colors ${
              isActive ? 'border-brand-300 bg-brand-50' : 'border-gray-200 bg-white'
            } ${tile.href ? 'hover:bg-gray-50 cursor-pointer' : ''}`
            const content = (
              <>
                <p className={`text-xl font-semibold ${tile.valueCls ?? 'text-gray-900'}`}>{tile.value}</p>
                <p className="text-[11px] text-gray-400">{tile.label}</p>
              </>
            )
            return tile.href
              ? <a key={tile.key} href={tile.href} className={cls}>{content}</a>
              : <div key={tile.key} className={cls}>{content}</div>
          })}
        </div>

        {blocksList.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Nenhum bloco cadastrado"
            description="Comece criando um bloco (ex.: prédio, ala) — depois os andares e por fim os quartos dentro dele."
          />
        ) : (
          <QuartosExplorer
            blocks={blocksList}
            floors={floorsList}
            rooms={roomsList}
            bedsByRoom={bedsByRoom}
            allocationsByRoom={allocationsByRoom}
            floorOptions={floorOptions}
            createBlockAction={handleCreateBlock}
            editBlockAction={handleEditBlock}
            deleteBlockAction={handleDeleteBlock}
            createFloorAction={handleCreateFloor}
            editFloorAction={handleEditFloor}
            deleteFloorAction={handleDeleteFloor}
            createRoomAction={handleCreate}
            editRoomAction={handleEdit}
            deleteRoomAction={handleDeleteRoom}
            createBedAction={handleCreateBed}
            editBedAction={handleEditBed}
            deleteBedAction={handleDeleteBed}
            createAllocationAction={handleCreateAllocation}
            checkinAction={handleCheckin}
            checkoutAction={handleCheckout}
            cancelAllocationAction={handleCancelAllocation}
          />
        )}
      </main>
    </>
  )
}
