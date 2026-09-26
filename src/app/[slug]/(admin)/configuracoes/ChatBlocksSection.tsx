'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Search, Ban } from 'lucide-react'
import { ConfirmSubmitButton } from '@/components/ui/ConfirmSubmitButton'
import { searchPeopleToMessage } from '../chat/actions'
import type { ChatPerson } from '../chat/types'

type BlockedUser = { id: string; name: string; reason: string | null }

// Busca "pelo arroba" igual ao "nova conversa" do Chat — mesmo componente
// de origem (searchPeopleToMessage), só que aqui pra BLOQUEAR em vez de
// iniciar uma conversa.
export function ChatBlocksSection({ orgId, blocked, blockAction, unblockAction }: {
  orgId: string
  blocked: BlockedUser[]
  blockAction: (formData: FormData) => Promise<void>
  unblockAction: (formData: FormData) => Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ChatPerson[]>([])
  const [picked, setPicked] = useState<ChatPerson | null>(null)
  const requestId = useRef(0)

  useEffect(() => {
    const q = query.trim().replace(/^@+/, '')
    if (q.length < 2) { setResults([]); return }
    const id = ++requestId.current
    const timer = setTimeout(async () => {
      const people = await searchPeopleToMessage(orgId, q)
      if (requestId.current === id) setResults(people)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, orgId])

  async function handleBlock(formData: FormData) {
    try {
      await blockAction(formData)
      toast.success('Pessoa bloqueada.')
      setPicked(null)
      setQuery('')
      setResults([])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível bloquear.')
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Uma pessoa bloqueada não consegue enviar nem receber mensagens no Chat institucional, em nenhuma conversa.
      </p>

      {picked ? (
        <form action={handleBlock} className="flex items-center gap-2 flex-wrap">
          <input type="hidden" name="user_id" value={picked.userId} />
          <span className="text-sm text-gray-700">Bloquear <strong>{picked.fullName}</strong>?</span>
          <input name="reason" placeholder="Motivo (opcional)" className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm flex-1 min-w-[10ch]" />
          <button type="submit" className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors">Bloquear</button>
          <button type="button" onClick={() => setPicked(null)} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
        </form>
      ) : (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por @nome pra bloquear…"
            className="w-full rounded-lg border border-gray-300 pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          {results.length > 0 && (
            <div className="mt-1 border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
              {results.map(p => (
                <button
                  key={p.userId}
                  type="button"
                  onClick={() => { setPicked(p); setQuery('') }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                  {p.fullName} <span className="text-xs text-gray-400">({p.kind})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {blocked.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma pessoa bloqueada.</p>
        ) : blocked.map(b => (
          <div key={b.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2">
            <div>
              <p className="text-sm font-medium text-gray-800 flex items-center gap-1.5"><Ban size={12} className="text-red-500" /> {b.name}</p>
              {b.reason && <p className="text-xs text-gray-400">{b.reason}</p>}
            </div>
            <form action={unblockAction}>
              <input type="hidden" name="block_id" value={b.id} />
              <ConfirmSubmitButton confirmMessage={`Desbloquear ${b.name}?`} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                Desbloquear
              </ConfirmSubmitButton>
            </form>
          </div>
        ))}
      </div>
    </div>
  )
}
