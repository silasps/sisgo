'use client'

import { useState } from 'react'
import { BarcodeScanner } from '@/components/ui/BarcodeScanner'
import { ScanBarcode, Check } from 'lucide-react'

type BarcodeEntry = { barcode: string; itemId: string; brand: string | null; packageQty: number | null; packageUnit: string | null }
type StockItem = { id: string; name: string; unit: string }

type Props = {
  items: StockItem[]
  barcodes: BarcodeEntry[]
  targetSelectName: string
  targetQtyName?: string
  onRegister: (data: { barcode: string; itemId: string; brand: string; description: string; packageQty: number; packageUnit: string }) => Promise<void>
}

export function BarcodeScanButton({ items, barcodes, targetSelectName, targetQtyName, onRegister }: Props) {
  const [registering, setRegistering] = useState<string | null>(null)
  const [regItemId, setRegItemId] = useState('')
  const [regBrand, setRegBrand] = useState('')
  const [regDesc, setRegDesc] = useState('')
  const [regQty, setRegQty] = useState('')
  const [saving, setSaving] = useState(false)

  function setFormValue(itemId: string, qty: number | null) {
    const form = document.querySelector(`select[name="${targetSelectName}"]`)?.closest('form')
    if (!form) return
    const select = form.querySelector(`select[name="${targetSelectName}"]`) as HTMLSelectElement | null
    if (select) {
      select.value = itemId
      select.dispatchEvent(new Event('change', { bubbles: true }))
    }
    if (qty && targetQtyName) {
      const input = form.querySelector(`input[name="${targetQtyName}"]`) as HTMLInputElement | null
      if (input) { input.value = String(qty); input.dispatchEvent(new Event('input', { bubbles: true })) }
    }
  }

  function handleScan(code: string) {
    const match = barcodes.find(b => b.barcode === code)
    if (match) {
      setFormValue(match.itemId, match.packageQty)
      return
    }
    setRegistering(code)
    setRegItemId(items[0]?.id ?? '')
    setRegBrand('')
    setRegDesc('')
    setRegQty('')
  }

  async function handleRegister() {
    if (!registering || !regItemId) return
    setSaving(true)
    const item = items.find(i => i.id === regItemId)
    await onRegister({
      barcode: registering,
      itemId: regItemId,
      brand: regBrand,
      description: regDesc,
      packageQty: Number(regQty) || 1,
      packageUnit: item?.unit ?? 'un',
    })
    setFormValue(regItemId, Number(regQty) || null)
    setRegistering(null)
    setSaving(false)
  }

  if (registering) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
          <ScanBarcode className="size-4" />
          Código novo: <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs font-mono">{registering}</code>
        </div>
        <p className="text-xs text-amber-700">Vincule este código de barras a um item do estoque:</p>

        <select value={regItemId} onChange={e => setRegItemId(e.target.value)}
          className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
          {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
        </select>

        <div className="grid grid-cols-2 gap-2">
          <input value={regBrand} onChange={e => setRegBrand(e.target.value)} placeholder="Marca (ex: União)"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          <input value={regQty} onChange={e => setRegQty(e.target.value)} type="number" step="0.01" min="0" placeholder="Qtd embalagem"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <input value={regDesc} onChange={e => setRegDesc(e.target.value)} placeholder="Descrição (ex: Açúcar refinado União 1kg)"
          className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />

        <div className="flex gap-2">
          <button type="button" onClick={handleRegister} disabled={saving || !regItemId}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 px-3 py-1.5 text-sm font-semibold text-white transition-colors disabled:opacity-50">
            <Check className="size-3.5" /> {saving ? 'Salvando...' : 'Vincular e usar'}
          </button>
          <button type="button" onClick={() => setRegistering(null)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  return (
    <BarcodeScanner placeholder="Código de barras" onScan={handleScan} />
  )
}

export function BarcodeField() {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-600">Código de barras</label>
      <div className="flex gap-2">
        <input name="barcode" type="text" inputMode="numeric" placeholder="EAN-13, UPC, etc."
          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
        <BarcodeScanner placeholder="Escanear" onScan={(code) => {
          const input = document.querySelector('input[name="barcode"]') as HTMLInputElement | null
          if (input) { input.value = code; input.focus() }
        }} />
      </div>
    </div>
  )
}
