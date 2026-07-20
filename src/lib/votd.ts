const BOOKS = {
  gen: { usfm: 'GEN', label: 'Gênesis' },
  exo: { usfm: 'EXO', label: 'Êxodo' },
  deu: { usfm: 'DEU', label: 'Deuteronômio' },
  jos: { usfm: 'JOS', label: 'Josué' },
  '1sa': { usfm: '1SA', label: '1 Samuel' },
  '1ch': { usfm: '1CH', label: '1 Crônicas' },
  neh: { usfm: 'NEH', label: 'Neemias' },
  job: { usfm: 'JOB', label: 'Jó' },
  psa: { usfm: 'PSA', label: 'Salmos' },
  pro: { usfm: 'PRO', label: 'Provérbios' },
  ecc: { usfm: 'ECC', label: 'Eclesiastes' },
  isa: { usfm: 'ISA', label: 'Isaías' },
  jer: { usfm: 'JER', label: 'Jeremias' },
  lam: { usfm: 'LAM', label: 'Lamentações' },
  ezk: { usfm: 'EZK', label: 'Ezequiel' },
  jol: { usfm: 'JOL', label: 'Joel' },
  mic: { usfm: 'MIC', label: 'Miqueias' },
  nam: { usfm: 'NAM', label: 'Naum' },
  hab: { usfm: 'HAB', label: 'Habacuque' },
  zep: { usfm: 'ZEP', label: 'Sofonias' },
  mal: { usfm: 'MAL', label: 'Malaquias' },
  mat: { usfm: 'MAT', label: 'Mateus' },
  mrk: { usfm: 'MRK', label: 'Marcos' },
  luk: { usfm: 'LUK', label: 'Lucas' },
  jhn: { usfm: 'JHN', label: 'João' },
  act: { usfm: 'ACT', label: 'Atos' },
  rom: { usfm: 'ROM', label: 'Romanos' },
  '1co': { usfm: '1CO', label: '1 Coríntios' },
  '2co': { usfm: '2CO', label: '2 Coríntios' },
  gal: { usfm: 'GAL', label: 'Gálatas' },
  eph: { usfm: 'EPH', label: 'Efésios' },
  php: { usfm: 'PHP', label: 'Filipenses' },
  col: { usfm: 'COL', label: 'Colossenses' },
  '1th': { usfm: '1TH', label: '1 Tessalonicenses' },
  '2ti': { usfm: '2TI', label: '2 Timóteo' },
  heb: { usfm: 'HEB', label: 'Hebreus' },
  jas: { usfm: 'JAS', label: 'Tiago' },
  '1pe': { usfm: '1PE', label: '1 Pedro' },
  '2pe': { usfm: '2PE', label: '2 Pedro' },
  '1jn': { usfm: '1JN', label: '1 João' },
  rev: { usfm: 'REV', label: 'Apocalipse' },
} as const

type BookKey = keyof typeof BOOKS

