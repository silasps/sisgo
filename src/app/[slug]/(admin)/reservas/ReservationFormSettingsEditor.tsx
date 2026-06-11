'use client'

import { useMemo, useState } from 'react'

const CUSTOM_FIELD_TYPES = [
  { value: 'text', label: 'Aberto' },
  { value: 'textarea', label: 'Aberto longo' },
  { value: 'date', label: 'Data' },
  { value: 'number', label: 'Número' },
  { value: 'tel', label: 'Telefone' },
  { value: 'email', label: 'E-mail' },
  { value: 'boolean', label: 'Sim/Não' },
] as const

type FixedField = {
  key: string
  defaultLabel: string
  label: string
  visible: boolean
  required: boolean
}

type CustomField = {
  id: string
  label: string
  type: typeof CUSTOM_FIELD_TYPES[number]['value']
  visible: boolean
  required: boolean
}

type Props = {
  action: (formData: FormData) => void | Promise<void>
  fixedFields: FixedField[]
  customFields: CustomField[]
  limit: number
}

export function ReservationFormSettingsEditor({ action, fixedFields, customFields, limit }: Props) {
  const [fields, setFields] = useState<CustomField[]>(customFields)

  const canAdd = fields.length < limit
  const indexedFields = useMemo(() => fields.map((field, index) => ({ ...field, index })), [fields])

  const addField = () => {
    if (!canAdd) return
    setFields(current => [
      ...current,
      {
        id: `novo_${Date.now()}`,
        label: '',
        type: 'text',
        visible: true,
        required: false,
      },
    ])
  }

  const removeField = (index: number) => {
    setFields(current => current.filter((_, itemIndex) => itemIndex !== index))
  }

  return (
    <details className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <summary className="cursor-pointer px-5 py-4 border-b border-gray-100 text-sm font-medium text-gray-800">
        Configurar formulário de reservas
      </summary>
      <form action={action} className="px-5 py-4 space-y-4">
        <p className="text-xs text-gray-500">
          A hospitalidade pode adaptar os campos opcionais conforme o jeito de trabalho da base. Tipo, título e datas continuam fixos.
        </p>
        <div className="space-y-3">
          {fixedFields.map(field => (
            <div key={field.key} className="grid gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{field.defaultLabel}</label>
                <input
                  name={`${field.key}_label`}
                  defaultValue={field.label}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
              <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                <input name={`${field.key}_visible`} type="checkbox" defaultChecked={field.visible} className="h-4 w-4 rounded border-gray-300 text-brand-500" />
                Mostrar
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                <input name={`${field.key}_required`} type="checkbox" defaultChecked={field.required} className="h-4 w-4 rounded border-gray-300 text-brand-500" />
                Obrigatório
              </label>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 pt-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-800">Campos novos</p>
              <p className="text-xs text-gray-500 mt-0.5">Clique em criar novo campo para adicionar perguntas extras.</p>
            </div>
            <button
              type="button"
              onClick={addField}
              disabled={!canAdd}
              className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Criar novo campo
            </button>
          </div>

          {indexedFields.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-400">
              Nenhum campo personalizado criado.
            </div>
          ) : (
            indexedFields.map(field => (
              <div key={field.id} className="grid gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3 sm:grid-cols-[1fr_9rem_auto_auto_auto] sm:items-end">
                <input type="hidden" name={`custom_field_${field.index}_id`} value={field.id} />
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nome do campo</label>
                  <input
                    name={`custom_field_${field.index}_label`}
                    defaultValue={field.label}
                    placeholder="Ex: Horário de chegada"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                  <select
                    name={`custom_field_${field.index}_type`}
                    defaultValue={field.type}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  >
                    {CUSTOM_FIELD_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                  <input name={`custom_field_${field.index}_visible`} type="checkbox" defaultChecked={field.visible} className="h-4 w-4 rounded border-gray-300 text-brand-500" />
                  Mostrar
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                  <input name={`custom_field_${field.index}_required`} type="checkbox" defaultChecked={field.required} className="h-4 w-4 rounded border-gray-300 text-brand-500" />
                  Obrigatório
                </label>
                <button
                  type="button"
                  onClick={() => removeField(field.index)}
                  className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Remover
                </button>
              </div>
            ))
          )}
        </div>

        <button type="submit"
          className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors">
          Salvar formulário
        </button>
      </form>
    </details>
  )
}
