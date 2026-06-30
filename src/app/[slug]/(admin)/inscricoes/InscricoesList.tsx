'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, ClipboardList, Mail, MessageCircle } from 'lucide-react'
import { RecusarModal } from './RecusarModal'
import { DisponibilizarFormularioButton } from './DisponibilizarFormularioButton'
import {
  EditarPreInscricaoButton,
  EditarPreInscricaoObreiroButton,
  MarcarRecebidoExternoButton,
  LinksReferenciaAdminButton,
} from './InscricoesModals'

type InscricaoItem = {
  id: string
  tipo: 'pre_inscricao' | 'aluno' | 'obreiro' | 'pre_inscricao_obreiro'
  tipoLabel: string
  tipoColor: string
  nome: string
  email: string | null
  phone: string | null
  escola: string | null
  schoolId: string | null
  turma: string | null
  classId: string | null
  mensagem: string | null
  status: string
  notes: string | null
  criadoEm: string
  diasAberto: number
  personId: string | null
  ministryId?: string | null
  hasLogin?: boolean
  applicationId?: string | null
  staffApplicationId?: string | null
  hasFormData?: boolean
}

type HistoricoItem = {
  id: string
  tipo: string
  nome: string
  escola: string | null
  motivo: string
  recusadoPor: string | null
  recusadoPorId: string | null
  recusadoEm: string
}

type OpenClassOption = {
  id: string
  school_id: string
  name: string
  starts_at: string | null
  schoolName: string | null
}

type Props = {
  items: InscricaoItem[]
  historico: HistoricoItem[]
  slug: string
  orgId: string
  ver: string
  openClasses: OpenClassOption[]
  allSchools: Array<{ id: string; name: string }>
  allMinistries: Array<{ id: string; name: string }>
  canWrite: boolean
  canWriteEted: boolean
  canWriteObreiro: boolean
  allowedSchoolIds: string[] | null
  quota: { exceeded: boolean; dailyExceeded: boolean }
  initialQuery: string
  updateStatus: (formData: FormData) => Promise<void>
  recusar: (formData: FormData) => Promise<void>
  aprovar: (formData: FormData) => Promise<void>
  encaminharObreiroDh: (formData: FormData) => Promise<void>
  finalizarObreiro: (formData: FormData) => Promise<void>
  disponibilizarFormulario: (formData: FormData) => Promise<{ url?: string; emailWarning?: string; schoolId?: string } | undefined>
  disponibilizarFormularioObreiro: (formData: FormData) => Promise<{ url?: string; error?: string } | undefined>
  editarPreInscricao: (formData: FormData) => Promise<void>
  editarPreInscricaoObreiro: (formData: FormData) => Promise<void>
  marcarRecebidoExternamente: (formData: FormData) => Promise<void>
  marcarRecebidoExternamenteObreiro: (formData: FormData) => Promise<void>
  encaminharParaEscola: (formData: FormData) => Promise<void>
  encaminharParaMinisterio: (formData: FormData) => Promise<void>
}

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

const isFinalizado = (s: string) =>
  ['convertido', 'aprovado', 'descartado', 'reprovado', 'cancelado'].includes(s)

