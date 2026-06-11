'use client'

import { useMemo, useState } from 'react'

type MealOption = { id: string; label: string; price: number }
type ComboRule = { id: string; name: string; mealIds: string[]; rewardMealIds?: string[]; discountPercent: number }
type CartDay = { date: string; mealIds: string[] }

function fmtDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function eachDateInRange(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00`)
  const endDate = new Date(`${end}T00:00:00`)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return []

  const first = startDate <= endDate ? startDate : endDate
  const last = startDate <= endDate ? endDate : startDate
  const dates: string[] = []
  const current = new Date(first)

  while (current <= last) {
    dates.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }

  return dates
}

function compactDateRanges(dates: string[]) {
  const sorted = [...new Set(dates)].sort()
  const ranges: Array<{ start: string; end: string }> = []

  for (const date of sorted) {
    const last = ranges[ranges.length - 1]
    if (!last) {
      ranges.push({ start: date, end: date })
      continue
    }

    const expected = new Date(`${last.end}T00:00:00`)
    expected.setDate(expected.getDate() + 1)
    if (expected.toISOString().split('T')[0] === date) {
      last.end = date
    } else {
      ranges.push({ start: date, end: date })
    }
  }

  return ranges
}

function rangeLabel(start: string, end: string) {
  return start === end ? fmtDate(start) : `${fmtDate(start)} a ${fmtDate(end)}`
}

type Props = {
  action: (formData: FormData) => void | Promise<void>
  defaultDate: string
  mealOptions: MealOption[]
  comboRules: ComboRule[]
  defaultConsumerName?: string
  lockConsumerName?: boolean
  showManualDiscount?: boolean
  submitLabel?: string
}

export function MealConsumerDateForm({
  action,
  defaultDate,
  mealOptions,
  comboRules,
  defaultConsumerName = '',
  lockConsumerName = false,
  showManualDiscount = true,
  submitLabel = 'Confirmar compra',
}: Props) {
  const [singleDate, setSingleDate] = useState(defaultDate)
  const [rangeStart, setRangeStart] = useState(defaultDate)
  const [rangeEnd, setRangeEnd] = useState(defaultDate)
  const [pendingDates, setPendingDates] = useState<string[]>([defaultDate])
  const [pendingMeals, setPendingMeals] = useState<string[]>([])
  const [cart, setCart] = useState<CartDay[]>([])
  const [discount, setDiscount] = useState(0)

  const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const sortedPendingDates = useMemo(() => [...pendingDates].sort(), [pendingDates])
  const sortedCart = useMemo(() => [...cart].sort((a, b) => a.date.localeCompare(b.date)), [cart])

  const mealLabel = (id: string) => mealOptions.find(meal => meal.id === id)?.label ?? id
  const mealPrice = (id: string) => mealOptions.find(meal => meal.id === id)?.price ?? 0

  const cartLines = sortedCart.map(day => {
    const activeCombos = comboRules
      .filter(combo => combo.mealIds.length >= 2 && combo.mealIds.every(mealId => day.mealIds.includes(mealId)))
    const rewardMealIds = [...new Set(activeCombos.flatMap(combo => combo.rewardMealIds ?? []))]
      .filter(mealId => !day.mealIds.includes(mealId))
    const servedMealIds = [...new Set([...day.mealIds, ...rewardMealIds])]
    const subtotal = day.mealIds.reduce((sum, mealId) => sum + mealPrice(mealId), 0)
    const rewardDiscount = rewardMealIds.reduce((sum, mealId) => sum + mealPrice(mealId), 0)
    const matchingCombo = [...activeCombos].sort((a, b) => b.discountPercent - a.discountPercent)[0]
    const percentDiscount = matchingCombo ? subtotal * (matchingCombo.discountPercent / 100) : 0

    return {
      date: day.date,
      purchasedMealIds: day.mealIds,
      servedMealIds,
      rewardMealIds,
      subtotal,
      discount: rewardDiscount + percentDiscount,
      finalAmount: Math.max(0, subtotal - rewardDiscount - percentDiscount),
      comboName: matchingCombo?.name ?? null,
      comboPercent: matchingCombo?.discountPercent ?? 0,
    }
  })

  const subtotal = cartLines.reduce((sum, line) => sum + line.subtotal, 0)
  const automaticDiscount = cartLines.reduce((sum, line) => sum + line.discount, 0)
  const totalDiscount = automaticDiscount + discount
  const finalTotal = Math.max(0, subtotal - totalDiscount)
  const cartDates = compactDateRanges(cartLines.map(line => line.date))

  const addPendingDates = (dates: string[]) => {
    setPendingDates(current => [...new Set([...current, ...dates])].sort())
  }

  const removePendingDate = (date: string) => {
    setPendingDates(current => current.filter(item => item !== date))
  }

  const addToCart = () => {
    if (sortedPendingDates.length === 0 || pendingMeals.length === 0) return
    setCart(current => {
      const byDate = new Map(current.map(day => [day.date, day.mealIds]))
      for (const date of sortedPendingDates) {
        byDate.set(date, [...new Set([...(byDate.get(date) ?? []), ...pendingMeals])])
      }
      return [...byDate.entries()].map(([date, mealIds]) => ({ date, mealIds })).filter(day => day.mealIds.length > 0)
    })
  }

  const removeCartMeal = (date: string, mealId: string) => {
    setCart(current => current
      .map(day => day.date === date ? { ...day, mealIds: day.mealIds.filter(id => id !== mealId) } : day)
      .filter(day => day.mealIds.length > 0))
  }

  return (
    <form action={action} className="space-y-4 border-b border-gray-100 bg-gray-50 p-4">
      <input type="hidden" name="meal_cart" value={JSON.stringify(cartLines)} />
      <input type="hidden" name="subtotal_amount" value={subtotal.toFixed(2)} />
      <input type="hidden" name="discount_amount" value={totalDiscount.toFixed(2)} />
      <input type="hidden" name="final_amount" value={finalTotal.toFixed(2)} />

      <div className="grid gap-3 md:grid-cols-3">
        <input name="consumer_name" required placeholder="Nome da pessoa" defaultValue={defaultConsumerName} readOnly={lockConsumerName}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 md:col-span-2 read-only:bg-gray-100 read-only:text-gray-500" />
        {showManualDiscount ? (
          <div className="flex overflow-hidden rounded-lg border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-brand-400">
            <span className="border-r border-gray-200 px-3 py-2 text-sm font-semibold text-gray-500">$</span>
            <input type="number" min="0" step="0.01" value={discount} onChange={event => setDiscount(Number(event.target.value || 0))} placeholder="Desconto manual"
              className="min-w-0 flex-1 px-3 py-2 text-sm outline-none" />
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">
            O pedido fica pendente até a confirmação do pagamento.
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Refeições para adicionar</p>
        <div className="flex flex-wrap gap-3 text-xs font-medium text-gray-600">
          {mealOptions.map(meal => (
            <label key={meal.id} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={pendingMeals.includes(meal.id)}
                onChange={event => setPendingMeals(current => event.target.checked
                  ? [...new Set([...current, meal.id])]
                  : current.filter(id => id !== meal.id))}
                className="h-4 w-4 rounded border-gray-300 text-brand-500"
              />
              {meal.label} <span className="text-gray-400">({money(meal.price)})</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border border-gray-200 bg-white p-3 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-gray-500">Adicionar dia individual</p>
          <div className="flex gap-2">
            <input type="date" value={singleDate} onChange={event => setSingleDate(event.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            <button type="button" onClick={() => addPendingDates(singleDate ? [singleDate] : [])}
              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
              Adicionar
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-gray-500">Adicionar intervalo</p>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input type="date" value={rangeStart} onChange={event => setRangeStart(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            <input type="date" value={rangeEnd} onChange={event => setRangeEnd(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            <button type="button" onClick={() => addPendingDates(eachDateInRange(rangeStart, rangeEnd))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
              Selecionar
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase text-gray-500">Dias selecionados para adicionar</p>
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
            {sortedPendingDates.length} dia{sortedPendingDates.length === 1 ? '' : 's'}
          </span>
        </div>
        {sortedPendingDates.length === 0 ? (
          <p className="text-sm text-gray-400">Selecione pelo menos um dia.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {compactDateRanges(sortedPendingDates).map(range => (
              <button key={`${range.start}-${range.end}`} type="button" onClick={() => eachDateInRange(range.start, range.end).forEach(removePendingDate)}
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600">
                {rangeLabel(range.start, range.end)} ×
              </button>
            ))}
          </div>
        )}
      </div>

      <button type="button" disabled={sortedPendingDates.length === 0 || pendingMeals.length === 0} onClick={addToCart}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50">
        Adicionar à compra
      </button>

      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase text-gray-500">Itens da compra</p>
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
            {cartDates.map(range => rangeLabel(range.start, range.end)).join(', ') || 'Nenhum dia'}
          </span>
        </div>
        {cartLines.length === 0 ? (
          <p className="text-sm text-gray-400">Adicione refeições por dia antes de confirmar.</p>
        ) : (
          <div className="space-y-2">
            {cartLines.map(line => (
              <div key={line.date} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <span className="text-xs font-semibold text-gray-700">{fmtDate(line.date)}</span>
                {line.purchasedMealIds.map(mealId => (
                  <button key={mealId} type="button" onClick={() => removeCartMeal(line.date, mealId)}
                    className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600">
                    {mealLabel(mealId)} ×
                  </button>
                ))}
                {line.rewardMealIds.map(mealId => (
                  <span key={mealId} className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                    {mealLabel(mealId)} grátis
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-2 rounded-lg border border-gray-200 bg-white p-3 text-sm sm:grid-cols-3">
        <div>
          <p className="text-xs text-gray-400">Subtotal</p>
          <p className="font-semibold text-gray-800">{money(subtotal)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Desconto</p>
          <p className="font-semibold text-red-600">-{money(totalDiscount)}</p>
          {automaticDiscount > 0 && <p className="text-[11px] text-gray-400">Combos aplicados automaticamente.</p>}
        </div>
        <div>
          <p className="text-xs text-gray-400">Total</p>
          <p className="font-bold text-brand-700">{money(finalTotal)}</p>
        </div>
      </div>

      <textarea name="notes" rows={2} placeholder="Observação para a cozinha: vegetariano, alergias, restrições, sem ovo..."
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />

      <button disabled={cartLines.length === 0}
        className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50">
        {submitLabel}
      </button>
    </form>
  )
}
