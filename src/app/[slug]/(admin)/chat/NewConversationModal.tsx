'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Search, Plus, User, GraduationCap } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { searchPeopleToMessage, getOrCreateDirectConversation } from './actions'
import type { ChatPerson } from './types'

// Busca "pelo arroba" (pedido do usuário, tipo @mention) — "@joão" e "joão"
// encontram a mesma pessoa (o "@" é só uma pista visual pro usuário, o
// servidor já ignora ele — ver searchEligiblePeople em chat-access.ts).
export function NewConversationModal({ orgId, chatBasePath }: { orgId: string; chatBasePath: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ChatPerson[]>([])
  const [loading, setLoading] = useState(false)
  const [starting, setStarting] = useState<string | null>(null)
  const requestId = useRef(0)
  const router = useRouter()

  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (q.replace(/^@+/, '').length < 2) { setResults([]); return }
    const id = ++requestId.current
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const people = await searchPeopleToMessage(orgId, q)
        if (requestId.current === id) setResults(people)
      } finally {
        if (requestId.current === id) setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query, open, orgId])

  async function handlePick(person: ChatPerson) {
    setStarting(person.userId)
    try {
      const conversationId = await getOrCreateDirectConversation(orgId, person.userId)
      setOpen(false)
      setQuery('')
      setResults([])
      router.push(`${chatBasePath}/${conversationId}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível iniciar a conversa.')
    } finally {
      setStarting(null)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
      >
        <Plus size={15} /> Nova conversa
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Nova conversa" hideFooter>
        <div className="p-4 space-y-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por @nome…"
              className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>

          {loading && <p className="text-xs text-gray-400 text-center py-2">Buscando…</p>}

          {!loading && query.replace(/^@+/, '').length >= 2 && results.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">Ninguém encontrado com esse nome.</p>
          )}

          <div className="space-y-1 max-h-64 overflow-y-auto">
            {results.map(person => (
              <button
                key={person.userId}
                type="button"
                disabled={starting === person.userId}
                onClick={() => handlePick(person)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-gray-50 text-left transition-colors disabled:opacity-50"
              >
                <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${person.kind === 'obreiro' ? 'bg-brand-50 text-brand-600' : 'bg-blue-50 text-blue-600'}`}>
                  {person.kind === 'obreiro' ? <User size={15} /> : <GraduationCap size={15} />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-gray-800 truncate">{person.fullName}</span>
                  <span className="block text-[11px] text-gray-400">{person.kind === 'obreiro' ? 'Obreiro' : 'Aluno'}</span>
                </span>
                {starting === person.userId && <span className="text-xs text-gray-400">Abrindo…</span>}
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </>
  )
}
