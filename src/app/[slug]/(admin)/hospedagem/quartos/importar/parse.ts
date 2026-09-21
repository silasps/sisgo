'use server'

import * as XLSX from 'xlsx'
import type { BulkImportRow } from '../../actions'
import { HEADERS, DESTINOS, GENEROS, TIPOS_QUARTO, MODOS_ALOCACAO, TIPOS_CAMA, DEFAULTS } from './schema'

export type ParsedRow = BulkImportRow & {
  rowNumber: number
  warnings: string[]
  error: string | null
}

function cell(row: Record<string, unknown>, header: string): string {
  const value = row[header]
  return value === undefined || value === null ? '' : String(value).trim()
}

function normalizeEnum<T extends string>(raw: string, valid: readonly T[]): { value: T | null; recognized: boolean } {
  if (!raw) return { value: null, recognized: true }
  const lower = raw.toLowerCase()
  const match = valid.find(v => v === lower)
  return match ? { value: match, recognized: true } : { value: null, recognized: false }
}

// Lê a planilha enviada e valida linha a linha contra o esquema — não grava
// nada no banco (isso só acontece em bulkImportHospedagemStructure, depois
// que o usuário revisa o preview e confirma).
export async function parseImportRows(formData: FormData): Promise<{ rows: ParsedRow[]; fatalError?: string }> {
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { rows: [], fatalError: 'Selecione um arquivo .xlsx antes de continuar.' }
  }

  let raw: Array<Record<string, unknown>>
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) return { rows: [], fatalError: 'A planilha não tem nenhuma aba com dados.' }
    raw = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: false })
  } catch {
    return { rows: [], fatalError: 'Não foi possível ler o arquivo — confira se é um .xlsx válido (baixe o modelo se tiver dúvida do formato).' }
  }

  if (raw.length === 0) return { rows: [], fatalError: 'A planilha não tem nenhuma linha de dados.' }

  const rows: ParsedRow[] = raw.map((r, i) => {
    const rowNumber = i + 2 // linha 1 é o cabeçalho
    const warnings: string[] = []

    const bloco = cell(r, HEADERS.bloco)
    const andar = cell(r, HEADERS.andar)
    const quarto = cell(r, HEADERS.quarto)

    if (!bloco || !andar || !quarto) {
      return {
        rowNumber, bloco, andar, quarto,
        andarDestino: null, andarGenero: null,
        quartoTipo: DEFAULTS.quartoTipo, quartoGenero: null, quartoDestino: DEFAULTS.quartoDestino, quartoModo: DEFAULTS.quartoModo,
        camaRotulo: null, camaTipo: DEFAULTS.camaTipo,
        warnings: [],
        error: `Faltando ${[!bloco && 'Bloco', !andar && 'Andar', !quarto && 'Quarto'].filter(Boolean).join(', ')} — linha ignorada.`,
      }
    }

    const andarDestinoRaw = cell(r, HEADERS.andarDestino)
    const andarDestino = normalizeEnum(andarDestinoRaw, DESTINOS)
    if (!andarDestino.recognized) warnings.push(`Destino de andar "${andarDestinoRaw}" não reconhecido — deixado em branco.`)

    const andarGeneroRaw = cell(r, HEADERS.andarGenero)
    const andarGenero = normalizeEnum(andarGeneroRaw, GENEROS)
    if (!andarGenero.recognized) warnings.push(`Restrição de gênero do andar "${andarGeneroRaw}" não reconhecida — deixada em branco.`)

    const quartoTipoRaw = cell(r, HEADERS.quartoTipo)
    const quartoTipo = normalizeEnum(quartoTipoRaw, TIPOS_QUARTO)
    if (!quartoTipo.recognized) warnings.push(`Tipo de quarto "${quartoTipoRaw}" não reconhecido — usando "${DEFAULTS.quartoTipo}".`)

    // Quarto em branco herda o valor do andar (o caso mais comum — a maioria
    // dos quartos de um andar compartilha o mesmo destino/gênero); só cai no
    // padrão fixo se nem o andar tiver valor. Preencher a coluna do quarto
    // continua funcionando pra sobrescrever num caso específico.
    const quartoGeneroRaw = cell(r, HEADERS.quartoGenero)
    const quartoGenero = normalizeEnum(quartoGeneroRaw, GENEROS)
    if (!quartoGenero.recognized) warnings.push(`Restrição de gênero do quarto "${quartoGeneroRaw}" não reconhecida — usando a do andar.`)

    const quartoDestinoRaw = cell(r, HEADERS.quartoDestino)
    const quartoDestino = normalizeEnum(quartoDestinoRaw, DESTINOS)
    if (!quartoDestino.recognized) warnings.push(`Destino de quarto "${quartoDestinoRaw}" não reconhecido — usando o do andar.`)

    const quartoModoRaw = cell(r, HEADERS.quartoModo)
    const quartoModo = normalizeEnum(quartoModoRaw, MODOS_ALOCACAO)
    if (!quartoModo.recognized) warnings.push(`Modo de alocação "${quartoModoRaw}" não reconhecido — usando "${DEFAULTS.quartoModo}".`)

    const camaRotuloRaw = cell(r, HEADERS.camaRotulo)
    const camaTipoRaw = cell(r, HEADERS.camaTipo)
    const camaTipo = normalizeEnum(camaTipoRaw, TIPOS_CAMA)
    if (camaRotuloRaw && camaTipoRaw && !camaTipo.recognized) {
      warnings.push(`Tipo de cama "${camaTipoRaw}" não reconhecido — usando "${DEFAULTS.camaTipo}".`)
    }
    if (!camaRotuloRaw && (quartoModo.value ?? DEFAULTS.quartoModo) === 'cama') {
      warnings.push('Sem cama nesta linha — o quarto é criado, mas fica sem nenhuma cama cadastrada.')
    }

    return {
      rowNumber, bloco, andar, quarto,
      andarDestino: andarDestino.value,
      andarGenero: andarGenero.value,
      quartoTipo: quartoTipo.value ?? DEFAULTS.quartoTipo,
      quartoGenero: quartoGenero.value ?? andarGenero.value,
      quartoDestino: quartoDestino.value ?? andarDestino.value ?? DEFAULTS.quartoDestino,
      quartoModo: quartoModo.value ?? DEFAULTS.quartoModo,
      camaRotulo: camaRotuloRaw || null,
      camaTipo: camaTipo.value ?? DEFAULTS.camaTipo,
      warnings,
      error: null,
    }
  })

  return { rows }
}
