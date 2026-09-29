'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MessageCircle } from 'lucide-react'
import { NewConversationModal } from './NewConversationModal'
import type { ChatListItem } from './types'

export function ConversationList({ items, chatBasePath, orgId }: {
  items: ChatListItem[]
  chatBasePath: string
  orgId: string
}) {
  const pathname = usePathname()
  const router = useRouter()

  // Mensagem nova em qualquer conversa minha (a RLS só entrega as minhas —
  // migration 150) → atualiza prévia, ordem e bolinha de não lida sem a
  // pessoa precisar recarregar. Espera um instante pra juntar rajadas.
  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) supabase.realtime.setAuth(session.access_token)
      if (cancelled) return
      channel = supabase.channel('chat-conversation-list')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => {
          if (timer) clearTimeout(timer)
          timer = setTimeout(() => router.refresh(), 700)
        })
        .subscribe()
    })()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      if (channel) supabase.removeChannel(channel)
    }
  }, [router])

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 shrink-0">
        <h2 className="text-sm font-semibold text-gray-700">Conversas</h2>
        <NewConversationModal orgId={orgId} chatBasePath={chatBasePath} />
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 px-4 text-center text-gray-400">
            <MessageCircle size={26} className="opacity-40" />
            <p className="text-sm">Nenhuma conversa ainda.</p>
            <p className="text-xs">Toque em &quot;Nova conversa&quot; pra falar com alguém.</p>
          </div>
        ) : (
          items.map(item => {
            const href = `${chatBasePath}/${item.id}`
            const active = pathname === href
            const name = item.otherName
            const avatarUrl = item.otherAvatarUrl
            return (
              <Link
                key={item.id}
                href={href}
                className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 transition-colors ${active ? 'bg-brand-50' : 'hover:bg-gray-50'}`}
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- foto de perfil do usuário, não passa pelo otimizador
                  <img src={avatarUrl} alt="" className="shrink-0 w-9 h-9 rounded-full object-cover" />
                ) : (
                  <span className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold bg-gray-200 text-gray-600">
                    {name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="flex-1 min-w-0">
                  <span className="flex items-center justify-between gap-2">
                    <span className={`text-sm truncate ${item.unread ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{name}</span>
                    {item.unread && <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />}
                  </span>
                  <span className="block text-xs text-gray-400 truncate">{item.lastMessagePreview ?? 'Sem mensagens ainda'}</span>
                </span>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
