'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { AnimatedDonutChart } from '@/components/ui/AnimatedDonutChart'
import { PendentesCardList, type PendenteModalItem } from './PendentesCardList'

type Segment = { label: string; value: number; color: string; key?: string }

const CATEGORIA_KEY_TO_LABEL: Record<string, string> = {
  pre_inscricao: 'Pré-inscrição',
  candidato_aluno: 'Candidato a Aluno',
  candidato_obreiro: 'Candidato a Obreiro',
}

function urgencyBucket(dias: number): 'ok' | 'atencao' | 'urgente' {
  if (dias <= 1) return 'ok'
  if (dias === 2) return 'atencao'
  return 'urgente'
}

export function PendentesFilterPanel({
  items, categorySegments, urgencySegments, initialQ, initialCategoria, initialUrgencia,
}: {
  items: PendenteModalItem[]
  categorySegments: Segment[]
  urgencySegments: Segment[]
  initialQ?: string
  initialCategoria?: string
  initialUrgencia?: string
}) {
  // Filtro é 100% local: os dados já vieram todos do servidor, então não há
  // por quê navegar/re-buscar a cada clique — só re-derivar `filteredItems`
  // na memória. `initial*` só existe pra respeitar um link direto com filtro.
  const [q, setQ] = useState(initialQ ?? '')
  const [categoria, setCategoria] = useState(initialCategoria)
  const [urgencia, setUrgencia] = useState(initialUrgencia)

  const filteredItems = useMemo(() => items.filter(i => {
    if (q && !i.nome.toLowerCase().includes(q.toLowerCase())) return false
    if (categoria && i.categoria !== CATEGORIA_KEY_TO_LABEL[categoria]) return false
    if (urgencia && urgencyBucket(i.diasAberto) !== urgencia) return false
    return true
  }), [items, q, categoria, urgencia])

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Por categoria</h3>
          <AnimatedDonutChart
            segments={categorySegments}
            title="total"
            activeValue={categoria}
            onSelect={key => setCategoria(c => (c === key ? undefined : key))}
          />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Por urgência</h3>
          <AnimatedDonutChart
            segments={urgencySegments}
            title="total"
            activeValue={urgencia}
            onSelect={key => setUrgencia(u => (u === key ? undefined : key))}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar por nome…"
            className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white w-full focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
          />
        </div>
        {(categoria || urgencia) && (
          <button
            type="button"
            onClick={() => { setCategoria(undefined); setUrgencia(undefined) }}
            className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200"
          >
            Limpar filtro do gráfico ✕
          </button>
        )}
      </div>

      <PendentesCardList items={filteredItems} />
    </>
  )
}
