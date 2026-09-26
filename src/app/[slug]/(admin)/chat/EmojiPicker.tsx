'use client'

import { useState } from 'react'
import { Smile } from 'lucide-react'
import { EMOJI_PICKER } from './emoji'

export function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        aria-label="Inserir emoji"
      >
        <Smile size={18} />
      </button>
      {open && (
        <>
          {/* Overlay invisível pra fechar ao clicar fora — mesmo padrão já usado em InscricoesList.tsx/MuralClient.tsx/KanbanBoard.tsx. */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full right-0 mb-2 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-2 grid grid-cols-8 gap-0.5 w-64">
            {EMOJI_PICKER.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => { onSelect(emoji); setOpen(false) }}
                className="text-lg leading-none p-1.5 rounded hover:bg-gray-100 transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
