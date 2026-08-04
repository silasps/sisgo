import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmSubmitButton } from '@/components/ui/ConfirmSubmitButton'
import { StopClickPropagation } from '@/components/ui/StopClickPropagation'
import { notFound, redirect } from 'next/navigation'
import { getRolePreview } from '@/lib/role-preview'
import { isManagementRole, canSeeHospedagem } from '@/lib/auth/permissions'
import {
  createRoom, updateRoom,
  createBlock, updateBlock, deleteBlock,
  createFloor, updateFloor, deleteFloor,
} from '../actions'
import { RoomForm } from './RoomForm'
import { BlockForm } from './BlockForm'
import { FloorForm } from './FloorForm'
import { BedDouble, Building2 } from 'lucide-react'
import Link from 'next/link'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ status?: string; msg?: string; error?: string }>
}

const TYPE_LABELS: Record<string, string> = {
  quarto: 'Quarto',
  suite: 'Suíte',
  dormitorio: 'Dormitório',
  casal: 'Casal',
}

const GENDER_LABELS: Record<string, { label: string; cls: string }> = {
  masculino: { label: 'Masc.', cls: 'bg-blue-100 text-blue-700' },
  feminino:  { label: 'Fem.',  cls: 'bg-pink-100 text-pink-700' },
  misto:     { label: 'Misto', cls: 'bg-purple-100 text-purple-700' },
}

const DESTINATION_LABELS: Record<string, string> = {
  visita: 'Visitantes', aluno: 'Alunos', obreiro: 'Obreiros',
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  ativo:      { label: 'Ativo',      cls: 'bg-green-100 text-green-700' },
  manutencao: { label: 'Manutenção', cls: 'bg-yellow-100 text-yellow-700' },
  inativo:    { label: 'Inativo',    cls: 'bg-gray-100 text-gray-500' },
}

