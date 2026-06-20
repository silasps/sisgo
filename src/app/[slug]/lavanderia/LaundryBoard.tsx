'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WashingMachine, Clock, CheckCircle2, Wrench, WifiOff } from 'lucide-react'

type Machine = {
  id: string
  name: string
  type: 'washer' | 'dryer'
  location: string | null
  status: 'available' | 'in_use' | 'maintenance'
  online: boolean
  session: {
    guestName: string | null
    durationMinutes: number
    startedAt: string
    expectedEndAt: string
  } | null
  pricePerMinute: number | null
}

type Props = {
  orgName: string
  machines: Machine[]
}

function Countdown({ expectedEndAt }: { expectedEndAt: string }) {
  const [remaining, setRemaining] = useState(() => {
    const diff = new Date(expectedEndAt).getTime() - Date.now()
    return Math.max(0, Math.floor(diff / 1000))
  })

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = new Date(expectedEndAt).getTime() - Date.now()
      setRemaining(Math.max(0, Math.floor(diff / 1000)))
    }, 1000)
    return () => clearInterval(interval)
  }, [expectedEndAt])

  const hours = Math.floor(remaining / 3600)
  const mins = Math.floor((remaining % 3600) / 60)
  const secs = remaining % 60
  const pad = (n: number) => String(n).padStart(2, '0')

  const isLow = remaining <= 300 && remaining > 0
  const isDone = remaining === 0

  return (
    <div className={`font-mono text-4xl sm:text-5xl font-bold tabular-nums tracking-wider ${
      isDone ? 'text-green-400 animate-pulse' : isLow ? 'text-amber-400' : 'text-white'
    }`}>
      {isDone ? (
        'PRONTA'
      ) : hours > 0 ? (
        `${pad(hours)}:${pad(mins)}:${pad(secs)}`
      ) : (
        `${pad(mins)}:${pad(secs)}`
      )}
    </div>
  )
}

function ProgressBar({ startedAt, expectedEndAt }: { startedAt: string; expectedEndAt: string }) {
  const [progress, setProgress] = useState(() => {
    const total = new Date(expectedEndAt).getTime() - new Date(startedAt).getTime()
    const elapsed = Date.now() - new Date(startedAt).getTime()
    return Math.min(100, Math.max(0, (elapsed / total) * 100))
  })

  useEffect(() => {
    const interval = setInterval(() => {
      const total = new Date(expectedEndAt).getTime() - new Date(startedAt).getTime()
      const elapsed = Date.now() - new Date(startedAt).getTime()
      setProgress(Math.min(100, Math.max(0, (elapsed / total) * 100)))
    }, 1000)
    return () => clearInterval(interval)
  }, [startedAt, expectedEndAt])

  return (
    <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-1000 ${
          progress >= 100 ? 'bg-green-400' : progress >= 80 ? 'bg-amber-400' : 'bg-blue-400'
        }`}
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

const typeLabel: Record<string, string> = { washer: 'Lavadora', dryer: 'Secadora' }

export function LaundryBoard({ orgName, machines }: Props) {
  const router = useRouter()

  // Auto-refresh a cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 30_000)
    return () => clearInterval(interval)
  }, [router])

  const now = new Date()
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const available = machines.filter(m => m.status === 'available').length
  const inUse = machines.filter(m => m.status === 'in_use').length

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <WashingMachine size={28} className="text-blue-400" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Lavanderia</h1>
            <p className="text-xs text-gray-500">{orgName}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
              <span className="text-green-400 font-medium">{available} livre{available !== 1 ? 's' : ''}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-blue-400 font-medium">{inUse} em uso</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-500">
            <Clock size={14} />
            <span className="text-sm font-mono">{timeStr}</span>
          </div>
        </div>
      </div>

      {/* Machine Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {machines.map(machine => (
          <div
            key={machine.id}
            className={`rounded-2xl border-2 p-5 transition-all ${
              machine.status === 'in_use'
                ? 'border-blue-500/50 bg-gray-900'
                : machine.status === 'maintenance'
                  ? 'border-yellow-500/30 bg-gray-900/50'
                  : !machine.online
                    ? 'border-red-500/30 bg-gray-900/50 opacity-60'
                    : 'border-green-500/30 bg-gray-900/50'
            }`}
          >
            {/* Machine header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${
                  machine.status === 'in_use' ? 'bg-blue-500/20' :
                  machine.status === 'maintenance' ? 'bg-yellow-500/20' : 'bg-green-500/20'
                }`}>
                  {machine.status === 'maintenance' ? (
                    <Wrench size={20} className="text-yellow-400" />
                  ) : (
                    <WashingMachine size={20} className={
                      machine.status === 'in_use' ? 'text-blue-400' : 'text-green-400'
                    } />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{machine.name}</h2>
                  <p className="text-[11px] text-gray-500">
                    {typeLabel[machine.type]}
                    {machine.location && ` · ${machine.location}`}
                  </p>
                </div>
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                !machine.online && machine.status === 'available'
                  ? 'bg-red-500/20 text-red-400'
                  : machine.status === 'in_use'
                    ? 'bg-blue-500/20 text-blue-400'
                    : machine.status === 'maintenance'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-green-500/20 text-green-400'
              }`}>
                {!machine.online && machine.status === 'available' ? 'Indisponível' : machine.status === 'in_use' ? 'Em uso' : machine.status === 'maintenance' ? 'Manutenção' : 'Livre'}
              </span>
            </div>

            {/* In use: countdown */}
            {machine.status === 'in_use' && machine.session && (
              <div className="space-y-3">
                <div className="text-center py-2">
                  <Countdown expectedEndAt={machine.session.expectedEndAt} />
                </div>
                <ProgressBar
                  startedAt={machine.session.startedAt}
                  expectedEndAt={machine.session.expectedEndAt}
                />
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{machine.session.guestName || 'Uso anônimo'}</span>
                  <span>{machine.session.durationMinutes} min</span>
                </div>
              </div>
            )}

            {/* Available & online */}
            {machine.status === 'available' && machine.online && (
              <div className="text-center py-4">
                <CheckCircle2 size={36} className="text-green-500/50 mx-auto mb-2" />
                <p className="text-sm text-green-400 font-medium">Disponível para uso</p>
                {machine.pricePerMinute && (
                  <p className="text-[11px] text-gray-500 mt-1">
                    R$ {(machine.pricePerMinute / 100).toFixed(2)}/min
                  </p>
                )}
              </div>
            )}

            {/* Available but offline — bloqueia uso */}
            {machine.status === 'available' && !machine.online && (
              <div className="text-center py-4">
                <WifiOff size={36} className="text-red-500/50 mx-auto mb-2" />
                <p className="text-sm text-red-400 font-medium">Fora de serviço</p>
                <p className="text-[11px] text-gray-600 mt-1">Sem conexão com a máquina</p>
              </div>
            )}

            {/* Maintenance */}
            {machine.status === 'maintenance' && (
              <div className="text-center py-4">
                <Wrench size={36} className="text-yellow-500/50 mx-auto mb-2" />
                <p className="text-sm text-yellow-400 font-medium">Em manutenção</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {machines.length === 0 && (
        <div className="text-center py-20">
          <WashingMachine size={48} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">Nenhuma máquina disponível</p>
        </div>
      )}

      <p className="text-center text-[10px] text-gray-700">
        Atualiza automaticamente a cada 30 segundos
      </p>
    </div>
  )
}
