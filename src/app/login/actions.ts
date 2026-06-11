'use server'

import { createClient } from '@/lib/supabase/server'

type AuthLikeError = {
  message?: string
  name?: string
  status?: number
  code?: string
}

function toAuthLikeError(error: unknown): AuthLikeError {
  if (error instanceof Error) {
    const withStatus = error as Error & { status?: number; code?: string }
    return {
      message: error.message,
      name: error.name,
      status: withStatus.status,
      code: withStatus.code,
    }
  }

  if (typeof error === 'object' && error !== null) return error as AuthLikeError
  return { message: String(error) }
}

function isConnectionError(error: AuthLikeError | null | undefined) {
  const message = error?.message?.toLowerCase() ?? ''
  const name = error?.name?.toLowerCase() ?? ''
  const code = error?.code?.toLowerCase() ?? ''

  return (
    error?.status === 0 ||
    name.includes('retryable') ||
    message.includes('fetch failed') ||
    message.includes('timeout') ||
    message.includes('network') ||
    message.includes('connect timeout') ||
    code.includes('und_err_connect_timeout')
  )
}

function authErrorMessage(error: AuthLikeError | null | undefined, fallback: string) {
  if (isConnectionError(error)) {
    return 'Não foi possível conectar ao servidor de autenticação. Verifique sua internet, VPN/firewall ou tente novamente em instantes.'
  }

  return fallback
}

export async function login(formData: FormData) {
  const supabase = await createClient()

  let authResult
  try {
    authResult = await supabase.auth.signInWithPassword({
      email: String(formData.get('email') ?? '').trim(),
      password: formData.get('password') as string,
    })
  } catch (error) {
    return { error: authErrorMessage(toAuthLikeError(error), 'E-mail ou senha inválidos.') }
  }

  const { data, error } = authResult

  if (error) return { error: authErrorMessage(error, 'E-mail ou senha inválidos.') }
  if (!data.session) return { error: 'E-mail ou senha inválidos.' }

  const { data: orgUsers, error: orgError } = await supabase
    .from('organization_users')
    .select('roles(name), organization_id')
    .eq('user_id', data.user.id)
    .eq('active', true)

  if (orgError || !orgUsers?.length) {
    return { error: orgError?.message ?? 'Usuário sem acesso configurado. Contate o administrador.' }
  }

  const rows = orgUsers as unknown as Array<{ organization_id: string | null; roles: { name: string } | null }>
  const roleNames = rows.map(row => row.roles?.name).filter(Boolean)

  if (roleNames.includes('superadmin')) return { redirectTo: '/superadmin' }
  if (roleNames.includes('supervisor_bases')) return { redirectTo: '/supervisor' }

  // Para todos os outros roles: redirecionar para a org do usuário
  const orgId = rows.find(row => row.organization_id)?.organization_id
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

  const email = String(formData.get('email') ?? '').trim()
  const password = formData.get('password') as string
  const name = formData.get('name') as string

  if (password.length < 6) return { error: 'A senha precisa ter pelo menos 6 caracteres.' }

  let signUpResult
  try {
    signUpResult = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })
  } catch (error) {
    return {
      error: authErrorMessage(
        toAuthLikeError(error),
        'Não foi possível criar a conta agora. Tente novamente em instantes.'
      ),
    }
  }

  const { data: signUpData, error } = signUpResult

  if (error) {
    if (isConnectionError(error)) return { error: authErrorMessage(error, error.message) }
    if (error.message.includes('already registered')) return { error: 'Este e-mail já está cadastrado.' }
    return { error: error.message }
  }

  const needsEmailConfirm = !signUpData?.session
  return { success: true, needsEmailConfirm }
}
