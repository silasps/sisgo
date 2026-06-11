import { createAdminClient } from '@/lib/supabase/admin'
import { FeedbackCard } from './FeedbackCard'

type Status = 'novo' | 'em_andamento' | 'feito' | 'descartado'

type Feedback = {
  id: string
  page_path: string
  page_label: string | null
  suggestion: string
  created_at: string
  status: Status
}

const COLUMNS: { status: Status; label: string; icon: string; headerColor: string; emptyMsg: string }[] = [
  { status: 'novo',         label: 'Novos',         icon: '💡', headerColor: 'border-blue-400 bg-blue-50',    emptyMsg: 'Nenhuma sugestão nova' },
  { status: 'em_andamento', label: 'Em andamento',  icon: '⚙️', headerColor: 'border-amber-400 bg-amber-50',  emptyMsg: 'Nada em andamento' },
  { status: 'feito',        label: 'Feitos',         icon: '✅', headerColor: 'border-green-400 bg-green-50',  emptyMsg: 'Nada concluído ainda' },
  { status: 'descartado',   label: 'Descartados',   icon: '🗑', headerColor: 'border-gray-300 bg-gray-50',   emptyMsg: 'Nada descartado' },
]

export default async function DevPage() {
  const sb = createAdminClient()

  const { data, error } = await sb
    .from('user_feedback')
    .select('id, page_path, page_label, suggestion, created_at, status')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    return (
      <main className="p-6 max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <p className="font-bold mb-1">Erro ao carregar sugestões</p>
          <p className="font-mono text-xs">{error.message}</p>
          {error.message.includes('column') && (
            <p className="mt-2 text-xs">Rode a migration <strong>047_user_feedback_status.sql</strong> no Supabase Dashboard.</p>
          )}
        </div>
      </main>
    )
  }

  const feedbacks = (data ?? []) as Feedback[]
  const grouped = Object.fromEntries(
    COLUMNS.map(c => [c.status, feedbacks.filter(f => (f.status ?? 'novo') === c.status)])
  ) as Record<Status, Feedback[]>

  const total = feedbacks.length

  return (
    <main className="p-4 md:p-6 space-y-6 min-h-full">

      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Área Dev</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total === 0 ? 'Nenhuma sugestão ainda' : `${total} sugestão${total !== 1 ? 's' : ''} no total`}
          </p>
        </div>
        {/* Contadores rápidos */}
        {total > 0 && (
          <div className="flex gap-2 flex-wrap">
            {COLUMNS.map(c => (
              <span key={c.status} className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${c.headerColor}`}>
                {c.icon} {grouped[c.status].length} {c.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {total === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl px-6 py-16 text-center">
          <p className="text-3xl mb-3">💡</p>
          <p className="text-gray-500 text-sm">Nenhuma sugestão enviada ainda.</p>
          <p className="text-gray-400 text-xs mt-1">O botão aparece em todas as páginas do sistema.</p>
        </div>
      ) : (
        /* Kanban — 4 colunas no desktop, empilhado no mobile */
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map(col => (
            <div key={col.status} className="flex flex-col gap-3">
              {/* Cabeçalho da coluna */}
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-l-4 ${col.headerColor}`}>
                <span>{col.icon}</span>
                <span className="font-bold text-sm text-gray-800">{col.label}</span>
                <span className="ml-auto text-xs font-bold text-gray-500 bg-white px-2 py-0.5 rounded-full shadow-sm">
                  {grouped[col.status].length}
                </span>
              </div>

              {/* Cards */}
              {grouped[col.status].length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-xl px-4 py-8 text-center">
                  <p className="text-xs text-gray-400">{col.emptyMsg}</p>
                </div>
              ) : (
                grouped[col.status].map(item => (
                  <FeedbackCard key={item.id} item={item} />
                ))
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
