'use client'

import { useState, useTransition, useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import { AlertTriangle, Link as LinkIcon, ClipboardList, Loader2, Mail, CheckCircle2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'

type ActionResult = {
  url?: string
  error?: string
  emailWarning?: 'sem_email_eted' | 'sem_email_candidato' | 'email_falhou' | 'quota_atingida' | string
  schoolId?: string
}

type Props = {
  interestFormId: string
  slug: string
  action: (formData: FormData) => Promise<ActionResult>
  schoolId: string
  candidateName?: string
  emailDisabled?: boolean
  emailDisabledReason?: string
  label?: string
}

function CenterToast({ visible, icon, tone = 'dark', children }: {
  visible: boolean
  icon: ReactNode
  tone?: 'dark' | 'success'
  children: ReactNode
}) {
  const [rendered, setRendered] = useState(false)

  useEffect(() => {
    if (visible) {
      // pequeno delay para a transição de entrada funcionar após o mount
      const t = setTimeout(() => setRendered(true), 10)
      return () => clearTimeout(t)
    } else {
      setRendered(false)
    }
  }, [visible])

  if (!visible && !rendered) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none">
      <div
        className={`flex items-center gap-3 px-7 py-4 rounded-2xl shadow-2xl
          transition-all duration-400 ease-out
          ${tone === 'success' ? 'bg-emerald-600 text-white' : 'bg-gray-950 text-white'}
          ${rendered && visible
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-90 translate-y-3'
          }`}
      >
        {icon}
        <span className="text-base font-semibold tracking-tight">{children}</span>
      </div>
    </div>
  )
}

export function DisponibilizarFormularioButton({ interestFormId, slug, action, schoolId, candidateName, emailDisabled, emailDisabledReason, label }: Props) {
  const [isPending, startTransition] = useTransition()
  const [pendingAction, setPendingAction] = useState<'copy' | 'email' | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [showCopied, setShowCopied] = useState(false)
  const [showSent, setShowSent] = useState(false)
  const [formUrl, setFormUrl] = useState<string | null>(null)
  const [emailNotice, setEmailNotice] = useState<{
    msg: string
    schoolId?: string
  } | null>(null)

  function flashToast(setter: (v: boolean) => void) {
    setter(true)
    setTimeout(() => setter(false), 2400)
  }

  function runAction(sendEmail: boolean) {
    setPendingAction(sendEmail ? 'email' : 'copy')
    startTransition(async () => {
      const fd = new FormData()
      fd.append('interest_form_id', interestFormId)
      fd.append('slug', slug)
      fd.append('send_email', sendEmail ? '1' : '0')

      const result = await action(fd)
      setConfirmOpen(false)
      setPendingAction(null)

      // Erro fatal (formulário não gerado)
      if (!result.url) {
        setEmailNotice({ msg: `Erro ao gerar formulário: ${result.error ?? 'tente novamente.'}` })
        return
      }

      setFormUrl(result.url)

      if (!sendEmail) {
        try { await navigator.clipboard.writeText(result.url) } catch {}
        flashToast(setShowCopied)
        return
      }

      // Enviado por e-mail — se não deu certo, copia o link como fallback e
      // explica o motivo; se deu certo, confirma o envio.
      if (!result.emailWarning) {
        flashToast(setShowSent)
        return
      }

      try { await navigator.clipboard.writeText(result.url) } catch {}

      if (result.emailWarning === 'sem_email_eted') {
        setEmailNotice({
          msg: 'E-mail não enviado automaticamente — a ETED ainda não tem e-mail cadastrado. O link foi copiado, envie manualmente.',
          schoolId: result.schoolId ?? schoolId,
        })
      } else if (result.emailWarning === 'sem_email_candidato') {
        setEmailNotice({
          msg: 'E-mail não enviado — o candidato não informou e-mail na pré-inscrição. O link foi copiado, envie manualmente (WhatsApp, por exemplo).',
        })
      } else if (result.emailWarning === 'quota_atingida') {
        setEmailNotice({
          msg: 'Limite de e-mails do sistema atingido. O link foi copiado, envie manualmente ao candidato.',
        })
      } else if (result.emailWarning === 'email_falhou') {
        setEmailNotice({
          msg: 'E-mail não pôde ser enviado. O link foi copiado, envie manualmente ao candidato.',
        })
      }
    })
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={isPending}
          className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-60"
        >
          <ClipboardList className="size-3.5 inline -mt-0.5" /> {label ?? 'Enviar formulário por e-mail'}
        </button>
        {emailDisabled && (
          <p className="text-xs text-orange-500 leading-tight max-w-[200px]" title={emailDisabledReason}>
            <AlertTriangle className="size-3.5 inline -mt-0.5" /> Sem envio automático
          </p>
        )}
        {formUrl && (
          <a
            href={`${formUrl}${formUrl.includes('?') ? '&' : '?'}print=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-amber-700 underline hover:text-amber-900"
          >
            A pessoa não consegue preencher pelo link? Gerar PDF
          </a>
        )}
      </div>

      {/* Confirmação: enviar por e-mail agora ou só copiar o link */}
      <Modal
        open={confirmOpen}
        onClose={() => { if (!isPending) setConfirmOpen(false) }}
        title="Enviar formulário"
        subtitle={candidateName}
      >
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            {emailDisabled
              ? <>Envio automático indisponível no momento{emailDisabledReason ? ` — ${emailDisabledReason}` : '.'} Copie o link abaixo e envie manualmente.</>
              : <>O formulário pode ser enviado automaticamente por e-mail{candidateName ? ` para ${candidateName}` : ''}, ou você pode copiar o link e enviar do seu jeito (WhatsApp, por exemplo).</>}
          </p>
          <div className="flex flex-col gap-2">
            {!emailDisabled && (
              <button
                type="button"
                onClick={() => runAction(true)}
                disabled={isPending}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {isPending && pendingAction === 'email'
                  ? <><Loader2 className="size-4 animate-spin" /> Enviando…</>
                  : <><Mail className="size-4" /> Enviar por e-mail</>}
              </button>
            )}
            <button
              type="button"
              onClick={() => runAction(false)}
              disabled={isPending}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-60 text-sm font-semibold rounded-lg transition-colors"
            >
              {isPending && pendingAction === 'copy'
                ? <><Loader2 className="size-4 animate-spin" /> Copiando…</>
                : <><LinkIcon className="size-4" /> Copiar link</>}
            </button>
          </div>
        </div>
      </Modal>

      {/* Toasts centrais de confirmação */}
      <CenterToast visible={showCopied} icon={<LinkIcon className="size-6 text-brand-500" />}>
        Link copiado!
      </CenterToast>
      <CenterToast visible={showSent} icon={<CheckCircle2 className="size-6" />} tone="success">
        E-mail enviado com sucesso!
      </CenterToast>

      {/* Aviso de e-mail — só aparece quando necessário */}
      {emailNotice && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-6 pointer-events-none">
          <div className="pointer-events-auto bg-white rounded-2xl shadow-xl border border-yellow-100 p-5 max-w-sm w-full">
            <p className="text-sm text-gray-800 mb-3 leading-relaxed"><AlertTriangle className="size-3.5 inline -mt-0.5" /> {emailNotice.msg}</p>
            <div className="flex items-center gap-2">
              {emailNotice.schoolId && (
                <Link
                  href={`/${slug}/escolas/${emailNotice.schoolId}#email-eted`}
                  className="text-xs px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg transition-colors"
                  onClick={() => setEmailNotice(null)}
                >
                  Cadastrar e-mail →
                </Link>
              )}
              <button
                type="button"
                onClick={() => setEmailNotice(null)}
                className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
