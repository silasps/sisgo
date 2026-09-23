import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Database } from '@/types/database'
import { schoolTypeGroup, schoolTypeShortLabel } from '@/lib/schools'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { isManagementRole } from '@/lib/auth/permissions'
import { deleteSchool } from './[id]/actions'
import { triggerSiteRevalidation } from '@/lib/revalidate-webhook'
import { DeleteSchoolButton } from './DeleteSchoolButton'

type Props = { params: Promise<{ slug: string }> }
type School = Database['public']['Tables']['schools']['Row']

export default async function EscolasPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single()
  const orgId = org?.id ?? ''

  let isManagement = false
  // null = sem restrição (gestão); array (mesmo vazio) = escopado às unidades da pessoa.
  // Fica vazio (não null) quando o vínculo ainda não existe, pra nunca cair na
  // listagem completa por engano (fail closed, não fail open).
  let allowedSchoolIds: string[] | null = null

  if (user && orgId) {
    const { role, preview } = await getCurrentOrganizationRole(supabase, user.id, orgId)
    isManagement = isManagementRole(role)
    if (role === 'lider_eted') {
      const { data: leaderRows } = await supabase.from('school_leaders').select('school_id').eq('organization_id', orgId).eq('user_id', user.id)
      const schoolIds = preview?.schoolId ? [preview.schoolId] : (leaderRows ?? []).map(r => r.school_id)
      if (schoolIds.length === 1) redirect(`/${slug}/escolas/${schoolIds[0]}`)
      allowedSchoolIds = schoolIds
    }
    if (role === 'obreiro_eted') {
      const { data: sp } = await supabase.from('staff_profiles').select('person_id').eq('organization_id', orgId).eq('user_id', user.id).maybeSingle()
      const { data: staff } = sp?.person_id
        ? await supabase.from('school_staff').select('school_id').eq('person_id', sp.person_id).eq('active', true).limit(1).maybeSingle()
        : { data: null }
      if (staff?.school_id) redirect(`/${slug}/escolas/${staff.school_id}`)
      allowedSchoolIds = []
    }
  }

  const noSchoolAssigned = allowedSchoolIds !== null && allowedSchoolIds.length === 0

  let escolasQuery = supabase.from('schools').select('*').eq('organization_id', orgId).order('name')
  if (allowedSchoolIds) escolasQuery = escolasQuery.in('id', allowedSchoolIds.length > 0 ? allowedSchoolIds : ['no-match'])
  const { data } = await escolasQuery
  const escolas = (data ?? []) as School[]
  const eteds = escolas.filter(e => schoolTypeGroup((e as unknown as { school_type: string | null }).school_type) === 'eted')
  const seminarios = escolas.filter(e => schoolTypeGroup((e as unknown as { school_type: string | null }).school_type) === 'seminario')
  const secondLevelSchools = escolas.filter(e => schoolTypeGroup((e as unknown as { school_type: string | null }).school_type) === 'second_level')
  const otherSchools = escolas.filter(e => schoolTypeGroup((e as unknown as { school_type: string | null }).school_type) === 'other')

  // Escolas com turma cadastrada não podem ser excluídas direto do card —
  // evita apagar histórico sem querer; use "Configurar" pra desativar.
  let schoolsWithTurmas = new Set<string>()
  if (isManagement && escolas.length > 0) {
    const { data: turmaRows } = await supabase.from('school_classes').select('school_id').in('school_id', escolas.map(e => e.id))
    schoolsWithTurmas = new Set((turmaRows ?? []).map(r => r.school_id))
  }

  const handleDeleteSchool = async (formData: FormData) => {
    'use server'
    await deleteSchool(formData.get('school_id') as string)
    if (orgId) await triggerSiteRevalidation(orgId, 'schools')
    redirect(`/${slug}/escolas`)
  }

  return (
    <>
      <Header
        title="Escolas Missionárias"
        actions={
          isManagement ? (
            <Link href={`/${slug}/escolas/nova`}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors">
              + Nova escola
            </Link>
          ) : undefined
        }
      />
      <main className="p-4 md:p-6">
        {!escolas.length ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
            {noSchoolAssigned ? (
              <>
                <p className="text-gray-400 text-sm">Nenhuma escola atribuída a você ainda.</p>
                <p className="text-gray-400 text-xs mt-1">Entre em contato com o DH da sua base.</p>
              </>
            ) : (
              <>
                <p className="text-gray-400 text-sm mb-3">Nenhuma escola cadastrada ainda.</p>
                {isManagement && (
                  <Link href={`/${slug}/escolas/nova`} className="text-brand-500 hover:text-brand-600 text-sm font-medium">
                    + Criar primeira escola
                  </Link>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-8 animate-stagger">
            <SchoolSection title="ETED" schools={eteds} slug={slug} isManagement={isManagement} schoolsWithTurmas={schoolsWithTurmas} onDelete={handleDeleteSchool} />
            {seminarios.length > 0 && <SchoolSection title="Seminários" schools={seminarios} slug={slug} isManagement={isManagement} schoolsWithTurmas={schoolsWithTurmas} onDelete={handleDeleteSchool} />}
            <SchoolSection title="Escolas de 2º Nível" schools={secondLevelSchools} slug={slug} isManagement={isManagement} schoolsWithTurmas={schoolsWithTurmas} onDelete={handleDeleteSchool} />
            {otherSchools.length > 0 && <SchoolSection title="Outras escolas" schools={otherSchools} slug={slug} isManagement={isManagement} schoolsWithTurmas={schoolsWithTurmas} onDelete={handleDeleteSchool} />}
          </div>
        )}
      </main>
    </>
  )
}

function SchoolSection({ title, schools, slug, isManagement, schoolsWithTurmas, onDelete }: {
  title: string; schools: School[]; slug: string
  isManagement: boolean; schoolsWithTurmas: Set<string>; onDelete: (formData: FormData) => Promise<void>
}) {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500">{title}</h2>
        <span className="text-xs text-gray-400">{schools.length} escola{schools.length === 1 ? '' : 's'}</span>
      </div>
      {schools.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-400">
          Nenhuma escola cadastrada nesta area.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-stagger">
          {schools.map(e => (
            <SchoolCard key={e.id} school={e} slug={slug} isManagement={isManagement}
              hasTurmas={schoolsWithTurmas.has(e.id)} onDelete={onDelete} />
          ))}
        </div>
      )}
    </section>
  )
}

