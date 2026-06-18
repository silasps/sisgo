import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { EmptyState } from '@/components/ui/EmptyState'
import { notFound } from 'next/navigation'
import { getRolePreview } from '@/lib/role-preview'
import { isManagementRole, canSeeHospedagem } from '@/lib/auth/permissions'
import { Hotel, BedDouble, DoorOpen, LogIn, LogOut } from 'lucide-react'
import Link from 'next/link'

type Props = {
  params: Promise<{ slug: string }>
}

const GENDER_LABELS: Record<string, { label: string; cls: string }> = {
  masculino: { label: 'Masc.', cls: 'bg-blue-100 text-blue-700' },
  feminino:  { label: 'Fem.',  cls: 'bg-pink-100 text-pink-700' },
  misto:     { label: 'Misto', cls: 'bg-purple-100 text-purple-700' },
}

const GUEST_TYPE_CLS: Record<string, string> = {
  aluno:       'text-blue-600',
  obreiro:     'text-green-600',
  visitante:   'text-orange-600',
  missionario: 'text-teal-600',
  convidado:   'text-purple-600',
}

export default async function HospedagemPage({ params }: Props) {
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

  // ── Data queries ────────────────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0]

  const [{ data: rooms }, { data: beds }, { data: allocations }] = await Promise.all([
    sbAdmin.from('rooms')
      .select('id, name, floor, type, gender_constraint, capacity, status')
      .eq('organization_id', org.id)
      .neq('status', 'inativo')
      .order('display_order')
      .order('name'),
    sbAdmin.from('beds')
      .select('id, room_id, label, type, status')
      .eq('organization_id', org.id),
    sbAdmin.from('room_allocations')
      .select('id, room_id, bed_id, guest_name, guest_type, check_in, check_out, status')
      .eq('organization_id', org.id)
      .neq('status', 'cancelada')
      .lte('check_in', today)
      .gte('check_out', today),
  ])

  type RoomRow = { id: string; name: string; floor: string | null; type: string; gender_constraint: string | null; capacity: number; status: string }
  type BedRow  = { id: string; room_id: string; label: string; type: string; status: string }
  type AllocRow = { id: string; room_id: string; bed_id: string | null; guest_name: string; guest_type: string; check_in: string; check_out: string; status: string }

  const roomsList = (rooms ?? []) as RoomRow[]
  const bedsList  = (beds ?? []) as BedRow[]
  const allocsList = (allocations ?? []) as AllocRow[]

  // ── Compute KPIs ────────────────────────────────────────────────────────────
  const totalRooms     = roomsList.length
  const totalBeds      = bedsList.filter(b => b.status !== 'manutencao').length
  const occupiedBeds   = bedsList.filter(b => b.status === 'ocupada').length
  const availableBeds  = totalBeds - occupiedBeds
  const arrivalsToday  = allocsList.filter(a => a.check_in === today).length
  const depaturesToday = allocsList.filter(a => a.check_out === today).length

  // ── Group data by room ──────────────────────────────────────────────────────
  const bedsByRoom = new Map<string, BedRow[]>()
  for (const bed of bedsList) {
    const list = bedsByRoom.get(bed.room_id) ?? []
    list.push(bed)
    bedsByRoom.set(bed.room_id, list)
  }

  const allocsByRoom = new Map<string, AllocRow[]>()
  for (const a of allocsList) {
    const list = allocsByRoom.get(a.room_id) ?? []
    list.push(a)
    allocsByRoom.set(a.room_id, list)
  }

  const kpis = [
    { label: 'Quartos',          value: totalRooms,     icon: Hotel,     color: 'text-gray-600' },
    { label: 'Camas Ocupadas',   value: occupiedBeds,   icon: BedDouble, color: 'text-blue-600' },
    { label: 'Camas Disponíveis', value: availableBeds, icon: DoorOpen,  color: 'text-green-600' },
    { label: 'Chegadas Hoje',    value: arrivalsToday,  icon: LogIn,     color: 'text-orange-600' },
    { label: 'Saídas Hoje',      value: depaturesToday, icon: LogOut,    color: 'text-purple-600' },
  ]

  return (
    <>
      <Header title="Hospedagem" />
      <main className="p-4 md:p-6 space-y-6 max-w-5xl">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {kpis.map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-gray-50 ${k.color}`}>
                <k.icon size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{k.value}</p>
                <p className="text-[10px] text-gray-400 font-medium">{k.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Occupancy bar */}
        {totalBeds > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 font-medium">Ocupação geral</span>
              <span className="font-bold text-gray-900">
                {Math.round((occupiedBeds / totalBeds) * 100)}%
              </span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  occupiedBeds / totalBeds >= 0.9 ? 'bg-red-400'
                    : occupiedBeds / totalBeds >= 0.6 ? 'bg-yellow-400'
                    : 'bg-green-400'
                }`}
                style={{ width: `${totalBeds > 0 ? (occupiedBeds / totalBeds) * 100 : 0}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-400">
              {occupiedBeds} de {totalBeds} camas ocupadas
            </p>
          </div>
        )}

        {/* Room status grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Status dos Quartos</h2>
            <Link
              href={`/${slug}/hospedagem/quartos`}
              className="text-xs font-medium text-brand-500 hover:text-brand-700 transition-colors"
            >
              Gerenciar quartos →
            </Link>
          </div>

          {roomsList.length === 0 ? (
            <EmptyState
              icon={Hotel}
              title="Nenhum quarto cadastrado"
              description="Cadastre os quartos da base para começar a gerenciar a hospedagem."
              cta={{ label: 'Cadastrar quartos', href: `/${slug}/hospedagem/quartos` }}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {roomsList.map(room => {
                const roomBeds   = bedsByRoom.get(room.id) ?? []
                const roomAllocs = allocsByRoom.get(room.id) ?? []
                const total     = roomBeds.filter(b => b.status !== 'manutencao').length
                const occupied  = roomBeds.filter(b => b.status === 'ocupada').length
                const pct       = total > 0 ? Math.round((occupied / total) * 100) : 0
                const gender    = room.gender_constraint ? GENDER_LABELS[room.gender_constraint] : null
                const isMaintenace = room.status === 'manutencao'

                return (
                  <Link
                    key={room.id}
                    href={`/${slug}/hospedagem/quartos/${room.id}`}
                    className={`group bg-white rounded-xl border p-4 space-y-2.5 transition-all hover:shadow-md hover:-translate-y-0.5 ${
                      isMaintenace ? 'border-yellow-200 bg-yellow-50/30' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 group-hover:text-brand-600 transition-colors truncate">
                          {room.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {room.floor && (
                            <span className="text-[10px] text-gray-400">{room.floor}</span>
                          )}
                          {gender && (
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${gender.cls}`}>
                              {gender.label}
                            </span>
                          )}
                          {isMaintenace && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">
                              Manutenção
                            </span>
                          )}
                        </div>
                      </div>
                      {total > 0 && (
                        <span className={`text-lg font-bold ${
                          pct >= 90 ? 'text-red-500' : pct >= 60 ? 'text-yellow-500' : 'text-green-500'
                        }`}>
                          {pct}%
                        </span>
                      )}
                    </div>

                    {total > 0 && (
                      <div className="space-y-1">
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              pct >= 90 ? 'bg-red-400' : pct >= 60 ? 'bg-yellow-400' : 'bg-green-400'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-gray-400">{occupied}/{total} camas</p>
                      </div>
                    )}

                    {roomAllocs.length > 0 && (
                      <div className="space-y-0.5">
                        {roomAllocs.slice(0, 3).map(a => (
                          <p key={a.id} className={`text-[10px] truncate ${GUEST_TYPE_CLS[a.guest_type] ?? 'text-gray-500'}`}>
                            {a.guest_name}
                          </p>
                        ))}
                        {roomAllocs.length > 3 && (
                          <p className="text-[10px] text-gray-400">+{roomAllocs.length - 3} mais</p>
                        )}
                      </div>
                    )}

                    <p className="text-[10px] text-brand-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Abrir →
                    </p>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
