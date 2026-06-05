'use server'

import { createClient } from '@/lib/supabase/server'

type PreRegistrationInput = {
  orgId: string
  schoolId: string
  classId: string | null
  fullName: string
  email: string
  phone: string | null
  message: string | null
}

export async function submitPreRegistration(input: PreRegistrationInput): Promise<{ success: boolean; error?: string }> {
  if (!input.fullName?.trim() || !input.email?.trim()) {
    return { success: false, error: 'Nome e e-mail são obrigatórios.' }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(input.email)) {
    return { success: false, error: 'E-mail inválido.' }
  }

  const supabase = await createClient()

  const { error } = await supabase.from('school_interest_forms').insert({
    organization_id: input.orgId,
    school_id: input.schoolId,
    class_id: input.classId || null,
    full_name: input.fullName.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim() || null,
    message: input.message?.trim() || null,
    status: 'pendente',
  })

  if (error) {
    console.error('Pre-registration error:', error)
    return { success: false, error: 'Não foi possível registrar. Tente novamente.' }
  }

  return { success: true }
}
