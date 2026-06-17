'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2, Calculator, Check, AlertTriangle } from 'lucide-react'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'

type StockItem = { id: string; name: string; unit: string }
type Ingredient = { itemId: string; quantityPerPortion: number; unit: string; notes: string | null }

type Props = {
  recipeId: string
  recipeName: string
  portionYield: number
  stockItems: StockItem[]
  initialIngredients: Ingredient[]
  onSave: (recipeId: string, ingredients: Ingredient[]) => Promise<void>
  onConfirmProduction: (recipeId: string, portions: number) => Promise<void>
}

export function ReceitaForm({ recipeId, recipeName, portionYield, stockItems, initialIngredients, onSave, onConfirmProduction }: Props) {
  const [ingredients, setIngredients] = useState<Ingredient[]>(initialIngredients)
  const [simPortions, setSimPortions] = useState(50)
  const [showSim, setShowSim] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function addIngredient() {
    if (stockItems.length === 0) return
    setIngredients(prev => [...prev, {
      itemId: stockItems[0].id,
      quantityPerPortion: 0,
      unit: stockItems[0].unit,
      notes: null,
    }])
    setSaved(false)
  }

  function updateIngredient(index: number, updates: Partial<Ingredient>) {
    setIngredients(prev => prev.map((ing, i) => {
      if (i !== index) return ing
      const updated = { ...ing, ...updates }
      if (updates.itemId) {
        const item = stockItems.find(s => s.id === updates.itemId)
        if (item) updated.unit = item.unit
      }
      return updated
    }))
    setSaved(false)
  }

  function removeIngredient(index: number) {
    setIngredients(prev => prev.filter((_, i) => i !== index))
    setSaved(false)
  }

  function handleSave() {
    startTransition(async () => {
      await onSave(recipeId, ingredients)
      setSaved(true)
    })
  }

  function handleProduce() {
    if (!confirm(`Confirmar produção de ${simPortions} porções de "${recipeName}"?\n\nIsso vai deduzir os insumos do estoque automaticamente.`)) return
    startTransition(async () => {
      await onConfirmProduction(recipeId, simPortions)
      window.location.reload()
    })
  }

  return (
    <div className="space-y-4">
      {/* Editor de ingredientes */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">
            Ingredientes ({ingredients.length})
          </h3>
          <button type="button" onClick={addIngredient}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 px-2 py-1 rounded-lg hover:bg-brand-50 transition-colors">
            <Plus className="size-3.5" /> Adicionar
          </button>
        </div>

        {ingredients.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">
            Nenhum ingrediente adicionado. Clique em &quot;Adicionar&quot; para começar.
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {ingredients.map((ing, i) => {
              const item = stockItems.find(s => s.id === ing.itemId)
              return (
                <div key={i} className="px-4 py-3 flex flex-wrap items-center gap-2">
                  <select value={ing.itemId} onChange={e => updateIngredient(i, { itemId: e.target.value })}
                    className="flex-1 min-w-[140px] rounded-lg border border-gray-200 px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-400">
                    {stockItems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <input type="number" step="0.001" min="0" value={ing.quantityPerPortion || ''}
                    onChange={e => updateIngredient(i, { quantityPerPortion: Number(e.target.value) })}
                    placeholder="Qtd/porção"
                    className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-brand-400" />
                  <span className="text-xs text-gray-500 w-8">{item?.unit ?? ing.unit}</span>
                  <button type="button" onClick={() => removeIngredient(i)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {ingredients.length > 0 && (
          <div className="border-t border-gray-100 px-4 py-3 flex items-center gap-2">
            <button type="button" onClick={handleSave} disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50">
              {saved ? <><Check className="size-3.5" /> Salvo</> : isPending ? 'Salvando...' : 'Salvar ingredientes'}
            </button>
            <button type="button" onClick={() => setShowSim(v => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <Calculator className="size-3.5" /> Simular produção
            </button>
          </div>
        )}
      </div>

      {/* Simulador de produção */}
      {showSim && ingredients.length > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-amber-800">Porções a produzir:</label>
            <input type="number" min="1" value={simPortions} onChange={e => setSimPortions(Number(e.target.value))}
              className="w-24 rounded-lg border border-amber-300 px-3 py-1.5 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white" />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
              Para <AnimatedNumber value={simPortions} /> porções, você precisa de:
            </p>
            <div className="divide-y divide-amber-200/50 rounded-lg bg-white border border-amber-200 overflow-hidden">
              {ingredients.filter(ing => ing.quantityPerPortion > 0).map((ing, i) => {
                const item = stockItems.find(s => s.id === ing.itemId)
                const totalNeeded = ing.quantityPerPortion * simPortions
                return (
                  <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-gray-700">{item?.name ?? '—'}</span>
                    <span className="font-bold text-gray-900">
                      {totalNeeded % 1 === 0 ? totalNeeded : totalNeeded.toFixed(2)} {item?.unit ?? ing.unit}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={handleProduce} disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50">
              <Check className="size-3.5" /> Confirmar produção e deduzir estoque
            </button>
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="size-3" /> Irreversível — cria movimentações de saída
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
