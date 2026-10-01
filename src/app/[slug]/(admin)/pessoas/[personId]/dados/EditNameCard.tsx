'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, UserCog } from 'lucide-react'

type Props = {
  fullName: string
  action: (formData: FormData) => Promise<{ error: string } | { ok: true }>
}

export function EditNameCard({ fullName, action }: Props) {
  const router = useRouter()
  const [name, setName] = useState(fullName)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    fd.append('full_name', name)
    startTransition(async () => {
      const res = await action(fd)
      if ('error' in res) { toast.error(res.error); return }
      toast.success('Nome atualizado.')
      router.refresh()
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-gray-900 mb-3">Nome completo</h2>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          required
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <button
          type="submit"
          disabled={isPending || name.trim() === fullName}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <UserCog className="size-4" />}
          Salvar
        </button>
      </form>
    </div>
  )
}
