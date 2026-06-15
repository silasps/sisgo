'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { BedDouble, Wrench, FileText, Users, MoreHorizontal, type LucideIcon } from 'lucide-react'

type DeptDef = {
  id: string
  label: string
  icon: LucideIcon
  description: string
  colorBg: string
  colorText: string
  colorBorder: string
  colorHover: string
}

const DEPT_DEFS: DeptDef[] = [
  {
    id: 'hospitalidade',
    label: 'Hospitalidade',
    icon: BedDouble,
    description: 'Acomodações, hospedagem e logística',
    colorBg: 'bg-blue-50', colorText: 'text-blue-600', colorBorder: 'border-blue-100', colorHover: 'hover:border-blue-300 hover:bg-blue-50/80',
  },
  {
    id: 'manutencao',
    label: 'Manutenção',
    icon: Wrench,
    description: 'Reparos, elétrica, hidráulica e estrutura',
    colorBg: 'bg-orange-50', colorText: 'text-orange-600', colorBorder: 'border-orange-100', colorHover: 'hover:border-orange-300 hover:bg-orange-50/80',
  },
  {
    id: 'secretaria',
    label: 'Secretaria',
    icon: FileText,
    description: 'Documentos, registros e administrativo',
    colorBg: 'bg-purple-50', colorText: 'text-purple-600', colorBorder: 'border-purple-100', colorHover: 'hover:border-purple-300 hover:bg-purple-50/80',
  },
  {
    id: 'dh',
    label: 'DH',
    icon: Users,
    description: 'Desenvolvimento humano e convites',
    colorBg: 'bg-green-50', colorText: 'text-green-600', colorBorder: 'border-green-100', colorHover: 'hover:border-green-300 hover:bg-green-50/80',
  },
  {
    id: 'outro',
    label: 'Outros',
    icon: MoreHorizontal,
    description: 'Outras solicitações gerais',
    colorBg: 'bg-gray-50', colorText: 'text-gray-600', colorBorder: 'border-gray-200', colorHover: 'hover:border-gray-300 hover:bg-gray-100',
  },
]

const REQUEST_TYPES: Record<string, { value: string; label: string }[]> = {
  hospitalidade: [
    { value: 'hospedagem',        label: 'Hospedagem' },
    { value: 'logistica',         label: 'Logística' },
    { value: 'refeicao_especial', label: 'Refeição especial' },
    { value: 'outro',             label: 'Outro' },
  ],
  manutencao: [
    { value: 'eletrica',   label: 'Elétrica' },
    { value: 'hidraulica', label: 'Hidráulica' },
    { value: 'estrutura',  label: 'Estrutura / Alvenaria' },
    { value: 'moveis',     label: 'Móveis / Equipamentos' },
    { value: 'limpeza',    label: 'Limpeza / Higiene' },
    { value: 'outro',      label: 'Outro' },
  ],
  secretaria: [
    { value: 'documento',          label: 'Documento' },
    { value: 'registro',           label: 'Registro' },
    { value: 'convidar_professor', label: 'Convidar professor' },
    { value: 'outro',              label: 'Outro' },
  ],
  dh: [
    { value: 'convidar_professor', label: 'Convidar professor' },
    { value: 'outro',              label: 'Outro' },
  ],
  outro: [
    { value: 'outro', label: 'Outro' },
  ],
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pendente:   { label: 'Pendente',     cls: 'bg-yellow-100 text-yellow-800' },
  em_analise: { label: 'Em andamento', cls: 'bg-blue-100 text-blue-800' },
  resolvido:  { label: 'Resolvido',    cls: 'bg-green-100 text-green-800' },
  rejeitado:  { label: 'Rejeitado',    cls: 'bg-red-100 text-red-800' },
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  hospedagem: 'Hospedagem', logistica: 'Logística', refeicao_especial: 'Refeição especial',
  eletrica: 'Elétrica', hidraulica: 'Hidráulica', estrutura: 'Estrutura', moveis: 'Móveis', limpeza: 'Limpeza',
  documento: 'Documento', registro: 'Registro', convidar_professor: 'Convidar professor',
  outro: 'Outro',
}

export type DeptInfo = {
  id: string
  openCount: number
  canResolve: boolean
  showEstoqueLink: boolean
  slug: string
}

export type RequestItem = {
  id: string
  request_type: string
  subject: string
  description: string | null
  priority: string
  location_notes: string | null
  status: string
  created_at: string
  target_department: string
  requesterName: string | null
}

type Props = {
  deptInfos: DeptInfo[]
  requests: RequestItem[]
  handleCreate: (fd: FormData) => Promise<void>
  handleStatus: (fd: FormData) => Promise<void>
  successMsg?: string
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR')
}

