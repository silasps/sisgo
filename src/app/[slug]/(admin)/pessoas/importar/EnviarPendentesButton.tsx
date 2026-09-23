'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Send, Loader2 } from 'lucide-react'

type Props = {
  pendentes: number
  action: () => Promise<{ error: string } | { enviados: number; erros: string[] }>
}

export function EnviarPendentesButton({ pendentes, action }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  if (pendentes === 0) return null

  function handleClick() {
    startTransition(async () => {
      const res = await action()
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success(`${res.enviados} credencial(is) enviada(s).`)
      if (res.erros.length) toast.error(res.erros.join(' \n'))
      router.refresh()
    })
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-4 flex items-center justify-between flex-wrap gap-3">
      <p className="text-sm text-amber-800">
        <strong>{pendentes}</strong> pessoa{pendentes > 1 ? 's' : ''} com login criado aguardando envio de credenciais de acesso.
      </p>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        Enviar credenciais pendentes
      </button>
    </div>
  )
}
