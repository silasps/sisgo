import { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

export type ChatEligiblePerson = { userId: string; personId: string; fullName: string; kind: 'obreiro' | 'aluno' }

// "Obreiro ou aluno com conta real" — não visitante/associado/pai-de-aluno.
// Mesmo critério usado em toda a base pra distinguir gente com cadastro de
// verdade (staff_profiles/student_profiles) de gente só de passagem
// (person_status_history, sem essas linhas) — ver plano em
// .claude/plans/ethereal-baking-pudding.md.
async function eligibleKind(db: Admin, orgId: string, userId: string): Promise<'obreiro' | 'aluno' | null> {
  const { data: staff } = await db
    .from('staff_profiles')
    .select('id')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .eq('active', true)
    .limit(1)
  if ((staff ?? []).length > 0) return 'obreiro'

  const { data: student } = await db
    .from('student_profiles')
    .select('id')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .eq('active', true)
    .limit(1)
  if ((student ?? []).length > 0) return 'aluno'

  return null
}

async function personIdsOf(db: Admin, orgId: string, userId: string): Promise<string[]> {
  const [{ data: staffRows }, { data: studentRows }] = await Promise.all([
    db.from('staff_profiles').select('person_id').eq('organization_id', orgId).eq('user_id', userId),
    db.from('student_profiles').select('person_id').eq('organization_id', orgId).eq('user_id', userId),
  ])
  return [...new Set([...(staffRows ?? []), ...(studentRows ?? [])].map(r => r.person_id).filter((id): id is string => !!id))]
}

// "proprio_grupo": os dois precisam compartilhar um ministério (líder ou
// membro) ou uma turma de escola ativa — mesma noção de vínculo que
// unit-access.ts usa pra acesso a workspace, aplicada aqui pra decidir se
// uma DM pode começar.
async function sharesGroupWith(db: Admin, orgId: string, userIdA: string, userIdB: string): Promise<boolean> {
  const [personIdsA, personIdsB] = await Promise.all([
    personIdsOf(db, orgId, userIdA),
    personIdsOf(db, orgId, userIdB),
  ])

  const [
    { data: leaderA }, { data: memberA },
    { data: leaderB }, { data: memberB },
  ] = await Promise.all([
    db.from('ministry_leaders').select('ministry_id').eq('organization_id', orgId).eq('user_id', userIdA),
    personIdsA.length > 0
      ? db.from('ministry_members').select('ministry_id').in('person_id', personIdsA).eq('active', true)
      : Promise.resolve({ data: [] }),
    db.from('ministry_leaders').select('ministry_id').eq('organization_id', orgId).eq('user_id', userIdB),
    personIdsB.length > 0
      ? db.from('ministry_members').select('ministry_id').in('person_id', personIdsB).eq('active', true)
      : Promise.resolve({ data: [] }),
  ])

  const ministriesA = new Set([...(leaderA ?? []), ...(memberA ?? [])].map(r => r.ministry_id))
  const ministriesB = new Set([...(leaderB ?? []), ...(memberB ?? [])].map(r => r.ministry_id))
  if ([...ministriesA].some(id => ministriesB.has(id))) return true

  if (personIdsA.length === 0 || personIdsB.length === 0) return false
  const [{ data: classesA }, { data: classesB }] = await Promise.all([
    db.from('class_students').select('class_id').in('person_id', personIdsA).eq('status', 'ativo'),
    db.from('class_students').select('class_id').in('person_id', personIdsB).eq('status', 'ativo'),
  ])
  const classIdsA = new Set((classesA ?? []).map(r => r.class_id))
  return (classesB ?? []).some(r => classIdsA.has(r.class_id))
}

/**
 * Autorização de DM — nunca confiar em RLS puro (mesmo padrão já
 * estabelecido pro quadro de tarefas, ver tarefas/actions.ts): bloqueio
 * explícito > elegibilidade (obreiro/aluno com conta) > política da base.
 * `checkingInitiation`: false quando é só responder numa conversa que já
 * existe (sempre permitido se ninguém foi bloqueado depois).
 */
export async function canMessage(
  orgId: string,
  fromUserId: string,
  toUserId: string,
  checkingInitiation: boolean,
): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  const db = createAdminClient()

  const { data: blocks } = await db
    .from('chat_blocks')
    .select('blocked_user_id')
    .eq('organization_id', orgId)
    .in('blocked_user_id', [fromUserId, toUserId])
  if ((blocks ?? []).length > 0) return { allowed: false, reason: 'Uma das pessoas está bloqueada de enviar mensagens.' }

  const [fromKind, toKind] = await Promise.all([
    eligibleKind(db, orgId, fromUserId),
    eligibleKind(db, orgId, toUserId),
  ])
  if (!fromKind) return { allowed: false, reason: 'Sua conta não pode iniciar conversas no Chat.' }
  if (!toKind) return { allowed: false, reason: 'Essa pessoa não pode receber mensagens no Chat.' }

  if (!checkingInitiation) return { allowed: true }
  if (fromKind === 'obreiro' && toKind === 'obreiro') return { allowed: true }

  const { data: policy } = await db
    .from('chat_policies')
    .select('aluno_pode_iniciar, aluno_escopo')
    .eq('organization_id', orgId)
    .maybeSingle()
  // Sem linha de política salva ainda = tudo liberado (default explícito
  // pedido pelo usuário: "todo mundo tem acesso a todo mundo" até a base
  // entrar em Configurações e restringir).
  const alunoPodeIniciar = policy?.aluno_pode_iniciar ?? true
  const alunoEscopo = policy?.aluno_escopo ?? 'qualquer_um'

  // Quem está INICIANDO é aluno — só isso importa pra essa política (um
  // obreiro sempre pode chamar um aluno; a restrição é sobre o aluno tomar
  // a iniciativa).
  if (fromKind !== 'aluno') return { allowed: true }
  if (!alunoPodeIniciar || alunoEscopo === 'ninguem') {
    return { allowed: false, reason: 'Alunos não podem iniciar conversas nesta base.' }
  }
  if (alunoEscopo === 'qualquer_um') return { allowed: true }

  const shares = await sharesGroupWith(db, orgId, fromUserId, toUserId)
  if (!shares) return { allowed: false, reason: 'Você só pode iniciar conversa com quem está no seu ministério ou turma.' }
  return { allowed: true }
}

