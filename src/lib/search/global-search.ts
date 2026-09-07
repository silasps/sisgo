'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { isManagementRole, canSeeReservations, PESSOAS_ROLES } from '@/lib/auth/permissions'
import { getStudentSchoolIds } from '@/lib/school-scope'

export type GlobalSearchResult = {
  id: string
  section: string
  icon: string
  title: string
  subtitle?: string
  href: string
}

const PER_SECTION = 5

// Sempre `in('col', ids.length ? ids : ['no-match'])` — array vazio no
// `.in()` do Supabase não filtra nada (equivale a "sem restrição"), então
// precisa de um valor que nunca bate pra fechar a busca (fail closed).
function scopeIds(ids: string[]) {
  return ids.length > 0 ? ids : ['no-match']
}

export async function globalSearch(slug: string, query: string): Promise<GlobalSearchResult[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const like = `%${q}%`

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: org } = await supabase.from('organizations').select('id, department_assignments').eq('slug', slug).single()
  if (!org) return []
  const orgId = org.id

  const { role, preview, accumulatedRoles, extraRoles } = await getCurrentOrganizationRole(supabase, user.id, orgId)
  const allRoles = [role, ...accumulatedRoles, ...extraRoles]
  const is = (r: string) => allRoles.includes(r)
  const isManagement = isManagementRole(role)

  const results: GlobalSearchResult[] = []

  // ── Pessoas ──────────────────────────────────────────────────────────────
  // Mesma exclusão LGPD de /pessoas: lider_eted e lider_ministerio nunca veem
  // o diretório geral, só o quadro escopado da própria escola/ministério.
  if ((PESSOAS_ROLES as readonly string[]).includes(role) && role !== 'lider_eted' && role !== 'lider_ministerio') {
    const { data } = await supabase.from('people')
      .select('id, full_name')
      .eq('organization_id', orgId)
      .ilike('full_name', like)
      .order('full_name')
      .limit(PER_SECTION)
    for (const p of data ?? []) {
      results.push({ id: p.id, section: 'Pessoas', icon: 'pessoas', title: p.full_name, href: `/${slug}/pessoas/${p.id}` })
    }
  }

  // ── Escolas + Turmas ─────────────────────────────────────────────────────
  if (isManagement || role === 'lider_eted' || role === 'obreiro_eted') {
    let allowedSchoolIds: string[] | null = null
    if (role === 'lider_eted') {
      const leaderSchools = preview?.schoolId
        ? [{ school_id: preview.schoolId }]
        : (await supabase.from('school_leaders').select('school_id').eq('organization_id', orgId).eq('user_id', user.id)).data
      allowedSchoolIds = (leaderSchools ?? []).map(r => r.school_id)
    } else if (role === 'obreiro_eted') {
      const schoolId = preview?.schoolId
        ? preview.schoolId
        : await (async () => {
            const { data: sp } = await supabase.from('staff_profiles').select('person_id').eq('organization_id', orgId).eq('user_id', user.id).maybeSingle()
            if (!sp?.person_id) return null
            const { data: staff } = await supabase.from('school_staff').select('school_id').eq('person_id', sp.person_id).eq('active', true).limit(1).maybeSingle()
            return staff?.school_id ?? null
          })()
      allowedSchoolIds = schoolId ? [schoolId] : []
    }

    let schoolsQuery = supabase.from('schools').select('id, name').eq('organization_id', orgId).ilike('name', like).order('name').limit(PER_SECTION)
    if (allowedSchoolIds) schoolsQuery = schoolsQuery.in('id', scopeIds(allowedSchoolIds))
    const { data: schoolRows } = await schoolsQuery
    for (const s of schoolRows ?? []) {
      results.push({ id: s.id, section: 'Escolas', icon: 'escolas', title: s.name, href: `/${slug}/escolas/${s.id}` })
    }

    let classesQuery = supabase.from('school_classes')
      .select('id, name, school_id, schools!inner(name, organization_id)')
      .eq('schools.organization_id', orgId)
      .ilike('name', like)
      .order('name')
      .limit(PER_SECTION)
    if (allowedSchoolIds) classesQuery = classesQuery.in('school_id', scopeIds(allowedSchoolIds))
    const { data: classRows } = await classesQuery
    for (const c of (classRows ?? []) as unknown as Array<{ id: string; name: string; school_id: string; schools: { name: string } | null }>) {
      results.push({ id: c.id, section: 'Turmas', icon: 'escolas', title: c.name, subtitle: c.schools?.name, href: `/${slug}/escolas/${c.school_id}/turmas/${c.id}` })
    }
  }

  // ── Ministérios (+ Mensagens do mural) ──────────────────────────────────
  // Mesmo conjunto de papéis que já vê o item "Ministérios" no menu. Calculado
  // uma vez só e reaproveitado no mural (seção "Mensagens" abaixo) — mesmo
  // recorte pros dois, pra não abrir a leitura do mural mais que a busca de
  // ministério em si (a RLS da tabela de mensagens é org-wide por padrão,
  // mas manter os dois consistentes evita expor conversa de um ministério
  // que a pessoa nem acharia pela busca de Ministérios).
  const canSeeMinisterios = isManagement || is('lider_ministerio') || is('obreiro_ministerio') || is('hospitalidade') || is('cozinha') || is('manutencao') || is('secretaria')
  let allowedMinistryIds: string[] | null = null
  if (canSeeMinisterios) {
    if (role === 'lider_ministerio') {
      const leaderMinistries = preview?.ministryId
        ? [{ ministry_id: preview.ministryId }]
        : (await supabase.from('ministry_leaders').select('ministry_id').eq('user_id', user.id)).data
      allowedMinistryIds = (leaderMinistries ?? []).map(r => r.ministry_id)
    } else if (role === 'obreiro_ministerio') {
      const ministryId = preview?.ministryId
        ? preview.ministryId
        : await (async () => {
            const { data: sp } = await supabase.from('staff_profiles').select('person_id').eq('organization_id', orgId).eq('user_id', user.id).maybeSingle()
            if (!sp?.person_id) return null
            const { data: member } = await supabase.from('ministry_members').select('ministry_id').eq('person_id', sp.person_id).eq('active', true).limit(1).maybeSingle()
            return member?.ministry_id ?? null
          })()
      allowedMinistryIds = ministryId ? [ministryId] : []
    }

    let ministriesQuery = supabase.from('ministries').select('id, name').eq('organization_id', orgId).ilike('name', like).order('name').limit(PER_SECTION)
    if (allowedMinistryIds) ministriesQuery = ministriesQuery.in('id', scopeIds(allowedMinistryIds))
    const { data: ministryRows } = await ministriesQuery
    for (const m of ministryRows ?? []) {
      results.push({ id: m.id, section: 'Ministérios', icon: 'ministerios', title: m.name, href: `/${slug}/ministerios/${m.id}` })
    }
  }

  // ── Inscrições ───────────────────────────────────────────────────────────
  // Mesmo recorte de /inscricoes: lider_eted vê aluno + obreiro só da(s)
  // própria(s) escola(s); lider_ministerio vê só obreiro do próprio ministério
  // (nunca o trilho de aluno); gestão vê tudo.
  const inscHref = (nome: string) => `/${slug}/inscricoes?tab=todas&etapa=todas&q=${encodeURIComponent(nome)}`

  if (isManagement || role === 'lider_eted') {
    let allowedSchoolIds: string[] | null = null
    if (role === 'lider_eted') {
      const leaderSchools = preview?.schoolId
        ? [{ school_id: preview.schoolId }]
        : (await supabase.from('school_leaders').select('school_id').eq('organization_id', orgId).eq('user_id', user.id)).data
      allowedSchoolIds = (leaderSchools ?? []).map(r => r.school_id)
    }

    let siQuery = supabase.from('school_interest_forms').select('id, full_name').eq('organization_id', orgId).ilike('full_name', like).order('full_name').limit(PER_SECTION)
    if (allowedSchoolIds) siQuery = siQuery.in('school_id', scopeIds(allowedSchoolIds))
    const { data: siRows } = await siQuery
    for (const r of siRows ?? []) {
      results.push({ id: r.id, section: 'Inscrições', icon: 'inscricoes', title: r.full_name, subtitle: 'Pré-inscrição', href: inscHref(r.full_name) })
    }

    let sfQuery = supabase.from('staff_interest_forms').select('id, full_name').eq('organization_id', orgId).ilike('full_name', like).order('full_name').limit(PER_SECTION)
    if (allowedSchoolIds) sfQuery = sfQuery.in('school_id', scopeIds(allowedSchoolIds))
    const { data: sfRows } = await sfQuery
    for (const r of sfRows ?? []) {
      results.push({ id: r.id, section: 'Inscrições', icon: 'inscricoes', title: r.full_name, subtitle: 'Pré-inscrição Obreiro', href: inscHref(r.full_name) })
    }
  } else if (role === 'lider_ministerio') {
    const leaderMinistryId = preview?.ministryId
      ?? (await supabase.from('ministry_leaders').select('ministry_id').eq('user_id', user.id).limit(1).maybeSingle()).data?.ministry_id
      ?? null

    if (leaderMinistryId) {
      const { data: sfRows } = await supabase.from('staff_interest_forms')
        .select('id, full_name').eq('organization_id', orgId).eq('ministry_id', leaderMinistryId)
        .ilike('full_name', like).order('full_name').limit(PER_SECTION)
      for (const r of sfRows ?? []) {
        results.push({ id: r.id, section: 'Inscrições', icon: 'inscricoes', title: r.full_name, subtitle: 'Pré-inscrição Obreiro', href: inscHref(r.full_name) })
      }
    }
  }

  // ── Calendário ───────────────────────────────────────────────────────────
  // Diferente das seções acima, isso busca CONTEÚDO real (título/descrição
  // de evento), não um cadastro — o que existe aqui muda toda vez que alguém
  // cria um evento novo. Mesmo recorte de acesso que /calendario já aplica
  // (ali as consultas já usam o client admin porque essas tabelas não têm
  // RLS — o controle é feito na própria página, replicado aqui).
  {
    const admin = createAdminClient()
    const orLike = `title.ilike.${like},description.ilike.${like}`
    const yearOf = (iso: string) => new Date(iso).getFullYear()
    const calHref = (year: number) => `/${slug}/calendario?ano=${year}`

    let baseQuery = admin.from('base_calendar_events')
      .select('id, title, starts_on, visible_to_roles')
      .eq('organization_id', orgId).or(orLike).order('starts_on', { ascending: false }).limit(PER_SECTION)
    if (role === 'aluno') baseQuery = baseQuery.or('visible_to_roles.is.null,visible_to_roles.cs.{aluno}')
    const { data: baseRows } = await baseQuery
    for (const e of baseRows ?? []) {
      results.push({ id: e.id, section: 'Calendário', icon: 'calendario', title: e.title, subtitle: new Date(e.starts_on).toLocaleDateString('pt-BR'), href: calHref(yearOf(e.starts_on)) })
    }

    const isAlunoRole = role === 'aluno'
    let schoolCalIds: string[] | null = null
    if (role === 'lider_eted') {
      const leaderSchools = preview?.schoolId
        ? [{ school_id: preview.schoolId }]
        : (await admin.from('school_leaders').select('school_id').eq('organization_id', orgId).eq('user_id', user.id)).data
      schoolCalIds = (leaderSchools ?? []).map(r => r.school_id)
    } else if (isAlunoRole) {
      schoolCalIds = preview?.schoolId ? [preview.schoolId] : await getStudentSchoolIds(admin, orgId, user.id, user.email ?? null)
    }
    let schoolCalQuery = admin.from('school_calendar_events')
      .select('id, title, starts_at, school_id, schools(name)')
      .eq('organization_id', orgId).or(orLike).order('starts_at', { ascending: false }).limit(PER_SECTION)
    if (schoolCalIds) schoolCalQuery = schoolCalQuery.in('school_id', scopeIds(schoolCalIds))
    const { data: schoolCalRows } = await schoolCalQuery
    for (const e of (schoolCalRows ?? []) as unknown as Array<{ id: string; title: string; starts_at: string; schools: { name: string } | null }>) {
      results.push({ id: e.id, section: 'Calendário', icon: 'calendario', title: e.title, subtitle: e.schools?.name ?? new Date(e.starts_at).toLocaleDateString('pt-BR'), href: calHref(yearOf(e.starts_at)) })
    }

    if (!isAlunoRole) {
      let ministryCalIds: string[] | null = null
      if (role === 'lider_ministerio') {
        const leaderMinistries = preview?.ministryId
          ? [{ ministry_id: preview.ministryId }]
          : (await admin.from('ministry_leaders').select('ministry_id').eq('organization_id', orgId).eq('user_id', user.id)).data
        ministryCalIds = (leaderMinistries ?? []).map(r => r.ministry_id)
      } else if (role === 'obreiro_ministerio') {
        if (preview?.ministryId) {
          ministryCalIds = [preview.ministryId]
        } else {
          const { data: sp } = await admin.from('staff_profiles').select('person_id').eq('organization_id', orgId).eq('user_id', user.id).maybeSingle()
          const memberships = sp?.person_id
            ? (await admin.from('ministry_members').select('ministry_id').eq('person_id', sp.person_id).eq('active', true)).data
            : []
          ministryCalIds = (memberships ?? []).map(r => r.ministry_id)
        }
      }
      let ministryCalQuery = admin.from('ministry_calendar_events')
        .select('id, title, starts_at, ministry_id, ministries(name)')
        .eq('organization_id', orgId).or(orLike).order('starts_at', { ascending: false }).limit(PER_SECTION)
      if (ministryCalIds) ministryCalQuery = ministryCalQuery.in('ministry_id', scopeIds(ministryCalIds))
      const { data: ministryCalRows } = await ministryCalQuery
      for (const e of (ministryCalRows ?? []) as unknown as Array<{ id: string; title: string; starts_at: string; ministries: { name: string } | null }>) {
        results.push({ id: e.id, section: 'Calendário', icon: 'calendario', title: e.title, subtitle: e.ministries?.name ?? new Date(e.starts_at).toLocaleDateString('pt-BR'), href: calHref(yearOf(e.starts_at)) })
      }
    }

    // Notas pessoais: só quem criou pode ver (mesma regra de /calendario).
    // Coluna de texto livre aqui é `notes`, não `description`.
    const { data: noteRows } = await admin.from('personal_calendar_notes')
      .select('id, title, starts_at')
      .eq('organization_id', orgId).eq('user_id', user.id)
      .or(`title.ilike.${like},notes.ilike.${like}`)
      .order('starts_at', { ascending: false }).limit(PER_SECTION)
    for (const n of noteRows ?? []) {
      results.push({ id: n.id, section: 'Calendário', icon: 'calendario', title: n.title, subtitle: 'Nota pessoal', href: calHref(yearOf(n.starts_at)) })
    }
  }

  // ── Reservas ─────────────────────────────────────────────────────────────
  // Mesmo recorte de /reservas: gestão vê tudo; hospitalidade só reserva de
  // quarto; qualquer outro papel permitido só vê a própria reserva.
  if (canSeeReservations(role)) {
    let resQuery = supabase.from('reservations')
      .select('id, title, status, starts_at')
      .eq('organization_id', orgId)
      .or(`title.ilike.${like},description.ilike.${like},resource_description.ilike.${like}`)
      .order('created_at', { ascending: false })
      .limit(PER_SECTION)
    if (!isManagement) {
      resQuery = is('hospitalidade')
        ? resQuery.eq('type', 'quarto')
        : resQuery.eq('requested_by', user.id)
    }
    const { data: resRows } = await resQuery
    for (const r of resRows ?? []) {
      results.push({ id: r.id, section: 'Reservas', icon: 'reservas', title: r.title, subtitle: r.starts_at ? new Date(r.starts_at).toLocaleDateString('pt-BR') : r.status, href: `/${slug}/reservas` })
    }
  }

  // ── Solicitações (manutenção/hospitalidade/secretaria/...) ─────────────
  // Mesmo recorte de /pendentes: gestão vê tudo; papel com departamento
  // atribuído (organizations.department_assignments, igual layout.tsx
  // calcula `myDepartments`) só vê do(s) próprio(s) departamento(s); sem
  // departamento nenhum, só a própria solicitação.
  {
    const deptAssignments = (org.department_assignments as Record<string, string> | null)
      ?? { hospitalidade: 'hospitalidade', secretaria: 'secretaria' }
    const myDepartments = Object.entries(deptAssignments)
      .filter(([, assignedRole]) => assignedRole === role)
      .map(([department]) => department)

    let srQuery = supabase.from('service_requests')
      .select('id, subject, status, target_department')
      .eq('organization_id', orgId)
      .or(`subject.ilike.${like},description.ilike.${like}`)
      .order('created_at', { ascending: false })
      .limit(PER_SECTION)
    if (!isManagement) {
      srQuery = (myDepartments.length > 0 || is('hospitalidade'))
        ? srQuery.in('target_department', scopeIds(myDepartments.length > 0 ? myDepartments : ['hospitalidade']))
        : srQuery.eq('requester_id', user.id)
    }
    const { data: srRows } = await srQuery
    for (const r of srRows ?? []) {
      results.push({ id: r.id, section: 'Solicitações', icon: 'manutencao', title: r.subject, subtitle: r.status, href: `/${slug}/manutencao` })
    }
  }

  // ── Mensagens (mural de ministério) ─────────────────────────────────────
  // Mesmo recorte já calculado pra "Ministérios" acima — mensagem só aparece
  // se o ministério dela também apareceria na busca de Ministérios.
  if (canSeeMinisterios) {
    const admin = createAdminClient()
    let msgQuery = admin.from('ministry_messages')
      .select('id, content, author_name, ministry_id, ministries(name)')
      .eq('organization_id', orgId)
      .ilike('content', like)
      .order('created_at', { ascending: false })
      .limit(PER_SECTION)
    if (allowedMinistryIds) msgQuery = msgQuery.in('ministry_id', scopeIds(allowedMinistryIds))
    const { data: msgRows } = await msgQuery
    for (const m of (msgRows ?? []) as unknown as Array<{ id: string; content: string; author_name: string; ministry_id: string; ministries: { name: string } | null }>) {
      const preview = m.content.length > 60 ? `${m.content.slice(0, 60)}…` : m.content
      results.push({ id: m.id, section: 'Mensagens', icon: 'ministerios', title: preview, subtitle: `${m.author_name} · ${m.ministries?.name ?? ''}`, href: `/${slug}/ministerios/${m.ministry_id}` })
    }
  }

  return results.slice(0, 20)
}
