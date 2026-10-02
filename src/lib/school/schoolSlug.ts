'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { slugify } from '@/lib/slugify'

const VALID_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

export function isValidSlug(slug: string | null | undefined): slug is string {
  return !!slug && VALID_SLUG.test(slug)
}

async function generateUniqueSchoolSlug(
  db: ReturnType<typeof createAdminClient>, name: string, excludeSchoolId?: string,
): Promise<string> {
  const base = slugify(name) || 'escola'
  let candidate = base
  let suffix = 2
  // slug é unique GLOBAL na tabela schools (migration 003), não só por organização.
  for (;;) {
    let q = db.from('schools').select('id').eq('slug', candidate).limit(1)
    if (excludeSchoolId) q = q.neq('id', excludeSchoolId)
    const { data } = await q.maybeSingle()
    if (!data) return candidate
    candidate = `${base}-${suffix++}`
  }
}

// Garante que a escola tenha um slug válido, gerando a partir do nome quando
// estiver ausente ou malformado (dado antigo de quando o campo ainda era
// texto livre editável — ex: espaço, maiúscula). Um slug já válido NUNCA é
// trocado, mesmo que o nome mude depois — não quebra link já compartilhado.
// Se o slug antigo era malformado (presente mas inválido, não só ausente),
// também atualiza qualquer short_link que apontava pra ele, pro link já
// divulgado continuar funcionando em vez de ficar órfão.
export async function ensureSchoolSlug(params: {
  schoolId: string
  organizationId: string
  orgPathSlug: string
  name: string
  currentSlug: string | null
}): Promise<string> {
  if (isValidSlug(params.currentSlug)) return params.currentSlug

  const name = params.name.trim()
  if (!name) throw new Error('Defina o nome da escola antes de gerar o link público.')

  const db = createAdminClient()
  const newSlug = await generateUniqueSchoolSlug(db, name, params.schoolId)
  await db.from('schools').update({ slug: newSlug }).eq('id', params.schoolId)

  if (params.currentSlug) {
    const oldPath = `/${params.orgPathSlug}/escola/${params.currentSlug}`
    const newPath = `/${params.orgPathSlug}/escola/${newSlug}`
    await db.from('short_links').update({ target_url: newPath })
      .eq('organization_id', params.organizationId).eq('target_url', oldPath)
  }

  return newSlug
}
