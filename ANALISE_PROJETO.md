# Análise do Projeto SISGO

**Data:** Junho de 2026  
**Stack:** Next.js 15 · React 19 · TypeScript · Supabase · Tailwind CSS

---

## 1. Visão Geral

O SISGO é um sistema de gestão multi-tenant voltado para **bases/organizações missionárias e igrejas**. Cada organização tem seu próprio contexto acessado pelo slug na URL (`/{slug}/...`), com papéis de usuário granulares, módulos operacionais e integração com gateways de pagamento brasileiros.

---

## 2. Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15.3.3 (App Router, RSC por padrão) |
| Linguagem | TypeScript 5 |
| Banco de dados | Supabase (PostgreSQL + Auth + Storage) |
| Estilo | Tailwind CSS 3 |
| Imagens | Sharp |
| E-mail | Nodemailer |
| Pagamentos | Asaas, MercadoPago, PagBank (PIX) |
| Implantação | Compatível com Vercel/Edge |

---

## 3. Arquitetura

### 3.1 Estrutura de Rotas

```
/                        → Redirecionamento/landing
/login                   → Autenticação Supabase
/auth/callback           → OAuth callback
/superadmin/...          → Painel global (superadmin)
/[slug]/(admin)/...      → Painel da base (todos os papéis)
/[slug]/escola/[slug]/   → Página pública de inscrição
/[slug]/verificar-email/ → Verificação de e-mail
/api/payments/.../webhook → Webhooks de cobrança PIX
```

A pasta `/src/app/admin/` contém páginas legadas/template que parecem não estar em uso ativo — é um ponto de atenção.

### 3.2 Multi-tenancy

- Cada organização possui um `slug` único.
- O layout `[slug]/(admin)/layout.tsx` é o hub central: resolve o papel do usuário, calcula pendências e monta a navegação antes de renderizar qualquer página.
- Isolamento de dados garantido por RLS no banco de dados, não apenas no código.

### 3.3 Separação de Clientes Supabase

| Cliente | Arquivo | Uso |
|---|---|---|
| `createClient()` | `lib/supabase/server.ts` | Componentes servidor — respeita RLS |
| `createClient()` | `lib/supabase/client.ts` | Componentes cliente |
| `createAdminClient()` | `lib/supabase/admin.ts` | Server Actions com `service_role` — bypassa RLS |
| `asLooseClient()` | `lib/supabase/loose-client.ts` | Tabelas sem tipagem em `database.ts` |

O padrão de usar `createAdminClient()` apenas em Server Actions (`'use server'`) está corretamente aplicado.

---

## 4. Módulos do Sistema

### 4.1 Pessoas
Entidade central (`people`). Suporta contatos, documentos, histórico de status (visitante, candidato, aluno, obreiro, voluntário, associado, inativo). Toda outra entidade do sistema referencia `people`.

### 4.2 Obreiros
Candidaturas (`staff_applications`) com fluxo de status e perfis aprovados (`staff_profiles`).

### 4.3 Escolas / ETEDs
Escolas → Turmas → Alunos. Suporta múltiplos tipos: ETED, UDN, Seminário, Curso Online, Voluntariado. Programas de escola também são suportados.

### 4.4 Inscrições
Formulário público de interesse → conversão em candidatura → aprovação/reprovação com rastreamento de revisor. Inclui formulários de referência (pastor/amigo) com token de acesso de 30 dias.

### 4.5 Ministérios
Membros, papéis, líderes, solicitações de DH com fluxo de aprovação.

### 4.6 Reservas
Reservas de quartos e espaços com formulário configurável, respostas customizadas e notificações por papel.

### 4.7 Cozinha
Operação diária completa: lista de consumidores por refeição/data, configuração de preços, combos com desconto, confirmação de pagamento, integração com financeiro. Acesso ao estoque de ingredientes.

### 4.8 Refeições (auto-serviço)
Qualquer membro pode comprar refeições, fazer upload de comprovante e acompanhar o status de pagamento.

### 4.9 Financeiro
Transações, fundos (irrestrito/designado/restrito), categorias de receita/despesa, orçamentos por período e caixas próprios por escola/ministério (configurável por base).

### 4.10 Configurações
Branding (logo + cor de destaque com CSS variables injetadas dinamicamente), caixas próprios por área, visualização de conta.

