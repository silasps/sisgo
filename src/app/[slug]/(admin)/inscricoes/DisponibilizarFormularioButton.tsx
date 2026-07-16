'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, Link as LinkIcon, ClipboardList, Loader2 } from 'lucide-react'

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
  emailDisabled?: boolean
  emailDisabledReason?: string
  label?: string
}

function CopiedToast({ visible }: { visible: boolean }) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div
        className={`flex items-center gap-3 bg-gray-950 text-white px-7 py-4 rounded-2xl shadow-2xl
          transition-all duration-400 ease-out
          ${rendered && visible
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-90 translate-y-3'
          }`}
      >
        <LinkIcon className="size-6 text-brand-500" />
        <span className="text-base font-semibold tracking-tight">Link copiado!</span>
      </div>
    </div>
  )
}

export function DisponibilizarFormularioButton({ interestFormId, slug, action, schoolId, emailDisabled, emailDisabledReason, label }: Props) {
  const [isPending, startTransition] = useTransition()
  const [showCopied, setShowCopied] = useState(false)
  const [formUrl, setFormUrl] = useState<string | null>(null)
  const [emailNotice, setEmailNotice] = useState<{
    msg: string
    schoolId?: string
  } | null>(null)

  function triggerCopiedToast() {
    setShowCopied(true)
    setTimeout(() => setShowCopied(false), 2400)
  }

  function handleClick() {
    startTransition(async () => {
      const fd = new FormData()
      fd.append('interest_form_id', interestFormId)
      fd.append('slug', slug)

      const result = await action(fd)

      // Erro fatal (formulário não gerado)
      if (!result.url) {
        setEmailNotice({ msg: `Erro ao gerar formulário: ${result.error ?? 'tente novamente.'}` })
        return
      }

      setFormUrl(result.url)

      // Copia link — sempre
      try { await navigator.clipboard.writeText(result.url) } catch {}

      // Toast "Link copiado!" — sempre
      triggerCopiedToast()

      // Aviso de e-mail — secundário, não bloqueia
      if (result.emailWarning === 'sem_email_eted') {
        setEmailNotice({
          msg: 'E-mail não enviado automaticamente — a ETED ainda não tem e-mail cadastrado. Envie o link manualmente.',
          schoolId: result.schoolId ?? schoolId,
        })
      } else if (result.emailWarning === 'sem_email_candidato') {
        setEmailNotice({
          msg: 'E-mail não enviado — o candidato não informou e-mail na pré-inscrição. Envie o link manualmente (WhatsApp, por exemplo).',
        })
      } else if (result.emailWarning === 'quota_atingida') {
        setEmailNotice({
          msg: 'Limite de e-mails do sistema atingido. O link foi gerado e copiado — envie manualmente ao candidato.',
        })
      } else if (result.emailWarning === 'email_falhou') {
        setEmailNotice({
          msg: 'E-mail não pôde ser enviado. Envie o link manualmente ao candidato.',
        })
      }
    })
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={handleClick}
          disabled={isPending}
          className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-60"
        >
          {isPending ? <><Loader2 className="size-3.5 inline -mt-0.5 animate-spin" /> Enviando…</> : <><ClipboardList className="size-3.5 inline -mt-0.5" /> {label ?? 'Enviar formulário por e-mail'}</>}
        </button>
        <p className="text-xs text-gray-400 leading-tight max-w-[220px]">
          O link também é copiado, caso prefira compartilhar por outro meio.
        </p>
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

      {/* Toast central "Link copiado!" */}
      <CopiedToast visible={showCopied} />

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
