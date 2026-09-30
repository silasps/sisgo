'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Plus } from 'lucide-react'

type Action = (formData: FormData) => Promise<void>

const INPUT = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400'

/** Botão de destaque (não mais um formulário solto no fim da página) que abre
 * o cadastro de turma já com os campos que definem a turma pro candidato
 * (vagas inclusas) — o resto (custo, local, inscrições públicas) continua na
 * página da turma, que é pra onde o cadastro já redireciona ao salvar.
 * Form nativo com a action do servidor direto (sem onSubmit): `createTurma`
 * termina com `redirect()`, que só funciona limpo assim — via fetch manual
 * (`await action(fd)` num onSubmit) o redirect do server action não navega. */
export function NovaTurmaModal({ action }: { action: Action }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        <Plus className="size-4" /> Nova turma
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Nova turma"
        subtitle="Só o nome é obrigatório — o resto (custo, local, inscrições) você define na página da turma logo em seguida">
        <form action={action} className="space-y-4 p-5">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome da turma *</label>
            <input name="name" required placeholder="Ex: ETED Julho 2026" className={INPUT} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ano</label>
              <input name="year" type="number" placeholder="2026" className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Semestre</label>
              <input name="semester" type="number" min="1" max="2" placeholder="1 ou 2" className={INPUT} />
            </div>
          </div>

          {/* <input type="date"> no Safari iOS ignora width:100% quando vazio
              (o placeholder "dd/mm/aaaa" pede mais espaço nativo do que a
              largura calculada) — overflow-hidden no wrapper contém o campo
              mesmo assim, em vez de deixar ele estourar o card do modal. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="overflow-hidden">
              <label className="block text-xs font-medium text-gray-600 mb-1">Início</label>
              <input name="starts_at" type="date" className={`${INPUT} max-w-full min-w-0`} />
            </div>
            <div className="overflow-hidden">
              <label className="block text-xs font-medium text-gray-600 mb-1">Fim</label>
              <input name="ends_at" type="date" className={`${INPUT} max-w-full min-w-0`} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Vagas (máx. de alunos)</label>
            <input name="max_students" type="number" min="1" placeholder="Ex: 30" className={INPUT} />
            <p className="text-[11px] text-gray-400 mt-1">Em branco = sem limite.</p>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setOpen(false)}
              className="flex-1 px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit"
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-lg transition-colors">
              Criar turma
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
