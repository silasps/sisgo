'use client'

import { useRef } from 'react'
import { encodeCode128B } from '@/lib/barcode-encode'
import { Printer } from 'lucide-react'

type Props = {
  code: string
  itemName: string
  brand?: string | null
  packageInfo?: string | null
  moduleWidth?: number
  barHeight?: number
}

function BarcodeSVG({ pattern, height, mw }: { pattern: string; height: number; mw: number }) {
  const quiet = 10
  let x = quiet
  const rects: Array<{ x: number; w: number }> = []
  for (let i = 0; i < pattern.length; i++) {
    const w = Number(pattern[i]) * mw
    if (i % 2 === 0) rects.push({ x, w })
    x += w
  }
  const totalW = x + quiet
  return (
    <svg viewBox={`0 0 ${totalW} ${height}`} width={totalW} height={height} className="mx-auto">
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={0} width={r.w} height={height} fill="black" />
      ))}
    </svg>
  )
}

export function BarcodeLabel({ code, itemName, brand, packageInfo, moduleWidth = 1.5, barHeight = 40 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const pattern = encodeCode128B(code)

  function handlePrint() {
    const el = ref.current
    if (!el) return
    const win = window.open('', '_blank', 'width=400,height=300')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html><head><title>Etiqueta</title>
      <style>
        body { margin: 0; padding: 8mm; font-family: Arial, sans-serif; }
        .label { text-align: center; border: 1px dashed #ccc; padding: 4mm; display: inline-block; }
        .name { font-size: 11pt; font-weight: bold; margin-bottom: 2mm; }
        .brand { font-size: 8pt; color: #666; margin-bottom: 2mm; }
        .code { font-size: 8pt; font-family: monospace; letter-spacing: 1px; margin-top: 1mm; }
        @media print { body { padding: 0; } .label { border: none; } }
      </style></head>
      <body onload="window.print()">
        <div class="label">
          <div class="name">${itemName}</div>
          ${brand ? `<div class="brand">${brand}${packageInfo ? ` · ${packageInfo}` : ''}</div>` : ''}
          ${el.querySelector('svg')?.outerHTML ?? ''}
          <div class="code">${code}</div>
        </div>
      </body></html>
    `)
    win.document.close()
  }

  return (
    <div ref={ref} className="inline-flex flex-col items-center gap-1 p-3 bg-white rounded-xl border border-gray-200">
      <p className="text-xs font-semibold text-gray-900 text-center">{itemName}</p>
      {brand && <p className="text-[10px] text-gray-500">{brand}{packageInfo ? ` · ${packageInfo}` : ''}</p>}
      <BarcodeSVG pattern={pattern} height={barHeight} mw={moduleWidth} />
      <p className="text-[9px] font-mono text-gray-500 tracking-widest">{code}</p>
      <button type="button" onClick={handlePrint}
        className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50 px-2 py-1 rounded transition-colors">
        <Printer className="size-3" /> Imprimir etiqueta
      </button>
    </div>
  )
}

export function BarcodeLabelGrid({ labels }: { labels: Array<{ code: string; itemName: string; brand?: string | null; packageInfo?: string | null }> }) {
  function handlePrintAll() {
    const win = window.open('', '_blank', 'width=600,height=800')
    if (!win) return
    const labelsHtml = labels.map(l => {
      const pattern = encodeCode128B(l.code)
      const quiet = 10
      let x = quiet
      const rects: string[] = []
      for (let i = 0; i < pattern.length; i++) {
        const w = Number(pattern[i]) * 1.5
        if (i % 2 === 0) rects.push(`<rect x="${x}" y="0" width="${w}" height="40" fill="black"/>`)
        x += w
      }
      const svg = `<svg viewBox="0 0 ${x + quiet} 40" width="${x + quiet}" height="40">${rects.join('')}</svg>`
      return `
        <div class="label">
          <div class="name">${l.itemName}</div>
          ${l.brand ? `<div class="brand">${l.brand}${l.packageInfo ? ` · ${l.packageInfo}` : ''}</div>` : ''}
          ${svg}
          <div class="code">${l.code}</div>
        </div>
      `
    }).join('')

    win.document.write(`
      <!DOCTYPE html>
      <html><head><title>Etiquetas</title>
      <style>
        body { margin: 0; padding: 5mm; font-family: Arial, sans-serif; }
        .grid { display: flex; flex-wrap: wrap; gap: 3mm; }
        .label { text-align: center; border: 1px dashed #ccc; padding: 3mm 5mm; break-inside: avoid; }
        .name { font-size: 10pt; font-weight: bold; margin-bottom: 1mm; }
        .brand { font-size: 7pt; color: #666; margin-bottom: 1mm; }
        .code { font-size: 7pt; font-family: monospace; letter-spacing: 1px; margin-top: 1mm; }
        @media print { .label { border: none; } }
      </style></head>
      <body onload="window.print()">
        <div class="grid">${labelsHtml}</div>
      </body></html>
    `)
    win.document.close()
  }

  if (labels.length === 0) return null

  return (
    <button type="button" onClick={handlePrintAll}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50 px-3 py-1.5 rounded-lg border border-brand-200 transition-colors">
      <Printer className="size-3.5" /> Imprimir {labels.length} etiqueta{labels.length > 1 ? 's' : ''}
    </button>
  )
}
