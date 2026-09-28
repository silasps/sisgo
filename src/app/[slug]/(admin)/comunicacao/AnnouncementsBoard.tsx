'use client'

import { useEffect, useState } from 'react'
import { Grid3x3, LayoutGrid, List } from 'lucide-react'
import { AnnouncementCard } from './AnnouncementCard'
import { AnnouncementCompactCard } from './AnnouncementCompactCard'
import { AnnouncementRow } from './AnnouncementRow'
import type { AnnouncementFormData } from './AnnouncementForm'

type Announcement = AnnouncementFormData & { author_name: string; created_at: string }
type ViewMode = 'compact' | 'grid' | 'list'

const STORAGE_KEY = 'sisgo:comunicacao-view'
const VIEWS: Array<{ key: ViewMode; label: string; icon: typeof Grid3x3 }> = [
  { key: 'compact', label: 'Grade compacta', icon: Grid3x3 },
  { key: 'grid', label: 'Cards grandes', icon: LayoutGrid },
  { key: 'list', label: 'Lista', icon: List },
]

type Props = {
  announcements: Announcement[]
  createAction: (formData: FormData) => Promise<void>
  updateAction: (formData: FormData) => Promise<void>
  deleteAction: (formData: FormData) => void | Promise<void>
  organizationId: string
  path: string
  editId?: string
}

// Guarda a visão escolhida (por navegador) — mesma ideia do ViewToggle do
// calendário, mas com persistência: não faz sentido a pessoa escolher
// "Lista" toda vez que abre a tela.
export function AnnouncementsBoard({ announcements, createAction, updateAction, deleteAction, organizationId, path, editId }: Props) {
  const [view, setView] = useState<ViewMode>('compact')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'compact' || saved === 'grid' || saved === 'list') setView(saved)
    } catch { /* localStorage indisponível — mantém o padrão */ }
  }, [])

  function changeView(v: ViewMode) {
    setView(v)
    try { localStorage.setItem(STORAGE_KEY, v) } catch { /* ok ignorar */ }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <div className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {VIEWS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => changeView(key)}
              title={label}
              aria-label={label}
              aria-pressed={view === key}
              className={`rounded-md p-1.5 transition-colors ${
                view === key ? 'bg-brand-50 text-brand-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
      </div>

      {announcements.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">Nenhum anúncio publicado ainda.</p>
      ) : view === 'list' ? (
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {announcements.map(a => (
            <AnnouncementRow
              key={a.id} announcement={a} createAction={createAction} updateAction={updateAction}
              deleteAction={deleteAction} organizationId={organizationId} path={path} defaultOpen={a.id === editId}
            />
          ))}
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {announcements.map(a => (
            <AnnouncementCard
              key={a.id} announcement={a} createAction={createAction} updateAction={updateAction}
              deleteAction={deleteAction} organizationId={organizationId} path={path} defaultOpen={a.id === editId}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {announcements.map(a => (
            <AnnouncementCompactCard
              key={a.id} announcement={a} createAction={createAction} updateAction={updateAction}
              deleteAction={deleteAction} organizationId={organizationId} path={path} defaultOpen={a.id === editId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
