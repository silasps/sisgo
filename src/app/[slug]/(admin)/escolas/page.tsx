import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Database } from '@/types/database'
import { schoolTypeGroup, schoolTypeShortLabel } from '@/lib/schools'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { isManagementRole } from '@/lib/auth/permissions'

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
  const secondLevelSchools = escolas.filter(e => schoolTypeGroup((e as unknown as { school_type: string | null }).school_type) === 'second_level')
  const otherSchools = escolas.filter(e => schoolTypeGroup((e as unknown as { school_type: string | null }).school_type) === 'other')

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
            <SchoolSection title="ETED" schools={eteds} slug={slug} />
            <SchoolSection title="Escolas de 2º Nível" schools={secondLevelSchools} slug={slug} />
            {otherSchools.length > 0 && <SchoolSection title="Outras escolas" schools={otherSchools} slug={slug} />}
          </div>
        )}
      </main>
    </>
  )
}

function SchoolSection({ title, schools, slug }: { title: string; schools: School[]; slug: string }) {
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
          {schools.map(e => <SchoolCard key={e.id} school={e} slug={slug} />)}
        </div>
      )}
    </section>
  )
}

function SchoolCard({ school: e, slug }: { school: School; slug: string }) {
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
        <span className="text-xs text-brand-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">Abrir →</span>
      </div>
    </div>
  )
}
