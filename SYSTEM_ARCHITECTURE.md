# SISGO — Arquitetura do Sistema

**Atualizado:** 10 de agosto de 2026 — sessão longa de correções de escopo/
permissão (empurrar usuário sem base + `pendente_alocacao`; acúmulo de
papéis no menu e em Hospedagem; líder de ETED vendo candidatos/inscrições
de escolas que não lidera; líder de escola/seminário com mais edição) e do
formulário de escola/seminário (informações de pagamento + comprovante
obrigatório antes do envio; toggles de campo da seção 5 que não faziam
nada; data/horário de saída/chegada; documento único obrigatório) e
**link único de matrícula pra Seminário** — pula só a pré-inscrição
(candidato vai direto pro formulário completo, nova rota
`/escola/{schoolSlug}/turma/{classId}/matricula`); a aprovação continua
manual, igual ETED (`enrollStudent`, botão "Aceitar aluno"). Detalhes nas
seções 4 e 5. **Nota:** a migration 114 tentou criar um papel `comunicacao` formal
por diagnóstico errado e foi revertida pela 115 no mesmo dia. **13 de
agosto:** Seção 1 passa a pedir Nome (era e-mail) e o e-mail migrou pra
Seção 5, ao lado do celular; upload de documentos (Seção 15, e também
Seções 03/10 do formulário de obreiro) tinha um bug antigo que descartava
o arquivo em vez de salvar — corrigido com buckets próprios
(`application-documents` migration 118, `staff-application-documents`
migration 119) igual ao comprovante de pagamento, com card de
visualização nas duas telas de inscrição; painel de Referências
(pastor/amigo) também corrigido pra não aparecer em escolas/seminários
que escondem essas seções do formulário; e "Histórico de recusas e
exclusões" em `/inscricoes` (que não tinha o mesmo escopo por
escola/ministério da lista principal) corrigido do mesmo jeito; e menu
lateral dos papéis restritos (hospitalidade/cozinha/manutenção/
obreiro_ministério/obreiro_eted/aluno/associado) passa a crescer
conforme a pessoa acumula novas funções, em vez de ficar travado na
lista fixa do papel principal.
**Produção:** https://www.sisgomission.com (Vercel)

---

## 1. Visão Geral

O SISGO é um sistema de gestão **multi-tenant** para bases missionárias da JOCUM e igrejas. Cada organização (base) vive sob um slug na URL (`/{slug}/...`) e tem seus próprios usuários, papéis, módulos e dados — isolados por Row Level Security no PostgreSQL.

---

## 2. Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15.5 (App Router, React Server Components, Server Actions) |
| UI | React 19 · Tailwind CSS 3 · lucide-react · sonner (toasts) |
| Linguagem | TypeScript 5 |
| Banco / Auth / Storage | Supabase (PostgreSQL com RLS) |
| Mobile | Capacitor 8 (Android + iOS, push nativo, biometria) |
| Push | Firebase Admin (FCM) + tokens em `push_tokens` |
| E-mail | Brevo via API REST v3 (`fetch` direto, sem lib — não é SMTP/Nodemailer) |
| Pagamentos | Asaas · Mercado Pago · PagBank (PIX) — `src/lib/payments/` |
| IoT | Shelly Cloud Control API v2 (lavanderia) — `src/lib/laundry/` |
| QR / Códigos | qrcode (carteirinha digital) · barcode-detector (estoque) |
| Deploy | Vercel (deploy automático a cada push na `main`) |

---

## 3. Estrutura de Rotas

```
/                         → Landing; redireciona usuário logado ao painel certo
/login, /cadastro, /auth  → Autenticação (Supabase Auth, OAuth com callback)
/bases                    → Diretório público de bases
/superadmin/...           → Painel global (papel superadmin)
/supervisor/...           → Painel de supervisão de bases (supervisor_bases)

/[slug]                   → Página pública da base
/[slug]/(admin)/...       → Painel da base (requer sessão + papel na org)
/[slug]/escola/...        → Inscrições públicas de escolas
/[slug]/formulario*/...   → Formulários públicos (obreiros etc.)
/[slug]/carteirinha/...   → Verificação pública da carteirinha digital
/[slug]/lavanderia        → Painel público da lavanderia (QR code)
/[slug]/referencia, /servir, /verificar-email → Fluxos públicos diversos

/api/public/[slug]/*      → API pública JSON (info, events, schools, stats)
                            com CORS — consumida pelo site institucional
                            (projeto jocumat-site, repositório separado)
/api/payments/*           → Webhooks e criação de cobranças
/api/push/*               → Registro e processamento de push
/api/auth/native-callback → Passthrough do OAuth nativo (deep link sisgo://)
```

### Módulos do painel `(admin)`

`dashboard` · `pessoas` · `obreiros` · `alunos` · `escolas` · `inscricoes` ·
`ministerios` (workspace com mural, equipe e calendário) · `calendario` ·
`comunicacao` (anúncios e eventos de base com audiência por papel — lider_base
e Ministério de Comunicação) · `presenca` · `pendentes` · `financeiro` ·
`caixa` · `minhas-contas` · `cozinha` · `refeicoes` · `reservas` ·
`manutencao` · `configuracoes` ·
`conta` (perfil pessoal — nome, foto com recorte, senha, contas
conectadas — aberto a qualquer usuário logado, sem checagem de papel) ·
`minha-carteirinha` · `minha-lavanderia` (lavanderia como cliente, para
qualquer usuário logado) · `hospedagem` (quartos/camas, agenda, **lavanderia**)

---

## 4. Autenticação e Autorização

- **Sessão:** Supabase Auth com cookies via `@supabase/ssr`. O `middleware.ts`
  (→ `src/lib/supabase/middleware.ts`) valida/renova o JWT em toda requisição
  de página, limpa cookies de refresh token inválido e faz o roteamento por
  papel (superadmin → `/superadmin`, supervisor → `/supervisor`, demais →
  `/{slug}/pessoas`). **Exceção deliberada:** requisições de Server Action
  (`POST` com header `next-action`) pulam esse `getUser()` e retornam direto
  — cada Server Action já valida a própria sessão via `createClient()`
  (`src/lib/supabase/server.ts`); chamar o Supabase de novo no meio do
  middleware virava ponto único de falha (qualquer soluço de rede quebrava
  a Server Action inteira, cliente via "resposta do servidor interrompida").
  Esse bypass tem que vir **antes** de qualquer chamada de rede no
  middleware, não só antes do roteamento por papel.
- **OAuth mobile:** PKCE client-side + rota passthrough + deep link `sisgo://`
  (nunca server action para OAuth no app nativo).
