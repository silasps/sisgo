import type { createAdminClient } from '@/lib/supabase/admin'

type ApplicationTable = 'school_applications' | 'staff_applications'

// Devolve o link do formulário pra reenviar ao candidato — se o token ainda
// for válido, devolve o mesmo (o formulário já preenchido continua lá, a
// pessoa só termina de onde parou); se expirou, gera um novo token/prazo de
// 30 dias na mesma linha, sem apagar nada do que já foi respondido.
// Compartilhado entre o fluxo de escola (school_applications) e o de
// obreiro (staff_applications) — as duas tabelas têm token/token_expires_at
// no mesmo formato. A checagem de permissão é responsabilidade de quem
// chama, não deste helper.
export async function getOrRegenerateToken(
  sb: ReturnType<typeof createAdminClient>,
  table: ApplicationTable,
  applicationId: string,
  organizationId: string,
): Promise<{ token: string } | { error: string }> {
  const { data: app } = await sb
    .from(table)
    .select('id, token, token_expires_at')
    .eq('id', applicationId)
    .eq('organization_id', organizationId)
    .single()
  if (!app) return { error: 'Inscrição não encontrada.' }

  if (new Date(app.token_expires_at as string) > new Date()) {
    return { token: app.token as string }
  }

  const { randomBytes } = await import('crypto')
  const token = randomBytes(32).toString('hex')
  const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  await sb.from(table).update({ token, token_expires_at: tokenExpiresAt }).eq('id', app.id as string)

  return { token }
}
