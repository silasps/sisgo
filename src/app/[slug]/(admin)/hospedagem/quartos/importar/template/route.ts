import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import { isManagementRole, userHasAnyRole, HOSPEDAGEM_ROLES } from '@/lib/auth/permissions'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { HEADERS, LEGENDA_ROWS, EXAMPLE_ROWS } from '../schema'

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

  const headerRow = Object.values(HEADERS)
  const dataSheet = XLSX.utils.json_to_sheet(EXAMPLE_ROWS, { header: headerRow })
  dataSheet['!cols'] = headerRow.map(h => ({ wch: Math.max(h.length, 16) }))

  const legendSheet = XLSX.utils.aoa_to_sheet([
    ['Campo', 'Valores aceitos'],
    ...LEGENDA_ROWS,
    [],
    ['Como preencher', 'Uma linha por CAMA. Repita Bloco/Andar/Quarto nas linhas seguintes pra adicionar mais camas ao mesmo quarto, ou pra criar mais quartos/andares/blocos.'],
  ])
  legendSheet['!cols'] = [{ wch: 45 }, { wch: 70 }]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, dataSheet, 'Quartos')
  XLSX.utils.book_append_sheet(workbook, legendSheet, 'Legenda')

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="modelo-quartos.xlsx"',
    },
  })
}
