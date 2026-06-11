// Lê uma planilha (.xlsx/.xls) ou um CSV/TSV e devolve um array de
// objetos { [cabeçalho]: valor }, usando a primeira linha como
// cabeçalho.

import fs from 'node:fs'
import path from 'node:path'

function parseDelimited(content, delimiter) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    const next = content[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; continue }
      if (ch === '"') { inQuotes = false; continue }
      field += ch
      continue
    }

    if (ch === '"') { inQuotes = true; continue }
    if (ch === delimiter) { row.push(field); field = ''; continue }
    if (ch === '\r') continue
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue }
    field += ch
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }

  const [header, ...dataRows] = rows
  return dataRows
    .filter(r => r.some(c => c !== ''))
    .map(r => Object.fromEntries(header.map((h, idx) => [h.trim(), r[idx] ?? ''])))
}

export async function readTable(filePath) {
  const ext = path.extname(filePath).toLowerCase()

  if (ext === '.csv' || ext === '.tsv' || ext === '.txt') {
    const content = fs.readFileSync(filePath, 'utf-8')
    const firstLine = content.split('\n')[0]
    const delimiter = ext === '.tsv' ? '\t' : (firstLine.includes(';') ? ';' : ',')
    return parseDelimited(content, delimiter)
  }

  if (ext === '.xlsx' || ext === '.xls') {
    let XLSX
    try {
      XLSX = (await import('xlsx')).default
    } catch {
      throw new Error(
        'O pacote "xlsx" não está instalado. Rode `npm install` na raiz do projeto ' +
        '(o pacote já foi adicionado ao package.json) e tente novamente. ' +
        'Alternativa: salve a planilha como CSV (UTF-8) e rode o script com o .csv.'
      )
    }
    const workbook = XLSX.readFile(filePath)
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    return XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' })
  }

  throw new Error(`Extensão de arquivo não suportada: "${ext}". Use .xlsx, .xls ou .csv.`)
}
