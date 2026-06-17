'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { RECEITAS_PADRAO, INSUMOS_PADRAO } from './receitas-padrao'

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

function normalizeCode(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '').toUpperCase().slice(0, 16)
}

export async function seedDefaultRecipes(organizationId: string, createdBy: string) {
  const sb = createAdminClient()

  // 1. Buscar itens de estoque existentes
  const { data: existingItems } = await sb
    .from('kitchen_stock_items')
    .select('id, name')
    .eq('organization_id', organizationId)
    .eq('active', true)
  const itemByName = new Map((existingItems ?? []).map(i => [i.name.toLowerCase(), i.id]))

  // 2. Criar itens de estoque que não existem
  for (const insumo of INSUMOS_PADRAO) {
    if (itemByName.has(insumo.nome.toLowerCase())) continue
    const { data } = await sb.from('kitchen_stock_items').insert({
      organization_id: organizationId,
      code: normalizeCode(insumo.nome),
      name: insumo.nome,
      category: insumo.categoria,
      unit: insumo.unidade,
      quantity: 0,
      min_quantity: 0,
      created_by: createdBy,
    }).select('id').single()
    if (data) itemByName.set(insumo.nome.toLowerCase(), data.id)
  }

  // 3. Buscar receitas existentes para não duplicar
  const { data: existingRecipes } = await sb
    .from('kitchen_recipes')
    .select('name')
    .eq('organization_id', organizationId)
    .eq('active', true)
  const existingNames = new Set((existingRecipes ?? []).map(r => r.name.toLowerCase()))

  // 4. Criar receitas e ingredientes
  let created = 0
  for (const receita of RECEITAS_PADRAO) {
    if (existingNames.has(receita.nome.toLowerCase())) continue

    const { data: newRecipe } = await sb.from('kitchen_recipes').insert({
      organization_id: organizationId,
      name: receita.nome,
      category: receita.categoria,
      portion_yield: receita.rendimentoPorcoes,
      prep_time_minutes: receita.tempoMinutos,
      instructions: receita.instrucoes,
      meal_ids: receita.mealIds,
      created_by: createdBy,
    }).select('id').single()
    if (!newRecipe) continue

    const ingredientsToInsert = receita.ingredientes
      .map((ing, i) => {
        const itemId = itemByName.get(ing.nome.toLowerCase())
        if (!itemId) return null
        return {
          recipe_id: newRecipe.id,
          item_id: itemId,
          quantity_per_portion: ing.qtdPorPorcao,
          unit: ing.unidade,
          notes: null,
          sort_order: i,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    if (ingredientsToInsert.length > 0) {
      await sb.from('kitchen_recipe_ingredients').insert(ingredientsToInsert)
    }
    created++
  }

  return created
}
