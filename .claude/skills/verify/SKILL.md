---
name: verify
description: How to build/run/drive the sisgo app for runtime verification
---

# Verificação em runtime — sisgo

## Subir o app
```bash
npm run dev
```
Next 15 + Turbopack. Se a porta 3000 já estiver ocupada (comum — o usuário
costuma ter um servidor rodando), o Next sobe automaticamente em 3002 e
avisa no log. **Não mate processos na 3000 sem confirmar** — pode ser a
sessão do usuário. Rode `curl -s -o /dev/null -w "%{http_code}" localhost:3000`
antes: se responder 200, é outro processo (provavelmente do usuário) — use
a porta alternativa que o Next escolher.

## Banco de dados
Só existe UM Supabase configurado (`.env.local` → `DATABASE_URL`), e é o de
**produção** (projeto `jkurtnkxkzknrcqytsey`). Não há Supabase local. Para
rodar migrations ou inspecionar dados:
```bash
set -a && source .env.local 2>/dev/null && set +a
psql "$DATABASE_URL" -c "..."
```
Migrations em `supabase/migrations/*.sql` são aplicadas com
`npm run db:migrate -- --apply` (ver CLAUDE.md → "Migrations do banco") —
nunca à mão. O usuário pediu (2026-09-29) que isso rode automaticamente:
depois de `git pull` com migration nova e logo após criar uma. Rode antes
`npm run db:migrate` (status) e leia o que ele diz; se parar com "já existe"
ou "parcial", investigue antes de `--mark-applied`.

## Testar rotas autenticadas sem login
A maioria das rotas fica em `/[slug]/(admin)/...` e exige sessão (Supabase
Auth via cookies) — não dá pra testar com `curl` puro. Sem credenciais de
teste à mão, a abordagem que funcionou:
1. Confirmar que a rota redireciona pra `/login` quando não autenticado
   (`curl -s -o /dev/null -w "%{http_code} %{redirect_url}"`) — garante que
   o gate de auth está ativo.
2. Simular a lógica das server actions diretamente via `psql` (ex.: inserir/
   revogar um token do jeito que a action faria) pra validar a lógica de
   banco sem precisar de UI logada.
3. Testar via `curl` qualquer rota **pública** de verdade (fora do grupo
   `(admin)`, ex. `/{slug}/carteirinha/{token}`, `/{slug}/escola/...`,
   `/{slug}/formulario/...`) — essas não exigem login e dão sinal real do
   fluxo ponta a ponta (RPC → página → HTML renderizado).

## Padrão útil: RPCs SECURITY DEFINER
Pra validar uma RPC nova isoladamente antes de testar via página:
```bash
psql "$DATABASE_URL" -t -c "select minha_funcao('arg');"
```
Achei um bug real assim (função declarada `stable` que fazia `UPDATE`
dentro — Postgres rejeita). Mais rápido que descobrir via página 500.

## Multi-tenant
Só existe uma organização real hoje: slug `jocum-almirante-tamandare`. Pra
testar toggles por organização (ex. feature flags em `organizations`),
lembrar de reverter o valor original depois do teste (`UPDATE organizations
SET campo = valor_original WHERE slug = '...'`) — é a base real do
usuário, não um ambiente de teste descartável.
