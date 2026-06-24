import { createAdminClient } from '@/lib/supabase/admin'
import { DevBoard } from './DevBoard'
import { Lightbulb, Settings, CheckCircle2, Trash2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Status = 'novo' | 'em_andamento' | 'feito' | 'descartado'

type Feedback = {
  id: string
  page_path: string
  page_label: string | null
  suggestion: string
  created_at: string
  status: Status
}

const COLUMNS: { status: Status; label: string; icon: LucideIcon; headerColor: string }[] = [
  { status: 'novo',         label: 'Novos',        icon: Lightbulb,    headerColor: 'border-blue-400 bg-blue-50' },
  { status: 'em_andamento', label: 'Em andamento', icon: Settings,     headerColor: 'border-amber-400 bg-amber-50' },
  { status: 'feito',        label: 'Feitos',        icon: CheckCircle2, headerColor: 'border-green-400 bg-green-50' },
  { status: 'descartado',   label: 'Descartados',  icon: Trash2,       headerColor: 'border-gray-300 bg-gray-50' },
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
  const total = feedbacks.length
  const grouped = Object.fromEntries(
    COLUMNS.map(c => [c.status, feedbacks.filter(f => (f.status ?? 'novo') === c.status)])
  ) as Record<Status, Feedback[]>

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
        {total > 0 && (
          <div className="flex gap-2 flex-wrap">
            {COLUMNS.map(c => (
              <span key={c.status} className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${c.headerColor} inline-flex items-center gap-1.5`}>
                <c.icon className="size-3.5" /> {grouped[c.status].length} {c.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {total === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl px-6 py-16 text-center">
          <Lightbulb className="size-8 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 text-sm">Nenhuma sugestão enviada ainda.</p>
          <p className="text-gray-400 text-xs mt-1">O botão aparece em todas as páginas do sistema.</p>
        </div>
      ) : (
        <DevBoard initialItems={feedbacks} />
      )}
    </main>
  )
}
