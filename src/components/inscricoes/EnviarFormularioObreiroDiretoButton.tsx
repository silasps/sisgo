'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/Modal'
import { InternationalPhoneField } from '@/components/ui/InternationalPhoneField'
import { AlertTriangle, CheckCircle2, Link as LinkIcon, Send, Copy, MessageCircle } from 'lucide-react'
import { whatsappDigits } from '@/lib/phone'

type MinistryOption = { id: string; name: string }
type SchoolOption = { id: string; name: string }
type ActionResult = { url?: string; error?: string; emailWarning?: string }
type Action = (fd: FormData) => Promise<ActionResult>
type PublicLinkAction = () => Promise<{ url?: string; error?: string }>

type Props = {
  slug: string
  action: Action
  // Quando informados, mostra o seletor de ministério/escola (uso em /inscricoes,
  // onde o DH pode escolher o destino). Quando ausentes, use fixedDestination.
  ministries?: MinistryOption[]
  schools?: SchoolOption[]
  // Quando informado, trava o destino sem seletor (uso em /ministerios/[id]/equipe,
  // onde o ministério já é o contexto da página).
  fixedDestination?: { type: 'ministry' | 'school'; id: string; label: string }
  buttonClassName?: string
  buttonLabel?: string
  // Link público (curto) de pré-inscrição pra divulgar (WhatsApp, Instagram,
  // site) — pra quem não precisa que o líder já tenha os dados da pessoa.
  // Ausente/omitido quando não há página pública pra esse destino.
  publicLinkAction?: PublicLinkAction
}

const INPUT = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400'

