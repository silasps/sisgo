'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { GraduationCap, Church, UserCheck, ChevronDown } from 'lucide-react'
import { NovaPreInscricaoButton, NovaPreInscricaoObreiroButton } from '../inscricoes/InscricoesModals'
import { CreateObreiroModal } from '../obreiros/ObreirosClientForms'
import type { RoleRow } from '@/lib/staff/roleOptions'

type ClassOption = { id: string; school_id: string; name: string; starts_at: string | null; schoolName: string | null }
type MinistryOption = { id: string; name: string }
type SchoolOption = { id: string; name: string }
type CriarAction = (fd: FormData) => Promise<void>

export function NovaPessoaButton({
  slug, orgId, openClasses, ministries, schools, staffRoles, canCreateObreiroDireto = false,
  criarPreInscricaoManual, criarPreInscricaoObreiroManual,
}: {
  slug: string
  orgId: string
  openClasses: ClassOption[]
  ministries: MinistryOption[]
  schools: SchoolOption[]
  staffRoles: RoleRow[]
  canCreateObreiroDireto?: boolean
  criarPreInscricaoManual: CriarAction
  criarPreInscricaoObreiroManual: CriarAction
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [modal, setModal] = useState<'aluno' | 'obreiro' | 'obreiro_direto' | null>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 })
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function onClick(e: MouseEvent) {
      const target = e.target as Node
      // O menu agora é portalado pro <body> (fora da árvore de `ref`), então
      // precisa checar os dois containers — senão o próprio clique num item
      // do menu já conta como "fora" e fecha antes do onClick do item disparar.
      if (ref.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  // O cabeçalho envolve as ações num container com overflow-x-auto (pra
  // caber vários botões em telas estreitas sem quebrar a altura) — e por
  // regra do CSS, isso força overflow-y a virar "auto" também, cortando
  // qualquer menu absolute que "vaze" pra fora da barra. Portal pro <body>
  // com position:fixed escapa desse corte (mesma lógica do ConfirmModal).
  function openMenu() {
    const rect = ref.current?.getBoundingClientRect()
    if (rect) setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    setMenuOpen(m => !m)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={openMenu}
        title="Adicionar"
        className="flex items-center gap-1 px-3 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors"
      >
        <span className="text-base leading-none">+</span>
        <span className="hidden sm:inline">Adicionar</span>
        <ChevronDown className={`size-3.5 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
      </button>

      {menuOpen && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuPos.top, right: menuPos.right }}
          className="w-64 rounded-lg border border-gray-200 bg-white shadow-lg py-1 z-50"
        >
          <button
            type="button"
            onClick={() => { setModal('aluno'); setMenuOpen(false) }}
            className="w-full flex items-start gap-2 text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <GraduationCap className="size-4 text-brand-500 mt-0.5 shrink-0" />
            <span>
              <span className="block">Aluno</span>
              <span className="block text-xs text-gray-400">Pré-inscrição, entra em análise</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => { setModal('obreiro'); setMenuOpen(false) }}
            className="w-full flex items-start gap-2 text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Church className="size-4 text-violet-500 mt-0.5 shrink-0" />
            <span>
              <span className="block">Obreiro</span>
              <span className="block text-xs text-gray-400">Pré-inscrição, entra em análise</span>
            </span>
          </button>
          {canCreateObreiroDireto && (
            <button
              type="button"
              onClick={() => { setModal('obreiro_direto'); setMenuOpen(false) }}
              className="w-full flex items-start gap-2 text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <UserCheck className="size-4 text-green-600 mt-0.5 shrink-0" />
              <span>
                <span className="block">Obreiro direto</span>
                <span className="block text-xs text-gray-400">Já ativo, com login — sem passar por análise</span>
              </span>
            </button>
          )}
        </div>,
        document.body,
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
      <CreateObreiroModal
        roles={staffRoles}
        schools={schools}
        ministries={ministries}
        orgId={orgId}
        slug={slug}
        open={modal === 'obreiro_direto'}
        onOpenChange={o => setModal(o ? 'obreiro_direto' : null)}
        hideTrigger
      />
    </div>
  )
}
