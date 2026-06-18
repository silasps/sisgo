'use client'

import { useState, useTransition } from 'react'
import { BarcodeLabel, BarcodeLabelGrid } from '@/components/ui/BarcodeLabel'
import { generateInternalCode } from '@/lib/barcode-encode'
import { Plus, Tag, Printer } from 'lucide-react'

type StockItem = { id: string; name: string; code: string; unit: string }
type BarcodeEntry = { barcode: string; itemId: string; brand: string | null; packageQty: number | null; packageUnit: string | null; description: string | null }

type Props = {
  items: StockItem[]
  barcodes: BarcodeEntry[]
  onGenerate: (data: { barcode: string; itemId: string; brand: string; description: string; packageQty: number; packageUnit: string }) => Promise<void>
  inline?: boolean
}

export function BarcodeManager({ items, barcodes, onGenerate, inline = false }: Props) {
  const [selectedItem, setSelectedItem] = useState(items[0]?.id ?? '')
  const [brand, setBrand] = useState('')
  const [pkgQty, setPkgQty] = useState('1')
  const [desc, setDesc] = useState('')
  const [isPending, startTransition] = useTransition()
  const [generated, setGenerated] = useState<{ code: string; itemName: string; brand: string } | null>(null)

  const item = items.find(i => i.id === selectedItem)

  function handleGenerate() {
    if (!item) return
    const code = generateInternalCode(item.code)
    startTransition(async () => {
      await onGenerate({
        barcode: code,
        itemId: item.id,
        brand: brand || item.name,
        description: desc || `${item.name}${brand ? ` - ${brand}` : ''} ${pkgQty}${item.unit}`,
        packageQty: Number(pkgQty) || 1,
        packageUnit: item.unit,
      })
      setGenerated({ code, itemName: item.name, brand: brand || '' })
      setBrand('')
      setDesc('')
      setPkgQty('1')
    })
  }

  const allLabels = barcodes
    .filter(b => b.barcode.startsWith('INT-'))
    .map(b => ({
      code: b.barcode,
      itemName: items.find(i => i.id === b.itemId)?.name ?? '—',
      brand: b.brand,
      packageInfo: b.packageQty ? `${b.packageQty}${b.packageUnit ?? ''}` : null,
    }))

  const content = (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Para produtos sem código de barras (verduras, grãos a granel, itens fracionados).
        O sistema gera um código interno e você imprime a etiqueta.
      </p>

      <div className="space-y-2.5">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Item do estoque *</label>
          <select value={selectedItem} onChange={e => setSelectedItem(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-400">
            {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Marca / variação</label>
            <input value={brand} onChange={e => setBrand(e.target.value)} placeholder="Ex: Orgânica"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Qtd embalagem</label>
            <input value={pkgQty} onChange={e => setPkgQty(e.target.value)} type="number" step="0.01" min="0.01"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
        </div>
        <button type="button" onClick={handleGenerate} disabled={isPending || !selectedItem}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50">
          <Plus className="size-3.5" /> {isPending ? 'Gerando...' : 'Gerar código e etiqueta'}
        </button>
      </div>

      {generated && (
        <div className="pt-3 border-t border-gray-100">
          <p className="text-xs font-medium text-green-700 mb-2">Código gerado! Imprima a etiqueta e cole no produto.</p>
          <BarcodeLabel
            code={generated.code}
            itemName={generated.itemName}
            brand={generated.brand || undefined}
            packageInfo={pkgQty ? `${pkgQty}${item?.unit ?? ''}` : undefined}
          />
        </div>
      )}

      {allLabels.length > 0 && (
        <div className="pt-3 border-t border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700">{allLabels.length} código{allLabels.length > 1 ? 's' : ''} interno{allLabels.length > 1 ? 's' : ''} gerado{allLabels.length > 1 ? 's' : ''}</p>
            <BarcodeLabelGrid labels={allLabels} />
          </div>
          <div className="flex flex-wrap gap-2">
            {allLabels.map(l => (
              <BarcodeLabel key={l.code} code={l.code} itemName={l.itemName} brand={l.brand} packageInfo={l.packageInfo} moduleWidth={1.2} barHeight={30} />
            ))}
          </div>
        </div>
      )}
    </div>
  )

  if (inline) return content

  return (
    <details className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <summary className="px-4 py-3 text-sm font-semibold text-brand-600 hover:bg-brand-50 cursor-pointer transition-colors list-none flex items-center gap-2">
        <Tag className="size-4" /> Gerar código de barras interno
      </summary>
      <div className="border-t border-gray-100 p-4">{content}</div>
    </details>
  )
}