export function EnviarFormularioObreiroDiretoButton({
  slug, action, ministries = [], schools = [], fixedDestination, buttonClassName, buttonLabel, publicLinkAction,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<ActionResult | null>(null)
  const [publicLinkState, setPublicLinkState] = useState<'idle' | 'loading' | 'copied' | 'error'>('idle')
  const [publicLinkError, setPublicLinkError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState<{ name: string; phone: string } | null>(null)

  function handleCopyPublicLink() {
    if (!publicLinkAction) return
    setPublicLinkState('loading')
    setPublicLinkError(null)
    startTransition(async () => {
      const res = await publicLinkAction()
      if (res.url) {
        try { await navigator.clipboard.writeText(res.url) } catch {}
        setPublicLinkState('copied')
        setTimeout(() => setPublicLinkState('idle'), 2500)
      } else {
        setPublicLinkState('error')
        setPublicLinkError(res.error ?? 'Não foi possível gerar o link.')
      }
    })
  }

  function handleClose() {
    setOpen(false)
    setResult(null)
    setSubmitted(null)
    setPublicLinkState('idle')
    setPublicLinkError(null)
    if (result?.url) router.refresh()
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    if (fixedDestination) fd.set('destination', `${fixedDestination.type}:${fixedDestination.id}`)
    setSubmitted({ name: (fd.get('full_name') as string) ?? '', phone: (fd.get('phone') as string) ?? '' })

    startTransition(async () => {
      const res = await action(fd)
      setResult(res)
      if (res.url) {
        try { await navigator.clipboard.writeText(res.url) } catch {}
      }
    })
  }

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label={buttonLabel ?? 'Enviar formulário direto'}
        className={buttonClassName ?? 'inline-flex items-center gap-1 p-2 sm:px-3 sm:py-2 text-xs font-semibold text-white bg-violet-500 hover:bg-violet-600 rounded-lg transition-colors whitespace-nowrap'}>
        <Send className="size-4 sm:size-3.5" /> <span className="hidden sm:inline">{buttonLabel ?? 'Enviar formulário direto'}</span>
      </button>

      <Modal open={open} onClose={handleClose} title="Enviar formulário definitivo de obreiro"
        subtitle="Use quando você já conversou com a pessoa fora do sistema — pula a pré-inscrição pública.">
        {publicLinkAction && !result?.url && (
          <div className="mx-5 mt-4 rounded-lg border border-violet-100 bg-violet-50 px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-violet-700">
                Ou copie o link público pra divulgar (WhatsApp, Instagram, site) — pra quem quer se inscrever por conta própria.
              </p>
              <button type="button" onClick={handleCopyPublicLink} disabled={publicLinkState === 'loading'}
                className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-700 bg-white border border-violet-200 rounded-lg hover:bg-violet-100 disabled:opacity-60 transition-colors whitespace-nowrap">
                <Copy className="size-3.5" />
                {publicLinkState === 'copied' ? 'Copiado!' : publicLinkState === 'loading' ? 'Gerando…' : publicLinkState === 'error' ? 'Ver motivo' : 'Copiar link'}
              </button>
            </div>
            {publicLinkState === 'error' && publicLinkError && (
              <p className="text-xs text-amber-700 mt-2"><AlertTriangle className="size-3.5 inline -mt-0.5" /> {publicLinkError}</p>
            )}
          </div>
        )}
        {!result?.url ? (
          <form onSubmit={handleSubmit} className="space-y-4 p-5">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome completo *</label>
              <input name="full_name" required placeholder="Nome do candidato" className={INPUT} />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">E-mail</label>
              <input name="email" type="email" placeholder="email@exemplo.com" className={INPUT} />
              <p className="text-xs text-gray-400 mt-1">Sem e-mail, o link é gerado e copiado mesmo assim — envie manualmente (WhatsApp, por exemplo).</p>
            </div>

            <InternationalPhoneField phoneName="phone" accentRing="ring-violet-400" />

            {!fixedDestination && (ministries.length > 0 || schools.length > 0) && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ministério ou escola</label>
                <select name="destination" defaultValue="" className={INPUT}>
                  <option value="">Sem preferência</option>
                  {ministries.length > 0 && (
                    <optgroup label="Ministérios">
                      {ministries.map(m => <option key={m.id} value={`ministry:${m.id}`}>{m.name}</option>)}
                    </optgroup>
                  )}
                  {schools.length > 0 && (
                    <optgroup label="Escolas">
                      {schools.map(s => <option key={s.id} value={`school:${s.id}`}>{s.name}</option>)}
                    </optgroup>
                  )}
                </select>
              </div>
            )}
            {fixedDestination && (
              <p className="text-xs text-gray-500">Destino: <span className="font-medium text-gray-700">{fixedDestination.label}</span></p>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Observação / mensagem</label>
              <textarea name="message" rows={3} placeholder="Contexto da conversa, indicação..." className={`${INPUT} resize-none`} />
            </div>

            {result?.error && (
              <p className="text-xs text-red-600"><AlertTriangle className="size-3.5 inline -mt-0.5" /> {result.error}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={handleClose}
                className="flex-1 px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={isPending}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-violet-500 hover:bg-violet-600 disabled:opacity-60 rounded-lg transition-colors">
                {isPending ? 'Enviando…' : 'Enviar formulário'}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="size-5" />
              <p className="text-sm font-semibold">Formulário criado e link copiado!</p>
            </div>
            {result.emailWarning === 'sem_email_candidato' && (
              <p className="text-xs text-amber-700"><AlertTriangle className="size-3.5 inline -mt-0.5" /> Sem e-mail informado — envie o link manualmente (WhatsApp, por exemplo).</p>
            )}
            {result.emailWarning === 'quota_atingida' && (
              <p className="text-xs text-amber-700"><AlertTriangle className="size-3.5 inline -mt-0.5" /> Limite de e-mails do sistema atingido — envie o link manualmente.</p>
            )}
            {result.emailWarning === 'email_falhou' && (
              <p className="text-xs text-amber-700"><AlertTriangle className="size-3.5 inline -mt-0.5" /> O e-mail não pôde ser enviado — envie o link manualmente.</p>
            )}
            {!result.emailWarning && (
              <p className="text-xs text-gray-500">Também enviamos por e-mail para a pessoa.</p>
            )}
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <LinkIcon className="size-3.5 text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-600 truncate">{result.url}</span>
            </div>
            {(() => {
              const digits = submitted?.phone ? whatsappDigits(submitted.phone) : ''
              if (!digits) return null
              const text = encodeURIComponent(`Olá${submitted?.name ? ` ${submitted.name.split(' ')[0]}` : ''}! Segue o link para você se inscrever: ${result.url}`)
              return (
                <a href={`https://wa.me/${digits}?text=${text}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-semibold text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors">
                  <MessageCircle className="size-4" /> Enviar por WhatsApp
                </a>
              )
            })()}
            <button type="button" onClick={handleClose}
              className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-violet-500 hover:bg-violet-600 rounded-lg transition-colors">
              Concluir
            </button>
          </div>
        )}
      </Modal>
    </>
  )
}
