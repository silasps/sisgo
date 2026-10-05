'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AccountCredentialsCard } from '@/components/staff/AccountCredentialsCard'
import { FinancePendingConfirmButton } from '@/components/finance/FinancePendingConfirmButton'
import { PersonFinanceBadge } from '@/components/finance/PersonFinanceBadge'
import type { PersonFinanceSummary } from '@/lib/finance/personFinanceStatus'
import type { CreatedAccess } from '../pessoas/[personId]/acesso/actions'

const INPUT = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-300'

type Item = {
  id: string
  personId: string | null
  ministryId?: string | null
  nome: string
  email: string | null
  financeSummary?: PersonFinanceSummary | null
}

type Props = {
  item: Item
  orgId: string
  bgConcern: boolean
  bgPending: boolean
  finalizarObreiro: (formData: FormData) => Promise<{ error: string } | CreatedAccess>
  addPhoneAction: (formData: FormData) => Promise<{ error: string } | { ok: true; phone: string }>
  markSentAction: (orgUserId: string) => Promise<void>
}

// Última etapa de finalizar um obreiro: cria o login e, em vez de só
// redirecionar com uma mensagem de sucesso, mostra e-mail/senha prontos com
// botão de enviar por WhatsApp — igual ao resto do sistema que cria acesso
// (ver CriarAcessoForm / AccountCredentialsCard).
export function FinalizarObreiroForm({ item, orgId, bgConcern, bgPending, finalizarObreiro, addPhoneAction, markSentAction }: Props) {
  const router = useRouter()
  const [created, setCreated] = useState<CreatedAccess | null>(null)
  const [isPending, startTransition] = useTransition()

  function submit(fd: FormData) {
    startTransition(async () => {
      const res = await finalizarObreiro(fd)
      if ('error' in res) { toast.error(res.error); return }
      setCreated(res)
    })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    submit(new FormData(e.currentTarget))
  }

  function handleAddPhone(phone: string) {
    const fd = new FormData()
    fd.append('phone', phone)
    return addPhoneAction(fd)
  }

  if (created) {
    return (
      <AccountCredentialsCard
        title="Obreiro finalizado — acesso criado com sucesso."
        credentials={created}
        onAddPhone={handleAddPhone}
        onSent={() => markSentAction(created.orgUserId)}
        onDone={() => router.refresh()}
      />
    )
  }

  const hasFinancePendency = !!item.financeSummary && (item.financeSummary.overdueCount > 0 || item.financeSummary.pendingCount > 0)

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="org_id" value={orgId} />
      <input type="hidden" name="person_id" value={item.personId ?? ''} />
      <input type="hidden" name="ministry_id" value={item.ministryId ?? ''} />
      <input type="hidden" name="name" value={item.nome} />
      <input
        name="email"
        type="email"
        defaultValue={item.email ?? ''}
        required
        placeholder="E-mail de login"
        className={INPUT}
      />
      <input
        name="password"
        type="password"
        required
        minLength={6}
        placeholder="Senha temporária"
        className={INPUT}
      />
      {(bgConcern || bgPending) && (
        <label className="flex items-start gap-2 text-sm text-amber-800">
          <input type="checkbox" required className="mt-0.5" />
          Estou ciente do alerta de antecedentes e assumo a decisão de finalizar mesmo assim.
        </label>
      )}
      {hasFinancePendency && <PersonFinanceBadge summary={item.financeSummary!} />}
      {hasFinancePendency ? (
        <FinancePendingConfirmButton
          action={async fd => { submit(fd) }}
          financeSummary={item.financeSummary ?? null}
          personName={item.nome}
          className="w-full text-sm px-3 py-2.5 bg-green-600 text-white hover:bg-green-700 rounded-xl transition-colors font-semibold"
        >
          Finalizar obreiro
        </FinancePendingConfirmButton>
      ) : (
        <button type="submit" disabled={isPending}
          className="w-full text-sm px-3 py-2.5 bg-green-600 text-white hover:bg-green-700 rounded-xl transition-colors font-semibold disabled:opacity-60">
          {isPending ? 'Finalizando…' : 'Finalizar obreiro'}
        </button>
      )}
    </form>
  )
}
