'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/Modal'
import { InternationalPhoneField } from '@/components/ui/InternationalPhoneField'
import { gerarLinkReferencia } from '@/app/[slug]/formulario/[token]/actions'
import { gerarLinkReferenciaObreiro } from '@/app/[slug]/formulario-obreiro/[token]/actions'
import { Link as LinkIcon, RefreshCw, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { ReferenceAnswers } from './ReferenceAnswers'

type RefEntry = { status: string; data: Record<string, string> | null }
type RefSummary = { pastor: RefEntry | null; amigo: RefEntry | null }

type ClassOption = { id: string; school_id: string; name: string; starts_at: string | null; schoolName: string | null }
type MinistryOption = { id: string; name: string }
type SchoolOption = { id: string; name: string }
type CriarAction = (fd: FormData) => Promise<void>
type EditarAction = (fd: FormData) => Promise<void>

function DestinationSelect({ ministries, schools, defaultValue, className }: {
  ministries: MinistryOption[]
  schools: SchoolOption[]
  defaultValue?: string
  className: string
}) {
  if (ministries.length === 0 && schools.length === 0) return null
  return (
    <select name="destination" defaultValue={defaultValue ?? ''} className={className}>
      <option value="">Sem preferência</option>
      {ministries.length > 0 && (
        <optgroup label="Ministérios">
          {ministries.map(m => (
            <option key={m.id} value={`ministry:${m.id}`}>{m.name}</option>
          ))}
        </optgroup>
      )}
      {schools.length > 0 && (
        <optgroup label="Escolas">
          {schools.map(s => (
            <option key={s.id} value={`school:${s.id}`}>{s.name}</option>
          ))}
        </optgroup>
      )}
    </select>
  )
}

// ── Nova pré-inscrição manual ──────────────────────────────────────────────

export function NovaPreInscricaoButton({
  openClasses, criarAction, slug,
}: {
  openClasses: ClassOption[]
  criarAction: CriarAction
  slug: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    await criarAction(fd)
    setLoading(false)
    setOpen(false)
    toast.success('Pré-inscrição criada')
    router.refresh()
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="px-3 py-2 text-xs font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-lg transition-colors whitespace-nowrap">
        + Aluno
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Nova pré-inscrição manual"
        subtitle="Somente nome obrigatório — restante é opcional">
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <input type="hidden" name="slug" value={slug} />

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome completo *</label>
            <input name="full_name" required placeholder="Nome do candidato"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">E-mail</label>
            <input name="email" type="email" placeholder="email@exemplo.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>

          <InternationalPhoneField phoneName="phone" />

          {openClasses.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Escola / Turma de interesse</label>
              <select name="class_id"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                <option value="">Sem preferência</option>
                {openClasses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.schoolName ?? 'ETED'} · {c.name}
                    {c.starts_at ? ` · ${new Date(c.starts_at).toLocaleDateString('pt-BR')}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Observação / mensagem</label>
            <textarea name="message" rows={3} placeholder="Contexto, indicação, observações..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setOpen(false)}
              className="flex-1 px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-60 rounded-lg transition-colors">
              {loading ? 'Criando…' : 'Criar pré-inscrição'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}

// ── Nova pré-inscrição de obreiro ─────────────────────────────────────────

export function NovaPreInscricaoObreiroButton({
  ministries, schools, criarAction, slug,
}: {
  ministries: MinistryOption[]
  schools: SchoolOption[]
  criarAction: CriarAction
  slug: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    await criarAction(fd)
    setLoading(false)
    setOpen(false)
    toast.success('Pré-inscrição de obreiro criada')
    router.refresh()
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="px-3 py-2 text-xs font-semibold text-white bg-violet-500 hover:bg-violet-600 rounded-lg transition-colors whitespace-nowrap">
        + Obreiro
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Nova pré-inscrição de obreiro"
        subtitle="Somente nome obrigatório — restante é opcional">
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <input type="hidden" name="slug" value={slug} />

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome completo *</label>
            <input name="full_name" required placeholder="Nome do candidato"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">E-mail</label>
            <input name="email" type="email" placeholder="email@exemplo.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
          </div>

          <InternationalPhoneField phoneName="phone" accentRing="ring-violet-400" />

          {(ministries.length > 0 || schools.length > 0) && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ministério ou escola de interesse</label>
              <DestinationSelect
                ministries={ministries}
                schools={schools}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Observação / mensagem</label>
            <textarea name="message" rows={3} placeholder="Contexto, indicação, observações..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setOpen(false)}
              className="flex-1 px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-violet-500 hover:bg-violet-600 disabled:opacity-60 rounded-lg transition-colors">
              {loading ? 'Criando…' : 'Criar pré-inscrição'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}

// ── Editar pré-inscrição ──────────────────────────────────────────────────

type PreInscricao = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  message: string | null
  classId: string | null
}

export function EditarPreInscricaoButton({
  item, openClasses, editarAction,
}: {
  item: PreInscricao
  openClasses: ClassOption[]
  editarAction: EditarAction
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    await editarAction(fd)
    setLoading(false)
    setOpen(false)
    toast.success('Pré-inscrição atualizada')
    router.refresh()
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        title="Editar pré-inscrição"
        className="text-xs px-2.5 py-1.5 text-gray-500 hover:text-brand-600 hover:bg-brand-50 border border-gray-200 rounded-lg transition-colors">
        Editar
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Editar pré-inscrição"
        subtitle={item.full_name}>
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <input type="hidden" name="id" value={item.id} />

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome completo *</label>
            <input name="full_name" required defaultValue={item.full_name}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">E-mail</label>
            <input name="email" type="email" defaultValue={item.email ?? ''}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>

          <InternationalPhoneField phoneName="phone" defaultPhone={item.phone} />

          {openClasses.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Turma de interesse</label>
              <select name="class_id" defaultValue={item.classId ?? ''}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                <option value="">Sem preferência</option>
                {openClasses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.schoolName ?? 'ETED'} · {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Observação / mensagem</label>
            <textarea name="message" rows={3} defaultValue={item.message ?? ''}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setOpen(false)}
              className="flex-1 px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-60 rounded-lg transition-colors">
              {loading ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}

// ── Editar pré-inscrição de obreiro ───────────────────────────────────────

type PreInscricaoObreiro = {
  id: string; full_name: string; email: string | null; phone: string | null
  message: string | null; ministryId: string | null; schoolId: string | null
}

export function EditarPreInscricaoObreiroButton({
  item, ministries, schools, editarAction,
}: {
  item: PreInscricaoObreiro
  ministries: MinistryOption[]
  schools: SchoolOption[]
  editarAction: EditarAction
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    await editarAction(fd)
    setLoading(false)
    setOpen(false)
    toast.success('Pré-inscrição atualizada')
    router.refresh()
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        title="Editar pré-inscrição"
        className="text-xs px-2.5 py-1.5 text-gray-500 hover:text-violet-600 hover:bg-violet-50 border border-gray-200 rounded-lg transition-colors">
        Editar
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Editar pré-inscrição de obreiro"
        subtitle={item.full_name}>
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <input type="hidden" name="id" value={item.id} />

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome completo *</label>
            <input name="full_name" required defaultValue={item.full_name}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">E-mail</label>
            <input name="email" type="email" defaultValue={item.email ?? ''}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
          </div>

          <InternationalPhoneField phoneName="phone" defaultPhone={item.phone} accentRing="ring-violet-400" />

          {(ministries.length > 0 || schools.length > 0) && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ministério ou escola de interesse</label>
              <DestinationSelect
                ministries={ministries}
                schools={schools}
                defaultValue={item.ministryId ? `ministry:${item.ministryId}` : item.schoolId ? `school:${item.schoolId}` : ''}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Observação / mensagem</label>
            <textarea name="message" rows={3} defaultValue={item.message ?? ''}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setOpen(false)}
              className="flex-1 px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-violet-500 hover:bg-violet-600 disabled:opacity-60 rounded-lg transition-colors">
              {loading ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}

// ── Formulário recebido por outro meio ────────────────────────────────────

type ExternoAction = (fd: FormData) => Promise<void>

export function MarcarRecebidoExternoButton({
  interestFormId, externoAction,
}: {
  interestFormId: string
  externoAction: ExternoAction
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    const fd = new FormData()
    fd.append('interest_form_id', interestFormId)
    await externoAction(fd)
    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <button type="button" onClick={() => setOpen(true)}
          className="w-full text-xs px-3 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors font-medium">
          Já respondeu no papel/PDF? Marcar como recebido
        </button>
        <p className="text-xs text-gray-400 leading-tight max-w-[220px]">
          Pula o envio por e-mail e libera direto as recomendações do pastor/amigo.
        </p>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Formulário recebido por outro meio"
        subtitle="Confirme para liberar os links de recomendação">
        <div className="p-5 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            Use esta opção quando o candidato preencheu o formulário de inscrição fora do sistema (impresso, PDF ou outra plataforma).
            <br /><br />
            Ao confirmar, a pré-inscrição avança para <strong>em análise</strong> e os links de recomendação do pastor e do amigo ficam disponíveis para envio.
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setOpen(false)}
              className="flex-1 px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="button" onClick={handleConfirm} disabled={loading}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-60 rounded-lg transition-colors">
              {loading ? 'Registrando…' : 'Confirmar'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}

// ── Links de recomendação (pastor / amigo) desde o admin ─────────────────

export function LinksReferenciaAdminButton({
  applicationId, candidateName, slug, isStaff, refSummary,
}: {
  applicationId: string
  candidateName: string
  slug: string
  isStaff?: boolean
  refSummary?: RefSummary | null
}) {
  const [open, setOpen] = useState(false)
  const [links, setLinks] = useState<{ pastor: string | null; amigo: string | null }>({ pastor: null, amigo: null })
  const [loading, setLoading] = useState<'pastor' | 'amigo' | null>(null)
  const [copied, setCopied] = useState<'pastor' | 'amigo' | null>(null)
  const [showRespostas, setShowRespostas] = useState<'pastor' | 'amigo' | null>(null)
  const [confirmTipo, setConfirmTipo] = useState<'pastor' | 'amigo' | null>(null)
  const anyRespondido = refSummary?.pastor?.status === 'enviado' || refSummary?.amigo?.status === 'enviado'

  async function gerar(tipo: 'pastor' | 'amigo') {
    setLoading(tipo)
    try {
      const result = isStaff
        ? await gerarLinkReferenciaObreiro(slug, applicationId, tipo)
        : await gerarLinkReferencia(slug, applicationId, tipo)
      if ('url' in result && result.url) {
        setLinks(prev => ({ ...prev, [tipo]: result.url }))
      }
    } catch { /* ignore */ }
    setLoading(null)
  }

  async function copiar(link: string, tipo: 'pastor' | 'amigo') {
    await navigator.clipboard.writeText(link).catch(() => {})
    setCopied(tipo)
    setTimeout(() => setCopied(null), 3000)
  }

  const items = [
    { tipo: 'pastor' as const, label: 'Pastor / Líder responsável', btnClass: 'bg-indigo-600 hover:bg-indigo-700', textClass: 'text-indigo-600 hover:text-indigo-800' },
    { tipo: 'amigo' as const,  label: 'Amigo de referência',        btnClass: 'bg-purple-600 hover:bg-purple-700', textClass: 'text-purple-600 hover:text-purple-800' },
  ]

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className={`w-full text-xs px-3 py-2 rounded-lg transition-colors font-medium border ${anyRespondido ? 'bg-green-50 text-green-700 hover:bg-green-100 border-green-200' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200'}`}>
        {anyRespondido ? <><CheckCircle2 className="size-3.5 inline -mt-0.5" /> Recomendações</> : 'Links de recomendação →'}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Recomendações" subtitle={candidateName}>
        <div className="p-5 space-y-4">
          {items.map(({ tipo, label, btnClass, textClass }) => {
            const entry = refSummary?.[tipo] ?? null
            const respondido = entry?.status === 'enviado' && entry.data

            return (
              <div key={tipo} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-700">{label}</p>
                  {respondido && <span className="text-xs font-bold text-green-700">✓ Respondido</span>}
                </div>

                {respondido ? (
                  <>
                    <button onClick={() => setShowRespostas(showRespostas === tipo ? null : tipo)}
                      className="w-full py-2 px-3 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 text-xs font-semibold rounded-lg transition-colors">
                      {showRespostas === tipo ? 'Ocultar respostas' : 'Ver respostas'}
                    </button>
                    {showRespostas === tipo && entry?.data && (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 max-h-72 overflow-y-auto">
                        <ReferenceAnswers tipo={tipo} data={entry.data} isStaff={isStaff} />
                      </div>
                    )}
                    <button
                      onClick={() => setConfirmTipo(tipo)}
                      disabled={loading === tipo}
                      className={`text-xs font-medium ${textClass}`}>
                      {loading === tipo ? 'Gerando…' : <><RefreshCw className="size-3 inline -mt-0.5" /> Gerar novo link (substitui a resposta atual)</>}
                    </button>
                  </>
                ) : (
                  <button onClick={() => gerar(tipo)} disabled={loading === tipo}
                    className={`w-full py-2.5 px-4 ${btnClass} disabled:opacity-60 text-white font-semibold rounded-xl transition-colors text-sm`}>
                    {loading === tipo ? 'Gerando…' : links[tipo] ? <><RefreshCw className="size-3 inline -mt-0.5" /> Novo link</> : <><LinkIcon className="size-3 inline -mt-0.5" /> Gerar link</>}
                  </button>
                )}
                {links[tipo] && (
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                    <input readOnly value={links[tipo]!}
                      className="flex-1 text-xs text-gray-600 bg-transparent outline-none truncate" />
                    <button onClick={() => copiar(links[tipo]!, tipo)}
                      className={`text-xs font-semibold ${textClass} whitespace-nowrap`}>
                      {copied === tipo ? '✓ Copiado!' : 'Copiar'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
          <p className="text-xs text-gray-400 text-center">Cada link é único e expira em 30 dias.</p>
        </div>
      </Modal>

      {confirmTipo && (
        <div
          className="fixed inset-0 md:left-60 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setConfirmTipo(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
              <p className="font-semibold mb-1">Tem certeza que deseja gerar outro link?</p>
              <p>Você vai remover a última resposta que foi enviada — essa ação não pode ser desfeita.</p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmTipo(null)}
                className="flex-1 px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button type="button"
                onClick={() => { const tipo = confirmTipo; setConfirmTipo(null); gerar(tipo) }}
                disabled={loading === confirmTipo}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg transition-colors">
                {loading === confirmTipo ? 'Gerando…' : 'Sim, gerar novo link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
