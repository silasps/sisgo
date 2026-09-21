// room_allocations.check_out é obrigatório no banco — não dá pra representar
// "sem previsão de saída" com NULL. Usamos uma data-sentinela bem distante
// (obreiros costumam ser permanentes; a saída real é ajustada depois, no
// desligamento/transferência, pela própria tela de quartos). A hospitalidade
// nunca deve ficar travada por falta dessa informação.
export const INDEFINITE_CHECKOUT = '2099-12-31'

export function isIndefiniteCheckout(date: string | null | undefined) {
  return date === INDEFINITE_CHECKOUT
}

// Movido de ServiceRequestsPanel.tsx pra dar pra reaproveitar também no
// server (pendentes/page.tsx), que precisa filtrar por esses tipos antes de
// decidir quais pendências merecem buscar form_data de família.
export const HOSPEDAGEM_TYPES = ['hospedagem_obreiro', 'hospedagem_aluno', 'alocar_quarto']

export type FamilyInfo = { spouseComing: boolean; childrenComing: number }

// Cônjuge/filhos vindo junto já é coletado nos formulários de inscrição
// (obreiro e aluno), mas com nomes de campo diferentes entre os dois por
// histórico de cada formulário, não por design — obreiro guarda em "s3"
// (conjuge_vira), aluno em "s7" (conjuge_participa).
export function extractFamilyInfo(
  formData: Record<string, unknown> | null | undefined,
  guestType: 'obreiro' | 'aluno',
): FamilyInfo {
  const section = (formData?.[guestType === 'obreiro' ? 's3' : 's7'] ?? {}) as Record<string, unknown>
  const spouseField = guestType === 'obreiro' ? section.conjuge_vira : section.conjuge_participa
  const spouseComing = spouseField === 'sim'

  let childrenComing = 0
  if (section.tem_filhos === 'sim' && section.filhos_virao === 'sim') {
    try {
      childrenComing = (JSON.parse(section.filhos_dados as string) as unknown[]).length
    } catch {
      // dado legado/vazio — trata como sem filhos detalhados
    }
  }

  return { spouseComing, childrenComing }
}

// Sexo já é coletado nos dois formulários ("sexo": 'M'/'F', seção s2 no
// obreiro, s5 no aluno) — usado pra filtrar quartos compatíveis com
// gender_constraint na tela de alocação.
export function extractGuestGender(
  formData: Record<string, unknown> | null | undefined,
  guestType: 'obreiro' | 'aluno',
): 'masculino' | 'feminino' | null {
  const section = (formData?.[guestType === 'obreiro' ? 's2' : 's5'] ?? {}) as Record<string, unknown>
  if (section.sexo === 'M') return 'masculino'
  if (section.sexo === 'F') return 'feminino'
  return null
}

// "alocar_quarto" (follow-up de "definir quarto depois") não carrega o tipo
// no request_type — só um dos ids de candidatura fica preenchido. Mesma
// regra usada em ServiceRequestsPanel.tsx pra montar o resolver.
export function guestTypeForServiceRequest(
  requestType: string,
  schoolApplicationId: string | null,
): 'obreiro' | 'aluno' {
  if (requestType === 'alocar_quarto') return schoolApplicationId ? 'aluno' : 'obreiro'
  return requestType === 'hospedagem_aluno' ? 'aluno' : 'obreiro'
}
