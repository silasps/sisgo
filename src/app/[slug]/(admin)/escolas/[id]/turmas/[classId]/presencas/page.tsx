import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { saveAttendance } from './actions'

type Props = {
  params: Promise<{ slug: string; id: string; classId: string }>
  searchParams: Promise<{ data?: string }>
}

export default async function PresencasTurmaPage({ params, searchParams }: Props) {
  const { slug, id, classId } = await params
  const { data: dateParam } = await searchParams

  const today = new Date().toISOString().slice(0, 10)
  const selectedDate = dateParam ?? today

  const supabase = await createClient()
  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single()
  if (!org) notFound()

  const db = createAdminClient()

  const { data: escola } = await db.from('schools').select('name').eq('id', id).single()
  const { data: turma } = await db.from('school_classes').select('id, name').eq('id', classId).single()
  if (!escola || !turma) notFound()

  type StudentRow = {
    person_id: string
    people: { id: string; full_name: string } | null
  }

  const { data: students } = await db
    .from('class_students')
    .select('person_id, people(id, full_name)')
    .eq('class_id', classId)
    .eq('status', 'ativo')
    .order('people(full_name)', { ascending: true })

  const rows = (students ?? []) as unknown as StudentRow[]

  type AttendanceRow = { person_id: string; present: boolean }
  const { data: attendance } = await db
    .from('class_attendance')
    .select('person_id, present')
    .eq('class_id', classId)
    .eq('date', selectedDate)

  const attendanceMap = new Map<string, boolean>(
    ((attendance ?? []) as AttendanceRow[]).map(a => [a.person_id, a.present])
  )

  // Attendance history — unique dates with counts
  type HistRow = { date: string }
  const { data: histDates } = await db
    .from('class_attendance')
    .select('date')
    .eq('class_id', classId)
    .order('date', { ascending: false })
    .limit(30)

  const uniqueDates = [...new Set(((histDates ?? []) as HistRow[]).map(h => h.date))].slice(0, 10)

  const presentCount = [...attendanceMap.values()].filter(Boolean).length
  const hasData = attendanceMap.size > 0

  return (
    <>
      <Header title={`Presenças — ${turma.name}`} />
      <main className="p-4 md:p-6 space-y-4 max-w-xl">

        <nav className="text-xs text-gray-400 flex items-center gap-1 flex-wrap">
          <Link href={`/${slug}/escolas`} className="hover:text-gray-700">Escolas</Link>
          <span>/</span>
          <Link href={`/${slug}/escolas/${id}`} className="hover:text-gray-700">{escola.name}</Link>
          <span>/</span>
          <Link href={`/${slug}/escolas/${id}/turmas/${classId}`} className="hover:text-gray-700">{turma.name}</Link>
          <span>/</span>
          <span className="text-gray-600 font-medium">Presenças</span>
        </nav>

        <Link
          href={`/${slug}/escolas/${id}/turmas/${classId}/alunos`}
          className="inline-flex px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          ← Voltar para alunos
        </Link>

        {/* Date selector */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <label className="block text-xs font-medium text-gray-500 mb-2">Data da aula</label>
          <form method="GET" id="date-form">
            <div className="flex items-center gap-2">
              <input
                type="date"
                name="data"
                defaultValue={selectedDate}
                max={today}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
              <button type="submit" className="px-3 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors">
                Ir
              </button>
            </div>
          </form>
          {hasData && (
            <p className="text-xs text-gray-400 mt-2">
              {presentCount} de {rows.length} presentes registrados
            </p>
          )}
        </div>

        {/* Attendance form */}
        {!rows.length ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center">
            <p className="text-gray-400 text-sm">Nenhum aluno ativo nesta turma.</p>
          </div>
        ) : (
          <form action={saveAttendance} className="space-y-3">
            <input type="hidden" name="class_id" value={classId} />
            <input type="hidden" name="date" value={selectedDate} />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="school_id" value={id} />
            {rows.map(r => {
              const pessoa = r.people as { id: string; full_name: string } | null
              if (!pessoa) return null
              const isPresent = attendanceMap.has(r.person_id) ? attendanceMap.get(r.person_id) : true
              const initials = pessoa.full_name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
              return (
                <label
                  key={r.person_id}
                  className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:border-brand-300 has-[:checked]:border-green-300 has-[:checked]:bg-green-50 transition-all"
                >
                  <input type="hidden" name="person_ids[]" value={r.person_id} />
                  <input
                    type="checkbox"
                    name="present[]"
                    value={r.person_id}
                    defaultChecked={!!isPresent}
                    className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center shrink-0">
                    {initials}
                  </span>
                  <span className="font-medium text-gray-900 text-sm">{pessoa.full_name}</span>
                </label>
              )
            })}
            <button
              type="submit"
              className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Salvar presenças
            </button>
          </form>
        )}

        {/* Histórico de aulas */}
        {uniqueDates.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700">Aulas registradas</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {uniqueDates.map(date => (
                <Link
                  key={date}
                  href={`/${slug}/escolas/${id}/turmas/${classId}/presencas?data=${date}`}
                  className={`flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors text-sm ${date === selectedDate ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-700'}`}
                >
                  <span>{new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  {date === selectedDate && <span className="text-xs text-brand-500">→ atual</span>}
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  )
}
