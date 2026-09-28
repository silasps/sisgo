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

// Linha de tabela — visão "Lista" de /comunicacao, uma opção a mais além dos
// dois tamanhos de card (ver AnnouncementCompactCard/AnnouncementCard).
export function AnnouncementRow({ announcement: a, createAction, updateAction, deleteAction, organizationId, path, defaultOpen }: Props) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const cat = CATEGORY_STYLES[a.category] ?? CATEGORY_STYLES.aviso

  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors">
      <button type="button" onClick={() => setOpen(true)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
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
              <Megaphone size={14} className="opacity-60" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {a.pinned && <Pin size={11} className="shrink-0 text-brand-500" />}
            <p className="truncate text-sm font-medium text-gray-800">{a.title}</p>
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cat.className}`}>
              {cat.label}
            </span>
          </div>
          <p className="truncate text-xs text-gray-400">
            {a.author_name} · {new Date(a.created_at).toLocaleDateString('pt-BR')}
          </p>
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Editar"
          aria-label="Editar anúncio"
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white hover:text-brand-600"
        >
          <Pencil size={14} />
        </button>
        <form action={deleteAction}>
          <input type="hidden" name="announcement_id" value={a.id} />
          <input type="hidden" name="organization_id" value={organizationId} />
          <input type="hidden" name="revalidate_path" value={path} />
          <ConfirmSubmitButton
            confirmMessage={`Excluir o anúncio "${a.title}"? Essa ação não pode ser desfeita.`}
            title="Excluir"
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white hover:text-red-600"
          >
            <Trash2 size={14} />
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
