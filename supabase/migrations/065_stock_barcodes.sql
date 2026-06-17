-- Múltiplos códigos de barras por item de estoque.
-- Cada barcode representa uma marca/embalagem diferente do mesmo insumo.
-- Ex: "Açúcar União 1kg" e "Açúcar Caravelas 5kg" → ambos vinculados ao item "Açúcar".
CREATE TABLE kitchen_stock_barcodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES kitchen_stock_items(id) ON DELETE CASCADE,
  barcode TEXT NOT NULL,
  brand TEXT,                         -- "União", "Caravelas"
  description TEXT,                   -- "Açúcar refinado União 1kg"
  package_quantity NUMERIC(10,2),     -- 1.00 (quantidade por embalagem)
  package_unit TEXT,                  -- "kg" (deve coincidir com a unidade do item)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_stock_barcodes_unique
  ON kitchen_stock_barcodes (organization_id, barcode);
CREATE INDEX idx_stock_barcodes_item
  ON kitchen_stock_barcodes (item_id);
