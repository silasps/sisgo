'use client'

import { useEffect, useState, useCallback } from 'react'

export function BiometricLock() {
  const [locked, setLocked] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const authenticate = useCallback(async () => {
    try {
      const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth')
      await BiometricAuth.authenticate({
        reason: 'Desbloqueie para acessar o SISGO',
        allowDeviceCredential: true,
      })
      setLocked(false)
      setError(null)
    } catch {
      setError('Autenticação cancelada. Toque para tentar novamente.')
    }
  }, [])

  useEffect(() => {
    let cleanup = false

    async function setup() {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (!Capacitor.isNativePlatform()) return

        const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth')
        const result = await BiometricAuth.checkBiometry()
        if (!result.isAvailable) return

        const hasSession = localStorage.getItem('sisgo_has_session')
        if (!hasSession) return

        if (!cleanup) {
          setLocked(true)
          authenticate()
        }

        const { App } = await import('@capacitor/app')
        App.addListener('appStateChange', ({ isActive }) => {
          if (isActive && localStorage.getItem('sisgo_has_session')) {
            setLocked(true)
            authenticate()
          }
        })
      } catch {
        // Not in Capacitor or plugin not available
      }
    }

    setup()
    return () => { cleanup = true }
  }, [authenticate])

  if (!locked) return null

  return (
    <div
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#040c0b]"
      onClick={error ? () => { setError(null); authenticate() } : undefined}
    >
      <svg width={64} height={64} viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="44" stroke="#F5F1E8" strokeWidth="2.5" fill="none" opacity="0.25" />
        <path d="M32 50 Q32 22 50 22 Q68 22 72 38" stroke="#F5F1E8" strokeWidth="8" strokeLinecap="round" fill="none" />
        <path d="M68 50 Q68 78 50 78 Q32 78 28 62" stroke="#1D6B67" strokeWidth="8" strokeLinecap="round" fill="none" />
      </svg>
      <p className="text-white/60 text-sm mt-6">
        {error || 'Desbloqueando...'}
      </p>
    </div>
  )
}
