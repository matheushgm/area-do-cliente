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

#### Versionamento do cache local (`localStorage`)

O localStorage usa duas chaves: `rl_projects_v2` (dados) e `rl_projects_schema_v` (número de versão). A função `migrateProjects(data, fromVersion)` em AppContext aplica migrações incrementais ao carregar dados de versões anteriores. Ao adicionar campos no schema local, incremente `SCHEMA_VERSION` e adicione um bloco `if (v < N)` na função.

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

### Exportação PDF (`src/utils/exportPDF.js`)

Utilitário puro (sem dependências externas) que gera HTML inline e abre `window.print()` com CSS específico para impressão. Funções exportadas:

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

### LinksModule — visibilidade na header

`src/components/LinksModule.jsx` — cada link (fixo ou avulso) tem toggle Eye/EyeOff que persiste no campo `hiddenFromHeader[]` dentro do JSONB `links` em `projects_v2`. A header do `ClientProfile` usa um **ResizeObserver** para calcular dinamicamente quantos links cabem no container (substituiu o limite estático `MAX_VISIBLE=5`); quando o container cresce, re-mede e traz links de volta do overflow.

### Componentes extraídos de ClientProfile

`src/pages/ClientProfile.jsx` delega renderização para:
- `src/components/ClientProfile/OnboardingEditForm.jsx` — formulário de edição inline dos dados do projeto
- `src/components/ClientProfile/OnboardingContent.jsx` — exibe os dados do onboarding em modo leitura
- `src/components/ClientProfile/ProjectDocs.jsx` — links para Raio-X e SLA (URLs assinadas do Storage)

### Estilo

Tailwind CSS com design system próprio (`rl-*`). Classes utilitárias como `glass-card`, `btn-primary`, `bg-gradient-dark`, `shadow-glow` são definidas em `src/index.css`.
