import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PrintControls } from './PrintControls'

type Props = { params: Promise<{ slug: string; id: string; classId: string; personId: string }> }

function formatDateFull(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default async function CertificadoPage({ params }: Props) {
  const { slug, id, classId, personId } = await params

  const supabase = await createClient()
  const { data: org } = await supabase.from('organizations').select('id, name').eq('slug', slug).single()
  if (!org) notFound()

  const db = createAdminClient()

  const { data: escola } = await db.from('schools').select('name').eq('id', id).single()
  const { data: turma } = await db
    .from('school_classes')
    .select('id, name, starts_at, ends_at, year, semester')
    .eq('id', classId)
    .single()
  const { data: pessoa } = await db.from('people').select('full_name').eq('id', personId).single()

  if (!escola || !turma || !pessoa) notFound()

  const { data: classStudent } = await db
    .from('class_students')
    .select('status')
    .eq('class_id', classId)
    .eq('person_id', personId)
    .single()
  if (!classStudent) notFound()

  const conclusionDate = turma.ends_at
    ? formatDateFull(turma.ends_at)
    : formatDateFull(new Date().toISOString())

  const turmaInfo = turma as unknown as { year?: number | null; semester?: number | null }
  const period = [turmaInfo.year, turmaInfo.semester ? `${turmaInfo.semester}º semestre` : null].filter(Boolean).join(' · ')

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 print:p-0 print:bg-white">
      {/* @page rule via dangerouslySetInnerHTML — funciona em RSC */}
      <style dangerouslySetInnerHTML={{ __html: '@media print { @page { size: A4 landscape; margin: 0; } body { margin: 0; } }' }} />

      <PrintControls backHref={`/${slug}/escolas/${id}/turmas/${classId}/alunos`} />

      {/* Certificado */}
      <div
        className="mx-auto bg-white shadow-xl print:shadow-none w-full max-w-3xl print:max-w-none rounded-2xl print:rounded-none overflow-hidden"
        style={{ aspectRatio: '1.414 / 1' }}
      >
        {/* Top border */}
        <div className="h-2 bg-gradient-to-r from-brand-500 via-brand-600 to-purple-600" />

        <div className="flex flex-col items-center justify-between px-12 py-8 text-center relative h-[calc(100%-8px)]">
          {/* Decorative borders */}
          <div className="absolute inset-4 border border-gray-200 rounded-xl pointer-events-none" />
          <div className="absolute inset-6 border border-gray-100 rounded-lg pointer-events-none" />

          {/* Header */}
          <div className="relative z-10">
            <p className="text-xs font-semibold tracking-[0.2em] text-gray-400 uppercase mb-1">
              Jovens Com Uma Missão · {org.name}
            </p>
            <h1 className="text-4xl font-black text-gray-800 tracking-tight">CERTIFICADO</h1>
            <p className="text-sm text-gray-500 mt-0.5">de Conclusão</p>
          </div>

          {/* Body */}
          <div className="relative z-10 space-y-3">
            <p className="text-sm text-gray-400">Certificamos que</p>
            <h2 className="text-3xl font-bold text-brand-700" style={{ fontFamily: 'Georgia, serif' }}>
              {pessoa.full_name}
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed max-w-lg mx-auto">
              concluiu com êxito a{' '}
              <strong className="text-gray-700">{escola.name}</strong>
              {' — '}
              <strong className="text-gray-700">{turma.name}</strong>
              {period ? ` (${period})` : ''}
              {conclusionDate ? `, realizada até ${conclusionDate}` : ''}.
            </p>
          </div>

          {/* Footer assinaturas */}
          <div className="relative z-10 w-full">
            <div className="flex justify-center gap-16">
              <div className="text-center">
                <div className="border-t border-gray-400 w-40 mb-2" />
                <p className="text-xs text-gray-500">Líder de Base</p>
              </div>
              <div className="text-center">
                <div className="border-t border-gray-400 w-40 mb-2" />
                <p className="text-xs text-gray-500">Líder de Escola</p>
              </div>
            </div>
            <p className="text-xs text-gray-300 mt-4">{org.name} · {turma.name}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
