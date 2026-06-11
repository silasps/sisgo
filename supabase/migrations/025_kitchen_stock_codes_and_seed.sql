-- 025: codigo de estoque da cozinha e itens basicos por base

ALTER TABLE kitchen_stock_items
  ADD COLUMN IF NOT EXISTS code text;

UPDATE kitchen_stock_items
SET code = upper(left(regexp_replace(name, '[^A-Za-z0-9]+', '', 'g'), 12))
WHERE code IS NULL OR trim(code) = '';

ALTER TABLE kitchen_stock_items
  ALTER COLUMN code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS kitchen_stock_items_org_code_idx
  ON kitchen_stock_items (organization_id, code)
  WHERE active = true;

INSERT INTO kitchen_stock_items (organization_id, code, name, category, unit, quantity, min_quantity, notes)
SELECT o.id, item.code, item.name, item.category, item.unit, 0, item.min_quantity, 'Item básico pré-cadastrado'
FROM organizations o
CROSS JOIN (
  VALUES
    ('ARR001', 'Arroz', 'Grãos', 'kg', 10),
    ('FEI001', 'Feijão', 'Grãos', 'kg', 10),
    ('OLE001', 'Óleo de soja', 'Mercearia', 'l', 5),
    ('ACU001', 'Açúcar', 'Mercearia', 'kg', 5),
    ('SAL001', 'Sal', 'Temperos', 'kg', 2),
    ('CAF001', 'Café', 'Café da manhã', 'kg', 2),
    ('LEI001', 'Leite', 'Café da manhã', 'l', 10),
    ('MAC001', 'Macarrão', 'Massas', 'kg', 5),
    ('FAR001', 'Farinha de trigo', 'Mercearia', 'kg', 5),
    ('OVO001', 'Ovos', 'Proteínas', 'dz', 3),
    ('FRG001', 'Frango', 'Proteínas', 'kg', 10),
    ('CAR001', 'Carne', 'Proteínas', 'kg', 10),
    ('BAT001', 'Batata', 'Hortifruti', 'kg', 10),
    ('TOM001', 'Tomate', 'Hortifruti', 'kg', 5),
    ('CEB001', 'Cebola', 'Hortifruti', 'kg', 5),
    ('ALH001', 'Alho', 'Temperos', 'kg', 1)
) AS item(code, name, category, unit, min_quantity)
WHERE NOT EXISTS (
  SELECT 1 FROM kitchen_stock_items ksi
  WHERE ksi.organization_id = o.id
    AND ksi.code = item.code
    AND ksi.active = true
);
