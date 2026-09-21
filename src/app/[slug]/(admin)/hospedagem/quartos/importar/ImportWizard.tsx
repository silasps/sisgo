'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, Upload, XCircle } from 'lucide-react'
import { parseImportRows, type ParsedRow } from './parse'
import type { BulkImportRow } from '../../actions'

type CommitResult = { blocksCreated: number; floorsCreated: number; roomsCreated: number; bedsCreated: number; warnings: string[] }

type Props = {
  slug: string
  commitAction: (rows: BulkImportRow[]) => Promise<CommitResult>
}

type Step = 'upload' | 'preview' | 'done'

export function ImportWizard({ slug, commitAction }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [fatalError, setFatalError] = useState<string | null>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [committing, setCommitting] = useState(false)
  const [result, setResult] = useState<CommitResult | null>(null)

  const okRows = rows.filter(r => !r.error)
  const warnRows = okRows.filter(r => r.warnings.length > 0)
  const errorRows = rows.filter(r => r.error)

  function reset() {
    setStep('upload'); setFile(null); setFatalError(null); setRows([]); setResult(null)
  }

  async function handleAnalyze() {
    if (!file) return
    setParsing(true)
    setFatalError(null)
    try {
      const fd = new FormData()
      fd.set('file', file)
      const res = await parseImportRows(fd)
      if (res.fatalError) {
        setFatalError(res.fatalError)
        return
      }
      setRows(res.rows)
      setStep('preview')
    } catch (e) {
      setFatalError(e instanceof Error ? e.message : 'Não foi possível analisar o arquivo.')
    } finally {
      setParsing(false)
    }
  }

  async function handleCommit() {
    setCommitting(true)
    try {
      const payload: BulkImportRow[] = okRows.map(r => ({
        bloco: r.bloco, andar: r.andar, andarDestino: r.andarDestino, andarGenero: r.andarGenero,
        quarto: r.quarto, quartoTipo: r.quartoTipo, quartoGenero: r.quartoGenero, quartoDestino: r.quartoDestino, quartoModo: r.quartoModo,
        camaRotulo: r.camaRotulo, camaTipo: r.camaTipo,
      }))
      const res = await commitAction(payload)
      setResult(res)
      setStep('done')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível concluir a importação.')
    } finally {
      setCommitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {step === 'upload' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">1. Baixe o modelo</h2>
            <p className="text-xs text-gray-500 mt-1">
              Uma linha por cama — repita bloco/andar/quarto nas linhas seguintes pra adicionar mais camas, quartos ou andares.
            </p>
            <a
              href={`/${slug}/hospedagem/quartos/importar/template`}
              className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
            >
              Baixar modelo (.xlsx)
            </a>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h2 className="text-sm font-semibold text-gray-900">2. Preencha e envie</h2>
            <p className="text-xs text-gray-500 mt-1">
              Preencha o modelo com os dados do seu prédio/alojamento e envie o arquivo aqui.
            </p>
            <label className="mt-3 flex items-center gap-3 border border-dashed border-gray-300 rounded-lg px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
              <Upload size={18} className="text-gray-400 shrink-0" />
              <span className="text-sm text-gray-600 truncate">
                {file ? file.name : 'Escolher arquivo .xlsx…'}
              </span>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {fatalError && (
              <p className="text-xs text-red-600 mt-2">{fatalError}</p>
            )}
            <button
              type="button"
              disabled={!file || parsing}
              onClick={handleAnalyze}
              className="mt-4 px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {parsing ? 'Analisando…' : 'Analisar arquivo'}
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <div className="flex items-center gap-4 flex-wrap text-sm">
              <span className="flex items-center gap-1.5 text-gray-700">
                <CheckCircle2 size={16} className="text-green-500" /> {okRows.length} linha{okRows.length !== 1 ? 's' : ''} pronta{okRows.length !== 1 ? 's' : ''}
              </span>
              {warnRows.length > 0 && (
                <span className="flex items-center gap-1.5 text-yellow-700">
                  <AlertTriangle size={16} className="text-yellow-500" /> {warnRows.length} com aviso
                </span>
              )}
              {errorRows.length > 0 && (
                <span className="flex items-center gap-1.5 text-red-700">
                  <XCircle size={16} className="text-red-500" /> {errorRows.length} ignorada{errorRows.length !== 1 ? 's' : ''} (faltando dado obrigatório)
                </span>
              )}
            </div>

            <div className="max-h-[420px] overflow-y-auto border border-gray-100 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-left text-gray-500">
                    <th className="px-3 py-2 font-medium">Linha</th>
                    <th className="px-3 py-2 font-medium">Bloco</th>
                    <th className="px-3 py-2 font-medium">Andar</th>
                    <th className="px-3 py-2 font-medium">Quarto</th>
                    <th className="px-3 py-2 font-medium">Cama</th>
                    <th className="px-3 py-2 font-medium">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map(r => (
                    <tr key={r.rowNumber} className={r.error ? 'bg-red-50/50' : r.warnings.length > 0 ? 'bg-yellow-50/50' : undefined}>
                      <td className="px-3 py-2 text-gray-400">{r.rowNumber}</td>
                      <td className="px-3 py-2 text-gray-700">{r.bloco || '—'}</td>
                      <td className="px-3 py-2 text-gray-700">{r.andar || '—'}</td>
                      <td className="px-3 py-2 text-gray-700">{r.quarto || '—'}</td>
                      <td className="px-3 py-2 text-gray-700">{r.camaRotulo || '—'}</td>
                      <td className="px-3 py-2">
                        {r.error ? (
                          <span className="text-red-600">{r.error}</span>
                        ) : r.warnings.length > 0 ? (
                          <ul className="text-yellow-700 space-y-0.5">
                            {r.warnings.map((w, i) => <li key={i}>{w}</li>)}
                          </ul>
                        ) : (
                          <span className="text-green-600">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={reset}
                disabled={committing}
                className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={okRows.length === 0 || committing}
                onClick={handleCommit}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {committing ? 'Importando…' : `Confirmar importação (${okRows.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 size={20} />
            <h2 className="text-sm font-semibold">Importação concluída</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              ['Blocos criados', result.blocksCreated],
              ['Andares criados', result.floorsCreated],
              ['Quartos criados', result.roomsCreated],
              ['Camas criadas', result.bedsCreated],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-lg border border-gray-200 px-3 py-2.5">
                <p className="text-xl font-semibold text-gray-900">{value}</p>
                <p className="text-[11px] text-gray-400">{label}</p>
              </div>
            ))}
          </div>
          {result.warnings.length > 0 && (
            <div className="text-xs text-yellow-700 space-y-1">
              {result.warnings.map((w, i) => <p key={i}>⚠ {w}</p>)}
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={reset}
              className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Importar outro arquivo
            </button>
            <Link
              href={`/${slug}/hospedagem/quartos`}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Ver Quartos
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
