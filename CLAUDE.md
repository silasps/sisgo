# sisgo — notas para o Claude

Sistema Next.js 15 + Supabase para gestão da JOCUM (multi-tenant via
`[slug]`). Tabelas principais de inscrições: `school_interest_forms`
(pré-inscrição) e `school_applications` (formulário completo,
`form_data` jsonb).

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
