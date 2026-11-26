import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateShortLink } from '@/lib/shortLinks'
import type { UnitRef } from '@/lib/staff-loans'

/**
 * Caminho do formulário de inscrição de obreiro pra divulgar a partir do
 * Quadro de Obreiros. Ministério com página pública (is_public + slug) usa o
 * formulário dele; sem página pública — a maioria — cai no formulário geral
 * /servir com a unidade já escolhida, que não depende de página pública.
 * Escola vai sempre pro geral com a escola escolhida: a inscrição chega pra
 * ela, não pro ministério vinculado.
 */
export async function getStaffSignupPath(slug: string, unit: UnitRef): Promise<string> {
  if (unit.type === 'ministry') {
    const { data: m } = await createAdminClient().from('ministries')
      .select('slug, is_public').eq('id', unit.id).maybeSingle()
    if (m?.is_public && m.slug) return `/${slug}/servir/${m.slug}/inscricao`
  }
  return `/${slug}/servir?destino=${unit.type}:${unit.id}`
}

/** Link curto (o mesmo sempre, pra mesma unidade) do formulário de inscrição. */
export async function getStaffSignupLink(params: {
  orgId: string
  slug: string
  unit: UnitRef
  createdBy: string | null
}): Promise<string> {
  return getOrCreateShortLink({
    organizationId: params.orgId,
    targetPath: await getStaffSignupPath(params.slug, params.unit),
    createdBy: params.createdBy,
  })
}
