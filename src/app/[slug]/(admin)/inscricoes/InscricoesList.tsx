'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useFormStatus } from 'react-dom'
import { Search, ClipboardList, Mail, MessageCircle, ChevronDown, Link2, Loader2 } from 'lucide-react'
import { RecusarModal } from './RecusarModal'
import { DisponibilizarFormularioButton } from './DisponibilizarFormularioButton'
import { PipelineStepper, stagesFromFlags } from '@/components/inscricoes/PipelineStepper'
import BackgroundChecksSection, { type BackgroundCheck } from './formulario-obreiro/[id]/BackgroundChecksSection'
import { solicitarHospedagemObreiro } from './formulario-obreiro/[id]/actions'
import { solicitarHospedagemAluno } from './formulario/[id]/actions'
import {
  EditarPreInscricaoButton,
  EditarPreInscricaoObreiroButton,
  MarcarRecebidoExternoButton,
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
  diasNaEtapaAtual: number
  personId: string | null
  ministryId?: string | null
  hasLogin?: boolean
  applicationId?: string | null
  staffApplicationId?: string | null
  hasFormData?: boolean
  bgCheckSummary?: { total: number; pendentes: number; reprovados: number; flagged: number; expirados: number } | null
  backgroundChecks?: BackgroundCheck[]
  assumedByName?: string | null
  refSummary?: { pastor: { status: string; data: Record<string, string> | null } | null; amigo: { status: string; data: Record<string, string> | null } | null } | null
  pastorSkipped?: boolean
  hospedagemSkipped?: boolean
  hospedagemResolved?: boolean
  hospedagemStatus?: string | null
  hospedagemArrivalDate?: string | null
  hospedagemDepartureDate?: string | null
  candidateArrivalDate?: string | null
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
  initialTab: string
  initialEtapa: string
  hideAlunoTipo: boolean
  linksAluno: ReactNode
  linksObreiro: ReactNode
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
  salvarPalavraLider: (formData: FormData) => Promise<void>
  assumirPreInscricaoObreiro: (formData: FormData) => Promise<void>
  finalizarObreiro: (formData: FormData) => Promise<void>
  disponibilizarFormulario: (formData: FormData) => Promise<{ url?: string; error?: string; emailWarning?: string; schoolId?: string }>
  disponibilizarFormularioObreiro: (formData: FormData) => Promise<{ url?: string; error?: string; emailWarning?: string }>
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

const TIPO_TABS = [
  { key: 'todas',   label: 'Todas' },
  { key: 'aluno',   label: 'Alunos' },
  { key: 'obreiro', label: 'Obreiros' },
]

const ETAPA_TABS = [
  { key: 'todas',         label: 'Todas as etapas' },
  { key: 'pre_inscricao', label: 'Pré-inscrição' },
  { key: 'candidatura',   label: 'Candidatura' },
  { key: 'finalizados',   label: 'Finalizados' },
]

function matchesTipo(i: { tipo: string }, key: string) {
  if (key === 'todas') return true
  if (key === 'aluno') return i.tipo === 'pre_inscricao' || i.tipo === 'aluno'
  return i.tipo === 'pre_inscricao_obreiro' || i.tipo === 'obreiro'
}
// "Finalizados" agrupa por status (concluído em qualquer etapa), não por tipo —
// um candidato aceito continua com o mesmo `tipo` de quando estava em
// pré-inscrição, então rotear só por tipo o deixaria preso na aba errada.
function matchesEtapa(i: { tipo: string; status: string }, key: string) {
  if (key === 'todas') return true
  if (key === 'finalizados') return isFinalizado(i.status)
  if (isFinalizado(i.status)) return false
  if (key === 'pre_inscricao') return i.tipo === 'pre_inscricao' || i.tipo === 'pre_inscricao_obreiro'
  return i.tipo === 'aluno' || i.tipo === 'obreiro'
}

const OBREIRO_STAGE_LABELS = ['Pré-inscrição', 'Formulário enviado', 'Recomendação do pastor', 'Verificação de antecedentes', 'Hospedagem', 'Aprovado']
const ALUNO_STAGE_LABELS = ['Pré-inscrição', 'Formulário enviado', 'Em análise', 'Aprovado']

function obreiroStages(item: InscricaoItem) {
  const formSubmitted = item.tipo === 'obreiro' || !!item.hasFormData
  const pastorDone = item.refSummary?.pastor?.status === 'enviado' || !!item.pastorSkipped
  const bg = item.bgCheckSummary
  const bgDone = (!!bg && bg.total > 0 && bg.pendentes === 0) || (!bg && item.tipo === 'obreiro' && item.status === 'aprovado')
  const hospedagemDone = !!item.hospedagemResolved || !!item.hospedagemSkipped
  const approved = item.status === 'aprovado'
  return stagesFromFlags(OBREIRO_STAGE_LABELS, [true, formSubmitted, pastorDone, bgDone, hospedagemDone, approved])
}

function alunoStages(item: InscricaoItem) {
  const formSubmitted = ['formulario_enviado', 'em_analise', 'convertido'].includes(item.status) || !!item.hasFormData
  const emAnalise = ['em_analise', 'convertido'].includes(item.status)
  const approved = item.status === 'convertido'
  return stagesFromFlags(ALUNO_STAGE_LABELS, [true, formSubmitted, emAnalise, approved])
}

function StatusDropdown({ item, label, color, options, updateStatus }: {
  item: InscricaoItem
  label: string
  color: string
  options: { value: string; label: string }[]
  updateStatus: (formData: FormData) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`text-xs font-medium px-2 py-0.5 rounded-full ${color} inline-flex items-center gap-1 hover:ring-2 hover:ring-offset-1 hover:ring-gray-300 transition-shadow`}
      >
        {label}
        <svg className="size-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 min-w-[10rem] rounded-lg border border-gray-200 bg-white shadow-lg py-1">
            {options.map(opt => (
              <form key={opt.value} action={updateStatus}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="tipo" value={item.tipo} />
                <input type="hidden" name="status" value={opt.value} />
                <button type="submit" onClick={() => setOpen(false)}
                  className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                  {opt.label}
                </button>
              </form>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function AssumirConversaButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}
      className="text-xs text-indigo-600 hover:text-indigo-800 underline disabled:opacity-50">
      {pending ? 'Assumindo…' : 'Assumir conversa'}
    </button>
  )
}

function AceitarAlunoButton({ formularioPreenchido }: { formularioPreenchido: boolean }) {
  const { pending } = useFormStatus()
  const disabled = !formularioPreenchido || pending
  return (
    <button
      type="submit"
      disabled={disabled}
      className={`w-full text-xs px-3 py-2 rounded-lg font-semibold transition-colors ${formularioPreenchido ? 'bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-60' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
    >
      {pending
        ? <><Loader2 className="size-3.5 inline -mt-0.5 animate-spin" /> Aceitando…</>
        : formularioPreenchido ? '✓ Aceitar aluno' : '✓ Aceitar aluno (aguardando formulário)'}
    </button>
  )
}

// Data de chegada pode ser informada a qualquer momento do processo (não só
// depois de aprovado) — vira pendência pra hospitalidade já ir verificando
// disponibilidade em paralelo, conforme migration 099.
function DataChegadaField({ slug, organizationId, ministryId, staffApplicationId, guestName, guestType, prefillDate, prefillDeparture, submitLabel, hint, action }: {
  slug: string
  organizationId: string
  ministryId: string | null
  staffApplicationId: string
  guestName: string
  guestType: 'obreiro' | 'aluno'
  prefillDate?: string | null
  prefillDeparture?: string | null
  submitLabel?: string
  hint?: string
  action: (params: { slug: string; organizationId: string; ministryId: string | null; staffApplicationId: string; guestName: string; arrivalDate: string; departureDate?: string | null; notes: string | null }) => Promise<void>
}) {
  const [arrivalDate, setArrivalDate] = useState(prefillDate ?? '')
  const [departureDate, setDepartureDate] = useState(prefillDeparture ?? '')
  const [done, setDone] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <div className="mt-1.5 space-y-1.5">
      <p className="text-amber-800">{hint ?? 'Assim que informada, a hospitalidade já pode verificar disponibilidade em paralelo ao restante do processo.'}</p>
      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <label className="block text-[11px] text-amber-700 mb-0.5">Chegada</label>
          <input type="date" value={arrivalDate} onChange={e => { setArrivalDate(e.target.value); setDone(false) }}
            className="w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-xs text-gray-700" />
        </div>
        <div>
          <label className="block text-[11px] text-amber-700 mb-0.5">Saída prevista (opcional)</label>
          <input type="date" value={departureDate} onChange={e => { setDepartureDate(e.target.value); setDone(false) }}
            className="w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-xs text-gray-700" />
        </div>
      </div>
      <p className="text-[11px] text-amber-700">
        {guestType === 'obreiro'
          ? 'Deixe em branco se o obreiro vier residir de forma permanente — dá pra definir depois, no desligamento ou transferência.'
          : 'Geralmente é o fim da turma, mas pode deixar em branco e ajustar depois — não trava a hospitalidade.'}
      </p>
      <div className="flex items-center gap-1.5">
        <button type="button" disabled={pending || !arrivalDate}
          onClick={() => startTransition(async () => {
            await action({ slug, organizationId, ministryId, staffApplicationId, guestName, arrivalDate, departureDate: departureDate || null, notes: null })
            setDone(true)
            router.refresh()
          })}
          className="text-xs px-3 py-1.5 bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60 rounded-lg transition-colors font-semibold whitespace-nowrap">
          {pending ? 'Enviando…' : submitLabel ?? 'Avisar hospitalidade'}
        </button>
      </div>
      {done && <p className="text-green-700">✓ Enviado à hospitalidade.</p>}
    </div>
  )
}

export function InscricoesList({
  items,
  historico,
  slug,
  orgId,
  initialTab,
  initialEtapa,
  hideAlunoTipo,
  linksAluno,
  linksObreiro,
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
  salvarPalavraLider,
  assumirPreInscricaoObreiro,
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
  const [tab, setTab] = useState(initialTab)
  const [etapa, setEtapa] = useState(initialEtapa)
  const [showLinks, setShowLinks] = useState(false)
  const [query, setQuery] = useState(initialQuery)
  const searchParams = useSearchParams()
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    const highlightId = searchParams.get('highlight')
    if (highlightId) initial.add(highlightId)
    for (const item of items) {
      const bg = item.bgCheckSummary
      if (bg && (bg.reprovados > 0 || bg.flagged > 0)) initial.add(item.id)
    }
    return initial
  })

  function toggleExpanded(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const canWriteItem = (item: InscricaoItem) => {
    if (canWrite) return true
    if (canWriteEted && item.schoolId && allowedSchoolIds?.includes(item.schoolId)) return true
    return false
  }

  const tabEtapaFiltered = items.filter(i => matchesTipo(i, tab) && matchesEtapa(i, etapa))
  const filtered = tabEtapaFiltered.filter(i =>
    !query ||
    i.nome.toLowerCase().includes(query.toLowerCase()) ||
    (i.email ?? '').toLowerCase().includes(query.toLowerCase())
  )

  const currentLinks = tab === 'aluno' ? linksAluno : tab === 'obreiro' ? linksObreiro : null
  const visibleTipoTabs = hideAlunoTipo ? TIPO_TABS.filter(t => t.key !== 'aluno') : TIPO_TABS

  return (
    <div className="space-y-4">
      {/* Tabs: tipo de pessoa (quem) — some se só houver um tipo possível (ex: líder de ministério só vê obreiros) */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {visibleTipoTabs.length > 2 && (
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto scrollbar-none">
          {visibleTipoTabs.map(t => {
            const count = items.filter(i => matchesTipo(i, t.key) && matchesEtapa(i, etapa)).length
            return (
              <button key={t.key} type="button" onClick={() => setTab(t.key)}
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
              </button>
            )
          })}
        </div>
        )}
      </div>

      {/* Chips: etapa do processo (onde) */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
        {ETAPA_TABS.map(e => {
          const count = items.filter(i => matchesTipo(i, tab) && matchesEtapa(i, e.key)).length
          return (
            <button key={e.key} type="button" onClick={() => setEtapa(e.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors border flex items-center gap-1 ${
                etapa === e.key
                  ? 'bg-brand-50 border-brand-200 text-brand-700'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {e.label}
              {count > 0 && <span className="opacity-70">{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Links públicos de inscrição — escondidos atrás de um botão, para não poluir a tela */}
      {currentLinks && (
        <div>
          <button type="button" onClick={() => setShowLinks(s => !s)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            <Link2 className="size-3.5" />
            {tab === 'aluno' ? 'Link de pré-inscrição pública' : 'Links para servir / ministérios'}
            <ChevronDown className={`size-3.5 transition-transform ${showLinks ? 'rotate-180' : ''}`} />
          </button>
          {showLinks && (
            <div className="mt-2 space-y-3">
              {currentLinks}
            </div>
          )}
        </div>
      )}

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
              : 'Nenhuma inscrição encontrada.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const statusInfo = item.tipo === 'pre_inscricao_obreiro' && item.status === 'pendente'
              ? { label: 'Aguardando contato', color: 'bg-yellow-100 text-yellow-700' }
              : STATUS_CONFIG[item.status] ?? { label: item.status, color: 'bg-gray-100 text-gray-500' }
            const urgency    = urgencyBadge(item.diasAberto)
            const finalizado = isFinalizado(item.status)
            const canEditStatus = item.tipo === 'pre_inscricao_obreiro' ? canWriteObreiro : canWriteItem(item)
            const statusOptions: { value: string; label: string }[] =
              item.status !== 'pendente' ? [] :
              item.tipo === 'aluno' ? [{ value: 'em_contato', label: 'Em contato' }, { value: 'em_analise', label: 'Em análise' }] :
              (item.tipo === 'pre_inscricao' || item.tipo === 'pre_inscricao_obreiro') ? [{ value: 'em_contato', label: 'Em contato' }] :
              []
            const whatsapp   = item.phone ? `https://wa.me/${item.phone.replace(/\D/g, '')}` : null
            const bg         = item.bgCheckSummary
            const bgConcern  = !!bg && (bg.reprovados > 0 || bg.flagged > 0)
            const bgPending  = !!bg && !bgConcern && bg.pendentes > 0

            const isObreiroTrack = item.tipo === 'obreiro' || item.tipo === 'pre_inscricao_obreiro'
            const isAlunoTrack = item.tipo === 'pre_inscricao'
            const stepperStages = isObreiroTrack ? obreiroStages(item) : isAlunoTrack ? alunoStages(item) : null
            const stepperHref = isObreiroTrack && item.staffApplicationId
              ? `/${slug}/inscricoes/formulario-obreiro/${item.staffApplicationId}`
              : isAlunoTrack && item.applicationId
              ? `/${slug}/inscricoes/formulario/${item.applicationId}`
              : undefined
            // A pill de status só sobra útil quando ainda é o dropdown editável
            // (fase de contato inicial) — depois disso o stepper já conta a
            // mesma história com mais precisão, então a pill estática vira
            // informação repetida.
            const showStatusPill = !stepperStages || (canEditStatus && statusOptions.length > 0 && !finalizado)
            const currentStageLabel = stepperStages?.find(s => s.status === 'current')?.label ?? null

            const isOpen = expandedIds.has(item.id)
            return (
              <div
                key={`${item.tipo}-${item.id}`}
                id={`item-${item.id}`}
                className={`bg-white rounded-xl border border-l-4 transition-opacity scroll-mt-20 ${finalizado ? 'opacity-60' : ''} ${finalizado ? 'border-l-gray-200' : urgencyBorderColor(item.diasAberto)}`}
              >
                {/* Cabeçalho compacto — sempre visível, clique expande/recolhe */}
                <div className="flex items-start gap-3 p-4">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpanded(item.id)}>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.tipoColor}`}>{item.tipoLabel}</span>
                      {!finalizado && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full tabular-nums ${urgency.color}`}>{urgency.label}</span>
                      )}
                      {!finalizado && item.diasNaEtapaAtual < item.diasAberto && (
                        <span className="text-xs text-gray-400 tabular-nums" title="Tempo total vs. tempo nesta etapa">
                          {item.diasAberto}d no total · {item.diasNaEtapaAtual}d nesta etapa
                        </span>
                      )}
                      {canEditStatus && statusOptions.length > 0 && !finalizado ? (
                        <span onClick={e => e.stopPropagation()}>
                          <StatusDropdown item={item} label={statusInfo.label} color={statusInfo.color} options={statusOptions} updateStatus={updateStatus} />
                        </span>
                      ) : showStatusPill ? (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusInfo.color}`}>{statusInfo.label}</span>
                      ) : null}
                      {item.tipo === 'pre_inscricao_obreiro' && item.ministryId && item.assumedByName && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                          Assumido pelo DH — {item.assumedByName}
                        </span>
                      )}
                      {bgConcern && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">⚠ Antecedentes</span>
                      )}
                    </div>
                    <p className="font-semibold text-gray-900">{item.nome}</p>
                    {(item.email || item.phone) && (
                      <p className="text-sm text-gray-500 mt-0.5">
                        {item.email}{item.email && item.phone ? ' · ' : ''}{item.phone}
                      </p>
                    )}
                    {stepperStages && (
                      <div className="mt-1.5">
                        <PipelineStepper stages={stepperStages} href={stepperHref} size="md" />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {!finalizado && item.email && (
                      <a
                        href={`mailto:${item.email}?subject=Sua inscrição - ${item.escola ?? 'JOCUM'}&body=Olá ${item.nome},%0A%0A`}
                        className="p-1.5 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-lg transition-colors"
                        aria-label="Enviar e-mail"
                      >
                        <Mail className="size-4" />
                      </a>
                    )}
                    {!finalizado && whatsapp && (
                      <a
                        href={whatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        suppressHydrationWarning
                        className="p-1.5 border border-green-200 text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                        aria-label="WhatsApp"
                      >
                        <MessageCircle className="size-4" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleExpanded(item.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
                      aria-label={isOpen ? 'Recolher' : 'Ver detalhes e ações'}
                    >
                      <ChevronDown className={`size-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Corpo expansível — detalhes e ações */}
                {isOpen && (
                <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-1.5">
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
                    {/* Formulário preenchido, links de recomendação etc. — só em Detalhes (link do stepper) */}
                    <p className="text-xs text-gray-300 mt-1.5">
                      {new Date(item.criadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>

                  {!finalizado && (
                    <div className="grid grid-cols-2 gap-1.5 pt-1">

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

                      {((canWriteItem(item) && item.tipo === 'pre_inscricao') || (canWriteObreiro && (item.tipo === 'pre_inscricao_obreiro' || (item.tipo === 'obreiro' && !finalizado)))) && (
                        <details className="col-span-2 text-xs">
                          <summary className="cursor-pointer text-gray-400 select-none py-1">Mais ações</summary>
                          <div className="mt-1.5 space-y-1.5">
                            <div className="grid grid-cols-2 gap-1.5">
                              {canWriteItem(item) && item.tipo === 'pre_inscricao' && (
                                <EditarPreInscricaoButton
                                  item={{ id: item.id, full_name: item.nome, email: item.email, phone: item.phone, message: item.mensagem, classId: item.classId }}
                                  openClasses={openClasses}
                                  editarAction={editarPreInscricao}
                                />
                              )}
                              {canWriteObreiro && item.tipo === 'pre_inscricao_obreiro' && (
                                <EditarPreInscricaoObreiroButton
                                  item={{ id: item.id, full_name: item.nome, email: item.email, phone: item.phone, message: item.mensagem, ministryId: item.ministryId ?? null, schoolId: item.schoolId }}
                                  ministries={allMinistries}
                                  schools={allSchools}
                                  editarAction={editarPreInscricaoObreiro}
                                />
                              )}
                            </div>
                            {item.tipo === 'obreiro' && (
                              <form action={salvarPalavraLider} className="space-y-1.5 border-t border-gray-100 pt-1.5">
                                <input type="hidden" name="id" value={item.id} />
                                <p className="text-gray-500">Palavra sobre receber este obreiro (opcional)</p>
                                <textarea
                                  name="leader_word"
                                  rows={2}
                                  placeholder="A palavra que Deus deu sobre receber esta pessoa, se houver..."
                                  className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700"
                                />
                                <label className="flex items-start gap-2 text-gray-600">
                                  <input type="checkbox" name="leader_word_shared" className="mt-0.5" />
                                  Enviar esta palavra ao obreiro, se for aceito
                                </label>
                                <button type="submit" className="w-full text-xs px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors font-semibold">
                                  Salvar palavra
                                </button>
                              </form>
                            )}
                          </div>
                        </details>
                      )}
                      {canWriteObreiro && item.tipo === 'obreiro' && !finalizado && item.staffApplicationId && !item.hospedagemResolved && !item.hospedagemSkipped && (
                        item.hospedagemStatus ? (
                          <div className="col-span-2 rounded-lg border border-blue-200 bg-blue-50 p-2.5">
                            <p className="text-xs font-semibold text-blue-800">
                              ✓ Chegada em {new Date(item.hospedagemArrivalDate! + 'T00:00:00').toLocaleDateString('pt-BR')} — aguardando confirmação da hospitalidade
                            </p>
                            {item.candidateArrivalDate && item.candidateArrivalDate !== item.hospedagemArrivalDate && (
                              <p className="text-xs font-semibold text-red-700 mt-1">
                                ⚠ Diferente do que {item.nome} informou no formulário ({new Date(item.candidateArrivalDate + 'T00:00:00').toLocaleDateString('pt-BR')}) — avise sobre a mudança.
                              </p>
                            )}
                            <details className="text-xs mt-1">
                              <summary className="cursor-pointer text-blue-600 select-none">Alterar data</summary>
                              <DataChegadaField
                                slug={slug}
                                organizationId={orgId}
                                ministryId={item.ministryId ?? null}
                                staffApplicationId={item.staffApplicationId}
                                guestName={item.nome}
                                guestType="obreiro"
                                prefillDate={item.hospedagemArrivalDate}
                                prefillDeparture={item.hospedagemDepartureDate}
                                submitLabel="Atualizar"
                                action={solicitarHospedagemObreiro}
                              />
                            </details>
                          </div>
                        ) : (
                          <div className="col-span-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5">
                            <p className="text-xs font-bold text-amber-900">
                              {item.candidateArrivalDate
                                ? `⏳ ${item.nome} indicou chegada em ${new Date(item.candidateArrivalDate + 'T00:00:00').toLocaleDateString('pt-BR')} — revise e envie para a hospitalidade`
                                : '⏳ Data de chegada ainda não informada'}
                            </p>
                            <DataChegadaField
                              slug={slug}
                              organizationId={orgId}
                              ministryId={item.ministryId ?? null}
                              staffApplicationId={item.staffApplicationId}
                              guestName={item.nome}
                              guestType="obreiro"
                              prefillDate={item.candidateArrivalDate}
                              hint={item.candidateArrivalDate
                                ? 'Confirme (ou ajuste) a data antes de avisar a hospitalidade.'
                                : undefined}
                              action={solicitarHospedagemObreiro}
                            />
                          </div>
                        )
                      )}
                      {canWrite && item.tipo === 'pre_inscricao_obreiro' && item.ministryId && !item.assumedByName && !finalizado && (
                        <form action={assumirPreInscricaoObreiro}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="org_id" value={orgId} />
                          <AssumirConversaButton />
                        </form>
                      )}

                      {item.tipo === 'pre_inscricao' && item.schoolId && (
                        <div className="col-span-2">
                          {item.applicationId ? null : canWriteItem(item) ? (
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
                            label="Enviar formulário de obreiro por e-mail"
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
                      {canWrite && item.tipo === 'pre_inscricao_obreiro' && !item.ministryId && !item.schoolId && (
                        <form action={encaminharParaMinisterio} className="col-span-2 space-y-1.5 rounded-lg border border-violet-100 bg-violet-50 p-2.5">
                          <input type="hidden" name="interest_id" value={item.id} />
                          <p className="text-xs font-semibold text-violet-800">Sem preferência de ministério/escola</p>
                          <select name="destination" required className="w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-300">
                            <option value="" disabled>Encaminhar para qual ministério ou escola?</option>
                            {allMinistries.length > 0 && (
                              <optgroup label="Ministérios">
                                {allMinistries.map(m => <option key={m.id} value={`ministry:${m.id}`}>{m.name}</option>)}
                              </optgroup>
                            )}
                            {allSchools.length > 0 && (
                              <optgroup label="Escolas">
                                {allSchools.map(s => <option key={s.id} value={`school:${s.id}`}>{s.name}</option>)}
                              </optgroup>
                            )}
                          </select>
                          <button type="submit" className="w-full text-xs px-3 py-2 bg-violet-600 text-white hover:bg-violet-700 rounded-lg transition-colors font-semibold">
                            Encaminhar
                          </button>
                        </form>
                      )}

                      {canWriteItem(item) && item.tipo === 'pre_inscricao' && item.applicationId && !finalizado && !item.hospedagemResolved && (
                        item.hospedagemStatus ? (
                          <div className="col-span-2 rounded-lg border border-blue-200 bg-blue-50 p-2.5">
                            <p className="text-xs font-semibold text-blue-800">
                              ✓ Chegada em {new Date(item.hospedagemArrivalDate! + 'T00:00:00').toLocaleDateString('pt-BR')} — aguardando confirmação da hospitalidade
                            </p>
                            {item.candidateArrivalDate && item.candidateArrivalDate !== item.hospedagemArrivalDate && (
                              <p className="text-xs font-semibold text-red-700 mt-1">
                                ⚠ Diferente do que {item.nome} informou no formulário ({new Date(item.candidateArrivalDate + 'T00:00:00').toLocaleDateString('pt-BR')}) — avise sobre a mudança.
                              </p>
                            )}
                            <details className="text-xs mt-1">
                              <summary className="cursor-pointer text-blue-600 select-none">Alterar data</summary>
                              <DataChegadaField
                                slug={slug}
                                organizationId={orgId}
                                ministryId={null}
                                staffApplicationId={item.applicationId}
                                guestName={item.nome}
                                guestType="aluno"
                                prefillDate={item.hospedagemArrivalDate}
                                prefillDeparture={item.hospedagemDepartureDate}
                                submitLabel="Atualizar"
                                action={solicitarHospedagemAluno}
                              />
                            </details>
                          </div>
                        ) : item.candidateArrivalDate ? (
                          <div className="col-span-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5">
                            <p className="text-xs font-bold text-amber-900">
                              ⏳ {item.nome} indicou chegada em {new Date(item.candidateArrivalDate + 'T00:00:00').toLocaleDateString('pt-BR')} — revise e envie para a hospitalidade
                            </p>
                            <DataChegadaField
                              slug={slug}
                              organizationId={orgId}
                              ministryId={null}
                              staffApplicationId={item.applicationId}
                              guestName={item.nome}
                              guestType="aluno"
                              prefillDate={item.candidateArrivalDate}
                              hint="Confirme (ou ajuste) a data antes de avisar a hospitalidade."
                              action={solicitarHospedagemAluno}
                            />
                          </div>
                        ) : item.applicationId ? (
                          <div className="col-span-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5">
                            <p className="text-xs font-bold text-amber-900">⏳ Data de chegada ainda não informada</p>
                            <DataChegadaField
                              slug={slug}
                              organizationId={orgId}
                              ministryId={null}
                              staffApplicationId={item.applicationId}
                              guestName={item.nome}
                              guestType="aluno"
                              action={solicitarHospedagemAluno}
                            />
                          </div>
                        ) : null
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
                            {formularioPreenchido && (
                              <details className="text-xs">
                                <summary className="cursor-pointer text-gray-500 select-none">Palavra para o aluno (opcional)</summary>
                                <div className="mt-1.5 space-y-1.5">
                                  <textarea
                                    name="decision_note"
                                    rows={2}
                                    placeholder="Uma palavra de boas-vindas ou orientação, se desejar..."
                                    className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700"
                                  />
                                  <label className="flex items-start gap-2 text-gray-600">
                                    <input type="checkbox" name="decision_note_shared" className="mt-0.5" />
                                    Enviar esta mensagem ao aluno junto com o e-mail de aceite
                                  </label>
                                </div>
                              </details>
                            )}
                            <AceitarAlunoButton formularioPreenchido={formularioPreenchido} />
                          </form>
                        )
                      })()}
                      {item.tipo === 'obreiro' && currentStageLabel === 'Verificação de antecedentes' && canWrite && item.staffApplicationId && (
                        <div className="col-span-2 rounded-lg border border-gray-200 bg-white p-3">
                          <p className="text-xs font-semibold text-gray-700 mb-2">Verificação de antecedentes — etapa atual</p>
                          <BackgroundChecksSection
                            checks={item.backgroundChecks ?? []}
                            organizationId={orgId}
                            slug={slug}
                            staffApplicationId={item.staffApplicationId}
                            personId={item.personId}
                            readOnly={false}
                          />
                        </div>
                      )}
                      {item.tipo === 'obreiro' && currentStageLabel === 'Aprovado' && canWrite && item.personId && (
                        <>
                          {bgConcern && (
                            <div className="col-span-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">
                              ⚠ Verificação de antecedentes reprovada ou sinalizada como preocupante — revise em{' '}
                              {item.staffApplicationId && (
                                <a href={`/${slug}/inscricoes/formulario-obreiro/${item.staffApplicationId}`} className="underline font-semibold">
                                  ver formulário
                                </a>
                              )}{' '}antes de finalizar.
                            </div>
                          )}
                          {bgPending && (
                            <div className="col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                              Verificação de antecedentes: {bg!.total - bg!.pendentes} de {bg!.total} concluídas.{' '}
                              {item.staffApplicationId && (
                                <a href={`/${slug}/inscricoes/formulario-obreiro/${item.staffApplicationId}`} className="underline font-semibold">
                                  Dar OK ou comentar cada verificação →
                                </a>
                              )}
                            </div>
                          )}
                          <form action={finalizarObreiro} className="col-span-2 space-y-1.5 rounded-lg border border-amber-100 bg-amber-50 p-2">
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="org_id" value={orgId} />
                            <input type="hidden" name="person_id" value={item.personId} />
                            <input type="hidden" name="ministry_id" value={item.ministryId ?? ''} />
                            <input type="hidden" name="name" value={item.nome} />
                            <p className="text-xs font-semibold text-amber-800">Criar acesso à plataforma e aprovar</p>
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
                            {(bgConcern || bgPending) && (
                              <label className="flex items-start gap-2 text-xs text-amber-800">
                                <input type="checkbox" required className="mt-0.5" />
                                Estou ciente do alerta de antecedentes e assumo a decisão de finalizar mesmo assim.
                              </label>
                            )}
                            <button type="submit" className="w-full text-xs px-3 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors font-semibold">
                              Finalizar obreiro
                            </button>
                          </form>
                        </>
                      )}
                      {((item.tipo === 'pre_inscricao_obreiro' || item.tipo === 'obreiro') ? canWriteObreiro : canWriteItem(item)) && (
                        <div className="col-span-2 sm:col-span-1">
                          <RecusarModal id={item.id} tipo={item.tipo} action={recusar} />
                        </div>
                      )}
                    </div>
                  )}

                  {finalizado && <div className="text-xs text-gray-300">concluído</div>}
                </div>
                )}
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
    </div>
  )
}
