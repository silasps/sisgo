'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WashingMachine, Wind, Clock, CheckCircle2, Wrench, WifiOff, Copy, Check, X, QrCode, Loader2, ChevronRight, AlertTriangle } from 'lucide-react'

type Machine = {
  id: string
  name: string
  type: 'washer' | 'dryer'
  location: string | null
  status: 'available' | 'in_use' | 'maintenance'
  online: boolean
  busyUntil: string | null
  mine?: boolean
}

type Pricing = {
  pricePerMinuteCents: number
  minMinutes: number
  maxMinutes: number
  stepMinutes: number
}

type Props = {
  slug: string
  orgName: string
  machines: Machine[]
  pricing: Record<string, Pricing>
  paymentsEnabled: boolean
  // Uso interno (usuário logado): nome fixo do pagador e layout sem header
  // próprio (a página admin já fornece o shell).
  payerName?: string | null
  embedded?: boolean
}

type Checkout = {
  machine: Machine
  step: 'select' | 'paying' | 'running' | 'error'
  minutes: number
  guestName: string
  loading: boolean
  error: string | null
  sessionId: string | null
  pixCopyPaste: string | null
  pixQrCodeBase64: string | null
  expectedEndAt: string | null
}

const typeLabel: Record<string, string> = { washer: 'Lavadora', dryer: 'Secadora' }

const formatCents = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function useNow(active: boolean) {
  const [, force] = useState(0)
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => force(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [active])
}

