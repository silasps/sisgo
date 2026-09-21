'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import type { PersonFinanceSummary } from '@/lib/finance/personFinanceStatus'

function fmt(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function pendencyLabel(summary: PersonFinanceSummary): string {
  if (summary.overdueCount > 0) return `${fmt(summary.overdueAmount)} em atraso`
  return `${summary.pendingCount} cobrança${summary.pendingCount > 1 ? 's' : ''} pendente${summary.pendingCount > 1 ? 's' : ''}`
}

type Props = {
  action: (formData: FormData) => Promise<void>
  financeSummary: PersonFinanceSummary | null
  personName: string
  extraFields?: Record<string, string>
  className?: string
  children: React.ReactNode
}

// Variante de ConfirmSubmitButton pra quando a confirmação precisa carregar
// campos extras (checkboxes de notificação) que moram dentro do modal
// portalado — fora da árvore DOM do <form>, então form.requestSubmit() não
// os capturaria. Por isso invoca a Server Action diretamente (como
// ConfirmDialog), montando o FormData a partir do form irmão na mão.
export function FinancePendingConfirmButton({ action, financeSummary, personName, extraFields, className, children }: Props) {
  const hasPendency = !!financeSummary && (financeSummary.overdueCount > 0 || financeSummary.pendingCount > 0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notifyCandidate, setNotifyCandidate] = useState(false)
  const [notifyLeader, setNotifyLeader] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  if (!hasPendency) {
    return <button type="submit" className={className}>{children}</button>
  }

  function openConfirm() {
    if (buttonRef.current?.form && !buttonRef.current.form.reportValidity()) return
    setOpen(true)
  }

  async function handleConfirm() {
    const form = buttonRef.current?.form
    if (!form) return
    const fd = new FormData(form)
    for (const [key, value] of Object.entries(extraFields ?? {})) fd.set(key, value)
    fd.set('notify_candidate', notifyCandidate ? 'on' : '')
    fd.set('notify_leader', notifyLeader ? 'on' : '')

    setLoading(true)
    try {
      await action(fd)
    } catch (e) {
      if (e && typeof e === 'object' && 'digest' in e && String(e.digest).startsWith('NEXT_REDIRECT')) throw e
      toast.error(e instanceof Error ? e.message : 'Não foi possível concluir a ação.')
    } finally {
      setLoading(false)
      setOpen(false)
    }
  }

  return (
    <>
      <button ref={buttonRef} type="button" className={className} onClick={openConfirm}>
        {children}
      </button>
      <ConfirmModal
        open={open}
        variant="warning"
        title="Pendência financeira"
        message={`${personName} tem pendência financeira (${financeSummary ? pendencyLabel(financeSummary) : ''}). Deseja mesmo prosseguir?`}
        confirmLabel="Prosseguir"
        loadingLabel="Salvando…"
        loading={loading}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      >
        <div className="space-y-2 text-sm text-gray-700">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={notifyCandidate} onChange={e => setNotifyCandidate(e.target.checked)} />
            Notificar candidato por email
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={notifyLeader} onChange={e => setNotifyLeader(e.target.checked)} />
            Notificar líder por email
          </label>
        </div>
      </ConfirmModal>
    </>
  )
}
