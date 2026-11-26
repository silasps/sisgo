import type { createAdminClient } from '@/lib/supabase/admin'
import { isDirectEnrollmentType } from '@/lib/schools'

type Db = ReturnType<typeof createAdminClient>

type TurmaWindow = { registrations_open: boolean; registration_deadline: string | null }

// Prazo é uma data (sem hora) — inclusivo até o fim do dia informado, no
// horário de Brasília (o servidor roda em UTC: sem o fuso explícito, o prazo
// fechava às 21h). A coluna é timestamptz, então chega como
// "2027-02-14T00:00:00+00:00": só a parte da data interessa (sem o slice,
// `${deadline}T23:59:59` virava data inválida e o prazo nunca encerrava nada).
export function isDeadlinePassed(deadline: string | null): boolean {
  if (!deadline) return false
  return new Date(`${deadline.slice(0, 10)}T23:59:59-03:00`) < new Date()
}

export function isRegistrationOpen(turma: TurmaWindow): boolean {
  return turma.registrations_open && !isDeadlinePassed(turma.registration_deadline)
}

export type CategoriaVaga = 'homens' | 'mulheres' | 'casais'

// Valores do campo "Categoria de hospedagem" (form_data.s4.categoria_hospedagem),
// que aparece no formulário quando a turma de matrícula direta tem cota por
// categoria. Nele o casal se inscreve UMA vez (com o nome do cônjuge) e ocupa
// 2 vagas de pessoas.
export type CategoriaHospedagem = 'masculina' | 'feminina' | 'casal'
export const CATEGORIAS_HOSPEDAGEM: CategoriaHospedagem[] = ['masculina', 'feminina', 'casal']
const CATEGORIA_DA_HOSPEDAGEM: Record<CategoriaHospedagem, CategoriaVaga> = {
  masculina: 'homens',
  feminina: 'mulheres',
  casal: 'casais',
}

function explicitCategory(formData: Record<string, unknown> | null | undefined): CategoriaHospedagem | null {
  const value = (formData?.s4 as Record<string, string> | undefined)?.categoria_hospedagem
  return CATEGORIAS_HOSPEDAGEM.includes(value as CategoriaHospedagem) ? value as CategoriaHospedagem : null
}

// Classifica um candidato numa das 3 categorias de cota. Com o campo
// explícito de categoria de hospedagem, vale ele; sem (formulários de
// escola, inscrições antigas), deriva das respostas: form_data.s5.sexo/
// estado_civil + form_data.s7.tem_filhos, com "casal sem filhos" tendo
// prioridade sobre sexo.
export function classifyApplicationCategory(formData: Record<string, unknown> | null | undefined): CategoriaVaga | null {
  const explicit = explicitCategory(formData)
  if (explicit) return CATEGORIA_DA_HOSPEDAGEM[explicit]
  const s5 = (formData?.s5 as Record<string, string> | undefined) ?? {}
  const s7 = (formData?.s7 as Record<string, string> | undefined) ?? {}
  if (s5.estado_civil === 'casado' && s7.tem_filhos === 'não') return 'casais'
  if (s5.sexo === 'M') return 'homens'
  if (s5.sexo === 'F') return 'mulheres'
  return null
}

// Quantas vagas de PESSOAS a inscrição ocupa: 2 pra casal inscrito pelo
// campo explícito (uma inscrição pelos dois); 1 nos demais — inclusive o
// casal derivado, em que cada cônjuge preenche uma inscrição separada.
export function applicationPeople(formData: Record<string, unknown> | null | undefined): number {
  return explicitCategory(formData) === 'casal' ? 2 : 1
}

const NOME_CATEGORIA: Record<CategoriaVaga, string> = {
  homens: 'homens',
  mulheres: 'mulheres',
  casais: 'casais sem filhos',
}

type ClassLimits = {
  max_students: number | null
  quota_homens: number | null
  quota_mulheres: number | null
  quota_casais: number | null
}

export function hasCategoryQuota(turma: Pick<ClassLimits, 'quota_homens' | 'quota_mulheres' | 'quota_casais'>): boolean {
  return turma.quota_homens != null || turma.quota_mulheres != null || turma.quota_casais != null
}

// Limite da categoria em pessoas (quota_casais é em número de casais).
function categoryLimit(turma: ClassLimits, categoria: CategoriaVaga): number | null {
  if (categoria === 'homens') return turma.quota_homens
  if (categoria === 'mulheres') return turma.quota_mulheres
  return turma.quota_casais == null ? null : turma.quota_casais * 2
}

export type Occupancy = { total: number; byCategory: Record<CategoriaVaga, number> }

function countOccupancy(formDatas: (Record<string, unknown> | null)[]): Occupancy {
  const occupancy: Occupancy = { total: 0, byCategory: { homens: 0, mulheres: 0, casais: 0 } }
  for (const fd of formDatas) {
    const people = applicationPeople(fd)
    occupancy.total += people
    const categoria = classifyApplicationCategory(fd)
    if (categoria) occupancy.byCategory[categoria] += people
  }
  return occupancy
}