type PersonRow = { user_id: string | null; people: { id: string; full_name: string } | { id: string; full_name: string }[] | null }
const toPerson = (row: PersonRow, kind: 'obreiro' | 'aluno'): ChatEligiblePerson | null => {
  const person = Array.isArray(row.people) ? row.people[0] : row.people
  if (!row.user_id || !person) return null
  return { userId: row.user_id, personId: person.id, fullName: person.full_name, kind }
}

/** person_ids de quem serve num dos ministérios ou estuda numa das escolas dadas (vínculo ativo). */
async function personIdsInUnits(db: Admin, ministryIds: string[], schoolIds: string[]): Promise<string[]> {
  const [{ data: members }, { data: staff }, { data: classes }] = await Promise.all([
    ministryIds.length > 0
      ? db.from('ministry_members').select('person_id').in('ministry_id', ministryIds).eq('active', true)
      : Promise.resolve({ data: [] }),
    schoolIds.length > 0
      ? db.from('school_staff').select('person_id').in('school_id', schoolIds).eq('active', true)
      : Promise.resolve({ data: [] }),
    schoolIds.length > 0
      ? db.from('school_classes').select('id').in('school_id', schoolIds)
      : Promise.resolve({ data: [] }),
  ])
  const classIds = (classes ?? []).map(c => c.id)
  const { data: classStudents } = classIds.length > 0
    ? await db.from('class_students').select('person_id').in('class_id', classIds).eq('status', 'ativo')
    : { data: [] }
  return [...new Set(
    [...(members ?? []), ...(staff ?? []), ...(classStudents ?? [])]
      .map(r => r.person_id).filter((id): id is string => !!id),
  )]
}

