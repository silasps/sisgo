'use client'

import { useState } from 'react'
import { SearchableSelectModal } from '@/components/ui/SearchableSelectModal'
import { MoveTypeFields } from '@/components/processos/MoveTypeFields'

export type StaffRequestOption = {
  id: string
  label: string
  /** Escola/ministério onde a pessoa já serve — o pedido vai pro líder de lá. */
  servesIn: string | null
}

// Seletor de pessoa do "Solicitar adição" do líder e do "Adicionar" do DH
// (escola/ministério). Quem já serve em outra unidade não entra direto: vira
// pedido pro líder atual dessa pessoa responder e pro DH dar o OK final (ver
// requestStaffForUnit em lib/staff-loans.ts) — e aí quem pede escolhe o tipo
// (acúmulo de funções ou transferência), por isso esses campos só aparecem
// nesse caso.
export function StaffRequestPersonField({ options, inputClassName, todayStr }: {
  options: StaffRequestOption[]
  inputClassName: string
  todayStr: string
}) {
  const [selectedId, setSelectedId] = useState('')
  const selected = options.find(o => o.id === selectedId)

  return (
    <>
      <SearchableSelectModal
        name="person_id"
        options={options.map(o => ({ id: o.id, label: o.label, sublabel: o.servesIn ? `Serve em: ${o.servesIn}` : undefined }))}
        placeholder="Selecionar pessoa..."
        searchPlaceholder="Buscar por nome..."
        title="Selecionar pessoa"
        onChange={setSelectedId}
      />
      {selected?.servesIn && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 space-y-2">
          <p className="text-xs text-purple-900">
            <strong>{selected.label}</strong> já serve em <strong>{selected.servesIn}</strong>. O pedido vai para o líder
            de lá responder, e o DH dá o OK final. Como vai ser?
          </p>
          {/* key: trocar de pessoa volta o tipo e as datas pro padrão */}
          <MoveTypeFields key={selected.id} fromName={selected.servesIn} todayStr={todayStr} inputClassName={inputClassName} />
        </div>
      )}
    </>
  )
}