- **Papéis (RBAC):** tabela `roles` + `organization_users` liga usuário↔org↔papel.
  Papéis principais: `superadmin`, `supervisor_bases`, `admin_base`, `lider_base`,
  `dh`, `hospitalidade`, `lider_eted`, entre outros. Helpers em
  `src/lib/auth/permissions.ts` (`isManagementRole`, `canSeeHospedagem`, ...).
- **Usuário sem base → `pendente_alocacao`:** `/superadmin/inscricoes`
  ("Inscrições Soltas") lista quem criou conta mas nunca ficou vinculado a
  nenhuma `organization_users`. O botão "→ Nome da Base"
  (`pushUserToBase` em `superadmin/inscricoes/actions.ts`) cria essa linha
  com o papel provisório `pendente_alocacao` (sem permissão nenhuma) +
  `people`/`staff_profiles` (área/função em branco) e enfileira o evento de
  notificação `staff_assigned` — o DH da base recebe um push pra definir
  área e função pelo Quadro de Obreiros (`/{slug}/obreiros`), onde a pessoa
  aparece destacada em âmbar e já com o formulário aberto até isso ser
  feito. **Antes disso o botão só navegava, sem vincular nada** — era um
  link decorativo; a atribuição de verdade não existia.
- **Notificações** (`notification_events` → `notification_logs`, processado
  por cron a cada minuto em `/api/push/process` → `processNotificationEvents`
  em `src/lib/notifications/process-events.ts`): destinatários vêm de
  `getRecipientUserIds` (`src/lib/notifications/recipients.ts`), que resolve
  gestão (`superadmin`/`admin_base`/`lider_base`/`dh`) e departamentos
  (`manutencao`/`hospitalidade`/`secretaria`) da organização.
  **`organization_users.role_id` é `uuid` (FK pra `roles.id`), não o nome do
  papel** — o filtro `.in('role_id', [...])` precisa primeiro resolver os
  nomes pra ids via `roles`; comparar direto com strings tipo `'dh'` nunca
  bate com nada e a notificação nunca chega a ninguém, silenciosamente (bug
  que existia desde a criação do arquivo — nenhum evento de gestão jamais
  notificou ninguém até ser corrigido).
- **Role preview:** administradores podem visualizar o sistema como outro papel
  (`src/lib/role-preview.ts`).
- **Acúmulo de papéis** — uma pessoa tem UM papel principal
  (`organization_users.role_id`, o que define "em que trilha" ela está:
  `lider_eted`, `dh`, `obreiro_ministerio` etc.), mas pode enxergar módulos
  extras de três formas que se somam, todas resolvidas por request (sem
  cache) em `getCurrentOrganizationRole`/`layout.tsx`:
  1. `organizations.role_accumulations` (jsonb `{papel: [papéis...]}`,
     configurável em `/{slug}/configuracoes`) — regra **da base inteira**,
     vale pra todo mundo com aquele papel principal.
  2. `organization_users.extra_roles` (array por pessoa) — "Funções
     adicionais" no Quadro de Obreiros, editado manualmente pelo DH.
  3. `ministries.linked_role` — um Ministério (`/{slug}/ministerios/nova`)
     pode ser "vinculado" a um papel do sistema (`hospitalidade`,
     `secretaria`, `dh`, `cozinha`, `manutencao`, `comunicacao`); qualquer
     `ministry_leaders`/`ministry_members` **ativo** daquele ministério
     ganha esse papel dinamicamente (`linkedRoles` em `layout.tsx`), sem
     precisar virar o papel principal de ninguém — dá pra ser líder de
     ETED (principal) e também estar no Ministério de Hospitalidade
     (linked_role) ao mesmo tempo.
  - `buildNav` (`src/app/[slug]/(admin)/layout.tsx`) monta o menu a partir
    de `[role, ...accumulatedRoles, ...extraRoles, ...linkedRoles]`. **Bug
    corrigido:** as ramificações de menu restrito (Hospitalidade, Cozinha,
    Manutenção, Obreiro de Ministério, Obreiro de Escola, Aluno/Associado)
    entravam checando esse conjunto todo (`is(role)`) em vez de só o papel
    principal — então quem acumulava, digamos, `hospitalidade` por um
    ministério vinculado caía inteiro no menu estreito de Hospitalidade e
    **perdia** o menu do próprio papel principal (Escolas, Inscrições...).
    Essas ramificações agora só entram por `role === '...'` (papel
    principal exato); o acesso acumulado continua sendo somado no menu
    completo pelas flags `show:` de cada item, que já usavam o conjunto
    certo.
  - **13 de agosto — a lista fixa dessas ramificações restritas não
    crescia com papéis acumulados:** o `pick(...)` de cada ramificação
    (Hospitalidade, Cozinha, Manutenção, Obreiro de Ministério, Obreiro de
    Escola, Aluno/Associado) filtra `all` só por href, ignorando o `show:`
    de cada item — então mesmo sendo o papel principal certo, se a pessoa
    acumulasse depois uma função nova (ex.: virar membro de um ministério
    com `linked_role`), o item que aquela função libera nunca entrava,
    porque não estava na lista fixa. **Confirmado em produção:** um
    obreiro de ministério (papel principal) que também é membro do
    Ministério "Comunicação" (`linked_role='comunicacao'`) nunca via o
    item "Comunicação" no menu, apesar de `is('comunicacao')` já dar
    `true` pra ele. Corrigido com `withAccumulatedExtras(narrow)` — soma
    ao final da lista fixa qualquer item de `all` cujo `show` seja `true`
    e que ainda não esteja nela; os itens amplos (Pessoas, Financeiro,
    Configurações) continuam de fora pra papel restrito puro porque seus
    `show:` dependem de `isManagement` (calculado só a partir do papel
    principal) ou de papéis específicos, não do acúmulo em si.
  - **Ministério com `linked_role` não sincronizava nada** — vira membro/
    líder de um ministério vinculado dava acesso ao módulo (via
    `linkedRoles`, dinâmico, ponto acima), mas quem ainda estava
    `pendente_alocacao` continuava aparecendo assim no Quadro de Obreiros/
    Pessoas, com área em branco. `addMember`
    (`ministerios/[id]/actions.ts`) agora promove esse caso específico —
    só quando o papel atual é o placeholder `pendente_alocacao` — pro
    papel vinculado, preenchendo `staff_profiles.area`/`role_title`; quem
    já tem um papel real não é tocado (o acesso extra já vem certo via
    `linkedRoles`). Essa promoção só acontece se existir uma linha em
    `roles` com esse nome — **não** existe pra `comunicacao` de propósito
    (ver "Comunicação da Base" abaixo); uma migration 114 tentou criar
    essa linha por engano (achou que era preciso pro módulo funcionar,
    quando na verdade já funcionava só com o texto em
    `ministries.linked_role`) e foi revertida pela 115, porque teria
    deixado `comunicacao` virar papel principal de quem está
    `pendente_alocacao` — o oposto do design ministério-escopado.
  - **`assignSchoolLeader`** (atribuir líder de escola/seminário,
    `escolas/[id]/actions.ts`) troca o papel principal pra `lider_eted`
    mas, até essa correção, nunca preenchia `staff_profiles.area` —
    ficava sem área no card e o seletor de área nascia vazio ao editar a
    função depois. Agora preenche área (nome da escola) + função
    ("Líder"), no mesmo padrão que `confirmTransferAsDH` já usava pra
    transferência entre ministérios.
  - **`getCurrentOrganizationRole`** (`src/lib/auth/org-role.ts`) agora
    também calcula `linkedRoles`/`allRoles` (mesmo cálculo de
    `ministry_leaders`/`ministry_members` → `ministries.linked_role` que
    antes só existia dentro de `layout.tsx`, duplicado pro menu). Motivo:
    as 5 páginas do módulo Hospedagem (`hospedagem`, `hospedagem/quartos`,
    `hospedagem/quartos/[roomId]`, `hospedagem/lavanderia`,
    `hospedagem/lavanderia/historico`) tinham cada uma sua própria query
    ad-hoc em `organization_users` + `canSeeHospedagem(role)` só com o
    papel principal — então o item "Hospedagem" já aparecia certo no menu
    pra quem tinha o papel só por acumulação (ex.: líder de ETED que
    também lidera o Ministério de Hospitalidade vinculado), mas clicar
    caía em `notFound()`, porque a página nunca soube desse acesso
    acumulado. As 5 agora usam `getCurrentOrganizationRole` +
    `userHasAnyRole(allRoles, HOSPEDAGEM_ROLES)`. **Padrão a repetir:**
    qualquer página nova que faça sua própria query de papel em vez de
    usar esse helper corre o mesmo risco — nunca reimplementar a checagem
    de permissão do zero.
  - **Líder de escola/seminário com acesso mais completo** — a visão de
    líder de ETED em `escolas/[id]/configuracoes` era deliberadamente
    mais enxuta que a de gestão: só lia nome/subtítulo/tipo, não criava
    turma nova, não editava descrição pública/e-mail/visibilidade. Por
    pedido do usuário (decisão de produto, não bug), o líder passou a ter
    os mesmos formulários de "Informações gerais", "Conteúdo público",
    "Visibilidade", "E-mail da escola" e "Nova turma" que a gestão já
    tinha — reaproveitando as mesmas server actions (`updateSchool`,
    `updateEmail`, `createTurma`), sem checagem de papel adicional dentro
    delas (a página já garante que o líder só acessa a escola que
    lidera). Ficam exclusivos de gestão, por decisão consciente: atribuir/
    trocar/remover o próprio líder da escola, e adicionar obreiro sem
    passar pela aprovação do DH (o líder continua só podendo "solicitar").
  - **Escopo de `/{slug}/inscricoes` por papel** (`roleFiltered` em
    `inscricoes/page.tsx`): líder de ETED só devia ver `pre_inscricao`
    (interesse) e `obreiro`/`pre_inscricao_obreiro` da(s) escola(s) que
    lidera (`allowedSchoolIds`, de `school_leaders`) — o comentário no
    código já dizia "aluno e obreiro", mas o filtro nunca checava o tipo
    `aluno` (candidato com `student_applications` completo), que caía no
    `return true` final e vazava candidatos de **qualquer** escola da
    base pra qualquer líder de ETED. Bug pré-existente (não introduzido
    nas correções desta sessão), só apareceu com a primeira líder de
    ETED de verdade testando com candidatos de escolas diferentes. Líder
    de Ministério (`isLiderMinisterio`) já filtrava certo — só não tinha
    o mesmo espelhamento pro lado de ETED.
