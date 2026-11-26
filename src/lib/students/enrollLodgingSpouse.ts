import { createAdminClient } from '@/lib/supabase/admin'
import { resolvePerson } from '@/lib/people/resolvePerson'
import { enrollStudent } from '@/lib/students/enrollStudent'

// Inscrição de hospedagem de casal é UMA pelos dois (ver
// classifyApplicationCategory): quem se inscreveu é aprovado normalmente, e
// o cônjuge só vira participante da turma quando a inscrição diz que ele
// também participa do evento (s5.conjuge_participa_evento = 'sim'). Quem só
// vem se hospedar junto continua só na hospedagem (2 vagas, valor de casal),
// sem cadastro de participante.
//
// Reconhece o cônjuge já cadastrado (e-mail/celular, via resolvePerson) em
// vez de duplicar, e guarda o vínculo em form_data.conjuge_person_id — uma
// segunda aprovação da mesma inscrição reaproveita a mesma pessoa.
// Devolve o nome do cônjuge matriculado, ou null se não havia o que fazer.
export async function enrollLodgingSpouse(params: {
  organizationId: string
  classId: string
  applicationId: string
  acceptedBy: string | null
}): Promise<string | null> {
  const db = createAdminClient()
  const { data: app } = await db
    .from('school_applications')
    .select('form_data')
    .eq('id', params.applicationId)
    .maybeSingle()
  const formData = (app?.form_data as Record<string, unknown> | null) ?? {}
  const s4 = (formData.s4 as Record<string, string> | undefined) ?? {}
  const s5 = (formData.s5 as Record<string, string> | undefined) ?? {}
  if (s4.categoria_hospedagem !== 'casal' || s5.conjuge_participa_evento !== 'sim') return null

  const fullName = (s5.conjuge_nome ?? '').trim()
  if (!fullName) return null
  const email = (s5.conjuge_email ?? '').trim().toLowerCase() || null
  // O campo de celular manda só o DDI ("+55") quando fica vazio.
  const phone = (s5.conjuge_celular ?? '').replace(/\D/g, '').length >= 8 ? s5.conjuge_celular.trim() : null

  let personId = typeof formData.conjuge_person_id === 'string' ? formData.conjuge_person_id : null
  if (!personId && (email || phone)) {
    personId = (await resolvePerson({ organizationId: params.organizationId, email, phone }))?.personId ?? null
  }
  if (!personId) {
    // Casal da hospedagem: o cônjuge é do sexo oposto ao de quem se inscreveu.
    const gender = s5.sexo === 'M' ? 'F' : s5.sexo === 'F' ? 'M' : null
    const { data: created } = await db
      .from('people')
      .insert({
        organization_id: params.organizationId,
        full_name: fullName,
        birth_date: s5.conjuge_data_nascimento || null,
        gender,
        civil_status: 'casado',
      })
      .select('id')
      .single()
    if (!created) return null
    personId = created.id as string
    const contacts: { person_id: string; type: string; value: string; is_primary: boolean }[] = []
    if (email) contacts.push({ person_id: personId, type: 'email', value: email, is_primary: true })
    if (phone) contacts.push({ person_id: personId, type: 'phone', value: phone, is_primary: !email })
    if (contacts.length) await db.from('person_contacts').insert(contacts)
  }

  await enrollStudent({ organizationId: params.organizationId, personId, classId: params.classId, acceptedBy: params.acceptedBy })
  if (formData.conjuge_person_id !== personId) {
    await db.from('school_applications')
      .update({ form_data: { ...formData, conjuge_person_id: personId } })
      .eq('id', params.applicationId)
  }
  return fullName
}
