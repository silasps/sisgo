import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'

type Props = { params: Promise<{ slug: string }> }

const SCHOOL_TYPES = [
  { value: 'eted', label: 'ETED — Escola de Treinamento e Discipulado' },
  { value: 'udn', label: 'UDN — Universidade das Nações' },
  { value: 'seminario', label: 'Seminário' },
  { value: 'curso_online', label: 'Curso Online' },
  { value: 'voluntariado', label: 'Voluntariado' },
  { value: 'outro', label: 'Outro' },
]

export default async function NovaEscolaPage({ params }: Props) {
  const { slug } = await params

  async function createSchool(formData: FormData) {
    'use server'
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const sb = createAdminClient()
    const { data: org } = await sb.from('organizations').select('id').eq('slug', slug).single()
    if (!org) return

    const { data: escola } = await sb.from('schools').insert({
      organization_id: org.id,
      name: formData.get('name') as string,
      school_type: formData.get('school_type') as string,
      is_public: false,
      active: true,
    }).select('id').single()

    if (escola) redirect(`/${slug}/escolas/${escola.id}`)
  }

  return (
    <>
      <Header title="Nova escola" />
      <main className="p-4 md:p-6">
        <form action={createSchool} className="bg-white rounded-xl border border-gray-200 p-6 max-w-lg space-y-4">
          <p className="text-sm text-gray-500">Preencha os dados básicos para criar a escola. Você poderá editar todos os detalhes na próxima etapa.</p>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nome da escola *</label>
            <input name="name" required placeholder="Ex: Escola de Treinamento e Discipulado"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de escola</label>
            <select name="school_type" defaultValue="eted"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
              {SCHOOL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Link href={`/${slug}/escolas`}
              className="px-5 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Cancelar
            </Link>
            <button type="submit"
              className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors">
              Criar e editar →
            </button>
          </div>
        </form>
      </main>
    </>
  )
}
