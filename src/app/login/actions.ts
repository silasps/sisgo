'use server'

import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error || !data.session) return { error: 'E-mail ou senha inválidos.' }

  const { data: orgUser } = await supabase
    .from('organization_users')
    .select('roles(name), organizations(slug)')
    .eq('user_id', data.user.id)
    .eq('active', true)
    .single()

  const role = (orgUser?.roles as unknown as { name: string } | null)?.name
  const slug = (orgUser?.organizations as unknown as { slug: string } | null)?.slug

  if (role === 'superadmin') return { redirectTo: '/superadmin' }
  if (slug) return { redirectTo: `/${slug}` }

  return { redirectTo: '/login?error=sem-acesso' }
}

export async function register(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const name = formData.get('name') as string

  if (password.length < 6) return { error: 'A senha precisa ter pelo menos 6 caracteres.' }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  })

  if (error) {
    if (error.message.includes('already registered')) return { error: 'Este e-mail já está cadastrado.' }
    return { error: error.message }
  }

  return { success: true }
}
