'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Download, Upload, CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react'
import type { ImportRowResult, ImportValidatedRow } from '@/lib/import-pessoas/types'

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      {description && <p className="text-sm text-gray-500 mt-1 mb-4">{description}</p>}
      <div className={description ? '' : 'mt-4'}>{children}</div>
    </div>
  )
}

type Props = {
  slug: string
  previewAction: (formData: FormData) => Promise<{ error: string } | { rows: ImportValidatedRow[] }>
  confirmAction: (formData: FormData) => Promise<{ error: string } | { results: ImportRowResult[] }>
}

export function ImportarPessoasWizard({ slug, previewAction, confirmAction }: Props) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<ImportValidatedRow[] | null>(null)
  const [results, setResults] = useState<ImportRowResult[] | null>(null)
  const [enviarEmailAgora, setEnviarEmailAgora] = useState(true)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
      setRows(null)
      setResults(null)
    }
  }

  function handleAnalisar() {
    if (!file) return
    startTransition(async () => {
      const fd = new FormData()
      fd.append('arquivo', file)
      const res = await previewAction(fd)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      setRows(res.rows)
    })
  }

  function handleConfirmar() {
    if (!file) return
    startTransition(async () => {
      const fd = new FormData()
      fd.append('arquivo', file)
      fd.append('enviarEmailAgora', String(enviarEmailAgora))
      const res = await confirmAction(fd)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      setResults(res.results)
      router.refresh()
    })
  }

  const okCount = rows?.filter(r => r.status === 'ok').length ?? 0
  const erroCount = rows?.filter(r => r.status === 'erro').length ?? 0

  return (
    <div className="max-w-4xl">
      <Section title="1. Baixe o modelo" description="Planilha com as colunas certas e as opções de turma/ministério/escola já preenchidas nas dropdowns.">
        <a
          href={`/${slug}/pessoas/importar/template`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors"
        >
          <Download className="size-4" /> Baixar modelo (.xlsx)
        </a>
      </Section>

      <Section title="2. Envie a planilha preenchida" description="Confira os avisos antes de confirmar — nada é gravado nessa etapa.">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            onChange={handleFileSelected}
            className="text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gray-100 file:text-sm file:font-medium hover:file:bg-gray-200"
          />
          <button
            type="button"
            onClick={handleAnalisar}
            disabled={!file || isPending}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Analisar
          </button>
        </div>

        {rows && (
          <div className="mt-5">
            <p className="text-sm text-gray-600 mb-3">
              <span className="text-green-700 font-medium">{okCount} prontas</span>
              {erroCount > 0 && <span className="text-red-600 font-medium"> · {erroCount} com erro</span>}
            </p>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Linha</th>
                    <th className="px-3 py-2 font-medium">Nome</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map(row => (
                    <tr key={row.raw.rowNumber}>
                      <td className="px-3 py-2 text-gray-500">{row.raw.rowNumber}</td>
                      <td className="px-3 py-2">{row.raw.nome || '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{row.raw.email || '—'}</td>
                      <td className="px-3 py-2">
                        {row.status === 'ok' ? (
                          <span className="inline-flex items-center gap-1 text-green-700"><CheckCircle2 className="size-3.5" /> Pronta</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600"><XCircle className="size-3.5" /> Erro</span>
                        )}
                        {row.errors.map((e, i) => <p key={i} className="text-xs text-red-600 mt-0.5">{e}</p>)}
                        {row.warnings.map((w, i) => <p key={i} className="text-xs text-amber-600 mt-0.5 flex items-center gap-1"><AlertTriangle className="size-3" />{w}</p>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Section>

      {rows && okCount > 0 && !results && (
        <Section title="3. Confirmar" description={`${okCount} pessoa(s) serão criadas já ativas, com login e senha padrão (primeiro nome + "123"). Quem não tem email na planilha é criado sem login.`}>
          <label className="flex items-center gap-2 text-sm text-gray-700 mb-4">
            <input
              type="checkbox"
              checked={enviarEmailAgora}
              onChange={e => setEnviarEmailAgora(e.target.checked)}
              className="rounded border-gray-300"
            />
            Enviar credenciais de acesso por email agora
          </label>
          {!enviarEmailAgora && (
            <p className="text-xs text-amber-600 mb-4">
              As credenciais ficam pendentes de envio — use o botão &quot;Enviar credenciais pendentes&quot; nesta tela quando quiser disparar.
            </p>
          )}
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Confirmar importação
          </button>
        </Section>
      )}

      {results && (
        <Section title="Resultado">
          <ul className="space-y-1 text-sm">
            {results.map(r => (
              <li key={r.rowNumber} className="flex items-center gap-2">
                {r.status === 'criado'
                  ? <CheckCircle2 className="size-4 text-green-600 shrink-0" />
                  : <XCircle className="size-4 text-red-600 shrink-0" />}
                <span className="text-gray-700">{r.nome || r.email}</span>
                <span className="text-gray-400">— {r.message}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}
