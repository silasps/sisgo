'use client'

import { useState } from 'react'
import { Pin } from 'lucide-react'
import { AnnouncementDetailModal } from './AnnouncementDetailModal'
import { CATEGORY_STYLES } from '@/lib/announcement-categories'

export type AnnouncementListItem = {
  id: string
  title: string
  body: string
  pinned: boolean
  category: string
  image_url: string | null
  image_focal_x: number
  image_focal_y: number
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
        style={{ objectPosition: `${announcement.image_focal_x}% ${announcement.image_focal_y}%` }}
      />
    </div>
  )
}

/**
 * Lista clicável de anúncios — cada item abre AnnouncementDetailModal.
 * Reaproveitada em 3 lugares com pesos visuais diferentes: cards do Início
 * (`default`), banner de área/AreaHero (`hero`) e histórico completo em
 * `/anuncios` (`grid`).
 */
export function AnnouncementList({ announcements, variant = 'default' }: {
  announcements: AnnouncementListItem[]
  variant?: 'default' | 'hero' | 'grid'
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const opened = announcements.find(a => a.id === openId) ?? null

  if (variant === 'hero') {
    return (
      <>
        <div className="mt-3 space-y-2">
          {announcements.map(a => (
            <button
              key={a.id}
              type="button"
              onClick={() => setOpenId(a.id)}
              className="w-full text-left flex items-start gap-2.5 bg-white/10 hover:bg-white/15 rounded-lg px-3 py-2 transition-colors"
            >
              <Thumb announcement={a} className="w-10 h-10" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {a.pinned && <Pin size={13} className="shrink-0" />}
                  <p className="text-sm font-semibold">{a.title}</p>
                </div>
                <p className="text-xs text-white/80 line-clamp-2">{a.body}</p>
              </div>
            </button>
          ))}
        </div>
        {opened && <AnnouncementDetailModal announcement={opened} onClose={() => setOpenId(null)} />}
      </>
    )
  }

  if (variant === 'grid') {
    return (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {announcements.map(a => {
            const cat = CATEGORY_STYLES[a.category] ?? CATEGORY_STYLES.aviso
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setOpenId(a.id)}
                className="text-left bg-white rounded-xl border border-gray-200 overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5"
              >
                {a.image_url && (
                  <div className="w-full bg-gray-100" style={{ aspectRatio: '16 / 9' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.image_url}
                      alt=""
                      className="w-full h-full object-cover"
                      style={{ objectPosition: `${a.image_focal_x}% ${a.image_focal_y}%` }}
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
              </button>
            )
          })}
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