const VERSES: Array<{ book: BookKey; chapter: number; verse: number }> = [
  { book: 'gen', chapter: 1, verse: 1 },
  { book: 'gen', chapter: 1, verse: 27 },
  { book: 'gen', chapter: 12, verse: 2 },
  { book: 'exo', chapter: 14, verse: 14 },
  { book: 'exo', chapter: 20, verse: 12 },
  { book: 'deu', chapter: 6, verse: 5 },
  { book: 'deu', chapter: 31, verse: 6 },
  { book: 'jos', chapter: 1, verse: 9 },
  { book: 'jos', chapter: 24, verse: 15 },
  { book: '1sa', chapter: 16, verse: 7 },
  { book: '1ch', chapter: 16, verse: 11 },
  { book: 'neh', chapter: 8, verse: 10 },
  { book: 'job', chapter: 19, verse: 25 },
  { book: 'psa', chapter: 1, verse: 1 },
  { book: 'psa', chapter: 23, verse: 1 },
  { book: 'psa', chapter: 27, verse: 1 },
  { book: 'psa', chapter: 34, verse: 8 },
  { book: 'psa', chapter: 37, verse: 4 },
  { book: 'psa', chapter: 46, verse: 1 },
  { book: 'psa', chapter: 51, verse: 10 },
  { book: 'psa', chapter: 55, verse: 22 },
  { book: 'psa', chapter: 91, verse: 1 },
  { book: 'psa', chapter: 100, verse: 5 },
  { book: 'psa', chapter: 119, verse: 105 },
  { book: 'psa', chapter: 126, verse: 5 },
  { book: 'psa', chapter: 139, verse: 14 },
  { book: 'psa', chapter: 147, verse: 3 },
  { book: 'pro', chapter: 3, verse: 5 },
  { book: 'pro', chapter: 3, verse: 6 },
  { book: 'pro', chapter: 16, verse: 3 },
  { book: 'pro', chapter: 16, verse: 9 },
  { book: 'pro', chapter: 17, verse: 22 },
  { book: 'pro', chapter: 18, verse: 10 },
  { book: 'pro', chapter: 22, verse: 6 },
  { book: 'ecc', chapter: 3, verse: 1 },
  { book: 'isa', chapter: 26, verse: 3 },
  { book: 'isa', chapter: 40, verse: 31 },
  { book: 'isa', chapter: 41, verse: 10 },
  { book: 'isa', chapter: 43, verse: 2 },
  { book: 'isa', chapter: 53, verse: 5 },
  { book: 'isa', chapter: 55, verse: 8 },
  { book: 'isa', chapter: 55, verse: 11 },
  { book: 'jer', chapter: 29, verse: 11 },
  { book: 'jer', chapter: 33, verse: 3 },
  { book: 'lam', chapter: 3, verse: 22 },
  { book: 'ezk', chapter: 36, verse: 26 },
  { book: 'jol', chapter: 2, verse: 25 },
  { book: 'mic', chapter: 6, verse: 8 },
  { book: 'nam', chapter: 1, verse: 7 },
  { book: 'hab', chapter: 3, verse: 19 },
  { book: 'zep', chapter: 3, verse: 17 },
  { book: 'mal', chapter: 3, verse: 10 },
  { book: 'mat', chapter: 5, verse: 14 },
  { book: 'mat', chapter: 6, verse: 33 },
  { book: 'mat', chapter: 7, verse: 7 },
  { book: 'mat', chapter: 11, verse: 28 },
  { book: 'mat', chapter: 28, verse: 19 },
  { book: 'mat', chapter: 28, verse: 20 },
  { book: 'mrk', chapter: 9, verse: 23 },
  { book: 'mrk', chapter: 10, verse: 27 },
  { book: 'mrk', chapter: 11, verse: 24 },
  { book: 'luk', chapter: 1, verse: 37 },
  { book: 'luk', chapter: 6, verse: 38 },
  { book: 'luk', chapter: 11, verse: 9 },
  { book: 'jhn', chapter: 1, verse: 1 },
  { book: 'jhn', chapter: 3, verse: 16 },
  { book: 'jhn', chapter: 8, verse: 32 },
  { book: 'jhn', chapter: 10, verse: 10 },
  { book: 'jhn', chapter: 11, verse: 25 },
  { book: 'jhn', chapter: 13, verse: 34 },
  { book: 'jhn', chapter: 14, verse: 6 },
  { book: 'jhn', chapter: 14, verse: 27 },
  { book: 'jhn', chapter: 15, verse: 5 },
  { book: 'jhn', chapter: 16, verse: 33 },
  { book: 'act', chapter: 1, verse: 8 },
  { book: 'act', chapter: 16, verse: 31 },
  { book: 'rom', chapter: 5, verse: 8 },
  { book: 'rom', chapter: 8, verse: 1 },
  { book: 'rom', chapter: 8, verse: 28 },
  { book: 'rom', chapter: 8, verse: 31 },
  { book: 'rom', chapter: 8, verse: 37 },
  { book: 'rom', chapter: 10, verse: 9 },
  { book: 'rom', chapter: 12, verse: 2 },
  { book: 'rom', chapter: 12, verse: 12 },
  { book: '1co', chapter: 10, verse: 13 },
  { book: '1co', chapter: 13, verse: 4 },
  { book: '1co', chapter: 13, verse: 13 },
  { book: '1co', chapter: 16, verse: 14 },
  { book: '2co', chapter: 4, verse: 16 },
  { book: '2co', chapter: 5, verse: 7 },
  { book: '2co', chapter: 5, verse: 17 },
  { book: '2co', chapter: 9, verse: 7 },
  { book: '2co', chapter: 12, verse: 9 },
  { book: 'gal', chapter: 5, verse: 22 },
  { book: 'gal', chapter: 6, verse: 9 },
  { book: 'eph', chapter: 2, verse: 8 },
  { book: 'eph', chapter: 2, verse: 10 },
  { book: 'eph', chapter: 3, verse: 20 },
  { book: 'eph', chapter: 4, verse: 32 },
  { book: 'eph', chapter: 6, verse: 10 },
  { book: 'php', chapter: 1, verse: 6 },
  { book: 'php', chapter: 4, verse: 6 },
  { book: 'php', chapter: 4, verse: 7 },
  { book: 'php', chapter: 4, verse: 13 },
  { book: 'php', chapter: 4, verse: 19 },
  { book: 'col', chapter: 3, verse: 23 },
  { book: '1th', chapter: 5, verse: 16 },
  { book: '1th', chapter: 5, verse: 18 },
  { book: '2ti', chapter: 1, verse: 7 },
  { book: '2ti', chapter: 4, verse: 7 },
  { book: 'heb', chapter: 4, verse: 16 },
  { book: 'heb', chapter: 11, verse: 1 },
  { book: 'heb', chapter: 12, verse: 1 },
  { book: 'heb', chapter: 13, verse: 5 },
  { book: 'jas', chapter: 1, verse: 2 },
  { book: 'jas', chapter: 1, verse: 5 },
  { book: 'jas', chapter: 1, verse: 17 },
  { book: 'jas', chapter: 4, verse: 7 },
  { book: '1pe', chapter: 5, verse: 7 },
  { book: '2pe', chapter: 1, verse: 3 },
  { book: '1jn', chapter: 1, verse: 9 },
  { book: '1jn', chapter: 4, verse: 18 },
  { book: '1jn', chapter: 4, verse: 19 },
  { book: 'rev', chapter: 3, verse: 20 },
  { book: 'rev', chapter: 21, verse: 4 },
]

