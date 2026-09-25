'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { ConfirmSubmitButton } from '@/components/ui/ConfirmSubmitButton'
import { FocalPointImageField } from '@/components/ui/FocalPointImageField'
import { AUDIENCE_ROLES } from '@/lib/audience-roles'
import { ANNOUNCEMENT_CATEGORIES } from '@/lib/announcement-categories'

export type AnnouncementFormData = {
  id: string
  title: string
  body: string
  pinned: boolean
  category: string
  image_url: string | null
  image_focal_x: number
  image_focal_y: number
  image_zoom: number
  link_url: string | null
  link_label: string | null
  visible_to_roles: string[] | null
  expires_at: string | null
  publish_at: string | null
}

// Converte o timestamptz salvo (UTC) de volta pra "YYYY-MM-DD" no fuso da
// base — um slice() ingênuo no ISO cru pode cair no dia seguinte quando o
// horário salvo (23:59:59-03:00) cruza a meia-noite UTC.
function dateInputValue(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) : ''
}

// Cria e edita anúncio no mesmo componente, dentro de um Modal — mesmo
// esqueleto de RoomForm.tsx (hospedagem/quartos): create/updateAction rodam
// no servidor e chamam revalidatePath (sem redirect), o fechamento/feedback
// do modal é decidido aqui no client depois que a Server Action resolve.
export function AnnouncementForm({
  announcement, createAction, updateAction, deleteAction, organizationId, path, defaultOpen, trigger,
  open: openProp, onOpenChange, hideTrigger,
}: {
  announcement?: AnnouncementFormData | null
  createAction: (formData: FormData) => Promise<void>
  updateAction: (formData: FormData) => Promise<void>
  deleteAction: (formData: FormData) => void | Promise<void>
  organizationId: string
  path: string
  defaultOpen?: boolean
  trigger?: React.ReactNode
  /** Controlado de fora (ex.: AnnouncementCard, que também usa esse estado pro ícone de editar) — sem isso, o modal gerencia seu próprio open/close. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Não renderiza o span clicável padrão — quem chamou já dá o próprio jeito de abrir via `open`/`onOpenChange`. */
  hideTrigger?: boolean
}) {
  const [openState, setOpenState] = useState(defaultOpen ?? false)
  const open = openProp ?? openState
  const setOpen = onOpenChange ?? setOpenState
  const isEdit = !!announcement
  const formRef = useRef<HTMLFormElement>(null)

  async function submit(formData: FormData) {
    try {
      await (isEdit ? updateAction : createAction)(formData)
      toast.success(isEdit ? 'Anúncio atualizado.' : 'Anúncio publicado.')
      setOpen(false)
      formRef.current?.reset()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar o anúncio.')
    }
  }

  async function handleDelete(formData: FormData) {
    try {
      await deleteAction(formData)
      toast.success('Anúncio excluído.')
      setOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível excluir o anúncio.')
    }
  }

  return (
    <>
      {!hideTrigger && (
        <span onClick={() => setOpen(true)}>
          {trigger ?? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus size={16} /> Novo anúncio
            </button>
          )}
        </span>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={isEdit ? 'Editar anúncio' : 'Novo anúncio'} hideFooter>
        <form ref={formRef} action={submit} className="p-5 space-y-3">
          {isEdit && <input type="hidden" name="announcement_id" value={announcement.id} />}
          <input
            name="title"
            placeholder="Título"
            required
            defaultValue={announcement?.title ?? ''}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <textarea
            name="body"
            placeholder="Texto do anúncio"
            required
            rows={4}
            defaultValue={announcement?.body ?? ''}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
          />

          <div>
            <label className="mb-1.5 block text-xs text-gray-500">Imagem (opcional)</label>
            <FocalPointImageField
              name="image"
              existingImageUrl={announcement?.image_url}
              existingFocalX={announcement?.image_focal_x}
              existingFocalY={announcement?.image_focal_y}
              existingZoom={announcement?.image_zoom}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">Categoria</label>
              <select
                name="category"
                defaultValue={announcement?.category ?? 'aviso'}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                {ANNOUNCEMENT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 self-end pb-2">
              <input type="checkbox" name="pinned" defaultChecked={announcement?.pinned} className="size-4" />
              Fixar no topo
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <input
              name="link_url"
              type="url"
              placeholder="Link (opcional) — ex: inscrição, mais detalhes"
              defaultValue={announcement?.link_url ?? ''}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <input
              name="link_label"
              placeholder="Texto do botão (ex: Inscreva-se)"
              defaultValue={announcement?.link_label ?? ''}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              Agendar publicação para
              <input type="date" name="publish_on" defaultValue={dateInputValue(announcement?.publish_at ?? null)} className="rounded-lg border border-gray-300 px-2 py-1 text-sm" />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              Validade até
              <input type="date" name="expires_on" defaultValue={dateInputValue(announcement?.expires_at ?? null)} className="rounded-lg border border-gray-300 px-2 py-1 text-sm" />
            </label>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-gray-500">
              Quem vê <span className="text-gray-400">(nenhum marcado = todos)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {AUDIENCE_ROLES.map(r => (
                <label
                  key={r.value}
                  className="flex items-center gap-1 rounded-full border border-gray-200 px-2 py-1 text-xs text-gray-600 has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700"
                >
                  <input type="checkbox" name="visible_to_roles" value={r.value} defaultChecked={announcement?.visible_to_roles?.includes(r.value) ?? false} className="size-3" />
                  {r.label}
                </label>
              ))}
            </div>
          </div>

          <SubmitButton
            className="w-full py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors"
            pendingText={isEdit ? 'Salvando…' : 'Publicando…'}
          >
            {isEdit ? 'Salvar alterações' : 'Publicar'}
          </SubmitButton>
        </form>

        {isEdit && (
          <div className="px-5 pb-5 -mt-2">
            <form action={handleDelete}>
              <input type="hidden" name="announcement_id" value={announcement.id} />
              <input type="hidden" name="organization_id" value={organizationId} />
              <input type="hidden" name="revalidate_path" value={path} />
              <ConfirmSubmitButton
                confirmMessage={`Excluir o anúncio "${announcement.title}"? Essa ação não pode ser desfeita.`}
                className="inline-flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 hover:underline font-medium"
              >
                <Trash2 size={13} /> Excluir este anúncio
              </ConfirmSubmitButton>
            </form>
          </div>
        )}
      </Modal>
    </>
  )
}
