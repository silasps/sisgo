'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { BarcodeScanButton, BarcodeField } from './BarcodeScanButton'
import { BarcodeManager } from './BarcodeManager'
import { PackagePlus, PackageMinus, Plus, Tag } from 'lucide-react'

type BarcodeEntry = { barcode: string; itemId: string; brand: string | null; packageQty: number | null; packageUnit: string | null }
type StockItem = { id: string; name: string; unit: string }
type BarcodeItemForManager = { id: string; name: string; code: string; unit: string }
type BarcodeForManager = BarcodeEntry & { description: string | null }

type Props = {
  items: StockItem[]
  barcodes: BarcodeEntry[]
  today: string
  entryAction: (formData: FormData) => Promise<void>
  movementAction: (formData: FormData) => Promise<void>
  itemAction: (formData: FormData) => Promise<void>
  onRegisterBarcode: (data: { barcode: string; itemId: string; brand: string; description: string; packageQty: number; packageUnit: string }) => Promise<void>
  itemsForBarcode: BarcodeItemForManager[]
  barcodesForManager: BarcodeForManager[]
  sourceOptions: [string, string][]
  movementOptions: [string, string][]
}

type ActionModal = 'entry' | 'movement' | 'newItem' | 'barcode' | null

function Field({ label, className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      <input {...props} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
    </label>
  )
}

function Select({ label, name, options }: { label: string; name: string; options: [string, string][] }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      <select name={name} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  )
}

const actions: Array<{
  key: ActionModal & string
  icon: typeof PackagePlus
  title: string
  desc: string
  bg: string
  border: string
  iconColor: string
  titleColor: string
  hoverTitleColor: string
}> = [
  {
    key: 'entry', icon: PackagePlus,
    title: 'Registrar entrada', desc: 'Compra, doação, outros',
    bg: 'bg-green-50', border: 'border-green-200',
    iconColor: 'text-green-600', titleColor: 'text-green-800',
    hoverTitleColor: 'group-hover:text-green-600',
  },
  {
    key: 'movement', icon: PackageMinus,
    title: 'Registrar saída', desc: 'Saída, perda, ajuste',
    bg: 'bg-orange-50', border: 'border-orange-200',
    iconColor: 'text-orange-600', titleColor: 'text-orange-800',
    hoverTitleColor: 'group-hover:text-orange-600',
  },
  {
    key: 'newItem', icon: Plus,
    title: 'Novo item', desc: 'Cadastrar produto',
    bg: 'bg-brand-50', border: 'border-brand-200',
    iconColor: 'text-brand-600', titleColor: 'text-gray-800',
    hoverTitleColor: 'group-hover:text-brand-600',
  },
  {
    key: 'barcode', icon: Tag,
    title: 'Código interno', desc: 'Gerar etiqueta',
    bg: 'bg-gray-50', border: 'border-gray-200',
    iconColor: 'text-gray-600', titleColor: 'text-gray-800',
    hoverTitleColor: 'group-hover:text-brand-600',
  },
]

