// Esquema da planilha de importação em lote — uma linha por CAMA (o nível
// mais específico da hierarquia bloco > andar > quarto > cama). Bloco/andar/
// quarto se repetem nas linhas seguintes; o parser (parse.ts) faz
// get-or-create por nome. Compartilhado entre o parser e o gerador do
// modelo (template/route.ts) pra não duplicar os nomes das colunas.

// Mesmos nomes de campo usados nos modais de Bloco/Andar/Quarto/Cama (em
// /hospedagem/quartos) — pra quem já preenche por lá, a planilha usa a
// mesma linguagem em vez de inventar um vocabulário novo.
export const HEADERS = {
  bloco: 'Bloco - Nome',
  andar: 'Andar - Nome',
  andarDestino: 'Andar - Destinado a (padrão)',
  andarGenero: 'Andar - Gênero (padrão)',
  quarto: 'Quarto - Nome',
  quartoTipo: 'Quarto - Tipo',
  quartoGenero: 'Quarto - Gênero',
  quartoDestino: 'Quarto - Destinado a',
  quartoModo: 'Quarto - Modo de alocação',
  camaRotulo: 'Cama - Nome/Rótulo',
  camaTipo: 'Cama - Tipo',
} as const

export const DESTINOS = ['visita', 'aluno', 'obreiro'] as const
export const GENEROS = ['masculino', 'feminino', 'misto'] as const
export const TIPOS_QUARTO = ['quarto', 'suite', 'dormitorio', 'casal'] as const
export const MODOS_ALOCACAO = ['cama', 'quarto'] as const
export const TIPOS_CAMA = ['solteiro', 'casal', 'beliche_sup', 'beliche_inf', 'colchao'] as const

// Rótulo amigável de cada valor — igual o texto que aparece nos <select> dos
// modais — só pra deixar a legenda e a lista do dropdown mais claras. O
// parser continua aceitando o valor "cru" (ex.: "visita"), não o rótulo.
export const LABELS: Record<string, string> = {
  visita: 'Visitantes', aluno: 'Alunos', obreiro: 'Obreiros',
  masculino: 'Masculino', feminino: 'Feminino', misto: 'Misto',
  quarto: 'Quarto', suite: 'Suíte', dormitorio: 'Dormitório', casal: 'Casal',
  cama: 'Cama individual',
  solteiro: 'Solteiro', beliche_sup: 'Beliche Superior', beliche_inf: 'Beliche Inferior', colchao: 'Colchão',
}
const describe = (values: readonly string[]) => values.map(v => `${v} (${LABELS[v] ?? v})`).join(', ')

export const DEFAULTS = {
  quartoTipo: 'quarto',
  quartoDestino: 'visita',
  quartoModo: 'cama',
  camaTipo: 'solteiro',
} as const

export const LEGENDA_ROWS: Array<[string, string]> = [
  ['Andar - Destinado a (padrão)', `${describe(DESTINOS)} — em branco = "${DEFAULTS.quartoDestino}"`],
  ['Quarto - Destinado a', `${describe(DESTINOS)} — em branco = usa o mesmo valor do Andar (só preencha se esse quarto for diferente do resto do andar)`],
  ['Andar - Gênero (padrão)', `${describe(GENEROS)} — em branco = sem restrição`],
  ['Quarto - Gênero', `${describe(GENEROS)} — em branco = usa o mesmo valor do Andar (só preencha se esse quarto for diferente)`],
  ['Quarto - Tipo', `${describe(TIPOS_QUARTO)} — em branco = "${DEFAULTS.quartoTipo}"`],
  ['Quarto - Modo de alocação', `${describe(MODOS_ALOCACAO)} — "quarto" = alocado inteiro, sem cama a cama (deixe "Cama - Nome/Rótulo" em branco nesse caso); em branco = "${DEFAULTS.quartoModo}"`],
  ['Cama - Tipo', `${describe(TIPOS_CAMA)} — em branco = "${DEFAULTS.camaTipo}"`],
]

export const EXAMPLE_ROWS: Array<Record<string, string>> = [
  {
    [HEADERS.bloco]: 'Bloco A', [HEADERS.andar]: 'Térreo', [HEADERS.andarDestino]: 'visita', [HEADERS.andarGenero]: 'misto',
    [HEADERS.quarto]: 'Quarto 101', [HEADERS.quartoTipo]: 'quarto', [HEADERS.quartoGenero]: '', [HEADERS.quartoDestino]: '', [HEADERS.quartoModo]: 'cama',
    [HEADERS.camaRotulo]: 'Cama 1', [HEADERS.camaTipo]: 'solteiro',
  },
  {
    [HEADERS.bloco]: 'Bloco A', [HEADERS.andar]: 'Térreo', [HEADERS.andarDestino]: 'visita', [HEADERS.andarGenero]: 'misto',
    [HEADERS.quarto]: 'Quarto 101', [HEADERS.quartoTipo]: 'quarto', [HEADERS.quartoGenero]: '', [HEADERS.quartoDestino]: '', [HEADERS.quartoModo]: 'cama',
    [HEADERS.camaRotulo]: 'Cama 2', [HEADERS.camaTipo]: 'solteiro',
  },
  {
    [HEADERS.bloco]: 'Bloco A', [HEADERS.andar]: '1º Andar', [HEADERS.andarDestino]: 'obreiro', [HEADERS.andarGenero]: '',
    [HEADERS.quarto]: 'Suíte 201', [HEADERS.quartoTipo]: 'suite', [HEADERS.quartoGenero]: '', [HEADERS.quartoDestino]: '', [HEADERS.quartoModo]: 'quarto',
    [HEADERS.camaRotulo]: '', [HEADERS.camaTipo]: '',
  },
  {
    [HEADERS.bloco]: 'Bloco A', [HEADERS.andar]: '1º Andar', [HEADERS.andarDestino]: 'obreiro', [HEADERS.andarGenero]: '',
    [HEADERS.quarto]: 'Quarto Visita 202', [HEADERS.quartoTipo]: 'quarto', [HEADERS.quartoGenero]: '', [HEADERS.quartoDestino]: 'visita', [HEADERS.quartoModo]: 'cama',
    [HEADERS.camaRotulo]: 'Cama 1', [HEADERS.camaTipo]: 'solteiro',
  },
]
