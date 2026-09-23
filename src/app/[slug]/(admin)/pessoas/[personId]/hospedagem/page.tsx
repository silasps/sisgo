import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { PROFILE_ROLES } from '@/lib/auth/permissions'

type Props = { params: Promise<{ slug: string; personId: string }> }

const ALLOCATION_STATUS_MAP: Record<string, { label: string; cls: string }> = {
  confirmada: { label: 'Confirmada', cls: 'bg-blue-100 text-blue-700' },
  checkin: { label: 'Hospedado atualmente', cls: 'bg-green-100 text-green-700' },
  checkout: { label: 'Encerrada', cls: 'bg-gray-100 text-gray-500' },
  cancelada: { label: 'Cancelada', cls: 'bg-red-100 text-red-700' },
}

const REASON_LABELS: Record<string, string> = {
  viagem_missionaria: 'Viagem missionária',
  ferias: 'Férias',
  saude: 'Saúde',
  familia: 'Família',
  outro: 'Outro',
}

type AllocationRow = {
  id: string
  check_in: string
  check_out: string
  actual_check_in: string | null
  actual_check_out: string | null
  status: string
  notes: string | null
  rooms: { name: string; floors: { name: string } | null } | null
  beds: { label: string } | null
}

type AbsenceRow = {
  id: string
  start_date: string
  end_date: string
  reason_type: string
  reason_notes: string | null
}

const fmtDate = (v: string | null) => (v ? new Date(`${v}T00:00:00`).toLocaleDateString('pt-BR') : '—')

function diasEntre(inicio: string, fim: string) {
  const ms = new Date(`${fim}T00:00:00`).getTime() - new Date(`${inicio}T00:00:00`).getTime()
  return Math.max(1, Math.round(ms / 86_400_000))
}

function AllocationItem({ a }: { a: AllocationRow }) {
  const status = ALLOCATION_STATUS_MAP[a.status] ?? { label: a.status, cls: 'bg-gray-100 text-gray-500' }
  const efetivo = Boolean(a.actual_check_in)
  const inicio = a.actual_check_in ?? a.check_in
  const fim = a.actual_check_out ?? (a.status === 'checkin' ? null : a.check_out)
  const local = a.rooms ? `${a.rooms.name}${a.rooms.floors ? ` · ${a.rooms.floors.name}` : ''}${a.beds ? ` · ${a.beds.label}` : ''}` : '—'

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-gray-900">{local}</p>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${status.cls}`}>{status.label}</span>
      </div>
      <p className="text-xs text-gray-400 mt-0.5">
        {fmtDate(inicio)} → {fim ? fmtDate(fim) : 'até agora'} ({efetivo ? 'efetivo' : 'planejado'})
        {fim && ` · ${diasEntre(inicio, fim)} dia(s)`}
      </p>
      {a.notes && <p className="text-sm text-gray-600 mt-1">{a.notes}</p>}
    </div>
  )
}

function AbsenceItem({ a }: { a: AbsenceRow }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-gray-900">{fmtDate(a.start_date)} → {fmtDate(a.end_date)}</p>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600 shrink-0">
          {REASON_LABELS[a.reason_type] ?? a.reason_type}
        </span>
      </div>
      {a.reason_notes && <p className="text-sm text-gray-600 mt-1">{a.reason_notes}</p>}
    </div>
  )
}

export default async function PessoaHospedagemPage({ params }: Props) {
  const { slug, personId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single()
  if (!org) notFound()

  const { role } = await getCurrentOrganizationRole(supabase, user.id, org.id)
  if (!PROFILE_ROLES.includes(role as never)) redirect(`/${slug}/pessoas`)

  const db = createAdminClient()
  const { data: person } = await db.from('people').select('id').eq('id', personId).eq('organization_id', org.id).single()
  if (!person) notFound()

  const [{ data: allocationsData }, { data: absencesData }] = await Promise.all([
    db.from('room_allocations')
      .select('id, check_in, check_out, actual_check_in, actual_check_out, status, notes, rooms(name, floors(name)), beds(label)')
      .eq('organization_id', org.id)
      .eq('person_id', personId)
      .order('check_in', { ascending: false }),
    db.from('absence_declarations')
      .select('id, start_date, end_date, reason_type, reason_notes')
      .eq('person_id', personId)
      .order('start_date', { ascending: false }),
  ])

  const allocations = ((allocationsData ?? []) as unknown) as AllocationRow[]
  const absences = ((absencesData ?? []) as unknown) as AbsenceRow[]

  const efetivadas = allocations.filter(a => a.actual_check_in)
  const totalDias = efetivadas.reduce((sum, a) => {
    const fim = a.actual_check_out ?? new Date().toISOString().slice(0, 10)
    return sum + diasEntre(a.actual_check_in!, fim)
  }, 0)

  return (
    <main className="p-4 md:p-6 space-y-5 max-w-2xl">
      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <p className="text-xl font-bold text-gray-900">{totalDias}</p>
          <p className="text-xs text-gray-500 mt-0.5">Dias hospedado (total)</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <p className="text-xl font-bold text-gray-900">{allocations.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Estadia(s) registrada(s)</p>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-800">Estadias</h2>
        </div>
        {allocations.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {allocations.map(a => <AllocationItem key={a.id} a={a} />)}
          </div>
        ) : (
          <div className="p-10 text-center">
            <p className="text-gray-400 text-sm">Nenhuma alocação de quarto registrada para esta pessoa.</p>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-800">Ausências declaradas</h2>
        </div>
        {absences.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {absences.map(a => <AbsenceItem key={a.id} a={a} />)}
          </div>
        ) : (
          <div className="p-10 text-center">
            <p className="text-gray-400 text-sm">Nenhuma ausência declarada para esta pessoa.</p>
          </div>
        )}
      </section>
    </main>
  )
}
