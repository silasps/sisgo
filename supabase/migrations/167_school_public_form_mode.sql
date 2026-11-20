-- Modo da página pública da escola: 'completa' (padrão — landing page com
-- descrição, estrutura, próxima turma etc.) ou 'somente_formulario' (pula
-- toda a página de marketing; pra escolas tipo seminário já abre direto o
-- formulário de matrícula, sem pré-inscrição). Ver
-- src/app/[slug]/escola/[schoolSlug]/page.tsx.
alter table schools
  add column if not exists public_form_mode text not null default 'completa'
    check (public_form_mode in ('completa', 'somente_formulario'));
