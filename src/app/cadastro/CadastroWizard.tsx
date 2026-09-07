'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { criarOrganizacaoWizard, type WizardPayload } from './actions'
import { SobreOrganizacaoSection } from './sections/SobreOrganizacaoSection'
import { LocalizacaoSection } from './sections/LocalizacaoSection'
import { ResponsavelSection } from './sections/ResponsavelSection'
import { PlanoSection, type WizardPlan } from './sections/PlanoSection'
import { RevisaoSection } from './sections/RevisaoSection'

type Props = {
  plans: WizardPlan[]
  hasSession: boolean
  sessionEmail?: string | null
  preselectPlanSlug?: string
}

export function CadastroWizard({ plans, hasSession, sessionEmail, preselectPlanSlug }: Props) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [current, setCurrent] = useState(0)
  const preselectedPlanId = plans.find(p => p.slug === preselectPlanSlug)?.id
  const [data, setData] = useState<Record<string, string>>(
    preselectedPlanId ? { plan_id: preselectedPlanId } : {}
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const sectionIds = hasSession
    ? ['sobre', 'localizacao', 'plano', 'revisao']
    : ['sobre', 'localizacao', 'responsavel', 'plano', 'revisao']

  const currentId = sectionIds[current]
  const isLast = current === sectionIds.length - 1
  const progress = Math.round(((current + 1) / sectionIds.length) * 100)

  function mergeForm(e: React.FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget)
    const merged = { ...data }
    fd.forEach((value, key) => { merged[key] = String(value) })
    setData(merged)
    return merged
  }

  function handleNext(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    mergeForm(e)
    setError(null)
    setCurrent(c => Math.min(c + 1, sectionIds.length - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleBack() {
    setError(null)
    setCurrent(c => Math.max(0, c - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleConfirm() {
    startTransition(async () => {
      setError(null)
      const result = await criarOrganizacaoWizard(data as WizardPayload)
      if (result?.error) {
        setError(result.error)
        return
      }
      if (result?.redirectTo) {
        router.push(result.redirectTo)
        router.refresh()
      }
    })
  }

  function renderSection() {
    switch (currentId) {
      case 'sobre': return <SobreOrganizacaoSection data={data} />
      case 'localizacao': return <LocalizacaoSection data={data} />
      case 'responsavel': return <ResponsavelSection data={data} />
      case 'plano': return <PlanoSection plans={plans} data={data} />
      case 'revisao': return <RevisaoSection data={data} plans={plans} hasSession={hasSession} sessionEmail={sessionEmail} />
      default: return null
    }
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-500">
            Etapa {current + 1} de {sectionIds.length}
          </span>
          <span className="text-xs font-semibold text-brand-600">{progress}%</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-brand-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <form
        ref={formRef}
        onSubmit={isLast ? (e => { e.preventDefault(); handleConfirm() }) : handleNext}
        className="space-y-6"
      >
        {renderSection()}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-6 border-t border-gray-100">
          {current > 0 ? (
            <button
              type="button"
              onClick={handleBack}
              className="w-full sm:w-auto px-6 py-3 sm:py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-center"
            >
              Voltar
            </button>
          ) : <div className="hidden sm:block" />}

          <button
            type="submit"
            disabled={isPending}
            className="w-full sm:w-auto px-8 py-3 sm:py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors text-center"
          >
            {isPending ? 'Criando...' : isLast ? 'Confirmar e criar organização' : 'Próxima etapa →'}
          </button>
        </div>
      </form>
    </div>
  )
}
