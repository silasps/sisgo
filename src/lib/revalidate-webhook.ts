import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Dispara (fire-and-forget) a revalidação nos sites institucionais
 * registrados pra uma organização, depois de uma mutação pública
 * relevante (escola/turma publicada ou editada). Não bloqueia a Server
 * Action que chamou — falha de rede num site não deve quebrar o SISGO.
 */
export async function triggerSiteRevalidation(organizationId: string, tag: string) {
  const sb = createAdminClient()
  const { data: tokens } = await sb
    .from('organization_api_tokens')
    .select('revalidate_webhook_url, revalidate_secret')
    .eq('organization_id', organizationId)
    .is('revoked_at', null)

  for (const { revalidate_webhook_url, revalidate_secret } of tokens ?? []) {
    if (!revalidate_webhook_url) continue
    const url = new URL(revalidate_webhook_url)
    url.searchParams.set('tag', tag)
    if (revalidate_secret) url.searchParams.set('secret', revalidate_secret)
    fetch(url.toString(), { method: 'POST' }).catch(() => {
      // best-effort — o site consumidor continua servindo dado em cache até o próximo fetch revalidar
    })
  }
}
