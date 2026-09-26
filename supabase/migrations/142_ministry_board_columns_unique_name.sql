-- 142: nome de coluna único por ministério (case-insensitive). Fecha de vez
-- a brecha de corrida que o seed de colunas padrão tinha: duas requisições
-- concorrentes podiam ver a lista vazia ao mesmo tempo e cada uma inserir
-- seu próprio conjunto, duplicando "A Fazer"/"Fazendo"/"Concluído". A
-- checagem em nível de aplicação (createColumn/renameColumn,
-- tarefas/actions.ts) já existia mas não é atômica (check-then-insert); o
-- índice único é quem garante de verdade, e a aplicação trata o erro de
-- violação (23505) como a mesma mensagem amigável.
create unique index if not exists idx_ministry_board_columns_unique_name
  on public.ministry_board_columns (ministry_id, lower(name));
