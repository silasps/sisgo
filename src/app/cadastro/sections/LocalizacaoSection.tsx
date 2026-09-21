'use client'

const inputClass = 'w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-gray-50'

export function LocalizacaoSection({ data }: { data?: Record<string, string> }) {
  return (
    <div className="space-y-5">
      <h2 className="font-semibold text-gray-900">Localização</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Cidade</label>
          <input name="city" defaultValue={data?.city} placeholder="Curitiba" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Estado</label>
          <input name="state" defaultValue={data?.state} placeholder="PR" maxLength={2} className={inputClass} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">País</label>
        <input name="country" defaultValue={data?.country ?? 'BR'} placeholder="BR" className={inputClass} />
      </div>
    </div>
  )
}
