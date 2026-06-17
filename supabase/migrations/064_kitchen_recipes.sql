-- Ficha técnica de preparação (receitas)
CREATE TABLE kitchen_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  portion_yield NUMERIC(10,2) NOT NULL DEFAULT 1,
  prep_time_minutes INT,
  instructions TEXT,
  meal_ids TEXT[] DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kitchen_recipes_org ON kitchen_recipes (organization_id) WHERE active;

-- Ingredientes de cada receita
CREATE TABLE kitchen_recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES kitchen_recipes(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES kitchen_stock_items(id),
  quantity_per_portion NUMERIC(10,4) NOT NULL,
  unit TEXT NOT NULL,
  notes TEXT,
  sort_order INT DEFAULT 0
);

CREATE INDEX idx_kitchen_recipe_ingredients_recipe ON kitchen_recipe_ingredients (recipe_id);

-- RLS
ALTER TABLE kitchen_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_recipe_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kitchen_recipes_org" ON kitchen_recipes
  USING (organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid() AND active
  ));

CREATE POLICY "kitchen_recipe_ingredients_via_recipe" ON kitchen_recipe_ingredients
  USING (recipe_id IN (
    SELECT id FROM kitchen_recipes WHERE organization_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid() AND active
    )
  ));
