import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Heart, Phone, AlertCircle, ChevronLeft } from 'lucide-react'
import { MANAGEMENT_ROLES } from '@/lib/auth/permissions'
import { getRolePreview } from '@/lib/role-preview'

type Props = {
  params: Promise<{ slug: string; personId: string }>
}

const HEALTH_ROLES = [...MANAGEMENT_ROLES, 'dh', 'secretaria', 'lider_eted']

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="py-2.5 border-b border-gray-100 last:border-0">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-800 whitespace-pre-wrap">{value}</p>
    </div>
  )
}

function Section({ title, icon: Icon, children }: {
  title: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
        <Icon size={16} className="text-gray-500" />
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="px-4 py-1">{children}</div>
    </div>
  )
}

export default async function SaudePage({ params }: Props) {
  const { slug, personId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: orgData } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .single()
  if (!orgData) notFound()
  const orgId = orgData.id

  // Verify access
  const { data: orgUsers } = await supabase
    .from('organization_users')
    .select('organization_id, roles(name)')
    .eq('user_id', user.id)
    .eq('active', true)
  const userOrgRows = (orgUsers ?? []) as unknown as Array<{ organization_id: string | null; roles: { name: string } | null }>
  const superadminRow = userOrgRows.find(r => r.roles?.name === 'superadmin')
  const currentOrgRow = userOrgRows.find(r => r.organization_id === orgId)
  const realRole = superadminRow?.roles?.name ?? currentOrgRow?.roles?.name ?? ''
  const preview = await getRolePreview(realRole)
  const userRole = preview?.role ?? realRole

  if (!HEALTH_ROLES.includes(userRole as never)) redirect(`/${slug}/pessoas`)

  const db = createAdminClient()

  // Fetch person
  const { data: person } = await db
    .from('people')
    .select('id, full_name')
    .eq('id', personId)
    .eq('organization_id', orgId)
    .single()
  if (!person) notFound()

  // Try person_health_info first (from migration 053)
  let health: Record<string, string | null> = {}
  let healthRow: Record<string, unknown> | null = null
  try {
    const { data } = await db
      .from('person_health_info')
      .select('*')
      .eq('person_id', personId)
      .maybeSingle()
    healthRow = data as Record<string, unknown> | null
  } catch { /* tabela ainda não existe — migration pendente */ }

  if (healthRow) {
    health = {
      blood_type:              (healthRow as Record<string, unknown>).blood_type as string ?? null,
      allergies:               (healthRow as Record<string, unknown>).allergies as string ?? null,
      medications:             (healthRow as Record<string, unknown>).medications as string ?? null,
      health_conditions:       (healthRow as Record<string, unknown>).health_conditions as string ?? null,
      emergency_contact_name:  (healthRow as Record<string, unknown>).emergency_contact_name as string ?? null,
      emergency_contact_phone: (healthRow as Record<string, unknown>).emergency_contact_phone as string ?? null,
      notes:                   (healthRow as Record<string, unknown>).notes as string ?? null,
    }
  } else {
    // Fallback: read from latest approved school_application form_data
    const { data: app } = await db
      .from('school_applications')
      .select('form_data')
      .eq('person_id', personId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (app?.form_data) {
      const fd = app.form_data as Record<string, unknown>
      health = {
        blood_type:              null,
        allergies:               (fd.alergias as string) ?? null,
        medications:             fd.usa_medicamento === 'sim' ? (fd.med_nome as string ?? 'Sim') : null,
        health_conditions:       (fd.saude_geral as string) ?? null,
        emergency_contact_name:  fd.emergencia_nome ? `${fd.emergencia_nome}${fd.emergencia_parentesco ? ` (${fd.emergencia_parentesco})` : ''}` : null,
        emergency_contact_phone: (fd.emergencia_telefone as string) ?? null,
        notes:                   (fd.emergencia_medica as string) ?? null,
      }
    }
  }

  const hasAnyData = Object.values(health).some(Boolean)

  return (
    <>
      <Header
        title={person.full_name}
        actions={
          <Link
            href={`/${slug}/pessoas?tab=alunos`}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ChevronLeft size={16} />
            Voltar
          </Link>
        }
      />
      <main className="p-4 md:p-6 space-y-4 max-w-xl">

        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Link href={`/${slug}/pessoas`} className="hover:text-brand-500">Pessoas</Link>
          <span>/</span>
          <span>{person.full_name}</span>
          <span>/</span>
          <span className="text-gray-600 font-medium">Saúde</span>
        </div>

        {!hasAnyData ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
            <Heart size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium text-sm">Nenhuma ficha de saúde encontrada</p>
            <p className="text-gray-400 text-xs mt-1">
              Os dados são preenchidos no formulário de inscrição ou podem ser adicionados manualmente.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Section title="Saúde Geral" icon={Heart}>
              <InfoRow label="Tipo sanguíneo" value={health.blood_type} />
              <InfoRow label="Alergias" value={health.allergies} />
              <InfoRow label="Condições de saúde" value={health.health_conditions} />
              <InfoRow label="Medicamentos contínuos" value={health.medications} />
              {!health.blood_type && !health.allergies && !health.health_conditions && !health.medications && (
                <p className="text-xs text-gray-400 py-3">Sem informações de saúde registradas.</p>
              )}
            </Section>

            <Section title="Contato de Emergência" icon={Phone}>
              <InfoRow label="Nome e parentesco" value={health.emergency_contact_name} />
              <InfoRow label="Telefone" value={health.emergency_contact_phone} />
              <InfoRow label="Orientações médicas de emergência" value={health.notes} />
              {!health.emergency_contact_name && !health.emergency_contact_phone && !health.notes && (
                <p className="text-xs text-gray-400 py-3">Sem contato de emergência registrado.</p>
              )}
            </Section>

            {health.notes && (
              <Section title="Observações" icon={AlertCircle}>
                <InfoRow label="Orientações de emergência" value={health.notes} />
              </Section>
            )}
          </div>
        )}

        <p className="text-xs text-gray-400 text-center">
          Dados coletados no formulário de inscrição. Acesso restrito a gestores.
        </p>
      </main>
    </>
  )
}