- **RLS:** toda tabela de negócio tem policies por organização e papel. Server
  actions administrativas usam `createAdminClient()` (service role) após checar
  permissão na aplicação.
- **Conta pessoal (`/{slug}/conta`, `src/app/[slug]/(admin)/conta/`):**
  self-service para qualquer usuário logado (sem checagem de papel — igual a
  `minha-carteirinha`/`minha-lavanderia`). Nome e avatar ficam em
  `user_metadata` (`full_name`, `avatar_url`); troca de senha reautentica com
  `signInWithPassword` antes de `updateUser({ password })`; conexão com Google
  usa `auth.linkIdentity`/`unlinkIdentity` (client-side, exige **Manual
  Linking** habilitado no Supabase Dashboard) — só permite desvincular se
  sobrar outra forma de entrar. Foto de perfil: recorte circular
  arrastável/zoom no client (`AvatarCropperModal`, canvas puro, sem lib
  externa), convertida para WebP antes do upload ao bucket `avatars`
  (Storage, público para leitura, escrita restrita à própria pasta
  `auth.uid()/`). Trocar ou remover a foto apaga o arquivo antigo do bucket
  (sem resíduo). Retorno do fluxo de vinculação do Google usa
  `/auth/callback?next=<path>` (o callback normal só redireciona por papel;
  `next` é validado como path relativo antes de ser usado).
- **Comunicação da Base (`/{slug}/comunicacao`) e início do aluno:** novo
  módulo para `lider_base` + membros/líderes do Ministério de Comunicação
  criarem anúncios (`base_announcements`) e eventos de base
  (`base_calendar_events`) com audiência granular por papel
  (`visible_to_roles text[]`, `null` = todos, opções em
  `src/lib/audience-roles.ts`). A tela "Início" do aluno foi reformulada
  (sem card de Reservas) com versículo do dia, anúncios da base filtrados
  pela audiência e "Próximos eventos" (base + escola, via
  `school_calendar_events.visible_to_students`, padrão visível).
  **Padrão de permissão reaproveitado:** `ministries.linked_role` ganhou o
  valor `'comunicacao'`, mas — diferente de Hospitalidade/Secretaria/
  Cozinha/Manutenção/DH — **não** virou um `Role` formal no enum de
  `src/lib/auth/permissions.ts`; o acesso é resolvido por participação no
  ministério (`ministry_leaders`/`ministry_members`), não por papel
  principal. Útil como padrão para futuras permissões "ministério-scoped"
  sem inflar o enum de `Role`. `src/lib/school-scope.ts` resolve as escolas
  em que um usuário aluno está matriculado (via `student_profiles`/
  `person_contacts`/`class_students`/`student_applications`), usado para
  filtrar os eventos de escola que aparecem no início dele.
