'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { ConfigField, FormConfig } from '@/lib/school/formConfig'

type ConfigSection = { secao: string; key: string; titulo: string; campos: ConfigField[] }
type Template = { id: string; name: string; form_config: FormConfig }

function buildActive(sections: ConfigSection[], hiddenFields: string[]): Record<string, boolean> {
  const hiddenSet = new Set(hiddenFields)
  const init: Record<string, boolean> = {}
  for (const secao of sections) for (const campo of secao.campos) {
    init[`${secao.secao}.${campo.name}`] = !hiddenSet.has(`${secao.secao}.${campo.name}`)
  }
  return init
}

function buildRequired(sections: ConfigSection[], overrides: Record<string, boolean>): Record<string, boolean> {
  const init: Record<string, boolean> = {}
  for (const secao of sections) for (const campo of secao.campos) {
    if (campo.requiredByDefault === undefined) continue
    const key = `${secao.secao}.${campo.name}`
    init[key] = overrides[key] ?? campo.requiredByDefault
  }
  return init
}

// Editor interativo dos campos do formulário — usado tanto na tela da
// escola quanto na da turma. Client component porque: (1) o checkbox de
// cada campo precisa reagir na hora (tachado/destacado e liberar o
// seletor de obrigatório/opcional) sem esperar o form ser salvo; (2)
// precisa avisar se tem alteração não salva (clicar num modelo ou mexer
// num campo sem apertar "Salvar configuração" depois). Checkboxes
// continuam nativos (name=`sX.campo`) pra funcionar com os server
// actions existentes sem mudança nenhuma do lado deles.
export function FormConfigFields({
  sections, savedHiddenFields, savedRequiredOverrides, previewHiddenFields, previewRequiredOverrides,
  templates, appliedTemplateId, baseHref,
}: {
  sections: ConfigSection[]
  savedHiddenFields: string[]
  savedRequiredOverrides: Record<string, boolean>
  previewHiddenFields: string[]
  previewRequiredOverrides: Record<string, boolean>
  templates: Template[]
  appliedTemplateId: string | null
  baseHref: string
}) {
  const [active, setActive] = useState<Record<string, boolean>>(() => buildActive(sections, previewHiddenFields))
  const [required, setRequired] = useState<Record<string, boolean>>(() => buildRequired(sections, previewRequiredOverrides))

  const savedActive = useMemo(() => buildActive(sections, savedHiddenFields), [sections, savedHiddenFields])
  const savedRequired = useMemo(() => buildRequired(sections, savedRequiredOverrides), [sections, savedRequiredOverrides])

  const isDirty = useMemo(() => {
    for (const key of Object.keys(savedActive)) if (!!active[key] !== !!savedActive[key]) return true
    for (const key of Object.keys(savedRequired)) if (!!required[key] !== !!savedRequired[key]) return true
    return false
  }, [active, required, savedActive, savedRequired])

  // Nome do modelo que bate exatamente com a configuração JÁ SALVA (não
  // com a pré-visualização) — pra dizer "é isso que tá valendo hoje".
  const currentSavedTemplateName = useMemo(() => {
    const savedHiddenSet = new Set(savedHiddenFields)
    const match = templates.find(t => {
      const tHidden = new Set(t.form_config.hidden_fields ?? [])
      return tHidden.size === savedHiddenSet.size && [...tHidden].every(k => savedHiddenSet.has(k))
    })
    return match?.name ?? null
  }, [templates, savedHiddenFields])

  // Confirmação do navegador ao sair/fechar/recarregar a aba com
  // alteração não salva — não cobre navegação interna (Link do Next não
  // dispara beforeunload), mas cobre o caso real de perder o trabalho ao
  // fechar a aba ou digitar outra URL.
  useEffect(() => {
    if (!isDirty) return
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  function toggleActive(secao: ConfigSection, campo: ConfigField) {
    const key = `${secao.secao}.${campo.name}`
    const temOculto = secao.campos.some(c => c.name === 'oculto')
    setActive(prev => {
      const turningOn = !prev[key]
      const next = { ...prev, [key]: turningOn }
      const ocultoKey = `${secao.secao}.oculto`
      if (temOculto && campo.name !== 'oculto' && turningOn && !prev[ocultoKey]) {
        next[ocultoKey] = true
      }
      return next
    })
  }

  const appliedTemplate = appliedTemplateId ? templates.find(t => t.id === appliedTemplateId) : null

  const statusBanner = isDirty ? (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <strong>Alterações não salvas.</strong>{' '}
      {appliedTemplate ? <>Pré-visualizando o modelo &quot;{appliedTemplate.name}&quot;. </> : null}
      Role até o fim e clique em &quot;Salvar configuração&quot; — senão, ao sair daqui, essas mudanças se perdem.
    </div>
  ) : (
    <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
      <strong>Salvo.</strong>{' '}
      {currentSavedTemplateName
        ? <>A configuração atual é igual ao modelo &quot;{currentSavedTemplateName}&quot;.</>
        : <>Esta é uma configuração personalizada (não corresponde a nenhum modelo salvo).</>}
    </div>
  )

  return (
    <div className="space-y-3">
      {statusBanner}

      {templates.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 text-sm mb-1">Começar de um modelo</h3>
          <p className="text-xs text-gray-400 mb-3">
            Só muda os campos abaixo pra você revisar — nada é salvo até clicar em &quot;Salvar configuração&quot;.
          </p>
          <div className="flex flex-wrap gap-2">
            {templates.map(t => (
              <Link key={t.id} href={`${baseHref}?template=${t.id}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  appliedTemplateId === t.id
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}>
                {t.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {sections.map(secao => {
        const ativos = secao.campos.filter(c => active[`${secao.secao}.${c.name}`]).length
        return (
          <details key={secao.key} className="group bg-white rounded-xl border border-gray-200 overflow-hidden">
            <summary className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none list-none hover:bg-gray-50">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900 text-sm">{secao.titulo}</h3>
                <span className="text-xs text-gray-400">{ativos}/{secao.campos.length}</span>
              </div>
              <span className="text-gray-400 text-xs transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="border-t border-gray-100 divide-y divide-gray-50">
              {secao.campos.map(campo => {
                const key = `${secao.secao}.${campo.name}`
                const ativo = !!active[key]
                return (
                  <div key={campo.name} className={campo.indent ? 'pl-6 bg-gray-50/60' : undefined}>
                    <label className="flex items-start justify-between gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
                      <span className="min-w-0">
                        <span className={`text-sm block ${ativo ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                          {campo.label}
                        </span>
                        {campo.description && (
                          <span className="text-xs text-gray-400 block mt-0.5">{campo.description}</span>
                        )}
                      </span>
                      <input
                        type="checkbox"
                        name={key}
                        checked={ativo}
                        onChange={() => toggleActive(secao, campo)}
                        className="w-4 h-4 rounded accent-brand-500 mt-0.5 flex-shrink-0"
                      />
                    </label>
                    {ativo && campo.requiredByDefault !== undefined && (
                      <div className="flex items-center gap-2 px-5 pb-3 -mt-1">
                        <span className="text-xs text-gray-400">Resposta:</span>
                        <select
                          name={`${key}__required`}
                          value={required[key] ? 'obrigatorio' : 'opcional'}
                          onChange={e => setRequired(prev => ({ ...prev, [key]: e.target.value === 'obrigatorio' }))}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-400"
                        >
                          <option value="obrigatorio">Obrigatória</option>
                          <option value="opcional">Opcional</option>
                        </select>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </details>
        )
      })}

      {statusBanner}
    </div>
  )
}
