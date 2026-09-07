'use server'

import { randomUUID } from 'crypto'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { slugify } from '@/lib/slugify'
import { sendOrgSignupVerificationEmail } from '@/lib/email/sendOrgSignupVerificationEmail'

export type WizardPayload = {
  org_name?: string
  org_type?: string
  website?: string
  phone?: string
  city?: string
  state?: string
  country?: string
  responsavel_nome?: string
  responsavel_cargo?: string
  responsavel_email?: string
  responsavel_senha?: string
  responsavel_senha_confirma?: string
  plan_id?: string
  hp_field?: string
}

const MAX_ATTEMPTS_PER_HOUR = 5
const TRIAL_DAYS = 30
const VERIFICATION_DAYS = 7

async function getClientIp() {
  const hdrs = await headers()
  return hdrs.get('x-forwarded-for')?.split(',')[0]?.trim()
    || hdrs.get('x-real-ip')
    || 'unknown'
}

async function uniqueSlug(admin: ReturnType<typeof createAdminClient>, base: string) {
  let slug = base
  let suffix = 1
  for (;;) {
    const { data } = await admin.from('organizations').select('id').eq('slug', slug).maybeSingle()
    if (!data) return slug
    suffix += 1
    slug = `${base}-${suffix}`
  }
}

export async function criarOrganizacaoWizard(payload: WizardPayload): Promise<{ error?: string; redirectTo?: string }> {
  // Honeypot — bots que preenchem todos os campos caem aqui
  if (payload.hp_field) {
    return { error: 'Não foi possível processar seu cadastro. Tente novamente.' }
  }

  const orgName = payload.org_name?.trim()
  if (!orgName) return { error: 'Informe o nome da organização.' }
  if (!payload.plan_id) return { error: 'Selecione um plano.' }

  const supabase = await createClient()
  const admin = createAdminClient()
  const ip = await getClientIp()

  // Rate limiting básico — sem infra externa disponível hoje
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await admin
    .from('signup_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .gt('created_at', oneHourAgo)

  if ((count ?? 0) >= MAX_ATTEMPTS_PER_HOUR) {
    return { error: 'Muitas tentativas de cadastro. Tente novamente em algumas horas.' }
  }

  const { data: { user: sessionUser } } = await supabase.auth.getUser()

  let userId: string
  let responsavelEmail: string
  let responsavelSenha: string | undefined

  if (sessionUser) {
    userId = sessionUser.id
    responsavelEmail = sessionUser.email ?? ''
  } else {
    const nome = payload.responsavel_nome?.trim()
    const email = payload.responsavel_email?.trim().toLowerCase()
    const senha = payload.responsavel_senha
    if (!nome || !email || !senha) return { error: 'Preencha os dados do responsável.' }
    if (senha.length < 6) return { error: 'A senha precisa ter pelo menos 6 caracteres.' }
    if (senha !== payload.responsavel_senha_confirma) return { error: 'As senhas não coincidem.' }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: senha,
      user_metadata: { full_name: nome },
      email_confirm: true,
    })

    if (createError || !created.user) {
      if (createError?.message?.toLowerCase().includes('already registered')) {
        return { error: 'Este e-mail já tem uma conta. Faça login antes de criar sua organização.' }
      }
      return { error: createError?.message ?? 'Não foi possível criar sua conta agora.' }
    }

    userId = created.user.id
    responsavelEmail = email
    responsavelSenha = senha
  }

  const slug = await uniqueSlug(admin, slugify(orgName))
  const signupToken = randomUUID()

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({
      name: orgName,
      slug,
      city: payload.city?.trim() || null,
      state: payload.state?.trim() || null,
      country: payload.country?.trim() || 'BR',
      phone: payload.phone?.trim() || null,
      email: responsavelEmail || null,
      website: payload.website?.trim() || null,
      org_type: payload.org_type || 'missao',
      plan_id: payload.plan_id,
      trial_ends_at: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      active: true,
      contact_email_verified: false,
      signup_verification_token: signupToken,
      signup_verification_expires_at: new Date(Date.now() + VERIFICATION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('id, slug')
    .single()

  if (orgError || !org) {
    return { error: 'Não foi possível criar sua organização agora. Tente novamente.' }
  }

  const { data: role } = await admin.from('roles').select('id').eq('name', 'admin_base').single()

  await admin.from('organization_users').insert({
    user_id: userId,
    organization_id: org.id,
    role_id: role?.id,
    title: payload.responsavel_cargo?.trim() || null,
    active: true,
  })

  await admin.from('signup_attempts').insert({ ip, email: responsavelEmail })

  const verifyUrl = `${await siteUrl()}/verificar-cadastro/${signupToken}`
  await sendOrgSignupVerificationEmail({ to: responsavelEmail, orgName, verifyUrl }).catch(() => {})

  // Se criamos a conta agora (sem sessão prévia), autentica o usuário para já entrar logado
  if (!sessionUser && responsavelSenha) {
    await supabase.auth.signInWithPassword({ email: responsavelEmail, password: responsavelSenha }).catch(() => {})
  }

  return { redirectTo: `/${org.slug}/pessoas` }
}

async function siteUrl() {
  const hdrs = await headers()
  const host = hdrs.get('x-forwarded-host') || hdrs.get('host') || 'localhost:3000'
  const proto = hdrs.get('x-forwarded-proto')?.split(',')[0]?.trim() || (host.includes('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}