- **Busca global** (painel "Ver tudo", `src/components/layout/AllAppsMenu.tsx`
  + `src/lib/search/global-search.ts`): duas camadas independentes, não uma só.
  1. **Atalho de menu** — filtro client-side sobre a lista de navegação, com
     match tolerante a acento e letra fora de ordem (`matchesLabel`, tipo
     busca de comando de editor) mais um dicionário curado de sinônimo por
     ícone (`ICON_KEYWORDS`, ex. "lavadoura"/"lavadora" → Lavanderia,
     "ausência"/"chamada" → Presença) — necessário porque o nome de uma
     funcionalidade (ex. "Declarar ausência") não é registro de banco, não
     tem como "buscar de verdade". Usa a lista *completa* de atalhos
     (`searchNavItems`, calculada em `layout.tsx` sem o filtro de complemento
     que a grade de navegação aplica), não só o que falta na sidebar atual —
     senão um atalho já fixo na sidebar ficaria invisível pra busca.
  2. **Conteúdo real** — server action `globalSearch(slug, query)`, dispara a
     partir de 2 caracteres (debounce 300ms). Resolve o papel do usuário com
     `getCurrentOrganizationRole` (o mesmo helper de `/escolas`,
     `/ministerios`, `/calendario` — nunca confia em nada vindo do cliente) e
     busca por nome/título/conteúdo em Pessoas, Escolas, Turmas, Ministérios,
     Inscrições, Calendário (`base_calendar_events`/`school_calendar_events`/
     `ministry_calendar_events`/`personal_calendar_notes`), Reservas,
     Solicitações (`service_requests`, escopado por
     `organizations.department_assignments`) e Mensagens de mural
     (`ministry_messages`) — cada bloco só roda e só é visível se aquele
     papel já teria acesso àquela tela, escopado (escola do líder de ETED,
     ministério do líder de ministério, departamento da hospitalidade/
     manutenção/secretaria etc.) com o mesmo padrão de `.in('col', ids.length
     ? ids : ['no-match'])` já usado nas páginas de origem — replicado, nunca
     reinventado. Sem rota de detalhe por item (reservas, solicitações), o
     resultado linka pra lista; calendário linka pro ano do evento
     (`?ano=`); inscrições pré-preenchem a busca da própria página (`?q=`).

---

## 5. Banco de Dados

- **Migrations:** `supabase/migrations/NNN_nome.sql`, numeradas (001→112+),
  aplicadas manualmente com `psql "$DATABASE_URL" -f <arquivo>` (a
  `DATABASE_URL` está em `.env.local`). Não há CLI do Supabase configurada.
  Banco único — é produção mesmo, sempre confirmar com o usuário antes de
  rodar.
- **Storage buckets:** `logos` (branding da org) e `avatars` (foto de perfil
  pessoal, migration 108) — ambos públicos para leitura; escrita restrita a
  usuários autenticados (avatars: só na própria pasta, via policy em
  `storage.foldername(name)[1] = auth.uid()`).
- **Domínios principais:** pessoas/contatos, escolas e inscrições
  (`school_interest_forms` = pré-inscrição; `school_applications` = formulário
  completo com `form_data` jsonb), ministérios (com `linked_role`), hospedagem
  (quartos, camas, alocações), lavanderia (`laundry_machines`,
  `laundry_pricing`, `laundry_sessions`, `laundry_device_models`), financeiro,
  cozinha/refeições, estoque com código de barras, calendários
  (`base_calendar_events`, `ministry_calendar_events`), mural de mensagens,
  push (`push_tokens`).
- **Regra de ouro:** registros nunca são apagados — inscrições/pessoas são
  **realocadas** ou inativadas, preservando histórico.
- **Recusa × Exclusão em inscrições:** desde a migration 109, as 4 tabelas de
  inscrição (`school_interest_forms`, `staff_interest_forms`,
  `student_applications`, `staff_applications`) aceitam um status `excluido`
  além do `descartado`/`reprovado` já existente — "Recusar" (candidato
  avaliado e não aceito) e "Excluir" (cadastro errado, duplicado) são ações
  distintas na UI (`RecusarModal`/`ExcluirModal` em
  `src/app/[slug]/(admin)/inscricoes/RecusarModal.tsx`) e agora gravam status
  diferente — mesma server action (`recusar`, com um campo `kind`), mesmo
  motivo obrigatório, mesma regra de nunca apagar.
- **`schools.school_type` ≠ `type` nos tipos gerados:** `src/types/database.ts`
  lista essa coluna como `type`, mas a coluna real no banco é `school_type`
  (migration 003) — o arquivo de tipos está desatualizado nesse ponto.
  Confiar nele sem checar `\d schools` já causou um bug real (insert de nova
  escola em `escolas/nova/page.tsx` gravava numa coluna inexistente e falhava
  em silêncio, sem nunca redirecionar). Sempre conferir a coluna de verdade
  (`psql "$DATABASE_URL" -c "\d schools"`) antes de confiar nesse arquivo
  pra essa tabela especificamente.
- **Escolas ficam mais leves com "Seminários":** `school_type='seminario'`
  agora tem grupo e seção próprios em `/escolas` (`schoolTypeGroup`/
  `schoolTypeShortLabel` em `src/lib/schools.ts`), separado de "Escolas de
  2º Nível". O formulário de inscrição (`FormularioInscricao.tsx`) fica
  configurável por escola via `schools.form_config.hidden_fields`
  (mecanismo já existente, `escolas/[id]/formulario/page.tsx`): além de
  esconder campo por campo, dois marcadores sintéticos novos permitem
  esconder blocos inteiros — `s8.pastor_bloco` (some com todo o bloco de
  referência de pastor, título/aviso incluídos) e `sX.oculto` (pula a etapa
  X inteira do assistente, ex. `s9.oculto` pra Referência de Amigo). A
  validação de "e-mail ou telefone do pastor obrigatório" em `handleNext`
  respeita `s8.pastor_bloco` — não trava mais o envio quando o bloco está
  escondido.
