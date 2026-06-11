import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { GraduationCap, Award } from 'lucide-react'

type Props = { params: Promise<{ slug: string; id: string; classId: string }> }

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  ativo:      { label: 'Ativo',      color: 'bg-green-50 text-green-700' },
  trancado:   { label: 'Trancado',   color: 'bg-yellow-50 text-yellow-700' },
  concluido:  { label: 'Concluído',  color: 'bg-blue-50 text-blue-700' },
  reprovado:  { label: 'Reprovado',  color: 'bg-red-50 text-red-700' },
}

async function updateStatus(formData: FormData) {
  'use server'
  const { createAdminClient: adm } = await import('@/lib/supabase/admin')
  const { revalidatePath } = await import('next/cache')
  const db = adm()
  const classStudentId = formData.get('class_student_id') as string
  const status = formData.get('status') as string
  await db.from('class_students').update({ status }).eq('id', classStudentId)
  const slugParam = formData.get('slug') as string
  const schoolId = formData.get('school_id') as string
  const classId = formData.get('class_id') as string
  revalidatePath(`/${slugParam}/escolas/${schoolId}/turmas/${classId}/alunos`)
}

export default async function AlunosTurmaPage({ params }: Props) {
  const { slug, id, classId } = await params

  const supabase = await createClient()
  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single()
  if (!org) notFound()

  const db = createAdminClient()

  const { data: escola } = await db.from('schools').select('name').eq('id', id).single()
  const { data: turma } = await db.from('school_classes').select('id, name, starts_at, ends_at').eq('id', classId).single()
  if (!escola || !turma) notFound()

  type StudentRow = {
    id: string
    status: string
    enrolled_at: string
    person_id: string
    people: { id: string; full_name: string } | null
  }

  const { data: students } = await db
    .from('class_students')
    .select('id, status, enrolled_at, person_id, people(id, full_name)')
    .eq('class_id', classId)
    .order('enrolled_at', { ascending: true })

  const rows = (students ?? []) as unknown as StudentRow[]
  const total = rows.length
  const ativos = rows.filter(r => r.status === 'ativo').length
  const concluidos = rows.filter(r => r.status === 'concluido').length

  return (
    <>
      <Header title={`Alunos — ${turma.name}`} />
      <main className="p-4 md:p-6 space-y-4">

        <nav className="text-xs text-gray-400 flex items-center gap-1 flex-wrap">
          <Link href={`/${slug}/escolas`} className="hover:text-gray-700">Escolas</Link>
          <span>/</span>
          <Link href={`/${slug}/escolas/${id}`} className="hover:text-gray-700">{escola.name}</Link>
          <span>/</span>
          <Link href={`/${slug}/escolas/${id}/turmas/${classId}`} className="hover:text-gray-700">{turma.name}</Link>
          <span>/</span>
          <span className="text-gray-600 font-medium">Alunos</span>
        </nav>

        <div className="flex gap-2 flex-wrap">
          <Link
            href={`/${slug}/escolas/${id}/turmas/${classId}`}
            className="px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ← Voltar à turma
          </Link>
          <Link
            href={`/${slug}/escolas/${id}/turmas/${classId}/presencas`}
            className="px-3 py-1.5 text-xs font-medium text-brand-600 border border-brand-200 rounded-lg hover:bg-brand-50 transition-colors"
          >
            Ver presenças
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total', value: total, color: 'text-gray-700' },
            { label: 'Ativos', value: ativos, color: 'text-green-700' },
            { label: 'Concluídos', value: concluidos, color: 'text-blue-700' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {!rows.length ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
            <GraduationCap size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Nenhum aluno nesta turma ainda.</p>
            <p className="text-xs text-gray-400 mt-1">Aprovações em Inscrições adicionam alunos aqui.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Aluno</th>
                  <th className="hidden sm:table-cell text-left px-4 py-3 font-medium text-gray-600">Matriculado em</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(r => {
                  const pessoa = r.people as { id: string; full_name: string } | null
                  const statusInfo = STATUS_LABEL[r.status] ?? { label: r.status, color: 'bg-gray-100 text-gray-500' }
                  const initials = (pessoa?.full_name ?? '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0">
                            {initials}
                          </span>
                          <span className="font-medium text-gray-900">{pessoa?.full_name ?? '—'}</span>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-xs text-gray-400">
                        {new Date(r.enrolled_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {r.status === 'ativo' && (
                            <form action={updateStatus}>
                              <input type="hidden" name="class_student_id" value={r.id} />
                              <input type="hidden" name="status" value="concluido" />
                              <input type="hidden" name="slug" value={slug} />
                              <input type="hidden" name="school_id" value={id} />
                              <input type="hidden" name="class_id" value={classId} />
                              <button
                                type="submit"
                                className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors font-medium"
                              >
                                Concluído
                              </button>
                            </form>
                          )}
                          {r.status === 'concluido' && pessoa?.id && (
                            <Link
                              href={`/${slug}/escolas/${id}/turmas/${classId}/certificado/${pessoa.id}`}
                              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg transition-colors font-medium"
                            >
                              <Award size={12} />
                              Certificado
                            </Link>
                          )}
                          {pessoa?.id && (
                            <Link
                              href={`/${slug}/pessoas/${pessoa.id}/saude`}
                              className="text-xs text-gray-400 hover:text-brand-600 transition-colors"
                            >
                              Saúde
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  )
}
