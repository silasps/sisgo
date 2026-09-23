// Busca com tolerância a erro de digitação, sem dependência externa —
// usada pelas listas client-side de Pessoas e Obreiros. Retorna um score
// (menor = melhor) pra dar prioridade a match exato/prefixo sobre match
// aproximado, em vez de só filtrar sem ordenar por relevância.

export function normalize(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

// Levenshtein simples — o bastante pra tolerar 1 erro de digitação sem
// precisar de lib externa. Tolerância maior colide com sobrenomes comuns
// em português (ex. "silas" x "silva" já é distância 2).
function levenshtein(a: string, b: string) {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i++) dp[i][0] = i
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[a.length][b.length]
}

function maxDistFor(queryLength: number) {
  return queryLength <= 9 ? 1 : 2
}

/** Score de match pra um único campo — null quando não bate, menor é melhor. */
function fieldScore(query: string, text: string | null | undefined): number | null {
  if (!text) return null
  const q = normalize(query)
  const t = normalize(text)
  if (!q) return 0
  if (t === q) return 0
  if (t.startsWith(q)) return 1
  if (t.includes(q)) return 2
  const maxDist = maxDistFor(q.length)
  let best: number | null = null
  for (const word of t.split(/\s+/)) {
    const d = levenshtein(q, word.slice(0, q.length + maxDist))
    if (d <= maxDist && (best === null || d < best)) best = d
  }
  return best === null ? null : 3 + best
}

/** Melhor score entre vários campos de uma linha — null quando nenhum campo bate. */
export function bestScore(query: string, texts: Array<string | null | undefined>): number | null {
  let best: number | null = null
  for (const text of texts) {
    const score = fieldScore(query, text)
    if (score !== null && (best === null || score < best)) best = score
  }
  return best
}

export function fuzzyMatchAny(query: string, texts: Array<string | null | undefined>) {
  if (!query.trim()) return true
  return bestScore(query, texts) !== null
}
