-- 043: pais do telefone dos fornecedores da cozinha

ALTER TABLE kitchen_stock_suppliers
  ADD COLUMN IF NOT EXISTS contact_country_code text NOT NULL DEFAULT 'BR';