function remainingLabel(until: string): string {
  const secs = Math.max(0, Math.floor((new Date(until).getTime() - Date.now()) / 1000))
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

function MachineIcon({ type, className }: { type: string; className?: string }) {
  return type === 'dryer' ? <Wind className={className} /> : <WashingMachine className={className} />
}

// ── Card de máquina ──────────────────────────────────────────────────────────

function MachineCard({ machine, pricing, clickable, onSelect }: {
  machine: Machine
  pricing: Pricing | undefined
  clickable: boolean
  onSelect: () => void
}) {
  useNow(machine.status === 'in_use' && !!machine.busyUntil)

  const busy = machine.status === 'in_use'
  const maintenance = machine.status === 'maintenance'
  const offline = machine.status === 'available' && !machine.online

  if (clickable) {
    return (
      <button
        onClick={onSelect}
        className="group w-full text-left bg-white rounded-2xl border border-gray-200 p-4 transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-green-50">
              <MachineIcon type={machine.type} className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">{machine.name}</h3>
              <p className="text-xs text-gray-400">{typeLabel[machine.type]}{machine.location ? ` · ${machine.location}` : ''}</p>
            </div>
          </div>
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">Disponível</span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {pricing ? <><span className="font-semibold text-gray-800">{formatCents(pricing.pricePerMinuteCents * pricing.stepMinutes)}</span> a cada {pricing.stepMinutes} min</> : 'Consulte o preço'}
          </p>
          <span className="flex items-center gap-0.5 text-xs font-semibold text-brand-500 group-hover:text-brand-600">
            Usar máquina <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </button>
    )
  }

  return (
    <div className={`w-full bg-white rounded-2xl border p-4 ${busy ? 'border-blue-200' : 'border-gray-200 opacity-75'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${busy ? 'bg-blue-50' : 'bg-gray-100'}`}>
            <MachineIcon type={machine.type} className={`w-6 h-6 ${busy ? 'text-blue-500 animate-pulse' : 'text-gray-400'}`} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-700">{machine.name}</h3>
            <p className="text-xs text-gray-400">{typeLabel[machine.type]}{machine.location ? ` · ${machine.location}` : ''}</p>
          </div>
        </div>
        {busy ? (
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-700">Ocupada</span>
        ) : maintenance ? (
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 flex items-center gap-1"><Wrench size={10} />Manutenção</span>
        ) : (
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-500 flex items-center gap-1"><WifiOff size={10} />Indisponível</span>
        )}
      </div>
      {busy && machine.busyUntil && (
        <div className="mt-3 flex items-center gap-2 text-blue-500">
          <Clock size={14} />
          <span className="font-mono tabular-nums text-sm font-semibold">{remainingLabel(machine.busyUntil)}</span>
          <span className="text-xs text-blue-400">para terminar</span>
          {machine.mine && (
            <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500 text-white">Sua lavagem</span>
          )}
        </div>
      )}
      {offline && (
        <p className="mt-3 text-xs text-gray-400">Sem conexão no momento — procure a hospitalidade.</p>
      )}
    </div>
  )
}

// ── Fluxo de pagamento (bottom sheet) ────────────────────────────────────────

function CheckoutSheet({ slug, checkout, pricing, payerName, onClose, onUpdate }: {
  slug: string
  checkout: Checkout
  pricing: Pricing | undefined
  payerName?: string | null
  onClose: () => void
  onUpdate: (patch: Partial<Checkout>) => void
}) {
  const [copied, setCopied] = useState(false)
  useNow(checkout.step === 'running' && !!checkout.expectedEndAt)

  const options = pricing
    ? Array.from(
        { length: Math.floor((pricing.maxMinutes - pricing.minMinutes) / pricing.stepMinutes) + 1 },
        (_, i) => pricing.minMinutes + i * pricing.stepMinutes
      )
    : [30, 60, 90]

  const totalCents = pricing ? checkout.minutes * pricing.pricePerMinuteCents : 0

  const startPayment = async () => {
    onUpdate({ loading: true, error: null })
    try {
      const res = await fetch('/api/payments/laundry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          machineId: checkout.machine.id,
          durationMinutes: checkout.minutes,
          guestName: checkout.guestName || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Falha ao gerar o PIX.')
      onUpdate({
        step: 'paying',
        loading: false,
        sessionId: data.sessionId,
        pixCopyPaste: data.pixCopyPaste,
        pixQrCodeBase64: data.pixQrCodeBase64,
      })
    } catch (err) {
      onUpdate({ loading: false, error: err instanceof Error ? err.message : 'Erro inesperado.' })
    }
  }

  const copyPix = async () => {
    if (!checkout.pixCopyPaste) return
    try {
      await navigator.clipboard.writeText(checkout.pixCopyPaste)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // navegadores antigos: seleciona o texto manualmente
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={checkout.step === 'select' ? onClose : undefined}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white px-5 pt-4 pb-3 border-b border-gray-100 flex items-center justify-between rounded-t-3xl">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-50">
              <MachineIcon type={checkout.machine.type} className="w-5 h-5 text-brand-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">{checkout.machine.name}</h3>
              <p className="text-[10px] text-gray-400">{typeLabel[checkout.machine.type]}</p>
            </div>
          </div>
          {checkout.step !== 'running' && (
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <X size={16} className="text-gray-400" />
            </button>
          )}
        </div>

        <div className="px-5 py-4">
          {/* Passo 1 — escolher tempo */}
          {checkout.step === 'select' && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Quanto tempo você precisa?</p>
                <div className="grid grid-cols-3 gap-2">
                  {options.map(min => (
                    <button
                      key={min}
                      onClick={() => onUpdate({ minutes: min })}
                      className={`rounded-xl border px-2 py-2.5 text-center transition-all ${
                        checkout.minutes === min
                          ? 'border-brand-400 bg-brand-50 ring-1 ring-brand-200'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className={`text-sm font-bold ${checkout.minutes === min ? 'text-brand-700' : 'text-gray-800'}`}>{min} min</p>
                      {pricing && <p className="text-[10px] text-gray-400">{formatCents(min * pricing.pricePerMinuteCents)}</p>}
                    </button>
                  ))}
                </div>
              </div>

              {payerName ? (
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200">
                  <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                  <p className="text-xs text-gray-600">Pagando como <span className="font-semibold text-gray-900">{payerName}</span></p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1.5">Seu nome (opcional)</p>
                  <input
                    value={checkout.guestName}
                    onChange={e => onUpdate({ guestName: e.target.value })}
                    placeholder="Para identificar sua lavagem"
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
              )}

              {checkout.error && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200">
                  <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-600">{checkout.error}</p>
                </div>
              )}

              <button
                onClick={startPayment}
                disabled={checkout.loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-brand-500 text-white text-sm font-bold hover:bg-brand-600 active:scale-[0.99] transition-all disabled:opacity-60"
              >
                {checkout.loading ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />}
                {checkout.loading ? 'Gerando PIX…' : `Pagar ${formatCents(totalCents)} com PIX`}
              </button>
              <p className="text-[10px] text-gray-400 text-center">
                A máquina liga sozinha assim que o pagamento for confirmado.
              </p>
            </div>
          )}

          {/* Passo 2 — pagar */}
          {checkout.step === 'paying' && (
            <div className="space-y-4 text-center">
              <div>
                <p className="text-sm font-semibold text-gray-800">Escaneie o QR code ou copie o código</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {checkout.minutes} min · <span className="font-semibold text-gray-600">{formatCents(totalCents)}</span>
                </p>
              </div>

              {checkout.pixQrCodeBase64 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`data:image/png;base64,${checkout.pixQrCodeBase64}`}
                  alt="QR Code PIX"
                  className="mx-auto w-52 h-52 rounded-2xl border border-gray-200 p-2 bg-white"
                />
              ) : (
                <div className="mx-auto w-52 h-52 rounded-2xl border border-gray-200 flex items-center justify-center">
                  <QrCode size={40} className="text-gray-300" />
                </div>
              )}

              {checkout.pixCopyPaste && (
                <button
                  onClick={copyPix}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
                    copied
                      ? 'border-green-300 bg-green-50 text-green-700'
                      : 'border-brand-200 bg-brand-50 text-brand-600 hover:bg-brand-100'
                  }`}
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                  {copied ? 'Código copiado!' : 'Copiar código PIX'}
                </button>
              )}

              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                <Loader2 size={13} className="animate-spin" />
                Aguardando confirmação do pagamento…
              </div>
              {checkout.error && (
                <p className="text-xs text-amber-600">{checkout.error}</p>
              )}
            </div>
          )}

          {/* Passo 3 — máquina ligada */}
          {checkout.step === 'running' && (
            <div className="space-y-4 text-center py-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 size={32} className="text-green-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">Máquina ligada!</p>
                <p className="text-xs text-gray-400 mt-1">Pagamento confirmado — pode colocar sua roupa.</p>
              </div>
              {checkout.expectedEndAt && (
                <div className="rounded-2xl bg-gray-50 border border-gray-200 py-4">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Tempo restante</p>
                  <p className="font-mono tabular-nums text-3xl font-bold text-gray-900 mt-1">
                    {remainingLabel(checkout.expectedEndAt)}
                  </p>
                </div>
              )}
              <button
                onClick={onClose}
                className="w-full px-4 py-3 rounded-xl bg-brand-500 text-white text-sm font-bold hover:bg-brand-600 transition-colors"
              >
                Concluir
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Página ───────────────────────────────────────────────────────────────────

export function PublicLaundry({ slug, orgName, machines, pricing, paymentsEnabled, payerName, embedded }: Props) {
  const router = useRouter()
  const [checkout, setCheckout] = useState<Checkout | null>(null)
  const checkoutRef = useRef<Checkout | null>(null)
  checkoutRef.current = checkout

  // Mantém os cards atualizados (outras pessoas usando as máquinas)
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 30_000)
    return () => clearInterval(interval)
  }, [router])

  // Polling do pagamento enquanto o QR está na tela
  useEffect(() => {
    if (!checkout || checkout.step !== 'paying' || !checkout.sessionId) return
    const interval = setInterval(async () => {
      const current = checkoutRef.current
      if (!current?.sessionId) return
      try {
        const res = await fetch(`/api/payments/laundry/status?session=${current.sessionId}`)
        if (!res.ok) return
        const data = await res.json() as { status: string; expectedEndAt: string | null; startError: string | null }
        if (data.status === 'running') {
          setCheckout(c => c ? { ...c, step: 'running', expectedEndAt: data.expectedEndAt, error: null } : c)
          router.refresh()
        } else if (data.startError) {
          setCheckout(c => c ? { ...c, error: 'Pagamento recebido — ligando a máquina, aguarde…' } : c)
        } else if (data.status === 'cancelled') {
          setCheckout(c => c ? { ...c, step: 'select', error: 'O pagamento expirou. Tente novamente.' } : c)
        }
      } catch {
        // rede instável: tenta de novo no próximo ciclo
      }
    }, 4000)
    return () => clearInterval(interval)
    // usa checkoutRef para ler o estado atual sem reiniciar o polling a cada render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkout?.step, checkout?.sessionId, router])

  const openCheckout = useCallback((machine: Machine) => {
    const p = pricing[machine.type]
    setCheckout({
      machine,
      step: 'select',
      minutes: p?.minMinutes ?? 30,
      guestName: '',
      loading: false,
      error: null,
      sessionId: null,
      pixCopyPaste: null,
      pixQrCodeBase64: null,
      expectedEndAt: null,
    })
  }, [pricing])

  const washers = machines.filter(m => m.type === 'washer')
  const dryers = machines.filter(m => m.type === 'dryer')

  return (
    <div className={embedded ? '' : 'min-h-dvh bg-gray-50'}>
      {/* Header (a versão interna usa o shell do painel) */}
      {!embedded && (
        <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand-50">
              <WashingMachine className="w-5 h-5 text-brand-500" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-tight">Lavanderia</h1>
              <p className="text-[11px] text-gray-400">{orgName}</p>
            </div>
          </div>
        </header>
      )}

      <main className={embedded ? 'max-w-2xl space-y-6 pb-8' : 'max-w-2xl mx-auto px-4 py-5 space-y-6 pb-16'}>
        {!paymentsEnabled && (
          <div className="flex items-start gap-2 px-3.5 py-3 rounded-2xl bg-amber-50 border border-amber-200">
            <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              O pagamento online ainda não está disponível. Procure a hospitalidade para liberar uma máquina.
            </p>
          </div>
        )}

        {machines.length === 0 && (
          <div className="text-center py-16">
            <WashingMachine size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Nenhuma máquina disponível no momento.</p>
          </div>
        )}

        {washers.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Lavadoras</h2>
            {washers.map(m => (
              <MachineCard
                key={m.id}
                machine={m}
                pricing={pricing[m.type]}
                clickable={paymentsEnabled && m.status === 'available' && m.online}
                onSelect={() => openCheckout(m)}
              />
            ))}
          </section>
        )}

        {dryers.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Secadoras</h2>
            {dryers.map(m => (
              <MachineCard
                key={m.id}
                machine={m}
                pricing={pricing[m.type]}
                clickable={paymentsEnabled && m.status === 'available' && m.online}
                onSelect={() => openCheckout(m)}
              />
            ))}
          </section>
        )}

        <p className="text-[10px] text-gray-300 text-center pt-2">
          Pague com PIX e a máquina liga automaticamente · {orgName}
        </p>
      </main>

      {checkout && (
        <CheckoutSheet
          slug={slug}
          checkout={checkout}
          pricing={pricing[checkout.machine.type]}
          payerName={payerName}
          onClose={() => { setCheckout(null); router.refresh() }}
          onUpdate={patch => setCheckout(c => c ? { ...c, ...patch } : c)}
        />
      )}
    </div>
  )
}