function SchoolCard({ school: e, slug, isManagement, hasTurmas, onDelete }: {
  school: School; slug: string
  isManagement: boolean; hasTurmas: boolean; onDelete: (formData: FormData) => Promise<void>
}) {
  const type = (e as unknown as { school_type: string | null }).school_type
  return (
    <div className="group relative rounded-xl border border-gray-200 bg-white p-5 cursor-pointer transition-all duration-200 hover:border-brand-300 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm">
      <Link href={`/${slug}/escolas/${e.id}`} className="absolute inset-0 rounded-xl" aria-label={`Abrir escola ${e.name}`} />
      <div className="pointer-events-none mb-2 flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 truncate group-hover:text-brand-600 transition-colors">{e.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{[e.acronym, schoolTypeShortLabel(type)].filter(Boolean).join(' · ')}</p>
        </div>
        <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ml-2 ${e.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
          {e.active ? 'Ativa' : 'Inativa'}
        </span>
      </div>
      {e.description && <p className="pointer-events-none mb-3 line-clamp-2 text-sm text-gray-500">{e.description}</p>}
      <div className="pointer-events-none flex items-center justify-between border-t border-gray-100 pt-2">
        <Link href={`/${slug}/escolas/${e.id}/turmas`} className="pointer-events-auto relative text-xs font-medium text-gray-500 hover:text-brand-600 py-1.5 px-2 rounded-lg hover:bg-brand-50 transition-colors">
          Ver turmas →
        </Link>
        {isManagement ? (
          <div className="pointer-events-auto relative flex items-center gap-1">
            <Link href={`/${slug}/escolas/${e.id}/configuracoes`} title="Editar escola"
              className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </Link>
            <DeleteSchoolButton schoolId={e.id} schoolName={e.name} disabled={hasTurmas} action={onDelete} />
          </div>
        ) : (
          <span className="text-xs text-brand-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">Abrir →</span>
        )}
      </div>
    </div>
  )
}
