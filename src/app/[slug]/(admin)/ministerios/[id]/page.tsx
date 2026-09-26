import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { updateMinistry } from './actions'
import { isManagementRole, isOperationalManager } from '@/lib/auth/permissions'
import { getOrgAndUser, getWorkspaceRole, getWorkspaceMinistry, getWorkspaceMinistryLink } from './_data'
import { Users, ClipboardList } from 'lucide-react'
import { LeaderPanel } from './LeaderPanel'
import { LocaleContentTabs } from '@/components/ui/LocaleContentTabs'

type Props = {
  params: Promise<{ slug: string; id: string }>
  searchParams: Promise<{ msg?: string }>
}

// O chat do ministério (antes embutido aqui, na aba "Chat") virou um dos
// tipos de conversa do Chat institucional (/[slug]/chat) — esta aba
// "Geral" (mesmo nome que a escola já usa) fica só com o resumo/config do
// ministério, sem o mural embutido.
export default async function MinisterioOverviewPage({ params, searchParams }: Props) {
  const { slug, id } = await params
  const { msg } = await searchParams

  const sbAdmin = createAdminClient()

  const { user, orgId } = await getOrgAndUser(slug)
  if (!user || !orgId) notFound()

  const { role, preview } = await getWorkspaceRole(user.id, orgId)
  const isManagement = isManagementRole(role)
  const canWrite = isOperationalManager(role)
    || (await getWorkspaceMinistryLink(user.id, orgId, role, preview, id)) === 'lider'

  const ministry = await getWorkspaceMinistry(orgId, id)
  if (!ministry) notFound()

  const [{ count: memberCount }, { count: pendingCount }] = await Promise.all([
    sbAdmin.from('ministry_members').select('*', { count: 'exact', head: true }).eq('ministry_id', id).eq('active', true),
    // Só gestão/líder vê pendências (mesmo recorte da RLS). Admin porque a RLS
    // exige o papel lider_ministerio, e aqui quem decide é o vínculo.
    isManagement || canWrite
      ? sbAdmin.from('ministry_pending_requests').select('*', { count: 'exact', head: true }).eq('ministry_id', id).eq('status', 'pendente')
      : Promise.resolve({ count: 0 }),
  ])

  const handleUpdate = async (formData: FormData) => {
    'use server'
    const parseTranslations = (key: string) => {
      try { return JSON.parse((formData.get(key) as string) || '{}') } catch { return {} }
    }
    await updateMinistry(ministry.id, {
      name: (formData.get('name') as string).trim(),
      long_name: (formData.get('long_name') as string)?.trim() || null,
      description: (formData.get('description') as string).trim() || null,
      description_translations: parseTranslations('description_translations'),
      active: formData.get('active') === 'on',
      slug: (formData.get('slug') as string)?.trim() || null,
      subtitle: (formData.get('subtitle') as string)?.trim() || null,
      subtitle_translations: parseTranslations('subtitle_translations'),
      hero_image_url: (formData.get('hero_image_url') as string)?.trim() || null,
      is_public: formData.get('is_public') === 'on',
    })
    redirect(`/${slug}/ministerios/${id}?msg=atualizado`)
  }

  const msgs: Record<string, { text: string; cls: string }> = {
    criado:           { text: 'Ministério criado com sucesso.', cls: 'bg-green-50 border-green-200 text-green-700' },
    atualizado:       { text: 'Informações atualizadas.', cls: 'bg-green-50 border-green-200 text-green-700' },
    lider_atribuido:  { text: 'Líder atribuído com sucesso.', cls: 'bg-green-50 border-green-200 text-green-700' },
  }
  const msgInfo = msg ? msgs[msg] : null
  const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400'
  const base = `/${slug}/ministerios/${id}`

  return (
    <main className="flex-1 overflow-y-auto p-3 md:p-6">
      <div className="max-w-2xl mx-auto space-y-3">
        {msgInfo && (
          <div className={`border rounded-lg px-4 py-3 text-sm ${msgInfo.cls}`}>
            {msgInfo.text}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Link href={`${base}/equipe`} className="group bg-white rounded-xl border border-gray-200 p-3 transition-all hover:shadow-md hover:-translate-y-0.5">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-brand-50 p-1.5"><Users size={14} className="text-brand-600" /></div>
              <div>
                <p className="text-lg font-bold text-gray-900 leading-none">{memberCount ?? 0}</p>
                <p className="text-[10px] text-gray-500">Membros</p>
              </div>
            </div>
          </Link>
          <Link href={`/${slug}/pendentes`} className="group bg-white rounded-xl border border-gray-200 p-3 transition-all hover:shadow-md hover:-translate-y-0.5">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-amber-50 p-1.5"><ClipboardList size={14} className="text-amber-600" /></div>
              <div>
                <p className="text-lg font-bold text-gray-900 leading-none">{pendingCount ?? 0}</p>
                <p className="text-[10px] text-gray-500">Pendências</p>
              </div>
            </div>
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          {canWrite ? (
            <>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Informações</h3>
              {ministry.linked_role && (
                <p className="text-[10px] text-indigo-600 font-medium mb-2 bg-indigo-50 inline-block px-1.5 py-0.5 rounded capitalize">Função: {ministry.linked_role}</p>
              )}
              <form action={handleUpdate} className="space-y-2">
                <input name="name" defaultValue={ministry.name} required placeholder="Nome curto (ex: CM)" className={`${INPUT} text-xs`} />
                <input name="long_name" defaultValue={ministry.long_name ?? ''} placeholder="Nome por extenso (ex: Comunicação e Mobilização)" className={`${INPUT} text-xs`} />
                <LocaleContentTabs label="Descrição" name="description" rows={2}
                  defaultValue={ministry.description ?? ''} placeholder="Descrição..."
                  translationsName="description_translations"
                  defaultTranslations={(ministry as unknown as { description_translations: Partial<Record<'en' | 'es', string>> | null }).description_translations ?? {}} />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="active" defaultChecked={ministry.active} className="rounded border-gray-300 text-brand-500 h-3.5 w-3.5" />
                  <span className="text-xs text-gray-600">Ativo</span>
                </label>

                <div className="border-t border-gray-100 pt-2 mt-2 space-y-2">
                  <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Página pública</h4>
                  <input name="slug" defaultValue={ministry.slug ?? ''} placeholder="Slug (URL pública)" className={`${INPUT} text-xs`} />
                  <LocaleContentTabs label="Subtítulo" name="subtitle" rows={2}
                    defaultValue={ministry.subtitle ?? ''} placeholder="Subtítulo"
                    translationsName="subtitle_translations"
                    defaultTranslations={(ministry as unknown as { subtitle_translations: Partial<Record<'en' | 'es', string>> | null }).subtitle_translations ?? {}} />
                  <input name="hero_image_url" defaultValue={ministry.hero_image_url ?? ''} placeholder="URL da imagem hero" className={`${INPUT} text-xs`} />
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="is_public" defaultChecked={ministry.is_public} className="rounded border-gray-300 text-brand-500 h-3.5 w-3.5" />
                    <span className="text-xs text-gray-600">Página pública ativa</span>
                  </label>
                  {ministry.is_public && ministry.slug && (
                    <a
                      href={`/${slug}/servir/${ministry.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-[10px] text-brand-600 hover:text-brand-700 truncate"
                    >
                      Ver página pública →
                    </a>
                  )}
                </div>

                <button type="submit" className="w-full px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-500 hover:bg-brand-600 text-white transition-colors">
                  Salvar
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-900">{ministry.name}</h3>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ministry.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {ministry.active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              {ministry.linked_role && (
                <p className="text-[10px] text-indigo-600 font-medium mt-1 bg-indigo-50 inline-block px-1.5 py-0.5 rounded capitalize">Função: {ministry.linked_role}</p>
              )}
              {ministry.description && <p className="text-xs text-gray-500 mt-1">{ministry.description}</p>}
            </>
          )}
        </div>

        {/* Sem Suspense de propósito: isso existia pra não bloquear o mural
            (a consulta mais lenta da tela era o listUsers deste painel, e o
            mural precisava aparecer rápido). Sem mural aqui (mudou pro
            Chat), manter isso como streaming só fazia a tela "pipocar" um
            card a mais alguns instantes depois de já ter carregado — daí o
            usuário ver a página carregar 2 vezes. Uma única carga direta
            (mesmo que espere o listUsers) é o resultado que ele pediu. */}
        {isManagement && <LeaderPanel slug={slug} ministryId={id} orgId={orgId} />}
      </div>
    </main>
  )
}
