# SISGO — Arquitetura do Sistema

**Atualizado:** 4 de agosto de 2026 (hospedagem reestruturada — hierarquia Bloco › Andar › Quarto › Cama, navegação em camadas e reserva de bloco/andar/quarto inteiro; unificação de Reservas com Hospedagem)
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
- **Role preview:** administradores podem visualizar o sistema como outro papel
  (`src/lib/role-preview.ts`).
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

## 11. Scripts e Operações

- `npm run dev` (Turbopack) · `npm run build` · `npm run type-check` · `npm run lint`
- **Nunca rode `next build` com o dev server aberto** — os dois escrevem em
  `.next/` e corrompem o cache (sintoma: erro genérico nas server actions).
- Importação de inscrições externas (Google Forms):
  `node scripts/import-applications/run.mjs <arquivo> --org=<slug>`
  (ver `scripts/import-applications/README.md`; fluxo dry-run → `--confirm`).
- Deploy: push na `main` → build automático na Vercel. O domínio apex
  redireciona para `www` na borda da Vercel.
