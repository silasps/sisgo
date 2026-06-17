'use client'

import { BarcodeScanner } from '@/components/ui/BarcodeScanner'

type Props = {
  items: Array<{ id: string; name: string; barcode: string | null }>
  targetSelectName: string
}

export function BarcodeScanButton({ items, targetSelectName }: Props) {
  return (
    <BarcodeScanner
      placeholder="Código de barras"
      onScan={(code) => {
        const match = items.find(i => i.barcode === code)
        if (!match) {
          alert(`Nenhum item encontrado com o código "${code}". Cadastre o item primeiro com este código de barras.`)
          return
        }
        const form = document.querySelector(`select[name="${targetSelectName}"]`)?.closest('form')
        if (!form) return
        const select = form.querySelector(`select[name="${targetSelectName}"]`) as HTMLSelectElement | null
        if (select) {
          select.value = match.id
          select.dispatchEvent(new Event('change', { bubbles: true }))
        }
      }}
    />
  )
}

export function BarcodeField() {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-600">Código de barras</label>
      <div className="flex gap-2">
        <input
          name="barcode"
          type="text"
          inputMode="numeric"
          placeholder="EAN-13, UPC, etc."
          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <BarcodeScanner
          placeholder="Escanear"
          onScan={(code) => {
            const input = document.querySelector('input[name="barcode"]') as HTMLInputElement | null
            if (input) { input.value = code; input.focus() }
          }}
        />
      </div>
    </div>
  )
}
