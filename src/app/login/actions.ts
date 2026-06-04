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
    .select('roles(name)')
    .eq('user_id', data.user.id)
    .eq('active', true)
    .single()

  if (orgError || !orgUser) {
    //return { error: 'Usuário sem acesso configurado. Contate o administrador.' }
    return { error: orgError?.message ?? 'Usuário sem acesso configurado.' }
  }

  const role = (orgUser.roles as unknown as { name: string } | null)?.name

  if (role === 'superadmin') return { redirectTo: '/superadmin' }
  if (role === 'admin_base') return { redirectTo: '/admin' }

  return { error: 'Perfil de acesso não reconhecido. Contate o administrador.' }
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

  // Se session != null, o Supabase está com confirmação de e-mail desabilitada (auto-confirm)
  const needsEmailConfirm = !signUpData?.session
  return { success: true, needsEmailConfirm }
}
