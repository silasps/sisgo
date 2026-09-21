-- Campos de tradução manual (inglês/espanhol) para conteúdo público que a
-- organização escreve sobre escolas, turmas e ministérios. O texto original
-- continua na própria coluna existente (assumido português); as traduções
-- ficam em jsonb no formato { en?: string, es?: string }.

alter table schools
  add column if not exists long_description_translations jsonb not null default '{}'::jsonb,
  add column if not exists target_audience_translations jsonb not null default '{}'::jsonb;

alter table school_classes
  add column if not exists public_description_translations jsonb not null default '{}'::jsonb,
  add column if not exists cost_description_translations jsonb not null default '{}'::jsonb;

alter table ministries
  add column if not exists description_translations jsonb not null default '{}'::jsonb,
  add column if not exists subtitle_translations jsonb not null default '{}'::jsonb;
