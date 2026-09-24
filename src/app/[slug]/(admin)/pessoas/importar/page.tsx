import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { Header } from '@/components/layout/Header'
import { MANAGEMENT_ROLES } from '@/lib/auth/permissions'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { listarObreirosSemEmail } from '@/lib/import-pessoas/pendentes'
import { preverImportacaoPessoas, confirmarImportacaoPessoas, contarCredenciaisPendentes, enviarCredenciaisPendentes } from './actions'
import { ImportarPessoasWizard } from './ImportarPessoasWizard'
import { EnviarPendentesButton } from './EnviarPendentesButton'
import { PendentesSemEmailList } from './PendentesSemEmailList'

type Props = { params: Promise<{ slug: string }> }

export default async function ImportarPessoasPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const [{ data: { user } }, { data: org }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('organizations').select('id, name').eq('slug', slug).single(),
  ])
  if (!user || !org) redirect(`/${slug}/pessoas`)

  const { role } = await getCurrentOrganizationRole(supabase, user.id, org.id)
  if (!MANAGEMENT_ROLES.includes(role as never)) redirect(`/${slug}/pessoas`)

  const [pendentes, pendentesSemEmail] = await Promise.all([
    contarCredenciaisPendentes(org.id),
    listarObreirosSemEmail(org.id, slug),
  ])

  const hdrs = await headers()
  const host = hdrs.get('host') ?? 'localhost:3000'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  const baseUrl = `${protocol}://${host}`

  return (
    <div className="flex flex-col h-full">
      <Header title="Importar pessoas" backHref={`/${slug}/pessoas`} />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-4xl">
          <EnviarPendentesButton
            pendentes={pendentes}
            action={enviarCredenciaisPendentes.bind(null, org.id, slug, org.name)}
          />
          <PendentesSemEmailList pessoas={pendentesSemEmail} baseUrl={baseUrl} />
        </div>
        <ImportarPessoasWizard
          slug={slug}
          previewAction={preverImportacaoPessoas.bind(null, org.id, slug)}
          confirmAction={confirmarImportacaoPessoas.bind(null, org.id, slug, org.name)}
        />
      </div>
    </div>
  )
}
