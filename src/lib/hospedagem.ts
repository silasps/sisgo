// room_allocations.check_out é obrigatório no banco — não dá pra representar
// "sem previsão de saída" com NULL. Usamos uma data-sentinela bem distante
// (obreiros costumam ser permanentes; a saída real é ajustada depois, no
// desligamento/transferência, pela própria tela de quartos). A hospitalidade
// nunca deve ficar travada por falta dessa informação.
export const INDEFINITE_CHECKOUT = '2099-12-31'

export function isIndefiniteCheckout(date: string | null | undefined) {
  return date === INDEFINITE_CHECKOUT
}
