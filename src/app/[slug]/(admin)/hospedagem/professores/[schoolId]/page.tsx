import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { notFound, redirect } from 'next/navigation'
import { isManagementRole, userHasAnyRole, HOSPEDAGEM_ROLES } from '@/lib/auth/permissions'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { getSchoolLink } from '@/lib/auth/unit-access'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { ConfirmSubmitButton } from '@/components/ui/ConfirmSubmitButton'
import { InternationalPhoneField } from '@/components/ui/InternationalPhoneField'
import { createTeacherVisitRequest, authorizeTeacherVisitRequest, cancelTeacherVisitRequest } from '@/lib/school/teacherVisitRequests'

type Props = {
  params: Promise<{ slug: string; schoolId: string }>
  searchParams: Promise<{ msg?: string; erro?: string }>
}

const TEACHER_STATUS: Record<string, { label: string; cls: string }> = {
  aguardando: { label: 'Aguardando hospitalidade', cls: 'bg-amber-100 text-amber-700' },
  disponivel: { label: 'Hospedagem disponível', cls: 'bg-green-100 text-green-700' },
  sem_disponibilidade: { label: 'Sem vaga na hospedagem', cls: 'bg-red-100 text-red-700' },
}

export default async function ProfessorVisitanteEscolaPage({ params, searchParams }: Props) {
  const { slug, schoolId } = await params
  const { msg, erro } = await searchParams
  const supabase = await createClient()
  const sbAdmin = createAdminClient()

  const [{ data: { user } }, { data: org }, { data: escola }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('organizations').select('id').eq('slug', slug).single(),
    supabase.from('schools').select('id, name').eq('id', schoolId).maybeSingle(),
  ])
  if (!user || !org || !escola) notFound()
  const orgId = org.id

  const { role, preview, allRoles } = await getCurrentOrganizationRole(supabase, user.id, orgId)
  const isManagement = isManagementRole(role)
  const canSeeHospedagem = isManagement || userHasAnyRole(allRoles, HOSPEDAGEM_ROLES)
  const schoolLink = canSeeHospedagem ? null : await getSchoolLink({ userId: user.id, orgId, role, preview }, schoolId)

  const canRequest = canSeeHospedagem || role === 'lider_base' || schoolLink === 'lider' || schoolLink === 'obreiro'
  const canAuthorize = canSeeHospedagem || role === 'lider_base' || schoolLink === 'lider'
  let canViewList = canSeeHospedagem || schoolLink === 'lider'
  if (!canViewList && schoolLink === 'obreiro') {
    const { data: profiles } = await sbAdmin.from('staff_profiles').select('person_id').eq('organization_id', orgId).eq('user_id', user.id)
    const personIds = [...new Set((profiles ?? []).map(p => p.person_id))]
    if (personIds.length > 0) {
      const { data: accessRows } = await sbAdmin.from('school_teacher_lodging_access')
        .select('id').eq('school_id', schoolId).in('person_id', personIds).eq('can_view', true).limit(1)
      canViewList = (accessRows?.length ?? 0) > 0
    }
  }
  if (!canRequest && !canViewList) notFound()

  type TeacherVisitRaw = {
    id: string; full_name: string; email: string; phone: string
    teach_start_date: string; teach_end_date: string; arrival_at: string; departure_at: string
    needs_lodging: boolean; hospedagem_status: string | null; hospedagem_notes: string | null
    status: string; requested_by: string; created_at: string
  }
  let teacherVisits: TeacherVisitRaw[] = []
  if (canViewList) {
    const { data } = await sbAdmin
      .from('teacher_visit_requests')
      .select('id, full_name, email, phone, teach_start_date, teach_end_date, arrival_at, departure_at, needs_lodging, hospedagem_status, hospedagem_notes, status, requested_by, created_at')
      .eq('school_id', schoolId).order('created_at', { ascending: false }).limit(30)
    teacherVisits = (data ?? []) as unknown as TeacherVisitRaw[]
  }

  const base = `/${slug}/hospedagem/professores/${schoolId}`
  const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400'

  const handleCreateTeacherVisit = async (formData: FormData) => {
    'use server'
    const needsLodging = formData.get('needs_lodging') === 'sim'
    const result = await createTeacherVisitRequest({
      organizationId: orgId,
      schoolId,
      requestedBy: user.id,
      fullName: (formData.get('full_name') as string) ?? '',
      email: (formData.get('email') as string) ?? '',
      phone: (formData.get('phone') as string) ?? '',
      phoneCountry: (formData.get('phone_country') as string) || null,
      teachStartDate: (formData.get('teach_start_date') as string) ?? '',
      teachEndDate: (formData.get('teach_end_date') as string) ?? '',
      arrivalAt: (formData.get('arrival_at') as string) ?? '',
      departureAt: (formData.get('departure_at') as string) ?? '',
      needsLodging,
    })
    redirect(result.error ? `${base}?erro=${encodeURIComponent(result.error)}` : `${base}?msg=solicitado`)
  }
  const handleAuthorizeTeacherVisit = async (formData: FormData) => {
    'use server'
    const result = await authorizeTeacherVisitRequest({ requestId: formData.get('request_id') as string, authorizedBy: user.id })
    redirect(result.error ? `${base}?erro=${encodeURIComponent(result.error)}` : `${base}?msg=autorizado`)
  }
  const handleCancelTeacherVisit = async (formData: FormData) => {
    'use server'
    await cancelTeacherVisitRequest({ requestId: formData.get('request_id') as string, cancelledBy: user.id, reason: null })
    redirect(base)
  }

  const msgs: Record<string, { text: string; cls: string }> = {
    solicitado: { text: 'Solicitação de professor visitante enviada.', cls: 'bg-blue-50 border-blue-200 text-blue-700' },
    autorizado: { text: 'Vinda do professor autorizada.', cls: 'bg-green-50 border-green-200 text-green-700' },
  }
  const msgInfo = msg ? msgs[msg] : null

  return (
    <>
      <Header title={`Professor Visitante — ${escola.name}`} backHref={`/${slug}/hospedagem/professores`} />
      <main className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto overflow-y-auto flex-1">
        {msgInfo && <div className={`border rounded-lg px-4 py-3 text-sm ${msgInfo.cls}`}>{msgInfo.text}</div>}
        {erro && <div className="border rounded-lg px-4 py-3 text-sm bg-red-50 border-red-200 text-red-700">{erro}</div>}
        {!canViewList && canRequest && (
          <div className="border rounded-lg px-4 py-3 text-sm bg-gray-50 border-gray-200 text-gray-500">
            Você pode solicitar, mas não tem permissão pra ver as solicitações já abertas — peça ao líder da escola.
          </div>
        )}

        {canRequest && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <details open={teacherVisits.length === 0}>
              <summary className="text-sm text-brand-600 cursor-pointer select-none font-medium">+ Solicitar professor visitante</summary>
              <form action={handleCreateTeacherVisit} className="mt-3 space-y-3 max-w-md">
                <input name="full_name" required placeholder="Nome completo do professor" className={INPUT} />
                <input name="email" type="email" required placeholder="E-mail" className={INPUT} />
                <InternationalPhoneField phoneName="phone" countryName="phone_country" label="Telefone / WhatsApp" required />
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-[11px] text-gray-400 mb-1">Período de aula — início</label>
                    <input type="date" name="teach_start_date" required className={INPUT} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[11px] text-gray-400 mb-1">Período de aula — fim</label>
                    <input type="date" name="teach_end_date" required className={INPUT} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-[11px] text-gray-400 mb-1">Chegada na base</label>
                    <input type="datetime-local" name="arrival_at" required className={INPUT} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[11px] text-gray-400 mb-1">Saída da base</label>
                    <input type="datetime-local" name="departure_at" required className={INPUT} />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">Vai se hospedar na base?</label>
                  <select name="needs_lodging" defaultValue="nao" className={INPUT}>
                    <option value="nao">Não</option>
                    <option value="sim">Sim</option>
                  </select>
                </div>
                <SubmitButton pendingText="Enviando…" className="w-full px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white transition-colors">
                  Enviar Solicitação
                </SubmitButton>
              </form>
            </details>
          </div>
        )}

        {canViewList && teacherVisits.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Solicitações</h2>
            <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
              {teacherVisits.map(t => {
                const hospedagemBadge = t.needs_lodging && t.hospedagem_status ? TEACHER_STATUS[t.hospedagem_status] : null
                const readyToAuthorize = t.status === 'pendente' && (!t.needs_lodging || t.hospedagem_status !== 'aguardando')
                const canCancel = t.status === 'pendente' && (canAuthorize || t.requested_by === user.id)
                return (
                  <li key={t.id} className="border border-gray-100 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-800">{t.full_name}</p>
                      {t.status === 'autorizado' && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700">Autorizado</span>}
                      {t.status === 'cancelado' && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Cancelado</span>}
                    </div>
                    <p className="text-xs text-gray-500">
                      Aula: {new Date(`${t.teach_start_date}T00:00:00`).toLocaleDateString('pt-BR')} a {new Date(`${t.teach_end_date}T00:00:00`).toLocaleDateString('pt-BR')}
                    </p>
                    <p className="text-xs text-gray-400">
                      Chegada {new Date(t.arrival_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · Saída {new Date(t.departure_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                    {hospedagemBadge && (
                      <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${hospedagemBadge.cls}`}>{hospedagemBadge.label}</span>
                    )}
                    {t.hospedagem_notes && <p className="text-xs text-gray-400 italic">&ldquo;{t.hospedagem_notes}&rdquo;</p>}
                    {t.status === 'pendente' && (
                      <div className="flex gap-2 pt-1">
                        {canAuthorize && readyToAuthorize && (
                          <form action={handleAuthorizeTeacherVisit}>
                            <input type="hidden" name="request_id" value={t.id} />
                            <button type="submit" className="px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 transition-colors">Autorizar</button>
                          </form>
                        )}
                        {canCancel && (
                          <form action={handleCancelTeacherVisit}>
                            <input type="hidden" name="request_id" value={t.id} />
                            <ConfirmSubmitButton
                              confirmMessage={`Cancelar a solicitação do professor "${t.full_name}"?`}
                              title="Cancelar solicitação"
                              className="px-3 py-1.5 border border-red-200 text-red-500 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors"
                            >
                              Cancelar
                            </ConfirmSubmitButton>
                          </form>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </main>
    </>
  )
}
