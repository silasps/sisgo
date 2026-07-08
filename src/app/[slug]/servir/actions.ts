'use server'

import { createAdminClient } from '@/lib/supabase/admin'

type StaffPreRegistrationInput = {
  slug: string
  ministryId: string | null
  schoolId: string | null
  fullName: string
  email: string | null
  phone: string | null
  phoneCountry: string | null
  language: string | null
  communicationLanguage: string | null
  message: string | null
}

export async function submitStaffPreRegistration(
  input: StaffPreRegistrationInput,
): Promise<{ success: boolean; error?: string }> {
  const phone = input.phone?.trim() || null

  if (!input.fullName?.trim() || (!input.email?.trim() && !phone)) {
    return { success: false, error: 'Nome e ao menos um contato (e-mail ou telefone) são obrigatórios.' }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (input.email?.trim() && !emailRegex.test(input.email.trim())) {
    return { success: false, error: 'E-mail inválido.' }
  }

  const sb = createAdminClient()
  const email = input.email?.trim() ? input.email.trim().toLowerCase() : null

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

  if (input.schoolId) {
    const { data: school } = await sb
      .from('schools')
      .select('id')
      .eq('id', input.schoolId)
      .eq('organization_id', org.id)
      .eq('active', true)
      .single()
    if (!school) return { success: false, error: 'Escola não encontrada.' }
  }

  let personId: string | null = null

  let existingPerson: { id: string } | null = null
  if (email) {
    const { data } = await sb
      .from('people')
      .select('id, person_contacts!inner(type, value)')
      .eq('organization_id', org.id)
      .eq('person_contacts.type', 'email')
      .eq('person_contacts.value', email)
      .maybeSingle()
    existingPerson = data
  }
  if (!existingPerson && phone) {
    const { data } = await sb
      .from('people')
      .select('id, person_contacts!inner(type, value)')
      .eq('organization_id', org.id)
      .eq('person_contacts.type', 'phone')
      .eq('person_contacts.value', phone)
      .maybeSingle()
    existingPerson = data
  }

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

    const contacts: { person_id: string; type: string; value: string; is_primary: boolean }[] = []
    if (email) contacts.push({ person_id: personId!, type: 'email', value: email, is_primary: true })
    if (phone) contacts.push({ person_id: personId!, type: 'phone', value: phone, is_primary: !email })
    if (contacts.length > 0) await sb.from('person_contacts').insert(contacts)
  }

  const payload: Record<string, unknown> = {
    organization_id: org.id,
    full_name: input.fullName.trim(),
    email,
    phone,
    phone_country: input.phoneCountry || null,
    language: input.language || null,
    communication_language: input.communicationLanguage || null,
    message: input.message?.trim() || null,
    ministry_id: input.ministryId || null,
    school_id: input.schoolId || null,
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
