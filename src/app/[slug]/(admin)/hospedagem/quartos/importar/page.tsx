import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { isManagementRole, userHasAnyRole, HOSPEDAGEM_ROLES } from '@/lib/auth/permissions'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { bulkImportHospedagemStructure, type BulkImportRow } from '../../actions'
import { ImportWizard } from './ImportWizard'

type Props = {
  params: Promise<{ slug: string }>
}

export default async function ImportarQuartosPage({ params }: Props) {
  const { slug } = await params

  const supabase = await createClient()

  const [{ data: { user } }, { data: org }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('organizations').select('id').eq('slug', slug).single(),
  ])
  if (!user || !org) notFound()

  const { role, allRoles } = await getCurrentOrganizationRole(supabase, user.id, org.id)
  if (!isManagementRole(role) && !userHasAnyRole(allRoles, HOSPEDAGEM_ROLES)) notFound()

  // organizationId/createdBy vêm do contexto autenticado no servidor, nunca
  // do client — evita confiar num organizationId que o browser poderia mandar.
  const handleCommit = async (rows: BulkImportRow[]) => {
    'use server'
    const result = await bulkImportHospedagemStructure({ organizationId: org.id, createdBy: user.id, rows })
    revalidatePath(`/${slug}/hospedagem/quartos`)
    return result
  }

  return (
    <>
      <Header title="Importar quartos em lote" backHref={`/${slug}/hospedagem/quartos`} />
      <main className="p-4 md:p-6 space-y-6 max-w-3xl">
        <ImportWizard slug={slug} commitAction={handleCommit} />
      </main>
    </>
  )
}
