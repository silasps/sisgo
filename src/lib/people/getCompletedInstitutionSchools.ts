import { createAdminClient } from '@/lib/supabase/admin'

export type InstitutionSchoolEntry = { escola: string; base: string; pais: string; mesAno: string }

function formatMesAno(dateStr: string): string {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
}

// Escolas desta mesma instituição que a pessoa já concluiu (class_students
// com status='concluido' — marcado pelo líder da escola no botão "Concluído"
// em Escolas > Turma > Alunos), no formato da lista "Escolas ou
// especializações da {orgName}" do formulário de obreiro (mesmas chaves de
// FormularioObreiro.tsx: escola/base/pais/mesAno). Não cobre escola feita em
// outra base/instituição — isso a pessoa ainda preenche à mão.
export async function getCompletedInstitutionSchools(personId: string, organizationId: string): Promise<InstitutionSchoolEntry[]> {
  const db = createAdminClient()

  const [{ data: rows }, { data: org }] = await Promise.all([
    db.from('class_students')
      .select('school_classes(name, ends_at, schools(name))')
      .eq('person_id', personId)
      .eq('status', 'concluido'),
    db.from('organizations').select('name, country').eq('id', organizationId).maybeSingle(),
  ])

  const base = org?.name ?? ''
  const pais = org?.country === 'BR' ? 'Brasil' : (org?.country ?? '')

  const entries: InstitutionSchoolEntry[] = []
  for (const row of rows ?? []) {
    const cls = row.school_classes as unknown as { name: string; ends_at: string | null; schools: { name: string } | null } | null
    const escola = cls?.schools?.name
    if (!escola) continue
    entries.push({ escola, base, pais, mesAno: cls?.ends_at ? formatMesAno(cls.ends_at) : '' })
  }
  return entries
}
