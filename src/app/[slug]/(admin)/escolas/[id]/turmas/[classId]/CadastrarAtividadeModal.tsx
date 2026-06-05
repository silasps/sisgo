'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { createProgramForClass } from './actions'

type Props = {
  orgId: string
  slug: string
}

export function CadastrarAtividadeModal({ orgId, slug }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)

  function handleOpen() {
    setOpen(true)
  }

  function handleClose() {
    if (isPending) return
    setOpen(false)
    formRef.current?.reset()
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) handleClose()
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await createProgramForClass(formData)
      setOpen(false)
      formRef.current?.reset()
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="text-xs px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg transition-colors"
      >
        + Cadastrar nova atividade
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={handleBackdropClick}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Cadastrar nova atividade</h2>
              <button
                type="button"
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form ref={formRef} action={handleSubmit} className="p-5 space-y-4">
              <input type="hidden" name="org_id" value={orgId} />
              <input type="hidden" name="slug" value={slug} />

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nome *</label>
                <input
                  name="name"
                  required
                  placeholder="Ex: Cordas, Perspectivas Brasil…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Descrição</label>
                <input
                  name="description"
                  placeholder="Breve descrição da atividade"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>

              <ImageUpload name="image_url" label="Imagem da atividade" folder="programs" />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Emoji (sem imagem)</label>
                  <input
                    name="icon"
                    placeholder="⭐"
                    maxLength={4}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Custo adicional (R$)</label>
                  <input
                    name="additional_cost"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isPending}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {isPending ? 'Salvando…' : '+ Cadastrar atividade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
