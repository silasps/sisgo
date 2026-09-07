'use client'

import { useEffect, useRef, useState } from 'react'
import { GraduationCap, Church, ChevronDown } from 'lucide-react'
import { NovaPreInscricaoButton, NovaPreInscricaoObreiroButton } from '../inscricoes/InscricoesModals'

type ClassOption = { id: string; school_id: string; name: string; starts_at: string | null; schoolName: string | null }
type MinistryOption = { id: string; name: string }
type SchoolOption = { id: string; name: string }
type CriarAction = (fd: FormData) => Promise<void>

export function NovaPessoaButton({
  slug, openClasses, ministries, schools,
  criarPreInscricaoManual, criarPreInscricaoObreiroManual,
}: {
  slug: string
  openClasses: ClassOption[]
  ministries: MinistryOption[]
  schools: SchoolOption[]
  criarPreInscricaoManual: CriarAction
  criarPreInscricaoObreiroManual: CriarAction
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [modal, setModal] = useState<'aluno' | 'obreiro' | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen(m => !m)}
        className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors"
      >
        + Nova pessoa
        <ChevronDown className={`size-3.5 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full mt-1 w-52 rounded-lg border border-gray-200 bg-white shadow-lg py-1 z-20">
          <button
            type="button"
            onClick={() => { setModal('aluno'); setMenuOpen(false) }}
            className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <GraduationCap className="size-4 text-brand-500" />
            Aluno
          </button>
          <button
            type="button"
            onClick={() => { setModal('obreiro'); setMenuOpen(false) }}
            className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Church className="size-4 text-violet-500" />
            Obreiro
          </button>
        </div>
      )}

      <NovaPreInscricaoButton
        slug={slug}
        criarAction={criarPreInscricaoManual}
        openClasses={openClasses}
        open={modal === 'aluno'}
        onOpenChange={o => setModal(o ? 'aluno' : null)}
        hideTrigger
      />
      <NovaPreInscricaoObreiroButton
        slug={slug}
        criarAction={criarPreInscricaoObreiroManual}
        ministries={ministries}
        schools={schools}
        open={modal === 'obreiro'}
        onOpenChange={o => setModal(o ? 'obreiro' : null)}
        hideTrigger
      />
    </div>
  )
}