// Vagas ocupadas por inscrições já ENVIADAS na turma (não só as aceitas) —
// na matrícula direta a vaga é de quem se inscreve primeiro, então a pessoa
// não pode descobrir só na aprovação que não havia mais lugar. Recusadas/
// excluídas (pré-inscrição descartada/excluída) e canceladas liberam a vaga.
export async function getSubmittedOccupancy(db: Db, classId: string, excludeApplicationId?: string): Promise<Occupancy> {
  const { data } = await db
    .from('school_applications')
    .select('id, form_data, school_interest_forms(status)')
    .eq('class_id', classId)
    .in('status', ['enviado', 'em_analise', 'aprovado'])
  const rows = (data ?? []) as unknown as { id: string; form_data: Record<string, unknown> | null; school_interest_forms: { status: string } | null }[]
  return countOccupancy(rows
    .filter(r => r.id !== excludeApplicationId)
    .filter(r => !['descartado', 'excluido'].includes(r.school_interest_forms?.status ?? ''))
    .map(r => r.form_data))
}

// Categorias sem vaga pra mais `people` pessoas — usado pra marcar
// "esgotado" no campo de categoria antes mesmo de a pessoa escolher.
export function fullCategories(turma: ClassLimits, occupancy: Occupancy): Record<CategoriaHospedagem, boolean> {
  const totalLeft = turma.max_students == null ? Infinity : turma.max_students - occupancy.total
  const isFull = (cat: CategoriaHospedagem) => {
    const categoria = CATEGORIA_DA_HOSPEDAGEM[cat]
    const people = cat === 'casal' ? 2 : 1
    const limit = categoryLimit(turma, categoria)
    return people > totalLeft || (limit != null && occupancy.byCategory[categoria] + people > limit)
  }
  return { masculina: isFull('masculina'), feminina: isFull('feminina'), casal: isFull('casal') }
}

// Checagem no ENVIO do formulário (e antes de anexar o comprovante, pra
// ninguém pagar por uma vaga que já acabou). Só vale pra matrícula direta
// (seminário/evento) — em escola com processo seletivo, o limite é aplicado
// na aprovação (checkClassCategoryQuota). Null = pode enviar.
export async function checkSubmissionCapacity(
  db: Db,
  app: { id: string; class_id: string | null; form_data: unknown },
): Promise<string | null> {
  if (!app.class_id) return null
  const { data: turma } = await db
    .from('school_classes')
    .select('max_students, quota_homens, quota_mulheres, quota_casais, schools(school_type)')
    .eq('id', app.class_id)
    .maybeSingle()
  if (!turma) return null
  const schoolType = (turma.schools as unknown as { school_type: string | null } | null)?.school_type
  if (!isDirectEnrollmentType(schoolType)) return null

  const formData = (app.form_data as Record<string, unknown> | null) ?? null
  const withQuota = hasCategoryQuota(turma)
  if (withQuota && !explicitCategory(formData)) {
    return 'Escolha a categoria de hospedagem na seção de informações do evento antes de enviar.'
  }
  if (!withQuota && turma.max_students == null) return null

  const occupancy = await getSubmittedOccupancy(db, app.class_id, app.id)
  const people = applicationPeople(formData)
  if (turma.max_students != null && occupancy.total + people > turma.max_students) {
    return 'As vagas desta turma estão esgotadas.'
  }
  const categoria = classifyApplicationCategory(formData)
  if (withQuota && categoria) {
    const limit = categoryLimit(turma, categoria)
    if (limit != null && occupancy.byCategory[categoria] + people > limit) {
      return `As vagas para "${NOME_CATEGORIA[categoria]}" estão esgotadas. Se houver vaga em outra categoria que se aplique a você, volte à seção de informações do evento e troque a categoria.`
    }
  }
  return null
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
    .select('max_students, quota_homens, quota_mulheres, quota_casais')
    .eq('id', classId)
    .maybeSingle()
  if (!turma) return null

  const limiteEfetivo = categoryLimit(turma, categoria)
  if (limiteEfetivo == null) return null

  const { data: convertidas } = await db
    .from('school_interest_forms')
    .select('school_applications(form_data)')
    .eq('class_id', classId)
    .eq('status', 'convertido')

  const ocupadas = countOccupancy((convertidas ?? []).map(row => {
    const apps = (row as unknown as { school_applications: { form_data: Record<string, unknown> | null }[] | null }).school_applications
    return apps?.[0]?.form_data ?? null
  })).byCategory[categoria]

  if (ocupadas + applicationPeople(candidateFormData) <= limiteEfetivo) return null

  const unidade = categoria === 'casais' ? `${turma.quota_casais} casais (${limiteEfetivo} pessoas)` : `${limiteEfetivo} pessoas`
  return `Vagas esgotadas para "${NOME_CATEGORIA[categoria]}" nessa turma — limite de ${unidade} já atingido. Pra matricular mesmo assim, aumente o limite em Configurações da turma.`
}
