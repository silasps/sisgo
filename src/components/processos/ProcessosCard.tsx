import Link from 'next/link'
import { Workflow } from 'lucide-react'
import { MOVE_TYPE_LABEL, type ProcessItem } from '@/lib/processes'

// Roxo = processo em andamento (movimentação de obreiro) em todo o sistema:
// card do Início, seção de Pendências, página /processos e o aviso nas
// telas de equipe. Vez do DH → roxo cheio; vez de um líder → roxo claro.

export function ProcessStatusBadge({ item, className = '' }: { item: ProcessItem; className?: string }) {
  const cls = item.stage === 'dh'
    ? 'bg-purple-600 text-white'
    : item.stage
      ? 'bg-purple-100 text-purple-700'
      : item.status === 'aprovado' || item.status === 'efetivado'
        ? 'bg-green-100 text-green-700'
        : 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${cls} ${className}`}>
      {item.statusLabel}
    </span>
  )
}

const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('pt-BR')

/** Período do acúmulo (transferência não tem período). */
export function processPeriodText(item: Pick<ProcessItem, 'moveType' | 'startsOn' | 'endsOn'>): string | null {
  if (item.moveType !== 'acumulo' || !item.startsOn) return null
  return item.endsOn ? `${fmtDay(item.startsOn)} a ${fmtDay(item.endsOn)}` : `a partir de ${fmtDay(item.startsOn)}, sem prazo`
}

/** Como a pessoa vai servir: acúmulo de funções ou transferência. */
export function ProcessMoveTypeTag({ moveType }: { moveType: ProcessItem['moveType'] }) {
  return (
    <span className="inline-block text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
      {MOVE_TYPE_LABEL[moveType]}
    </span>
  )
}

/** Resumo dos processos em andamento — Início do DH/gestão e topo de Pendências. */
export function ProcessosCard({ slug, items, maxItems = 4 }: { slug: string; items: ProcessItem[]; maxItems?: number }) {
  const awaitingDh = items.filter(i => i.stage === 'dh').length
  // Vez do DH primeiro; dentro de cada grupo, o mais antigo primeiro.
  const shown = [...items].sort((a, b) => Number(b.stage === 'dh') - Number(a.stage === 'dh')).slice(0, maxItems)

  return (
    <section className="rounded-xl border border-purple-200 bg-purple-50/60 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-purple-100">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-purple-600 text-white">
            <Workflow size={15} aria-hidden />
          </span>
          <h3 className="text-sm font-semibold text-purple-900 truncate">Processos em andamento</h3>
          {items.length > 0 && (
            <span className="text-xs font-bold bg-purple-600 text-white px-1.5 py-0.5 rounded-full leading-none">{items.length}</span>
          )}
        </div>
        <Link href={`/${slug}/processos`} className="text-xs font-medium text-purple-700 hover:underline shrink-0">
          Ver todos →
        </Link>
      </div>
      <div className="p-3 space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-purple-800/60 text-center py-3">Nenhum processo em andamento na base.</p>
        ) : (
          <>
            {awaitingDh > 0 && (
              <p className="text-xs font-semibold text-purple-800 px-1">
                {awaitingDh === 1 ? '1 aguardando decisão do DH' : `${awaitingDh} aguardando decisão do DH`}
              </p>
            )}
            {shown.map(item => (
              <Link
                key={`${item.kind}-${item.id}`}
                href={`/${slug}/processos?highlight=${item.id}`}
                className="group flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3 rounded-lg bg-white border border-purple-100 px-3 py-2.5 transition-all duration-150 hover:shadow-md hover:-translate-y-0.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-purple-700 transition-colors truncate">{item.personName}</p>
                  <p className="text-xs text-gray-500 truncate">{item.from.name} → {item.to.name} · {MOVE_TYPE_LABEL[item.moveType]}</p>
                </div>
                {/* No celular o selo (texto longo) vai pra baixo, senão espreme o trajeto */}
                <ProcessStatusBadge item={item} className="self-start sm:mt-0.5" />
              </Link>
            ))}
            {items.length > shown.length && (
              <Link href={`/${slug}/processos`} className="block text-center text-xs font-medium text-purple-700 hover:underline pt-1">
                + {items.length - shown.length} processo(s)
              </Link>
            )}
          </>
        )}
      </div>
    </section>
  )
}
