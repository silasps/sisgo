'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Completa o que falta no cadastro de quem entrou pela primeira vez com um
// perfil mínimo (ex.: "Criar obreiro" em Obreiros só pede nome + e-mail) —
// ver checagem de telefone em page.tsx, que decide se essa etapa aparece.
export async function completarCadastroInicial(formData: FormData): Promise<{ error: string } | { ok: true }> {
  const phone = ((formData.get('phone') as string) ?? '').replace(/\D/g, '')
  if (phone.length < 10 || phone.length > 13) return { error: 'Telefone inválido — use DDD + número.' }
  const birthDate = (formData.get('birth_date') as string) || null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessão expirada — faça login novamente.' }

  const db = createAdminClient()
  const { data: profiles } = await db.from('staff_profiles').select('person_id').eq('user_id', user.id)
  const personId = profiles?.[0]?.person_id
  if (!personId) return { error: 'Perfil não encontrado.' }

  const { data: existing } = await db.from('person_contacts')
    .select('id').eq('person_id', personId).eq('type', 'whatsapp').maybeSingle()
  if (existing) {
    await db.from('person_contacts').update({ value: phone, is_primary: true }).eq('id', existing.id)
  } else {
    await db.from('person_contacts').insert({ person_id: personId, type: 'whatsapp', value: phone, is_primary: true })
  }

  if (birthDate) {
    await db.from('people').update({ birth_date: birthDate }).eq('id', personId)
  }

  return { ok: true }
}
