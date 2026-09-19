# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Instalar dependências
npm install

# Desenvolvimento local — apenas frontend (sem /api/*)
npm run dev   # porta 5173

# Desenvolvimento local — frontend + Edge Functions (necessário para IA e gestão de usuários)
vercel dev    # porta 3000

# Build para produção
npm run build

# Preview do build
npm run preview

# Linting e formatação
npm run lint       # ESLint em src/ (0 errors esperados; warnings são informativos)
npm run lint:fix   # ESLint com autocorreção automática
npm run format     # Prettier em src/
```

Não há testes automatizados. ESLint 9 (flat config) + Prettier estão configurados — ver `eslint.config.js` e `.prettierrc`.

## Variáveis de ambiente

Crie um `.env` a partir de `.env.example`:

```
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # apenas para api/admin-users.js
ANTHROPIC_API_KEY=sk-ant-...    # lida apenas pelo servidor (api/anthropic.js)
```

- `SUPABASE_URL` e `SUPABASE_ANON_KEY` são expostas ao browser via `define` no `vite.config.js`
- `SUPABASE_SERVICE_ROLE_KEY` e `ANTHROPIC_API_KEY` ficam exclusivamente no servidor — nunca usar prefixo `VITE_`

## Arquitetura

### Fluxo central

O projeto é um SPA React com 5 rotas:

| Rota | Página | Descrição |
|---|---|---|
| `/login` | `Login` | Autenticação via Supabase Auth (email/senha + Google OAuth) |
| `/` | `Dashboard` | Lista de projetos com filtros |
| `/onboarding/new` | `NewOnboarding` | Criação de novo projeto |
| `/project/:id` | `ProjectDetail` | Jornada de onboarding do cliente |
| `/users` | `UserManagement` | Gestão de usuários do time (admin only) |

### Estado global — `AppContext`

Todo o estado da aplicação vive em `src/context/AppContext.jsx`. Ele expõe:

- `user` / `login` / `logout` / `loginWithGoogle` — autenticação via Supabase Auth; sessão gerenciada por JWT (Supabase). **Supabase é obrigatório** — não há fallback mock.
- `loadingAuth` — `true` até `getSession()` resolver; `RequireAuth` e `RequireAdmin` retornam `null` enquanto `true`, evitando redirect prematuro no callback OAuth (PKCE flow)
- `authError` — string de erro de autenticação; setada quando `SIGNED_IN` ocorre para um usuário sem perfil em `profiles`
- `projects` / `addProject` / `updateProject` / `deleteProject` — CRUD de projetos
- `squads` / `addSquad` / `updateSquad` / `deleteSquad` — CRUD de equipes (tabela `squads`)
- `teamMembers` — array de perfis do time com `disabled=false`, buscado da tabela `profiles`
- `loadingProjects` / `isSupabaseReady` — estado de sincronização com a nuvem

### Persistência e sincronização

- **Offline-first:** toda mutação salva em `localStorage` imediatamente sob a chave `rl_projects_v2`
- **Debounce:** `updateProject` tem debounce de 1s por `id` antes de escrever no Supabase (via `upsertTimers` ref)
- **Race condition:** `pendingWrites` ref contador — o listener de realtime ignora eventos enquanto há escritas locais pendentes
- **Realtime granular:** listener em `projects_v2` usa handlers separados por evento (`INSERT`/`UPDATE`/`DELETE`), atualizando apenas o registro afetado no state local. Mudanças em tabelas filhas (personas, criativos, etc.) **não** disparam realtime — são refletidas apenas via escrita local imediata.
- **Aliases camelCase:** `assembleProject()` em AppContext expõe tanto os campos snake_case do DB quanto aliases camelCase (ex: `company_name` + `companyName`) para compatibilidade com os componentes existentes.

### Jornada de onboarding (`ProjectDetail`)

O onboarding segue 3 etapas obrigatórias em sequência, controladas por `completedSteps[]` dentro do projeto:

1. `roi` → `ROICalculator` — salva `roiCalc` + `roiResult`
2. `strategy` → `PersonaCreator` — salva `personas` (gerado via IA)
3. `oferta` → `OfertaMatadora` — salva `ofertaData` (gerado via IA)

Quando as 3 estão completas (`allDone`), a página renderiza diretamente `ClientProfile` (perfil consolidado). Etapas são desbloqueadas sequencialmente — a anterior precisa estar em `completedSteps` para habilitar a próxima.

### IA (Claude API)

- `src/lib/claude.js` — `streamClaude()` faz POST para `/api/anthropic` com SSE streaming; obtém o `access_token` da sessão Supabase e envia no header `Authorization: Bearer <token>`
- `api/anthropic.js` — Vercel Edge Function; valida o JWT do caller via `/auth/v1/user` do Supabase antes de prosseguir (retorna 401 se inválido); lê `process.env.ANTHROPIC_API_KEY` e faz proxy para `api.anthropic.com`; sanitiza o payload para aceitar apenas os campos esperados pela Anthropic API
- Contexto enviado à IA: texto + PDFs como blocos nativos `{ type: 'document' }` + imagens como `{ type: 'image' }` — ver `src/lib/buildContext.js`
- Renderização de output da IA: `react-markdown` + `rehype-sanitize` (sem `dangerouslySetInnerHTML`)
- Em desenvolvimento local, use `vercel dev`; o Vite puro (`npm run dev`) não serve `/api/*` e a IA não funcionará

### Funções `/api/*` — helpers compartilhados (`api/_http.js`)

Toda função importa de `./_http.js` em vez de redefinir: `json`/`jsonCors`/`jsonErr` (resposta
JSON; `jsonCors` para endpoints públicos, `NO_STORE` quando não pode ir pra CDN), `preflight()`
(OPTIONS), `getUser(req, apikey?)` (valida o JWT do Supabase e devolve `{ ok, jwt, user }` ou
`{ ok: false, message }`), `bearer(req)`, `sb(path, opts)` (PostgREST com a chave de serviço —
`prefer` padrão `return=representation`, `range`, `headers`) e `hmacHex`. Funciona no runtime
edge e no Node. No front, `src/lib/api.js` (`apiFetch`, `sessionToken`) é o único lugar que
monta o `Authorization: Bearer` das chamadas a `/api/*`.

### Supabase — Schema normalizado

`src/lib/supabase.js` — retorna `null` se as env vars não estiverem definidas. Exporta também helpers de Storage: `uploadFile`, `deleteFile`, `getSignedUrl`.

#### Tabela principal

- **`projects_v2`** — projetos com schema normalizado; UUID PK gerado via `crypto.randomUUID()` no browser antes do INSERT. Contém campos da empresa, contrato, equipe e serviços. Inclui `dashboard_url` (TEXT nullable) para link do Looker Studio editável inline no `ClientProfile`.
  - RLS admins: acessam todos os projetos — lido de `auth.jwt()->'app_metadata'->>'role' = 'admin'`
  - **Importante:** a role usa `app_metadata` (não `user_metadata`) — migration `021` corrigiu isso para impedir autopromação; `enrichUser()` no frontend também lê de `app_metadata.role`
  - RLS members — **acesso via squad** (migration `020`); role renomeada de `account` para `member` na migration `023`:
    - SELECT/UPDATE/DELETE/INSERT: via `is_squad_member(squad)` — função já existente no banco
    - INSERT também requer: `account_id = auth.uid()` (registra o autor)
    - Projetos sem squad atribuído (`squad IS NULL`) ficam invisíveis para members
  - `account_id` é apenas registro do criador — não controla mais o acesso de leitura/edição
- **`profiles`** — espelha os metadados do Auth; usada para listar membros do time no Dashboard e pela gestão de usuários
  - RLS: leitura para qualquer autenticado; admins podem escrever qualquer perfil; cada usuário só escreve o próprio
- **`squads`** — entidades de equipe gerenciáveis; `members` é JSONB array `[{ profile_id, role }]`; `projects_v2.squad` referencia por UUID com `ON DELETE SET NULL`
  - RLS: leitura para qualquer autenticado; escrita apenas para admins

#### Tabelas filhas (FK `project_id → projects_v2(id) ON DELETE CASCADE`)

| Tabela | Cardinalidade | Chave patch no AppContext |
|---|---|---|
| `roi_calculators` | N por projeto | `roiCalc` + `roiResult` |
| `personas` | N por projeto | `personas` (array — delete+insert) |
| `ofertas` | 1 por projeto | `ofertaData` |
| `campaign_plans` | 1 por projeto (DELETE+INSERT) | `campaignPlan` |
| `resultados` | N por projeto | `resultados[0]?.data ?? {}` — coluna JSONB `data` adicionada na migration `017`; formato legado `{modelo, b2b, b2c}` preservado; colunas flat (leads, mql…) reservadas para Phase 5 |
| `criativos` | N por projeto | `creatives` (array — delete+insert) |
| `google_ads` | N por projeto | `googleAds` (array — delete+insert); entrada com `isDraft=true` persiste rascunho de configuração |
| `landing_pages` | N por projeto | `landingPages` (array — delete+insert) |
| `banco_midia` | 1:1 com projeto | `brandFotos` / `brandVideos` / `brandKit` |
| `estrategia` | 1:1 com projeto | `estrategia` |
| `estrategia_v2` | 1:1 com projeto | `estrategiaV2` |
| `attachments` | N por projeto | `attachments` (array — delete+insert) |
| `produtos` | N por projeto | `produtos` (array — `{ id, nome, tipo, answers }`) — tabela gerenciada pelo `ProdutoServicoModule` |

#### `addProject` — ID externo

`addProject(data)` aceita `data.id` se fornecido; caso contrário gera um `crypto.randomUUID()` internamente. Isso permite que `NewOnboarding` gere o UUID antes de fazer o upload dos arquivos para o Storage, garantindo que o path `{projectId}/arquivo.ext` seja consistente com o projeto criado.

#### Padrão `answers` JSONB

Várias tabelas filhas (`ofertas`, `campaign_plans`, `criativos`, `google_ads`) armazenam o formulário do componente em uma coluna JSONB `answers` e o output da IA em `generated_content`. `assembleProject()` faz o merge: se `answers` for um objeto, espalha seus campos no nível raiz do objeto montado; caso contrário (row já flat), usa a row diretamente. Isso mantém compatibilidade com objetos gerados antes e depois da normalização.

#### Roteamento de patches em `updateProject`

`sbUpdateProjectV2(id, patch)` inspeciona as chaves do patch e roteia cada uma para a tabela correta. Campos de `projects_v2` são mapeados via `PROJECT_FIELD_MAP` (aceita tanto camelCase quanto snake_case). Campos não reconhecidos são ignorados silenciosamente (ex: `progress`, que é derivado de `completedSteps`).

#### Supabase Storage — buckets

| Bucket | Acesso | Uso |
|---|---|---|
| `project-docs` | privado | `raio_x` e `sla` do onboarding — path salvo em `raio_x_file_url` / `sla_file_url`; visualização via URL assinada em `ClientProfile` |
| `brand-media` | privado | fotos e vídeos do banco de mídia (pendente Phase 5) |
| `brand-logos` | privado | logotipo da marca |
| `attachments` | privado | uploads avulsos do `AnexosModule` (base64 ainda; pendente Phase 5) |

Path convention: `{projectId}/{filename}`. Storage policies espelham as RLS das tabelas filhas.

### Autenticação (Supabase Auth)

- `login(email, password)` → `supabase.auth.signInWithPassword()`
- `loginWithGoogle()` → `supabase.auth.signInWithOAuth({ provider: 'google' })` — redireciona e volta com sessão
- `logout()` → `supabase.auth.signOut()`
- Sessão restaurada no mount via `getSession()` e mantida em sync via `onAuthStateChange()`
- Nome, avatar e role do usuário vêm de `user_metadata` no Supabase Auth (campo `raw_user_meta_data`)
- `syncProfileIfExists(authUser)` — chamada a cada `SIGNED_IN`; consulta `profiles` por `id`; se não encontrar, faz `signOut()` e seta `authError`; se encontrar, atualiza `name`/`email`/`avatar` (não altera `role`)
- `loadingAuth` previne que `RequireAuth` redirecione antes do PKCE code exchange completar
- Os 6 usuários do time já estão criados no projeto Supabase — não é necessário recriar
- **Configuração ao usar em novo ambiente:**
  - Authentication → Providers → Google: habilitar e configurar Client ID/Secret
  - Supabase → Authentication → Redirect URLs: adicionar URL raiz **e** wildcard (ex: `http://localhost:3000` e `http://localhost:3000/**`)
  - Google Cloud Console → OAuth Client → URIs de redirecionamento: `https://<projeto>.supabase.co/auth/v1/callback`

### ClientProfile — layout e funcionalidades

`src/pages/ClientProfile.jsx` — renderizado quando `allDone` no onboarding. Layout com sidebar de navegação + painel principal:

- **Header:** nome da empresa, squad badge com dropdown de atribuição, botão "Dashboard" que abre `dashboard_url` (Looker Studio) em nova aba; ícone de lápis para editar o URL inline (confirmar com Enter/✓, cancelar com Esc/✕); quando vazio, exibe "Adicionar Dashboard"
- **Módulos:** navegação lateral com seções — Perfil, ROI, Personas, Oferta, Campanha, Criativos, Google Ads, Landing Pages, Links, Estratégia, Produto/Serviço, Banco de Mídia, Lab. Meta Ads, Resultados, Anexos
- **Toast:** notificação bottom-right com `CheckCircle2` verde e auto-dismiss em 2.8s presente em todos os handlers de save

### Lab. Meta Ads (`MetaLabModule`)

- Protocolo de testes em 3 fases sequenciais para campanhas Meta/Facebook, controlado por orçamento diário fixo (R$35/dia padrão):
  - **Fase 01 — Teste de Criativos** (Dias 1–7): testa 11 criativos, seleciona top 3 por CPL ou CTR
  - **Fase 02 — Teste de Públicos** (Dias 8–14): testa 5 públicos (Lookalikes, Interesses, Quentes, Regionais, Demográficos), seleciona top 3
  - **Fase 03 — Teste de Ganchos** (Dias 15–21): com criativo e público campeões
- Tipos de audiência suportados: `remarketing`, `lookalike`, `interesses`
- Persistido via `updateProject(id, { metaLabBudget })` — campo `metaLabBudget` em `projects_v2`
- Sidebar badge de preenchimento: `!!project.metaLabBudget`

### Google Ads (`GoogleAdsModule`)

- Entrada via **grupos de palavras-chave** — cada grupo tem `nome` editável e tabela com colunas: palavra-chave, buscas/mês e concorrência (Baixo/Médio/Alto com badge colorido)
- **Salvar configurações** persiste rascunho (`isDraft: true`) em `google_ads` sem gerar campanha; rascunho é restaurado automaticamente ao reabrir o módulo
- `AdsHistory` filtra entradas com `isDraft=true` do histórico de gerações
- A IA recebe os grupos formatados como tabela Markdown por grupo para geração mais precisa

### Draft de onboarding

`NewOnboarding` persiste rascunho em `localStorage` sob a chave `rl_new_onboarding_draft`; restaurado automaticamente na próxima visita. O payload enviado a `addProject` usa **snake_case** (mapeado direto para `projects_v2`).

### Gestão de Usuários e Squads

`src/pages/UserManagement.jsx` — página de gestão com duas abas; protegida pelo HOC `RequireAdmin` em `App.jsx`. Item "Usuários" na sidebar (`AppSidebar.jsx`) é renderizado apenas para admins.

**Aba Usuários:**
- `api/admin-users.js` — Vercel Edge Function que usa `SUPABASE_SERVICE_ROLE_KEY` para operações privilegiadas no Supabase Auth
  - Verifica o JWT do request e exige `role === 'admin'` antes de executar qualquer ação
  - Actions suportadas: `create_user` (cria usuário no Auth + perfil em `profiles`), `update_user` (atualiza metadados e perfil), `toggle_user` (ativa/desativa via campo `disabled` em `profiles` e `user_metadata`)

**Aba Equipes (Squads):**
- Squads são entidades gerenciáveis com `name`, `emoji` e `members` (JSONB array de `{ profile_id, role }`)
- Roles disponíveis por membro: `Account Manager`, `Gestor de Tráfego`, `Designer`
- CRUD via `addSquad` / `updateSquad` / `deleteSquad` no AppContext — escrevem direto no Supabase sem debounce (diferente de `updateProject`)
- **Sem realtime** para a tabela `squads` — estado sincronizado manualmente via retorno das operações CRUD
- RLS: leitura para qualquer autenticado; escrita exclusiva para admins
- `projects_v2.squad` é UUID nullable com FK `ON DELETE SET NULL` (projeto perde o squad quando squad é excluído)
- Atribuição de squad ao projeto feita via dropdown em `ClientProfile.jsx` → `updateProject(id, { squad: sq.id })`
- `SQUAD_COLORS` — paleta cíclica de 4 cores (gold/cyan/purple/green) centralizada em `src/lib/constants.js`; importar de lá — nunca redefinir localmente

### Pendências (Phase 5)

Os seguintes componentes ainda usam base64 / estrutura legada e precisam ser atualizados:

| Componente | Trabalho |
|---|---|
| `AnexosModule.jsx` | Substituir FileReader base64 por `uploadFile('attachments', ...)` de `src/lib/supabase.js` |
| `BancoMidiaModule.jsx` | Upload de fotos/vídeos para `brand-media`; logo para `brand-logos` |
| `ResultadosModule.jsx` | Migrar da coluna JSONB `data` (formato legado `{modelo, b2b, b2c}`) para colunas flat por linha na tabela `resultados`; já salva/lê via `data` JSONB como workaround |

> **Implementado:** Upload de Raio-X e SLA no `NewOnboarding` → bucket `project-docs`; visualização com URL assinada em `ClientProfile`.

### Exportação PDF (`src/utils/exportPDF.js` + `src/lib/printDoc.js`)

Todo documento "Salvar como PDF" é HTML aberto com `window.print()`, montado por
`printDocument({ title, css, body })` de `src/lib/printDoc.js`, que injeta o CSS base
(`PRINT_BASE_CSS`: reset, tipografia, cabeçalho `.header/.logo/.doc-*`, botão de imprimir) —
cada gerador só escreve o corpo e o CSS específico (`PAGE_CSS` para a página clássica com
margem, `docHeader()` para o cabeçalho padrão, `markdownToHtml()` para saída da IA via
`react-markdown`). Usam esse scaffold: `exportPDF.js`, `kickoffPDF.js`, `mecanismoUnicoPDF.js`,
`roteiroVideoPDF.js`, `creativoPDF.js`, `metaLabPDF.js` e os PDFs do `ClientForm`. Sem jsPDF:
o nome do arquivo sugerido é o `<title>` do documento. Funções exportadas por `exportPDF.js`:

| Função | Usado em |
|---|---|
| `exportPersonasPDF(personas, project)` | `PersonaCreator` — botão de download |
| `exportOfertaPDF(oferta, project)` | `OfertaMatadora` — botão de download |
| `exportEstrategiaV2PDF(data, project)` | `EstrategiaV2Module` — botão de download |

### Componentes UI reutilizáveis

**`src/components/UI/Modal.jsx`** — modal base: overlay + Escape fecha; props: `onClose`, `maxWidth` (`sm/md/lg/xl/2xl`, default `md`), `className`. Usar para qualquer modal novo — não criar overlay/backdrop manualmente.

**`src/components/UI/Toast.jsx`** + **`src/hooks/useToast.js`** — toast bottom-right com auto-dismiss. Suporta tipos `success` (default, ícone verde) e `error` (ícone/texto vermelho). Uso:
```jsx
const { toast, showToast } = useToast()
// ...
showToast('Salvo!') // success por padrão
showToast('Erro ao salvar', 'error')
// render:
<Toast toast={toast} />
```

### Bibliotecas utilitárias

**`src/lib/utils.js`** — funções puras compartilhadas: `initials(name)`, `fmtCurrency(n)` (BRL, sem casas decimais), `hashId(id)` (compatível com IDs legados numéricos e UUIDs).

**`src/lib/constants.js`** — constantes de domínio centralizadas: `SQUAD_COLORS`, `SERVICES_CONFIG`, `BUSINESS_LABELS`, `EDIT_BUSINESS_TYPES`, `SEGMENTOS`, `MATURITY_LABELS`, `EDIT_MATURITY_OPTIONS`, `CONTRACT_MODEL_LABELS`, `CONTRACT_PAYMENT_LABELS`. Importar sempre daqui — não redefinir localmente.

### Resultados do Funil — preenchimento automático (Meta + Google)

`api/resultados-autofill.js` (Edge) preenche **investimento** e **conversões** das semanas
do módulo Resultados com os dados reais das contas vinculadas ao projeto, sem tocar nos
campos de funil preenchidos à mão (MQL, SQL, vendas, receita são preservados).

- **Fonte:** `dash_insights` (sincronizada de hora em hora pelo repo `dashboard-api`), agregada
  no Postgres pela função `dash_totals_by_project(p_from, p_to)` — migration `075`. A função
  devolve **JSONB** (`{ project_id: { 'YYYY-MM-DD': [gasto, conversões] } }`) de propósito:
  resposta tabular do PostgREST é cortada em 1000 linhas e um mês inteiro passa disso.
  `dash_num()` replica o parser BR do `num()` de `src/lib/dashboardData.js` — mudou um, mude o outro.
- **Definição de conversão:** idêntica ao Dashboard de Tráfego (`CFG`) — Meta = conversas no
  WhatsApp + leads + vendas; Google = conversões.
- **Agenda:** Vercel Cron (`crons` no `vercel.json`) nos dias **1, 8, 15 e 22** às 03:05 UTC
  (00:05 BRT): dia 8 fecha a Semana 1, dia 15 a Semana 2, dia 22 a Semana 3 e dia 1 fecha o mês
  anterior inteiro. Cada execução repreenche **todas** as semanas já fechadas do mês de
  referência, então uma execução perdida se conserta sozinha na seguinte.
- **Escrita:** `resultados.data` → `b2b[YYYY-MM].semanaN` (modelo B2B) ou
  `b2c_semanas[YYYY-MM].N` + `b2c[YYYY-MM].DD` (modelo B2C, que abre em modo Diário).
  Projetos sem `modelo` escolhido e semanas sem veiculação são pulados.
- **Marcação:** cada entrada preenchida ganha `fonte: 'api'`, `atualizadoEm` e, na semana em
  curso, `parcial: true` — renderizados pelo selo `AutoBadge`
  (`src/components/Resultados/AutofillResultados.jsx`).
- **Modo manual:** botão "Puxar da API" no cabeçalho de B2B/B2C chama o mesmo endpoint com o JWT
  do usuário (`src/lib/autofillResultados.js`), preenche o mês exibido — incluindo a semana em
  curso até ontem — e devolve o JSONB mesclado, que o componente aplica via `onUpdate` para não
  depender de reload.
- **Env:** `CRON_SECRET` na Vercel autentica o cron (sem ela, o fallback aceita o header
  `x-vercel-cron`). A chave de serviço é lida de `SUPABASE_SECRET_KEY` com fallback para
  `SUPABASE_SERVICE_ROLE_KEY`.

### Atividades (`/atividades`): capacidade do time + planejador, visual do Linear

Módulo único que absorveu o antigo "Capacidade do Time" (`/workload` agora redireciona para
cá; `WorkloadDashboard.jsx` e `public/workload/` foram removidos). A área de conteúdo replica
o app Linear (frame com raio 8, barra superior de 44px com breadcrumb e contador, barra de
views com filter tabs, listas densas de 13px, painel lateral de 480px e painel flutuante do
"agente"); o `AppSidebar` global não muda.

- **Tokens:** `.ln` em `src/index.css` define as CSS vars `--ln-*` (claro por padrão, `.dark .ln`
  escuro) com os valores medidos no Linear; o Tailwind expõe como `ln-*` (`bg-ln-panel`,
  `text-ln-t3`, `bg-ln-ink/5` para hovers translúcidos, `ln-accent`, `ln-brand`, status
  `ln-green/yellow/red/orange/teal`). Classes prontas: `.ln-card`, `.ln-iconbtn`, `.ln-pill`,
  `.ln-tab`/`.ln-tab-active`, `.ln-primary`, `.ln-input`, `.ln-label`, `.ln-row-hover`,
  `.ln-kbd`, `.ln-hatch`, `.ln-shimmer`, `.tabular`. Atenção: `.ln-card` e companhia ficam
  fora de `@layer`, então para sobrescrever borda/fundo delas use `!border-...`.
- **Página:** `src/pages/Atividades.jsx` orquestra: `useCargaTime` (carga do time em lotes de
  3 pessoas, progressivo, cache de 10 min em sessionStorage), `usePlanejador` (todo o fluxo
  formulário → cálculo → comparação → aprovação, extraído sem mudar regra), estado de UI
  (painel lateral com 3 modos: pessoa / atividade / nova; dia selecionado na linha de calor;
  filtro por saúde; agrupamento; densidade), atalhos (`C` nova atividade, `Esc` fecha) e o
  contador "n / N" com setas.
- **Componentes** (`src/components/Atividades/`): `KpiStrip` (6 tiles do time), `TeamHeatLine`
  (ocupação do time por dia útil, 10 células), `TeamTable` (pessoas agrupadas por saúde:
  ponto, barra de ocupação com atrasadas e estouro, sparkline de 10 dias, hoje, fila,
  atrasadas, sem data, zumbis, próximo dia livre, além do horizonte, menu de ações),
  `PersonPanel` (KPIs, `CargaDiaria`, alertas, distribuição por cliente, abas fila /
  atrasadas / sem data / zumbis), `IssueList` (atividades planejadas como issues, agrupadas
  por semana / status / responsável), `AtividadePanel` (propriedades + carga no momento da
  aprovação), `NovaAtividadePanel` (composer), `PlannerFloat` ("Planejador · ClickUp":
  sugestão, data forçada com justificativa, comparação com o time, aprovar), `ConfigModal`.
- **Saúde por pessoa** (`src/lib/atividadesCarga.js` → `saudeDe`): sobrecarregado (ocupação
  10d ≥ 100, ou ≥ 3 dias estourados nos 10 dias, ou atrasadas ≥ 2 dias de capacidade, ou horas
  além do horizonte / que não cabem em 60 dias), no limite (≥ 75, 1 a 2 dias estourados ou
  atrasadas > 1 dia), ok (40 a 74), livre (< 40; com 0 tarefas abertas vira "livre suspeito":
  provável `clickup_user_id` errado), sem leitura (erro ou perfil sem ClickUp). Score ordena.
- **Motor:** `api/_atividades_engine.js` (puro, testável com Node). Cada task aberta vira
  horas (estimativa nativa > campo "Tipo de tarefa" > "Dificuldade" > padrão), cai no dia do
  vencimento (atrasadas caem em hoje, fim de semana vai para o próximo dia útil), o excesso de
  um dia rola para o seguinte e a tarefa nova entra na primeira capacidade livre. Atrasadas há
  mais de `dias_atraso_maximo` (14) e tarefas sem data ficam fora do cálculo, mas aparecem.
  Devolve também semEstimativa, porStatus, porPasta, sobraFinal, diasEstourados,
  proximoDiaLivre. Datas sempre `yyyy-mm-dd` em `America/Sao_Paulo`.
- **API:** `api/atividades.js` (Node, `maxDuration` 60): actions `config`, `carga` (time, sem
  tarefa nova, até 12 ids por chamada, `refresh` ignora o cache de 5 min), `sugerir`, `listas`,
  `criar` (assignee, `due_date`, `start_date`, `time_estimate`, prioridade, campos Cliente /
  Tipo / Departamento / Dificuldade resolvidos ao vivo; `OAUTH_023` cria sem responsável e
  devolve `aviso`). `envClean()` limpa a quebra de linha colada nas `CLICKUP_*` da Vercel.
- **Tabelas (migration 083):** `atividades_planejadas` (histórico + `snapshot_carga`) e
  `atividades_config` (linha `global`, editável por admin no `ConfigModal`).
- **Local:** o `vercel dev` entrega às funções `/api/*` as variáveis do ambiente *Development*
  da Vercel mais o arquivo **`.env`** da raiz; o `.env.local` NÃO chega nas funções. As
  `CLICKUP_*` ficam num `.env` (ignorado pelo git) com os valores sem a quebra de linha.
- **Mapeamentos usados:** `profiles.clickup_user_id`, `projects_v2.clickup_folder_id`,
  `squads.department_assignments` (responsável sugerido pelo departamento do tipo de tarefa).

### LinksModule — visibilidade na header

`src/components/LinksModule.jsx` — cada link (fixo ou avulso) tem toggle Eye/EyeOff que persiste no campo `hiddenFromHeader[]` dentro do JSONB `links` em `projects_v2`. A header do `ClientProfile` usa um **ResizeObserver** para calcular dinamicamente quantos links cabem no container (substituiu o limite estático `MAX_VISIBLE=5`); quando o container cresce, re-mede e traz links de volta do overflow.

### Estilo

Tailwind CSS com design system próprio (`rl-*`). Classes utilitárias como `glass-card`, `btn-primary`, `bg-gradient-dark`, `shadow-glow` são definidas em `src/index.css`.

### Sidebar global recolhível

`AppSidebar` tem modo recolhido (56px, só ícones com tooltip) para sobrar espaço aos
módulos. Estado em `localStorage` (`app.sidebar.collapsed`), compartilhado entre páginas pelo
hook `useSidebarCollapsed` (evento `app-sidebar-collapsed`). Alterna pelo botão no topo da
sidebar ou pela tecla `[` (fora de campos de texto). Só no desktop; no mobile continua o overlay.

### Tarefas (`/tarefas`): réplica do ClickUp dentro da Área do Cliente

Substitui o ClickUp na operação. **Visual:** o mesmo do módulo Atividades (frame `.ln`
com tokens `ln-*`, barra superior e barra de views de 44px, `ln-tab`/`ln-pill`/`ln-iconbtn`/
`ln-primary`, linhas de 40px em grid com `ln-row-hover`, detalhe num painel lateral de 480px
que empurra o conteúdo a partir de 1200px de largura e sobrepõe abaixo disso, com botão
de expandir). Nada de modal centralizado nem tokens `rl-*` dentro do módulo. Hierarquia idêntica: **Pasta** (uma por cliente, ligada a
`projects_v2` por `project_id`) → **Lista** (com seus próprios statuses em `statuses` jsonb)
→ **Tarefa** (com subtarefas via `parent_id`) → **Comentários**. Tabelas `tarefas_pastas`,
`tarefas_listas`, `tarefas_itens`, `tarefas_comentarios` (migration 084; RLS liberada para
todo `authenticated`; as quatro estão na publicação realtime).

- **Página** `src/pages/Tarefas.jsx`: coluna de pastas/listas (`TarefasSidebar`, dentro do
  frame), barra com Lista/Quadro, agrupamento (status, vencimento, responsável, prioridade,
  lista), filtro de responsável, busca, toggle de concluídas e densidade. Atalhos: `C` cria
  tarefa, `Esc` fecha o painel. Com o painel aberto e largura < 1600, a lista esconde tipo,
  dificuldade, criada e conclusão (`compacto`). Seleção e tarefa aberta vivem na URL
  (`?pasta=`, `?lista=`, `?minhas=1`, `?tarefa=`). Preferências em `localStorage` (`tarefas.*`).
- **Dados** `src/hooks/useTarefas.js`: lê a estrutura inteira e as tarefas só da pasta/lista
  aberta (paginado de 1000 em 1000), atualização otimista e canal realtime. Trocar status
  passa por `mudarStatus` (calcula `status_tipo` e `data_conclusao`).
- **Componentes** `src/components/Tarefas/`: `Campos.jsx` (editores inline em Popover via
  portal: status, responsáveis, data, prioridade, tipo, dificuldade, estimativa, `AdicionarInline`),
  `ListaView` (grid agrupado, subtarefas indentadas), `QuadroView` (kanban com `ln-card` e
  arrastar entre colunas de status/prioridade), `TarefaPanel` (corpo do painel lateral:
  título, propriedades em `dl`, descrição markdown, subtarefas, checklists, anexos no bucket
  `task-attachments`, comentários). Status é o círculo do Linear na cor do status do
  ClickUp (`StatusIcon`); prioridade são as barras (`PrioridadeIcon`).
- **Helpers** `src/lib/tarefas.js`: statuses padrão, prioridades, opções de Tipo de tarefa /
  Dificuldade / Departamento (as mesmas do ClickUp, com as cores), agrupamentos, datas.
- **Importação do ClickUp**: `scripts/baixar_clickup_tarefas.mjs <saida.json>` baixa o space
  Clientes (pastas, listas, tarefas com `include_closed` e `subtasks`); `scripts/importar_clickup_tarefas.mjs <dump.json> [--dry]`
  faz upsert pelos ids do ClickUp (pasta→projeto por `clickup_folder_id`, mapa manual de nomes
  ou nome normalizado; clientes sem pasta no ClickUp ganham pasta + lista "Geral");
  `scripts/importar_clickup_comentarios.mjs` traz os comentários das tarefas ABERTAS (as
  fechadas seriam ~10 mil requests). Responsáveis sem perfil ativo ficam em
  `responsaveis_extra` (nome/iniciais/cor do ClickUp). Importado em 2026-09-15: 72 pastas,
  135 listas, 11.745 tarefas (3.653 subtarefas, 1.962 abertas).
- **Sincronização incremental ClickUp → Área** (`api/tarefas-sync.js`, Node, 60s): lê pastas e
  listas do space (cria as novas, atualiza statuses) e as tarefas com `date_updated` desde
  o último início menos 15 min (`tarefas_sync.ultimo_inicio`), incluindo fechadas e
  subtarefas; busca pais que faltam; comentários só das abertas que mudaram (máx. 40 por
  rodada). Mão única: nunca escreve no ClickUp. **Conflito:** `clickup_sync_at` marca a
  última escrita da sincronização e o trigger de `updated_at` não a bumpa (migration 085),
  então `updated_at > clickup_sync_at` = editada na Área; nesse caso, se o ClickUp estiver
  mais antigo que a edição, a tarefa é pulada (`puladas_conflito`), senão o mais recente
  vence. Dispara por: cron da Vercel (`0 9 * * *`, uma vez ao dia é o limite do plano
  Hobby), botão "ClickUp há X min" na barra de /tarefas, e automaticamente ao abrir a
  página se a última rodada tem +30 min. Auth: `CRON_SECRET` ou JWT. Aceita `?since=<ISO>`
  e `?comentarios=0`. O mapeamento ClickUp→linha vive em `api/_tarefas_clickup_map.js`,
  compartilhado com o script de importação.

### Chat (`/chat`): réplica do ClickUp Chat

Visual e comportamento copiados do ClickUp Chat, no mesmo frame claro `.ln` dos módulos
Tarefas/Atividades: coluna de 260px com "Chat", busca, botão de nova mensagem, filtros
**Não lida · DMs · Canais**, seções Favoritos / Canais / Mensagens diretas (negrito + badge
quando há não lidas, `@n` vermelho quando há menção); conversa com cabeçalho de boas-vindas,
separadores de dia ("Hoje", "Ontem", "sexta-feira, setembro 11º"), mensagens agrupadas por
autor (janela de 5 min), toolbar de hover (👍 ❤️ 😂, mais reações, responder, excluir a
própria), chips de reação, resumo de thread (avatares + "N respostas · Última resposta …")
e **thread num painel lateral de 400/440px** com "Enviar também para #canal". Composer com
borda arredondada, barra de ações (+, "Mensagem", negrito/itálico/lista, @, emoji) e envio
com Enter; `@` abre a lista de menções (formato salvo: `@Nome_Sobrenome`).

- **Tabelas** (migrations 041/043 + **086/087**): `chat_channels` ganhou `visibility`
  (público = todo o time vê e lê, mesmo sem ser membro; DMs sempre privadas),
  `description`, `archived`, `project_id` (cliente), `last_message_at`,
  `clickup_channel_id`; `chat_channel_members.favorite`; `chat_messages` ganhou
  `parent_id` (thread), `replies_count`/`last_reply_at` (trigger
  `fn_chat_message_counters`), `reactions` jsonb `{emoji: [user_id]}` (RPC
  `chat_toggle_reaction`), `attachments`, `clickup_message_id`. Não lidas vêm da RPC
  `chat_unread_counts()` (mensagens de outros depois do `last_read_at` da minha associação).
  O trigger de menção não notifica mensagens com mais de 1 h (importação).
- **Código:** `src/pages/Chat.jsx` (shell + URL `?channel=&thread=&msg=`),
  `src/hooks/useChat.js` (dados, uma assinatura realtime para tudo, ações),
  `src/components/Chat/` (`ChatSidebar`, `MessageList`, `Composer`, `ThreadPanel`,
  `ChatMarkdown`, `ChatAvatar`, `NovoDialogs`), `src/lib/chat.js` (datas no formato do
  ClickUp, menções, cores). Conteúdo é markdown renderizado com `react-markdown`
  (`urlTransform` liberando `mention:` e links relativos); links `/tarefas?tarefa=` viram
  chip de tarefa.
- **Importação do ClickUp Chat:** `scripts/baixar_clickup_chat.mjs <saida.json> [dias]`
  (API v3, canais + membros + mensagens + threads) e `scripts/importar_clickup_chat.mjs
  <dump.json> [--dry]` (idempotente pelos ids do ClickUp; converte
  `[@Nome](#user_mention#id)` em `@Nome_Do_Perfil` + `mentioned_user_ids`, e links
  `app.clickup.com/t/<id>` em `/tarefas?tarefa=<uuid>` quando a tarefa existe; DMs só
  quando os dois têm perfil e há mensagem). Feito em 2026-09-15 com os últimos 7 dias:
  98 canais/DMs, 834 mensagens + 218 respostas. Não há sincronização contínua do chat
  (só a importação manual).
