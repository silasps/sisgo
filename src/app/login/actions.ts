'use server'

import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error || !data.session) return { error: 'E-mail ou senha inválidos.' }

  const { data: orgUser, error: orgError } = await supabase
    .from('organization_users')
    .select('roles(name), organization_id')
    .eq('user_id', data.user.id)
    .eq('active', true)
    .single()

  if (orgError || !orgUser) {
    return { error: orgError?.message ?? 'Usuário sem acesso configurado. Contate o administrador.' }
  }

  const role = (orgUser.roles as unknown as { name: string } | null)?.name

  if (role === 'superadmin') return { redirectTo: '/superadmin' }

  // Para todos os outros roles: redirecionar para a org do usuário
  const orgId = (orgUser as unknown as { organization_id: string | null }).organization_id
  if (!orgId) return { error: 'Organização não configurada. Contate o administrador.' }

  const { data: org } = await supabase
    .from('organizations')
    .select('slug')
    .eq('id', orgId)
    .single()

  if (!org?.slug) return { error: 'Organização não encontrada. Contate o administrador.' }

  return { redirectTo: `/${org.slug}/pessoas` }
}

export async function register(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const name = formData.get('name') as string

  if (password.length < 6) return { error: 'A senha precisa ter pelo menos 6 caracteres.' }

  const { data: signUpData, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  })

  if (error) {
    if (error.message.includes('already registered')) return { error: 'Este e-mail já está cadastrado.' }
    return { error: error.message }
  }

  const needsEmailConfirm = !signUpData?.session
  return { success: true, needsEmailConfirm }
}
