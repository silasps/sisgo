'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Copy, Check } from 'lucide-react'
import type { PessoaSemEmail } from '@/lib/import-pessoas/pendentes'

export function PendentesSemEmailList({ pessoas, baseUrl }: { pessoas: PessoaSemEmail[]; baseUrl: string }) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function copiar(personId: string, path: string) {
    try {
      await navigator.clipboard.writeText(`${baseUrl}${path}`)
      setCopiedId(personId)
      toast.success('Link copiado!')
      setTimeout(() => setCopiedId(current => (current === personId ? null : current)), 2000)
    } catch {
      toast.error('Não foi possível copiar o link.')
    }
  }

  if (pessoas.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
      <h2 className="font-semibold text-gray-900">Pendentes de email ({pessoas.length})</h2>
      <p className="text-sm text-gray-500 mt-1 mb-4">
        Foram importadas sem email, então ainda não têm login. Copie o link de cada uma e
        envie por WhatsApp ou outro canal — ela mesma preenche o email e o resto do cadastro,
        direto no sistema.
      </p>
      <div className="divide-y divide-gray-100">
        {pessoas.map(p => (
          <div key={p.personId} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{p.nome}</p>
              <p className="text-xs text-gray-500 truncate">{[p.roleTitle, p.area].filter(Boolean).join(' — ') || 'Obreiro'}</p>
            </div>
            {p.path ? (
              <button
                type="button"
                onClick={() => copiar(p.personId, p.path!)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                {copiedId === p.personId ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
                {copiedId === p.personId ? 'Copiado' : 'Copiar link'}
              </button>
            ) : (
              <span className="shrink-0 text-xs text-gray-400">Sem link disponível</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
