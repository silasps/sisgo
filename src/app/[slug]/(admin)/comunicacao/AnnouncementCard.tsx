'use client'

import { useState } from 'react'
import { Pin, Clock, Pencil, Trash2 } from 'lucide-react'
import { ConfirmSubmitButton } from '@/components/ui/ConfirmSubmitButton'
import { CATEGORY_STYLES } from '@/lib/announcement-categories'
import { AUDIENCE_ROLES } from '@/lib/audience-roles'
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

// Card compacto de /comunicacao — clicar em qualquer parte do card OU no
// lápis abre o mesmo modal de edição (um único `open` compartilhado, pra não
// ter um ícone "de mentira" que não reage a clique nem dois modais
// independentes pro mesmo anúncio).
export function AnnouncementCard({ announcement: a, createAction, updateAction, deleteAction, organizationId, path, defaultOpen }: Props) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const cat = CATEGORY_STYLES[a.category] ?? CATEGORY_STYLES.aviso
  const isScheduled = !!a.publish_at && new Date(a.publish_at).getTime() > Date.now()

  return (
    <div className="relative bg-white rounded-xl border border-gray-200 overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5">
      <button type="button" onClick={() => setOpen(true)} className="w-full block text-left">
        {a.image_url && (
          <div className="w-full bg-gray-100 overflow-hidden" style={{ aspectRatio: '16 / 9' }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- imagem pública do bucket, não passa pelo otimizador */}
            <img src={a.image_url} alt="" className="w-full h-full object-cover" style={focalImageStyle(a.image_focal_x, a.image_focal_y, a.image_zoom)} />
          </div>
        )}
        <div className="p-3">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            {a.pinned && <Pin size={12} className="text-brand-500 shrink-0" />}
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${cat.className}`}>{cat.label}</span>
            {isScheduled && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">
                <Clock size={10} /> Agendado
              </span>
            )}
          </div>
          <p className="font-semibold text-gray-900 text-sm">{a.title}</p>
          <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{a.body}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px] text-gray-400">
            <span>{a.author_name}</span>
            <span>·</span>
            <span>{new Date(a.created_at).toLocaleDateString('pt-BR')}</span>
            {a.visible_to_roles && a.visible_to_roles.length > 0 && (
              <>
                <span>·</span>
                <span className="truncate">{a.visible_to_roles.map(r => AUDIENCE_ROLES.find(o => o.value === r)?.label ?? r).join(', ')}</span>
              </>
            )}
          </div>
        </div>
      </button>

      <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Editar"
          aria-label="Editar anúncio"
          className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-gray-500 hover:text-brand-600 shadow-sm transition-colors"
        >
          <Pencil size={13} />
        </button>
        <form action={deleteAction}>
          <input type="hidden" name="announcement_id" value={a.id} />
          <input type="hidden" name="organization_id" value={organizationId} />
          <input type="hidden" name="revalidate_path" value={path} />
          <ConfirmSubmitButton
            confirmMessage={`Excluir o anúncio "${a.title}"? Essa ação não pode ser desfeita.`}
            title="Excluir"
            className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-gray-500 hover:text-red-600 shadow-sm transition-colors"
          >
            <Trash2 size={13} />
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
