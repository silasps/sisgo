'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Mail } from 'lucide-react'

type Props = {
  currentEmail: string
  action: (formData: FormData) => Promise<{ error: string } | { ok: true; email: string }>
}

// Troca o e-mail de login — pra quando a pessoa perdeu acesso à caixa
// antiga ou foi digitado errado na criação. Não precisa de confirmação:
// reversível (dá pra trocar de volta) e não derruba nenhum outro dado.
export function UpdateEmailCard({ currentEmail, action }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState(currentEmail)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    fd.append('email', email)
    startTransition(async () => {
      const res = await action(fd)
      if ('error' in res) { toast.error(res.error); return }
      toast.success('E-mail atualizado.')
      router.refresh()
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-gray-900 mb-1">Atualizar e-mail de login</h2>
      <p className="text-xs text-gray-400 mb-3">
        Troca o e-mail usado pra entrar no sistema — não precisa de confirmação por link, já
        entra confirmado.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <button
          type="submit"
          disabled={isPending || email === currentEmail}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
          Atualizar
        </button>
      </form>
    </div>
  )
}
