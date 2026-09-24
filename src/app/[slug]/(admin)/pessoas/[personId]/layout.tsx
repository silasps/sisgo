import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { WorkspaceTabBar } from '@/components/layout/WorkspaceTabBar'
import { notFound, redirect } from 'next/navigation'
import { getCurrentOrganizationRole } from '@/lib/auth/org-role'
import { PROFILE_ROLES, HEALTH_ROLES, MANAGEMENT_ROLES } from '@/lib/auth/permissions'
import { requestEmergencyAccess } from './emergencia/actions'
import { REASON_LABELS } from './emergencia/constants'
import { EmergencyRequestForm } from './emergencia/EmergencyRequestForm'
import { AlertTriangle } from 'lucide-react'

type Props = {
  children: React.ReactNode
  params: Promise<{ slug: string; personId: string }>
}

const LIDERANCA_ROLES = ['lider_ministerio', 'lider_eted']

export default async function PessoaWorkspaceLayout({ children, params }: Props) {
  const { slug, personId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single()
  if (!org) notFound()

  const { role } = await getCurrentOrganizationRole(supabase, user.id, org.id)

  const db = createAdminClient()
  const { data: person } = await db
    .from('people')
    .select('id, full_name')
    .eq('id', personId)
    .eq('organization_id', org.id)
    .single()
  if (!person) notFound()

  if (!PROFILE_ROLES.includes(role as never)) {
    // Sem acesso ao perfil completo (isso é do DH) — só líder de
    // ministério/escola pode abrir um acesso de emergência limitado;
    // qualquer outro papel continua barrado, como já era.
    if (!LIDERANCA_ROLES.includes(role)) redirect(`/${slug}/pessoas`)

    const { data: activeGrant } = await db
      .from('person_emergency_access')
      .select('id, reason_category, reason_text, granted_at, expires_at')
      .eq('organization_id', org.id)
      .eq('person_id', personId)
      .eq('requested_by', user.id)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('granted_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!activeGrant) {
      return (
        <>
          <Header title={person.full_name} backHref={`/${slug}/pessoas`} />
          <EmergencyRequestForm
            personName={person.full_name}
            action={requestEmergencyAccess.bind(null, personId, org.id, slug)}
          />
        </>
      )
    }

    const { data: contacts } = await db.from('person_contacts').select('type, value').eq('person_id', personId)
    const { data: docs } = await db.from('person_documents').select('type, number').eq('person_id', personId)
    const expiresLabel = new Date(activeGrant.expires_at).toLocaleString('pt-BR')

    return (
      <>
        <Header title={person.full_name} backHref={`/${slug}/pessoas`} />
        <main className="p-4 md:p-6 max-w-2xl space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 flex items-start gap-3">
            <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="font-semibold">Acesso de emergência ativo até {expiresLabel}</p>
              <p className="text-amber-800 mt-0.5">
                Motivo: {REASON_LABELS[activeGrant.reason_category] ?? activeGrant.reason_category} — &ldquo;{activeGrant.reason_text}&rdquo;
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-2">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Dados de contato</h2>
            {(contacts ?? []).length === 0 && (docs ?? []).length === 0 && (
              <p className="text-sm text-gray-400">Nenhum contato ou documento cadastrado.</p>
            )}
            {(contacts ?? []).map((c, i) => (
              <p key={i} className="text-sm text-gray-700"><span className="text-gray-400">{c.type}:</span> {c.value}</p>
            ))}
            {(docs ?? []).map((d, i) => (
              <p key={i} className="text-sm text-gray-700"><span className="text-gray-400">{d.type}:</span> {d.number}</p>
            ))}
          </div>
        </main>
      </>
    )
  }

  type SchoolLinkRaw = { role: string; schools: { name: string } | null }
  type MinistryLinkRaw = { ministry_roles: { name: string } | null; ministries: { name: string } | null }
  const [{ data: schoolLinksRaw }, { data: ministryLinksRaw }] = await Promise.all([
    db.from('school_staff').select('role, schools(name)').eq('person_id', personId).eq('active', true),
    db.from('ministry_members').select('ministry_roles(name), ministries(name)').eq('person_id', personId).eq('active', true),
  ])
  const serveEmLabels = [
    ...((schoolLinksRaw ?? []) as unknown as SchoolLinkRaw[])
      .filter(l => l.schools)
      .map(l => `${l.schools!.name} (${l.role})`),
    ...((ministryLinksRaw ?? []) as unknown as MinistryLinkRaw[])
      .filter(l => l.ministries)
      .map(l => `${l.ministries!.name}${l.ministry_roles ? ` (${l.ministry_roles.name})` : ''}`),
  ]

  const base = `/${slug}/pessoas/${personId}`
  const tabs = [
    { href: `${base}/carteirinha`, label: 'Carteirinha' },
    { href: `${base}/financeiro`, label: 'Financeiro' },
    { href: `${base}/hospedagem`, label: 'Hospedagem' },
    ...(MANAGEMENT_ROLES.includes(role as never) ? [{ href: `${base}/transferencias`, label: 'Transferências' }] : []),
    ...(MANAGEMENT_ROLES.includes(role as never) ? [{ href: `${base}/acesso`, label: 'Acesso' }] : []),
    ...(HEALTH_ROLES.includes(role as never) ? [{ href: `${base}/saude`, label: 'Saúde' }] : []),
  ]

  return (
    <>
      <Header title={person.full_name} backHref={`/${slug}/pessoas`} />
      <div className="px-4 md:px-6 pt-2.5 pb-2 bg-white border-b border-gray-100">
        <p className="text-xs text-gray-500">
          <span className="font-medium text-gray-600">Serve em:</span>{' '}
          {serveEmLabels.length > 0 ? serveEmLabels.join(' · ') : 'Nenhum vínculo com escola ou ministério ainda.'}
        </p>
      </div>
      <WorkspaceTabBar tabs={tabs} />
      {children}
    </>
  )
}
