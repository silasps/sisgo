import { createAdminClient } from '@/lib/supabase/admin'
import { enrollStudent } from '@/lib/students/enrollStudent'
import { sendImportWelcomeEmail } from '@/lib/email/sendImportWelcomeEmail'
import { generateDefaultPassword } from './password'
import { resolveOrCreateRoleId } from './roles'
import type { ImportContext, ImportRowResult, ImportValidatedRow } from './types'

type ParsedRow = NonNullable<ImportValidatedRow['parsed']>

export async function createImportedPerson(
  ctx: ImportContext,
  row: ParsedRow,
  rowNumber: number,
  organizationName: string,
  authUsersByEmail: Map<string, string>,
  enviarEmailAgora: boolean,
): Promise<ImportRowResult> {
  const db = createAdminClient()
  const now = new Date().toISOString()
  const password = row.email ? generateDefaultPassword(row.nome) : null

  try {
    // Sem email não tem como criar login (email é o identificador em
    // auth.users) — a pessoa e o perfil são criados do mesmo jeito, só
    // fica sem acesso até alguém completar o email depois.
    let userId: string | undefined = row.email ? authUsersByEmail.get(row.email) : undefined
    if (row.email && !userId) {
      const { data: created, error } = await db.auth.admin.createUser({
        email: row.email,
        password: password!,
        email_confirm: true,
        user_metadata: { full_name: row.nome, must_change_password: true },
      })
      if (error || !created.user) {
        return { rowNumber, nome: row.nome, email: row.email, status: 'erro', message: error?.message ?? 'Não foi possível criar o login.' }
      }
      userId = created.user.id
      authUsersByEmail.set(row.email, userId)
    }

    const { data: person, error: personError } = await db.from('people').insert({
      organization_id: ctx.organizationId,
      full_name: row.nome,
      gender: row.sexo,
      civil_status: row.estadoCivil,
      birth_date: row.dataNascimento,
    }).select('id').single()
    if (personError || !person) {
      return { rowNumber, nome: row.nome, email: row.email, status: 'erro', message: personError?.message ?? 'Não foi possível criar a pessoa.' }
    }
    const personId = person.id

    const contacts: { person_id: string; type: string; value: string; is_primary: boolean }[] = []
    if (row.email) contacts.push({ person_id: personId, type: 'email', value: row.email, is_primary: true })
    if (row.telefone) contacts.push({ person_id: personId, type: 'phone', value: row.telefone, is_primary: false })
    if (contacts.length) await db.from('person_contacts').insert(contacts)

    if (row.cpf) {
      await db.from('person_documents').insert({ person_id: personId, type: 'cpf', number: row.cpf })
    }

    const roleName = row.papel === 'aluno'
      ? 'aluno'
      : row.destinoObreiro?.tipo === 'ministerio' ? 'obreiro_ministerio' : 'obreiro_eted'
    const roleId = await resolveOrCreateRoleId(db, roleName)

    if (userId) {
      const { data: existingOrgUser } = await db.from('organization_users')
        .select('id').eq('organization_id', ctx.organizationId).eq('user_id', userId).maybeSingle()
      if (existingOrgUser) {
        await db.from('organization_users').update({ role_id: roleId, active: true, updated_at: now }).eq('id', existingOrgUser.id)
      } else {
        await db.from('organization_users').insert({ organization_id: ctx.organizationId, user_id: userId, role_id: roleId, active: true })
      }
    }

    // Campos pessoais que já temos, no formato de cada seção do
    // respectivo formulário (aluno: s1.nome / s5.*; obreiro: s1.email / s2.*)
    // — ver FormularioInscricao.tsx e FormularioObreiro.tsx.
    const pessoais: Record<string, string> = {}
    if (row.telefone) pessoais.celular = row.telefone
    if (row.sexo === 'M' || row.sexo === 'F') pessoais.sexo = row.sexo
    if (row.dataNascimento) pessoais.data_nascimento = row.dataNascimento
    if (row.estadoCivil && row.estadoCivil !== 'outro') pessoais.estado_civil = row.estadoCivil
    if (row.cpf) pessoais.cpf = row.cpf

    if (row.papel === 'aluno' && row.turmaId) {
      const turma = ctx.turmas.find(t => t.id === row.turmaId)
      await enrollStudent({ organizationId: ctx.organizationId, personId, classId: row.turmaId, userId })

      if (turma?.schoolId) {
        await db.from('school_applications').insert({
          organization_id: ctx.organizationId,
          school_id: turma.schoolId,
          person_id: personId,
          status: 'rascunho',
          form_data: { s1: { nome: row.nome }, s5: { ...pessoais, email: row.email } },
        })
      }
    } else if (row.papel === 'obreiro' && row.destinoObreiro) {
      const area = row.destinoObreiro.tipo === 'escola' ? row.destinoObreiro.label.replace(/^Escola: /, '') : null

      const { data: existingProfile } = await db.from('staff_profiles').select('id').eq('person_id', personId).maybeSingle()
      const profilePayload = {
        organization_id: ctx.organizationId,
        person_id: personId,
        role_title: row.cargo || 'Obreiro',
        area,
        active: true,
        user_id: userId ?? null,
        accepted_at: now,
      }
      if (existingProfile) {
        await db.from('staff_profiles').update(profilePayload).eq('id', existingProfile.id)
      } else {
        await db.from('staff_profiles').insert(profilePayload)
      }

      if (row.destinoObreiro.tipo === 'ministerio') {
        const { data: memberRole } = await db.from('ministry_roles')
          .select('id').eq('ministry_id', row.destinoObreiro.id).eq('name', 'Membro').maybeSingle()
        await db.from('ministry_members').upsert({
          ministry_id: row.destinoObreiro.id,
          person_id: personId,
          ministry_role_id: memberRole?.id ?? null,
          active: true,
          joined_at: now,
        }, { onConflict: 'ministry_id,person_id' })
      }

      await db.from('staff_applications').insert({
        organization_id: ctx.organizationId,
        person_id: personId,
        status: 'rascunho',
        form_data: { s1: { email: row.email }, s2: { ...pessoais, nome: row.nome } },
      })
    }

    let message = 'Pessoa criada sem login (sem email — complete o email depois para liberar acesso).'
    if (userId) {
      if (enviarEmailAgora) {
        await sendImportWelcomeEmail({
          to: row.email,
          candidateName: row.nome,
          organizationId: ctx.organizationId,
          organizationName,
          password: password!,
          loginUrl: `https://www.sisgomission.com/${ctx.slug}`,
        })
        await db.from('organization_users').update({ invite_sent_at: now }).eq('organization_id', ctx.organizationId).eq('user_id', userId)
        message = 'Pessoa criada e credenciais enviadas por email.'
      } else {
        message = 'Pessoa e login criados; credenciais ainda não enviadas.'
      }
    }

    return { rowNumber, nome: row.nome, email: row.email, status: 'criado', message }
  } catch (err) {
    return { rowNumber, nome: row.nome, email: row.email, status: 'erro', message: err instanceof Error ? err.message : 'Erro desconhecido.' }
  }
}
