'use client'

type Props = {
  label: string
  name: string
  defaultValue?: string
  placeholder?: string
}

// Só dígitos — sem sinal negativo nem spinner do input number (que deixava
// digitar "-41" e afins).
export function IntegerField({ label, name, defaultValue, placeholder }: Props) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        name={name}
        type="text"
        inputMode="numeric"
        defaultValue={defaultValue}
        placeholder={placeholder}
        onInput={e => { e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '') }}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
    </div>
  )
}