export default async function QuartosPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { status: filterStatus, msg, error } = await searchParams

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

  // ── Fetch bloco > andar > quarto ─────────────────────────────────────────────
  const [{ data: blocksData }, { data: floorsData }, roomsQuery] = await Promise.all([
    sbAdmin.from('blocks').select('id, name, display_order').eq('organization_id', org.id).order('display_order').order('name'),
    sbAdmin.from('floors').select('id, block_id, name, destination, gender_constraint, display_order').eq('organization_id', org.id).order('display_order').order('name'),
    (async () => {
      let query = sbAdmin.from('rooms')
        .select('id, name, floor_id, type, gender_constraint, destination, capacity, status, notes, display_order')
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
    gender_constraint: string | null; destination: string; capacity: number; status: string
    notes: string | null; display_order: number
  }>

  // ── Fetch beds count per room ───────────────────────────────────────────────
  const roomIds = roomsList.map(r => r.id)
  const { data: bedsData } = roomIds.length > 0
    ? await sbAdmin.from('beds')
        .select('room_id, status')
        .eq('organization_id', org.id)
        .in('room_id', roomIds)
    : { data: [] }

  const bedsByRoom = new Map<string, { total: number; occupied: number }>()
  for (const bed of (bedsData ?? []) as Array<{ room_id: string; status: string }>) {
    const entry = bedsByRoom.get(bed.room_id) ?? { total: 0, occupied: 0 }
    entry.total++
    if (bed.status === 'ocupada') entry.occupied++
    bedsByRoom.set(bed.room_id, entry)
  }

  const floorOptions = floorsList.map(f => ({
    id: f.id,
    name: f.name,
    blockName: blocksList.find(b => b.id === f.block_id)?.name ?? '—',
    destination: f.destination,
    genderConstraint: f.gender_constraint,
  }))

  // ── Server actions ──────────────────────────────────────────────────────────
  const handleCreateBlock = async (formData: FormData) => {
    'use server'
    const name = (formData.get('name') as string).trim()
    if (!name) return
    await createBlock({ organizationId: org.id, name, createdBy: user.id })
    redirect(`/${slug}/hospedagem/quartos?msg=bloco_criado`)
  }

  const handleEditBlock = async (formData: FormData) => {
    'use server'
    const name = (formData.get('name') as string).trim()
    if (!name) return
    await updateBlock({ id: formData.get('id') as string, organizationId: org.id, name })
    redirect(`/${slug}/hospedagem/quartos?msg=bloco_atualizado`)
  }

  const handleDeleteBlock = async (formData: FormData) => {
    'use server'
    try {
      await deleteBlock({ id: formData.get('id') as string, organizationId: org.id })
      redirect(`/${slug}/hospedagem/quartos?msg=bloco_removido`)
    } catch (e) {
      redirect(`/${slug}/hospedagem/quartos?error=${encodeURIComponent((e as Error).message)}`)
    }
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
    redirect(`/${slug}/hospedagem/quartos?msg=andar_criado`)
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
    redirect(`/${slug}/hospedagem/quartos?msg=andar_atualizado`)
  }

  const handleDeleteFloor = async (formData: FormData) => {
    'use server'
    try {
      await deleteFloor({ id: formData.get('id') as string, organizationId: org.id })
      redirect(`/${slug}/hospedagem/quartos?msg=andar_removido`)
    } catch (e) {
      redirect(`/${slug}/hospedagem/quartos?error=${encodeURIComponent((e as Error).message)}`)
    }
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
    redirect(`/${slug}/hospedagem/quartos?msg=criado`)
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
    redirect(`/${slug}/hospedagem/quartos?msg=atualizado`)
  }

  const msgInfo: Record<string, string> = {
    criado:     'Quarto criado com sucesso.',
    atualizado: 'Quarto atualizado.',
    bloco_criado: 'Bloco criado.',
    bloco_atualizado: 'Bloco atualizado.',
    bloco_removido: 'Bloco removido.',
    andar_criado: 'Andar criado.',
    andar_atualizado: 'Andar atualizado.',
    andar_removido: 'Andar removido.',
  }

  const statusTabs = [
    { key: 'todos', label: 'Todos' },
    { key: 'ativo', label: 'Ativos' },
    { key: 'manutencao', label: 'Manutenção' },
    { key: 'inativo', label: 'Inativos' },
  ]
  const activeTab = filterStatus || 'todos'

  function RoomCard({ room }: { room: typeof roomsList[number] }) {
    const beds   = bedsByRoom.get(room.id) ?? { total: 0, occupied: 0 }
    const st     = STATUS_LABELS[room.status] ?? STATUS_LABELS.ativo
    const gender = room.gender_constraint ? GENDER_LABELS[room.gender_constraint] : null
    const pct    = beds.total > 0 ? Math.round((beds.occupied / beds.total) * 100) : 0

    return (
      <Link
        href={`/${slug}/hospedagem/quartos/${room.id}`}
        className="group bg-white rounded-xl border border-gray-200 p-4 space-y-3 transition-all hover:shadow-md hover:-translate-y-0.5"
      >
        <div className="min-w-0">
          <p className="font-medium text-gray-900 group-hover:text-brand-600 transition-colors">
            {room.name}
          </p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="text-[10px] font-medium bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
              {TYPE_LABELS[room.type] ?? room.type}
            </span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${st.cls}`}>
              {st.label}
            </span>
            {gender && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${gender.cls}`}>
                {gender.label}
              </span>
            )}
          </div>
        </div>

        {beds.total > 0 ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{beds.occupied}/{beds.total} camas ocupadas</span>
              <span className="font-medium">{pct}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  pct >= 90 ? 'bg-red-400' : pct >= 60 ? 'bg-yellow-400' : 'bg-green-400'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400">Nenhuma cama cadastrada</p>
        )}

        <p className="text-[10px] text-brand-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          Abrir →
        </p>
      </Link>
    )
  }

  return (
    <>
      <Header title="Quartos" backHref={`/${slug}/hospedagem`} />
      <main className="p-4 md:p-6 space-y-6 max-w-4xl">
        {msg && msgInfo[msg] && (
          <div className="border rounded-lg px-4 py-3 text-sm bg-blue-50 border-blue-200 text-blue-700">
            {msgInfo[msg]}
          </div>
        )}
        {error && (
          <div className="border rounded-lg px-4 py-3 text-sm bg-red-50 border-red-200 text-red-700">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            {statusTabs.map(t => (
              <a
                key={t.key}
                href={`?status=${t.key}`}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTab === t.key
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </a>
            ))}
          </div>
          <BlockForm createAction={handleCreateBlock} editAction={handleEditBlock} />
        </div>

        {blocksList.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Nenhum bloco cadastrado"
            description="Comece criando um bloco (ex.: prédio, ala) — depois os andares e por fim os quartos dentro dele."
          />
        ) : (
          <div className="space-y-4">
            {blocksList.map(block => {
              const blockFloors = floorsList.filter(f => f.block_id === block.id)
              return (
                <details key={block.id} className="group bg-white rounded-xl border border-gray-200 overflow-hidden [&_summary::-webkit-details-marker]:hidden" open>
                  <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-2 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 size={16} className="text-gray-400 shrink-0" />
                      <span className="font-semibold text-gray-900 truncate">{block.name}</span>
                      <span className="text-xs text-gray-400 shrink-0">
                        {blockFloors.length} andar{blockFloors.length !== 1 ? 'es' : ''}
                      </span>
                    </div>
                    <StopClickPropagation>
                      <BlockForm
                        createAction={handleCreateBlock}
                        editAction={handleEditBlock}
                        block={block}
                        trigger={<span className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer">Editar</span>}
                      />
                      <form action={handleDeleteBlock}>
                        <input type="hidden" name="id" value={block.id} />
                        <ConfirmSubmitButton
                          confirmMessage={`Remover o bloco "${block.name}"? Só funciona se não tiver andar dentro.`}
                          className="text-xs text-gray-400 hover:text-red-500"
                        >
                          Remover
                        </ConfirmSubmitButton>
                      </form>
                      <FloorForm createAction={handleCreateFloor} editAction={handleEditFloor} blockId={block.id} />
                    </StopClickPropagation>
                  </summary>

                  <div className="border-t border-gray-100 divide-y divide-gray-100">
                    {blockFloors.length === 0 ? (
                      <p className="px-4 py-4 text-xs text-gray-400">Nenhum andar neste bloco ainda.</p>
                    ) : (
                      blockFloors.map(floor => {
                        const floorRooms = roomsList.filter(r => r.floor_id === floor.id)
                        return (
                          <details key={floor.id} className="[&_summary::-webkit-details-marker]:hidden" open>
                            <summary className="cursor-pointer list-none px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-gray-50 transition-colors bg-gray-50/50">
                              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                <span className="font-medium text-sm text-gray-800">{floor.name}</span>
                                {floor.destination && (
                                  <span className="text-[10px] font-medium bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                                    {DESTINATION_LABELS[floor.destination]}
                                  </span>
                                )}
                                {floor.gender_constraint && (
                                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${GENDER_LABELS[floor.gender_constraint].cls}`}>
                                    {GENDER_LABELS[floor.gender_constraint].label}
                                  </span>
                                )}
                                <span className="text-xs text-gray-400">
                                  {floorRooms.length} quarto{floorRooms.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                              <StopClickPropagation>
                                <FloorForm
                                  createAction={handleCreateFloor}
                                  editAction={handleEditFloor}
                                  blockId={block.id}
                                  floor={floor}
                                  trigger={<span className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer">Editar</span>}
                                />
                                <form action={handleDeleteFloor}>
                                  <input type="hidden" name="id" value={floor.id} />
                                  <ConfirmSubmitButton
                                    confirmMessage={`Remover o andar "${floor.name}"? Só funciona se não tiver quarto dentro.`}
                                    className="text-xs text-gray-400 hover:text-red-500"
                                  >
                                    Remover
                                  </ConfirmSubmitButton>
                                </form>
                                <RoomForm
                                  createAction={handleCreate}
                                  editAction={handleEdit}
                                  floors={floorOptions}
                                  defaultFloorId={floor.id}
                                  trigger={<span className="text-xs font-medium text-brand-500 hover:text-brand-700 cursor-pointer">+ Quarto</span>}
                                />
                              </StopClickPropagation>
                            </summary>

                            <div className="px-4 pb-4 pt-2">
                              {floorRooms.length === 0 ? (
                                <p className="text-xs text-gray-400 py-2">Nenhum quarto neste andar ainda.</p>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {floorRooms.map(room => <RoomCard key={room.id} room={room} />)}
                                </div>
                              )}
                            </div>
                          </details>
                        )
                      })
                    )}
                  </div>
                </details>
              )
            })}
          </div>
        )}

        {blocksList.length > 0 && roomsList.length === 0 && !filterStatus && (
          <EmptyState
            icon={BedDouble}
            title="Nenhum quarto cadastrado ainda"
            description="Dentro de um andar, clique em “+ Quarto” pra cadastrar o primeiro."
          />
        )}
      </main>
    </>
  )
}
