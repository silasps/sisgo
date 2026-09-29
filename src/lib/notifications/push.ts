import { getFCM } from '@/lib/firebase/admin'
import { createAdminClient } from '@/lib/supabase/admin'

type PushPayload = {
  title: string
  body: string
  data?: Record<string, string>
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  if (userIds.length === 0) return

  const supabase = createAdminClient()
  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token')
    .in('user_id', userIds)

  if (!tokens || tokens.length === 0) return

  const fcm = getFCM()
  const allTokens = tokens.map(t => t.token)
  // FCM aceita no máximo 500 tokens por multicast — um aviso pra equipe
  // inteira (ex.: @importante no Geral) pode passar disso em base grande.
  for (let start = 0; start < allTokens.length; start += 500) {
    const batch = allTokens.slice(start, start + 500)
    try {
      const result = await fcm.sendEachForMulticast({
        notification: { title: payload.title, body: payload.body },
        data: payload.data ?? {},
        tokens: batch,
      })

      // Remove tokens que o FCM diz não existirem mais. O índice de
      // responses é o mesmo de `batch` — filtrar antes de olhar o erro
      // desalinhava os dois e podia marcar o token errado.
      if (result.failureCount > 0) {
        const invalidTokens = batch.filter((_, i) => {
          const response = result.responses[i]
          const code = response.error?.code
          return !response.success && (
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/registration-token-not-registered'
          )
        })
        if (invalidTokens.length > 0) {
          await supabase.from('push_tokens').delete().in('token', invalidTokens)
        }
      }
    } catch {
      // FCM not configured yet — skip silently in dev
    }
  }
}