- **Informações de pagamento + comprovante obrigatório:** mesma tela
  (`escolas/[id]/formulario/page.tsx`, mesma permissão — inclui
  `lider_eted`) ganhou um texto livre salvo em
  `schools.form_config.payment_info` (chave nova no mesmo jsonb, sem
  migration) — vale pra qualquer escola, não só `school_type='seminario'`,
  e só aparece se o líder preencher. Quando preenchido, o comprovante de
  pagamento passa a ser **obrigatório antes do envio de verdade**: ao
  terminar a última seção visível, se `payment_info` existir, o
  componente (`FormularioInscricao.tsx`) não chama `enviarFormulario`
  ainda — mostra `PaymentGateScreen` (informações de pagamento + upload
  `required` de imagem/PDF até 10MB); só depois do upload dar certo é que
  `enviarFormulario` é chamado e a inscrição é marcada `status='enviado'`.
  `anexarComprovante` (`actions.ts`) por isso aceita aplicação ainda em
  `'rascunho'` (não só `'enviado'+`) — o comprovante é anexado ANTES do
  status mudar. Valida token/base/tipo/tamanho, grava no bucket privado
  `payment-receipts` e salva metadados/caminho em
  `school_applications.form_data.payment_receipt`; a equipe abre o
  arquivo na visualização da inscrição por URL assinada (1h). Escolas sem
  `payment_info` configurado não passam por essa tela — comportamento
  idêntico ao de antes (envia direto).
  - **24 de agosto — bug real, achado investigando "inscrições não estão
    chegando" no Seminário de Hospitalidade:** `awaitingPayment` (o que
    decide se `PaymentGateScreen` aparece) era só `useState(false)` — client
    state, não persistido em lugar nenhum. Quem terminava a última seção do
    formulário, entrava na tela de pagamento e depois perdia a conexão,
    fechava a aba ou tinha o navegador recarregado em segundo plano (comum
    em celular) voltava, ao reabrir o mesmo link, pra ÚLTIMA SEÇÃO do
    formulário (já toda preenchida) em vez da tela de pagamento — confuso o
    bastante pra a pessoa desistir sem entender que faltava um passo.
    **Confirmado em produção:** duas candidatas reais (Suelen Waltrick,
    Micheli Karal Tondin) preencheram o formulário inteiro até a Seção 16
    (aceite final, todos os checkboxes marcados) mas nunca tiveram
    `form_data.payment_receipt` nem `enviarFormulario` chamado —
    `school_applications.status` ficou em `'rascunho'` pra sempre, então
    nunca vira uma `school_interest_forms`/aparece em `/inscricoes` (só é
    criada dentro de `enviarFormulario`). Corrigido inicializando
    `awaitingPayment` a partir do estado salvo: se `payment_info` existe,
    não tem `form_data.payment_receipt` ainda, e `current_section` já é a
    última seção visível, a tela de pagamento aparece direto ao reabrir o
    link — sem precisar preencher nada de novo. Os links dessas duas
    candidatas ainda são válidos (expiram só em setembro), então elas
    conseguem terminar reabrindo o mesmo link, sem reenviar nada.
  - **Observação separada, não corrigida ainda:** a rota pública do link
    único de matrícula (`/escola/{schoolSlug}/turma/{classId}/matricula`)
    cria uma `school_applications` nova a CADA acesso, sem distinguir
    visita real de crawler de preview de link (WhatsApp/Telegram/etc. —
    comuns quando o líder compartilha o link em grupo). No caso do
    Seminário de Hospitalidade isso gerou ~64 rascunhos travados na Seção 1
    (nunca preenchidos) — não afeta candidatos reais, só suja o banco.
- **Toggles de campo da seção 5 não faziam nada — bug real, corrigido:**
  a tela de configuração (`escolas/[id]/formulario/page.tsx`) sempre
  listou `estado_civil`, `servico_militar`, `rg`, `cpf`, `passaporte`,
  `trabalha`, `experiencias`, `habilidades`, `instagram`, `facebook`,
  `linkedin`, `outros_links` como campos ocultáveis, mas o componente do
  formulário (`FormularioInscricao.tsx`) nunca tinha o wrapper `<H id="...">`
  correspondente pra a maioria deles — desmarcar o checkbox na config não
  tinha efeito nenhum no formulário público. Corrigido campo a campo.
  Endereço e redes sociais viraram blocos inteiros ocultáveis de uma vez
  (`s5.endereco_bloco`, `s5.redes_bloco`, mesmo padrão de `s8.pastor_bloco`)
  em vez de campo a campo. Documento passa a exigir só **um** entre
  RG/CPF/Passaporte (antes RG+CPF eram os dois obrigatórios pra
  brasileiro) — validação customizada em `handleNext`, que também respeita
  quais desses três a escola escondeu (se os três estiverem escondidos,
  não exige nada). O upload de documentos (seção 15) passa a pedir só
  o(s) documento(s) que a pessoa de fato preencheu na seção 5, em vez de
  todos com base só em nacionalidade. Seções 6 (Histórico pessoal) e 7
  (Família) ganham suporte a `oculto` (etapa inteira) — reaproveita o
  filtro genérico por número de seção que 9/11/13/14 já tinham, sem
  precisar mexer nos componentes `S6Historia`/`S7Familia`. Seção 4 ganha
  "Data prevista de saída"/"Horário previsto de saída" ao lado da "Data
  de chegada" que já existia (e que, por sinal, também nunca tinha
  aparecido na tela de configuração até essa correção).
- **Itens do Termo de compromisso (seção 3) configuráveis por escola:**
  os 10 itens de `d.s3.terms` agora podem ser escondidos individualmente
  (`s3.termo_1`...`s3.termo_10`, novo grupo em `CONFIGURAVEL`).
  `S3Termo` filtra pelo `HiddenCtx` **antes** de numerar, pra não deixar
  buraco na numeração exibida (pula de "8." pra "9." corretamente quando
  um item do meio é escondido) — usa `useContext(HiddenCtx)` direto em
  vez do wrapper `<H>`, já que aqui precisa saber quais itens sobraram
  pra recalcular o índice.
- **Pipeline de matrícula de aluno (ETED) — como é hoje:**
  `school_interest_forms` (pré-inscrição, pública e reaproveitável em
  `/escola/{schoolSlug}/inscricao`) → DH/líder aciona
  `DisponibilizarFormularioButton` → `disponibilizarFormulario`
  (`inscricoes/page.tsx`) cria `school_applications` com
  `interest_form_id` + token único (uma pessoa = um token, gerado
  manualmente) → candidato preenche/envia (`enviarFormulario`,
  `formulario/[token]/actions.ts`) → **única ação de conversão pra
  "aluno matriculado" de verdade**: `aprovar(tipo='pre_inscricao')`
  (`inscricoes/page.tsx`), acionada manualmente pelo DH/líder no botão
  "✓ Aceitar aluno" — cria/reativa `student_profiles`, upsert em
  `class_students`, marca `school_interest_forms.status='convertido'`.
  **`school_applications.status` nunca chega a `'aprovado'` nesse
  caminho** (fica em `'enviado'`/`'em_analise'` pra sempre) — quem marca
  "já convertido" é o `school_interest_forms.status`.
  **`student_applications`** (tabela do schema original, migration
  001) **é código morto** — aparece em `/pendentes` e `/inscricoes`
  como "Candidato a Aluno"/tipo `aluno`, mas nenhum `INSERT` acontece
  nela em lugar nenhum do código atual; sempre vazio na prática. Não
  confundir com `school_applications` (é outra tabela).
