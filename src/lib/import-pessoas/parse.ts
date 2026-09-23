import * as XLSX from 'xlsx'
import type { ImportRawRow } from './types'

const COL = {
  nome: 'Nome completo*',
  email: 'Email* (vira login)',
  telefone: 'Telefone',
  cpf: 'CPF',
  dataNascimento: 'Data de nascimento (dd/mm/aaaa)',
  sexo: 'Sexo',
  estadoCivil: 'Estado civil',
  papel: 'Papel*',
  turma: 'Turma (se Aluno)',
  destinoObreiro: 'Ministério ou Escola (se Obreiro)',
  cargo: 'Cargo (se Obreiro)',
} as const

function clean(value: unknown): string {
  return String(value ?? '').trim()
}

export function parseImportFile(buffer: Buffer): ImportRawRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: false, defval: '' })

  return rows
    .map((row, idx): ImportRawRow => ({
      rowNumber: idx + 2, // +1 cabeçalho, +1 índice 0-based -> 1-based
      nome: clean(row[COL.nome]),
      email: clean(row[COL.email]).toLowerCase(),
      telefone: clean(row[COL.telefone]),
      cpf: clean(row[COL.cpf]),
      dataNascimento: clean(row[COL.dataNascimento]),
      sexo: clean(row[COL.sexo]),
      estadoCivil: clean(row[COL.estadoCivil]),
      papel: clean(row[COL.papel]),
      turma: clean(row[COL.turma]),
      destinoObreiro: clean(row[COL.destinoObreiro]),
      cargo: clean(row[COL.cargo]),
    }))
    .filter(row => Object.values(row).some((v, i) => i > 0 && v !== '')) // ignora linhas totalmente vazias (ex. sobras do modelo)
}