/**
 * Lista pessoas obreiro/aluno-com-conta da organização que batem uma busca
 * por nome — usado no "nova conversa". Aceita um "@" opcional na frente
 * (o usuário pediu pra buscar "pelo arroba", tipo @mention) — "@joão" e
 * "joão" encontram a mesma pessoa. Também aceita nome de ministério/escola
 * ("CM" traz quem serve na CM, não só gente com "CM" no nome) — quem lidera
 * conta também, além de membro/obreiro/aluno matriculado.
 */
export async function searchEligiblePeople(orgId: string, query: string, excludeUserId: string): Promise<ChatEligiblePerson[]> {
  const db = createAdminClient()
  const like = `%${query.replace(/^@+/, '')}%`

  const results = new Map<string, ChatEligiblePerson>()
  const addRows = (rows: unknown[] | null, kind: 'obreiro' | 'aluno') => {
    for (const row of (rows ?? []) as PersonRow[]) {
      const p = toPerson(row, kind)
      if (p && p.userId !== excludeUserId && !results.has(p.userId)) results.set(p.userId, p)
    }
  }

  const [{ data: staffRows }, { data: studentRows }, { data: matchingMinistries }, { data: matchingSchools }] = await Promise.all([
    db.from('staff_profiles')
      .select('user_id, people!inner(id, full_name)')
      .eq('organization_id', orgId).eq('active', true).not('user_id', 'is', null)
      .ilike('people.full_name', like).limit(10),
    db.from('student_profiles')
      .select('user_id, people!inner(id, full_name)')
      .eq('organization_id', orgId).eq('active', true).not('user_id', 'is', null)
      .ilike('people.full_name', like).limit(10),
    db.from('ministries').select('id').eq('organization_id', orgId).ilike('name', like),
    db.from('schools').select('id').eq('organization_id', orgId).ilike('name', like),
  ])
  addRows(staffRows, 'obreiro')
  addRows(studentRows, 'aluno')

  const ministryIds = (matchingMinistries ?? []).map(m => m.id)
  const schoolIds = (matchingSchools ?? []).map(s => s.id)
  if (ministryIds.length > 0 || schoolIds.length > 0) {
    const [ministryLeaderRows, schoolLeaderRows, unitPersonIds] = await Promise.all([
      ministryIds.length > 0
        ? db.from('ministry_leaders').select('user_id').eq('organization_id', orgId).in('ministry_id', ministryIds).then(r => r.data ?? [])
        : Promise.resolve([]),
      schoolIds.length > 0
        ? db.from('school_leaders').select('user_id').eq('organization_id', orgId).in('school_id', schoolIds).then(r => r.data ?? [])
        : Promise.resolve([]),
      personIdsInUnits(db, ministryIds, schoolIds),
    ])
    const leaderUserIds = [...new Set([...ministryLeaderRows, ...schoolLeaderRows].map(r => r.user_id).filter((id): id is string => !!id))]

    const [{ data: unitStaffByPerson }, { data: unitStudentByPerson }, { data: leaderStaffRows }] = await Promise.all([
      unitPersonIds.length > 0
        ? db.from('staff_profiles').select('user_id, people!inner(id, full_name)').eq('organization_id', orgId).eq('active', true).not('user_id', 'is', null).in('person_id', unitPersonIds)
        : Promise.resolve({ data: [] }),
      unitPersonIds.length > 0
        ? db.from('student_profiles').select('user_id, people!inner(id, full_name)').eq('organization_id', orgId).eq('active', true).not('user_id', 'is', null).in('person_id', unitPersonIds)
        : Promise.resolve({ data: [] }),
      leaderUserIds.length > 0
        ? db.from('staff_profiles').select('user_id, people!inner(id, full_name)').eq('organization_id', orgId).eq('active', true).in('user_id', leaderUserIds)
        : Promise.resolve({ data: [] }),
    ])
    addRows(unitStaffByPerson, 'obreiro')
    addRows(unitStudentByPerson, 'aluno')
    addRows(leaderStaffRows, 'obreiro')
  }

  return [...results.values()].sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR')).slice(0, 10)
}
