import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import Link from 'next/link'
import { redirect } from 'next/navigation'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ tab?: string }>
}

const TABS = [
  { key: 'todos',       label: 'Todos' },
  { key: 'inscricoes',  label: 'Inscrições' },
  { key: 'obreiros',    label: 'Obreiros' },
  { key: 'alunos',      label: 'Alunos' },
  { key: 'voluntarios', label: 'Voluntários' },
  { key: 'associados',  label: 'Associados' },
]

const OBREIRO_STATUS_COLORS: Record<string, string> = {
  true:  'bg-green-50 text-green-700',
  false: 'bg-gray-100 text-gray-500',
}

const STUDENT_APP_STATUS: Record<string, { label: string; color: string }> = {
  pendente:   { label: 'Pendente',   color: 'bg-yellow-100 text-yellow-700' },
  em_analise: { label: 'Em análise', color: 'bg-blue-100 text-blue-700' },
  aprovado:   { label: 'Aprovado',   color: 'bg-green-50 text-green-700' },
  reprovado:  { label: 'Reprovado',  color: 'bg-red-50 text-red-700' },
  cancelado:  { label: 'Cancelado',  color: 'bg-gray-100 text-gray-500' },
}

const INTEREST_STATUS: Record<string, { label: string; color: string }> = {
  pendente:           { label: 'Pendente',      color: 'bg-yellow-100 text-yellow-700' },
  formulario_enviado: { label: 'Form. enviado',  color: 'bg-blue-100 text-blue-700' },
  em_contato:         { label: 'Em contato',    color: 'bg-purple-100 text-purple-700' },
  em_analise:         { label: 'Em análise',    color: 'bg-blue-100 text-blue-700' },
}

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

function urgencyBadge(dias: number) {
  if (dias <= 1) return { label: dias === 0 ? 'Hoje' : '1d', color: 'bg-green-100 text-green-700' }
  if (dias === 2) return { label: '2d', color: 'bg-yellow-100 text-yellow-700' }
  if (dias === 3) return { label: '3d', color: 'bg-orange-100 text-orange-700' }
  return { label: `${dias}d`, color: 'bg-red-100 text-red-700' }
}

