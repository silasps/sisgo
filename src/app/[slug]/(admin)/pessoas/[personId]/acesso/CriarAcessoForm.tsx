'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, UserPlus } from 'lucide-react'
import { AccountCredentialsCard } from '@/components/staff/AccountCredentialsCard'
import type { CreatedAccess } from './actions'

type Props = {
  action: (formData: FormData) => Promise<{ error: string } | CreatedAccess>
  addPhoneAction: (formData: FormData) => Promise<{ error: string } | { ok: true; phone: string }>
  markSentAction: (orgUserId: string) => Promise<void>
}

export function CriarAcessoForm({ action, addPhoneAction, markSentAction }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [isPending, startTransition] = useTransition()
  const [created, setCreated] = useState<CreatedAccess | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    fd.append('email', email)
    startTransition(async () => {
      const res = await action(fd)
      if ('error' in res) { toast.error(res.error); return }
      setCreated(res)
    })
  }

  function handleAddPhone(phone: string) {
    const fd = new FormData()
    fd.append('phone', phone)
    return addPhoneAction(fd)
  }

  if (created) {
    return (
      <AccountCredentialsCard
        title="Login criado com sucesso."
        credentials={created}
        onAddPhone={handleAddPhone}
        onSent={() => markSentAction(created.orgUserId)}
        onDone={() => router.refresh()}
      />
    )
  }

  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6">
      <p className="text-sm text-gray-600 mb-3">
        Essa pessoa ainda não tem login — falta o email. Complete abaixo pra criar o acesso
        (depois dá pra mandar os dados direto por WhatsApp).
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="email@exemplo.org"
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
          Criar acesso
        </button>
      </form>
    </div>
  )
}
