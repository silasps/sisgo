import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createMinistry } from '../[id]/actions'
import { MinistryNameField } from './MinistryNameField'
import { isManagementRole } from '@/lib/auth/permissions'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'

type Props = { params: Promise<{ slug: string }> }

export default async function NovoMinisterioPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single()
  if (!org) notFound()
  const orgId = org.id

  const { data: { user } } = await supabase.auth.getUser()
  const { role } = user
    ? await getCurrentOrganizationRole(supabase, user.id, orgId)
    : { role: '' }
  if (!isManagementRole(role)) notFound()

  const handleCreate = async (formData: FormData) => {
    'use server'
    const name = (formData.get('name') as string).trim()
    const description = (formData.get('description') as string).trim() || null
    if (!name) return
    const id = await createMinistry(orgId, name, description)
    redirect(`/${slug}/ministerios/${id}?msg=criado`)
  }

  return (
    <>
      <Header
        title="Novo Ministério"
        actions={
          <Link
            href={`/${slug}/ministerios`}
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            ← Voltar
          </Link>
        }
      />
      <main className="p-4 md:p-6 max-w-lg">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <form action={handleCreate} className="space-y-5">
            <div>
              <MinistryNameField />
              <p className="mt-2 text-xs text-gray-500">
                ETED e escolas de segundo ou terceiro nível devem ser cadastradas em Escolas, não em Ministérios.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição
              </label>
              <textarea
                name="description"
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                placeholder="Breve descrição do ministério..."
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 bg-brand-500 text-white font-medium rounded-lg text-sm hover:bg-brand-600 transition-colors"
            >
              Criar Ministério
            </button>
          </form>
        </div>
      </main>
    </>
  )
}
