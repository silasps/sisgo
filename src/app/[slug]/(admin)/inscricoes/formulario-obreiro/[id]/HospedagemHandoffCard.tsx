'use client'

import { useMemo, useState, useTransition } from 'react'
import { criarAlocacaoObreiro } from './actions'

type Bed = { id: string; label: string; status: string }
type Room = { id: string; name: string; floor: string | null; allocation_mode: string; beds: Bed[] }

type Props = {
  slug: string
  organizationId: string
  ministryId: string | null
  staffApplicationId: string
  personId: string | null
  guestName: string
  rooms: Room[]
}

export function HospedagemHandoffCard({ slug, organizationId, ministryId, staffApplicationId, personId, guestName, rooms }: Props) {
  const [roomId, setRoomId] = useState('')
  const [bedId, setBedId] = useState('')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [notes, setNotes] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const room = useMemo(() => rooms.find(r => r.id === roomId), [rooms, roomId])
  const needsBed = room?.allocation_mode === 'cama'
  const availableBeds = room?.beds.filter(b => b.status === 'disponivel') ?? []

  function submit() {
    setError('')
    if (!roomId || !checkIn || !checkOut || (needsBed && !bedId)) {
      setError('Preencha quarto, cama (se aplicável) e datas.')
      return
    }
    startTransition(async () => {
      try {
        await criarAlocacaoObreiro({
          slug, organizationId, ministryId, staffApplicationId, personId,
          guestName, roomId, bedId: needsBed ? bedId : null,
          checkIn, checkOut, notes: notes || null,
        })
        setDone(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível criar a alocação.')
      }
    })
  }

  if (done) {
    return <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">Alocação de hospedagem criada com sucesso.</p>
  }

  if (rooms.length === 0) {
    return <p className="text-xs text-gray-400">Nenhum quarto ativo disponível nesta organização.</p>
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Defina onde e quando {guestName} vai chegar.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Quarto</label>
          <select value={roomId} onChange={e => { setRoomId(e.target.value); setBedId('') }}
            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm">
            <option value="">Selecione…</option>
            {rooms.map(r => (
              <option key={r.id} value={r.id}>{r.name}{r.floor ? ` — ${r.floor}` : ''}</option>
            ))}
          </select>
        </div>
        {needsBed && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cama</label>
            <select value={bedId} onChange={e => setBedId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm">
              <option value="">Selecione…</option>
              {availableBeds.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
            {room && availableBeds.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">Nenhuma cama disponível neste quarto.</p>
            )}
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Chegada</label>
          <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Saída prevista</label>
          <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Quem vai receber / observações</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            placeholder="Ex.: Fulano vai buscar no aeroporto às 14h"
            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm" />
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button type="button" onClick={submit} disabled={isPending}
        className="text-sm px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50">
        {isPending ? 'Salvando…' : 'Criar alocação'}
      </button>
    </div>
  )
}
