import { createClient } from '@/lib/supabase/server'
import { isManagementRole } from '@/lib/auth/permissions'

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>

// Criar escola é restrito à gestão (isManagementRole) + uma lista de
// delegados pontuais que o líder da base escolhe em Configurações
// (school_creation_delegates, migration 137) — evita que qualquer obreiro
// crie escola e bagunce a organização, mas sem travar exceções legítimas.
export async function canCreateSchool(
  supabase: ServerSupabaseClient,
  userId: string,
  orgId: string,
  role: string,
): Promise<boolean> {
  if (isManagementRole(role)) return true
  const { data } = await supabase
    .from('school_creation_delegates')
    .select('id')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .maybeSingle()
  return !!data
}
