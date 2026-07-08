'use server'

import { createAdminClient } from '@/lib/supabase/admin'

type PreRegistrationInput = {
  slug: string
  schoolSlug: string
  classId: string | null
  fullName: string
  email: string
  phone: string | null          // número completo com código do país
  phoneCountry: string | null   // só o código, ex: "+55"
  language: string | null       // ex: "pt-BR", "en"
  communicationLanguage: string | null
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

  const sb = createAdminClient()
  const email = input.email.trim().toLowerCase()

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.schoolSlug)

  const { data: org } = await sb
    .from('organizations')
    .select('id')
    .eq('slug', input.slug)
    .eq('active', true)
    .single()

  if (!org) return { success: false, error: 'Base não encontrada.' }

  const schoolQuery = sb
    .from('schools')
    .select('id')
    .eq('organization_id', org.id)
    .eq('active', true)
    .eq('is_public', true)

  const { data: school } = await (isUUID
    ? schoolQuery.eq('id', input.schoolSlug).single()
    : schoolQuery.eq('slug', input.schoolSlug).single())

  if (!school) return { success: false, error: 'Escola não encontrada.' }

  const classId = input.classId || null
  if (classId) {
    const { data: selectedClass } = await sb
      .from('school_classes')
      .select('id')
      .eq('id', classId)
      .eq('school_id', school.id)
      .eq('active', true)
      .eq('online_applications', true)
      .single()

    if (!selectedClass) return { success: false, error: 'Turma inválida para esta escola.' }
  }

  // ── Garante que existe um registro em people ──────────────────────────────
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
    // Tenta criar com source; fallback sem source se a coluna não existir ainda
    const { data: newPerson, error: personError } = await sb
      .from('people')
      .insert({ organization_id: org.id, full_name: input.fullName.trim(), source: 'pre_inscricao_publica' })
      .select('id')
      .single()

    if (personError?.code === 'PGRST204') {
      const { data: fallback, error: fbErr } = await sb
        .from('people')
        .insert({ organization_id: org.id, full_name: input.fullName.trim() })
        .select('id')
        .single()
      if (fbErr || !fallback) {
        console.error('Erro ao criar pessoa (fallback):', fbErr)
        return { success: false, error: 'Não foi possível registrar. Tente novamente.' }
      }
      personId = fallback.id
    } else if (personError || !newPerson) {
      console.error('Erro ao criar pessoa:', personError)
      return { success: false, error: 'Não foi possível registrar. Tente novamente.' }
    } else {
      personId = newPerson.id
    }

    // Salva contatos
    const contacts: { person_id: string; type: string; value: string; is_primary: boolean }[] = [
      { person_id: personId!, type: 'email', value: email, is_primary: true },
    ]
    if (input.phone?.trim()) {
      contacts.push({ person_id: personId!, type: 'phone', value: input.phone.trim(), is_primary: false })
    }
    await sb.from('person_contacts').insert(contacts)
  }

  // ── Cria o interest form ───────────────────────────────────────────────────
  // Campos base (sempre existem no schema)
  const base: Record<string, unknown> = {
    organization_id: org.id,
    school_id: school.id,
    class_id: classId,
    full_name: input.fullName.trim(),
    email,
    phone: input.phone?.trim() || null,
    message: input.message?.trim() || null,
    status: 'pendente',
  }

  // Campos que dependem de migrations — adicionados progressivamente
  if (personId) base.person_id = personId
  if (input.language) base.language = input.language
  if (input.communicationLanguage) base.communication_language = input.communicationLanguage
  if (input.phoneCountry) base.phone_country = input.phoneCountry

  let { error: formError } = await sb.from('school_interest_forms').insert(base)

  // Fallback: remove campos de migrations pendentes um a um até inserir com sucesso
  if (formError?.code === 'PGRST204') {
    const coreOnly = { ...base }
    delete coreOnly.phone_country
    delete coreOnly.language
    delete coreOnly.communication_language
    delete coreOnly.person_id
    const result = await sb.from('school_interest_forms').insert(coreOnly)
    formError = result.error
  }

  if (formError) {
    console.error('Erro ao criar interest form:', formError)
    return { success: false, error: 'Não foi possível registrar. Tente novamente.' }
  }

  return { success: true }
}
