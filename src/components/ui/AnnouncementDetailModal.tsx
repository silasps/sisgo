'use client'

import { Pin, ExternalLink } from 'lucide-react'
import { Modal } from './Modal'
import { CATEGORY_STYLES } from '@/lib/announcement-categories'
import type { AnnouncementListItem } from './AnnouncementList'

export function AnnouncementDetailModal({ announcement, onClose }: {
  announcement: AnnouncementListItem
  onClose: () => void
}) {
  const cat = CATEGORY_STYLES[announcement.category] ?? CATEGORY_STYLES.aviso

  return (
    <Modal open onClose={onClose} title={announcement.title} hideFooter>
      {announcement.image_url && (
        <div className="w-full bg-gray-100" style={{ aspectRatio: '16 / 9' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- imagem pública do bucket, não passa pelo otimizador */}
          <img
            src={announcement.image_url}
            alt=""
            className="w-full h-full object-cover"
            style={{ objectPosition: `${announcement.image_focal_x}% ${announcement.image_focal_y}%` }}
          />
        </div>
      )}
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {announcement.pinned && <Pin size={14} className="text-brand-500" />}
          <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${cat.className}`}>
            {cat.label}
          </span>
        </div>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{announcement.body}</p>
        {announcement.link_url && (
          <a
            href={announcement.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {announcement.link_label || 'Saiba mais'} <ExternalLink size={14} />
          </a>
        )}
        <div className="flex items-center gap-2 text-xs text-gray-400 pt-2 border-t border-gray-100">
          <span>{announcement.author_name}</span>
          <span>·</span>
          <span>{new Date(announcement.created_at).toLocaleDateString('pt-BR')}</span>
        </div>
      </div>
    </Modal>
  )
}
