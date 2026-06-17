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
  const message = {
    notification: { title: payload.title, body: payload.body },
    data: payload.data ?? {},
    tokens: tokens.map(t => t.token),
  }

  try {
    const result = await fcm.sendEachForMulticast(message)

    // Remove invalid tokens
    if (result.failureCount > 0) {
      const invalidTokens = tokens
        .filter((_, i) => !result.responses[i].success)
        .filter((_, i) => {
          const err = result.responses[i].error?.code
          return err === 'messaging/invalid-registration-token' ||
                 err === 'messaging/registration-token-not-registered'
        })
        .map(t => t.token)

      if (invalidTokens.length > 0) {
        await supabase
          .from('push_tokens')
          .delete()
          .in('token', invalidTokens)
      }
    }
  } catch {
    // FCM not configured yet — skip silently in dev
  }
}
