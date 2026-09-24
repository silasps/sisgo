import { createAdminClient } from '@/lib/supabase/admin'

export type PessoaSemEmail = {
  personId: string
  nome: string
  roleTitle: string | null
  area: string | null
  path: string | null // rota relativa do formulário público (sem host) — null se não achou candidatura em aberto
}

// Obreiros importados sem email não ganham login (não tem como criar
// auth.users sem identificador) — mas o import já cria a `staff_applications`
// em rascunho com token, então dá pra mandar pra pessoa o link do próprio
// formulário público de cadastro pra ela preencher email e o resto sozinha,
// sem precisar de login nem de retrabalho manual (Drive doc, planilha, etc.).
export async function listarObreirosSemEmail(organizationId: string, slug: string): Promise<PessoaSemEmail[]> {
  const db = createAdminClient()

  const { data: perfis } = await db
    .from('staff_profiles')
    .select('person_id, role_title, area, people(full_name)')
    .eq('organization_id', organizationId)
    .eq('active', true)
    .is('user_id', null)

  if (!perfis || perfis.length === 0) return []

  const personIds = perfis.map(p => p.person_id)
  const { data: applications } = await db
    .from('staff_applications')
    .select('person_id, token')
    .in('person_id', personIds)
    .eq('status', 'rascunho')

  const tokenByPerson = new Map((applications ?? []).map(a => [a.person_id, a.token as string | null]))

  return perfis.map(p => {
    const token = tokenByPerson.get(p.person_id)
    return {
      personId: p.person_id,
      nome: (p.people as unknown as { full_name: string } | null)?.full_name ?? 'Sem nome',
      roleTitle: p.role_title,
      area: p.area,
      path: token ? `/${slug}/formulario-obreiro/${token}` : null,
    }
  })
}
