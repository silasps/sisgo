import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { RecusarModal } from './RecusarModal'
import { DisponibilizarFormularioButton } from './DisponibilizarFormularioButton'
import { headers } from 'next/headers'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ tab?: string; ver?: string }>
}

type InscricaoItem = {
  id: string
  tipo: 'pre_inscricao' | 'aluno' | 'obreiro'
  tipoLabel: string
  tipoColor: string
  nome: string
  email: string | null
  phone: string | null
  escola: string | null
  schoolId: string | null
  turma: string | null
  mensagem: string | null
  status: string
  notes: string | null
  criadoEm: string
  diasAberto: number
  personId: string | null
}

type HistoricoItem = {
  id: string
  tipo: string
  nome: string
  escola: string | null
  motivo: string
  recusadoEm: string
}

const TIPO_TABS = [
  { key: 'todas',         label: 'Todas' },
  { key: 'pre_inscricao', label: 'Pré-inscrições' },
  { key: 'aluno',         label: 'Alunos' },
  { key: 'obreiro',       label: 'Obreiros' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pendente:           { label: 'Pendente',      color: 'bg-yellow-100 text-yellow-700' },
  formulario_enviado: { label: 'Form. enviado', color: 'bg-blue-100 text-blue-700' },
  em_contato:         { label: 'Em contato',   color: 'bg-purple-100 text-purple-700' },
  em_analise:         { label: 'Em análise',   color: 'bg-blue-100 text-blue-700' },
  convertido:         { label: 'Convertido',   color: 'bg-green-100 text-green-700' },
  aprovado:           { label: 'Aprovado',     color: 'bg-green-100 text-green-700' },
  reprovado:          { label: 'Reprovado',    color: 'bg-red-100 text-red-700' },
  descartado:         { label: 'Recusado',     color: 'bg-gray-100 text-gray-500' },
  cancelado:          { label: 'Cancelado',    color: 'bg-gray-100 text-gray-500' },
}

function daysAgo(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}
function urgencyBorderColor(dias: number) {
  if (dias <= 1) return 'border-l-green-400'
  if (dias === 2) return 'border-l-yellow-400'
  if (dias === 3) return 'border-l-orange-400'
  return 'border-l-red-500'
}
function urgencyBadge(dias: number) {
  if (dias === 0) return { label: 'Hoje', color: 'bg-green-100 text-green-700' }
  if (dias === 1) return { label: '1d',   color: 'bg-green-100 text-green-700' }
  if (dias === 2) return { label: '2d',   color: 'bg-yellow-100 text-yellow-700' }
  if (dias === 3) return { label: '3d',   color: 'bg-orange-100 text-orange-700' }
  return { label: `${dias}d`, color: 'bg-red-100 text-red-700' }
}
const isFinalizado = (s: string) => ['convertido','aprovado','descartado','reprovado','cancelado'].includes(s)

export default async function InscricoesPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { tab = 'todas', ver = 'ativas' } = await searchParams

  const supabase = await createClient()
  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single()
  if (!org) notFound()

  const sb = createAdminClient()
  const orgId = org.id

  // ── Server actions ─────────────────────────────────────────────────────────

  async function updateStatus(formData: FormData) {
    'use server'
    const { createAdminClient: adm } = await import('@/lib/supabase/admin')
    const db = adm()
    const tipo = formData.get('tipo') as string
    const id   = formData.get('id') as string
    const status = formData.get('status') as string
    const now  = new Date().toISOString()
    if (tipo === 'pre_inscricao') {
      await db.from('school_interest_forms').update({ status, responded_at: now }).eq('id', id)
    } else if (tipo === 'aluno') {
      await db.from('student_applications').update({ status, reviewed_at: now }).eq('id', id)
    } else {
      await db.from('staff_applications').update({ status, reviewed_at: now }).eq('id', id)
    }
    const { redirect: redir } = await import('next/navigation')
    redir(`/${slug}/inscricoes?tab=${tipo === 'pre_inscricao' ? 'pre_inscricao' : tipo}`)
  }

  async function recusar(formData: FormData) {
    'use server'
    const { createAdminClient: adm } = await import('@/lib/supabase/admin')
    const db = adm()
    const tipo   = formData.get('tipo') as string
    const id     = formData.get('id') as string
    const reason = (formData.get('reason') as string)?.trim()
    if (!reason) return
    const now = new Date().toISOString()
    if (tipo === 'pre_inscricao') {
      await db.from('school_interest_forms')
        .update({ status: 'descartado', refusal_reason: reason, responded_at: now })
        .eq('id', id)
    } else if (tipo === 'aluno') {
      await db.from('student_applications')
        .update({ status: 'reprovado', refusal_reason: reason, reviewed_at: now })
        .eq('id', id)
    } else {
      await db.from('staff_applications')
        .update({ status: 'reprovado', reviewed_at: now })
        .eq('id', id)
    }
    // Note: router.refresh() is called in RecusarModal client component
  }

  async function aprovar(formData: FormData) {
    'use server'
    const { createAdminClient: adm } = await import('@/lib/supabase/admin')
    const db = adm()
    const tipo      = formData.get('tipo') as string
    const id        = formData.get('id') as string
    const email     = (formData.get('email') as string | null)?.toLowerCase() ?? ''
    const personIdI = formData.get('person_id') as string | null
    const orgIdForm = formData.get('org_id') as string
    const now       = new Date().toISOString()

    let personId = personIdI || null
    if (!personId && email) {
      const { data: contact } = await db.from('person_contacts').select('person_id')
        .eq('type', 'email').eq('value', email).maybeSingle()
      personId = contact?.person_id ?? null
    }
    if (personId) {
      const { data: existing } = await db.from('student_profiles').select('id').eq('person_id', personId).maybeSingle()
      if (!existing) {
        await db.from('student_profiles').insert({ organization_id: orgIdForm, person_id: personId, active: true })
      }
      await db.from('people').update({ source: null }).eq('id', personId)
    }
    if (tipo === 'pre_inscricao') {
      await db.from('school_interest_forms').update({ status: 'convertido', responded_at: now }).eq('id', id)
    } else if (tipo === 'aluno') {
      await db.from('student_applications').update({ status: 'aprovado', reviewed_at: now }).eq('id', id)
    }
    const { redirect: redir } = await import('next/navigation')
    redir(`/${slug}/pessoas?tab=alunos`)
  }

  async function disponibilizarFormulario(formData: FormData) {
    'use server'
    const { createAdminClient: adm } = await import('@/lib/supabase/admin')
    const db = adm()
    const { headers: hdrs } = await import('next/headers')

    const interestFormId = formData.get('interest_form_id') as string

    // Busca o interest form e a escola
    const { data: form } = await db
      .from('school_interest_forms')
      .select('id, organization_id, full_name, email, phone, language, school_id, class_id, schools(id, name, contact_email, smtp_password)')
      .eq('id', interestFormId)
      .single()

    if (!form) return { error: 'not_found' }

    const escola = form.schools as unknown as {
      id: string; name: string; contact_email: string | null; smtp_password: string | null
    } | null

    // Cria ou reutiliza school_applications
    const { data: existing } = await db
      .from('school_applications')
      .select('id, token, token_expires_at')
      .eq('interest_form_id', interestFormId)
      .in('status', ['rascunho', 'enviado'])
      .maybeSingle()

    let token: string
    let expiresAt: string

    if (existing) {
      token = existing.token
      expiresAt = existing.token_expires_at
    } else {
      const { data: newApp } = await db
        .from('school_applications')
        .insert({
          interest_form_id: interestFormId,
          organization_id: (form as unknown as { organization_id: string }).organization_id,
          school_id: form.school_id,
          class_id: form.class_id,
          status: 'rascunho',
          form_data: {
            prefill: {
              nome: form.full_name,
              email: form.email,
              telefone: form.phone,
              idioma: (form as unknown as { language?: string }).language,
            }
          },
        })
        .select('token, token_expires_at')
        .single()
      if (!newApp) return { error: 'Não foi possível criar o formulário.' }
      token = newApp.token
      expiresAt = newApp.token_expires_at
    }

    // Monta URL
    const headersList = await hdrs()
    const host = headersList.get('host') ?? 'localhost:3000'
    const protocol = host.startsWith('localhost') ? 'http' : 'https'
    const formUrl = `${protocol}://${host}/${slug}/formulario/${token}`

    // Tenta enviar e-mail somente se a escola tiver credenciais configuradas
    let emailWarning: string | undefined
    if (escola?.contact_email && escola?.smtp_password) {
      const { sendFormEmail } = await import('@/lib/email/sendFormEmail')
      const emailResult = await sendFormEmail({
        to: form.email,
        candidateName: form.full_name,
        schoolName: escola.name,
        formUrl,
        expiresAt,
        fromEmail: escola.contact_email,
        smtpPassword: escola.smtp_password,
      })
      if (!emailResult.success) emailWarning = 'email_falhou'
    } else {
      emailWarning = 'sem_email_eted'
    }

    // Atualiza status do interest form
    await db.from('school_interest_forms')
      .update({ status: 'formulario_enviado' })
      .eq('id', interestFormId)

    // Sempre retorna o link — e-mail é opcional
    return { url: formUrl, emailWarning, schoolId: escola?.id }
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  const items: InscricaoItem[] = []
  const historico: HistoricoItem[] = []

  // Pré-inscrições ativas
  if (tab === 'todas' || tab === 'pre_inscricao') {
    type IFRaw = {
      id: string; full_name: string; email: string; phone: string | null
      message: string | null; status: string; created_at: string; refusal_reason: string | null
      schools: { id: string; name: string } | null; school_classes: { name: string } | null
    }
    const { data } = await sb
      .from('school_interest_forms')
      .select('id, full_name, email, phone, message, status, created_at, refusal_reason, schools(id, name), school_classes(name)')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })

    for (const r of ((data ?? []) as unknown as IFRaw[])) {
      const escola = r.schools as { id: string; name: string } | null
      if (isFinalizado(r.status) && r.refusal_reason) {
        historico.push({
          id: r.id, tipo: 'Pré-inscrição', nome: r.full_name,
          escola: escola?.name ?? null,
          motivo: r.refusal_reason,
          recusadoEm: r.created_at,
        })
      } else if (!isFinalizado(r.status) || ver === 'todas') {
        items.push({
          id: r.id, tipo: 'pre_inscricao', tipoLabel: 'Pré-inscrição',
          tipoColor: 'bg-indigo-50 text-indigo-700',
          nome: r.full_name, email: r.email, phone: r.phone ?? null,
          escola: escola?.name ?? null, schoolId: escola?.id ?? null,
          turma: (r.school_classes as { name: string } | null)?.name ?? null,
          mensagem: r.message, status: r.status, notes: null,
          criadoEm: r.created_at, diasAberto: daysAgo(r.created_at), personId: null,
        })
      }
    }
  }

  // Candidatos a Aluno
  if (tab === 'todas' || tab === 'aluno') {
    type SAraw = {
      id: string; status: string; applied_at: string; notes: string | null; refusal_reason: string | null
      people: { id: string; full_name: string } | null
      schools: { id: string; name: string } | null; school_classes: { name: string } | null
    }
    const { data } = await sb
      .from('student_applications')
      .select('id, status, applied_at, notes, refusal_reason, people(id, full_name), schools(id, name), school_classes(name)')
      .eq('organization_id', orgId)
      .order('applied_at', { ascending: false })

    for (const r of ((data ?? []) as unknown as SAraw[])) {
      const pessoa = r.people as { id: string; full_name: string } | null
      const escola = r.schools as { id: string; name: string } | null
      if (isFinalizado(r.status) && r.refusal_reason) {
        historico.push({
          id: r.id, tipo: 'Candidato a Aluno', nome: pessoa?.full_name ?? '—',
          escola: escola?.name ?? null,
          motivo: r.refusal_reason,
          recusadoEm: r.applied_at,
        })
      } else if (!isFinalizado(r.status) || ver === 'todas') {
        items.push({
          id: r.id, tipo: 'aluno', tipoLabel: 'Candidato a Aluno',
          tipoColor: 'bg-sky-50 text-sky-700',
          nome: pessoa?.full_name ?? '—', email: null, phone: null,
          escola: escola?.name ?? null, schoolId: escola?.id ?? null,
          turma: (r.school_classes as { name: string } | null)?.name ?? null,
          mensagem: null, status: r.status, notes: r.notes ?? null,
          criadoEm: r.applied_at, diasAberto: daysAgo(r.applied_at),
          personId: pessoa?.id ?? null,
        })
      }
    }
  }

  // Candidatos a Obreiro
  if (tab === 'todas' || tab === 'obreiro') {
    type StaffRaw = {
      id: string; status: string; applied_at: string; notes: string | null
      people: { id: string; full_name: string } | null
    }
    const { data } = await sb
      .from('staff_applications')
      .select('id, status, applied_at, notes, people(id, full_name)')
      .eq('organization_id', orgId)
      .order('applied_at', { ascending: false })

    for (const r of ((data ?? []) as unknown as StaffRaw[])) {
      const pessoa = r.people as { id: string; full_name: string } | null
      if (!isFinalizado(r.status) || ver === 'todas') {
        items.push({
          id: r.id, tipo: 'obreiro', tipoLabel: 'Candidato a Obreiro',
          tipoColor: 'bg-amber-50 text-amber-700',
          nome: pessoa?.full_name ?? '—', email: null, phone: null,
          escola: null, schoolId: null, turma: null, mensagem: null,
          status: r.status, notes: r.notes ?? null,
          criadoEm: r.applied_at, diasAberto: daysAgo(r.applied_at),
          personId: pessoa?.id ?? null,
        })
      }
    }
  }

  const filtered = ver === 'todas' ? items : items.filter(i => !isFinalizado(i.status))
  filtered.sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())

  // Histórico: max 30, mais recentes primeiro
  const historicoTab = historico
    .sort((a, b) => new Date(b.recusadoEm).getTime() - new Date(a.recusadoEm).getTime())
    .slice(0, 30)

  return (
    <>
      <Header
        title="Inscrições"
        actions={
          <Link
            href={`/${slug}/inscricoes?tab=${tab}&ver=${ver === 'todas' ? 'ativas' : 'todas'}`}
            className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {ver === 'todas' ? 'Ocultar concluídas' : 'Ver todas (+ concluídas)'}
          </Link>
        }
      />

      <main className="p-4 md:p-6 space-y-4">

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit overflow-x-auto">
          {TIPO_TABS.map(t => {
            const count = t.key === 'todas'
              ? items.filter(i => !isFinalizado(i.status)).length
              : items.filter(i => i.tipo === t.key && !isFinalizado(i.status)).length
            return (
              <Link key={t.key}
                href={`/${slug}/inscricoes?tab=${t.key}&ver=${ver}`}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
                {count > 0 && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                    tab === t.key ? 'bg-brand-100 text-brand-700' : 'bg-gray-200 text-gray-500'
                  }`}>{count}</span>
                )}
              </Link>
            )
          })}
        </div>

        {/* Lista */}
        {!filtered.length ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
            <p className="text-3xl mb-3">📋</p>
            <p className="text-gray-400 text-sm">
              {ver === 'ativas' ? 'Nenhuma inscrição ativa.' : 'Nenhuma inscrição encontrada.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(item => {
              const statusInfo = STATUS_CONFIG[item.status] ?? { label: item.status, color: 'bg-gray-100 text-gray-500' }
              const urgency    = urgencyBadge(item.diasAberto)
              const finalizado = isFinalizado(item.status)
              const whatsapp   = item.phone ? `https://wa.me/${item.phone.replace(/\D/g, '')}` : null

              return (
                <div key={`${item.tipo}-${item.id}`}
                  className={`bg-white rounded-xl border border-l-4 p-4 transition-opacity ${finalizado ? 'opacity-60' : ''} ${urgencyBorderColor(item.diasAberto)}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.tipoColor}`}>{item.tipoLabel}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full tabular-nums ${urgency.color}`}>{urgency.label}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusInfo.color}`}>{statusInfo.label}</span>
                      </div>
                      <p className="font-semibold text-gray-900">{item.nome}</p>
                      {(item.email || item.phone) && (
                        <p className="text-sm text-gray-500 mt-0.5">
                          {item.email}{item.email && item.phone ? ' · ' : ''}{item.phone}
                        </p>
                      )}
                      {(item.escola || item.turma) && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {item.escola}{item.turma ? ` · ${item.turma}` : ''}
                        </p>
                      )}
                      {item.mensagem && (
                        <p className="text-xs text-gray-500 mt-1.5 italic border-l-2 border-gray-200 pl-2 line-clamp-2">
                          "{item.mensagem}"
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-xs text-gray-400 mt-1 bg-gray-50 px-2 py-1 rounded">Obs: {item.notes}</p>
                      )}
                      <p className="text-xs text-gray-300 mt-1.5">
                        {new Date(item.criadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>

                    {!finalizado && (
                      <div className="flex flex-wrap gap-1.5 sm:flex-col sm:items-end shrink-0">
                        {/* Contato */}
                        {item.email && (
                          <a href={`mailto:${item.email}?subject=Sua inscrição - ${item.escola ?? 'JOCUM'}&body=Olá ${item.nome},%0A%0A`}
                            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                            ✉ E-mail
                          </a>
                        )}
                        {whatsapp && (
                          <a href={whatsapp} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-green-200 text-green-700 hover:bg-green-50 rounded-lg transition-colors">
                            💬 WhatsApp
                          </a>
                        )}
                        {/* Disponibilizar formulário — apenas pré-inscrições */}
                        {item.tipo === 'pre_inscricao' && item.schoolId && (
                          <DisponibilizarFormularioButton
                            interestFormId={item.id}
                            slug={slug}
                            schoolId={item.schoolId}
                            action={disponibilizarFormulario}
                          />
                        )}

                        <div className="w-full h-px bg-gray-100" />

                        {/* Status */}
                        {item.status === 'pendente' && (
                          <form action={updateStatus}>
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="tipo" value={item.tipo} />
                            <input type="hidden" name="status" value="em_contato" />
                            <button type="submit" className="text-xs px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg transition-colors">
                              Em contato
                            </button>
                          </form>
                        )}
                        {(item.status === 'pendente' || item.status === 'em_contato' || item.status === 'formulario_enviado') && item.tipo !== 'obreiro' && (
                          <form action={aprovar}>
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="tipo" value={item.tipo} />
                            <input type="hidden" name="email" value={item.email ?? ''} />
                            <input type="hidden" name="person_id" value={item.personId ?? ''} />
                            <input type="hidden" name="org_id" value={orgId} />
                            <button type="submit" className="text-xs px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg transition-colors font-semibold">
                              Aprovar → Alunos
                            </button>
                          </form>
                        )}
                        {item.tipo === 'aluno' && item.status === 'pendente' && (
                          <form action={updateStatus}>
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="tipo" value={item.tipo} />
                            <input type="hidden" name="status" value="em_analise" />
                            <button type="submit" className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors">
                              Em análise
                            </button>
                          </form>
                        )}
                        <RecusarModal id={item.id} tipo={item.tipo} action={recusar} />
                      </div>
                    )}

                    {finalizado && <div className="shrink-0 text-xs text-gray-300 sm:text-right">concluído</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Histórico de Recusas ──────────────────────────────────────────── */}
        {historicoTab.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer flex items-center gap-2 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 select-none list-none">
              <span className="transition-transform group-open:rotate-90">▶</span>
              Histórico de recusas ({historicoTab.length})
            </summary>
            <div className="mt-3 bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                    <th className="hidden sm:table-cell text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                    <th className="hidden md:table-cell text-left px-4 py-3 font-medium text-gray-600">Escola</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {historicoTab.map(h => (
                    <tr key={`hist-${h.id}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{h.nome}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(h.recusadoEm).toLocaleDateString('pt-BR')}
                        </p>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-xs text-gray-500">{h.tipo}</td>
                      <td className="hidden md:table-cell px-4 py-3 text-xs text-gray-500">{h.escola ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 max-w-xs">
                        <p className="line-clamp-2" title={h.motivo}>{h.motivo}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}

      </main>
    </>
  )
}
