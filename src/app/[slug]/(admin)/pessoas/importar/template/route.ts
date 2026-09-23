import { createClient } from '@/lib/supabase/server'
import { MANAGEMENT_ROLES } from '@/lib/auth/permissions'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { buildImportContext } from '@/lib/import-pessoas/context'
import { buildImportTemplate } from '@/lib/import-pessoas/template'

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const [{ data: { user } }, { data: org }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('organizations').select('id, name').eq('slug', slug).single(),
  ])
  if (!user || !org) return new Response('Não encontrado.', { status: 404 })

  const { role } = await getCurrentOrganizationRole(supabase, user.id, org.id)
  if (!MANAGEMENT_ROLES.includes(role as never)) return new Response('Sem permissão.', { status: 403 })

  const ctx = await buildImportContext(org.id, slug)
  const buffer = await buildImportTemplate(ctx, org.name)

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="import-pessoas-${slug}.xlsx"`,
    },
  })
}
