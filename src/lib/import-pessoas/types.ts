export type ImportDestinoOption = {
  // 'turma' pra aluno; 'ministerio' ou 'escola' pra obreiro.
  tipo: 'turma' | 'ministerio' | 'escola'
  id: string
  label: string // como aparece na dropdown (já com prefixo/escola quando aplicável)
  schoolId?: string // só pra tipo 'turma' — school_id da turma (school_applications exige)
}

export type ImportContext = {
  organizationId: string
  slug: string
  turmas: ImportDestinoOption[]
  destinosObreiro: ImportDestinoOption[]
}

export type ImportRawRow = {
  rowNumber: number // linha na planilha (pra mensagens de erro)
  nome: string
  email: string
  telefone: string
  cpf: string
  dataNascimento: string
  sexo: string
  estadoCivil: string
  papel: string
  turma: string
  destinoObreiro: string
  cargo: string
}

export type ImportRowStatus = 'ok' | 'erro'

export type ImportValidatedRow = {
  raw: ImportRawRow
  status: ImportRowStatus
  errors: string[]
  warnings: string[]
  // Só preenchido quando status === 'ok'
  parsed?: {
    nome: string
    email: string
    telefone: string | null
    cpf: string | null
    dataNascimento: string | null // ISO yyyy-mm-dd
    sexo: 'M' | 'F' | 'outro' | null
    estadoCivil: 'solteiro' | 'casado' | 'divorciado' | 'viuvo' | 'outro' | null
    papel: 'aluno' | 'obreiro'
    turmaId: string | null
    destinoObreiro: ImportDestinoOption | null
    cargo: string | null
  }
}

export type ImportRowResult = {
  rowNumber: number
  nome: string
  email: string
  status: 'criado' | 'ignorado' | 'erro'
  message: string
}
