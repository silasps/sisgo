import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isOperationalManager } from '@/lib/auth/permissions'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { getSchoolLink } from '@/lib/auth/unit-access'
import { Users, BookOpen, ClipboardList, AlertTriangle } from 'lucide-react'
import { schoolDisplayType } from '@/lib/schools'

type Props = {
  params: Promise<{ slug: string; id: string }>
}

// O mural da escola (antes embutido aqui) virou um dos tipos de conversa do
// Chat institucional (/[slug]/chat) — esta aba "Geral" fica só com o
// resumo/config da escola, sem o mural embutido (mesma mudança feita em
// ministerios/[id]/page.tsx).
export default async function EscolaOverviewPage({ params }: Props) {
  const { slug, id } = await params
  const supabase = await createClient()

  const [{ data: { user } }, { data: org }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('organizations').select('id').eq('slug', slug).single(),
  ])
  if (!user || !org) notFound()
  const orgId = org.id

  const { role, preview } = await getCurrentOrganizationRole(supabase, user.id, orgId)
  const canWrite = isOperationalManager(role)
    || (await getSchoolLink({ userId: user.id, orgId, role, preview }, id)) === 'lider'

  const { data: escola } = await supabase
    .from('schools')
    .select('id, name, description, active, school_type, type_name, duration_hours')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()
  if (!escola) notFound()

  const [{ count: staffCount }, { count: classCount }, { count: pendingCount }, { count: leaderCount }] = await Promise.all([
    supabase.from('school_staff').select('*', { count: 'exact', head: true }).eq('school_id', id).eq('active', true),
    supabase.from('school_classes').select('*', { count: 'exact', head: true }).eq('school_id', id).eq('active', true),
    supabase.from('school_pending_requests').select('*', { count: 'exact', head: true }).eq('school_id', id).eq('status', 'pendente'),
    supabase.from('school_leaders').select('*', { count: 'exact', head: true }).eq('school_id', id),
  ])

  const base = `/${slug}/escolas/${id}`
  const missingItems = [
    !leaderCount && { text: 'Esta escola ainda não tem um líder definido.', href: `${base}/configuracoes#lideranca`, cta: 'Atribuir líder →' },
    !escola.duration_hours && { text: 'A carga horária total ainda não foi informada.', href: `${base}/configuracoes`, cta: 'Preencher →' },
  ].filter((item): item is { text: string; href: string; cta: string } => Boolean(item))

  return (
    <main className="flex-1 overflow-y-auto p-3 md:p-6">
      <div className="max-w-2xl mx-auto space-y-3">
        {missingItems.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 uppercase tracking-wide">
              <AlertTriangle size={14} className="flex-shrink-0" /> Cadastro incompleto
            </div>
            {missingItems.map(item => (
              <div key={item.text} className="flex flex-wrap items-center justify-between gap-2 text-sm text-amber-700">
                <span>{item.text}</span>
                {canWrite && (
                  <Link href={item.href} className="flex-shrink-0 text-xs font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2">
                    {item.cta}
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <Link href={`${base}/equipe`} className="group bg-white rounded-xl border border-gray-200 p-3 transition-all hover:shadow-md hover:-translate-y-0.5">
            <div className="flex flex-col items-center gap-0 text-center">
              <Users size={14} className="text-brand-600 mb-1" />
              <p className="text-lg font-bold text-gray-900 leading-none">{staffCount ?? 0}</p>
              <p className="text-[10px] text-gray-500">Obreiros</p>
            </div>
          </Link>
          <Link href={`${base}/configuracoes`} className="group bg-white rounded-xl border border-gray-200 p-3 transition-all hover:shadow-md hover:-translate-y-0.5">
            <div className="flex flex-col items-center gap-0 text-center">
              <BookOpen size={14} className="text-indigo-600 mb-1" />
              <p className="text-lg font-bold text-gray-900 leading-none">{classCount ?? 0}</p>
              <p className="text-[10px] text-gray-500">Turmas</p>
            </div>
          </Link>
          <Link href={`${base}/equipe`} className="group bg-white rounded-xl border border-gray-200 p-3 transition-all hover:shadow-md hover:-translate-y-0.5">
            <div className="flex flex-col items-center gap-0 text-center">
              <ClipboardList size={14} className="text-amber-600 mb-1" />
              <p className="text-lg font-bold text-gray-900 leading-none">{pendingCount ?? 0}</p>
              <p className="text-[10px] text-gray-500">Pendências</p>
            </div>
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900">{escola.name}</h3>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${escola.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {escola.active ? 'Ativa' : 'Inativa'}
            </span>
          </div>
          {escola.description && <p className="text-xs text-gray-500 mt-1">{escola.description}</p>}
          {escola.school_type && (
            <p className="text-[10px] text-gray-400 mt-1.5 uppercase tracking-wide">{schoolDisplayType(escola)}</p>
          )}
        </div>
      </div>
    </main>
  )
}
