'use client'

import { useState } from 'react'

type MealOption = { id: string; label: string; price: number }
type ComboRule = { id: string; name: string; mealIds: string[]; rewardMealIds?: string[]; discountPercent: number }

type Props = {
  action: (formData: FormData) => void | Promise<void>
  mealOptions: MealOption[]
  comboRules: ComboRule[]
}

function makeId(label: string) {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    || `refeicao_${Date.now()}`
}

export function MealSettingsEditor({ action, mealOptions, comboRules }: Props) {
  const [meals, setMeals] = useState<MealOption[]>(mealOptions)
  const [combos, setCombos] = useState<ComboRule[]>(comboRules)

  return (
    <details className="rounded-xl border border-gray-200 bg-white">
      <summary className="cursor-pointer border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-800">
        Configurar valores e combos
      </summary>
      <form action={action} className="space-y-5 p-4">
        <input type="hidden" name="meal_options" value={JSON.stringify(meals)} />
        <input type="hidden" name="combo_rules" value={JSON.stringify(combos)} />

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">Refeições</p>
              <p className="text-xs text-gray-400">Defina as opções que aparecem para venda e o valor de cada uma.</p>
            </div>
            <button
              type="button"
              onClick={() => setMeals(current => [...current, { id: `nova_${Date.now()}`, label: '', price: 0 }])}
              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Adicionar refeição
            </button>
          </div>

          {meals.map((meal, index) => (
            <div key={meal.id} className="grid gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3 md:grid-cols-[1fr_10rem_auto] md:items-end">
              <label>
                <span className="block text-xs font-medium text-gray-600 mb-1">Nome da refeição</span>
                <input
                  value={meal.label}
                  onChange={event => {
                    const label = event.target.value
                    setMeals(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, label, id: item.id.startsWith('nova_') ? makeId(label) : item.id } : item))
                  }}
                  placeholder="Ex: Café da manhã"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </label>
              <label>
                <span className="block text-xs font-medium text-gray-600 mb-1">Valor</span>
                <div className="flex overflow-hidden rounded-lg border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-brand-400">
                  <span className="border-r border-gray-200 px-3 py-2 text-sm font-semibold text-gray-500">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={meal.price}
                    onChange={event => setMeals(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, price: Number(event.target.value || 0) } : item))}
                    className="min-w-0 flex-1 px-3 py-2 text-sm outline-none"
                  />
                </div>
              </label>
              <button
                type="button"
                onClick={() => setMeals(current => current.filter((_, itemIndex) => itemIndex !== index))}
                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Remover
              </button>
            </div>
          ))}
        </div>

        <div className="space-y-3 border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">Combos e promoções</p>
              <p className="text-xs text-gray-400">Crie descontos ou regras do tipo compra A + B e ganha C.</p>
            </div>
            <button
              type="button"
              onClick={() => setCombos(current => [...current, { id: `combo_${Date.now()}`, name: '', mealIds: meals.slice(0, 2).map(meal => meal.id), rewardMealIds: [], discountPercent: 0 }])}
              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Criar combo
            </button>
          </div>

          {combos.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-400">
              Nenhum combo configurado.
            </div>
          ) : combos.map((combo, index) => (
            <div key={combo.id} className="space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="grid gap-2 md:grid-cols-[1fr_10rem_auto] md:items-end">
                <label>
                  <span className="block text-xs font-medium text-gray-600 mb-1">Nome do combo</span>
                  <input
                    value={combo.name}
                    onChange={event => setCombos(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))}
                    placeholder="Ex: Almoço + janta"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </label>
                <label>
                  <span className="block text-xs font-medium text-gray-600 mb-1">Desconto</span>
                  <div className="flex overflow-hidden rounded-lg border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-brand-400">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={combo.discountPercent}
                      onChange={event => setCombos(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, discountPercent: Number(event.target.value || 0) } : item))}
                      className="min-w-0 flex-1 px-3 py-2 text-sm outline-none"
                    />
                    <span className="border-l border-gray-200 px-3 py-2 text-sm font-semibold text-gray-500">%</span>
                  </div>
                </label>
                <button
                  type="button"
                  onClick={() => setCombos(current => current.filter((_, itemIndex) => itemIndex !== index))}
                  className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Remover
                </button>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Compra estas refeições</p>
                  <div className="flex flex-wrap gap-2">
                    {meals.map(meal => (
                      <label key={meal.id} className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600">
                        <input
                          type="checkbox"
                          checked={combo.mealIds.includes(meal.id)}
                          onChange={event => setCombos(current => current.map((item, itemIndex) => {
                            if (itemIndex !== index) return item
                            const mealIds = event.target.checked
                              ? [...new Set([...item.mealIds, meal.id])]
                              : item.mealIds.filter(id => id !== meal.id)
                            return { ...item, mealIds }
                          }))}
                          className="h-4 w-4 rounded border-gray-300 text-brand-500"
                        />
                        {meal.label || 'Sem nome'}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Ganha sem cobrar</p>
                  <div className="flex flex-wrap gap-2">
                    {meals.map(meal => (
                      <label key={meal.id} className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600">
                        <input
                          type="checkbox"
                          checked={(combo.rewardMealIds ?? []).includes(meal.id)}
                          onChange={event => setCombos(current => current.map((item, itemIndex) => {
                            if (itemIndex !== index) return item
                            const currentRewards = item.rewardMealIds ?? []
                            const rewardMealIds = event.target.checked
                              ? [...new Set([...currentRewards, meal.id])]
                              : currentRewards.filter(id => id !== meal.id)
                            return { ...item, rewardMealIds }
                          }))}
                          className="h-4 w-4 rounded border-gray-300 text-brand-500"
                        />
                        {meal.label || 'Sem nome'}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
          Salvar configurações
        </button>
      </form>
    </details>
  )
}