export function EstoqueActions({
  items, barcodes, today, entryAction, movementAction, itemAction,
  onRegisterBarcode, itemsForBarcode, barcodesForManager,
  sourceOptions, movementOptions,
}: Props) {
  const [openModal, setOpenModal] = useState<ActionModal>(null)

  return (
    <>
      {/* ── Action cards ──────────────────────────────────────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {actions.map(a => {
          const Icon = a.icon
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => setOpenModal(a.key as ActionModal)}
              className={`group ${a.bg} border ${a.border} rounded-xl p-4 text-left cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 w-full`}
            >
              <Icon className={`size-5 ${a.iconColor} mb-2`} />
              <p className={`text-sm font-semibold ${a.titleColor} ${a.hoverTitleColor} transition-colors`}>{a.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{a.desc}</p>
              <p className="text-xs text-brand-400 mt-1.5 font-medium">Abrir &rarr;</p>
            </button>
          )
        })}
      </section>

      {/* ── Modal: Registrar entrada ──────────────────────────────── */}
      <Modal
        open={openModal === 'entry'}
        onClose={() => setOpenModal(null)}
        title="Registrar entrada"
        subtitle="Compra, doação ou outros recebimentos"
        hideFooter
      >
        <form action={entryAction} className="space-y-3 p-5">
          <Select name="item_id" label="Item *" options={items.map(i => [i.id, i.name])} />
          <BarcodeScanButton
            items={items}
            barcodes={barcodes}
            targetSelectName="item_id"
            targetQtyName="quantity"
            onRegister={onRegisterBarcode}
          />
          <div className="grid grid-cols-2 gap-2">
            <Field name="quantity" label="Quantidade *" type="number" step="0.01" min="0" required />
            <Select name="source_type" label="Origem" options={sourceOptions} />
          </div>
          <Field name="supplier_name" label="Fornecedor" placeholder="Nome ou empresa" />
          <div className="grid grid-cols-2 gap-2">
            <Field name="expiration_date" label="Validade" type="date" />
            <Field name="unit_cost" label="Custo unit." type="number" step="0.01" min="0" placeholder="R$" />
          </div>
          <Field name="received_at" label="Recebido em" type="date" defaultValue={today} />
          <Field name="lot_code" label="Cód. lote" placeholder="Opcional" />
          <div className="flex gap-2 pt-2">
            <button type="submit" className="flex-1 rounded-lg bg-green-600 hover:bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors">
              + Registrar entrada
            </button>
            <button type="button" onClick={() => setOpenModal(null)} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Saída / Perda / Ajuste ─────────────────────────── */}
      <Modal
        open={openModal === 'movement'}
        onClose={() => setOpenModal(null)}
        title="Registrar saída"
        subtitle="Saída, perda, ajuste, transferência ou doação"
        hideFooter
      >
        <form action={movementAction} className="space-y-3 p-5">
          <Select name="item_id" label="Item *" options={items.map(i => [i.id, i.name])} />
          <BarcodeScanButton
            items={items}
            barcodes={barcodes}
            targetSelectName="item_id"
            targetQtyName="quantity"
            onRegister={onRegisterBarcode}
          />
          <div className="grid grid-cols-2 gap-2">
            <Field name="quantity" label="Quantidade *" type="number" step="0.01" min="0" required />
            <Select name="movement_type" label="Tipo" options={movementOptions} />
          </div>
          <Field name="reason" label="Motivo" placeholder="Ex: cardápio do dia" />
          <Field name="movement_date" label="Data" type="date" defaultValue={today} />
          <div className="flex gap-2 pt-2">
            <button type="submit" className="flex-1 rounded-lg bg-gray-900 hover:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors">
              Registrar movimento
            </button>
            <button type="button" onClick={() => setOpenModal(null)} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Novo item ──────────────────────────────────────── */}
      <Modal
        open={openModal === 'newItem'}
        onClose={() => setOpenModal(null)}
        title="Cadastrar novo item"
        subtitle="Adicionar um produto ao estoque"
        hideFooter
      >
        <form action={itemAction} className="space-y-3 p-5">
          <Field name="name" label="Nome *" required placeholder="Ex: Arroz branco" />
          <div className="grid grid-cols-2 gap-2">
            <Field name="category" label="Categoria" placeholder="Ex: Grãos" />
            <Field name="unit" label="Unidade" placeholder="kg, un, L..." defaultValue="un" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field name="min_quantity" label="Qtd mínima" type="number" step="0.01" min="0" defaultValue="0" />
            <Field name="default_location" label="Localização" placeholder="Ex: Armário A" />
          </div>
          <BarcodeField />
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" name="critical" className="rounded border-gray-300 text-brand-500 focus:ring-brand-400" />
            Marcar como crítico
          </label>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="flex-1 rounded-lg bg-brand-500 hover:bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors">
              Cadastrar item
            </button>
            <button type="button" onClick={() => setOpenModal(null)} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Código de barras interno ────────────────────────── */}
      <Modal
        open={openModal === 'barcode'}
        onClose={() => setOpenModal(null)}
        title="Gerar código de barras interno"
        subtitle="Para produtos sem código de barras comercial"
      >
        <div className="p-5">
          <BarcodeManager
            items={itemsForBarcode}
            barcodes={barcodesForManager}
            onGenerate={onRegisterBarcode}
            inline
          />
        </div>
      </Modal>
    </>
  )
}
