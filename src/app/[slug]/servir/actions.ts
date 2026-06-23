'use server'

import { createAdminClient } from '@/lib/supabase/admin'

type StaffPreRegistrationInput = {
  slug: string
  ministryId: string | null
  fullName: string
  email: string
  phone: string | null
  phoneCountry: string | null
  language: string | null
  message: string | null
}

export async function submitStaffPreRegistration(
  input: StaffPreRegistrationInput,
): Promise<{ success: boolean; error?: string }> {
  if (!input.fullName?.trim() || !input.email?.trim()) {
    return { success: false, error: 'Nome e e-mail são obrigatórios.' }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(input.email)) {
    return { success: false, error: 'E-mail inválido.' }
  }

  const sb = createAdminClient()
  const email = input.email.trim().toLowerCase()

  const { data: org } = await sb
    .from('organizations')
    .select('id')
    .eq('slug', input.slug)
    .eq('active', true)
    .single()

  if (!org) return { success: false, error: 'Base não encontrada.' }

  if (input.ministryId) {
    const { data: ministry } = await sb
      .from('ministries')
      .select('id')
      .eq('id', input.ministryId)
      .eq('organization_id', org.id)
      .eq('active', true)
      .single()
    if (!ministry) return { success: false, error: 'Ministério não encontrado.' }
  }

  let personId: string | null = null

  const { data: existingPerson } = await sb
    .from('people')
    .select('id, person_contacts!inner(type, value)')
    .eq('organization_id', org.id)
    .eq('person_contacts.type', 'email')
    .eq('person_contacts.value', email)
    .maybeSingle()

  if (existingPerson) {
    personId = existingPerson.id
  } else {
    const { data: newPerson, error: personError } = await sb
      .from('people')
      .insert({ organization_id: org.id, full_name: input.fullName.trim(), source: 'pre_inscricao_obreiro' })
      .select('id')
      .single()

    if (personError?.code === 'PGRST204') {
      const { data: fallback, error: fbErr } = await sb
        .from('people')
        .insert({ organization_id: org.id, full_name: input.fullName.trim() })
        .select('id')
        .single()
      if (fbErr || !fallback) return { success: false, error: 'Não foi possível registrar. Tente novamente.' }
      personId = fallback.id
    } else if (personError || !newPerson) {
      return { success: false, error: 'Não foi possível registrar. Tente novamente.' }
    } else {
      personId = newPerson.id
    }

    const contacts: { person_id: string; type: string; value: string; is_primary: boolean }[] = [
      { person_id: personId!, type: 'email', value: email, is_primary: true },
    ]
    if (input.phone?.trim()) {
      contacts.push({ person_id: personId!, type: 'phone', value: input.phone.trim(), is_primary: false })
    }
    await sb.from('person_contacts').insert(contacts)
  }

  const payload: Record<string, unknown> = {
    organization_id: org.id,
    full_name: input.fullName.trim(),
    email,
    phone: input.phone?.trim() || null,
    phone_country: input.phoneCountry || null,
    language: input.language || null,
    message: input.message?.trim() || null,
    ministry_id: input.ministryId || null,
    person_id: personId,
    status: 'pendente',
  }

  const { error: formError } = await sb
    .from('staff_interest_forms')
    .insert(payload)

  if (formError) {
    console.error('Erro ao criar staff interest form:', formError)
    return { success: false, error: 'Não foi possível registrar. Tente novamente.' }
  }

  return { success: true }
}
