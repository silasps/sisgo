'use client'

import { useMemo, useState } from 'react'
import { Search, X, ChevronRight } from 'lucide-react'
import { SortSelect } from '@/components/ui/SortSelect'
import { ClickableRow } from '@/components/ui/ClickableRow'
import { bestScore } from '@/lib/search/fuzzy'
import type { PessoaRow, OpenClassOption } from './page'

const GENERO_LABELS: Record<string, string> = { M: 'Homens', F: 'Mulheres', outro: 'Outro', none: 'Sem gênero informado' }

export function PessoasList({
  rows,
  tab,
  slug,
  orgId,
  openClasses,
  trocarTurmaAluno,
  col2Label,
  badgeLabel,
  defaultSort,
  initialStatus,
  initialMinisterio,
  initialGenero,
  initialSemEmail,
}: {
  rows: PessoaRow[]
  tab: string
  slug: string
  orgId: string
  openClasses: OpenClassOption[]
  trocarTurmaAluno: (formData: FormData) => void
  col2Label: string
  badgeLabel: string
  defaultSort: string
  initialStatus?: string
  initialMinisterio?: string
  initialGenero?: string
  initialSemEmail?: boolean
}) {
  // Busca e ordenação são só reorganizar dados que já estão na tela — tudo
  // no cliente, sem ida ao servidor, pra ser instantâneo. O filtro vindo de
  // Relatórios (status/ministério/gênero) funciona igual: é só um recorte
  // inicial de `rows`, que o usuário pode limpar sem recarregar a página.
  const [q, setQ] = useState('')
  const [sort, setSort] = useState(defaultSort)
  const [filter, setFilter] = useState({ status: initialStatus, ministerio: initialMinisterio, genero: initialGenero, semEmail: initialSemEmail })
  const hasFilter = Boolean(filter.status || filter.ministerio || filter.genero || filter.semEmail)

  const filterLabel = [
    filter.status === 'ativo' ? 'Ativos' : filter.status === 'inativo' ? 'Inativos' : null,
    filter.ministerio === '__none__' ? 'Sem ministério vinculado' : filter.ministerio ? `Ministério: ${filter.ministerio}` : null,
    filter.genero ? `Gênero: ${GENERO_LABELS[filter.genero] ?? filter.genero}` : null,
    filter.semEmail ? 'Sem email/login' : null,
  ].filter(Boolean).join(' · ')

  const baseRows = useMemo(() => {
    if (!hasFilter) return rows
    return rows.filter(r => {
      if (filter.status === 'ativo' && r.ativo !== true) return false
      if (filter.status === 'inativo' && r.ativo !== false) return false
      if (filter.ministerio === '__none__' && r.detalhe) return false
      if (filter.ministerio && filter.ministerio !== '__none__' && r.detalhe !== filter.ministerio) return false
      if (filter.genero === 'none' && r.genero) return false
      if (filter.genero && filter.genero !== 'none' && r.genero !== filter.genero) return false
      if (filter.semEmail && r.meta !== 'Obreiro sem cadastro') return false
      return true
    })
  }, [rows, filter, hasFilter])

  const sortedRows = useMemo(() => {
    if (q.trim()) {
      return baseRows
        .map(r => ({ row: r, score: bestScore(q, [r.nome, r.detalhe, r.meta, r.col2]) }))
        .filter((x): x is { row: PessoaRow; score: number } => x.score !== null)
        .sort((a, b) => a.score - b.score)
        .map(x => x.row)
    }
    const sorted = [...baseRows]
    sorted.sort((a, b) => {
      if (sort === 'nome_desc') return b.nome.localeCompare(a.nome, 'pt-BR')
      if (sort === 'recente') return b.criadoEm.localeCompare(a.criadoEm)
      return a.nome.localeCompare(b.nome, 'pt-BR')
    })
    return sorted
  }, [baseRows, sort, q])

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar por nome, ministério, cargo…"
            className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white w-full focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
          />
        </div>
        <SortSelect value={sort} onChange={setSort} />
      </div>

      {hasFilter && (
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 text-brand-700 px-2.5 py-1 font-medium">
            Filtro: {filterLabel}
            <button
              type="button"
              onClick={() => setFilter({ status: undefined, ministerio: undefined, genero: undefined, semEmail: undefined })}
              className="hover:text-brand-900"
              aria-label="Limpar filtro"
            >
              <X size={12} />
            </button>
          </span>
        </div>
      )}
      {!sortedRows.length ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <p className="text-gray-400 text-sm">
            {q ? `Nenhum resultado para "${q}".` : 'Nenhum registro encontrado nesta categoria.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                <th className="hidden md:table-cell text-left px-4 py-3 font-medium text-gray-600">{col2Label}</th>
                <th className="hidden md:table-cell text-left px-4 py-3 font-medium text-gray-600">{badgeLabel}</th>
                <th className="hidden md:table-cell px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedRows.map(r => {
                const personId = r.personId ?? r.id
                return (
                <ClickableRow key={r.id} href={`/${slug}/pessoas/${personId}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{r.nome}</p>
                    {r.detalhe && <p className="text-xs text-gray-400">{r.detalhe}</p>}
                    {r.meta && <p className="text-xs text-gray-500 mt-0.5">{r.meta}</p>}
                    <div className="md:hidden flex items-center gap-2 mt-1 flex-wrap">
                      {r.col2 && r.col2 !== '—' && (
                        <span className="text-xs text-gray-500">{r.col2}</span>
                      )}
                      {r.badge && (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${r.badge.color}`}>
                          {r.badge.label}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-4 py-3 text-gray-500">
                    {tab === 'alunos' && r.personId ? (
                      <form action={trocarTurmaAluno} className="flex max-w-md items-center gap-2">
                        <input type="hidden" name="person_id" value={r.personId} />
                        <input type="hidden" name="org_id" value={orgId} />
                        <select
                          name="class_id"
                          defaultValue={r.classId ?? ''}
                          className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-400"
                        >
                          <option value="" disabled>Sem turma definida</option>
                          {r.classId && !openClasses.some(classOption => classOption.id === r.classId) && (
                            <option value={r.classId}>{r.col2} · atual</option>
                          )}
                          {openClasses.map(classOption => (
                            <option key={classOption.id} value={classOption.id}>
                              {classOption.schools?.name ?? 'Escola'} · {classOption.name}
                              {classOption.starts_at ? ` · ${new Date(classOption.starts_at).toLocaleDateString('pt-BR')}` : ''}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="rounded-lg border border-gray-200 px-2.5 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                        >
                          Confirmar
                        </button>
                      </form>
                    ) : (
                      r.col2
                    )}
                  </td>
                  <td className="hidden md:table-cell px-4 py-3">
                    {r.badge ? (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${r.badge.color}`}>
                        {r.badge.label}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="hidden md:table-cell px-4 py-3 text-right">
                    <ChevronRight className="size-4 text-gray-300 inline-block" aria-hidden />
                  </td>
                </ClickableRow>
              )})}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
