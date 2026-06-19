import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { EmptyState } from '@/components/ui/EmptyState'
import { notFound, redirect } from 'next/navigation'
import { getRolePreview } from '@/lib/role-preview'
import { isManagementRole, canSeeHospedagem } from '@/lib/auth/permissions'
import { createRoom, updateRoom } from '../actions'
import { RoomForm } from './RoomForm'
import { BedDouble } from 'lucide-react'
import Link from 'next/link'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ status?: string; msg?: string }>
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

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  ativo:      { label: 'Ativo',      cls: 'bg-green-100 text-green-700' },
  manutencao: { label: 'Manutenção', cls: 'bg-yellow-100 text-yellow-700' },
  inativo:    { label: 'Inativo',    cls: 'bg-gray-100 text-gray-500' },
}

export default async function QuartosPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { status: filterStatus, msg } = await searchParams

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

  // ── Fetch rooms ─────────────────────────────────────────────────────────────
  let query = sbAdmin.from('rooms')
    .select('id, name, floor, type, gender_constraint, capacity, status, notes, display_order')
    .eq('organization_id', org.id)
    .order('display_order')
    .order('name')

  if (filterStatus && filterStatus !== 'todos') {
    query = query.eq('status', filterStatus)
  }

  const { data: rooms } = await query
  const roomsList = (rooms ?? []) as Array<{
    id: string; name: string; floor: string | null; type: string
    gender_constraint: string | null; capacity: number; status: string
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

  // ── Server actions ──────────────────────────────────────────────────────────
  const handleCreate = async (formData: FormData) => {
    'use server'
    const name = (formData.get('name') as string).trim()
    if (!name) return
    await createRoom({
      organizationId:   org.id,
      name,
      floor:            (formData.get('floor') as string)?.trim() || null,
      block:            (formData.get('block') as string)?.trim() || null,
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
    if (!name) return
    await updateRoom({
      id,
      organizationId:   org.id,
      name,
      floor:            (formData.get('floor') as string)?.trim() || null,
      block:            (formData.get('block') as string)?.trim() || null,
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
  }

  const statusTabs = [
    { key: 'todos', label: 'Todos' },
    { key: 'ativo', label: 'Ativos' },
    { key: 'manutencao', label: 'Manutenção' },
    { key: 'inativo', label: 'Inativos' },
  ]
  const activeTab = filterStatus || 'todos'

  return (
    <>
      <Header title="Quartos" />
      <main className="p-4 md:p-6 space-y-6 max-w-4xl">
        {msg && msgInfo[msg] && (
          <div className="border rounded-lg px-4 py-3 text-sm bg-blue-50 border-blue-200 text-blue-700">
            {msgInfo[msg]}
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
          <RoomForm createAction={handleCreate} editAction={handleEdit} />
        </div>

        {roomsList.length === 0 ? (
          <EmptyState
            icon={BedDouble}
            title="Nenhum quarto cadastrado"
            description="Cadastre os quartos e alojamentos da base para começar a gerenciar a hospedagem."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {roomsList.map(room => {
              const beds   = bedsByRoom.get(room.id) ?? { total: 0, occupied: 0 }
              const st     = STATUS_LABELS[room.status] ?? STATUS_LABELS.ativo
              const gender = room.gender_constraint ? GENDER_LABELS[room.gender_constraint] : null
              const pct    = beds.total > 0 ? Math.round((beds.occupied / beds.total) * 100) : 0

              return (
                <Link
                  key={room.id}
                  href={`/${slug}/hospedagem/quartos/${room.id}`}
                  className="group bg-white rounded-xl border border-gray-200 p-4 space-y-3 transition-all hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-2">
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
                    {room.floor && (
                      <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">
                        {room.floor}
                      </span>
                    )}
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
            })}
          </div>
        )}
      </main>
    </>
  )
}