- **Link único de matrícula pra Seminário — pula só a pré-inscrição, não
  a aprovação:** só pra `schools.school_type = 'seminario'`. Nova rota
  pública `/escola/{schoolSlug}/turma/{classId}/matricula` (sem token na
  URL, reaproveitável — o líder gera um link por turma na tela da turma,
  `DirectEnrollLinkBox`, só aparece se a turma tiver `registrations_open`
  e a escola for pública): cada acesso cria uma `school_applications`
  nova (`rascunho`, **sem** `interest_form_id`) e redireciona pro
  `FormularioInscricao.tsx` de sempre — reaproveita 100% da UI e da
  validação, sem rota/página duplicada. Diferente do fluxo de ETED, o
  candidato nunca preenche um formulário curto separado antes — vai
  direto pro completo. **A partir do envio, porém, o fluxo volta a ser
  idêntico ao de ETED**: `enviarFormulario` detecta `interest_form_id`
  nulo + escola `seminario` e, só nesse momento (não antes), cria o
  `school_interest_forms` (já com `status='em_analise'`, resolvendo/
  criando a pessoa a partir do que ela mesma preencheu —
  `form_data.s1.nome` + `form_data.s5.email`/`celular`, já que não existe
  pré-inscrição por trás pra linkar) e liga de volta em
  `school_applications.interest_form_id`. Isso faz o INSERT dessa
  `school_interest_forms` disparar sozinho a notificação "Nova
  pré-inscrição" já existente (trigger da migration 066) e faz a pessoa
  aparecer em `/inscricoes` exatamente como uma pré-inscrição normal —
  **precisa do DH/líder clicar "✓ Aceitar aluno" pra virar aluno de
  verdade**, mesmo `aprovar()`/`enrollStudent` de sempre, nada de
  matrícula automática.
- **Seção 1 pede Nome, Seção 5 pede E-mail (era o contrário):** a Seção 1
  isolada só com campo de e-mail, logo antes da Seção 5 (que já pedia
  Nome completo) parecia pedir "e-mail duas vezes" pro candidato. Trocado:
  `S1Nome` (era `S1Email`) agora pede nome (`s1.nome`), e o e-mail saiu da
  Seção 1 e entrou na Seção 5 logo após o campo Celular (`s5.email`,
  `FormularioInscricao.tsx`). `findOrCreatePersonFromApplication`
  (`actions.ts`) e as duas telas administrativas de visualizar/editar
  inscrição (`inscricoes/formulario/[id]/page.tsx` e `.../editar/page.tsx`)
  foram atualizadas pra ler dos campos novos, com fallback pro campo antigo
  (`s1.email`/`s5.nome`) nas inscrições enviadas antes da troca.
- **Upload de documentos (Seção 15) nunca era salvo de verdade — bug
  antigo, não desta sessão:** `salvarSecao` grava a Seção genérica inteira
  como jsonb a partir do `FormData`, mas um `File` vira `{}` vazio nesse
  processo — a seção de documentos (foto do rosto, RG frente/verso, CPF,
  passaporte) sempre "enviava com sucesso" sem nunca persistir o arquivo
  em lugar nenhum. Corrigido com o mesmo padrão do comprovante de
  pagamento: nova Server Action `anexarDocumentos` (`actions.ts`) faz
  upload de cada arquivo presente pro bucket privado novo
  `application-documents` (migration 118, 10MB, pdf/jpg/png/webp) e grava
  só metadados (`path`/`name`/`type`/`size`) em `form_data.s15`, apagando o
  arquivo antigo do Storage se a pessoa reenviar o mesmo documento.
  `handleNext` (`FormularioInscricao.tsx`) chama `anexarDocumentos` em vez
  de `salvarSecao` só quando a seção atual é a 15; `handleBack` foi
  corrigido pra **não** chamar `salvarSecao(..., 15, {})` ao voltar da
  seção 15 (isso zerava `form_data.s15` de volta pra `{}`, já que o
  `FormData` capturado no `handleBack` só pega campos string, não File). A
  visualização da inscrição (`inscricoes/formulario/[id]/page.tsx`) ganhou
  um card "Documentos enviados" ao lado do comprovante de pagamento —
  miniatura pra imagem, ícone de arquivo pra PDF, cada um com URL assinada
  (1h) do bucket `application-documents`. **Mesmo bug existia no
  formulário de obreiro** (`formulario-obreiro/[token]/`), em duas seções
  que misturam texto com arquivo: Seção 03 (Família — certidão de
  casamento, só quando casado) e Seção 10 (Documentos e Aceite Final —
  foto, RG frente/verso ou passaporte). Corrigido com o mesmo padrão, mas
  numa única action reaproveitável pras duas seções —
  `salvarSecaoObreiroComArquivos` (bucket `staff-application-documents`,
  migration 119) — que faz upload de qualquer `File` presente no
  `FormData` e mantém como string qualquer outro campo, preservando o
  metadado já salvo quando a seção é reenviada sem escolher o arquivo de
  novo (inclusive no botão "Voltar", que antes zerava esses campos). A
  visualização (`inscricoes/formulario-obreiro/[id]/page.tsx`) ganhou o
  mesmo card "Documentos enviados", juntando o que foi anexado nas duas
  seções.
- **Painel de Referências (pastor/amigo) na visualização da inscrição
  aparecia mesmo em escolas que escondem essas seções:** o card
  "Aguardando — Pastor/Líder" / "Aguardando — Amigo/Referência"
  (`inscricoes/formulario/[id]/page.tsx`) era mostrado sempre, mesmo
  quando `schools.form_config.hidden_fields` esconde `s8.pastor_bloco`/
  `s9.oculto` do formulário do candidato (comum em seminários) — como o
  candidato nunca vê o botão pra gerar o link nesse caso, o card ficava
  "aguardando" pra sempre, sem nunca poder ser resolvido. Corrigido lendo
  o mesmo `hidden_fields` da escola (que a tela não buscava antes) e só
  renderizando cada card se o bloco correspondente não estiver escondido;
  o painel lateral inteiro some (e o formulário volta a ocupar a largura
  toda) quando os dois se aplicam.

---

## 6. Módulo de Hospedagem

- **Hierarquia real** (migrations 110-112): `blocks` → `floors` (FK
  `block_id`) → `rooms` (FK `floor_id`) → `beds` (FK `room_id`) — antes
  "bloco"/"andar" eram texto livre em `rooms.block`/`rooms.floor`; agora são
  entidades de verdade, renomeáveis num lugar só, com `ON DELETE RESTRICT`
  (não apaga bloco/andar com filho dentro — a UI em
  `hospedagem/quartos/page.tsx` já bloqueia isso com mensagem clara antes de
  chegar no banco). `floors.destination`/`gender_constraint` são só um
  **padrão** que pré-preenche `rooms` novo ao criar (`RoomForm.tsx`) — cada
  quarto pode sobrescrever, não é regra travada.
