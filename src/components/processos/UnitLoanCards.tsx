import type { ProcessItem } from '@/lib/processes'
import { ProcessMoveTypeTag, ProcessStatusBadge, processPeriodText } from './ProcessosCard'

// Cards de pedido de obreiro nas telas de equipe (escolas/[id]/equipe e
// ministerios/[id]/equipe) — iguais nas duas.

/** Líder ATUAL: pediram um obreiro daqui. A resposta dele não efetiva — vai pro DH dar o OK final. */
export function OutgoingLoansCard({ loans, approveAction, rejectAction }: {
  loans: ProcessItem[]
  approveAction: (formData: FormData) => Promise<void>
  rejectAction: (formData: FormData) => Promise<void>
}) {
  if (loans.length === 0) return null
  return (
    <div className="bg-white rounded-xl border border-amber-200 p-5">
      <h2 className="text-sm font-semibold text-amber-700 mb-1">
        Pedidos de obreiro
        <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{loans.length}</span>
      </h2>
      <p className="text-xs text-gray-400 mb-3">
        Pediram um obreiro seu. Aceitando ou recusando, sua resposta vai para o DH, que dá o OK final.
      </p>
      <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        {loans.map(loan => {
          const period = processPeriodText(loan)
          return (
            <li key={loan.id} className="border border-amber-100 rounded-lg p-3 space-y-2">
              <div className="text-sm space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-gray-800">{loan.personName}</p>
                  <ProcessMoveTypeTag moveType={loan.moveType} />
                </div>
                <p className="text-xs text-gray-500">
                  {loan.moveType === 'transferencia' ? 'Sairia daqui e passaria a servir ' : 'Continuaria aqui e serviria também '}
                  {loan.toUnit.type === 'school' ? 'na escola' : 'no ministério'} <strong>{loan.to.name}</strong>
                  {loan.role ? ` como ${loan.role}` : ''}
                </p>
                <p className="text-xs text-gray-400">
                  {period ? `${period} · ` : ''}pedido por {loan.requesterName}
                </p>
                {loan.reason && <p className="text-xs text-gray-400 italic">&ldquo;{loan.reason}&rdquo;</p>}
              </div>
              <form action={approveAction} className="space-y-1.5">
                <input type="hidden" name="loan_id" value={loan.id} />
                <input name="recommendation" placeholder="Recomendação sobre a pessoa (opcional)" className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400" />
                <div className="flex gap-2">
                  <button type="submit" className="px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 transition-colors">Aceitar</button>
                  <button type="submit" formAction={rejectAction} className="px-3 py-1.5 border border-red-200 text-red-500 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors">Recusar</button>
                </div>
              </form>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Líder do DESTINO: pedidos de quem já serve em outro lugar, ainda em andamento. */
export function SentLoansCard({ loans, userId, cancelAction }: {
  loans: ProcessItem[]
  userId: string
  cancelAction: (formData: FormData) => Promise<void>
}) {
  if (loans.length === 0) return null
  return (
    <div className="bg-white rounded-xl border border-purple-200 p-5">
      <h2 className="text-sm font-semibold text-purple-900 mb-1">
        Pedidos de obreiro em andamento
        <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">{loans.length}</span>
      </h2>
      <p className="text-xs text-gray-400 mb-3">Pessoas que já servem em outro lugar: o líder de lá responde e o DH dá o OK final.</p>
      <ul className="divide-y divide-gray-100">
        {loans.map(loan => {
          const period = processPeriodText(loan)
          return (
            <li key={loan.id} className="py-2.5 flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-gray-800">{loan.personName}</p>
                  <ProcessMoveTypeTag moveType={loan.moveType} />
                </div>
                <p className="text-xs text-gray-500">Serve em {loan.from.name}{period ? ` · ${period}` : ''}</p>
                {loan.leaderNotes && <p className="text-xs text-gray-400 italic">Líder de lá: &ldquo;{loan.leaderNotes}&rdquo;</p>}
                <ProcessStatusBadge item={loan} className="mt-1" />
              </div>
              {loan.requestedBy === userId && (
                <form action={cancelAction} className="flex-shrink-0">
                  <input type="hidden" name="loan_id" value={loan.id} />
                  <button type="submit" className="text-xs text-gray-400 hover:text-gray-700 transition-colors whitespace-nowrap">Cancelar</button>
                </form>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
