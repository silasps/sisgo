'use client'

import { useState } from 'react'
import { InternationalPhoneField } from '@/components/ui/InternationalPhoneField'
import { slugify } from '@/lib/slugify'

const ORG_TYPES = [
  { value: 'jocum', label: 'JOCUM' },
  { value: 'missao', label: 'Outra organização missionária' },
  { value: 'outro', label: 'Outro' },
]

const inputClass = 'w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-gray-50'

export function SobreOrganizacaoSection({ data }: { data?: Record<string, string> }) {
  const [name, setName] = useState(data?.org_name ?? '')

  return (
    <div className="space-y-5">
      <h2 className="font-semibold text-gray-900">Sobre a organização</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome da organização *</label>
        <input
          name="org_name"
          required
          defaultValue={data?.org_name}
          onChange={e => setName(e.target.value)}
          placeholder="Ex: Missão Vida Nova"
          className={inputClass}
        />
        {name && (
          <p className="text-xs text-gray-400 mt-1.5">
            Endereço: <span className="font-mono">sisgo.app/{slugify(name)}</span>
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de organização *</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {ORG_TYPES.map(t => (
            <label
              key={t.value}
              className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 cursor-pointer has-[:checked]:border-brand-500 has-[:checked]:bg-brand-500/10 has-[:checked]:text-brand-600 transition-colors"
            >
              <input
                type="radio"
                name="org_type"
                value={t.value}
                defaultChecked={(data?.org_type ?? 'missao') === t.value}
                className="accent-brand-500"
                required
              />
              {t.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Site (opcional)</label>
        <input
          name="website"
          defaultValue={data?.website}
          placeholder="https://..."
          className={inputClass}
        />
      </div>

      <InternationalPhoneField phoneName="phone" label="Telefone" defaultCountryIso="BR" defaultPhone={data?.phone} />

      {/* Honeypot — invisível para humanos, bots que preenchem tudo caem aqui */}
      <input
        type="text"
        name="hp_field"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
      />
    </div>
  )
}
