'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

function secondsLeft(expectedEndAt: string): number {
  return Math.max(0, Math.floor((new Date(expectedEndAt).getTime() - Date.now()) / 1000))
}

// Contagem regressiva no navegador (independente de fuso horário do servidor).
// Ao zerar, recarrega os dados — o servidor auto-completa a sessão expirada
// e a máquina volta a "Disponível" sem precisar de refresh manual.
export function SessionCountdown({ expectedEndAt }: { expectedEndAt: string }) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [remaining, setRemaining] = useState(() => secondsLeft(expectedEndAt))

  useEffect(() => {
    setMounted(true)
    const interval = setInterval(() => setRemaining(secondsLeft(expectedEndAt)), 1000)
    return () => clearInterval(interval)
  }, [expectedEndAt])

  const done = mounted && remaining <= 0

  useEffect(() => {
    if (!done) return
    const first = setTimeout(() => router.refresh(), 1500)
    // se o relógio do cliente adiantar em relação ao servidor, tenta de novo
    const retry = setInterval(() => router.refresh(), 10_000)
    return () => { clearTimeout(first); clearInterval(retry) }
  }, [done, router])

  if (!mounted) return <span className="font-mono tabular-nums">--:--</span>

  if (done) return <span className="font-medium">finalizando…</span>

  const hours = Math.floor(remaining / 3600)
  const mins = Math.floor((remaining % 3600) / 60)
  const secs = remaining % 60
  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <span className={`font-mono tabular-nums font-semibold ${remaining <= 300 ? 'text-amber-500' : ''}`}>
      {hours > 0 ? `${pad(hours)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`} restantes
    </span>
  )
}
