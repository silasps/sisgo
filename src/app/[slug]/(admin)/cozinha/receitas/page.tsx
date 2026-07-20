import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Header } from '@/components/layout/Header'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getRolePreview } from '@/lib/role-preview'
import { userHasAnyRole, KITCHEN_ROLES } from '@/lib/auth/permissions'
import { ReceitaForm } from './ReceitaForm'
import { createRecipe, updateRecipe, removeRecipe, saveIngredients, confirmProduction, seedDefaultRecipes } from './actions'
import { ChefHat, Clock, UtensilsCrossed, Trash2, Pencil, Plus, Download } from 'lucide-react'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ edit?: string; msg?: string }>
}

const CATEGORIES = ['Prato principal', 'Acompanhamento', 'Salada', 'Sobremesa', 'Bebida', 'Outro']

export default async function ReceitasPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { edit, msg } = await searchParams
  const supabase = await createClient()
  const sbAdmin = createAdminClient()

  const [{ data: { user } }, { data: org }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('organizations').select('id, role_accumulations').eq('slug', slug).single(),
  ])
  if (!user || !org) notFound()

  const { data: orgUsers } = await supabase
    .from('organization_users')
    .select('organization_id, roles(name), extra_roles')
    .eq('user_id', user.id)
    .eq('active', true)
  const rows = (orgUsers ?? []) as unknown as Array<{
    organization_id: string | null; roles: { name: string } | null; extra_roles?: string[] | null
  }>
  const superadminRow = rows.find(r => r.roles?.name === 'superadmin')
  const currentOrgRow = rows.find(r => r.organization_id === org.id)
  const realRole = superadminRow?.roles?.name ?? currentOrgRow?.roles?.name ?? ''
  const preview = await getRolePreview(realRole)
  const role = preview?.role ?? realRole
  const orgAccumulations = (org?.role_accumulations as Record<string, string[]> | null) ?? {}
  const extraRoles = (currentOrgRow?.extra_roles as string[] | null) ?? []
  if (!userHasAnyRole([role, ...(orgAccumulations[role] ?? []), ...extraRoles], KITCHEN_ROLES)) notFound()

  const [{ data: recipes }, { data: stockItems }, { data: mealSettings }] = await Promise.all([
    sbAdmin.from('kitchen_recipes')
      .select('id, name, category, portion_yield, prep_time_minutes, instructions, meal_ids, created_at')
      .eq('organization_id', org.id)
      .eq('active', true)
      .order('name'),
    sbAdmin.from('kitchen_stock_items')
      .select('id, name, unit')
      .eq('organization_id', org.id)
      .eq('active', true)
      .order('name'),
    sbAdmin.from('kitchen_meal_settings')
      .select('meal_options')
      .eq('organization_id', org.id)
      .maybeSingle(),
  ])

  const mealOptions = Array.isArray((mealSettings as { meal_options?: unknown } | null)?.meal_options)
    ? ((mealSettings as { meal_options: Array<{ id: string; label: string }> }).meal_options)
    : [{ id: 'breakfast', label: 'Café da manhã' }, { id: 'lunch', label: 'Almoço' }, { id: 'dinner', label: 'Janta' }]

  const recipeList = (recipes ?? []) as Array<{
    id: string; name: string; category: string | null; portion_yield: number
    prep_time_minutes: number | null; instructions: string | null; meal_ids: string[] | null; created_at: string
  }>
  const items = (stockItems ?? []) as Array<{ id: string; name: string; unit: string }>

  let editingRecipe: (typeof recipeList)[0] | null = null
  let editingIngredients: Array<{ id: string; item_id: string; quantity_per_portion: number; unit: string; notes: string | null }> = []

  if (edit) {
    editingRecipe = recipeList.find(r => r.id === edit) ?? null
    if (editingRecipe) {
      const { data } = await sbAdmin.from('kitchen_recipe_ingredients')
        .select('id, item_id, quantity_per_portion, unit, notes')
        .eq('recipe_id', edit)
        .order('sort_order')
      editingIngredients = (data ?? []) as typeof editingIngredients
    }
  }

  const handleCreate = async (formData: FormData) => {
    'use server'
    const name = String(formData.get('name') ?? '').trim()
    if (!name) return
    const mealIds = formData.getAll('meal_ids').map(String).filter(Boolean)
    const recipeId = await createRecipe({
      organizationId: org.id,
      name,
      category: String(formData.get('category') ?? '').trim() || null,
      portionYield: Number(formData.get('portion_yield') ?? 1),
      prepTimeMinutes: formData.get('prep_time_minutes') ? Number(formData.get('prep_time_minutes')) : null,
      instructions: String(formData.get('instructions') ?? '').trim() || null,
      mealIds,
      createdBy: user.id,
    })
    redirect(`/${slug}/cozinha/receitas?edit=${recipeId}&msg=receita_criada`)
  }

  const handleUpdate = async (formData: FormData) => {
    'use server'
    const id = String(formData.get('recipe_id') ?? '')
    if (!id) return
    const mealIds = formData.getAll('meal_ids').map(String).filter(Boolean)
    await updateRecipe({
      id,
      name: String(formData.get('name') ?? '').trim(),
      category: String(formData.get('category') ?? '').trim() || null,
      portionYield: Number(formData.get('portion_yield') ?? 1),
      prepTimeMinutes: formData.get('prep_time_minutes') ? Number(formData.get('prep_time_minutes')) : null,
      instructions: String(formData.get('instructions') ?? '').trim() || null,
      mealIds,
    })
    redirect(`/${slug}/cozinha/receitas?msg=receita_atualizada`)
  }

  const handleRemove = async (formData: FormData) => {
    'use server'
    await removeRecipe(String(formData.get('recipe_id') ?? ''))
    redirect(`/${slug}/cozinha/receitas?msg=receita_removida`)
  }

  const handleSaveIngredients = async (recipeId: string, ingredients: Array<{
    itemId: string; quantityPerPortion: number; unit: string; notes: string | null
  }>) => {
    'use server'
    await saveIngredients(recipeId, ingredients)
  }

  const handleConfirmProduction = async (recipeId: string, portions: number) => {
    'use server'
    await confirmProduction({ organizationId: org.id, recipeId, portions, createdBy: user.id })
  }

  const handleSeedDefaults = async () => {
    'use server'
    const count = await seedDefaultRecipes(org.id, user.id)
    redirect(`/${slug}/cozinha/receitas?msg=seed_${count}`)
  }

  const msgInfo: Record<string, string> = {
    receita_criada: 'Receita criada. Agora adicione os ingredientes.',
    receita_atualizada: 'Receita atualizada.',
    receita_removida: 'Receita removida.',
  }

  const seedMsg = msg?.startsWith('seed_') ? `${msg.replace('seed_', '')} receitas padrão importadas com sucesso!` : null

  return (
    <>
      <Header
        title="Fichas Técnicas"
        actions={
          <Link href={`/${slug}/cozinha`} className="text-sm text-gray-300 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors">
            ← Cozinha
          </Link>
        }
      />
      <main className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">

        {(msg && msgInfo[msg]) || seedMsg ? (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {seedMsg ?? msgInfo[msg!]}
          </div>
        ) : null}

        {/* Carregar receitas padrão */}
        {recipeList.length === 0 && !edit && (
          <form action={handleSeedDefaults}>
            <div className="rounded-xl border border-brand-200 bg-brand-50 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                <p className="text-sm font-semibold text-brand-800">Receitas padrão brasileiras</p>
                <p className="text-xs text-brand-600 mt-0.5">
                  Importe 18 fichas técnicas prontas (arroz, feijão, strogonoff, feijoada, sopas, etc.)
                  com ingredientes e quantidades por porção. Os insumos são criados automaticamente no estoque.
                  Tudo editável depois.
                </p>
              </div>
              <button className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors flex-shrink-0">
                <Download className="size-4" /> Importar receitas
              </button>
            </div>
          </form>
        )}

        {/* ── Formulário de nova receita / edição ────────── */}
        <details open={!!edit} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <summary className="px-4 py-3 text-sm font-semibold text-brand-600 hover:bg-brand-50 cursor-pointer transition-colors list-none flex items-center gap-2">
            <Plus className="size-4" />
            {editingRecipe ? `Editando: ${editingRecipe.name}` : 'Nova ficha técnica'}
          </summary>
          <form action={editingRecipe ? handleUpdate : handleCreate} className="p-4 border-t border-gray-100 space-y-3">
            {editingRecipe && <input type="hidden" name="recipe_id" value={editingRecipe.id} />}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
                <input name="name" required defaultValue={editingRecipe?.name ?? ''} placeholder="Ex: Feijoada"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Categoria</label>
                <select name="category" defaultValue={editingRecipe?.category ?? ''}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white">
                  <option value="">Selecione</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Rende (porções)</label>
                <input name="portion_yield" type="number" step="0.01" min="1" defaultValue={editingRecipe?.portion_yield ?? 1}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tempo de preparo (min)</label>
                <input name="prep_time_minutes" type="number" min="0" defaultValue={editingRecipe?.prep_time_minutes ?? ''}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Refeições que usam esta receita</label>
              <div className="flex flex-wrap gap-2">
                {mealOptions.map(m => (
                  <label key={m.id} className="inline-flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="checkbox" name="meal_ids" value={m.id}
                      defaultChecked={editingRecipe?.meal_ids?.includes(m.id) ?? false}
                      className="rounded border-gray-300 text-brand-500 focus:ring-brand-400" />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Modo de preparo</label>
              <textarea name="instructions" rows={3} defaultValue={editingRecipe?.instructions ?? ''}
                placeholder="Opcional — descreva o passo a passo"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div className="flex gap-2">
              <button className="rounded-lg bg-brand-500 hover:bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors">
                {editingRecipe ? 'Salvar alterações' : 'Criar ficha técnica'}
              </button>
              {editingRecipe && (
                <Link href={`/${slug}/cozinha/receitas`}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancelar
                </Link>
              )}
            </div>
          </form>
        </details>

        {/* ── Editor de ingredientes (quando editando) ──── */}
        {editingRecipe && (
          <ReceitaForm
            recipeId={editingRecipe.id}
            recipeName={editingRecipe.name}
            portionYield={editingRecipe.portion_yield}
            stockItems={items}
            initialIngredients={editingIngredients.map(i => ({
              itemId: i.item_id,
              quantityPerPortion: i.quantity_per_portion,
              unit: i.unit,
              notes: i.notes,
            }))}
            onSave={handleSaveIngredients}
            onConfirmProduction={handleConfirmProduction}
          />
        )}

        {/* ── Lista de receitas ─────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">
            {recipeList.length} ficha{recipeList.length !== 1 ? 's' : ''} técnica{recipeList.length !== 1 ? 's' : ''} cadastrada{recipeList.length !== 1 ? 's' : ''}
          </h2>

          {recipeList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
              <ChefHat className="size-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-400">Nenhuma ficha técnica cadastrada.</p>
              <p className="text-xs text-gray-400 mt-1">Crie uma receita para começar a controlar insumos.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 animate-stagger">
              {recipeList.map(recipe => (
                <div key={recipe.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2 transition-all hover:shadow-sm hover:border-brand-200">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">{recipe.name}</p>
                      {recipe.category && (
                        <span className="text-xs text-brand-600 font-medium">{recipe.category}</span>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Link href={`/${slug}/cozinha/receitas?edit=${recipe.id}`}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-brand-600 transition-colors">
                        <Pencil className="size-3.5" />
                      </Link>
                      <form action={handleRemove}>
                        <input type="hidden" name="recipe_id" value={recipe.id} />
                        <button className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 className="size-3.5" />
                        </button>
                      </form>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      <UtensilsCrossed className="size-3" /> {recipe.portion_yield} porção{recipe.portion_yield !== 1 ? 'ões' : ''}
                    </span>
                    {recipe.prep_time_minutes && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" /> {recipe.prep_time_minutes} min
                      </span>
                    )}
                  </div>
                  {recipe.meal_ids && recipe.meal_ids.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {recipe.meal_ids.map(id => {
                        const m = mealOptions.find(o => o.id === id)
                        return m ? (
                          <span key={id} className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full font-medium">
                            {m.label}
                          </span>
                        ) : null
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  )
}