const FALLBACK_TEXT = 'Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.'
const FALLBACK_VERSE = VERSES.find(v => v.book === 'jhn' && v.chapter === 3 && v.verse === 16)!

/** Bíblia YouVersion (bible.com), versão NVI. */
const YOUVERSION_VERSION_ID = 129

function dayOfYear(date: Date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1)
  const today = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  return Math.floor((today - start) / 86_400_000)
}

function pickVerseForDate(date: Date) {
  return VERSES[dayOfYear(date) % VERSES.length]
}

export type VerseOfDay = {
  reference: string
  text: string
  youversionUrl: string
}

export async function getVerseOfDay(date = new Date()): Promise<VerseOfDay> {
  const picked = pickVerseForDate(date)
  const book = BOOKS[picked.book]
  const reference = `${book.label} ${picked.chapter}:${picked.verse}`
  const youversionUrl = `https://www.bible.com/bible/${YOUVERSION_VERSION_ID}/${book.usfm}.${picked.chapter}.${picked.verse}`

  try {
    // A busca por referência única do bible-api.com (`/{livro} {cap}:{vers}`) falha
    // para várias combinações válidas na tradução "almeida" (bug deles) — buscamos
    // o capítulo inteiro e extraímos o versículo, que é confiável.
    const res = await fetch(`https://bible-api.com/data/almeida/${book.usfm}/${picked.chapter}`, {
      next: { revalidate: 60 * 60 * 12 },
    })
    if (!res.ok) throw new Error('votd fetch failed')
    const data = await res.json() as { verses?: Array<{ verse: number; text: string }> }
    const text = data.verses?.find(v => v.verse === picked.verse)?.text?.trim().replace(/\s+/g, ' ')
    if (!text) throw new Error('votd empty text')
    return { reference, text, youversionUrl }
  } catch {
    const fallbackBook = BOOKS[FALLBACK_VERSE.book]
    return {
      reference: picked === FALLBACK_VERSE ? reference : `${fallbackBook.label} ${FALLBACK_VERSE.chapter}:${FALLBACK_VERSE.verse}`,
      text: FALLBACK_TEXT,
      youversionUrl: picked === FALLBACK_VERSE ? youversionUrl : `https://www.bible.com/bible/${YOUVERSION_VERSION_ID}/${fallbackBook.usfm}.${FALLBACK_VERSE.chapter}.${FALLBACK_VERSE.verse}`,
    }
  }
}
