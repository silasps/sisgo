'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, UserCheck } from 'lucide-react'
import { completarCadastroInicial } from './actions'
import { PhoneInput } from '@/components/ui/PhoneInput'

export function CompletarCadastroInicialForm({ slug }: { slug: string }) {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    fd.append('phone', phone)
    fd.append('birth_date', birthDate)
    startTransition(async () => {
      const res = await completarCadastroInicial(fd)
      if ('error' in res) { toast.error(res.error); return }
      toast.success('Cadastro completo!')
      router.replace(`/${slug}/dashboard`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Telefone / WhatsApp</label>
        <PhoneInput value={phone} onChange={setPhone} autoFocus />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Data de nascimento (opcional)</label>
        <input
          type="date"
          value={birthDate}
          onChange={e => setBirthDate(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {isPending ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
        {isPending ? 'Salvando…' : 'Salvar e continuar'}
      </button>
    </form>
  )
}
