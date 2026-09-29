# sisgo — notas para o Claude

Sistema Next.js 15 + Supabase para gestão da JOCUM (multi-tenant via
`[slug]`). Tabelas principais de inscrições: `school_interest_forms`
(pré-inscrição) e `school_applications` (formulário completo,
`form_data` jsonb).

## Migrations do banco

Nunca aplique migration à mão (SQL Editor/psql). Use sempre:

```bash
npm run db:migrate                 # status: o que falta (não grava nada)
npm run db:migrate -- --apply      # aplica as pendentes em ordem e registra
```

O script (`scripts/db-migrate.mjs`) roda no `DATABASE_URL` do `.env.local`
(produção), cada migration numa transação junto com o registro em
`supabase_migrations.schema_migrations`. Rode `--apply` depois de todo
`git pull` que traga migration nova e logo após criar uma. Número de arquivo
tem que ser único (`<número>_<nome>.sql`; sub-versão tipo `0851_` se
precisar encaixar). Se o script parar dizendo que os objetos "já existem",
alguém aplicou à mão: confira no banco e registre com
`npm run db:migrate -- --mark-applied=<versão>`.

## Importar inscrições de formulários externos (Google Forms etc.)

Se o usuário pedir para importar um `.xlsx`/`.csv` de respostas de um
formulário externo (Google Forms) para dentro do sistema, use:

```bash
node scripts/import-applications/run.mjs <arquivo> --org=<slug-da-organizacao>
```

Leia **`scripts/import-applications/README.md`** antes — explica o
fluxo (dry run → revisar avisos → `--confirm`), como resolver
escola/turma, e como adicionar mapeamento para um formulário novo que
ainda não seja reconhecido.
