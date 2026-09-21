// Lembra o último valor de campos "de padrão" (tipo, gênero, destino, modo de
// alocação) só por uma janela curta — pensado pra cadastrar vários itens
// parecidos em sequência sem reconfigurar tudo de novo a cada um. Passado o
// tempo, assume que a sessão de cadastro acabou e volta pro valor padrão de
// sempre. Em memória (não localStorage): não precisa sobreviver a um reload.
const TTL_MS = 5 * 60 * 1000

const store = new Map<string, { value: string; at: number }>()

export function rememberValue(key: string, value: string) {
  store.set(key, { value, at: Date.now() })
}

export function recallValue(key: string, fallback: string): string {
  const entry = store.get(key)
  if (!entry) return fallback
  if (Date.now() - entry.at > TTL_MS) {
    store.delete(key)
    return fallback
  }
  return entry.value
}
