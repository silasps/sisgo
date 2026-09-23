'use client'

const OPTIONS = [
  { value: 'nome_asc', label: 'Nome (A → Z)' },
  { value: 'nome_desc', label: 'Nome (Z → A)' },
  { value: 'recente', label: 'Mais recentes primeiro' },
] as const

export function SortSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
    >
      {OPTIONS.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}
