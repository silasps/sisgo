import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { notFound, redirect } from 'next/navigation'

type Props = { params: Promise<{ slug: string }> }

type Program = {
  id: string
  name: string
  description: string | null
  icon: string | null
  image_url: string | null
  additional_cost: number | null
  active: boolean
  sort_order: number
}

export default async function ProgramasPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!org) notFound()

  const { data: programs } = await supabase
    .from('school_programs')
    .select('*')
    .eq('organization_id', org.id)
    .order('sort_order')
    .order('name')

  async function createProgram(formData: FormData) {
    'use server'
    const orgId = formData.get('org_id') as string
    if (!orgId) return

    const { createAdminClient } = await import('@/lib/supabase/admin')
    const sb = createAdminClient()

    const base = {
      organization_id: orgId,
      name: formData.get('name') as string,
      description: (formData.get('description') as string) || null,
      icon: (formData.get('icon') as string) || null,
      additional_cost: formData.get('additional_cost') ? Number(formData.get('additional_cost')) : null,
    }

    const imageUrl = (formData.get('image_url') as string) || null
    const { error } = await sb.from('school_programs').insert({ ...base, image_url: imageUrl })
    if (error) {
      // Coluna image_url ainda não existe no banco — insere sem ela
      await sb.from('school_programs').insert(base)
    }

    redirect(`/${slug}/escolas/programas`)
  }

  async function toggleActive(formData: FormData) {
    'use server'
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const sb = createAdminClient()
    const id = formData.get('id') as string
    const active = formData.get('active') === 'true'
    await sb.from('school_programs').update({ active: !active }).eq('id', id)
    redirect(`/${slug}/escolas/programas`)
  }

  async function deleteProgram(formData: FormData) {
    'use server'
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const sb = createAdminClient()
    await sb.from('school_programs').delete().eq('id', formData.get('id') as string)
    redirect(`/${slug}/escolas/programas`)
  }

  const list = (programs ?? []) as unknown as Program[]

  return (
    <>
      <Header title="Atividades extras" />
      <main className="p-4 md:p-6 space-y-6">

        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Adicionar atividade</h2>
          <form action={createProgram} className="grid sm:grid-cols-2 gap-4">
            <input type="hidden" name="org_id" value={org.id} />
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Nome *</label>
              <input name="name" required placeholder="Ex: Cordas, Perspectivas Brasil…"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Descrição</label>
              <input name="description" placeholder="Breve descrição da atividade"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div className="sm:col-span-2">
              <ImageUpload name="image_url" label="Imagem da atividade" folder="programs" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Emoji (substituto sem imagem)</label>
              <input name="icon" placeholder="⭐" maxLength={4}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Custo adicional (R$)</label>
              <input name="additional_cost" type="number" step="0.01" min="0" placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button type="submit"
                className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors">
                + Adicionar atividade
              </button>
            </div>
          </form>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 mb-3">Atividades cadastradas</h2>
          {!list.length ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center">
              <p className="text-gray-400 text-sm">Nenhuma atividade cadastrada ainda.</p>
              <p className="text-gray-400 text-xs mt-1">Sugestões: Cordas, Perspectivas Brasil, Impacto de Carnaval, Niko, Go Legacy</p>
            </div>
          ) : (
            <div className="space-y-2">
              {list.map(prog => (
                <div key={prog.id}
                  className={`bg-white rounded-xl border p-4 flex items-center gap-3 transition-opacity ${!prog.active ? 'opacity-50 border-gray-100' : 'border-gray-200'}`}>

                  <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 flex items-center justify-center">
                    {prog.image_url ? (
                      <img src={prog.image_url} alt={prog.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">{prog.icon ?? '⭐'}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{prog.name}</p>
                      {!prog.active && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Inativa</span>}
                    </div>
                    {prog.description && <p className="text-xs text-gray-500 truncate">{prog.description}</p>}
                    {prog.additional_cost && (
                      <p className="text-xs text-brand-500 font-medium">
                        + R$ {Number(prog.additional_cost).toFixed(2).replace('.', ',')}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <form action={toggleActive}>
                      <input type="hidden" name="id" value={prog.id} />
                      <input type="hidden" name="active" value={String(prog.active)} />
                      <button type="submit"
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                          prog.active ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-green-50 text-green-700 hover:bg-green-100'
                        }`}>
                        {prog.active ? 'Desativar' : 'Ativar'}
                      </button>
                    </form>
                    <form action={deleteProgram}>
                      <input type="hidden" name="id" value={prog.id} />
                      <button type="submit"
                        className="text-xs px-2 py-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                        ✕
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>
    </>
  )
}
