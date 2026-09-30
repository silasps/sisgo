'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, UserPlus, Copy, Phone } from 'lucide-react'
import type { CreatedAccess } from './actions'

type Props = {
  action: (formData: FormData) => Promise<{ error: string } | CreatedAccess>
  addPhoneAction: (formData: FormData) => Promise<{ error: string } | { ok: true; phone: string }>
  markSentAction: (orgUserId: string) => Promise<void>
}

function whatsappUrl(phone: string, message: string) {
  const digits = phone.replace(/\D/g, '')
  const withCountry = digits.length <= 11 ? `55${digits}` : digits
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`
}

export function CriarAcessoForm({ action, addPhoneAction, markSentAction }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [isPending, startTransition] = useTransition()
  const [created, setCreated] = useState<CreatedAccess | null>(null)
  const [addingPhone, setAddingPhone] = useState(false)
  const [phoneInput, setPhoneInput] = useState('')

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

  function handleSendWhatsApp() {
    if (!created?.phone) return
    window.open(whatsappUrl(created.phone, created.whatsappMessage), '_blank', 'noopener,noreferrer')
    if (created.orgUserId) startTransition(() => markSentAction(created.orgUserId))
  }

  function handleAddPhone(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    fd.append('phone', phoneInput)
    startTransition(async () => {
      const res = await addPhoneAction(fd)
      if ('error' in res) { toast.error(res.error); return }
      setCreated(prev => prev ? { ...prev, phone: res.phone } : prev)
      setAddingPhone(false)
    })
  }

  async function handleCopy() {
    if (!created) return
    try {
      await navigator.clipboard.writeText(created.whatsappMessage)
      toast.success('Dados copiados.')
    } catch {
      toast.error('Não foi possível copiar — copie manualmente.')
    }
  }

  function handleDone() {
    router.refresh()
  }

  if (created) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50/60 p-5 space-y-3">
        <p className="text-sm font-semibold text-green-800">Login criado com sucesso.</p>
        <div className="text-sm text-gray-700 bg-white rounded-lg border border-gray-200 p-3 space-y-1">
          <p><span className="text-gray-400">E-mail:</span> {created.email}</p>
          <p><span className="text-gray-400">Senha provisória:</span> {created.password}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Copy size={13} /> Copiar dados
          </button>
          {created.phone ? (
            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
            >
              Enviar por WhatsApp
            </button>
          ) : !addingPhone && (
            <button
              type="button"
              onClick={() => setAddingPhone(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
            >
              <Phone size={13} /> Adicionar telefone pra enviar por WhatsApp
            </button>
          )}
        </div>

        {!created.phone && addingPhone && (
          <form onSubmit={handleAddPhone} className="flex items-center gap-2">
            <input
              autoFocus
              required
              value={phoneInput}
              onChange={e => setPhoneInput(e.target.value)}
              placeholder="(41) 99999-9999"
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <button
              type="submit"
              disabled={isPending}
              className="px-3 py-2 text-xs font-medium rounded-lg bg-brand-500 hover:bg-brand-600 text-white transition-colors disabled:opacity-50"
            >
              Salvar
            </button>
          </form>
        )}

        <button type="button" onClick={handleDone} className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2">
          Concluir
        </button>
      </div>
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
