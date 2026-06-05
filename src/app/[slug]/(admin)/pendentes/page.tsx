import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import Link from 'next/link'

type Props = { params: Promise<{ slug: string }> }

const MANAGEMENT_ROLES = ['superadmin', 'admin_base', 'lider_base', 'dh']

type PendenteItem = {
  id: string
  categoria: string
  nome: string
  escola: string | null
  status: string
  statusLabel: string
  statusColor: string
  criadoEm: string
  diasAberto: number
  linkDestino: string
  overflow: boolean        // true = apareceu por regra dos 3 dias (não é a escola do líder)
  overflowEscola?: string  // nome da escola original para exibir no overflow
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pendente:           { label: 'Pendente',      color: 'bg-yellow-100 text-yellow-700' },
  formulario_enviado: { label: 'Form. enviado',  color: 'bg-blue-100 text-blue-700' },
  em_contato:         { label: 'Em contato',    color: 'bg-purple-100 text-purple-700' },
  em_analise:         { label: 'Em análise',    color: 'bg-blue-100 text-blue-700' },
}

/** Contador de dias com cor progressiva */
function urgencyBadge(dias: number): { label: string; color: string } {
  if (dias === 0) return { label: 'Hoje', color: 'bg-green-100 text-green-700' }
  if (dias === 1) return { label: '1d',   color: 'bg-green-100 text-green-700' }
  if (dias === 2) return { label: '2d',   color: 'bg-yellow-100 text-yellow-700' }
  if (dias === 3) return { label: '3d',   color: 'bg-orange-100 text-orange-700' }
  return              { label: `${dias}d`, color: 'bg-red-100 text-red-700' }
}

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

