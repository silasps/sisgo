'use server'

import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error || !data.session) {
    return { error: 'E-mail ou senha inválidos.' }
  }

  // Busca o papel do usuário para redirecionar para o painel correto
  const { data: orgUser } = await supabase
    .from('organization_users')
    .select('roles(name)')
    .eq('user_id', data.user.id)
    .eq('active', true)
    .single()

  const role = (orgUser?.roles as unknown as { name: string } | null)?.name
  const redirectTo = role === 'superadmin' ? '/superadmin' : '/admin'

  return { redirectTo }
}
