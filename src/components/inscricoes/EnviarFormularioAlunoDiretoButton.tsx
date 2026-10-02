'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/Modal'
import { InternationalPhoneField } from '@/components/ui/InternationalPhoneField'
import { AlertTriangle, CheckCircle2, Link as LinkIcon, Send } from 'lucide-react'

type ClassOption = { id: string; name: string }
type ActionResult = { url?: string; error?: string; emailWarning?: string }
type Action = (fd: FormData) => Promise<ActionResult>

type Props = {
  action: Action
  classes: ClassOption[]
  buttonClassName?: string
  buttonLabel?: string
}

const INPUT = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400'

// Espelha EnviarFormularioObreiroDiretoButton — líder já conversou com o
// candidato fora do sistema e manda o formulário definitivo de aluno direto,
// pulando a pré-inscrição pública.
export function EnviarFormularioAlunoDiretoButton({ action, classes, buttonClassName, buttonLabel }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<ActionResult | null>(null)

  function handleClose() {
    setOpen(false)
    setResult(null)
    if (result?.url) router.refresh()
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
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
        className={buttonClassName ?? 'inline-flex items-center gap-1 p-2 sm:px-3 sm:py-2 text-xs font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-lg transition-colors whitespace-nowrap'}>
        <Send className="size-4 sm:size-3.5" /> <span className="hidden sm:inline">{buttonLabel ?? 'Enviar formulário direto'}</span>
      </button>

      <Modal open={open} onClose={handleClose} title="Enviar formulário definitivo de aluno"
        subtitle="Use quando você já conversou com a pessoa fora do sistema — pula a pré-inscrição pública.">
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

            <InternationalPhoneField phoneName="phone" />

            {classes.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Turma</label>
                <select name="class_id" defaultValue="" className={INPUT}>
                  <option value="">Sem preferência</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
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
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-60 rounded-lg transition-colors">
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
            {result.emailWarning === 'sem_email_eted' && (
              <p className="text-xs text-amber-700"><AlertTriangle className="size-3.5 inline -mt-0.5" /> A escola não tem e-mail de contato configurado — envie o link manualmente.</p>
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
            <button type="button" onClick={handleClose}
              className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-lg transition-colors">
              Concluir
            </button>
          </div>
        )}
      </Modal>
    </>
  )
}
