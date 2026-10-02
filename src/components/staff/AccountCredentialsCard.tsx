'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Copy, Phone, Check } from 'lucide-react'
import type { AccountCredentials } from '@/lib/staff/accountCredentials'
import { whatsappDigits } from '@/lib/phone'
import { PhoneInput } from '@/components/ui/PhoneInput'

function whatsappUrl(phone: string, message: string) {
  return `https://wa.me/${whatsappDigits(phone)}?text=${encodeURIComponent(message)}`
}

// Card de "e-mail + senha prontos pra entregar", reusado em todo fluxo que
// cria ou redefine acesso de alguém (criar acesso solo, obreiro direto,
// redefinir senha) — copiar dados, enviar por WhatsApp (usa o telefone já
// cadastrado, ou deixa adicionar um na hora), e marcar como entregue.
export function AccountCredentialsCard({
  title, passwordLabel = 'Senha provisória', credentials, onAddPhone, onSent, onDone, doneLabel = 'Concluir',
}: {
  title: string
  passwordLabel?: string
  credentials: AccountCredentials
  onAddPhone: (phone: string) => Promise<{ error: string } | { ok: true; phone: string }>
  onSent?: () => void | Promise<void>
  onDone: () => void
  doneLabel?: string
}) {
  const [phone, setPhone] = useState(credentials.phone)
  const [addingPhone, setAddingPhone] = useState(false)
  const [phoneInput, setPhoneInput] = useState('')
  const [sentViaWhatsApp, setSentViaWhatsApp] = useState(false)
  const [isPending, startTransition] = useTransition()

  // <a href> de verdade, não window.open() via onClick — window.open abre
  // uma aba em branco e só DEPOIS navega pra wa.me, e essa indireção faz o
  // Chrome tratar como navegação menos confiável: em vez de abrir o app do
  // WhatsApp direto (como um link clicado normalmente faz), cai na página
  // intermediária "Abrir WhatsApp?" / "Continuar para o WhatsApp Web"
  // (relatado pelo usuário). Um <a> clicado de verdade é o padrão
  // recomendado pelo próprio WhatsApp pra isso.
  function handleWhatsAppClick() {
    setSentViaWhatsApp(true)
    if (onSent) startTransition(() => { onSent() })
  }

  function handleAddPhone(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await onAddPhone(phoneInput)
      if ('error' in res) { toast.error(res.error); return }
      setPhone(res.phone)
      setAddingPhone(false)
    })
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(credentials.whatsappMessage)
      toast.success('Dados copiados.')
    } catch {
      toast.error('Não foi possível copiar — copie manualmente.')
    }
  }

  return (
    <div className="rounded-xl border border-green-200 bg-green-50/60 p-5 space-y-3">
      <p className="text-sm font-semibold text-green-800">{title}</p>
      <div className="text-sm text-gray-700 bg-white rounded-lg border border-gray-200 p-3 space-y-1">
        <p><span className="text-gray-400">E-mail:</span> {credentials.email}</p>
        <p><span className="text-gray-400">{passwordLabel}:</span> {credentials.password}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Copy size={13} /> Copiar dados
        </button>
        {phone ? (
          sentViaWhatsApp ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-green-50 text-green-700 border border-green-200">
                <Check size={13} /> Enviado por WhatsApp
              </span>
              <a
                href={phone ? whatsappUrl(phone, credentials.whatsappMessage) : undefined}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleWhatsAppClick}
                className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2"
              >
                Enviar novamente
              </a>
            </div>
          ) : (
            <a
              href={phone ? whatsappUrl(phone, credentials.whatsappMessage) : undefined}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleWhatsAppClick}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
            >
              Enviar por WhatsApp
            </a>
          )
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

      {!phone && addingPhone && (
        <form onSubmit={handleAddPhone} className="flex items-center gap-2">
          <div className="flex-1">
            <PhoneInput value={phoneInput} onChange={setPhoneInput} autoFocus />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="px-3 py-2 text-xs font-medium rounded-lg bg-brand-500 hover:bg-brand-600 text-white transition-colors disabled:opacity-50"
          >
            Salvar
          </button>
        </form>
      )}

      <button type="button" onClick={onDone} className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2">
        {doneLabel}
      </button>
    </div>
  )
}
