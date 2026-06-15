import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import {
  assignSchoolLeader, removeSchoolLeader,
  addSchoolStaff, removeSchoolStaff,
  submitSchoolObreiroRequest, approveSchoolObreiroRequest,
  rejectSchoolObreiroRequest, cancelSchoolObreiroRequest,
  toggleTurmaActive, deleteTurma,
} from './actions'
import { DeleteTurmaButton } from './DeleteTurmaButton'
import { EmbedCodeBox } from '@/components/ui/EmbedCodeBox'

import { isManagementRole } from '@/lib/auth/permissions'
import { SCHOOL_TYPES } from '@/lib/schools'

type Props = {
  params: Promise<{ slug: string; id: string }>
  searchParams: Promise<{ msg?: string }>
}

function whatsappDigits(value: string | null | undefined): string | null {
  const digits = (value ?? '').replace(/\D/g, '')
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  if (digits.length >= 12 && digits.length <= 15) return digits
  return null
}

function WhatsAppButton({ phone }: { phone?: string | null }) {
  const digits = whatsappDigits(phone)
  if (!digits) {
    return (
      <span className="inline-flex cursor-not-allowed rounded-lg border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-400">
        WhatsApp
      </span>
    )
  }
  return (
    <a
      href={`https://wa.me/${digits}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex rounded-lg border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 hover:bg-green-100"
    >
      WhatsApp
    </a>
  )
}

export default async function EditarEscolaPage({ params, searchParams }: Props) {
  const { slug, id } = await params
  const { msg } = await searchParams
  const supabase = await createClient()
  const sbAdmin  = createAdminClient()

  const [{ data: { user } }, { data: org }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('organizations').select('id').eq('slug', slug).single(),
  ])
  if (!user || !org) notFound()

  const { data: orgUser } = await supabase
    .from('organization_users')
    .select('roles(name)')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()
  const role          = (orgUser?.roles as unknown as { name: string } | null)?.name ?? ''
  const isManagement  = isManagementRole(role)
  const isLiderEted   = role === 'lider_eted'
  const isObreiroEted = role === 'obreiro_eted'

  if (!isManagement && !isLiderEted && !isObreiroEted) notFound()

  const { data: escola } = await supabase
    .from('schools')
    .select('*')
    .eq('id', id)
    .eq('organization_id', org.id)
    .single()
  if (!escola) notFound()

  // lider_eted só acessa a escola que lidera
  if (isLiderEted) {
    const { data: lc } = await supabase
      .from('school_leaders')
      .select('id')
      .eq('school_id', id)
      .eq('user_id', user.id)
      .single()
    if (!lc) redirect(`/${slug}/escolas`)
  }

  const { data: turmas } = await supabase
    .from('school_classes')
    .select('id, name, year, semester, starts_at, active')
    .eq('school_id', id)
    .order('starts_at', { ascending: false })

  const { data: enrollmentsData } = await supabase
    .from('school_class_enrollments')
    .select('class_id')
    .in('class_id', (turmas ?? []).map(t => t.id))
  const enrolledClassIds = new Set((enrollmentsData ?? []).map(e => e.class_id))

  // ── Obreiros da escola ───────────────────────────────────────────────────────
  type StaffRow = { id: string; person_id: string; role: string; people: { full_name: string } | null }
  type ObreiroReqRow = {
    id: string; role: string; notes: string | null; status: string
    requested_by: string; person_id: string | null; created_at: string; review_notes: string | null
    people: { full_name: string } | null
  }

  const { data: staffData } = await supabase
    .from('school_staff').select('id, person_id, role, people(full_name)')
    .eq('school_id', id).eq('active', true).order('joined_at', { ascending: true })
  const staffMembers = (staffData ?? []) as unknown as StaffRow[]
  const staffPersonIds = new Set(staffMembers.map(s => s.person_id))

  const { data: allPeople } = await supabase
    .from('people').select('id, full_name').eq('organization_id', org.id).order('full_name')
  const availablePeople = (allPeople ?? []).filter(p => !staffPersonIds.has(p.id))

  // Solicitações pendentes (DH vê para aprovar)
  let pendingObreiroRequests: ObreiroReqRow[] = []
  if (isManagement) {
    const { data } = await supabase
      .from('school_pending_requests')
      .select('id, role, notes, status, requested_by, person_id, created_at, review_notes, people(full_name)')
      .eq('school_id', id).eq('status', 'pendente').order('created_at', { ascending: true })
    pendingObreiroRequests = (data ?? []) as unknown as ObreiroReqRow[]
  }

  // Minhas solicitações (líder vê status + motivo de recusa)
  let myObreiroRequests: ObreiroReqRow[] = []
  if (isLiderEted) {
    const { data } = await supabase
      .from('school_pending_requests')
      .select('id, role, notes, status, requested_by, person_id, created_at, review_notes, people(full_name)')
      .eq('school_id', id).eq('requested_by', user.id)
      .not('status', 'in', '("cancelado")').order('created_at', { ascending: false }).limit(10)
    myObreiroRequests = (data ?? []) as unknown as ObreiroReqRow[]
  }

  const requestUserIds = [...new Set(pendingObreiroRequests.map(req => req.requested_by).filter(Boolean))]
  const requestPhoneByUser = new Map<string, string | null>()
  if (requestUserIds.length > 0) {
    const { data: profiles } = await sbAdmin
      .from('staff_profiles')
      .select('user_id, person_id')
      .eq('organization_id', org.id)
      .in('user_id', requestUserIds)
    const personByUser = new Map<string, string>()
    for (const profile of (profiles ?? []) as Array<{ user_id: string | null; person_id: string }>) {
      if (profile.user_id) personByUser.set(profile.user_id, profile.person_id)
    }
    const personIds = [...new Set([...personByUser.values()])]
    if (personIds.length > 0) {
      const { data: contacts } = await sbAdmin
        .from('person_contacts')
        .select('person_id, type, value, is_primary')
        .in('person_id', personIds)
        .in('type', ['whatsapp', 'phone'])
      const contactsByPerson = new Map<string, Array<{ type: string; value: string; is_primary: boolean }>>()
      for (const contact of (contacts ?? []) as Array<{ person_id: string; type: string; value: string; is_primary: boolean }>) {
        const list = contactsByPerson.get(contact.person_id) ?? []
        list.push(contact)
        contactsByPerson.set(contact.person_id, list)
      }
      for (const [userId, personId] of personByUser.entries()) {
        const personContacts = contactsByPerson.get(personId) ?? []
        const chosen = personContacts.find(c => c.type === 'whatsapp' && c.is_primary)
          ?? personContacts.find(c => c.type === 'whatsapp')
          ?? personContacts.find(c => c.type === 'phone' && c.is_primary)
          ?? personContacts.find(c => c.type === 'phone')
        requestPhoneByUser.set(userId, chosen?.value ?? null)
      }
    }
  }

  // ── Dados de líder (management) ──────────────────────────────────────────────
  const { data: leaderRow } = await supabase
    .from('school_leaders')
    .select('user_id')
    .eq('school_id', id)
    .single()

  let leaderEmail: string | null = null
  let orgUsersForAssignment: Array<{ id: string; email: string }> = []

  if (isManagement) {
    if (leaderRow) {
      const { data: { user: lu } } = await sbAdmin.auth.admin.getUserById(leaderRow.user_id)
      leaderEmail = lu?.email ?? null
    }
    const { data: orgUsersData } = await supabase
      .from('organization_users').select('user_id').eq('organization_id', org.id).eq('active', true)
    if (orgUsersData?.length) {
      const { data: { users: authUsers } } = await sbAdmin.auth.admin.listUsers({ perPage: 1000 })
      const orgUserSet = new Set(orgUsersData.map((u: { user_id: string }) => u.user_id))
      orgUsersForAssignment = authUsers
        .filter(u => orgUserSet.has(u.id) && u.id !== (leaderRow?.user_id ?? ''))
        .map(u => ({ id: u.id, email: u.email ?? u.id }))
        .sort((a, b) => a.email.localeCompare(b.email))
    }
  }

  // ── Server actions ───────────────────────────────────────────────────────────

  async function updateSchool(formData: FormData) {
    'use server'
    const { createAdminClient: mkAdmin } = await import('@/lib/supabase/admin')
    const sb = mkAdmin()
    const objectives    = (formData.get('objectives') as string ?? '').split('\n').map(s => s.trim()).filter(Boolean)
    const prerequisites = (formData.get('prerequisites') as string ?? '').split('\n').map(s => s.trim()).filter(Boolean)
    await sb.from('schools').update({
      name: formData.get('name') as string,
      acronym: (formData.get('acronym') as string) || null,
      slug: (formData.get('slug') as string) || null,
      school_type: formData.get('school_type') as string,
      subtitle: (formData.get('subtitle') as string) || null,
      long_description: (formData.get('long_description') as string) || null,
      target_audience: (formData.get('target_audience') as string) || null,
      duration_description: (formData.get('duration_description') as string) || null,
      hero_image_url: (formData.get('hero_image_url') as string) || null,
      promo_video_url: (formData.get('promo_video_url') as string) || null,
      objectives: objectives.length ? objectives : null,
      prerequisites: prerequisites.length ? prerequisites : null,
      is_public: formData.get('is_public') === 'on',
      active: formData.get('active') === 'on',
    }).eq('id', id)
    redirect(`/${slug}/escolas/${id}?msg=atualizado`)
  }

  async function updateEmail(formData: FormData) {
    'use server'
    const { createAdminClient: mkAdmin } = await import('@/lib/supabase/admin')
    const { headers: hdrs } = await import('next/headers')
    const sb = mkAdmin()
    const newEmail = (formData.get('contact_email') as string)?.trim().toLowerCase() || null
    const { data: current } = await sb.from('schools').select('contact_email, name').eq('id', id).single()
    if (newEmail === (current?.contact_email ?? null)) redirect(`/${slug}/escolas/${id}`)
    if (!newEmail) {
      await sb.from('schools').update({ contact_email: null, contact_email_verified: false, contact_email_token: null, contact_email_token_expires_at: null }).eq('id', id)
      redirect(`/${slug}/escolas/${id}`)
    }
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    await sb.from('schools').update({ contact_email: newEmail, contact_email_verified: false, contact_email_token: token, contact_email_token_expires_at: expiresAt }).eq('id', id)
    const headersList = await hdrs()
    const host = headersList.get('host') ?? 'localhost:3000'
    const protocol = host.startsWith('localhost') ? 'http' : 'https'
    const verifyUrl = `${protocol}://${host}/${slug}/verificar-email/${token}`
    const { sendVerificationEmail } = await import('@/lib/email/sendVerificationEmail')
    await sendVerificationEmail({ to: newEmail, schoolName: current?.name ?? 'escola', verifyUrl })
    redirect(`/${slug}/escolas/${id}`)
  }

  async function reenviarVerificacao() {
    'use server'
    const { createAdminClient: mkAdmin } = await import('@/lib/supabase/admin')
    const { headers: hdrs } = await import('next/headers')
    const sb = mkAdmin()
    const { data: current } = await sb.from('schools').select('contact_email, name').eq('id', id).single()
    if (!current?.contact_email) return
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    await sb.from('schools').update({ contact_email_verified: false, contact_email_token: token, contact_email_token_expires_at: expiresAt }).eq('id', id)
    const headersList = await hdrs()
    const host = headersList.get('host') ?? 'localhost:3000'
    const protocol = host.startsWith('localhost') ? 'http' : 'https'
    const verifyUrl = `${protocol}://${host}/${slug}/verificar-email/${token}`
    const { sendVerificationEmail } = await import('@/lib/email/sendVerificationEmail')
    await sendVerificationEmail({ to: current.contact_email, schoolName: current.name, verifyUrl })
    redirect(`/${slug}/escolas/${id}`)
  }

  async function createTurma(formData: FormData) {
    'use server'
    const { createAdminClient: mkAdmin } = await import('@/lib/supabase/admin')
    const sb = mkAdmin()
    const { data: newClass, error } = await sb.from('school_classes').insert({
      school_id: id,
      name: formData.get('name') as string,
      year: formData.get('year') ? Number(formData.get('year')) : null,
      semester: formData.get('semester') ? Number(formData.get('semester')) : null,
      active: true,
    }).select('id').single()
    if (error || !newClass) redirect(`/${slug}/escolas/${id}`)
    redirect(`/${slug}/escolas/${id}/turmas/${newClass.id}`)
  }

  const handleAssignLeader = async (formData: FormData) => {
    'use server'
    const userId = formData.get('user_id') as string
    if (!userId) return
    await assignSchoolLeader(org.id, id, userId)
    redirect(`/${slug}/escolas/${id}?msg=lider_atribuido`)
  }

  const handleRemoveLeader = async () => {
    'use server'
    await removeSchoolLeader(id)
    redirect(`/${slug}/escolas/${id}`)
  }

  const handleAddStaff = async (formData: FormData) => {
    'use server'
    const personId = formData.get('person_id') as string
    if (!personId) return
    await addSchoolStaff(id, personId, (formData.get('role') as string).trim() || 'Obreiro')
    redirect(`/${slug}/escolas/${id}`)
  }

  const handleRemoveStaff = async (formData: FormData) => {
    'use server'
    await removeSchoolStaff(formData.get('staff_id') as string)
    redirect(`/${slug}/escolas/${id}`)
  }

  const handleRequestObreiro = async (formData: FormData) => {
    'use server'
    const personId = formData.get('person_id') as string
    if (!personId) return
    await submitSchoolObreiroRequest(
      org.id, id, user.id, personId,
      (formData.get('role') as string).trim() || 'Obreiro',
      (formData.get('notes') as string) || null,
    )
    redirect(`/${slug}/escolas/${id}?msg=solicitacao_enviada`)
  }

  const handleApproveObreiro = async (formData: FormData) => {
    'use server'
    await approveSchoolObreiroRequest(formData.get('request_id') as string, user.id)
    redirect(`/${slug}/escolas/${id}`)
  }

  const handleRejectObreiro = async (formData: FormData) => {
    'use server'
    await rejectSchoolObreiroRequest(
      formData.get('request_id') as string, user.id,
      (formData.get('review_notes') as string) || null,
    )
    redirect(`/${slug}/escolas/${id}`)
  }

  const handleCancelObreiro = async (formData: FormData) => {
    'use server'
    await cancelSchoolObreiroRequest(formData.get('request_id') as string)
    redirect(`/${slug}/escolas/${id}`)
  }

  const handleToggleTurma = async (formData: FormData) => {
    'use server'
    await toggleTurmaActive(
      formData.get('class_id') as string,
      formData.get('active') === 'true',
    )
    redirect(`/${slug}/escolas/${id}`)
  }

  const handleDeleteTurma = async (formData: FormData) => {
    'use server'
    await deleteTurma(formData.get('class_id') as string)
    redirect(`/${slug}/escolas/${id}`)
  }

  const publicUrl = (escola as unknown as { slug: string | null }).slug
    ? `/${slug}/escola/${(escola as unknown as { slug: string | null }).slug}`
    : null

  const msgs: Record<string, { text: string; cls: string }> = {
    atualizado:          { text: 'Escola atualizada.', cls: 'bg-green-50 border-green-200 text-green-700' },
    lider_atribuido:     { text: 'Líder atribuído com sucesso.', cls: 'bg-green-50 border-green-200 text-green-700' },
    solicitacao_enviada: { text: 'Solicitação enviada ao DH.', cls: 'bg-blue-50 border-blue-200 text-blue-700' },
  }

  return (
    <>
      <Header
        title={escola.name}
        actions={
          publicUrl && (escola as unknown as { is_public: boolean }).is_public ? (
            <Link href={publicUrl} target="_blank"
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Ver página pública ↗
            </Link>
          ) : undefined
        }
      />

      {/* ════════ VISÃO MANAGEMENT ═══════════════════════════════════════════════ */}
      {isManagement && (
        <main className="p-4 md:p-6 max-w-5xl">
          {msg && msgs[msg] && (
            <div className={`border rounded-lg px-4 py-3 text-sm mb-4 ${msgs[msg].cls}`}>
              {msgs[msg].text}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Coluna principal */}
            <div className="lg:col-span-2 space-y-6">

              {/* Formulário da escola */}
              <form action={updateSchool} className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                <div className="p-5">
                  <h2 className="font-semibold text-gray-900 mb-4">Informações gerais</h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <Field label="Nome da escola *" name="name" defaultValue={escola.name} required />
                    </div>
                    <Field label="Sigla / Acrônimo" name="acronym" defaultValue={escola.acronym ?? ''} placeholder="Ex: ETED" />
                    <Field label="Slug (URL pública)" name="slug" defaultValue={(escola as unknown as { slug: string | null }).slug ?? ''} placeholder="ex: eted-almirante" />
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de escola</label>
                      <select name="school_type" defaultValue={(escola as unknown as { school_type: string }).school_type}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                        {SCHOOL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <Field label="Subtítulo" name="subtitle" defaultValue={(escola as unknown as { subtitle: string | null }).subtitle ?? ''} placeholder="Uma frase que resume o propósito da escola" />
                    </div>
                    <Field label="Duração" name="duration_description" defaultValue={(escola as unknown as { duration_description: string | null }).duration_description ?? ''} placeholder="Ex: 20 semanas (5 meses)" />
                    <Field label="URL da imagem hero" name="hero_image_url" defaultValue={(escola as unknown as { hero_image_url: string | null }).hero_image_url ?? ''} placeholder="https://..." />
                    <Field label="URL do vídeo promocional" name="promo_video_url" defaultValue={(escola as unknown as { promo_video_url: string | null }).promo_video_url ?? ''} placeholder="https://youtube.com/..." />
                  </div>
                </div>

                <div className="p-5">
                  <h2 className="font-semibold text-gray-900 mb-4">Conteúdo público</h2>
                  <div className="space-y-4">
                    <TextArea label="Descrição completa" name="long_description"
                      defaultValue={(escola as unknown as { long_description: string | null }).long_description ?? ''}
                      placeholder="O que é esta escola? Qual o objetivo do programa?" rows={5} />
                    <TextArea label="Público-alvo" name="target_audience"
                      defaultValue={(escola as unknown as { target_audience: string | null }).target_audience ?? ''}
                      placeholder="Para quem é indicada esta escola?" rows={3} />
                    <TextArea label="Objetivos (1 por linha)" name="objectives"
                      defaultValue={((escola as unknown as { objectives: string[] | null }).objectives ?? []).join('\n')}
                      placeholder={'Crescer no relacionamento com Deus\nSer desafiado para as missões'} rows={4} />
                    <TextArea label="Pré-requisitos (1 por linha)" name="prerequisites"
                      defaultValue={((escola as unknown as { prerequisites: string[] | null }).prerequisites ?? []).join('\n')}
                      placeholder={'Cristão com 2+ anos de fé\nEnvolvido em uma igreja'} rows={4} />
                  </div>
                </div>

                <div className="p-5">
                  <h2 className="font-semibold text-gray-900 mb-4">Visibilidade</h2>
                  <div className="flex flex-col gap-3">
                    <Toggle name="is_public" label="Página pública ativa"
                      description="Aparece na listagem pública da base e a URL da escola fica acessível"
                      defaultChecked={(escola as unknown as { is_public: boolean }).is_public} />
                    <Toggle name="active" label="Escola ativa"
                      description="Escola aparece no sistema de gestão"
                      defaultChecked={escola.active ?? true} />
                  </div>
                </div>

                <div className="p-5 flex justify-end gap-3">
                  <Link href={`/${slug}/escolas`} className="px-5 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    Cancelar
                  </Link>
                  <button type="submit" className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors">
                    Salvar alterações
                  </button>
                </div>
              </form>

              {/* E-mail da escola */}
              <form action={updateEmail} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                <div>
                  <h2 className="font-semibold text-gray-900 mb-1">E-mail da escola</h2>
                  <p className="text-xs text-gray-400">Usado como endereço de resposta nos e-mails de inscrição.</p>
                </div>
                <div className="flex items-end gap-3 flex-wrap">
                  <div className="flex-1 min-w-48">
                    <Field label="E-mail de contato" name="contact_email"
                      defaultValue={(escola as unknown as { contact_email: string | null }).contact_email ?? ''}
                      placeholder="eted.suabase@gmail.com" />
                  </div>
                  <button type="submit" className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap">
                    Salvar e-mail
                  </button>
                </div>
                {(() => {
                  const email   = (escola as unknown as { contact_email: string | null }).contact_email
                  const verified = (escola as unknown as { contact_email_verified: boolean }).contact_email_verified
                  if (!email) return null
                  if (verified) return <p className="text-xs text-green-600">✅ E-mail verificado</p>
                  return (
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="text-xs text-orange-500">⚠ Aguardando verificação — verifique a caixa de entrada de <strong>{email}</strong></p>
                      <button type="submit" formAction={reenviarVerificacao} className="text-xs text-brand-500 hover:text-brand-600 underline underline-offset-2 whitespace-nowrap">
                        Reenviar link
                      </button>
                    </div>
                  )
                })()}
              </form>

              {/* Config formulário + Incorporar */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-gray-900">Formulário de inscrição</h2>
                  <Link href={`/${slug}/escolas/${id}/formulario`}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors">
                    ⚙️ Configurar campos
                  </Link>
                </div>
                <p className="text-xs text-gray-400 mb-4">Ative ou desative campos do formulário que os candidatos preenchem.</p>

                {publicUrl && (escola as unknown as { is_public: boolean }).is_public && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Incorporar no site</p>
                    <EmbedCodeBox embedPath={`${publicUrl}/embed`} />
                  </div>
                )}
              </section>

              {/* Turmas */}
              <section>
                <h2 className="font-semibold text-gray-900 mb-3">Turmas</h2>
                {turmas && turmas.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 mb-4">
                    {turmas.map(t => {
                      const hasEnrollments = enrolledClassIds.has(t.id)
                      return (
                        <div key={t.id} className="group relative flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-brand-50 transition-colors">
                          <Link href={`/${slug}/escolas/${id}/turmas/${t.id}`} className="absolute inset-0" aria-label={`Abrir turma ${t.name}`} />
                          <div className="pointer-events-none min-w-0 flex-1">
                            <p className="font-medium text-sm text-gray-900 group-hover:text-brand-700 transition-colors truncate">{t.name}</p>
                            <p className="text-xs text-gray-400">
                              {[t.year, t.semester ? `${t.semester}º sem.` : null].filter(Boolean).join(' · ')}
                              {t.starts_at ? ` · Início: ${new Date(t.starts_at).toLocaleDateString('pt-BR')}` : ''}
                            </p>
                          </div>
                          <div className="relative z-10 pointer-events-auto flex items-center gap-1 ml-3 flex-shrink-0">
                            {/* Olhinho — toggle ativo/inativo */}
                            <form action={handleToggleTurma}>
                              <input type="hidden" name="class_id" value={t.id} />
                              <input type="hidden" name="active" value={String(t.active)} />
                              <button
                                type="submit"
                                title={t.active ? 'Desativar turma' : 'Ativar turma'}
                                className={`p-1.5 rounded-lg transition-colors ${t.active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                              >
                                {t.active ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                )}
                              </button>
                            </form>
                            {/* Lápis — editar */}
                            <Link
                              href={`/${slug}/escolas/${id}/turmas/${t.id}`}
                              title="Editar turma"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </Link>
                            {/* Lixeira — excluir (só se sem alunos) */}
                            <DeleteTurmaButton
                              classId={t.id}
                              className={t.name}
                              disabled={hasEnrollments}
                              action={handleDeleteTurma}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                <form action={createTurma} className="bg-white rounded-xl border border-dashed border-gray-300 p-4">
                  <p className="text-sm font-medium text-gray-700 mb-3">Nova turma</p>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-3">
                      <input name="name" required placeholder="Nome da turma (ex: ETED Julho 2026)"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                    </div>
                    <input name="year" type="number" placeholder="Ano (ex: 2026)"
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                    <input name="semester" type="number" min="1" max="2" placeholder="Semestre (1 ou 2)"
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                    <button type="submit" className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors">
                      Criar turma
                    </button>
                  </div>
                </form>
              </section>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Líder da Escola */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Líder da Escola</h2>
                {leaderEmail ? (
                  <div className="mb-3">
                    <p className="text-sm font-medium text-gray-900">{leaderEmail}</p>
                    <form action={handleRemoveLeader} className="mt-1">
                      <button type="submit" className="text-xs text-red-400 hover:text-red-600 transition-colors">
                        Remover líder
                      </button>
                    </form>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 mb-3">Sem líder atribuído.</p>
                )}
                {orgUsersForAssignment.length > 0 ? (
                  <details className={leaderEmail ? 'border-t border-gray-100 pt-3' : ''}>
                    <summary className="text-sm text-brand-600 cursor-pointer select-none font-medium">
                      {leaderEmail ? 'Trocar líder' : 'Atribuir líder'}
                    </summary>
                    <form action={handleAssignLeader} className="mt-3 space-y-2">
                      <select name="user_id" required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                        <option value="">Selecionar usuário...</option>
                        {orgUsersForAssignment.map(u => (
                          <option key={u.id} value={u.id}>{u.email}</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-400">O papel do usuário será atualizado para Líder de Escola.</p>
                      <button type="submit" className="w-full px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors">
                        Confirmar
                      </button>
                    </form>
                  </details>
                ) : (
                  <p className="text-xs text-gray-400">Nenhum outro usuário disponível.</p>
                )}
              </div>

              {/* Obreiros da Escola */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  Obreiros da Escola
                  {pendingObreiroRequests.length > 0 && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
                      {pendingObreiroRequests.length}
                    </span>
                  )}
                </h2>

                {/* Membros ativos */}
                {staffMembers.length > 0 && (
                  <ul className="divide-y divide-gray-100 mb-3">
                    {staffMembers.map(s => (
                      <li key={s.id} className="py-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-gray-900">{s.people?.full_name ?? '—'}</span>
                          <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{s.role}</span>
                        </div>
                        <form action={handleRemoveStaff} className="flex-shrink-0">
                          <input type="hidden" name="staff_id" value={s.id} />
                          <button type="submit" className="text-xs text-red-400 hover:text-red-600">Remover</button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Solicitações pendentes do líder */}
                {pendingObreiroRequests.length > 0 && (
                  <div className={`space-y-2 ${staffMembers.length > 0 ? 'border-t border-gray-100 pt-3 mb-3' : 'mb-3'}`}>
                    <p className="text-xs font-medium text-gray-500">Solicitações pendentes</p>
                    {pendingObreiroRequests.map(req => (
                      <div key={req.id} className="border border-gray-100 rounded-lg p-2.5 space-y-2">
                        <div className="text-sm">
                          <p className="font-medium text-gray-800">{req.people?.full_name ?? '—'}</p>
                          <p className="text-xs text-gray-500">{req.role}{req.notes ? ` · "${req.notes}"` : ''}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <WhatsAppButton phone={requestPhoneByUser.get(req.requested_by)} />
                          <form action={handleApproveObreiro}>
                            <input type="hidden" name="request_id" value={req.id} />
                            <button type="submit" className="px-3 py-1 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600">
                              Aprovar
                            </button>
                          </form>
                          <form action={handleRejectObreiro} className="flex gap-1">
                            <input type="hidden" name="request_id" value={req.id} />
                            <input name="review_notes" placeholder="Motivo" required
                              className="w-24 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400" />
                            <button type="submit" className="px-3 py-1 border border-red-200 text-red-500 text-xs font-medium rounded-lg hover:bg-red-50">
                              Recusar
                            </button>
                          </form>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Adicionar diretamente (DH) */}
                {availablePeople.length > 0 && (
                  <details className={(staffMembers.length > 0 || pendingObreiroRequests.length > 0) ? 'border-t border-gray-100 pt-3' : ''}>
                    <summary className="text-sm text-brand-600 cursor-pointer select-none font-medium">+ Adicionar diretamente</summary>
                    <form action={handleAddStaff} className="mt-2 space-y-2">
                      <select name="person_id" required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                        <option value="">Selecionar pessoa...</option>
                        {availablePeople.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                      </select>
                      <div className="flex gap-2">
                        <input name="role" placeholder="Papel" defaultValue="Obreiro"
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                        <button type="submit" className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors">
                          Adicionar
                        </button>
                      </div>
                    </form>
                  </details>
                )}

                {staffMembers.length === 0 && pendingObreiroRequests.length === 0 && availablePeople.length === 0 && (
                  <p className="text-sm text-gray-400">Nenhum obreiro ainda.</p>
                )}
              </div>

              {/* Link rápido para Reservas */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-2">Reservas</h2>
                <p className="text-xs text-gray-400 mb-3">Solicitações de espaço e quarto feitas por esta escola.</p>
                <Link href={`/${slug}/reservas`}
                  className="block text-center px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  Ver Reservas →
                </Link>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ════════ VISÃO LÍDER DE ESCOLA ═══════════════════════════════════════════════ */}
      {isLiderEted && (
        <main className="p-4 md:p-6 space-y-4 max-w-2xl">

          {/* Info da escola */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-900">{escola.name}</h2>
              {(escola as unknown as { subtitle: string | null }).subtitle && (
                <p className="text-sm text-gray-500 mt-1">{(escola as unknown as { subtitle: string | null }).subtitle}</p>
              )}
              {(escola as unknown as { school_type: string }).school_type && (
                <p className="text-xs text-gray-400 mt-1">
                  {SCHOOL_TYPES.find(t => t.value === (escola as unknown as { school_type: string }).school_type)?.label ?? ''}
                </p>
              )}
            </div>
            <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${escola.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {escola.active ? 'Ativa' : 'Inativa'}
            </span>
          </div>

          {/* Turmas */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Turmas ({turmas?.length ?? 0})</h2>
            {turmas && turmas.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {turmas.map(t => (
                  <li key={t.id} className="group relative flex items-center justify-between py-2.5 cursor-pointer hover:bg-brand-50 -mx-5 px-5 transition-colors">
                    <Link href={`/${slug}/escolas/${id}/turmas/${t.id}`} className="absolute inset-0" aria-label={`Abrir turma ${t.name}`} />
                    <div className="pointer-events-none min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 group-hover:text-brand-700 transition-colors truncate">{t.name}</p>
                      <p className="text-xs text-gray-400">
                        {[t.year, t.semester ? `${t.semester}º sem.` : null].filter(Boolean).join(' · ')}
                        {t.starts_at ? ` · Início: ${new Date(t.starts_at).toLocaleDateString('pt-BR')}` : ''}
                      </p>
                    </div>
                    <div className="relative z-10 pointer-events-auto flex items-center gap-1 ml-3 flex-shrink-0">
                      <form action={handleToggleTurma}>
                        <input type="hidden" name="class_id" value={t.id} />
                        <input type="hidden" name="active" value={String(t.active)} />
                        <button
                          type="submit"
                          title={t.active ? 'Desativar turma' : 'Ativar turma'}
                          className={`p-1.5 rounded-lg transition-colors ${t.active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                        >
                          {t.active ? (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                          )}
                        </button>
                      </form>
                      <Link
                        href={`/${slug}/escolas/${id}/turmas/${t.id}`}
                        title="Editar turma"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">Nenhuma turma cadastrada.</p>
            )}
          </div>

          {/* Obreiros da Escola */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Obreiros da Escola ({staffMembers.length})</h2>

            {/* Lista atual (read-only) */}
            {staffMembers.length > 0 ? (
              <ul className="divide-y divide-gray-100 mb-3">
                {staffMembers.map(s => (
                  <li key={s.id} className="py-2.5 flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 flex-1">{s.people?.full_name ?? '—'}</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{s.role}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400 mb-3">Nenhum obreiro ainda.</p>
            )}

            {/* Solicitar adição */}
            {availablePeople.length > 0 && (
              <details className={staffMembers.length > 0 ? 'border-t border-gray-100 pt-3' : ''}>
                <summary className="text-sm text-brand-600 cursor-pointer select-none font-medium">+ Solicitar adição de obreiro</summary>
                <form action={handleRequestObreiro} className="mt-3 space-y-2">
                  <select name="person_id" required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                    <option value="">Selecionar pessoa...</option>
                    {availablePeople.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                  <input name="role" placeholder="Papel (ex: Instrutor, Monitor)" defaultValue="Obreiro"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                  <input name="notes" placeholder="Observação (opcional)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                  <button type="submit" className="w-full px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors">
                    Enviar ao DH
                  </button>
                </form>
              </details>
            )}

            {/* Minhas solicitações — status e motivo de recusa */}
            {myObreiroRequests.length > 0 && (
              <div className="border-t border-gray-100 pt-3 mt-3">
                <p className="text-xs font-medium text-gray-500 mb-2">Minhas solicitações</p>
                <ul className="space-y-2">
                  {myObreiroRequests.map(req => {
                    const isPending = req.status === 'pendente'
                    const isRejected = req.status === 'rejeitado'
                    return (
                      <li key={req.id} className={`rounded-lg p-2.5 text-sm border ${isRejected ? 'border-red-100 bg-red-50' : 'border-gray-100'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-medium text-gray-800">{req.people?.full_name ?? '—'}</span>
                            <span className="ml-1.5 text-xs text-gray-500">{req.role}</span>
                          </div>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                            isPending ? 'bg-yellow-100 text-yellow-700' :
                            isRejected ? 'bg-red-100 text-red-600' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {isPending ? 'Aguardando' : isRejected ? 'Recusado' : 'Aprovado'}
                          </span>
                        </div>
                        {isRejected && req.review_notes && (
                          <p className="text-xs text-red-600 mt-1">Motivo: {req.review_notes}</p>
                        )}
                        {isPending && (
                          <form action={handleCancelObreiro} className="mt-1">
                            <input type="hidden" name="request_id" value={req.id} />
                            <button type="submit" className="text-xs text-gray-400 hover:text-red-500">Cancelar</button>
                          </form>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* Incorporar no site */}
          {publicUrl && (escola as unknown as { is_public: boolean }).is_public && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Incorporar no site</h2>
              <p className="text-xs text-gray-400 mb-3">
                Cole o código abaixo no site da base para exibir o formulário de pré-inscrição.
              </p>
              <EmbedCodeBox embedPath={`${publicUrl}/embed`} />
            </div>
          )}

          {/* Reservas */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Reservas</h2>
            <p className="text-xs text-gray-400 mb-3">
              Solicite espaços para atividades ou quartos para professores convidados.
            </p>
            <Link href={`/${slug}/reservas`}
              className="block text-center w-full px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors">
              Solicitar / Ver Reservas →
            </Link>
          </div>
        </main>
      )}

      {/* ════════ VISÃO OBREIRO DE ESCOLA ═══════════════════════════════════════════════ */}
      {isObreiroEted && (
        <main className="p-4 md:p-6 space-y-4 max-w-2xl">

          {/* Info da escola */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-900">{escola.name}</h2>
              {(escola as unknown as { subtitle: string | null }).subtitle && (
                <p className="text-sm text-gray-500 mt-1">{(escola as unknown as { subtitle: string | null }).subtitle}</p>
              )}
            </div>
            <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${escola.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {escola.active ? 'Ativa' : 'Inativa'}
            </span>
          </div>

          {/* Turmas — links rápidos */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Turmas ({turmas?.length ?? 0})</h2>
            {turmas && turmas.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {turmas.map(t => (
                  <li key={t.id}>
                    <Link href={`/${slug}/escolas/${id}/turmas/${t.id}`}
                      className="flex items-center justify-between py-2.5 hover:text-brand-600 transition-colors group">
                      <div>
                        <p className="text-sm font-medium text-gray-900 group-hover:text-brand-700">{t.name}</p>
                        <p className="text-xs text-gray-400">
                          {[t.year, t.semester ? `${t.semester}º sem.` : null].filter(Boolean).join(' · ')}
                          {t.starts_at ? ` · Início: ${new Date(t.starts_at).toLocaleDateString('pt-BR')}` : ''}
                        </p>
                      </div>
                      <span className="text-gray-300 group-hover:text-brand-400">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">Nenhuma turma cadastrada.</p>
            )}
          </div>

          {/* Incorporar no site */}
          {publicUrl && (escola as unknown as { is_public: boolean }).is_public && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Incorporar no site</h2>
              <p className="text-xs text-gray-400 mb-3">
                Cole este código no site da base para exibir o formulário de pré-inscrição diretamente.
              </p>
              <EmbedCodeBox embedPath={`${publicUrl}/embed`} />
            </div>
          )}

          {/* Reservas */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Reservas</h2>
            <p className="text-xs text-gray-400 mb-3">
              Solicite espaços para atividades ou quartos para professores convidados.
            </p>
            <Link href={`/${slug}/reservas`}
              className="block text-center w-full px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors">
              Solicitar / Ver Reservas →
            </Link>
          </div>
        </main>
      )}
    </>
  )
}

function Field({ label, name, defaultValue, placeholder, required }: {
  label: string; name: string; defaultValue?: string; placeholder?: string; required?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input name={name} defaultValue={defaultValue} placeholder={placeholder} required={required}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
    </div>
  )
}

function TextArea({ label, name, defaultValue, placeholder, rows }: {
  label: string; name: string; defaultValue?: string; placeholder?: string; rows?: number
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <textarea name={name} defaultValue={defaultValue} placeholder={placeholder} rows={rows ?? 3}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none" />
    </div>
  )
}

function Toggle({ name, label, description, defaultChecked }: {
  name: string; label: string; description?: string; defaultChecked?: boolean
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative mt-0.5">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="sr-only peer" />
        <div className="w-10 h-6 bg-gray-200 peer-checked:bg-brand-500 rounded-full transition-colors" />
        <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
    </label>
  )
}
