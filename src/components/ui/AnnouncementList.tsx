'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Pin, Pencil, Trash2 } from 'lucide-react'
import { AnnouncementDetailModal } from './AnnouncementDetailModal'
import { ConfirmSubmitButton } from './ConfirmSubmitButton'
import { CATEGORY_STYLES } from '@/lib/announcement-categories'
import { focalImageStyle } from '@/lib/image-focal'

export type AnnouncementListItem = {
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
  author_name: string
  created_at: string
}

function Thumb({ announcement, className }: { announcement: AnnouncementListItem; className: string }) {
  if (!announcement.image_url) return null
  return (
    <div className={`shrink-0 rounded-lg overflow-hidden bg-gray-100 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- imagem pública do bucket, não passa pelo otimizador */}
      <img
        src={announcement.image_url}
        alt=""
        className="w-full h-full object-cover"
        style={focalImageStyle(announcement.image_focal_x, announcement.image_focal_y, announcement.image_zoom)}
      />
    </div>
  )
}

/**
 * Passe pra habilitar editar/excluir nos cards do `grid` (só faz sentido pra
 * quem gerencia anúncios — `/anuncios` decide isso, não este componente).
 * `editHrefBase` é string, não função: uma função comum não atravessa a
 * fronteira Server → Client Component (só Server Actions passam assim), o
 * componente monta o link concatenando o id.
 */
export type AnnouncementManage = {
  editHrefBase: string
  deleteAction: (formData: FormData) => void | Promise<void>
  organizationId: string
  redirectTo: string
}

function GridCardContent({ announcement: a }: { announcement: AnnouncementListItem }) {
  const cat = CATEGORY_STYLES[a.category] ?? CATEGORY_STYLES.aviso
  return (
    <>
      {a.image_url && (
        <div className="w-full bg-gray-100 overflow-hidden" style={{ aspectRatio: '16 / 9' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={a.image_url}
            alt=""
            className="w-full h-full object-cover"
            style={focalImageStyle(a.image_focal_x, a.image_focal_y, a.image_zoom)}
          />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-center gap-1.5 flex-wrap mb-1">
          {a.pinned && <Pin size={12} className="text-brand-500 shrink-0" />}
          <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${cat.className}`}>
            {cat.label}
          </span>
        </div>
        <p className="text-sm font-semibold text-gray-900">{a.title}</p>
        <p className="text-sm text-gray-600 mt-0.5 line-clamp-3">{a.body}</p>
        <p className="text-xs text-gray-400 mt-2">{new Date(a.created_at).toLocaleDateString('pt-BR')}</p>
      </div>
    </>
  )
}

/**
 * Lista clicável de anúncios — cada item abre AnnouncementDetailModal.
 * Reaproveitada em 2 lugares com pesos visuais diferentes: cards do Início
 * (`default`) e histórico completo em `/anuncios` (`grid`). O banner de área
 * (AreaHero) usa `AnnouncementCarousel` em vez desta lista.
 */
export function AnnouncementList({ announcements, variant = 'default', manage }: {
  announcements: AnnouncementListItem[]
  variant?: 'default' | 'grid'
  manage?: AnnouncementManage
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const opened = announcements.find(a => a.id === openId) ?? null

  if (variant === 'grid') {
    return (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {announcements.map(a => (
            <div key={a.id} className="relative bg-white rounded-xl border border-gray-200 overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5">
              {manage ? (
                <Link href={`${manage.editHrefBase}${a.id}#anuncio-form`} className="block text-left">
                  <GridCardContent announcement={a} />
                </Link>
              ) : (
                <button type="button" onClick={() => setOpenId(a.id)} className="w-full block text-left">
                  <GridCardContent announcement={a} />
                </button>
              )}
              {manage && (
                <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                  <Link
                    href={`${manage.editHrefBase}${a.id}#anuncio-form`}
                    title="Editar"
                    aria-label="Editar anúncio"
                    className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-gray-500 hover:text-brand-600 shadow-sm transition-colors"
                  >
                    <Pencil size={14} />
                  </Link>
                  <form action={manage.deleteAction}>
                    <input type="hidden" name="announcement_id" value={a.id} />
                    <input type="hidden" name="organization_id" value={manage.organizationId} />
                    <input type="hidden" name="redirect_to" value={manage.redirectTo} />
                    <ConfirmSubmitButton
                      confirmMessage={`Excluir o anúncio "${a.title}"? Essa ação não pode ser desfeita.`}
                      title="Excluir"
                      className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-gray-500 hover:text-red-600 shadow-sm transition-colors"
                    >
                      <Trash2 size={14} />
                    </ConfirmSubmitButton>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>
        {opened && <AnnouncementDetailModal announcement={opened} onClose={() => setOpenId(null)} />}
      </>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {announcements.map(a => {
          const cat = CATEGORY_STYLES[a.category] ?? CATEGORY_STYLES.aviso
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setOpenId(a.id)}
              className="w-full text-left flex items-start gap-2.5 border-b border-gray-100 pb-3 last:border-0 last:pb-0 group"
            >
              <Thumb announcement={a} className="w-11 h-11" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {a.pinned && <Pin size={12} className="text-brand-500 shrink-0" />}
                  <p className="text-sm font-semibold text-gray-800 group-hover:text-brand-600 transition-colors">{a.title}</p>
                  <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${cat.className}`}>
                    {cat.label}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-0.5 line-clamp-3">{a.body}</p>
              </div>
            </button>
          )
        })}
      </div>
      {opened && <AnnouncementDetailModal announcement={opened} onClose={() => setOpenId(null)} />}
    </>
  )
}
