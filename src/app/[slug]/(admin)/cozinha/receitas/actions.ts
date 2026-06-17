'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function createRecipe(data: {
  organizationId: string
  name: string
  category: string | null
  portionYield: number
  prepTimeMinutes: number | null
  instructions: string | null
  mealIds: string[]
  createdBy: string
}) {
  const sb = createAdminClient()
  const { data: recipe, error } = await sb.from('kitchen_recipes').insert({
    organization_id: data.organizationId,
    name: data.name,
    category: data.category,
    portion_yield: data.portionYield,
    prep_time_minutes: data.prepTimeMinutes,
    instructions: data.instructions,
    meal_ids: data.mealIds,
    created_by: data.createdBy,
  }).select('id').single()
  if (error) throw new Error(error.message)
  return recipe.id
}

export async function updateRecipe(data: {
  id: string
  name: string
  category: string | null
  portionYield: number
  prepTimeMinutes: number | null
  instructions: string | null
  mealIds: string[]
}) {
  const sb = createAdminClient()
  const { error } = await sb.from('kitchen_recipes').update({
    name: data.name,
    category: data.category,
    portion_yield: data.portionYield,
    prep_time_minutes: data.prepTimeMinutes,
    instructions: data.instructions,
    meal_ids: data.mealIds,
    updated_at: new Date().toISOString(),
  }).eq('id', data.id)
  if (error) throw new Error(error.message)
}

export async function removeRecipe(id: string) {
  const sb = createAdminClient()
  await sb.from('kitchen_recipes').update({ active: false, updated_at: new Date().toISOString() }).eq('id', id)
}

export async function saveIngredients(recipeId: string, ingredients: Array<{
  itemId: string
  quantityPerPortion: number
  unit: string
  notes: string | null
}>) {
  const sb = createAdminClient()
  await sb.from('kitchen_recipe_ingredients').delete().eq('recipe_id', recipeId)
  if (ingredients.length === 0) return
  const { error } = await sb.from('kitchen_recipe_ingredients').insert(
    ingredients.map((ing, i) => ({
      recipe_id: recipeId,
      item_id: ing.itemId,
      quantity_per_portion: ing.quantityPerPortion,
      unit: ing.unit,
      notes: ing.notes,
      sort_order: i,
    }))
  )
  if (error) throw new Error(error.message)
}

export async function confirmProduction(data: {
  organizationId: string
  recipeId: string
  portions: number
  createdBy: string
}) {
  const sb = createAdminClient()
  const { data: ingredients } = await sb
    .from('kitchen_recipe_ingredients')
    .select('item_id, quantity_per_portion, unit')
    .eq('recipe_id', data.recipeId)
  if (!ingredients?.length) return

  for (const ing of ingredients) {
    const totalQty = ing.quantity_per_portion * data.portions
    const { data: item } = await sb
      .from('kitchen_stock_items')
      .select('quantity')
      .eq('id', ing.item_id)
      .single()
    if (!item) continue

    await sb.from('kitchen_stock_movements').insert({
      organization_id: data.organizationId,
      item_id: ing.item_id,
      movement_type: 'saida',
      quantity: totalQty,
      reason: `Produção de receita (${data.portions} porções)`,
      movement_date: new Date().toISOString().split('T')[0],
      created_by: data.createdBy,
    })
    await sb.from('kitchen_stock_items').update({
      quantity: Math.max(0, Number(item.quantity) - totalQty),
      updated_at: new Date().toISOString(),
    }).eq('id', ing.item_id)
  }
}
