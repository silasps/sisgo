import { createAdminClient } from '@/lib/supabase/admin'

export const EMAIL_LIMITS = {
  daily: 100,
  monthly: 3000,
} as const

export type EmailQuota = {
  today: number
  month: number
  dailyLimit: number
  monthlyLimit: number
  dailyExceeded: boolean
  monthlyExceeded: boolean
  exceeded: boolean
}

export async function getEmailQuota(): Promise<EmailQuota> {
  const db = createAdminClient()

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [{ count: todayCount }, { count: monthCount }] = await Promise.all([
    db.from('email_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('sent_at', todayStart),
    db.from('email_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('sent_at', monthStart),
  ])

  const today = todayCount ?? 0
  const month = monthCount ?? 0

  return {
    today,
    month,
    dailyLimit: EMAIL_LIMITS.daily,
    monthlyLimit: EMAIL_LIMITS.monthly,
    dailyExceeded: today >= EMAIL_LIMITS.daily,
    monthlyExceeded: month >= EMAIL_LIMITS.monthly,
    exceeded: today >= EMAIL_LIMITS.daily || month >= EMAIL_LIMITS.monthly,
  }
}
