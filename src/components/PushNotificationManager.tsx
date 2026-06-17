'use client'

import { useEffect } from 'react'

export function PushNotificationManager() {
  useEffect(() => {
    registerPush()
  }, [])

  return null
}

async function registerPush() {
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (!Capacitor.isNativePlatform()) return

    const { PushNotifications } = await import('@capacitor/push-notifications')

    const permission = await PushNotifications.requestPermissions()
    if (permission.receive !== 'granted') return

    await PushNotifications.register()

    PushNotifications.addListener('registration', async ({ value: token }) => {
      const platform = Capacitor.getPlatform()
      await fetch('/api/push/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, platform }),
      })
    })

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push received:', notification)
    })

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = action.notification.data
      if (data?.organization_id) {
        window.location.href = `/${data.organization_id}/pendentes`
      }
    })
  } catch {
    // Not running in Capacitor or plugin not available
  }
}