export function InscricoesList({
  items,
  historico,
  slug,
  orgId,
  ver,
  openClasses,
  allSchools,
  allMinistries,
  canWrite,
  canWriteEted,
  canWriteObreiro,
  allowedSchoolIds,
  quota,
  initialQuery,
  updateStatus,
  recusar,
  aprovar,
  encaminharObreiroDh,
  finalizarObreiro,
  disponibilizarFormulario,
  disponibilizarFormularioObreiro,
  editarPreInscricao,
  editarPreInscricaoObreiro,
  marcarRecebidoExternamente,
  marcarRecebidoExternamenteObreiro,
  encaminharParaEscola,
  encaminharParaMinisterio,
}: Props) {
  const [query, setQuery] = useState(initialQuery)

  const canWriteItem = (item: InscricaoItem) => {
    if (canWrite) return true
    if (canWriteEted && item.schoolId && allowedSchoolIds?.includes(item.schoolId)) return true
    return false
  }

  const filtered = items.filter(i =>
    !query ||
    i.nome.toLowerCase().includes(query.toLowerCase()) ||
    (i.email ?? '').toLowerCase().includes(query.toLowerCase())
  )

  return (
    <>
      {/* Search */}
      <div className="relative w-full sm:w-80">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por nome ou e-mail…"
          className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white w-full focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
        />
      </div>

      {/* Lista */}
      {!filtered.length ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <ClipboardList className="size-8 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-400 text-sm">
            {query
              ? `Nenhum resultado para "${query}".`
              : ver === 'ativas'
              ? 'Nenhuma inscrição ativa.'
              : 'Nenhuma inscrição encontrada.'}
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
              <div
                key={`${item.tipo}-${item.id}`}
                id={`item-${item.id}`}
                className={`bg-white rounded-xl border border-l-4 p-4 transition-opacity scroll-mt-20 ${finalizado ? 'opacity-60' : ''} ${urgencyBorderColor(item.diasAberto)}`}
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
                    {(item.escola || item.turma) ? (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {item.escola}{item.turma ? ` · ${item.turma}` : ''}
                      </p>
                    ) : (item.tipo === 'pre_inscricao' && !item.schoolId) || (item.tipo === 'pre_inscricao_obreiro' && !item.ministryId) ? (
                      <p className="text-xs text-blue-600 font-medium mt-0.5 bg-blue-50 inline-block px-1.5 py-0.5 rounded">
                        Sem preferência — aguardando encaminhamento
                      </p>
                    ) : null}
                    {item.mensagem && (
                      <p className="text-xs text-gray-500 mt-1.5 italic border-l-2 border-gray-200 pl-2 line-clamp-2">
                        &ldquo;{item.mensagem}&rdquo;
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-xs text-gray-400 mt-1 bg-gray-50 px-2 py-1 rounded">Obs: {item.notes}</p>
                    )}
                    {item.tipo === 'pre_inscricao_obreiro' && item.staffApplicationId && item.hasFormData && (
                      <Link
                        href={`/${slug}/inscricoes/formulario-obreiro/${item.staffApplicationId}`}
                        className="inline-flex items-center gap-1 text-xs text-amber-700 mt-1 bg-amber-50 border border-amber-100 px-2 py-1 rounded font-medium hover:bg-amber-100 transition-colors"
                      >
                        <ClipboardList className="size-3.5 inline -mt-0.5" /> Formulário preenchido — Ver respostas
                      </Link>
                    )}
                    {item.tipo === 'obreiro' && item.hasFormData && item.staffApplicationId && (
                      <Link
                        href={`/${slug}/inscricoes/formulario-obreiro/${item.staffApplicationId}`}
                        className="inline-flex items-center gap-1 text-xs text-amber-700 mt-1 bg-amber-50 border border-amber-100 px-2 py-1 rounded font-medium hover:bg-amber-100 transition-colors"
                      >
                        <ClipboardList className="size-3.5 inline -mt-0.5" /> Ver formulário preenchido
                      </Link>
                    )}
                    {item.tipo === 'obreiro' && item.status === 'em_analise' && !item.hasLogin && (
                      <p className="text-xs text-amber-700 mt-1 bg-amber-50 border border-amber-100 px-2 py-1 rounded font-medium">
                        Obreiro sem cadastro
                      </p>
                    )}
                    <p className="text-xs text-gray-300 mt-1.5">
                      {new Date(item.criadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>

                  {!finalizado && (
                    <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-col sm:items-end shrink-0 w-full sm:w-auto">
                      {item.email && (
                        <a
                          href={`mailto:${item.email}?subject=Sua inscrição - ${item.escola ?? 'JOCUM'}&body=Olá ${item.nome},%0A%0A`}
                          className="inline-flex items-center justify-center gap-1 text-xs px-3 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                          <Mail className="size-3.5 inline -mt-0.5" /> E-mail
                        </a>
                      )}
                      {whatsapp && (
                        <a
                          href={whatsapp}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1 text-xs px-3 py-2 border border-green-200 text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                        >
                          <MessageCircle className="size-3.5 inline -mt-0.5" /> WhatsApp
                        </a>
                      )}

                      {canWriteItem(item) && item.tipo === 'pre_inscricao' && !item.applicationId && (
                        <div className="col-span-2">
                          <MarcarRecebidoExternoButton
                            interestFormId={item.id}
                            externoAction={marcarRecebidoExternamente}
                          />
                        </div>
                      )}
                      {canWriteObreiro && item.tipo === 'pre_inscricao_obreiro' && !item.staffApplicationId && !item.hasFormData && (
                        <div className="col-span-2">
                          <MarcarRecebidoExternoButton
                            interestFormId={item.id}
                            externoAction={marcarRecebidoExternamenteObreiro}
                          />
                        </div>
                      )}

                      {item.tipo === 'pre_inscricao' && item.applicationId && (
                        <div className="col-span-2">
                          <LinksReferenciaAdminButton
                            applicationId={item.applicationId}
                            candidateName={item.nome}
                            slug={slug}
                          />
                        </div>
                      )}

                      {canWriteItem(item) && item.tipo === 'pre_inscricao' && (
                        <EditarPreInscricaoButton
                          item={{ id: item.id, full_name: item.nome, email: item.email, phone: item.phone, message: item.mensagem, classId: item.classId }}
                          openClasses={openClasses}
                          editarAction={editarPreInscricao}
                        />
                      )}
                      {canWriteObreiro && item.tipo === 'pre_inscricao_obreiro' && (
                        <EditarPreInscricaoObreiroButton
                          item={{ id: item.id, full_name: item.nome, email: item.email, phone: item.phone, message: item.mensagem, ministryId: item.ministryId ?? null }}
                          ministries={allMinistries}
                          editarAction={editarPreInscricaoObreiro}
                        />
                      )}

                      {item.tipo === 'pre_inscricao' && item.schoolId && (
                        <div className="col-span-2">
                          {item.applicationId ? (
                            <Link
                              href={`/${slug}/inscricoes/formulario/${item.applicationId}`}
                              className="inline-flex items-center gap-1.5 w-full justify-center text-xs text-blue-700 bg-blue-50 border border-blue-200 px-3 py-2.5 rounded-lg font-semibold hover:bg-blue-100 transition-colors"
                            >
                              <ClipboardList className="size-3.5" /> Formulário preenchido — Ver respostas
                            </Link>
                          ) : canWriteItem(item) ? (
                            <DisponibilizarFormularioButton
                              interestFormId={item.id}
                              slug={slug}
                              schoolId={item.schoolId}
                              action={disponibilizarFormulario}
                              emailDisabled={quota.exceeded}
                              emailDisabledReason={
                                quota.dailyExceeded
                                  ? 'Limite diário de e-mails atingido (100/dia). O link ainda pode ser copiado.'
                                  : 'Limite mensal de e-mails atingido (3.000/mês). O link ainda pode ser copiado.'
                              }
                            />
                          ) : null}
                        </div>
                      )}

                      {canWriteObreiro && item.tipo === 'pre_inscricao_obreiro' && !item.staffApplicationId && (
                        <div className="col-span-2">
                          <DisponibilizarFormularioButton
                            interestFormId={item.id}
                            slug={slug}
                            schoolId="__obreiro__"
                            action={disponibilizarFormularioObreiro}
                            emailDisabled={false}
                            label="Gerar formulário de obreiro"
                          />
                        </div>
                      )}

                      {(item.tipo === 'pre_inscricao_obreiro' || item.tipo === 'obreiro') && item.staffApplicationId && item.hasFormData && (
                        <div className="col-span-2">
                          <LinksReferenciaAdminButton
                            applicationId={item.staffApplicationId}
                            candidateName={item.nome}
                            slug={slug}
                            isStaff
                          />
                        </div>
                      )}

                      <div className="col-span-2 h-px bg-gray-100" />

                      {canWrite && item.tipo === 'pre_inscricao' && !item.schoolId && (
                        <form action={encaminharParaEscola} className="col-span-2 space-y-1.5 rounded-lg border border-blue-100 bg-blue-50 p-2.5">
                          <input type="hidden" name="interest_id" value={item.id} />
                          <p className="text-xs font-semibold text-blue-800">Sem preferência de escola</p>
                          <select name="school_id" required className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300">
                            <option value="" disabled>Encaminhar para qual escola?</option>
                            {allSchools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                          <button type="submit" className="w-full text-xs px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors font-semibold">
                            Encaminhar para escola
                          </button>
                        </form>
                      )}
                      {canWrite && item.tipo === 'pre_inscricao_obreiro' && !item.ministryId && (
                        <form action={encaminharParaMinisterio} className="col-span-2 space-y-1.5 rounded-lg border border-violet-100 bg-violet-50 p-2.5">
                          <input type="hidden" name="interest_id" value={item.id} />
                          <p className="text-xs font-semibold text-violet-800">Sem preferência de ministério</p>
                          <select name="ministry_id" required className="w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-300">
                            <option value="" disabled>Encaminhar para qual ministério?</option>
                            {allMinistries.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                          <button type="submit" className="w-full text-xs px-3 py-2 bg-violet-600 text-white hover:bg-violet-700 rounded-lg transition-colors font-semibold">
                            Encaminhar para ministério
                          </button>
                        </form>
                      )}

                      {(item.tipo === 'pre_inscricao_obreiro' ? canWriteObreiro : canWriteItem(item)) && item.status === 'pendente' && (
                        <form action={updateStatus}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="tipo" value={item.tipo} />
                          <input type="hidden" name="status" value="em_contato" />
                          <button type="submit" className="w-full text-xs px-3 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg transition-colors">
                            Em contato
                          </button>
                        </form>
                      )}
                      {canWriteItem(item) && (item.status === 'pendente' || item.status === 'em_contato' || item.status === 'formulario_enviado' || item.status === 'em_analise') && item.tipo !== 'obreiro' && item.tipo !== 'pre_inscricao_obreiro' && (() => {
                        const formularioPreenchido = item.tipo !== 'pre_inscricao' || !!item.applicationId
                        return (
                          <form action={formularioPreenchido ? aprovar : undefined} className="col-span-2 space-y-1.5">
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="tipo" value={item.tipo} />
                            <input type="hidden" name="email" value={item.email ?? ''} />
                            <input type="hidden" name="person_id" value={item.personId ?? ''} />
                            <input type="hidden" name="org_id" value={orgId} />
                            <select
                              name="class_id"
                              defaultValue={item.classId ?? ''}
                              required
                              disabled={!formularioPreenchido}
                              className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400 ${formularioPreenchido ? 'border-gray-200 bg-white text-gray-700' : 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'}`}
                            >
                              <option value="" disabled>Selecione a turma ETED</option>
                              {openClasses.map(c => (
                                <option key={c.id} value={c.id}>
                                  {c.schoolName ?? 'ETED'} · {c.name}
                                  {c.starts_at ? ` · ${new Date(c.starts_at).toLocaleDateString('pt-BR')}` : ''}
                                </option>
                              ))}
                            </select>
                            <button
                              type="submit"
                              disabled={!formularioPreenchido}
                              className={`w-full text-xs px-3 py-2 rounded-lg font-semibold transition-colors ${formularioPreenchido ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                            >
                              {formularioPreenchido ? '✓ Aceitar aluno' : '✓ Aceitar aluno (aguardando formulário)'}
                            </button>
                          </form>
                        )
                      })()}
                      {canWriteItem(item) && item.tipo === 'aluno' && item.status === 'pendente' && (
                        <form action={updateStatus}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="tipo" value={item.tipo} />
                          <input type="hidden" name="status" value="em_analise" />
                          <button type="submit" className="w-full text-xs px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors">
                            Em análise
                          </button>
                        </form>
                      )}
                      {canWriteObreiro && item.tipo === 'obreiro' && item.status !== 'em_analise' && (
                        <form action={encaminharObreiroDh} className="col-span-2">
                          <input type="hidden" name="id" value={item.id} />
                          <button type="submit" className="w-full text-xs px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors font-semibold">
                            Enviar ao DH
                          </button>
                        </form>
                      )}
                      {item.tipo === 'obreiro' && item.status === 'em_analise' && canWrite && item.personId && (
                        <form action={finalizarObreiro} className="col-span-2 space-y-1.5 rounded-lg border border-amber-100 bg-amber-50 p-2">
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="org_id" value={orgId} />
                          <input type="hidden" name="person_id" value={item.personId} />
                          <input type="hidden" name="ministry_id" value={item.ministryId ?? ''} />
                          <input type="hidden" name="name" value={item.nome} />
                          <p className="text-xs font-semibold text-amber-800">Obreiro sem cadastro</p>
                          <input
                            name="email"
                            type="email"
                            defaultValue={item.email ?? ''}
                            required
                            placeholder="E-mail de login"
                            className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
                          />
                          <input
                            name="password"
                            type="password"
                            required
                            minLength={6}
                            placeholder="Senha temporária"
                            className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
                          />
                          <button type="submit" className="w-full text-xs px-3 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors font-semibold">
                            Finalizar obreiro
                          </button>
                        </form>
                      )}
                      {((item.tipo === 'pre_inscricao_obreiro' || item.tipo === 'obreiro') ? canWriteObreiro : canWriteItem(item)) && (
                        <div className="col-span-2 sm:col-span-1">
                          <RecusarModal id={item.id} tipo={item.tipo} action={recusar} />
                        </div>
                      )}
                    </div>
                  )}

                  {finalizado && <div className="shrink-0 text-xs text-gray-300 sm:text-right">concluído</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Histórico de Recusas */}
      {historico.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer flex items-center gap-2 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 select-none list-none">
            <span className="transition-transform group-open:rotate-90">▶</span>
            Histórico de recusas ({historico.length})
          </summary>
          <div className="mt-3 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                  <th className="hidden sm:table-cell text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 font-medium text-gray-600">Escola</th>
                  <th className="hidden lg:table-cell text-left px-4 py-3 font-medium text-gray-600">Recusado por</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {historico.map(h => (
                  <tr key={`hist-${h.id}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{h.nome}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(h.recusadoEm).toLocaleDateString('pt-BR')}
                      </p>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 text-xs text-gray-500">{h.tipo}</td>
                    <td className="hidden md:table-cell px-4 py-3 text-xs text-gray-500">{h.escola ?? '—'}</td>
                    <td className="hidden lg:table-cell px-4 py-3 text-xs text-gray-500">{h.recusadoPor ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-xs">
                      <p className="line-clamp-2" title={h.motivo}>{h.motivo}</p>
                      <p className="mt-1 text-[11px] text-gray-400 lg:hidden">
                        Recusado por: {h.recusadoPor ?? '—'}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </>
  )
}
