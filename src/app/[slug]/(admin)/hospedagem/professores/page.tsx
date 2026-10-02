import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { EmptyState } from '@/components/ui/EmptyState'
import { notFound, redirect } from 'next/navigation'
import { isManagementRole, userHasAnyRole, HOSPEDAGEM_ROLES } from '@/lib/auth/permissions'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { getMySchools } from '@/lib/auth/unit-access'
import { respondHospedagemTeacherVisit } from '@/lib/school/teacherVisitRequests'
import Link from 'next/link'

type Props = {
  params: Promise<{ slug: string }>
}

export default async function ProfessoresVisitantesIndexPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const sbAdmin = createAdminClient()

  const [{ data: { user } }, { data: org }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('organizations').select('id').eq('slug', slug).single(),
  ])
  if (!user || !org) notFound()
  const orgId = org.id

  const { role, preview, allRoles } = await getCurrentOrganizationRole(supabase, user.id, orgId)
  const isManagement = isManagementRole(role)
  const canSeeHospedagem = isManagement || userHasAnyRole(allRoles, HOSPEDAGEM_ROLES)

  // Quem não gerencia hospedagem só tem acesso às escolas a que está ligado
  // (líder/obreiro) — abre direto na única escola, ou lista se tiver mais de uma.
  if (!canSeeHospedagem) {
    const mySchools = await getMySchools({ userId: user.id, orgId, role, preview })
    if (mySchools.length === 0) notFound()
    if (mySchools.length === 1) redirect(`/${slug}/hospedagem/professores/${mySchools[0].id}`)
    return (
      <>
        <Header title="Professor Visitante" />
        <main className="p-4 md:p-6 max-w-2xl mx-auto overflow-y-auto flex-1">
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {mySchools.map(s => (
              <Link key={s.id} href={`/${slug}/hospedagem/professores/${s.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                <span className="text-sm font-medium text-gray-900">{s.name}</span>
                <span className="text-gray-300">→</span>
              </Link>
            ))}
          </div>
        </main>
      </>
    )
  }

  // Hospitalidade/gestão: visão cruzada de todas as escolas aguardando resposta.
  type TeacherVisitLodgingRaw = {
    id: string; full_name: string; teach_start_date: string; teach_end_date: string
    arrival_at: string; departure_at: string; school_id: string
  }
  const { data } = await sbAdmin
    .from('teacher_visit_requests')
    .select('id, full_name, teach_start_date, teach_end_date, arrival_at, departure_at, school_id')
    .eq('organization_id', orgId).eq('status', 'pendente').eq('hospedagem_status', 'aguardando')
    .order('created_at', { ascending: true })
  const rows = (data ?? []) as unknown as TeacherVisitLodgingRaw[]
  const schoolIds = [...new Set(rows.map(r => r.school_id))]
  const { data: schoolsData } = schoolIds.length > 0
    ? await sbAdmin.from('schools').select('id, name').in('id', schoolIds)
    : { data: [] }
  const schoolNameById = new Map((schoolsData ?? []).map(s => [s.id, s.name]))

  const { data: allSchools } = await supabase.from('schools').select('id, name').eq('organization_id', orgId).order('name')

  const handleRespond = async (formData: FormData) => {
    'use server'
    await respondHospedagemTeacherVisit({
      requestId: formData.get('request_id') as string,
      respondedBy: user.id,
      available: formData.get('available') === 'sim',
      notes: (formData.get('notes') as string) || null,
    })
    redirect(`/${slug}/hospedagem/professores`)
  }

  return (
    <>
      <Header title="Professor Visitante" />
      <main className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto overflow-y-auto flex-1">
        {rows.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700">
                Aguardando resposta da hospitalidade
                <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">{rows.length}</span>
              </h3>
            </div>
            <div className="p-3 space-y-2">
              {rows.map(req => (
                <div key={req.id} className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 space-y-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{req.full_name} — {schoolNameById.get(req.school_id) ?? '—'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Aula: {new Date(`${req.teach_start_date}T00:00:00`).toLocaleDateString('pt-BR')} a {new Date(`${req.teach_end_date}T00:00:00`).toLocaleDateString('pt-BR')}
                      {' · '}
                      Chegada {new Date(req.arrival_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      {' – '}
                      Saída {new Date(req.departure_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                  <form action={handleRespond} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="request_id" value={req.id} />
                    <input name="notes" placeholder="Observação (ex: quarto, bloco...)" className="flex-1 min-w-[10rem] border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400" />
                    <button type="submit" name="available" value="sim" className="px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 transition-colors">Tem vaga</button>
                    <button type="submit" name="available" value="nao" className="px-3 py-1.5 border border-red-200 text-red-500 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors">Sem vaga</button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Escolas</h2>
          {(allSchools ?? []).length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {(allSchools ?? []).map(s => (
                <li key={s.id}>
                  <Link href={`/${slug}/hospedagem/professores/${s.id}`}
                    className="flex items-center justify-between py-2.5 hover:text-brand-600 transition-colors group">
                    <span className="text-sm font-medium text-gray-900 group-hover:text-brand-700">{s.name}</span>
                    <span className="text-gray-300 group-hover:text-brand-400">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nenhuma escola cadastrada" />
          )}
        </div>
      </main>
    </>
  )
}
