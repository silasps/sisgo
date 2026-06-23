'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/Modal'
import { gerarLinkReferencia } from '@/app/[slug]/formulario/[token]/actions'
import { gerarLinkReferenciaObreiro } from '@/app/[slug]/formulario-obreiro/[token]/actions'
import { Link as LinkIcon, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

type ClassOption = { id: string; school_id: string; name: string; starts_at: string | null; schoolName: string | null }
type CriarAction = (fd: FormData) => Promise<void>
type EditarAction = (fd: FormData) => Promise<void>

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
        + Nova pré-inscrição
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">E-mail</label>
              <input name="email" type="email" placeholder="email@exemplo.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Telefone / WhatsApp</label>
              <input name="phone" type="tel" placeholder="+55 41 99999-0000"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
          </div>

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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">E-mail</label>
              <input name="email" type="email" defaultValue={item.email ?? ''}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Telefone</label>
              <input name="phone" type="tel" defaultValue={item.phone ?? ''}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
          </div>

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
      <button type="button" onClick={() => setOpen(true)}
        className="w-full text-xs px-3 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors font-medium">
        Formulário recebido externamente
      </button>

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
  applicationId, candidateName, slug, isStaff,
}: {
  applicationId: string
  candidateName: string
  slug: string
  isStaff?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [links, setLinks] = useState<{ pastor: string | null; amigo: string | null }>({ pastor: null, amigo: null })
  const [loading, setLoading] = useState<'pastor' | 'amigo' | null>(null)
  const [copied, setCopied] = useState<'pastor' | 'amigo' | null>(null)

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
        className="w-full text-xs px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors font-medium">
        Links de recomendação →
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Links de recomendação" subtitle={candidateName}>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-600">
            Gere os links e envie para o pastor e para um amigo de confiança do candidato.
          </p>
          {items.map(({ tipo, label, btnClass, textClass }) => (
            <div key={tipo} className="space-y-2">
              <p className="text-xs font-semibold text-gray-700">{label}</p>
              <button onClick={() => gerar(tipo)} disabled={loading === tipo}
                className={`w-full py-2.5 px-4 ${btnClass} disabled:opacity-60 text-white font-semibold rounded-xl transition-colors text-sm`}>
                {loading === tipo ? 'Gerando…' : links[tipo] ? <><RefreshCw className="size-3 inline -mt-0.5" /> Novo link</> : <><LinkIcon className="size-3 inline -mt-0.5" /> Gerar link</>}
              </button>
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
          ))}
          <p className="text-xs text-gray-400 text-center">Cada link é único e expira em 30 dias.</p>
        </div>
      </Modal>
    </>
  )
}
