// Esquema da planilha de importação em lote — uma linha por CAMA (o nível
// mais específico da hierarquia bloco > andar > quarto > cama). Bloco/andar/
// quarto se repetem nas linhas seguintes; o parser (parse.ts) faz
// get-or-create por nome. Compartilhado entre o parser e o gerador do
// modelo (template/route.ts) pra não duplicar os nomes das colunas.

export const HEADERS = {
  bloco: 'Bloco',
  andar: 'Andar',
  andarDestino: 'Andar - Destino',
  andarGenero: 'Andar - Restrição de gênero',
  quarto: 'Quarto',
  quartoTipo: 'Quarto - Tipo',
  quartoGenero: 'Quarto - Restrição de gênero',
  quartoDestino: 'Quarto - Destino',
  quartoModo: 'Quarto - Modo de alocação',
  camaRotulo: 'Cama - Rótulo',
  camaTipo: 'Cama - Tipo',
} as const

export const DESTINOS = ['visita', 'aluno', 'obreiro'] as const
export const GENEROS = ['masculino', 'feminino', 'misto'] as const
export const TIPOS_QUARTO = ['quarto', 'suite', 'dormitorio', 'casal'] as const
export const MODOS_ALOCACAO = ['cama', 'quarto'] as const
export const TIPOS_CAMA = ['solteiro', 'casal', 'beliche_sup', 'beliche_inf', 'colchao'] as const

export const DEFAULTS = {
  quartoTipo: 'quarto',
  quartoDestino: 'visita',
  quartoModo: 'cama',
  camaTipo: 'solteiro',
} as const

export const LEGENDA_ROWS: Array<[string, string]> = [
  ['Andar - Destino / Quarto - Destino', `${DESTINOS.join(', ')} (em branco = "${DEFAULTS.quartoDestino}")`],
  ['Andar - Restrição de gênero / Quarto - Restrição de gênero', `${GENEROS.join(', ')} (em branco = sem restrição)`],
  ['Quarto - Tipo', `${TIPOS_QUARTO.join(', ')} (em branco = "${DEFAULTS.quartoTipo}")`],
  ['Quarto - Modo de alocação', `${MODOS_ALOCACAO.join(', ')} — "quarto" = alocado inteiro, sem cama a cama (deixe "Cama - Rótulo" em branco nesse caso); em branco = "${DEFAULTS.quartoModo}"`],
  ['Cama - Tipo', `${TIPOS_CAMA.join(', ')} (em branco = "${DEFAULTS.camaTipo}")`],
]

export const EXAMPLE_ROWS: Array<Record<string, string>> = [
  {
    [HEADERS.bloco]: 'Bloco A', [HEADERS.andar]: 'Térreo', [HEADERS.andarDestino]: 'visita', [HEADERS.andarGenero]: 'misto',
    [HEADERS.quarto]: 'Quarto 101', [HEADERS.quartoTipo]: 'quarto', [HEADERS.quartoGenero]: '', [HEADERS.quartoDestino]: 'visita', [HEADERS.quartoModo]: 'cama',
    [HEADERS.camaRotulo]: 'Cama 1', [HEADERS.camaTipo]: 'solteiro',
  },
  {
    [HEADERS.bloco]: 'Bloco A', [HEADERS.andar]: 'Térreo', [HEADERS.andarDestino]: 'visita', [HEADERS.andarGenero]: 'misto',
    [HEADERS.quarto]: 'Quarto 101', [HEADERS.quartoTipo]: 'quarto', [HEADERS.quartoGenero]: '', [HEADERS.quartoDestino]: 'visita', [HEADERS.quartoModo]: 'cama',
    [HEADERS.camaRotulo]: 'Cama 2', [HEADERS.camaTipo]: 'solteiro',
  },
  {
    [HEADERS.bloco]: 'Bloco A', [HEADERS.andar]: '1º Andar', [HEADERS.andarDestino]: 'obreiro', [HEADERS.andarGenero]: '',
    [HEADERS.quarto]: 'Suíte 201', [HEADERS.quartoTipo]: 'suite', [HEADERS.quartoGenero]: '', [HEADERS.quartoDestino]: 'obreiro', [HEADERS.quartoModo]: 'quarto',
    [HEADERS.camaRotulo]: '', [HEADERS.camaTipo]: '',
  },
]
