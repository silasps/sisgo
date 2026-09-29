'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { markChatDelivered } from './actions'

// Montado em todas as telas do app (layout do admin): marca como "entregue"
// o que chega pra esta pessoa, pra quem mandou ver ✓✓ cinza — igual ao
// WhatsApp quando a mensagem chega no celular, mesmo sem abrir a conversa.
// Marca ao abrir o app, ao voltar pra ele (o Realtime não repete o que
// chegou enquanto a aba/app estava suspenso) e a cada mensagem nova. A RLS
// (migration 150) só entrega eventos das conversas desta pessoa.
export function ChatDeliveryListener() {
  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    const markSoon = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { markChatDelivered().catch(() => {}) }, 500)
    }
    const onVisibility = () => { if (document.visibilityState === 'visible') markSoon() }

    markSoon()
    document.addEventListener('visibilitychange', onVisibility)

    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) supabase.realtime.setAuth(session.access_token)
      if (cancelled) return
      channel = supabase.channel('chat-delivery')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, markSoon)
        .subscribe()
    })()

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      if (timer) clearTimeout(timer)
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  return null
}
