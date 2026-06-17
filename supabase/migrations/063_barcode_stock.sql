-- Código de barras opcional para itens de estoque da cozinha
ALTER TABLE kitchen_stock_items ADD COLUMN IF NOT EXISTS barcode TEXT;
CREATE INDEX IF NOT EXISTS idx_kitchen_stock_items_barcode
  ON kitchen_stock_items (organization_id, barcode)
  WHERE barcode IS NOT NULL;
