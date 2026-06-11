# Import de inscrições externas (Google Forms etc.)

Script para importar respostas de formulários externos (ex.: Google
Forms exportado como `.xlsx`/`.csv`) direto para o sisgo, criando:

1. Uma `school_interest_forms` (pré-inscrição, status `formulario_enviado`)
2. Uma `school_applications` (formulário preenchido, status `em_analise`,
   `form_data` já populado), linkada à pré-inscrição acima.

Depois de rodar, os candidatos aparecem normalmente em
`/{slug}/inscricoes` (aba "Pré-inscrições"), com o link "📋 Formulário
preenchido — Ver respostas".

## Setup (uma vez só)

```bash
cd "/Volumes/SSD SATA/Projetos/sisgo"
npm install   # instala o pacote "xlsx" (já está no package.json)
```

## Uso

```bash
node scripts/import-applications/run.mjs <arquivo.xlsx> --org=<slug-da-organizacao>
```

Por padrão roda em **dry run**: mostra nome, e-mail, `form_data`
mapeado e avisos de cada candidato, sem gravar nada. Confira a saída e,
se estiver tudo certo, rode de novo com `--confirm`:

```bash
node scripts/import-applications/run.mjs <arquivo.xlsx> --org=<slug> --confirm
```

### Opções

- `--org=<slug>` (obrigatório) — slug da organização (ex.:
  `jocum-almirante-tamandare`).
- `--school=<nome ou id>` — só necessário se a organização tiver mais
  de uma escola do tipo `eted`.
- `--turma=<nome ou id>` — só necessário se a escola tiver mais de uma
  turma ativa com inscrições abertas (`active=true` e
  `registrations_open=true`). Por padrão, usa a única turma nessas
  condições.
- `--confirm` — grava no banco. Sem essa flag, é dry run.

O script ignora candidatos cujo e-mail já existe em uma
`school_application` da mesma turma (evita duplicar em re-execuções).

## Como o Claude deve usar isso

Quando o usuário disser algo como "importa esse xlsx do Google Forms
pra turma X":

1. Rode **sem** `--confirm` primeiro.
2. Leia a saída: confira nomes, e-mails, e principalmente os avisos
   (`⚠`). Avisos comuns:
   - país (`pais`) inferido pela nacionalidade pode não bater com o
     endereço (ex.: refugiados/expatriados) — confirme com o usuário
     ou ajuste manualmente depois pelo admin.
   - `apoio_tipo` / `mantenedores` são heurísticas (o Google Forms só
     pergunta sim/não, mas o sistema tem um enum mais detalhado) —
     avise o usuário que pode precisar ajustar.
   - campos não reconhecidos ficam em branco para o usuário preencher
     manualmente depois (igual ao combinado anteriormente: "se faltar
     informação, deixa em branco").
3. Se os avisos forem só os esperados/triviais, rode de novo com
   `--confirm`. Se houver algo estranho (ex.: e-mail vazio, nome
   estranho, mapeamento de estado civil não reconhecido), pergunte ao
   usuário antes de confirmar.
4. Avise o usuário do resultado final (quantos OK / ignorados /
   erros) e que pode conferir em `/{slug}/inscricoes`.

### Se o arquivo não for reconhecido

O script detecta o formulário pelos cabeçalhos das colunas
(`signature` em cada arquivo de `mappings/`). Se não reconhecer, ele
salva os cabeçalhos + uma linha de exemplo em
`scripts/import-applications/pending-mappings/unmapped-<timestamp>.json`
e para.

Para adicionar suporte a um novo formulário (outra escola/EMBARK/etc.):

1. Abra o JSON salvo em `pending-mappings/` para ver os cabeçalhos
   exatos e um exemplo de linha.
2. Copie `mappings/dts.mjs` como base.
3. Ajuste `signature` (2-3 cabeçalhos exclusivos desse formulário),
   o objeto `COL` (cabeçalho -> nome interno) e a função `mapRow`,
   mapeando cada coluna para a seção/campo correspondente em
   `form_data` — consulte
   `src/app/[slug]/formulario/[token]/FormularioInscricao.tsx` para a
   lista de seções (`s1`, `s3`–`s16`) e nomes de campo exatos.
4. Registre o novo módulo em `MAPPINGS` no `run.mjs`.
5. Rode de novo em dry run para validar.

## Sobre o ambiente

Este script roda com Node.js (`@supabase/supabase-js` + `xlsx`, ambos
no `package.json` do projeto) e usa
`SUPABASE_SERVICE_ROLE_KEY`/`NEXT_PUBLIC_SUPABASE_URL` do `.env.local`
— ou seja, grava direto na base de **produção**. Se o sandbox do
Claude não tiver acesso de rede/bash, peça para o usuário rodar o
comando no terminal dele e cole o resultado de volta.
