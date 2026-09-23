'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, KeyRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function TrocarSenhaInicialForm({ slug }: { slug: string }) {
  const router = useRouter()
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (next.length < 6) { toast.error('A senha precisa ter pelo menos 6 caracteres.'); return }
    if (next !== confirm) { toast.error('A confirmação não confere com a senha.'); return }

    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: next, data: { must_change_password: false } })
      if (error) { toast.error('Não foi possível atualizar a senha. Tente novamente.'); return }
      toast.success('Senha definida!')
      router.replace(`/${slug}/dashboard`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Nova senha</label>
        <input
          type="password"
          value={next}
          onChange={e => setNext(e.target.value)}
          required
          minLength={6}
          autoFocus
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Confirmar nova senha</label>
        <input
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          required
          minLength={6}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {isPending ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
        {isPending ? 'Salvando…' : 'Salvar e continuar'}
      </button>
    </form>
  )
}