### 4.11 Superadmin
Gestão global de bases, usuários por organização, grupos hierárquicos de bases com supervisão delegada via função SQL recursiva `supervised_base_ids`.

### 4.12 Dashboard Adaptativo
O dashboard renderiza conteúdo completamente diferente por papel: superadmin/admin/lider vê visão geral da base + financeiro + turmas; ETED vê turmas e inscrições; cozinha/secretaria vê solicitações da área; aluno/associado vê apenas suas reservas.

---

## 5. Controle de Acesso (RBAC)

### 5.1 Papéis

| Papel | Escopo |
|---|---|
| `superadmin` | Acesso total a todas as bases |
| `supervisor_bases` | Acesso às bases supervisionadas (hierárquico) |
| `admin_base` / `lider_base` | Gestão completa da organização |
| `dh` | Departamento humano |
| `secretaria` | Operações administrativas + cozinha |
| `hospitalidade` | Reservas de quarto + solicitações |
| `cozinha` | Módulo de cozinha e estoque |
| `lider_eted` / `obreiro_eted` | Escolas e turmas vinculadas |
| `lider_ministerio` / `obreiro_ministerio` | Ministério vinculado |
| `aluno` / `associado` | Acesso pessoal (reservas, refeições) |

### 5.2 Role Preview (Impersonation)
O superadmin pode simular qualquer papel/escola/ministério via `lib/role-preview.ts` sem trocar de conta. A barra `SuperAdminContextBar` é exibida no topo indicando o contexto ativo.

### 5.3 Departamentos Configuráveis
`department_assignments` na tabela `organizations` permite que cada base mapeie papéis para departamentos (ex: secretaria → hospitalidade), tornando o sistema flexível para estruturas variadas.

---

## 6. Banco de Dados

### 6.1 Volume
- **47 migrations** bem organizadas e incrementais.
- Triggers de `updated_at` para tabelas principais.
- Extensões: `uuid-ossp`, `pgcrypto`.

### 6.2 RLS
Row Level Security ativado em todas as tabelas sensíveis. Funções `SECURITY DEFINER` (`auth_organization_id`, `auth_role`, `is_superadmin`, `user_supervises_organization`) evitam código repetido nas policies. A migration 041 adiciona automaticamente policies de supervisão a todas as tabelas com `organization_id`.

### 6.3 Principais Grupos de Tabelas

| Grupo | Tabelas |
|---|---|
| Core | `organizations`, `roles`, `organization_users` |
| Pessoas | `people`, `person_contacts`, `person_documents`, `person_status_history` |
| Obreiros | `staff_applications`, `staff_profiles` |
| Escolas | `schools`, `school_classes`, `class_students`, `class_staff`, `school_interest_forms` |
| Ministérios | `ministries`, `ministry_roles`, `ministry_members`, `ministry_leaders`, `ministry_pending_requests` |
| Financeiro | `financial_transactions`, `finance_funds`, `finance_categories`, `finance_budgets`, `finance_expense_requests`, `finance_cash_scopes` |
| Cozinha | `kitchen_meal_consumers`, `kitchen_meal_settings`, `kitchen_stock_*`, `kitchen_meal_payment_*` |
| Reservas | `reservations`, `reservation_form_settings` |
| Supervisão | `base_groups`, `base_group_organizations`, `base_group_leaders`, `base_supervisors` |
| Outros | `email_logs`, `contact_verifications`, `reference_forms`, `user_feedback`, `audit_logs` |

---

## 7. Integrações Externas

| Serviço | Uso |
|---|---|
| Supabase Auth | Autenticação e sessão |
| Supabase Storage | Upload de logos e fotos |
| Asaas | Cobrança PIX (sandbox + produção) |
| MercadoPago | Cobrança PIX alternativa |
| PagBank | Cobrança PIX alternativa |
| Nodemailer | E-mails transacionais (verificação, formulários) |

O sistema suporta múltiplos gateways de pagamento com uma interface unificada (`PixChargeInput` / `PixChargeResult`), permitindo que cada organização configure o provedor preferido.

---

## 8. Pontos Fortes

