'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

type Props = {
  id: string
  tipo: 'pre_inscricao' | 'aluno' | 'obreiro' | 'pre_inscricao_obreiro'
  action: (formData: FormData) => Promise<void>
}

export function RecusarModal({ id, tipo, action }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)

  function handleClose() {
    if (isPending) return
    setOpen(false)
    formRef.current?.reset()
  }

  function handleSubmit(formData: FormData) {
    const reason = (formData.get('reason') as string)?.trim()
    if (!reason) return
    startTransition(async () => {
      await action(formData)
      setOpen(false)
      toast.success('Recusa registrada')
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
      >
        Recusar
      </button>

      {open && (
        <div
          className="fixed inset-0 md:left-60 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={e => { if (e.target === e.currentTarget) handleClose() }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Motivo da recusa</h2>
              <button type="button" onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none transition-colors">✕</button>
            </div>

            <form ref={formRef} action={handleSubmit} className="p-5 space-y-4">
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="tipo" value={tipo} />

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Motivo da recusa <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="reason"
                  required
                  rows={4}
                  placeholder="Descreva o motivo da recusa para consulta futura..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Este motivo ficará registrado no histórico de recusas.
                </p>
              </div>

              {(tipo === 'aluno' || tipo === 'pre_inscricao') && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Palavra para o candidato (opcional)
                  </label>
                  <textarea
                    name="decision_note"
                    rows={2}
                    placeholder="Uma palavra de encorajamento ou explicação, se desejar..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                  />
                  <label className="flex items-start gap-2 text-xs text-gray-600 mt-1.5">
                    <input type="checkbox" name="decision_note_shared" className="mt-0.5" />
                    Enviar esta mensagem ao candidato junto com o e-mail de recusa
                  </label>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-1">
                <button type="button" onClick={handleClose} disabled={isPending}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
                  Cancelar
                </button>
                <button type="submit" disabled={isPending}
                  className="px-5 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors">
                  {isPending ? 'Registrando…' : 'Confirmar recusa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
