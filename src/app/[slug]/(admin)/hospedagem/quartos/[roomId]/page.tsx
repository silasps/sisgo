import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { notFound, redirect } from 'next/navigation'
import { getRolePreview } from '@/lib/role-preview'
import { isManagementRole, canSeeHospedagem } from '@/lib/auth/permissions'
import { updateRoom, createBed, updateBed, removeBed, createAllocation, updateAllocationStatus, cancelAllocation } from '../../actions'
import { BedManager } from './BedManager'
import { AllocationManager } from './AllocationManager'
import { RoomForm } from '../RoomForm'
import { Pencil } from 'lucide-react'

type Props = {
  params: Promise<{ slug: string; roomId: string }>
  searchParams: Promise<{ msg?: string }>
}

const TYPE_LABELS: Record<string, string> = {
  quarto: 'Quarto', suite: 'Suíte', dormitorio: 'Dormitório', casal: 'Casal',
}

const GENDER_LABELS: Record<string, { label: string; cls: string }> = {
  masculino: { label: 'Masculino', cls: 'bg-blue-100 text-blue-700' },
  feminino:  { label: 'Feminino',  cls: 'bg-pink-100 text-pink-700' },
  misto:     { label: 'Misto',     cls: 'bg-purple-100 text-purple-700' },
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  ativo:      { label: 'Ativo',      cls: 'bg-green-100 text-green-700' },
  manutencao: { label: 'Manutenção', cls: 'bg-yellow-100 text-yellow-700' },
  inativo:    { label: 'Inativo',    cls: 'bg-gray-100 text-gray-500' },
}

