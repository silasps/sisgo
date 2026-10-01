'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Contact } from 'lucide-react'

type Props = {
  currentEmail: string
  currentPhone: string
  action: (formData: FormData) => Promise<{ error: string } | { ok: true }>
}

export function EditContactCard({ currentEmail, currentPhone, action }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState(currentEmail)
  const [phone, setPhone] = useState(currentPhone)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    fd.append('email', email)
    fd.append('phone', phone)
    startTransition(async () => {
      const res = await action(fd)
      if ('error' in res) { toast.error(res.error); return }
      toast.success('Contato atualizado.')
      router.refresh()
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-gray-900 mb-3">Contato</h2>
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">E-mail de contato</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Telefone / WhatsApp</label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="(41) 99999-9999"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
        </div>
        <p className="text-[11px] text-gray-400">
          Esse é o contato cadastral — não é o e-mail de login (isso fica na aba Acesso).
        </p>
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Contact className="size-4" />}
          Salvar
        </button>
      </form>
    </div>
  )
}
