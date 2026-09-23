import ExcelJS from 'exceljs'
import type { ImportContext } from './types'

const HEADERS = [
  'Nome completo*',
  'Email* (vira login)',
  'Telefone',
  'CPF',
  'Data de nascimento (dd/mm/aaaa)',
  'Sexo',
  'Estado civil',
  'Papel*',
  'Turma (se Aluno)',
  'Ministério ou Escola (se Obreiro)',
  'Cargo (se Obreiro)',
]

const DATA_ROWS = 500 // linhas com dropdown pré-aplicado (sobra de margem)

function rangeFormula(sheetName: string, col: string) {
  // Lista dinâmica: cresce/encolhe com o que tiver em Listas!col, sem
  // precisar travar num número fixo de linhas nem sobrar itens em branco.
  return `=OFFSET(${sheetName}!$${col}$2,0,0,COUNTA(${sheetName}!$${col}:$${col})-1,1)`
}

export async function buildImportTemplate(ctx: ImportContext, organizationName: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'sisgo'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Pessoas')
  const listas = workbook.addWorksheet('Listas', { state: 'veryHidden' })

  // ── Listas de apoio (aba oculta) ─────────────────────────────────
  listas.getColumn('A').values = ['Sexo', 'M', 'F', 'Outro']
  listas.getColumn('B').values = ['EstadoCivil', 'Solteiro', 'Casado', 'Divorciado', 'Viúvo', 'Outro']
  listas.getColumn('C').values = ['Papel', 'Aluno', 'Obreiro']
  listas.getColumn('D').values = ['Turma', ...ctx.turmas.map(t => t.label)]
  listas.getColumn('E').values = ['Destino', ...ctx.destinosObreiro.map(d => d.label)]

  // ── Cabeçalho ─────────────────────────────────────────────────────
  sheet.addRow(HEADERS)
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } }
  })
  sheet.columns = [
    { width: 28 }, { width: 28 }, { width: 16 }, { width: 16 }, { width: 20 },
    { width: 10 }, { width: 14 }, { width: 12 }, { width: 32 }, { width: 32 }, { width: 24 },
  ]

  type Validation = { col: number; formulae: [string]; allowBlank: boolean; error: string }
  const validations: Validation[] = [
    { col: 5, formulae: ['"M,F,Outro"'], allowBlank: true, error: 'Escolha um valor da lista.' },
    { col: 6, formulae: ['"Solteiro,Casado,Divorciado,Viúvo,Outro"'], allowBlank: true, error: 'Escolha um valor da lista.' },
    { col: 7, formulae: ['"Aluno,Obreiro"'], allowBlank: false, error: 'Escolha "Aluno" ou "Obreiro".' },
    { col: 8, formulae: [rangeFormula('Listas', 'D')], allowBlank: true, error: 'Escolha uma turma da lista (só se Papel = Aluno).' },
    { col: 9, formulae: [rangeFormula('Listas', 'E')], allowBlank: true, error: 'Escolha um destino da lista (só se Papel = Obreiro).' },
  ]

  for (let row = 2; row <= DATA_ROWS; row++) {
    for (const v of validations) {
      sheet.getCell(row, v.col + 1).dataValidation = {
        type: 'list',
        allowBlank: v.allowBlank,
        formulae: v.formulae,
        showErrorMessage: true,
        errorStyle: 'stop',
        error: v.error,
      }
    }
  }

  // Linha de exemplo (linha 2), pra não deixar o modelo vazio demais.
  sheet.addRow([
    'Maria Exemplo', 'maria@exemplo.org', '(11) 91234-5678', '', '',
    'F', 'Solteiro', 'Aluno', ctx.turmas[0]?.label ?? '', '', '',
  ])
  sheet.getRow(2).font = { italic: true, color: { argb: 'FF9CA3AF' } }

  sheet.getCell('A1').note = `Modelo de import de pessoas — ${organizationName}. Preencha uma linha por pessoa e apague a linha de exemplo antes de subir.`

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