export default async function PessoasPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { tab = 'todos' } = await searchParams
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .single()

  const orgId = org?.id ?? ''

  // ── Server action: aprovar inscrito → Alunos ────────────────────────────
  async function aprovarInscrito(formData: FormData) {
    'use server'
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const sb = createAdminClient()

    const id = formData.get('id') as string
    const email = (formData.get('email') as string | null)?.toLowerCase() ?? ''
    const orgIdForm = formData.get('org_id') as string

    // Resolve person_id via e-mail (funciona com ou sem a coluna person_id na tabela)
    let personId: string | null = null
    if (email) {
      const { data: contact } = await sb
        .from('person_contacts')
        .select('person_id')
        .eq('type', 'email')
        .eq('value', email)
        .maybeSingle()
      personId = contact?.person_id ?? null
    }

    if (personId) {
      const { data: existing } = await sb
        .from('student_profiles')
        .select('id')
        .eq('person_id', personId)
        .maybeSingle()

      if (!existing) {
        await sb.from('student_profiles').insert({
          organization_id: orgIdForm,
          person_id: personId,
          active: true,
        })
      }

      // Tenta remover marcação de pré-inscrito (ignora erro se coluna source não existir)
      await sb.from('people').update({ source: null }).eq('id', personId)
    }

    // Marca o formulário como convertido (sai de Pendentes e de Inscritos)
    await sb.from('school_interest_forms')
      .update({ status: 'convertido' })
      .eq('id', id)

    redirect(`/${slug}/pessoas?tab=alunos`)
  }

  // ── Dados por aba ──────────────────────────────────────────────────────

  type InscritoItem = {
    id: string
    tipo: string
    tipoColor: string
    nome: string
    email: string | null
    escola: string | null
    status: string
    criadoEm: string
    diasAberto: number
  }

  const FINALIZADO = ['convertido', 'aprovado', 'descartado', 'reprovado', 'cancelado']

  let inscritoItems: InscritoItem[] = []

  if (tab === 'inscricoes') {
    const sbAdmin = createAdminClient()

    // Pré-inscrições públicas
    type IFRaw = { id: string; full_name: string; email: string; status: string; created_at: string; schools: { name: string } | null }
    const { data: iforms } = await sbAdmin
      .from('school_interest_forms')
      .select('id, full_name, email, status, created_at, schools(name)')
      .eq('organization_id', orgId)
      .not('status', 'in', '("convertido","descartado")')
      .order('created_at', { ascending: false })
    for (const r of ((iforms ?? []) as unknown as IFRaw[])) {
      inscritoItems.push({
        id: r.id, tipo: 'Pré-inscrição', tipoColor: 'bg-indigo-50 text-indigo-700',
        nome: r.full_name, email: r.email,
        escola: (r.schools as { name: string } | null)?.name ?? null,
        status: r.status, criadoEm: r.created_at, diasAberto: daysAgo(r.created_at),
      })
    }

    // Candidatos a Aluno
    type SAraw = { id: string; status: string; applied_at: string; people: { full_name: string } | null; schools: { name: string } | null }
    const { data: sapps } = await sbAdmin
      .from('student_applications')
      .select('id, status, applied_at, people(full_name), schools(name)')
      .eq('organization_id', orgId)
      .not('status', 'in', '("aprovado","reprovado","cancelado")')
      .order('applied_at', { ascending: false })
    for (const r of ((sapps ?? []) as unknown as SAraw[])) {
      inscritoItems.push({
        id: r.id, tipo: 'Candidato a Aluno', tipoColor: 'bg-sky-50 text-sky-700',
        nome: r.people?.full_name ?? '—', email: null,
        escola: (r.schools as { name: string } | null)?.name ?? null,
        status: r.status, criadoEm: r.applied_at, diasAberto: daysAgo(r.applied_at),
      })
    }

    // Candidatos a Obreiro
    type StaffRaw = { id: string; status: string; applied_at: string; people: { full_name: string } | null }
    const { data: staffapps } = await sbAdmin
      .from('staff_applications')
      .select('id, status, applied_at, people(full_name)')
      .eq('organization_id', orgId)
      .not('status', 'in', '("aprovado","reprovado","cancelado")')
      .order('applied_at', { ascending: false })
    for (const r of ((staffapps ?? []) as unknown as StaffRaw[])) {
      inscritoItems.push({
        id: r.id, tipo: 'Candidato a Obreiro', tipoColor: 'bg-amber-50 text-amber-700',
        nome: r.people?.full_name ?? '—', email: null, escola: null,
        status: r.status, criadoEm: r.applied_at, diasAberto: daysAgo(r.applied_at),
      })
    }

    inscritoItems.sort((a, b) => b.diasAberto - a.diasAberto)
  }

  type Row = {
    id: string
    nome: string
    detalhe: string | null
    col2: string
    col2Label: string
    badge: { label: string; color: string } | null
  }

  let rows: Row[] = []

  if (tab === 'todos') {
    // Exclui pré-inscritos ainda não convertidos (ficam na aba Inscritos)
    let query = supabase
      .from('people')
      .select('id, full_name, preferred_name, gender, source')
      .eq('organization_id', orgId)
      .order('full_name')

    const { data, error } = await query

    if (!error) {
      rows = ((data ?? []) as unknown as { id: string; full_name: string; preferred_name: string | null; gender: string | null; source: string | null }[])
        .filter(p => p.source !== 'pre_inscricao_publica')
        .map(p => ({
          id: p.id,
          nome: p.full_name,
          detalhe: p.preferred_name ?? null,
          col2: p.gender ?? '—',
          col2Label: 'Gênero',
          badge: null,
        }))
    } else {
      // Fallback se a coluna source ainda não existir (migration pendente)
      const { data: fallbackData } = await supabase
        .from('people')
        .select('id, full_name, preferred_name, gender')
        .eq('organization_id', orgId)
        .order('full_name')

      rows = (fallbackData ?? []).map(p => ({
        id: p.id,
        nome: p.full_name,
        detalhe: p.preferred_name ?? null,
        col2: p.gender ?? '—',
        col2Label: 'Gênero',
        badge: null,
      }))
    }
  }

  if (tab === 'obreiros') {
    type ObreiroRaw = { id: string; role_title: string | null; area: string | null; active: boolean; people: { full_name: string } | null }
    const { data } = await supabase
      .from('staff_profiles')
      .select('id, role_title, area, active, people(full_name)')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
    rows = ((data ?? []) as unknown as ObreiroRaw[]).map(s => ({
      id: s.id,
      nome: s.people?.full_name ?? '—',
      detalhe: s.area ?? null,
      col2: s.role_title ?? '—',
      col2Label: 'Função',
      badge: { label: s.active ? 'Ativo' : 'Inativo', color: OBREIRO_STATUS_COLORS[String(s.active)] },
    }))
  }

  if (tab === 'alunos') {
    type AlunoRaw = { id: string; active: boolean; people: { full_name: string } | null }
    const { data } = await supabase
      .from('student_profiles')
      .select('id, active, people(full_name)')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
    rows = ((data ?? []) as unknown as AlunoRaw[]).map(s => {
      const appStatus = s.active ? 'aprovado' : 'cancelado'
      const statusInfo = STUDENT_APP_STATUS[appStatus] ?? { label: appStatus, color: 'bg-gray-100 text-gray-500' }
      return {
        id: s.id,
        nome: s.people?.full_name ?? '—',
        detalhe: null,
        col2: s.active ? 'Matriculado' : 'Inativo',
        col2Label: 'Situação',
        badge: statusInfo,
      }
    })
  }

  if (tab === 'voluntarios' || tab === 'associados') {
    type StatusRaw = { id: string; person_id: string; status: string; started_at: string; people: { id: string; full_name: string } | null }
    const { data } = await supabase
      .from('person_status_history')
      .select('id, person_id, status, started_at, people(id, full_name)')
      .eq('status', tab === 'voluntarios' ? 'voluntario' : 'associado')
      .is('ended_at', null)
      .order('started_at', { ascending: false })
    rows = ((data ?? []) as unknown as StatusRaw[])
      .filter(r => r.people != null)
      .map(r => ({
        id: r.id,
        nome: r.people?.full_name ?? '—',
        detalhe: null,
        col2: new Date(r.started_at).toLocaleDateString('pt-BR'),
        col2Label: 'Desde',
        badge: { label: tab === 'voluntarios' ? 'Voluntário' : 'Associado', color: 'bg-indigo-50 text-indigo-700' },
      }))
  }

  const col2Label = rows[0]?.col2Label ?? 'Detalhe'

  return (
    <>
      <Header
        title="Pessoas"
        actions={
          <button className="px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600">
            + Nova pessoa
          </button>
        }
      />
      <main className="p-4 md:p-6 space-y-4">

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit overflow-x-auto">
          {TABS.map(t => (
            <Link
              key={t.key}
              href={`/${slug}/pessoas?tab=${t.key}`}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {/* ── Aba Inscrições ────────────────────────────────────────────────── */}
        {tab === 'inscricoes' && (
          <>
            {!inscritoItems.length ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
                <p className="text-gray-400 text-sm">Nenhuma inscrição pendente.</p>
                <Link href={`/${slug}/inscricoes`} className="text-xs text-brand-500 hover:underline mt-2 inline-block">
                  Ver todas as inscrições →
                </Link>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-xs text-gray-400">{inscritoItems.length} inscrição{inscritoItems.length !== 1 ? 'ões' : ''} ativa{inscritoItems.length !== 1 ? 's' : ''}</p>
                  <Link href={`/${slug}/inscricoes`} className="text-xs text-brand-500 hover:text-brand-700 font-medium">
                    Gerenciar todas →
                  </Link>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 w-14">Dias</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                      <th className="hidden sm:table-cell text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                      <th className="hidden md:table-cell text-left px-4 py-3 font-medium text-gray-600">Escola</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {inscritoItems.map(item => {
                      const urgency = urgencyBadge(item.diasAberto)
                      const statusInfo = INTEREST_STATUS[item.status] ?? { label: item.status, color: 'bg-gray-100 text-gray-500' }
                      const tabDestino = item.tipo === 'Pré-inscrição' ? 'pre_inscricao' : item.tipo === 'Candidato a Aluno' ? 'aluno' : 'obreiro'
                      return (
                        <tr key={`${item.tipo}-${item.id}`} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${urgency.color}`}>
                              {urgency.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{item.nome}</p>
                            {item.email && <p className="text-xs text-gray-400">{item.email}</p>}
                          </td>
                          <td className="hidden sm:table-cell px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.tipoColor}`}>
                              {item.tipo}
                            </span>
                          </td>
                          <td className="hidden md:table-cell px-4 py-3 text-xs text-gray-500">
                            {item.escola ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/${slug}/inscricoes?tab=${tabDestino}`}
                              className="text-xs text-brand-500 hover:text-brand-700 font-medium"
                            >
                              Gerenciar →
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── Abas padrão ───────────────────────────────────────────────────── */}
        {tab !== 'inscricoes' && (
          <>
            {!rows.length ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
                <p className="text-gray-400 text-sm">Nenhum registro encontrado nesta categoria.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                      <th className="hidden md:table-cell text-left px-4 py-3 font-medium text-gray-600">{col2Label}</th>
                      <th className="hidden md:table-cell text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{r.nome}</p>
                          {r.detalhe && <p className="text-xs text-gray-400">{r.detalhe}</p>}
                        </td>
                        <td className="hidden md:table-cell px-4 py-3 text-gray-500">{r.col2}</td>
                        <td className="hidden md:table-cell px-4 py-3">
                          {r.badge ? (
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${r.badge.color}`}>
                              {r.badge.label}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </>
  )
}