export default async function PendentesPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .single()

  const orgId = org?.id ?? ''

  const { data: { user } } = await supabase.auth.getUser()
  const { data: orgUser } = await supabase
    .from('organization_users')
    .select('roles(name), user_id')
    .eq('user_id', user?.id ?? '')
    .eq('active', true)
    .single()

  const role = (orgUser?.roles as unknown as { name: string } | null)?.name ?? ''
  const isManagement = MANAGEMENT_ROLES.includes(role)
  const isLiderEted = role === 'lider_eted'

  // Escola(s) que este lider_eted gerencia
  let liderEtedSchoolIds: string[] = []
  if (isLiderEted && user) {
    const { data: leaderRows } = await supabase
      .from('school_leaders')
      .select('school_id')
      .eq('user_id', user.id)
    liderEtedSchoolIds = (leaderRows ?? []).map(r => r.school_id)
  }

  const items: PendenteItem[] = []

  // ── 1. Pré-inscrições (school_interest_forms) ─────────────────────────────
  // Usa admin client para contornar RLS enquanto a migration 007 não for aplicada.
  // A filtragem por org e por escola do líder é feita abaixo na aplicação.
  if (isManagement || isLiderEted) {
    const sbAdmin = createAdminClient()

    type InterestRaw = {
      id: string
      full_name: string
      status: string
      created_at: string
      schools: { id: string; name: string } | null
      school_classes: { name: string } | null
    }

    const { data: interests } = await sbAdmin
      .from('school_interest_forms')
      .select('id, full_name, status, created_at, schools(id, name), school_classes(name)')
      .eq('organization_id', orgId)
      .not('status', 'in', '("convertido","descartado")')
      .order('created_at', { ascending: true })

    for (const r of ((interests ?? []) as unknown as InterestRaw[])) {
      const escola = r.schools as { id: string; name: string } | null
      const turma = r.school_classes as { name: string } | null
      const dias = daysAgo(r.created_at)
      const schoolId = escola?.id

      if (isLiderEted) {
        const isOwnerSchool = schoolId ? liderEtedSchoolIds.includes(schoolId) : false
        // Regra dos 3 dias: após 3 dias sem resposta (status ainda 'pendente'),
        // aparece para outros líderes como overflow
        const isOverflow = !isOwnerSchool && dias >= 3 && r.status === 'pendente'
        if (!isOwnerSchool && !isOverflow) continue
      }

      const isOverflow = isLiderEted && schoolId ? !liderEtedSchoolIds.includes(schoolId) : false
      const statusInfo = STATUS_LABELS[r.status] ?? { label: r.status, color: 'bg-gray-100 text-gray-500' }

      items.push({
        id: r.id,
        categoria: 'Pré-inscrição',
        nome: r.full_name,
        escola: escola ? `${escola.name}${turma?.name ? ` · ${turma.name}` : ''}` : null,
        status: r.status,
        statusLabel: statusInfo.label,
        statusColor: statusInfo.color,
        criadoEm: r.created_at,
        diasAberto: dias,
        linkDestino: `/${slug}/inscricoes`,
        overflow: isOverflow,
        overflowEscola: isOverflow ? (escola?.name ?? undefined) : undefined,
      })
    }
  }

  // ── 2. Candidatos a Alunos ────────────────────────────────────────────────
  if (isManagement || isLiderEted) {
    type StudentAppRaw = {
      id: string
      status: string
      applied_at: string
      people: { full_name: string } | null
      schools: { id: string; name: string } | null
    }

    const { data: studentApps } = await supabase
      .from('student_applications')
      .select('id, status, applied_at, people(full_name), schools(id, name)')
      .eq('organization_id', orgId)
      .in('status', ['pendente', 'em_analise'])
      .order('applied_at', { ascending: true })

    for (const r of ((studentApps ?? []) as unknown as StudentAppRaw[])) {
      if (isLiderEted) {
        const schoolId = (r.schools as { id: string; name: string } | null)?.id
        if (!schoolId || !liderEtedSchoolIds.includes(schoolId)) continue
      }
      const statusInfo = STATUS_LABELS[r.status] ?? { label: r.status, color: 'bg-gray-100 text-gray-500' }
      const escola = r.schools as { id: string; name: string } | null
      items.push({
        id: r.id,
        categoria: 'Candidato a Aluno',
        nome: r.people?.full_name ?? '—',
        escola: escola?.name ?? null,
        status: r.status,
        statusLabel: statusInfo.label,
        statusColor: statusInfo.color,
        criadoEm: r.applied_at,
        diasAberto: daysAgo(r.applied_at),
        linkDestino: `/${slug}/pessoas?tab=alunos`,
        overflow: false,
      })
    }
  }

  // ── 3. Candidatos a Obreiros — apenas gestão ──────────────────────────────
  if (isManagement) {
    type StaffAppRaw = {
      id: string
      status: string
      applied_at: string
      people: { full_name: string } | null
    }

    const { data: staffApps } = await supabase
      .from('staff_applications')
      .select('id, status, applied_at, people(full_name)')
      .eq('organization_id', orgId)
      .in('status', ['pendente', 'em_analise'])
      .order('applied_at', { ascending: true })

    for (const r of ((staffApps ?? []) as unknown as StaffAppRaw[])) {
      const statusInfo = STATUS_LABELS[r.status] ?? { label: r.status, color: 'bg-gray-100 text-gray-500' }
      items.push({
        id: r.id,
        categoria: 'Candidato a Obreiro',
        nome: r.people?.full_name ?? '—',
        escola: null,
        status: r.status,
        statusLabel: statusInfo.label,
        statusColor: statusInfo.color,
        criadoEm: r.applied_at,
        diasAberto: daysAgo(r.applied_at),
        linkDestino: `/${slug}/pessoas?tab=obreiros`,
        overflow: false,
      })
    }
  }

  // Mais urgentes primeiro (mais antigos = mais dias)
  items.sort((a, b) => b.diasAberto - a.diasAberto)

  const totalUrgentes = items.filter(i => i.diasAberto >= 3).length

  return (
    <>
      <Header
        title="Pendentes"
        actions={
          totalUrgentes > 0 ? (
            <span className="px-3 py-1 bg-red-100 text-red-700 text-sm font-semibold rounded-full">
              {totalUrgentes} urgente{totalUrgentes !== 1 ? 's' : ''}
            </span>
          ) : undefined
        }
      />
      <main className="p-4 md:p-6">
        {!items.length ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
            <p className="text-3xl mb-3">✓</p>
            <p className="text-gray-400 text-sm">Nenhuma pendência no momento.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-14">Dias</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                  <th className="hidden sm:table-cell text-left px-4 py-3 font-medium text-gray-600">Categoria</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 font-medium text-gray-600">Escola / ETED</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 w-14"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map(item => {
                  const urgency = urgencyBadge(item.diasAberto)
                  return (
                    <tr key={`${item.categoria}-${item.id}`} className={`hover:bg-gray-50 ${item.overflow ? 'bg-orange-50/40' : ''}`}>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${urgency.color}`}>
                          {urgency.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{item.nome}</p>
                        <p className="text-xs text-gray-400 sm:hidden">{item.categoria}</p>
                        {item.overflow && (
                          <p className="text-xs text-orange-600 font-medium mt-0.5">
                            Sem resposta em {item.overflowEscola} há {item.diasAberto}d
                          </p>
                        )}
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-gray-500">{item.categoria}</td>
                      <td className="hidden md:table-cell px-4 py-3 text-gray-500">
                        {item.escola ?? '—'}
                        {item.overflow && (
                          <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">
                            sem resposta
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${item.statusColor}`}>
                          {item.statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={item.linkDestino}
                          className="text-xs text-brand-500 hover:text-brand-700 font-medium"
                        >
                          Ver →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  )
}
