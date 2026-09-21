'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

type SchoolTypeOption = { value: string; label: string }
type OrgOption = { slug: string; name: string }

export function OpportunityFilters({ types, orgs }: { types: readonly SchoolTypeOption[]; orgs: OrgOption[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [q, setQ] = useState(searchParams.get('q') ?? '')

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`/oportunidades?${params.toString()}`)
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <form
        onSubmit={e => { e.preventDefault(); updateParam('q', q) }}
        className="flex-1"
      >
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar escola..."
          className="w-full px-4 py-2.5 bg-white/5 border border-white/15 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </form>

      <select
        defaultValue={searchParams.get('type') ?? ''}
        onChange={e => updateParam('type', e.target.value)}
        className="px-4 py-2.5 bg-white/5 border border-white/15 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        <option value="" className="text-gray-900">Todos os tipos</option>
        {types.map(t => (
          <option key={t.value} value={t.value} className="text-gray-900">{t.label}</option>
        ))}
      </select>

      <select
        defaultValue={searchParams.get('org') ?? ''}
        onChange={e => updateParam('org', e.target.value)}
        className="px-4 py-2.5 bg-white/5 border border-white/15 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        <option value="" className="text-gray-900">Todas as organizações</option>
        {orgs.map(o => (
          <option key={o.slug} value={o.slug} className="text-gray-900">{o.name}</option>
        ))}
      </select>
    </div>
  )
}
