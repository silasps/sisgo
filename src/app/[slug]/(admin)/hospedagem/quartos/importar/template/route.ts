import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/server'
import { isManagementRole, userHasAnyRole, HOSPEDAGEM_ROLES } from '@/lib/auth/permissions'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { HEADERS, LEGENDA_ROWS, EXAMPLE_ROWS, DESTINOS, GENEROS, TIPOS_QUARTO, MODOS_ALOCACAO, TIPOS_CAMA } from '../schema'

// Colunas de opção fixa — ganham dropdown de verdade na planilha (em vez de
// só listar os valores aceitos na aba Legenda, que é fácil de não notar).
const VALIDATED_COLUMNS: Array<{ header: string; options: readonly string[] }> = [
  { header: HEADERS.andarDestino, options: DESTINOS },
  { header: HEADERS.andarGenero, options: GENEROS },
  { header: HEADERS.quartoTipo, options: TIPOS_QUARTO },
  { header: HEADERS.quartoGenero, options: GENEROS },
  { header: HEADERS.quartoDestino, options: DESTINOS },
  { header: HEADERS.quartoModo, options: MODOS_ALOCACAO },
  { header: HEADERS.camaTipo, options: TIPOS_CAMA },
]

// Linhas suficientes pra planilha crescer bem além dos exemplos sem perder o dropdown.
const DATA_VALIDATION_LAST_ROW = 500

// Mesmo modelo pra toda organização — não depende de dados específicos, só
// confere que quem baixa está autenticado e tem acesso de gestão de
// hospedagem (mesma trava da tela /quartos).
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const [{ data: { user } }, { data: org }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('organizations').select('id').eq('slug', slug).single(),
  ])
  if (!user || !org) return new Response('Não encontrado.', { status: 404 })

  const { role, allRoles } = await getCurrentOrganizationRole(supabase, user.id, org.id)
  if (!isManagementRole(role) && !userHasAnyRole(allRoles, HOSPEDAGEM_ROLES)) {
    return new Response('Sem permissão.', { status: 403 })
  }

  const workbook = new ExcelJS.Workbook()
  const headerRow: string[] = Object.values(HEADERS)

  const dataSheet = workbook.addWorksheet('Quartos')
  dataSheet.columns = headerRow.map(h => ({ header: h, key: h, width: Math.max(h.length, 16) }))
  dataSheet.views = [{ state: 'frozen', ySplit: 1 }]
  for (const row of EXAMPLE_ROWS) dataSheet.addRow(row)

  for (const { header, options } of VALIDATED_COLUMNS) {
    const colIndex = headerRow.indexOf(header) + 1
    const validation = {
      type: 'list' as const,
      allowBlank: true,
      formulae: [`"${options.join(',')}"`],
      showErrorMessage: true,
      errorStyle: 'warning' as const,
      errorTitle: 'Valor fora da lista',
      error: `Use um dos valores: ${options.join(', ')} (ou deixe em branco).`,
    }
    for (let r = 2; r <= DATA_VALIDATION_LAST_ROW; r++) {
      dataSheet.getCell(r, colIndex).dataValidation = validation
    }
  }

  const legendSheet = workbook.addWorksheet('Legenda')
  legendSheet.columns = [{ width: 45 }, { width: 70 }]
  legendSheet.views = [{ state: 'frozen', ySplit: 1 }]
  legendSheet.addRow(['Campo', 'Valores aceitos'])
  for (const [campo, valores] of LEGENDA_ROWS) legendSheet.addRow([campo, valores])
  legendSheet.addRow([])
  legendSheet.addRow(['Como preencher', 'Uma linha por CAMA. Repita Bloco/Andar/Quarto nas linhas seguintes pra adicionar mais camas ao mesmo quarto, ou pra criar mais quartos/andares/blocos.'])

  const buffer = await workbook.xlsx.writeBuffer()

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="modelo-quartos.xlsx"',
    },
  })
}