1. **Isolamento correto entre camadas:** Dados públicos via RLS, dados sensíveis via `service_role` restrito a Server Actions.
2. **Migrations incrementais organizadas:** 47 migrations numeradas e bem comentadas tornam a evolução do schema auditável.
3. **Dashboard adaptativo:** Cada papel vê apenas o que é relevante, reduzindo ruído cognitivo.
4. **Supervisão hierárquica com SQL recursivo:** `supervised_base_ids` usa CTE recursiva para suportar grupos aninhados de bases.
5. **Multi-gateway de pagamento:** Interface comum para Asaas, MercadoPago e PagBank.
6. **Accent color dinâmico:** CSS variables injetadas via `<style>` tag no layout permitem branding por base sem build adicional.
7. **Role preview / impersonation:** Superadmin pode testar qualquer papel sem criar contas adicionais.
8. **Formulários de referência com token:** Acesso externo seguro via token temporário de 30 dias.

---

## 9. Riscos e Problemas Identificados

### 9.1 Rota Legada `/admin` (Médio)
A pasta `src/app/admin/` contém páginas completas (alunos, escolas, financeiro, etc.) que parecem ser versão anterior à arquitetura multi-tenant. Pode causar confusão em manutenção futura. **Recomendação:** remover ou documentar explicitamente se ainda for necessária.

### 9.2 Tipagem Incompleta em `database.ts` (Médio)
O arquivo `src/types/database.ts` não cobre tabelas criadas após as primeiras migrations (`kitchen_*`, `finance_*`, `reservations`, `school_interest_forms`, etc.). O workaround `asLooseClient()` funciona mas remove a segurança de tipos. **Recomendação:** gerar os tipos via `supabase gen types typescript` ou atualizar manualmente o arquivo.

### 9.3 Verificação de Papel Duplicada (Baixo-Médio)
A lógica de verificação de papel (`MANAGEMENT_ROLES.includes(role)`, etc.) está duplicada em `layout.tsx`, `dashboard/page.tsx`, `cozinha/page.tsx` e outros. Uma mudança de papel requer atualização em múltiplos arquivos. **Recomendação:** centralizar em `lib/auth/permissions.ts`.

### 9.4 Ausência de Testes (Alto)
Nenhum arquivo de teste foi encontrado no projeto. Com Server Actions manipulando dados financeiros, refeições e pagamentos, a ausência de testes representa risco real. **Recomendação:** iniciar com testes de integração para as Server Actions críticas (pagamentos, financeiro).

### 9.5 Sem `.env.example` (Baixo)
Não há arquivo documentando quais variáveis de ambiente são necessárias. **Recomendação:** criar `.env.example` listando `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, credenciais de pagamento, SMTP, etc.

### 9.6 `(supabase as any)` no Dashboard (Baixo)
Uso de `as any` na query de `financial_transactions` no dashboard indica que a tabela não está tipada. Resolve-se ao atualizar `database.ts` (item 9.2).

---

## 10. Recomendações Prioritárias

| Prioridade | Ação |
|---|---|
| Alta | Adicionar testes para Server Actions financeiras e de pagamento |
| Alta | Atualizar `database.ts` com todas as tabelas (ou usar `supabase gen types`) |
| Média | Centralizar lógica de verificação de papéis em `lib/auth/permissions.ts` |
| Média | Remover ou arquivar a pasta `src/app/admin/` legada |
| Baixa | Criar `.env.example` |
| Baixa | Extrair lógica de cálculo de pendências do layout em um helper separado |

---

## 11. Resumo Executivo

O SISGO é um sistema bem estruturado e funcionalmente rico para o domínio que atende. A arquitetura multi-tenant está corretamente implementada com isolamento de dados via RLS, o controle de acesso por papel é granular e flexível, e as 47 migrations refletem um desenvolvimento iterativo organizado.

Os principais pontos de atenção são a ausência de testes automatizados (especialmente em módulos financeiros e de pagamento), a tipagem incompleta do banco de dados que reduz a segurança estática do TypeScript, e alguma duplicação na lógica de verificação de papéis. Nenhum problema crítico de segurança foi identificado na estrutura analisada.

O projeto está bem posicionado para crescimento, desde que os gaps de cobertura de testes sejam endereçados antes de expansões significativas nos módulos financeiros e de pagamento.
