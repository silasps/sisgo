/**
 * TEMPLATE — copie este arquivo para src/app/admin/[modulo]/page.tsx
 *
 * Padrão mobile-first do SISGO:
 *  - Header + main com padding responsivo (p-4 md:p-6)
 *  - Listagens: cards no mobile, tabela no desktop (md:hidden / hidden md:block)
 *  - Ações do header: botões com whitespace-nowrap, sempre visíveis
 *  - Formulários: max-w-lg mx-auto, campos full-width
 */

import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
// import Link from 'next/link'

// Tipagem do dado retornado pelo Supabase
type Item = {
  id: string
  name: string
  detail: string | null
  created_at: string
}

export default async function TemplatePage() {
  const supabase = await createClient()

  // Troque pela query real
  const { data: items } = await supabase
    .from('sua_tabela')
    .select('id, name, detail, created_at')
    .order('name') as { data: Item[] | null }

  return (
    <>
      {/* Header fixo no topo com título e ação principal */}
      <Header
        title="Título da Tela"
        actions={
          <button className="px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600">
            + Novo item
          </button>
        }
      />

      <main className="p-4 md:p-6">
        {/* Estado vazio */}
        {!items?.length ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
            <p className="text-2xl mb-2">📋</p>
            <p className="text-gray-500 text-sm">Nenhum item cadastrado ainda.</p>
          </div>
        ) : (
          <>
            {/* ── MOBILE: lista de cards ─────────────────────────────── */}
            <div className="md:hidden space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border border-gray-200 p-4"
                >
                  <p className="font-medium text-gray-900">{item.name}</p>
                  {item.detail && (
                    <p className="text-sm text-gray-500 mt-1">{item.detail}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(item.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              ))}
            </div>

            {/* ── DESKTOP: tabela ───────────────────────────────────── */}
            <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Detalhe</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Criado em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                      <td className="px-4 py-3 text-gray-500">{item.detail ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(item.created_at).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </>
  )
}

/**
 * TEMPLATE DE FORMULÁRIO (página nova/edição)
 * Copie para src/app/admin/[modulo]/novo/page.tsx
 *
 * export default function NovoItemPage() {
 *   return (
 *     <>
 *       <Header title="Novo Item" />
 *       <main className="p-4 md:p-6">
 *         <div className="max-w-lg mx-auto">
 *           <form className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
 *             <div>
 *               <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome</label>
 *               <input
 *                 type="text"
 *                 name="name"
 *                 required
 *                 className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
 *               />
 *             </div>
 *             <BtnPrimary type="submit">Salvar</BtnPrimary>
 *           </form>
 *         </div>
 *       </main>
 *     </>
 *   )
 * }
 */
