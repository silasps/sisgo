import type { createAdminClient } from '@/lib/supabase/admin'

type Db = ReturnType<typeof createAdminClient>

type TurmaWindow = { registrations_open: boolean; registration_deadline: string | null }

// Prazo é uma data (sem hora) — inclusivo até o fim do dia informado.
export function isDeadlinePassed(deadline: string | null): boolean {
  if (!deadline) return false
  return new Date(`${deadline}T23:59:59`) < new Date()
}

export function isRegistrationOpen(turma: TurmaWindow): boolean {
  return turma.registrations_open && !isDeadlinePassed(turma.registration_deadline)
}

export type CategoriaVaga = 'homens' | 'mulheres' | 'casais'

// Classifica um candidato pelas respostas do próprio formulário de inscrição
// (form_data.s5.sexo/estado_civil + form_data.s7.tem_filhos) numa das 3
// categorias de cota. "Casal sem filhos" tem prioridade sobre sexo — cada
// cônjuge preenche uma inscrição separada, então o par consome 2 vagas da
// categoria "casais" (ver checkClassCategoryQuota).
export function classifyApplicationCategory(formData: Record<string, unknown> | null | undefined): CategoriaVaga | null {
  const s5 = (formData?.s5 as Record<string, string> | undefined) ?? {}
  const s7 = (formData?.s7 as Record<string, string> | undefined) ?? {}
  if (s5.estado_civil === 'casado' && s7.tem_filhos === 'não') return 'casais'
  if (s5.sexo === 'M') return 'homens'
  if (s5.sexo === 'F') return 'mulheres'
  return null
}

const NOME_CATEGORIA: Record<CategoriaVaga, string> = {
  homens: 'homens',
  mulheres: 'mulheres',
  casais: 'casais sem filhos',
}

// Null = pode matricular (sem cota configurada pra essa categoria, ou
// candidato sem como classificar). Senão, mensagem pronta pra mostrar pro DH
// — o limite é ajustável a qualquer momento em Escolas > turma.
export async function checkClassCategoryQuota(
  db: Db,
  classId: string,
  candidateFormData: Record<string, unknown> | null,
): Promise<string | null> {
  const categoria = classifyApplicationCategory(candidateFormData)
  if (!categoria) return null

  const { data: turma } = await db
    .from('school_classes')
    .select('quota_homens, quota_mulheres, quota_casais')
    .eq('id', classId)
    .maybeSingle()
  if (!turma) return null

  const limite = categoria === 'homens' ? turma.quota_homens
    : categoria === 'mulheres' ? turma.quota_mulheres
    : turma.quota_casais
  if (limite == null) return null

  const { data: convertidas } = await db
    .from('school_interest_forms')
    .select('school_applications(form_data)')
    .eq('class_id', classId)
    .eq('status', 'convertido')

  const ocupadas = (convertidas ?? []).reduce((count, row) => {
    const apps = (row as unknown as { school_applications: { form_data: Record<string, unknown> | null }[] | null }).school_applications
    const fd = apps?.[0]?.form_data
    return classifyApplicationCategory(fd) === categoria ? count + 1 : count
  }, 0)

  const limiteEfetivo = categoria === 'casais' ? limite * 2 : limite
  if (ocupadas < limiteEfetivo) return null

  const unidade = categoria === 'casais' ? `${limite} casais (${limiteEfetivo} pessoas)` : `${limite} pessoas`
  return `Vagas esgotadas para "${NOME_CATEGORIA[categoria]}" nessa turma — limite de ${unidade} já atingido. Pra matricular mesmo assim, aumente o limite em Configurações da turma.`
}