export default async function RoomDetailPage({ params, searchParams }: Props) {
  const { slug, roomId } = await params
  const { msg } = await searchParams

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

  // ── Fetch room ──────────────────────────────────────────────────────────────
  const { data: room } = await sbAdmin.from('rooms')
    .select('id, name, floor, type, gender_constraint, capacity, status, notes')
    .eq('id', roomId)
    .eq('organization_id', org.id)
    .single()

  if (!room) notFound()

  // ── Fetch beds ──────────────────────────────────────────────────────────────
  const { data: bedsRaw } = await sbAdmin.from('beds')
    .select('id, label, type, status, notes')
    .eq('room_id', roomId)
    .eq('organization_id', org.id)
    .order('position')
    .order('label')

  const bedsList = (bedsRaw ?? []) as Array<{
    id: string; label: string; type: string; status: string; notes: string | null
  }>

  // ── Fetch allocations ───────────────────────────────────────────────────────
  const { data: allocsRaw } = await sbAdmin.from('room_allocations')
    .select('id, guest_name, guest_type, bed_id, check_in, check_out, actual_check_in, actual_check_out, status, notes')
    .eq('room_id', roomId)
    .eq('organization_id', org.id)
    .order('check_in', { ascending: false })

  type AllocRow = {
    id: string; guest_name: string; guest_type: string; bed_id: string | null
    check_in: string; check_out: string; actual_check_in: string | null
    actual_check_out: string | null; status: string; notes: string | null
  }
  const allocations = (allocsRaw ?? []) as AllocRow[]

  // Map bed_id → occupant for bed cards
  const bedOccupants = new Map<string, string>()
  for (const a of allocations) {
    if (a.bed_id && (a.status === 'checkin' || a.status === 'confirmada')) {
      bedOccupants.set(a.bed_id, a.guest_name)
    }
  }

  const bedsWithOccupants = bedsList.map(b => ({
    ...b,
    occupant: bedOccupants.get(b.id) ?? null,
  }))

  const allocsForManager = allocations.map(a => ({
    ...a,
    bed_label: a.bed_id ? bedsList.find(b => b.id === a.bed_id)?.label ?? null : null,
  }))

  const availableBeds = bedsList
    .filter(b => b.status === 'disponivel')
    .map(b => ({ id: b.id, label: b.label }))

  // ── Server actions ──────────────────────────────────────────────────────────
  const handleEditRoom = async (formData: FormData) => {
    'use server'
    const name = (formData.get('name') as string).trim()
    if (!name) return
    await updateRoom({
      id: roomId,
      organizationId:   org.id,
      name,
      floor:            (formData.get('floor') as string)?.trim() || null,
      type:             formData.get('type') as string,
      genderConstraint: (formData.get('gender_constraint') as string) || null,
      status:           formData.get('status') as string ?? 'ativo',
      notes:            (formData.get('notes') as string)?.trim() || null,
    })
    redirect(`/${slug}/hospedagem/quartos/${roomId}?msg=quarto_atualizado`)
  }

  const handleAddBed = async (formData: FormData) => {
    'use server'
    const label = (formData.get('label') as string).trim()
    if (!label) return
    await createBed({
      roomId,
      organizationId: org.id,
      label,
      type:  formData.get('type') as string,
      notes: (formData.get('notes') as string)?.trim() || null,
    })
    redirect(`/${slug}/hospedagem/quartos/${roomId}?msg=cama_adicionada`)
  }

  const handleEditBed = async (formData: FormData) => {
    'use server'
    const id    = formData.get('id') as string
    const label = (formData.get('label') as string).trim()
    if (!label) return
    await updateBed({
      id,
      organizationId: org.id,
      label,
      type:   formData.get('type') as string,
      status: formData.get('status') as string,
      notes:  (formData.get('notes') as string)?.trim() || null,
    })
    redirect(`/${slug}/hospedagem/quartos/${roomId}?msg=cama_atualizada`)
  }

  const handleRemoveBed = async (formData: FormData) => {
    'use server'
    await removeBed({
      id:             formData.get('id') as string,
      roomId,
      organizationId: org.id,
    })
    redirect(`/${slug}/hospedagem/quartos/${roomId}?msg=cama_removida`)
  }

  const handleCreateAllocation = async (formData: FormData) => {
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
    redirect(`/${slug}/hospedagem/quartos/${roomId}?msg=alocacao_criada`)
  }

  const handleCheckin = async (formData: FormData) => {
    'use server'
    await updateAllocationStatus({
      id:             formData.get('id') as string,
      organizationId: org.id,
      status:         'checkin',
      bedId:          (formData.get('bed_id') as string) || null,
    })
    redirect(`/${slug}/hospedagem/quartos/${roomId}`)
  }

  const handleCheckout = async (formData: FormData) => {
    'use server'
    await updateAllocationStatus({
      id:             formData.get('id') as string,
      organizationId: org.id,
      status:         'checkout',
      bedId:          (formData.get('bed_id') as string) || null,
    })
    redirect(`/${slug}/hospedagem/quartos/${roomId}`)
  }

  const handleCancelAllocation = async (formData: FormData) => {
    'use server'
    await cancelAllocation({
      id:             formData.get('id') as string,
      organizationId: org.id,
      bedId:          (formData.get('bed_id') as string) || null,
    })
    redirect(`/${slug}/hospedagem/quartos/${roomId}`)
  }

  const st     = STATUS_LABELS[room.status] ?? STATUS_LABELS.ativo
  const gender = room.gender_constraint ? GENDER_LABELS[room.gender_constraint] : null

  const msgInfo: Record<string, string> = {
    quarto_atualizado: 'Quarto atualizado.',
    cama_adicionada:   'Cama adicionada.',
    cama_atualizada:   'Cama atualizada.',
    cama_removida:     'Cama removida.',
    alocacao_criada:   'Hóspede alocado com sucesso.',
  }

  return (
    <>
      <Header title={room.name} />
      <main className="p-4 md:p-6 space-y-6 max-w-3xl">
        {msg && msgInfo[msg] && (
          <div className="border rounded-lg px-4 py-3 text-sm bg-blue-50 border-blue-200 text-blue-700">
            {msgInfo[msg]}
          </div>
        )}

        {/* Room info card */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                  {TYPE_LABELS[room.type] ?? room.type}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${st.cls}`}>
                  {st.label}
                </span>
                {gender && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${gender.cls}`}>
                    {gender.label}
                  </span>
                )}
              </div>
              {room.floor && (
                <p className="text-xs text-gray-400">{room.floor}</p>
              )}
              {room.notes && (
                <p className="text-xs text-gray-500">{room.notes}</p>
              )}
              <p className="text-xs text-gray-400">Capacidade: {room.capacity} cama{room.capacity !== 1 ? 's' : ''}</p>
            </div>
            <RoomForm
              createAction={handleEditRoom}
              editAction={handleEditRoom}
              room={room}
              trigger={
                <button
                  type="button"
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                >
                  <Pencil size={16} />
                </button>
              }
            />
          </div>
        </div>

        {/* Beds section */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <BedManager
            beds={bedsWithOccupants}
            addAction={handleAddBed}
            editAction={handleEditBed}
            removeAction={handleRemoveBed}
          />
        </div>

        {/* Allocations section */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <AllocationManager
            allocations={allocsForManager}
            beds={availableBeds}
            createAction={handleCreateAllocation}
            checkinAction={handleCheckin}
            checkoutAction={handleCheckout}
            cancelAction={handleCancelAllocation}
          />
        </div>
      </main>
    </>
  )
}
