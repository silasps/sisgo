-- 069: quartos inteligentes — blocos, modos de alocação e destinação

-- ── 1. Novos campos na tabela rooms ─────────────────────────────────────────

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS block text;

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS allocation_mode text NOT NULL DEFAULT 'cama'
    CHECK (allocation_mode IN ('cama', 'quarto'));

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS destination text NOT NULL DEFAULT 'visita'
    CHECK (destination IN ('visita', 'aluno', 'obreiro'));

CREATE INDEX IF NOT EXISTS rooms_block_idx ON rooms (organization_id, block);

-- ── 2. school_id na tabela room_allocations ─────────────────────────────────

ALTER TABLE room_allocations
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE SET NULL;