export function SolicitacoesHub({ deptInfos, requests, handleCreate, handleStatus, successMsg }: Props) {
  const [activeDeptId, setActiveDeptId] = useState<string | null>(null)
  const [tab, setTab] = useState<'abertas' | 'resolvidas'>('abertas')
  const [showForm, setShowForm] = useState(false)

  const deptMap = new Map(deptInfos.map(d => [d.id, d]))
  const activeDef = DEPT_DEFS.find(d => d.id === activeDeptId)
  const activeInfo = activeDeptId ? deptMap.get(activeDeptId) : undefined

  const visibleDepts = DEPT_DEFS.filter(d => deptMap.has(d.id))

  const modalRequests = requests.filter(r => {
    if (r.target_department !== activeDeptId) return false
    const isOpen = ['pendente', 'em_analise'].includes(r.status)
    return tab === 'abertas' ? isOpen : !isOpen
  })

  function openDept(id: string) {
    setActiveDeptId(id)
    setTab('abertas')
    setShowForm(false)
  }

  function closeModal() {
    setActiveDeptId(null)
    setShowForm(false)
  }

  return (
    <>
      {successMsg && (
        <p className="mb-5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          {successMsg}
        </p>
      )}

      {/* Card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleDepts.map(dept => {
          const info = deptMap.get(dept.id)!
          const Icon = dept.icon
          return (
            <button
              key={dept.id}
              onClick={() => openDept(dept.id)}
              className={[
                'text-left w-full rounded-xl border p-5 bg-white transition-all duration-150',
                'hover:shadow-md hover:-translate-y-0.5',
                dept.colorBorder, dept.colorHover,
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`p-2.5 rounded-lg ${dept.colorBg}`}>
                  <Icon size={20} className={dept.colorText} />
                </div>
                {info.openCount > 0 && (
                  <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                    {info.openCount}
                  </span>
                )}
              </div>
              <p className={`mt-3 font-semibold ${dept.colorText}`}>{dept.label}</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{dept.description}</p>
              <p className="text-xs mt-3 font-medium text-gray-400">Abrir →</p>
            </button>
          )
        })}
      </div>

      {/* Modal */}
      {activeDeptId && activeDef && activeInfo && (
        <Modal
          open={true}
          onClose={closeModal}
          title={`Solicitações — ${activeDef.label}`}
          subtitle={activeDef.description}
        >
          <div className="px-5 py-4 flex flex-col gap-4">

            {/* Tabs */}
            <div className="flex gap-2">
              {(['abertas', 'resolvidas'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    tab === t ? 'bg-[var(--accent)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t === 'abertas' ? 'Abertas' : 'Resolvidas'}
                </button>
              ))}
            </div>

            {/* Link de estoque para manutenção */}
            {activeInfo.showEstoqueLink && (
              <a
                href={`/${activeInfo.slug}/manutencao/estoque`}
                className="text-sm text-[var(--accent)] underline underline-offset-2"
                onClick={closeModal}
              >
                Ver estoque de manutenção →
              </a>
            )}

            {/* Lista de solicitações */}
            {modalRequests.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Nenhuma solicitação encontrada.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {modalRequests.map(req => {
                  const s = STATUS_CONFIG[req.status] ?? { label: req.status, cls: 'bg-gray-100 text-gray-700' }
                  return (
                    <div key={req.id} className="rounded-xl border border-gray-200 p-4 flex flex-col gap-2 bg-gray-50">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded">
                            {REQUEST_TYPE_LABELS[req.request_type] ?? req.request_type}
                          </span>
                          {req.priority === 'urgente' && (
                            <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded">Urgente</span>
                          )}
                        </div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${s.cls}`}>{s.label}</span>
                      </div>

                      <p className="font-semibold text-gray-900 text-sm">{req.subject}</p>

                      {req.location_notes && (
                        <p className="text-xs text-gray-500">📍 {req.location_notes}</p>
                      )}
                      {req.description && (
                        <p className="text-xs text-gray-600 whitespace-pre-line">{req.description}</p>
                      )}

                      <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-gray-100">
                        <span className="text-xs text-gray-400">
                          {req.requesterName ? `${req.requesterName} · ` : ''}
                          {fmtDate(req.created_at)}
                        </span>
                        {activeInfo.canResolve && !['resolvido', 'rejeitado'].includes(req.status) && (
                          <div className="flex gap-2 flex-wrap">
                            {req.status === 'pendente' && (
                              <form action={handleStatus}>
                                <input type="hidden" name="id" value={req.id} />
                                <input type="hidden" name="status" value="em_analise" />
                                <button type="submit" className="text-xs px-3 py-1 rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors">
                                  Iniciar
                                </button>
                              </form>
                            )}
                            <form action={handleStatus}>
                              <input type="hidden" name="id" value={req.id} />
                              <input type="hidden" name="status" value="resolvido" />
                              <button type="submit" className="text-xs px-3 py-1 rounded-lg border border-green-300 text-green-700 hover:bg-green-50 transition-colors">
                                Resolver
                              </button>
                            </form>
                            <form action={handleStatus}>
                              <input type="hidden" name="id" value={req.id} />
                              <input type="hidden" name="status" value="rejeitado" />
                              <button type="submit" className="text-xs px-3 py-1 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 transition-colors">
                                Rejeitar
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Nova solicitação */}
            {!showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-500 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
              >
                + Nova solicitação
              </button>
            ) : (
              <div className="rounded-xl border border-gray-200 p-4 bg-white">
                <p className="text-sm font-semibold text-gray-700 mb-3">Nova solicitação para {activeDef.label}</p>
                <form action={handleCreate} className="space-y-3">
                  <input type="hidden" name="target_department" value={activeDeptId} />
                  <div className={`grid gap-3 ${activeDeptId === 'manutencao' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Tipo *</label>
                      <select name="request_type" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]">
                        <option value="">Selecione…</option>
                        {(REQUEST_TYPES[activeDeptId] ?? REQUEST_TYPES.outro).map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    {activeDeptId === 'manutencao' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Prioridade</label>
                        <select name="priority" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]">
                          <option value="normal">Normal</option>
                          <option value="urgente">🔴 Urgente</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Assunto *</label>
                    <input
                      name="subject"
                      required
                      placeholder="Resumo da solicitação..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                  </div>
                  {activeDeptId === 'manutencao' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Local</label>
                      <input
                        name="location_notes"
                        placeholder="Ex: Banheiro masculino, 1º andar"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Descrição (opcional)</label>
                    <textarea
                      name="description"
                      rows={2}
                      placeholder="Detalhes adicionais..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                      Enviar
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
