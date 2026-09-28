'use client'

import { useState } from 'react'
import { Pin, Pencil, Trash2, Megaphone } from 'lucide-react'
import { ConfirmSubmitButton } from '@/components/ui/ConfirmSubmitButton'
import { CATEGORY_STYLES } from '@/lib/announcement-categories'
import { focalImageStyle } from '@/lib/image-focal'
import { AnnouncementForm, type AnnouncementFormData } from './AnnouncementForm'

type Props = {
  announcement: AnnouncementFormData & { author_name: string; created_at: string }
  createAction: (formData: FormData) => Promise<void>
  updateAction: (formData: FormData) => Promise<void>
  deleteAction: (formData: FormData) => void | Promise<void>
  organizationId: string
  path: string
  defaultOpen?: boolean
}

// Grade compacta ao estilo Google Drive — mesmo tamanho pra todo mundo
// (thumbnail quadrada + uma linha de título), sem a bagunça de cards de
// altura variável do AnnouncementCard. Reaproveita o mesmo AnnouncementForm
// pra editar (mesmo modal, só muda o gatilho visual).
export function AnnouncementCompactCard({ announcement: a, createAction, updateAction, deleteAction, organizationId, path, defaultOpen }: Props) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const cat = CATEGORY_STYLES[a.category] ?? CATEGORY_STYLES.aviso

  return (
    <div className="group relative">
      <button type="button" onClick={() => setOpen(true)} className="w-full text-left">
        <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-100 transition-colors group-hover:border-brand-300">
          {a.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagem pública do bucket, não passa pelo otimizador
            <img
              src={a.image_url}
              alt=""
              className="h-full w-full object-cover"
              style={focalImageStyle(a.image_focal_x, a.image_focal_y, a.image_zoom)}
            />
          ) : (
            <div className={`flex h-full w-full items-center justify-center ${cat.className}`}>
              <Megaphone size={22} className="opacity-60" />
            </div>
          )}
          {a.pinned && (
            <span className="absolute top-1.5 left-1.5 rounded-full bg-white/90 p-1 shadow-sm">
              <Pin size={11} className="text-brand-500" />
            </span>
          )}
        </div>
        <p className="mt-1.5 truncate text-xs font-medium text-gray-700">{a.title}</p>
      </button>

      <div className="absolute top-1 right-1 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Editar"
          aria-label="Editar anúncio"
          className="rounded-lg bg-white/90 p-1 text-gray-500 shadow-sm transition-colors hover:bg-white hover:text-brand-600"
        >
          <Pencil size={12} />
        </button>
        <form action={deleteAction}>
          <input type="hidden" name="announcement_id" value={a.id} />
          <input type="hidden" name="organization_id" value={organizationId} />
          <input type="hidden" name="revalidate_path" value={path} />
          <ConfirmSubmitButton
            confirmMessage={`Excluir o anúncio "${a.title}"? Essa ação não pode ser desfeita.`}
            title="Excluir"
            className="rounded-lg bg-white/90 p-1 text-gray-500 shadow-sm transition-colors hover:bg-white hover:text-red-600"
          >
            <Trash2 size={12} />
          </ConfirmSubmitButton>
        </form>
      </div>

      <AnnouncementForm
        announcement={a}
        createAction={createAction}
        updateAction={updateAction}
        deleteAction={deleteAction}
        organizationId={organizationId}
        path={path}
        open={open}
        onOpenChange={setOpen}
        hideTrigger
      />
    </div>
  )
}
