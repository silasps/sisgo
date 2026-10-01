/** Quarto com vaga na janela da reserva (montado no servidor a partir de getAvailableRoomsAnyDestination). */
export type RoomOption = {
  id: string
  name: string
  place: string | null // "Bloco A · 1º andar"
  gender: string | null // masculino | feminino | misto
  totalBeds: number
  wholeRoomAvailable: boolean
  beds: { id: string; label: string }[] // camas livres na janela
}

export type RankedRoom = { room: RoomOption; free: number; mention: number }

export function normalize(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

// Quarto (ou bloco/andar) citado no texto do pedido — "quero o quarto 12",
// "no térreo" — sobe nas sugestões. `requested` já vem normalizado.
export function mentionScore(requested: string, room: RoomOption) {
  if (!requested) return 0
  const cited = (term: string) => {
    const t = normalize(term)
    if (t.length < 2) return false
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(requested)
  }
  if (cited(room.name)) return 2
  if (room.place?.split(' · ').some(cited)) return 1
  return 0
}

// Citado no pedido primeiro; depois quem cabe todo mundo, do mais justo pro
// mais folgado (não gasta quarto grande com 1 pessoa); por fim quem chega
// mais perto. Empate fica na ordem de exibição dos quartos.
export function rankRooms(rooms: RoomOption[], need: number, requested: string): RankedRoom[] {
  return rooms
    .map((room, index) => ({ room, index, free: room.beds.length, mention: mentionScore(requested, room) }))
    .sort((a, b) => {
      if (a.mention !== b.mention) return b.mention - a.mention
      const aFits = a.free >= need
      const bFits = b.free >= need
      if (aFits !== bFits) return aFits ? -1 : 1
      const diff = aFits ? (a.free - need) - (b.free - need) : b.free - a.free
      return diff || a.index - b.index
    })
    .map(({ room, free, mention }) => ({ room, free, mention }))
}

/** Até 3 sugestões: citados no pedido ou que cabem todo mundo; sem nenhum assim, os que chegam mais perto. */
export function suggestRooms(ranked: RankedRoom[], need: number): RankedRoom[] {
  const good = ranked.filter(r => r.mention > 0 || r.free >= need)
  return (good.length > 0 ? good : ranked).slice(0, 3)
}