- **Navegação em 3 camadas** em `/hospedagem` (`view=grid`, a aba "Mapa de
  Quartos e Camas"), dirigida por `searchParams` (`?block=id&floor=id`, sem
  rota nova nem estado client): nada selecionado → cards de Bloco
  (`BlockCard.tsx`); só bloco → cards de Andar do bloco (`FloorCard.tsx`);
  bloco+andar → `BedGrid.tsx` escopado só aos quartos daquele andar. Cada
  card mostra ocupação agregada (camas ocupadas hoje / total) e um selo de
  reserva de espaço (ver abaixo) se houver.
- **Reserva de bloco/andar/quarto inteiro sem alocar cama** —
  `space_holds` (migrations 111-112, `scope` em `'block'|'floor'|'room'`,
  `HoldForm.tsx`/`HoldBanner.tsx`): só um bloqueio/aviso ("Reservado pro
  Grupo X, de tal a tal data"), **não** aloca cama nenhuma sozinho — a
  distribuição cama a cama continua vindo de `createAllocation`/
  `allocateWholeRoom`, sem relação direta. O botão de reservar fica sempre
  no nível que a pessoa está olhando (bloco na tela de blocos, andar na
  tela de andares, quarto na tela de quartos) — não no nível de onde ela
  veio. Cancelar hold pede confirmação + motivo (mesmo padrão de
  `ConfirmSubmitButton`/passo de confirmação inline usado em Reservas).
- **Reservas ↔ Hospedagem, ligados**: aprovar uma reserva de quarto em
  `/reservas` (tipo `quarto`) pode alocar a cama/quarto na hora
  (`room_allocations.reservation_id` preenchido), evitando digitar o mesmo
  hóspede duas vezes. Alocação feita direto no mapa de camas (sem reserva
  formal por trás) também aparece em Reservas como linha "sintética"
  (`reservation_id is null`), com cancelamento próprio. Aba **Histórico**
  em Reservas (só gestão/hospitalidade) mostra tudo — qualquer status,
  qualquer origem — com resumo (total/aprovadas/canceladas/taxa) e filtro
  de período; é somente leitura (sem botão de ação).
- **Agenda** (antes rota separada `/hospedagem/agenda`, hoje um toggle
  "Grade"/"Agenda" dentro da própria Hospedagem — a rota antiga só
  redireciona) é clicável: célula vazia → aloca ali (quarto+data
  pré-preenchidos); barra de reserva existente → abre gerenciamento
  (check-in/check-out/cancelar, com confirmação+motivo).

---

## 7. Módulo de Lavanderia (IoT)

Autosserviço com pagamento por tempo. Cada máquina tem um relé Wi-Fi
**Shelly 1PM** (Gen3/Gen4) que corta a energia quando o tempo pago acaba.

- **Dois modos de conexão por máquina** (`laundry_machines.connection_mode`):
  - **`cloud` (padrão em produção):** Shelly Cloud Control API v2
    (`src/lib/laundry/shelly-cloud.ts`). O servidor na Vercel comanda o relé
    de qualquer lugar: `POST {server}/v2/devices/api/set/switch?auth_key=...`
    com `toggle_after` (segundos) como timer; status em lote via
    `POST {server}/v2/devices/api/get` (até 10 devices/chamada, limite
    1 req/s por conta — por isso o status agrupa máquinas por conta).
    Credenciais por máquina: `cloud_server`, `cloud_device_id`,
    `cloud_auth_key`. Atenção: a API retorna `online` como `1/0` (número).
  - **`local`:** HTTP direto no IP (`http://{ip}/relay/0?turn=on&timer={s}`),
    só funciona com servidor na mesma rede — usado em dev/instalações locais.
- **Modelos de dispositivo** (`laundry_device_models`): templates de URL
  (`{ip}`, `{seconds}`) para suportar outros relés (Tasmota etc.), com
  instruções de instalação e nível de dificuldade.
- **Fluxo admin:** hospitalidade libera no painel → `startMachine` liga o relé
  com timer e cria `laundry_sessions` → sessão expira ou é parada → máquina
  volta a `available`. Sessões expiradas são auto-completadas na renderização.
- **Fluxo público com PIX** (`/{slug}/lavanderia`): qualquer pessoa escolhe a
  máquina disponível → seleciona o tempo (preço de `laundry_pricing`) → o
  sistema cria cobrança PIX no **Asaas** (`src/lib/laundry/payments.ts`,
  config por org em `laundry_payment_settings`: API key, customer padrão,
  webhook token, sandbox/produção) → QR code + copia-e-cola na tela → paga →
  webhook `/api/payments/laundry/webhook` (ou o polling
  `/api/payments/laundry/status`, que confere direto no Asaas — funciona sem
  webhook) confirma, **liga a máquina** e lança receita em
  `financial_transactions` (categoria Lavanderia). Confirmação idempotente
  via update condicional de `payment_status` (webhook e polling podem correr
  em paralelo). Máquinas ocupadas aparecem com countdown e não são clicáveis.
- **Fluxo interno** (`/{slug}/minha-lavanderia`, seção Pessoal do menu, todos
  os papéis): mesma UI e mesmo fluxo PIX da página pública (componente
  `PublicLaundry` com `payerName`/`embedded`), mas a rota de cobrança resolve
  o usuário logado pelos cookies e grava `created_by`/`person_id`/nome na
  sessão. O nome aparece só para a hospitalidade no painel — a página pública
  nunca exibe nomes. A máquina do próprio usuário ganha o selo "Sua lavagem".
- Cortesia (admin) libera a máquina com `amount_paid = 0` — não gera receita.
- Código compartilhado em `src/lib/laundry/`: `control.ts` (relé + status
  online, individual e em lote), `payments.ts` (cobrança/confirmação),
  `public-data.ts` (loader das páginas de cliente), `shelly-cloud.ts`
  (API Shelly), `devices.ts` (templates de URL).

---

## 8. Integrações Externas

| Integração | Uso | Onde |
|---|---|---|
| Shelly Cloud | Relés da lavanderia | `src/lib/laundry/shelly-cloud.ts` |
| Asaas / Mercado Pago / PagBank | PIX (refeições, cobranças) | `src/lib/payments/` + `/api/payments/*` |
| Firebase (FCM) | Push notifications no app | `src/lib/firebase/` + `/api/push/*` |
| Brevo (API REST v3, não SMTP) | E-mails transacionais (formulário de inscrição, verificação de e-mail da ETED) | `src/lib/email/sendFormEmail.ts` chama `POST https://api.brevo.com/v3/smtp/email` direto (nome do endpoint é do Brevo, mas é a API transacional, não SMTP). Domínio `centralmidiajocum.com.br` verificado — envio funcionando. Autenticação é por `BREVO_API_KEY` (`.env.local` local / env var na Vercel para produção — **duas cópias independentes**, atualizar as duas se a chave for regenerada no painel do Brevo). Se `sendFormEmail` começar a falhar com "Key not found", teste a chave direto: `curl -H "api-key: $BREVO_API_KEY" https://api.brevo.com/v3/account` — se der unauthorized, a chave foi revogada/regenerada no Brevo e precisa gerar uma nova (Configurações → Chaves SMTP e API → aba **"Chaves de API"**, não a de SMTP). E-mail suporta 3 idiomas (`src/lib/i18n/emails/`) — quem envia escolhe o idioma no modal de confirmação (`DisponibilizarFormularioButton`), que embute `?lang=xx` no link para o formulário abrir no mesmo idioma do e-mail; a página lê isso em `searchParams.lang` como `initialLang`. |
| bible-api.com | Versículo do dia (início do aluno) | `src/lib/votd.ts` — usar sempre o endpoint de capítulo (`/data/almeida/{USFM}/{capítulo}`), **nunca** o de referência única (`/{livro} {cap}:{vers}?translation=almeida`), que retorna 404 falso-negativo para várias referências válidas na tradução "almeida"; cache de 12h evita o rate limit (429 após ~10 req/s) |
| Site institucional | Consome `/api/public/[slug]/*` | projeto separado `jocumat-site` (Next 16 + Tailwind v4) |
| Anthropic (Claude) — **desligada por padrão, custo zero** | Validação por IA de que a imagem anexada (foto, RG, CPF, passaporte, comprovante) é mesmo o documento pedido, não bloqueio automático de imagem errada só por script | `src/lib/documents/classifyDocument.ts` — só chama a API se `DOCUMENT_AI_VALIDATION=1` **e** `ANTHROPIC_API_KEY` estiverem setados; sem isso sempre aprova (`{valid: true}`), sem gastar nada. Usa `claude-haiku-4-5` (mais barato, suficiente pra essa classificação simples — ~US$0,002/imagem). Pra ligar: adicionar `ANTHROPIC_API_KEY` (console.anthropic.com) e `DOCUMENT_AI_VALIDATION=1` no `.env.local`/Vercel — nenhuma mudança de código necessária. Sempre roda antes (e independente) uma checagem 100% local e sem custo via `basicImageSanity.ts` (usa `sharp`, já dependência do projeto) — rejeita imagem corrompida, minúscula demais ou com proporção absurda pra um documento; não entende o *conteúdo* da imagem, só descarta os casos mais óbvios enquanto a validação por IA estiver desligada. As duas rodam em toda seção de documentos (`anexarDocumentos`/`anexarComprovante` no formulário do candidato, `anexarDocumentoAdmin`/`anexarComprovanteAdmin` na edição pelo líder) antes do upload pro Storage. |

---

## 9. Mobile (Capacitor)

- Pastas `android/` e `ios/` geradas pelo Capacitor (`npm run cap:sync`).
- Push nativo, splash/status bar, biometria (`@aparajita/capacitor-biometric-auth`).
- PWA: ícones em `public/icons/`.
- Deep link `sisgo://` para OAuth nativo.

---

## 10. Convenções de Desenvolvimento

- **Mobile first** em toda tela e formulário.
- **Cards clicáveis:** padrão de lift (`hover:shadow-md` + `translate-y` +
  título colorido + "Abrir →") em qualquer card/linha navegável.
- Server components por padrão; client components apenas onde há interação
  (sufixo em PascalCase no mesmo diretório da página, ex. `DeviceSelect.tsx`,
  `ConnectionFields.tsx`).
- Server actions em `actions.ts` por módulo, ou inline (`'use server'`) na
  própria página quando dependem do contexto dela.
- Mensagens de feedback via query param `?msg=` renderizadas pela página.
- Idioma do produto e do código de domínio: **português**.
- **Overlay de modal/dialog (`fixed inset-0 ...`):** nunca hardcode
  `md:left-60` para não cobrir a sidebar — ela pode estar recolhida
  (`md:w-16`, padrão inicial) ou expandida (`md:w-60`), então um valor fixo
  deixa uma faixa de conteúdo sem overlay. Use
  `useSidebarLeftClass()` de `@/components/layout/account-context`
  (lê `collapsed` do `BrandCtx`, já injetado pelo `AppShell`) e monte a
  classe como `` `fixed inset-0 ${sidebarLeftClass} z-50 ...` ``. O
  componente `Modal` (`@/components/ui/Modal`) já faz isso — prefira
  reaproveitá-lo em vez de montar um overlay próprio.
  **Renderiza via `createPortal(..., document.body)`** — necessário porque
  um `fixed` nascido dentro de um ancestral com `transform`/`filter` (ex.:
  a animação de `.animate-stagger`, que deixa um `transform: translateY(0)`
  residual mesmo depois de terminar, via `animation-fill-mode: both`) vira
  "fixed" em relação a esse ancestral, não à viewport — o modal aparece
  preso num canto da tela em vez de centralizado. Mesmo padrão que o painel
  "Ver tudo" (`AllAppsPanel`) já usava. Ao criar um modal novo, prefira
  sempre `Modal` em vez de montar um `fixed inset-0` próprio — evita
  reintroduzir esse bug.
- **`SearchableSelectModal`** (`@/components/ui/SearchableSelectModal`):
  substitui `<select>` nativo pra escolher usuário/pessoa numa lista —
  abre `Modal` com busca (mesmo critério tolerante a acento/cedilha/
  maiúsculas do "Ver tudo": normaliza como NFD, remove as marcas
  diacríticas resultantes e aplica `toLowerCase`, aceita digitação fora
  de ordem). Recebe `options: {id, label, sublabel?}[]`
  — passe nome em `label` e e-mail em `sublabel` (ou vice-versa) pra buscar
  por ambos de uma vez. Renderiza um `<input type="hidden">` por baixo, então
  funciona dentro de `<form action={serverAction}>` sem mudar a action.

## 11. Scripts e Operações

- `npm run dev` (Turbopack) · `npm run build` · `npm run type-check` · `npm run lint`
- **Nunca rode `next build` com o dev server aberto** — os dois escrevem em
  `.next/` e corrompem o cache (sintoma: erro genérico nas server actions).
- Importação de inscrições externas (Google Forms):
  `node scripts/import-applications/run.mjs <arquivo> --org=<slug>`
  (ver `scripts/import-applications/README.md`; fluxo dry-run → `--confirm`).
- Deploy: push na `main` → build automático na Vercel. O domínio apex
  redireciona para `www` na borda da Vercel.
