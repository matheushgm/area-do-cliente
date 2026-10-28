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

### Roteamento — `src/routes/`

`App.jsx` só compõe: `AppProvider` + `BrowserRouter` + `<Suspense>` + os dois grupos
de rotas. As rotas em si vivem em `src/routes/`:

| Arquivo | Conteúdo |
|---|---|
| `guards.jsx` | `RequireAuth`, `RequireAdmin`, `RequireSquadsAccess`, `RedirectIfAuthed` |
| `appRoutes.jsx` | rotas internas (exigem login) |
| `publicRoutes.jsx` | rotas públicas — **nenhuma pode ser renomeada**, os links já estão com clientes |
| `legacyRedirects.jsx` | `/project/:id` e `/dashboard-teste`, preservando params e querystring |
| `AppLayout.jsx` | shell com a `AppSidebar` + `<Outlet>` |
| `paths.js` | helpers só para paths **com parâmetro** (`cliente(id, secao)`, `aprovacao(token)`…) |

Toda página é `lazy()` + um `<Suspense fallback={<RouteFallback/>}>` por grupo. Abrir
`/login` baixa ~125 kB gzip (entry + react-vendor + supabase + a rota), contra 899 kB
de chunk único antes do split. `vite.config.js` isola só `react-vendor` e `supabase`
em `manualChunks` — forçar um chunk de markdown o puxa para o grafo de entrada.

**Rotas internas** — podem ser renomeadas à vontade, *exceto* as que podem estar
gravadas na coluna `link` de `notifications` (o `NotificationCenter` navega pra lá sem
passar por código nosso); essas ganham redirect em `legacyRedirects.jsx`.

| Rota | Página | Observação |
|---|---|---|
| `/` | `Dashboard` | lista de clientes; o filtro mora na URL (`/?lista=novos\|churn`); `/?visao=crescimento[&mes=yyyy-mm&aba=novos\|churn]` troca a lista pela tela de crescimento da base (`CrescimentoView`) |
| `/cliente/novo` | `NewOnboarding` | criação de projeto |
| `/cliente/:id/:secao?` | `ProjectDetail` → `ClientProfile` | sem seção = hub |
| `/tarefas` `/atividades` `/atividades-15min` `/chat` | — | operação |
| `/banco-de-anuncios` `/banco-de-lps` `/roteiros-express` | — | biblioteca |
| `/dashboard` `/funil` `/ads-roadmap` `/relatorio-squads` | — | dados; `/relatorio-squads` é allowlist |
| `/usuarios` | `UserManagement` | admin only |
| `/login` | `Login` | Supabase Auth (email/senha + Google OAuth) |

As páginas com sidebar são filhas de `<Route element={<AppLayout/>}>`; nenhuma monta a
`AppSidebar` por conta própria. `/cliente/:id` entrou no shell (a sidebar fica visível na
página do cliente) e não tem barra superior desde 2026-10-26: o "Voltar" divide a linha com o "Modo Apresentação" e o "Compartilhar" (só ícone) no topo da coluna esquerda (no mobile, voltar e menu ficam na barra do `ClientProfile`). Só
`/cliente/novo` fica de fora — é um fluxo focado.

**Convenções do escuro no dashboard** (nasceram de uma auditoria de contraste):
`--dt-on-fill` é o texto sobre controle preenchido — era `rgb(var(--rl-card))`, que no
claro calha de ser branco mas no escuro vira a cor do card e some. `--dt-tint-08/10/12`
é o alfa da "tinta" das pílulas (texto colorido sobre fundo do mesmo tom): no escuro a
tinta aproxima fundo e texto, então cai de 0.08/0.10/0.12 para 0.05/0.06/0.07. São três
tokens, um por valor original, para o claro continuar idêntico.

⚠️ **Largura na página do cliente (resolvido em 2026-10-08):** o contêiner do `ProjectDetail`
é item de um flex em coluna e, sem `min-w-0 w-full`, crescia até a largura mínima das colunas e
estourava a tela. Mantenha o `min-w-0`. Desde 2026-10-26 ele não tem mais `max-w-[1800px]`: a página
ocupa a tela toda em monitores grandes. A coluna esquerda do `ClientProfile` tem 340px entre `xl` e
`2xl`, 380px acima e 420px a partir de 2200px; a central ocupa o resto.

#### Deep-link das seções do cliente

`/cliente/:id/:secao` abre direto numa seção. `src/lib/clientSections.js` traduz
`id da seção ↔ slug da URL` — **os ids não podem ser renomeados**: os que aparecem em
`portalModules.js` são chaves de `project_shares.permissions` (jsonb, lido por
`api/portal.js`), e renomear um revoga em silêncio a permissão de um cliente. O slug
existe para deixar a URL legível sem tocar no id.

`ClientProfile` recebe `section` + `onSectionChange` de `ProjectDetail`; sem essas props
cai em estado local, que é o que mantém o `/dev/hub` funcionando fora de rota. Slug
desconhecido redireciona pro hub. Ressalva: `pendingTool` (abrir uma tool específica de
Ferramentas vindo da Jornada) continua em estado local — refresh volta pra lista.

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

- **Carga em duas fases (2026-10-28):** a carga inicial (`sbFetchLista`) traz só as colunas leves de
  `projects_v2` (`LISTA_COLS`), sem tabelas filhas: 108 kB em ~0,4 s, contra 8,8 MB em ~7 s quando tudo vinha de
  uma vez. As colunas pesadas (debriefing, kickoff, promessa, copy_aprovacoes, links…) e as tabelas filhas chegam
  por `carregarDetalhe(id)` (`sbFetchDetalhe`, ~0,7 s), chamado pelo `ProjectDetail`, que só monta o
  `ClientProfile` quando o projeto tem `_completo` (salvar a partir de um projeto incompleto apagaria o que não
  veio). Fora da página do cliente, nenhuma tela lê campos pesados; **coluna nova que a home ou outra lista precise
  ler entra em `LISTA_COLS`**. Projeto criado por `addProject` já nasce completo.
- **Cache local:** só a lista leve fica em `localStorage` (`rl_projects_lista_v1`, `aliviar()` tira as chaves de
  `CHAVES_DETALHE`); a home desenha o cache enquanto a nuvem responde. A chave antiga `rl_projects_v2` (o projeto
  inteiro, que passava da cota do navegador e não gravava) é apagada ao carregar.
- **Debounce:** `updateProject` tem debounce de 1s por `id` antes de escrever no Supabase (via `upsertTimers` ref)
- **Race condition:** `pendingWrites` ref contador — o listener de realtime ignora eventos enquanto há escritas locais pendentes
- **Realtime granular:** listener em `projects_v2` usa handlers separados por evento (`INSERT`/`UPDATE`/`DELETE`), atualizando apenas o registro afetado no state local. No `UPDATE` as chaves montadas das tabelas filhas (`CHAVES_RELACAO`) e o `_completo` ficam como estavam. Mudanças em tabelas filhas (personas, criativos, etc.) **não** disparam realtime — são refletidas apenas via escrita local imediata.
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
- **Módulos:** pelo menu da página (`MenuCliente`, ver "Página do cliente" abaixo)
- **Toast:** notificação bottom-right com `CheckCircle2` verde e auto-dismiss em 2.8s presente em todos os handlers de save

### Lab. Meta Ads (`MetaLabModule`)

- Protocolo de testes em 3 fases sequenciais para campanhas Meta/Facebook, controlado por orçamento diário fixo (R$35/dia padrão):
  - **Fase 01 — Teste de Criativos** (Dias 1–7): testa 11 criativos, seleciona top 3 por CPL ou CTR
  - **Fase 02 — Teste de Públicos** (Dias 8–14): testa 5 públicos (Lookalikes, Interesses, Quentes, Regionais, Demográficos), seleciona top 3
  - **Fase 03 — Teste de Ganchos** (Dias 15–21): com criativo e público campeões
- Tipos de audiência suportados: `remarketing`, `lookalike`, `interesses`
- Persistido via `updateProject(id, { metaLabBudget })` — campo `metaLabBudget` em `projects_v2`
- Sidebar badge de preenchimento: `!!project.metaLabBudget`

### Aprovação de copy pelo cliente (`/aprovacao-copy/:token`)

Ponte entre "Criativos com IA" e a Central de anúncios (`DebriefingModule`). Formato dos
objetos vive em `src/lib/copyLevas.js` (única fonte da verdade). Fluxo:

1. O gestor escolhe criativos de uma geração no `CopyAprovacaoModal` e cria uma **leva**
   com token próprio (`projects_v2.copy_aprovacoes.levas[]`, migration 077). No mesmo patch,
   cada copy vira um anúncio rascunho em `debriefing.ads[]` com `copyAprovacao.status =
   'pendente'` (aba "Ads para aprovação").
2. O cliente decide no link, sem login (`src/pages/AprovacaoCopyPublico.jsx` →
   `api/copy-aprovacao.js`, edge, chave de serviço). Cada item aceita **uma** decisão (409 na
   segunda). Reprovar exige `motivo` + `sugestao`.
3. **Aprovar com alterações:** o cliente edita o texto no link e aprova (`decision:
   'aprovado'` + `conteudo` diferente do enviado). O texto dele vira a copy do item e do
   anúncio; o original fica em `item.conteudoOriginal` / `copyAprovacao.copyOriginal`, e
   `aprovacao.editado = true` acende o selo "c/ alterações" no modal da leva, na Central e
   no modal do anúncio. Texto igual ao enviado = aprovação simples; vazio = 400.
4. Aprovado → anúncio em `aprovado_edicao` (fila do designer). Reprovado → volta a
   `rascunho` com motivo/sugestão à vista. Reenvio reaproveita o mesmo anúncio; copy já
   aprovada nunca é reescrita pelo reenvio.

Não confundir com `/aprovacao/:token` (`api/anuncios-aprovacao.js`): lá o cliente aprova a
**peça pronta** e landing pages, usando o `client_share_token` do projeto.

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

### Portal do cliente / parceiro (`/portal/:projectId`)

Acesso somente leitura a módulos escolhidos de UM projeto, sem Supabase Auth: um link por
cliente e **chaves de acesso** com senha própria (uma por público: "Parceiro X", "Cliente"…),
gerenciadas no módulo **Compartilhamento** do `ClientProfile`
(`src/components/CompartilhamentoModule.jsx`). Cada chave tem rótulo, senha, validade opcional,
ativa/desativada e a matriz módulo × permissão (`none | view | edit`; `edit` está no esquema
mas o portal ainda só renderiza leitura, o botão fica desabilitado "em breve").

- **Tabelas (migration 090):** `project_shares` (`password_hash`, `permissions` jsonb
  `{ modulo: 'view' }`, `expires_at`, `last_access_at`, `access_count`) e
  `portal_login_attempts`. As duas têm RLS ligada **sem policies**: só `api/portal.js` (chave
  de serviço) lê e escreve — a gestão pelo time também passa pela API, que confere admin ou
  membro do squad do projeto (`canManage`).
- **API `api/portal.js` (edge):** gestão com JWT (`list`, `save`, `delete`); visitante com
  `login` (projectId + senha → token de sessão HMAC de 7 dias, invalidado se a senha mudar ou
  a chave for desativada/expirar), `data` (devolve **só** os módulos permitidos, carregados por
  `LOADERS`; `dados` usa a whitelist `DADOS_COLS`, sem contrato/risco/observações internas) e
  `file` (URL assinada de 1 h para `attachments`/`project-docs`/`brand-logos`, exigindo o
  módulo correspondente). Senha: `v1$<salt>$<hmac(SERVICE_KEY)>`. Força bruta: 8 falhas por
  projeto+IP ou 60 por projeto em 15 min → 429.
- **Módulos disponíveis:** `src/lib/portalModules.js` (`PORTAL_MODULES`, ids iguais às seções
  do ClientProfile; importado também pela API — por isso fica em `src/`, já que sob `vercel dev`
  tudo em `/api/` vira rota). Front: `src/lib/portal.js` (chamadas + sessão em `sessionStorage`
  `portal.session.<projectId>`), `src/pages/Portal.jsx` (tela de senha + layout com sidebar
  dos módulos liberados), `src/components/Portal/` (`PortalModule` despacha um renderizador
  por módulo; `PortalResultados` lê o mesmo JSONB do módulo interno; `PortalUI` primitivas).
  Campanhas reaproveita `CampanhasView` exportado de `src/pages/CampanhasPublico.jsx`.
- **Módulos interativos** (únicos com `edit` real): `aprovacao` (`view` lista, `edit` aprova /
  reprova — reaproveita `AprovacaoView` exportado de `src/pages/AprovacaoAnunciosPublico.jsx`)
  e `criativos` (só `edit`, rótulo "Usar" — `CriativosTool` exportado de
  `src/pages/CriativosPublico.jsx`). Os dois componentes aceitam `auth = { token }` (link
  público) ou `auth = { portal, projectId }` (sessão do portal) e `embedded`. No servidor,
  `api/anuncios-aprovacao.js` e `api/criativos-public.js` aceitam o token do portal no header
  `Authorization: Bearer` como alternativa ao `client_share_token` / login de `criativos_users`
  (helper `readPortalSession` em `api/_portal_auth.js`, que também emite o token em
  `api/portal.js`). No histórico de criativos a chave do portal grava `user_id = null` e
  `user_email = portal:<share_id>`. `moduleLevels(m)` em `portalModules.js` diz quais níveis
  cada módulo aceita (sem `levels` = só `view`).
- Os links públicos por `client_share_token` e o login por e-mail de `criativos_users`
  continuam existindo; o portal só centraliza.

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

**`src/components/Editor/`** — editor rico de Markdown (Lexical) e leitura rica, estilo Notion.

- `MarkdownEditor` (`value`/`onChange` em **markdown**, `readOnly`, `minHeight`, `autoFocus`,
  `placeholder`, `onAI(trecho)`, `codigo`): carrega o Lexical sob demanda — o chunk de
  ~124 kB gzip só entra quando alguém clica em editar. Toolbar flutuante na seleção
  (parágrafo/H2/H3/lista, negrito/itálico/tachado/link e o botão **IA** quando `onAI`
  existe), atalhos Markdown ao vivo (`# `, `- `, `**x**`), desfazer. A barra **Visual |
  Markdown** no alto da caixa alterna entre o Lexical e um textarea com o texto cru (os dois
  editam a mesma string); a escolha fica em `localStorage['md.editor.modo']` e vale pra
  todos os editores. `codigo={false}` esconde a barra. A caixa (borda, barra) é do
  `MarkdownEditor`; o `LexicalMarkdownEditor` só renderiza o corpo (`.md-editor-body`).
- `MarkdownView` (`content`, `className`, `codigo`; variantes `md-prose--xs` e
  `md-prose--13` no invólucro): react-markdown + remark-gfm + remark-breaks +
  rehype-sanitize, sem Lexical. Quebra de linha simples vira `<br>`, igual ao editor. O
  ícone `<>` no canto (flutuado à direita, aparece no hover) alterna entre o formatado e o
  Markdown cru em `<pre>`; `codigo={false}` esconde.
- `markdownConfig.js` é a fonte da verdade da ida e volta: nós registrados, transformers
  (sem bloco de código, pra não puxar o Prism), **quebras de linha preservadas** e os escapes
  do exportador desfeitos (`\*` → `*`). Isso mantém o contrato dos criativos, que é lido por
  regex em `splitChunks`, `replaceAdInContent`, nos PDFs e em `copyLevas`. Qualquer mudança
  aqui passa por `node scripts/testar_roundtrip_markdown.mjs [n]`, que reimporta e reexporta
  os últimos n criativos do banco e exige texto idêntico (2026-10-14: 1.732 de 1.734 trechos;
  as 2 diferenças são sublista indentada com 3 espaços que sai com 4).
- CSS em `src/index.css` (bloco "Editor de Markdown", classes `.md-*`, só tokens `rl-*`).
  `/dev/editor` (só em DEV) renderiza os cards de criativo e o editor sem login.
- `TextoEditavelIA` (`valor`, `onSalvar(md)`, `project`, `onRefinar?`, `semIA`, `acoes`):
  leitura + "Editar" + "Refinar com IA" num bloco só, pros textos gerados pela IA que antes só
  podiam ser regerados. O refino padrão é `src/lib/refinarMarkdown.js` (modelo
  `MODELO_REFINO`, hoje `claude-opus-5-5`; devolve o texto inteiro, com o trecho selecionado
  como foco) e o módulo pode trocar por um refino próprio via `onRefinar` (a LP usa o dela,
  que reescreve só a dobra). Fluxo igual ao dos criativos: streaming, versão nova, aprovar
  ou recusar.
- Em uso: edição do criativo em `CreativeResultBlock` (o botão IA da toolbar abre o painel
  de refino com o trecho selecionado; o cabeçalho `# DOR` / `## ROTEIRO` fica fora do editor
  e é recolocado no salvar), "Editar e aprovar" do link público `/aprovacao-copy/:token`,
  copy do anúncio no modal da Central (`DebriefingAdModal`) e no portal; análise do Kickoff,
  pitch e posicionamento do Mecanismo Único, briefing do Produto/Serviço (os três via
  `TextoEditavelIA`, e os dois PDFs de Kickoff e Produto passaram a incluir esses textos);
  dobras da LP (`DobraBlock`); bloco inteiro da headline na Promessa (`editedBlocks[i].block`,
  com `headline`/`sub` ainda gravados ao lado); descrição e comentários da tarefa
  (`TarefaPanel`, variante `md-editor--nu` no composer); briefing da atividade
  (`NovaAtividadePanel`, `NovaTarefaClickUpModal`, leitura em `AtividadePanel` e `HubCentro`);
  observações do cliente (`ObservacoesCampo`, que mantém a assinatura `onChange(e)` com
  `e.target.value`). O `MarkdownBlock` de Criativos continua nos demais lugares (histórico
  de clientes, Roteiros Express, portal). `markdownToHtml` dos PDFs agora usa `remark-gfm`.

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
  curso até hoje (dia parcial) — e devolve o JSONB mesclado, que o componente aplica via `onUpdate` para não
  depender de reload.
- **Env:** `CRON_SECRET` na Vercel autentica o cron (sem ela, o fallback aceita o header
  `x-vercel-cron`). A chave de serviço é lida de `SUPABASE_SECRET_KEY` com fallback para
  `SUPABASE_SERVICE_ROLE_KEY`.

### Atividades (módulo do VertaTask, `/tarefas?aba=atividades`): capacidade do time + planejador, visual do Linear

> **Desde 2026-10-16 o Atividades é uma seção do VertaTask** (item "Atividades" na coluna
> esquerda). O componente é `src/components/Atividades/AtividadesModulo.jsx` (era
> `src/pages/Atividades.jsx`), sem moldura própria: preenche a área principal do VertaTask.
> `/atividades` virou redirect (`RedirectAtividades`) e saiu da sidebar global. O `C` abre a
> nova atividade só nessa seção. "Atividades 15min" (`/atividades-15min`) continua separado.
> O resto desta seção continua valendo.


Módulo único que absorveu o antigo "Capacidade do Time" (`WorkloadDashboard.jsx`,
`public/workload/` e a rota `/workload` foram removidos). A área de conteúdo replica
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
  devolve `aviso`), `estimar` (horas → `time_estimate`) e `tipar` (grava o dropdown "Tipo de
  tarefa" via `POST /task/{id}/field/{fieldId}` e aplica as horas do tipo como
  `time_estimate`; é o tipo que define o tempo). `envClean()` limpa a quebra de linha colada
  nas `CLICKUP_*` da Vercel.
- **Tipo de tarefa no ClickUp:** o campo se chama `"Tipo de tarefa "` (com espaço no fim) e
  duas opções também ("Otimização ", "Criar Campanha "): sempre comparar com `norm()`. Ao ler
  a task, `value` do dropdown pode vir como `orderindex` (número), não como id da opção; o
  `customFieldValue` do motor resolve os dois. `horas_por_tipo` do `DEFAULT_CONFIG` foi
  calibrado em 2026-10-07 pela mediana das estimativas que o time colocou nas tarefas
  concluídas (6 meses, tipos com 3+ amostras); quase não há tempo rastreado no ClickUp
  (43 tasks com `time_spent` em 3.000), então calibrar por tempo real não é viável ainda.
  No painel da pessoa, cada linha tem o seletor de tipo (`TipoEditavel`) ao lado das horas.
- **Tabelas (migration 083):** `atividades_planejadas` (histórico + `snapshot_carga`) e
  `atividades_config` (linha `global`, editável por admin no `ConfigModal`).
- **Local:** o `vercel dev` entrega às funções `/api/*` as variáveis do ambiente *Development*
  da Vercel mais o arquivo **`.env`** da raiz; o `.env.local` NÃO chega nas funções. As
  `CLICKUP_*` ficam num `.env` (ignorado pelo git) com os valores sem a quebra de linha.
- **Mapeamentos usados:** `profiles.clickup_user_id`, `projects_v2.clickup_folder_id`,
  `squads.department_assignments` (responsável sugerido pelo departamento do tipo de tarefa).

### LinksModule — visibilidade na header

`src/components/LinksModule.jsx` — cada link (fixo ou avulso) tem toggle Eye/EyeOff que persiste no campo `hiddenFromHeader[]` dentro do JSONB `links` em `projects_v2`. A header do `ClientProfile` usa um **ResizeObserver** para calcular dinamicamente quantos links cabem no container (substituiu o limite estático `MAX_VISIBLE=5`); quando o container cresce, re-mede e traz links de volta do overflow.

### Tema claro/escuro

A classe `.dark` no `<html>` é a fonte única; `index.html` traz um script anti-FOUC que a
aplica antes da pintura, e `useTheme` (`src/hooks/useTheme.js`) persiste em `localStorage`
na chave `rl_theme`. O toggle fica no menu do avatar da `AppSidebar`.

**No claro existem duas paletas; no escuro, uma só.**

| Onde | Claro | Escuro |
|---|---|---|
| App em geral | `:root` (`src/index.css`) | `.dark` |
| Telas com a classe `fx` (tema Fynix) | `html:not(.dark) .fx` | herda o `.dark` |
| Dashboard de Tráfego (`public/dash-teste/`) | `:root` do `dashboard.css` + `body.th-fynix` do `theme-fynix.css` | `.dark` e `html.dark body.th-fynix` |

No claro, o **`:root` do app e o `dashboard.css` são a mesma paleta** de propósito (o cabeçalho
do `dashboard.css` diz isso) — não os desencontre; o `theme-fynix.css` é a outra, a do rebrand
Verta, replicada pelo `.fx`.

No escuro é **um escuro só** (neutros com tom azulado, derivados do navy do Fynix), declarado
em três lugares que precisam andar juntos: `.dark` do `src/index.css`, `.dark` do
`dashboard.css` e `html.dark body.th-fynix` do `theme-fynix.css`.

⚠️ Os tokens claros do `fx` são escopados em `html:not(.dark)` **de propósito**. Se voltarem
para um `.fx` solto, vencem o `.dark` (são mais específicos no elemento) e todas as telas `fx`
voltam a ficar claras no tema escuro.

**Dashboard de Tráfego:** era hex cravado (356 literais) e preso no claro. Agora é todo
`rgb(var(--token))`, e `viewer.html` tem um script que lê `localStorage.rl_theme` (mesma
origem) e põe `.dark` no próprio `<html>`; um listener de `storage` faz o iframe acompanhar
o toggle do app ao vivo, sem reload.

**Armadilha ao mexer no escuro do `theme-fynix`:** `--fx-lime`, `--fx-green` e `--fx-lime-3`
eram usados como texto *e* como fundo de botão preenchido. No escuro isso não inverte junto —
quem preenche virou `--fx-fill`, `--fx-fill-2` e `--fx-fill-hover`, que precisam ficar escuros
o bastante para o texto branco por cima (hoje 5.8:1 e 13.4:1).

### Estilo

Tailwind CSS com design system próprio (`rl-*`). Classes utilitárias como `glass-card`, `btn-primary`, `bg-gradient-dark`, `shadow-glow` são definidas em `src/index.css`.

### Sidebar global recolhível

`AppSidebar` tem modo recolhido (56px, só ícones com tooltip) para sobrar espaço aos
módulos. Estado em `localStorage` (`app.sidebar.collapsed`), compartilhado entre páginas pelo
hook `useSidebarCollapsed` (evento `app-sidebar-collapsed`). Alterna pelo botão no topo da
sidebar ou pela tecla `[` (fora de campos de texto). Só no desktop; no mobile continua o overlay.

**Recolhe sozinha na página do cliente:** o `AppLayout` tem um `useLayoutEffect` atrelado a
`pathname.startsWith('/cliente/')` que recolhe a sidebar ao abrir qualquer cliente (antes da
primeira pintura) e, ao sair, devolve o estado que o usuário tinha, sem sobrescrever a
preferência global. Trocar de seção (`/cliente/:id/:secao`) não refaz o efeito, então reabrir
a sidebar à mão vale até sair do cliente. O efeito usa `lerRecolhida`/`definirRecolhida`
(exportadas de `AppSidebar.jsx`), **não** o hook `useSidebarCollapsed`: cada instância do hook
registra o atalho `[`, e duas instâncias desfazem o toggle uma da outra.

### Tarefas (`/tarefas`): réplica do ClickUp dentro da Área do Cliente

Substitui o ClickUp na operação. **Visual:** o mesmo do módulo Atividades (frame `.ln`
com tokens `ln-*`, barra superior e barra de views de 44px, `ln-tab`/`ln-pill`/`ln-iconbtn`/
`ln-primary`, linhas de 40px em grid com `ln-row-hover`, detalhe num painel lateral (480px por padrão,
redimensionável) que fica **sempre por cima** da lista (desde 2026-10-27; antes empurrava a partir de 1200px), com fundo
escuro só abaixo de 1200px e botão de expandir; acima disso a lista segue clicável e clicar em outra linha troca a tarefa).
A coluna esquerda do VertaTask (`TarefasSidebar`) recolhe no desktop pelo botão ao lado do título "Tarefas" do cabeçalho
(`localStorage['tarefas.colunaRecolhida']`); em Chat e Atividades, que não têm esse cabeçalho, ela aparece sempre. Nada de modal centralizado nem tokens `rl-*` dentro do módulo. Hierarquia idêntica: **Pasta** (uma por cliente, ligada a
`projects_v2` por `project_id`) → **Lista** (com seus próprios statuses em `statuses` jsonb)
→ **Tarefa** (com subtarefas via `parent_id`) → **Comentários**. Tabelas `tarefas_pastas`,
`tarefas_listas`, `tarefas_itens`, `tarefas_comentarios` (migration 084; RLS liberada para
todo `authenticated`; as quatro estão na publicação realtime).

- **Página** `src/pages/Tarefas.jsx`: coluna de pastas/listas (`TarefasSidebar`, dentro do
  frame), barra com Lista/Quadro, agrupamento (status, vencimento, responsável, prioridade,
  lista), filtro de responsável, busca, toggle de concluídas e densidade. Atalhos: `C` abre
  a tarefa nova, `Esc` fecha o painel. **Tarefa nova é rascunho** (2026-10-27, `NovaTarefaPanel`): "+ Tarefa"/`C`
  abrem o painel lateral com lista (busca pelo cliente ou pela lista, sem acento), título, propriedades, descrição, subtarefas, relações e checklists, e nada é gravado até "Criar tarefa"
  (Ctrl+Enter; a tarefa, depois as subtarefas na mesma lista e as relações em `tarefas_relacoes`); na pasta a
  lista "Geral" vem marcada, em Minhas/Todas a pessoa escolhe a lista (a última visitada vem marcada) e em Minhas o
  responsável já é ela. Com o painel aberto e largura < 1600, a lista esconde tipo,
  dificuldade, criada e conclusão (`compacto`). Seleção e tarefa aberta vivem na URL
  (`?pasta=`, `?lista=`, `?minhas=1`, `?tarefa=`). Preferências em `localStorage` (`tarefas.*`).
- **Área compartilhada (2026-10-26):** a página é só a moldura (coluna de pastas, cabeçalho, sincronização,
  Intake, Cycles, Templates, Pages, Analytics, Chat, Atividades). A área de tarefas inteira (abas de views,
  barra, Lista/Quadro/Calendário/Gantt, sidebars da view, seleção em massa, "Aplicar template", painel da
  tarefa, atalhos C/Esc/Ctrl+Enter) é `src/components/Tarefas/AreaTarefas.jsx`, usada também pelo módulo
  **aba Tarefas do hub da página do cliente** (`TarefasDoCliente.jsx` dentro do `HubCentro`, como a aba Resultados;
  travada na pasta ativa do cliente, com as listas dela em cima e `?lista=`/`?view=`/`?tarefa=` na URL do cliente). Mexer na área
  muda os dois lugares. Ganchos: `cabecalho(api)`, `secao(api)` (conteúdo no lugar das views), `antesDaView`
  (Cycles), `largura`, `atalhoCriar`, `onIrParaLista`, `onAbrirTemplate`; `api` = `{ listaPadraoId,
  totalAbertas, aguardandoClickup, novaTarefa, recarregar, abrirTarefa, usarModelo, todos, mostrarViews }`. Na pasta, a tarefa
  nova cai na lista "Geral" (ou na primeira, se não houver). No cliente não há sincronização automática.
- **Dados** `src/hooks/useTarefas.js`: lê a estrutura inteira e as tarefas só da pasta/lista
  aberta (paginado de 1000 em 1000), atualização otimista e canal realtime. Trocar status
  passa por `mudarStatus` (calcula `status_tipo` e `data_conclusao`).
- **Desempenho da Lista (2026-10-27; "Todas" tem ~2.200 abertas, ~900 de topo):** cada grupo desenha 50 linhas e
  mais 50 quando o fim chega a ~600 px da área visível (`MaisLinhas`, `IntersectionObserver` no contêiner que rola;
  o botão "Mostrar mais (N)" é a reserva). A `Linha` é memorizada (`igualLinha`): o ctx muda a cada tarefa alterada,
  então a comparação o ignora; o que a linha desenha do ctx entra em `versao` (ListaView), os eventos
  (`EVENTOS_LINHA`) passam por proxies que chamam o ctx atual, e as setas leem irmãs e ordem na hora do clique.
  **Campo novo do ctx que a linha desenha precisa entrar em `versao`**, senão a linha não atualiza. O realtime de
  `tarefas_itens` aplica em lote a cada 150 ms, e `carregarAbertas` pede as páginas em paralelo (`selectParalelo`,
  com desempate por id). Medido no `/dev/lista?x=12` (948 de topo, modo dev): abrir uma tarefa caiu de 2,5 a 4,4 s
  para 70 a 100 ms. A carga continua com `select('*')`: o painel, duplicar e "Salvar como template" usam
  `descricao` e `anexos` da linha carregada.
- **Lista = cara do ClickUp (2026-10-18, pedido do Matheus):** `ListaView.jsx` agrupa por
  **Data de vencimento** por padrão ("Em atraso 47", "Hoje", "Amanhã"…), repete o cabeçalho de
  colunas em cada grupo e usa as colunas na ordem do ClickUp: Nome · Status (pill preenchida,
  BACKLOG cinza) · Tipo de tarefa (pill colorida) · Responsável · Data criada · Data de vencimento
  ("há N dias"/"ontem" em vermelho até 7 dias, "Hoje" verde, "Amanhã" amarelo) · Data de conclusão
  (`data_conclusao`, só leitura: gravada ao ir para um status de concluída, aqui por `mudarStatus` ou no ClickUp por
  `date_done`; também ordena e é campo dos filtros avançados) · Prioridade
  (bandeira) · Sprints (= Cycle, `ciclo_id`) · Estimativa de tempo (ampulheta) · Cliente (pílula cinza discreta,
  com o projeto da pasta). A coluna Pontos do Sprint foi retirada a pedido do Matheus. Os editores de
  `Campos.jsx` aceitam `render` para trocar só o gatilho visual. Com o painel aberto (`compacto`)
  ficam Status, Responsável, Vencimento, Prioridade e Estimativa. Para conferir sem login:
  `/dev/lista` (só em DEV, lê `src/dev/fixtures/tarefas.json` via `import.meta.glob`).
- **Componentes** `src/components/Tarefas/`: `Campos.jsx` (editores inline em Popover via
  portal: status, responsáveis, data, prioridade, tipo, dificuldade, estimativa, `AdicionarInline`),
  `ListaView` (grid agrupado, subtarefas indentadas), `QuadroView` (kanban com `ln-card` e
  arrastar entre colunas de status/prioridade), `TarefaPanel` (corpo do painel lateral:
  título, propriedades em `dl`, descrição markdown, subtarefas, checklists, anexos no bucket
  `task-attachments`, comentários). Status é o círculo do Linear na cor do status do
  ClickUp (`StatusIcon`); prioridade é a bandeira na cor do ClickUp (`PrioridadeIcon`, a mesma no Atividades).
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
- **Sincronização ClickUp → VertaTask** (reescrita em 2026-10-18 para o espelho ficar fiel).
  A lógica mora em `api/_tarefas_sync_core.js` (`sincronizar()`), usada por dois chamadores:
  `api/tarefas-sync.js` (Node, 60s: cron diário `0 9 * * *`, botão "ClickUp há X min" em
  /tarefas e automático ao abrir a página se +30 min) e `scripts/sincronizar_clickup.mjs`
  (local, sem limite de tempo; `--completo` passa por TODAS as tarefas, `--reconciliar`
  confere o que sumiu do ClickUp, `--since=ISO`, `--sem-comentarios`, `--espacos=id,id`).
  Mão única: nunca escreve no ClickUp (a volta é a outbox, abaixo). O mapeamento ClickUp→linha vive em
  `api/_tarefas_clickup_map.js` (`mapTarefa`, `mapLista`, `mapPasta`, `comHora`).
  - **Spaces:** cobre Clientes, Operações e PROMPTS (`SPACES_PADRAO`; env opcional
    `CLICKUP_SYNC_SPACE_IDS`). Templates e o space privado "Matheus" ficam de fora. Pastas e
    listas guardam `clickup_space_id`/`espaco` (migration 099); a `TarefasSidebar` mostra as
    pastas de Clientes na seção de sempre e os outros spaces em seções com o nome do space.
  - **Estrutura:** cria pastas/listas novas e ATUALIZA nome, ordem, arquivada, datas da lista
    (`data_inicio`/`data_vencimento`), statuses e o vínculo pasta→projeto quando ainda não
    há; pastas e listas arquivadas no ClickUp ficam `arquivada=true` (listas arquivadas dentro
    de pasta só na rodada `--completo`, é uma chamada por pasta).
  - **Tarefas:** alteradas desde `tarefas_sync.ultimo_inicio` - 15 min (ou todas em
    `--completo`), com subtarefas e fechadas. Pais que faltam são buscados um a um em rodadas
    até fechar a hierarquia; a gravação é por **profundidade** (pais antes dos filhos, também
    entre lotes de 200), e filho cujo pai não pôde ser gravado fica sem pai + aviso. Isso
    corrigiu o `tarefas_itens_parent_id_fkey` que travou o cron de 14/10 a 18/10/2026.
    Campos novos: `data_fechamento` (date_closed), `vencimento_com_hora`/`inicio_com_hora`
    (no ClickUp, data sem hora fica às 04:00 de São Paulo = 07:00 UTC; a flag é inferida por
    isso, o endpoint do time não devolve `due_date_time`), `clickup_removida_at`.
  - **Reconciliação** (`?reconciliar=1` / `--reconciliar`): lista as abertas no ClickUp e
    compara com as abertas aqui; o que sumiu de lá é rebuscado: fechada/movida → atualiza,
    apagada (404) → `arquivada=true` + `clickup_removida_at`.
  - **Conflito:** `clickup_sync_at` marca a última escrita da sincronização e o trigger de
    `updated_at` não a bumpa (migration 085; a 099 corrigiu o trigger, que quebrava qualquer
    UPDATE em `tarefas_listas` por acessar `new.clickup_sync_at` fora de `tarefas_itens`).
    `updated_at > clickup_sync_at` = editada na Área; nesse caso, se o ClickUp estiver mais
    antigo que a edição, a tarefa é pulada (`puladas_conflito`), senão o mais recente vence.
  - **Não vem do ClickUp:** anexos, tempo rastreado (`time_spent` exige o endpoint de time
    entries), dependências/links entre tarefas e tarefas arquivadas lá. Comentários só das
    abertas que mudaram (máx. 40 no endpoint, 400 no script).
  - Auth do endpoint: `CRON_SECRET` ou JWT. Para testar local: `node scripts/sincronizar_clickup.mjs --since=<ISO>`.
  - **Trava (migration 109, 2026-10-23):** uma rodada de `/api/tarefas-sync` por vez.
    `tarefas_sync_travar('clickup', 90)` marca `tarefas_sync.rodando_desde`; quem chega com
    outra em andamento recebe `{ ok: true, emAndamento: true }` sem chamar o ClickUp (o /tarefas
    mostra um toast) e o `finally` solta com `tarefas_sync_soltar`. Passados 90 s a trava vale
    como morta (a função tem 60 s), então uma rodada que estourou não prende as seguintes. As
    duas RPCs só rodam com a chave de serviço.
  - **Webhook (`api/clickup-webhook.js`, 2026-10-23):** caminho principal das mudanças do dia a
    dia; o polling acima vira rede de segurança. Handler Web (`export async function POST`) para
    ler o corpo cru: `X-Signature` = HMAC-SHA256 do corpo com `CLICKUP_WEBHOOK_SECRET`
    (comparação em tempo constante; errada = 401). `CLICKUP_WEBHOOK_ID`, se definida, descarta
    eventos de outro webhook. A lógica é `processarEventoTarefa` em
    `api/_tarefas_webhook_core.js`: lê só a tarefa do evento (`GET /task/{id}`), descarta o que
    não é dos spaces sincronizados, cria lista/pasta que ainda não existam, grava o pai que
    faltar antes do filho e aplica as mesmas regras de conflito e de mesma versão da rodada. A
    regra de mesma versão é o que evita o eco: o push grava o `date_updated` que o ClickUp
    devolveu, então o evento da nossa própria escrita chega como `sem_mudanca`. `taskDeleted`
    ou 404 = `arquivada` + `clickup_removida_at`; **401 não arquiva** (token vencido também
    responde 401). Evento de comentário relê os comentários da tarefa (idempotente). Também
    traz os anexos do ClickUp da tarefa. **Evento de tarefa com item da outbox `processando`
    (ou `pendente` há menos de 2 min) é ignorado**: o push está escrevendo essa tarefa e grava
    ele mesmo o vínculo e a versão final. Linha que já existe mantém `created_at`/`criado_por`
    (o upsert antigo trocava o autor pelo dono do token; a rodada periódica segue a mesma regra). Erro ao processar responde 200 com `ok: false` (o
    ClickUp suspende webhook que falha muito) e o último evento fica em `tarefas_sync`, linha
    `clickup_webhook`. Registro: `node scripts/registrar_webhook_clickup.mjs [listar | criar
    --url= | atualizar --id= | apagar --id=]`, um webhook para o workspace inteiro; o secret só
    aparece na criação.

#### VertaTask (evolução do `/tarefas`, migration 094)

O módulo passou a se chamar **VertaTask** (rótulo na sidebar e no breadcrumb; a rota continua
`/tarefas`, há links gravados em chat e notificações). Ganhou quatro seções no cabeçalho, via
`?aba=` (sem `aba` = Tarefas): **Intake**, **Cycles** (`?aba=ciclos&ciclo=<id>`) e **Templates**
(`?aba=templates[&template=<id>]`), mais a view **Calendário** ao lado de Lista/Quadro. Inspirado no Plane.
(Os **Modules** do Plane existiram de 16/10 a 22/10/2026 e foram removidos a pedido do Matheus: toda
tarefa de um cliente fica na pasta/lista dele. Ver "Templates" abaixo e a migration 108.)

- **Tabelas** (migration 094, RLS liberada para todo `authenticated`, realtime ligado):
  `tarefas_ciclos` (nome, inicio, fim),
  `tarefas_intake` (titulo, descricao, origem, `origem_ref` único para idempotência de quem alimentar
  a fila, `project_id`, prioridade, `status` pendente/aceito/recusado, `tarefa_id`, `motivo_recusa`,
  `payload`). `tarefas_itens` ganhou `ciclo_id` (`on delete set null`). A sincronização
  com o ClickUp não escreve nessa coluna.
- **Dados:** `src/hooks/useVertaTask.js` (ciclos, intake, etiquetas, views e templates, com realtime) e,
  em `useTarefas`, `carregarPorCampo('ciclo_id', valor)` (tarefas de um ciclo de qualquer lista, mais
  as subtarefas). A seleção da página ganhou o tipo `ciclo`; o filtro por ciclo reaproveita a mesma
  lista/quadro/calendário. Tarefa criada dentro de um ciclo já nasce nele (na última lista visitada,
  `tarefas.sel` em localStorage).
- **Regras puras** em `src/lib/vertatask.js`: fase do ciclo (atual/próximo/encerrado), sugestão do
  "Novo cycle" (próxima segunda, 14 dias) e `calcularBurndown` (por **tarefas** ou por **horas
  estimadas** = `estimativa_min`; o real usa `data_conclusao`; tarefa sem estimativa não entra na
  conta de horas). Agrupar por Cycle foi acrescentado em `AGRUPAMENTOS` (agrupamento gravado que não
  existe mais, como o antigo "Module", volta ao padrão por `agrupamentoValido` em `Tarefas.jsx`).
- **Componentes** (`src/components/Tarefas/`): `IntakeView` (aceitar cria a tarefa na lista "Geral"
  da pasta escolhida com o responsável escolhido; recusar guarda o motivo; recusados podem voltar
  para a fila), `CiclosView` (abas dos ciclos, resumo, burndown em SVG), `CalendarioView` (tarefas
  de topo no dia do vencimento), `RelacaoCampo` (Cycle no painel da tarefa).
- **Quem alimenta o Intake hoje:** só o botão "Novo pedido". Ligar a reprovação de anúncio
  (`api/anuncios-aprovacao.js`), a Central de Otimizações e o playbook é a próxima etapa (inserir em
  `tarefas_intake` com `origem` e `origem_ref`).
- **Visual:** a página usa `ln vt`. O escopo `.vt` (em `src/index.css`, logo depois do `.ln`) troca
  os tokens `--ln-*` pela paleta da Verta (azul `#2A25F0`, neutros frios, Sora nos títulos e Manrope
  no corpo, cartões brancos de borda 1px e raio 12) e redefine `ln-card`, `ln-pill`, `ln-tab`,
  `ln-primary` e `ln-input` com o look do protótipo; no escuro só o azul muda. Lista agrupada em
  cartões sobre fundo `ln-bg`. Os componentes continuam usando só `ln-*`.
- **Estrutura igual à do protótipo:** a coluna esquerda (`TarefasSidebar`) tem a marca, a navegação
  (Intake com contador, Minhas tarefas, Todas as tarefas, Cycles, Templates) e a
  árvore Clientes (pasta → listas, com bolinha colorida e abertas carregadas). O cabeçalho é só o
  título da seção (Sora 20px) com o breadcrumb da pasta/lista; as seções não ficam mais em abas no
  topo. "Todas as tarefas" = `?todas=1` (`carregarAbertas`: tudo que não está concluído).
- **Visualizações (views) dentro da pasta (2026-10-26, migration 112; o arquivo nasceu como 110 e foi renumerado ao juntar com a 110 do outbox):** abas no modelo do ClickUp, sem
  a antiga seção "Views salvas" da coluna esquerda. Desenho aprovado no protótipo `/dev/prototipo-views`
  (branch `prototipo-views-na-pasta`, já apagado).
  - **Escopo** (`escopoDaSelecao` em `src/lib/viewsTarefas.js`): pasta do cliente (vale para a pasta e as
    listas dela), "Minhas" ou "Todas". Cycles e lista solta não têm escopo: só as 4 padrão, sem salvar.
  - **Abas** (`AbasViews` em `BarraViews.jsx`): as 4 padrão (Lista, Quadro, Calendário, Gantt; a Planilha saiu em 2026-10-26 por repetir a Lista, e a linha `padrao_tipo = 'planilha'` que o check da 110 ainda aceita não é mais criada)
    e depois as salvas do escopo, mais "+ Visualização". As padrão também são linhas de `tarefas_views` (a 113 trava nelas dono, escopo, pasta e padrao_tipo; só nome e config mudam)
    (`padrao_tipo`), criadas na 1ª vez que alguém salva uma (`salvarViewPadrao`): qualquer pessoa edita,
    ninguém exclui, sempre públicas, tipo fixo. **Exceto em "Minhas tarefas"** (migration 114): lá cada pessoa tem as
    suas padrão (uma linha por tipo e dono, privada, só o dono edita; `padraoPessoal` em `viewsTarefas.js`). As salvas: só o dono edita/exclui; pública ou privada.
    A aba ativa vai na URL (`?view=lista` nas padrão, `?view=<uuid>` nas salvas) e fica lembrada por
    escopo em `localStorage` (`tarefas.viewAtiva.<escopo>`).
  - **config** (jsonb): `{ tipo, agrupar, subtarefas, responsaveis[], concluidas, filtros }`;
    `normalizarConfig` também lê o formato antigo (view/filtroResp/mostrarConcluidas/etiqueta).
  - **Rascunho:** a tela mostra o rascunho da view ativa (`rascunhoView` em `Tarefas.jsx`). Mexer pela
    barra (`FerramentasView`) só muda a tela e acende o botão dividido "Salvar visualização ▾" (salvar,
    Ctrl+Enter fora de campos; salvar como nova; reverter). A sidebar de configurações
    (`PainelConfigView`, engrenagem) grava na hora. Quem não pode editar a view mexe só na tela e salva
    como nova.
  - **Barra:** à esquerda o agrupador e o modo das subtarefas; à direita busca (ícone que vira campo),
    filtros (funil, com contador e ponto laranja se diferem dos salvos), responsáveis (múltipla seleção;
    nenhum = todos), concluídas, densidade (Lista), engrenagem e "+ Tarefa ▾" (a seta é o `ModelosMenu`
    de templates). O "Nova tarefa" e o "Templates" do cabeçalho só aparecem nas seções sem essa barra.
  - **Subtarefas:** Recolhidas (padrão) e Expandidas (`ctx.expandirTudo`) ficam sob o pai e os filtros e o
    agrupamento olham só o pai, como no ClickUp; Separar avalia e agrupa cada subtarefa sozinha, sem
    aninhar, com "↳ pai" ao lado do título (`ctx.rotuloPai` da `ListaView`).
  - **Filtros avançados** (`PainelFiltros.jsx` + motor em `src/lib/filtrosTarefas.js`):
    `{ op, grupos: [{ op, regras: [{ campo, operador, valor }] }] }`. Condição conforme o tipo do campo
    (opção, lista, data com períodos/antes/depois/atrasada, número, texto); E/OU dentro do grupo e entre
    grupos (1º "Onde", 2º seletor, 3º+ o mesmo E/OU em texto); regra incompleta não filtra. Somam (E) com
    os da barra e são rascunho da view, como a barra. A etiqueta saiu da barra e virou campo daqui.
  - **Sidebars** à direita (340 px; filtros 600 px): empurram o conteúdo quando sobra largura, senão
    sobrepõem; Esc fecha; abrir uma tarefa fecha a sidebar e vice-versa.
  - **config** também guarda `ordenar` (`{ campo, dir }`: cabeçalhos da Lista clicáveis, sobe → desce →
    ordem manual; `ordenarPorCampo` em `src/lib/tarefas.js`, vazios sempre no fim; vale para as subtarefas
    abertas), `calendario` (`mes` | `semana`) e `colunas` da Lista (`{ ordem, ocultas }`, null = padrão; ver abaixo).
  - **Colunas da Lista:** ordem e visível/oculta por view (`COLUNAS_LISTA`, `normalizarColunas`, `colunasVisiveis` em
    `viewsTarefas.js`; editor `ColunasLista.jsx`: arrastar pela alça ou ↑↓ com ela em foco, olho, "Restaurar padrão").
    O Nome é fixo e sempre visível; coluna nova entra no fim, visível. Abre pelo "+" no fim do cabeçalho de colunas
    (rascunho, como a ordenação) ou na sidebar de configurações (grava na hora). Com o painel da tarefa aberto
    (`compacto`) valem só as colunas da versão compacta, na ordem da view. Ocultar a coluna ordenada tira a ordenação
    (`patchColunas`).
  - **Largura do Nome:** só a coluna Nome é redimensionável, pela alça na borda direita do cabeçalho (arrastar, ← → de
    20 px com ela em foco, duplo clique volta ao automático = `minmax(420px, 1fr)`). **Não é da view** (desde
    2026-10-27): é preferência local, `localStorage['tarefas.larguraNome']` (px, 200 a 900, `normalizarLarguraNome`),
    a mesma em todas as views; `larguraNome` antigo gravado em views é ignorado. Enquanto arrasta, todos os grupos mudam juntos.
  - **Largura do painel da tarefa:** alça na borda esquerda (`AlcaPainel` em `AreaTarefas.jsx`: arrastar, ← → de 20 px,
    duplo clique volta a 480), entre 380 e 1000 px, em `localStorage['tarefas.larguraPainel']`. Como o painel fica
    por cima, a lista não muda de largura e não entra no modo `compacto` por causa dele.
    Setas ↑↓ no hover da linha mudam a ordem manual (`posicao`, não vai para o ClickUp); com ordenação por
    coluna, a primeira seta congela a ordem da tela como manual, tira a ordenação e então move.
  - **Calendário:** Mês ou Semana, sempre de domingo a sábado (igual aos grupos de vencimento da Lista e
    aos períodos "Esta semana"/"Próxima semana" dos filtros). Na Semana cada dia é uma coluna com todas as
    tarefas; no Mês, "+N mais" abre a semana do dia.
  - **Minhas tarefas:** o filtro de responsável da barra e da sidebar fica travado (é sempre você); o campo
    Responsáveis dos filtros avançados continua.
  - **Status por tarefa:** Minhas/Todas misturam listas; `ctx.statusesDe(item)` faz o seletor de status
    (Lista) e os cartões mostrarem só os status da lista da tarefa, e o Quadro por status recusa
    soltar numa coluna que não existe na lista da tarefa arrastada.
  - **Subtarefas fora da Lista:** Expandidas só existe na Lista (nas outras fica desabilitada e vale como
    Recolhidas); em Separar, Quadro/Calendário/Gantt mostram o pai (`ctx.nomePai`).
- **Paridade com o Plane (migration 095, 2026-10-16).** Reimplementado do zero a partir do que o
  repositório do Plane faz (o código dele é AGPL-3.0, nada foi copiado):
  - **Etiquetas** (`tarefas_etiquetas` + `tarefas_itens.etiquetas uuid[]`; o `tags` do ClickUp segue à parte), filtro na barra,
    chips no quadro.
  - **Relações** (`tarefas_relacoes`: bloqueia, duplica, relacionada; o inverso é calculado na tela).
  - **Histórico** (`tarefas_atividade`, preenchida por trigger `tarefas_log_atividade`; só registra edição
    de pessoa logada, a sincronização do ClickUp usa chave de serviço e fica de fora) e **seguidores**
    (`tarefas_seguidores`, quem comenta ou recebe a tarefa passa a seguir). Trigger de comentário e de
    atribuição escrevem em `notifications` (`tarefa_comentario`, `tarefa_atribuida`, link `/tarefas?tarefa=`).
  - **Views compartilhadas** (`tarefas_views`, `acesso` publica/privada). Desde a migration 112 são as
    abas da pasta; ver "Visualizações (views) dentro da pasta" acima.
  - **Pages** (`?aba=paginas&pagina=<id>`, `tarefas_paginas`, `usePaginas`, `PaginasView`): markdown com
    barra de formatação, subpáginas, cliente, privada/do time, bloqueio (só o dono edita),
    arquivo, salvamento automático e **versões** (`tarefas_paginas_versoes`, guarda o texto anterior se
    a última versão tem +5 min).
  - **Analytics** (`?aba=analytics`): RPC `vertatask_analytics(p_dias)` devolve tudo em um JSON (abertas,
    atrasadas, criadas/concluídas por dia, tempo médio, por status/prioridade/pessoa/cliente, cycles).
  - **Gantt** como visão ao lado de Lista/Quadro/Calendário (a Planilha também veio daqui e saiu em 2026-10-26).
  - **Cycles:** editar (nome, datas, objetivo, responsável) e "Mover pendentes" para outro cycle.
  - **Intake:** adiar (volta à fila na data), marcar duplicada, contato de quem pediu, link público
    `/pedido/:token` (`api/intake-publico.js`, edge, `client_share_token`, 8 pedidos/hora por cliente) e entrada
    automática por `api/_intake.js` (`registrarIntake`, idempotente por `origem_ref`) quando o cliente
    **reprova** anúncio, LP (`api/anuncios-aprovacao.js`) ou copy (`api/copy-aprovacao.js`).
  - **Pedido do cliente por tipo (2026-10-27):** o `/pedido/:token` virou formulário em 3 etapas (tipo →
    detalhes → revisão). Tipos e campos vivem em `src/lib/pedidoTipos.js`, lido pela página
    (`PedidoPublico.jsx`), pelo servidor (valida com `validarPedido`, monta título e descrição markdown com
    `montarPedido`) e pelo Intake: Criativo estático, Criativo de vídeo e Landing page (espelham
    `tarefas_modelos.nome` em `template`), Nova campanha, Orçamento, Alteração de WhatsApp e Outras. Campo
    `drive` = link do Google Drive conferido **sem login** pelo servidor (`GET ?token&drive=URL`: pasta/arquivo
    aberto dá 200 com o nome no `<title>`, fechado cai em `accounts.google.com` ou 401, apagado 404); fechado
    barra o envio, e o POST confere de novo. O pedido grava `payload` `{ versao: 2, tipo, template, prazo,
    respostas, itens }`; o cartão do Intake mostra os `itens`, e para tipo com template oferece **Aplicar
    template** (`api.usarModelo(tpl, listaGeral, pedido)` do `AreaTarefas`: o pedido vai para a descrição da
    tarefa raiz e sai da fila como aceito). "Só uma tarefa" usa `payload.prazo` como vencimento. O GET devolve
    `prazos` (dias úteis até publicar, lidos do template) para a dica de prazo. Rascunho do formulário em
    `localStorage` (`pedido.rascunho.<token>`) e nome/contato lembrados (`pedido.contato`). POST sem `tipo`
    (formato antigo) continua aceito.
  - **Não portado de propósito:** pontos de estimativa (usamos `estimativa_min`), rascunhos, sticky notes,
    favoritos, webhooks/API pública, importadores e editor rich text (Pages usa markdown).
- **Templates (construtor, 2026-10-22, migrations 107/108):** receita reutilizável de uma entrega
  (ex.: "Criação de Landing Page") aplicada na lista de um cliente. Substituiu os Modules e o antigo
  "Modelo de tarefa" (que guardava uma tarefa só, com subtarefas só de título).
  - **Dados:** `tarefas_modelos` (`nome`, `descricao`, `itens` jsonb, `dono_id`, `updated_at`; RLS do time,
    realtime). `itens` é uma árvore tarefa → subtarefas; cada item tem os atributos da tarefa
    (descrição, prioridade, tipo, dificuldade, departamento[], estimativa, etiquetas, checklists), o
    **prazo relativo** (`inicio_dia`/`vencimento_dia` em **dias úteis** depois da data de início; D+0 =
    o próprio dia), a **regra de responsável** (`responsavel.modo`: `departamento` = pessoa que o squad
    do cliente designou ao departamento em `squads.department_assignments`, com o alias
    `DEPARTAMENTO_ALIAS_SQUAD` de `constants.js`, exceto o departamento **Cliente**, que vai para o perfil
    do usuário Cliente do ClickUp, `CLICKUP_USUARIO_CLIENTE` = 84048101, achado por `perfilDoUsuarioCliente`;
    `pessoa` = fixa; `nenhum`) e `depende_de[]` (ids de
    outros itens). O formato e as regras puras (dias úteis, validação de ciclo, `planejarAplicacao`,
    `templateDaTarefa`, edição da árvore) estão em `src/lib/templates.js`; `itensDoTemplate` ainda lê
    o `payload` antigo, que a 107 converteu e a 108 apaga.
  - **Telas (com a cara da lista de um cliente, 2026-10-22):** as três reaproveitam a `ListaView`, que
    ganhou ganchos opcionais sem mudar a lista de tarefas: `colunas` (troca as colunas),
    `ctx.renderCelula(k, item)` (célula própria; `undefined` = célula padrão), `ctx.semStatus`,
    `ctx.acaoLinha(item)` (última coluna), `ctx.expandirTudo` (com subtarefas abertas, só fecha se a pessoa
    recolher), `ctx.acoesHover === false` (sem os botões de hover e sem "Adicionar subtarefa") e `ctx.simples`
    (sem cabeçalho de grupo, sem arrastar/selecionar e sem o "+" do cabeçalho de colunas: nos Templates há um
    grupo só e nada disso teria ação). As três telas de Templates usam `simples`.
    **Seleção em massa (2026-10-23):** `ctx.selecao` (`{ ids: Set, alternar, definir(ids, marcar) }`) põe a
    caixa de seleção em cada linha (some até o hover, a não ser que haja seleção) e "selecionar todas" no
    cabeçalho; **Shift+clique** (na caixa ou na linha) seleciona do último clicado até ali, na ordem da tela e só no
    que está desenhado, levando o intervalo ao estado que a linha clicada vai ter (`onSelecionarLinha`, 2026-10-27); a alça de arrastar, que nunca teve função, saiu. Quem passa `selecao` mostra a
    `BarraSelecao` (`src/components/Tarefas/BarraSelecao.jsx`): barra flutuante no rodapé com "N selecionadas
    ×", os campos (os mesmos editores das células, com o gatilho trocado por `BotaoBarra` via `render`;
    `ResponsaveisEmMassa`/`DepartamentosEmMassa` marcam quem está em todas e põem/tiram de todas), Duplicar e
    Excluir. Esc limpa a seleção. Na **lista de tarefas** (`Tarefas.jsx`, só na visão Lista) cada ação grava
    tarefa a tarefa e segue para o ClickUp (status só onde a lista tem aquele status; duplicar leva as
    subtarefas; excluir pede confirmação). No **editor de template** mexe na árvore (salva no Salvar), com
    Responsável, Departamento, Prazo D+N, Prioridade, Tipo e Estimativa. Na **prévia de aplicação** entra nos
    ajustes; duplicar cria linhas a mais (`copias`, id próprio, logo depois da origem) que viram tarefas
    separadas ao aplicar. `ResponsavelCampo`, `EstimativaCampo`, `DepartamentoCampo` e `RegraCelula` ganharam
    `render` para isso.
    **Painel lateral igual nos três (2026-10-23):** `src/components/Tarefas/SecoesTarefa.jsx` tem `Secao`,
    `ListaSubtarefas` e `ListaRelacoes`, usadas pelo painel da tarefa (`TarefaPanel` + `RelacoesSecao`), pelo do
    editor de template e pelo da prévia. Ordem: Propriedades → Descrição → Subtarefas (no painel da tarefa, se ela é subtarefa, vira **Hierarquia**: pais da raiz ao pai direto, irmãs com ela destacada e as subtarefas dela, irmãs e subtarefas por data de criação (`ordenarPorCriacao`; a Lista segue a ordem manual), e o "Adicionar subtarefa" no fim das irmãs cria irmã (filha do pai), nunca neta; `carregarTarefa` traz pais e irmãs fora do escopo, ex.: "Minhas"; conferir em `/dev/lista`) →
    Relações → Checklists. No template a relação é só `depende_de`: "Bloqueada por" (o que está em
    `depende_de`) e "Bloqueia" (quem tem esta em `depende_de`), editáveis no painel; na prévia entram nos
    ajustes e valem ao criar. O "Depende de" saiu das propriedades do editor (a coluna da lista ficou). O
    painel da tarefa ganhou o menu ⋯ (`MenuTarefa` em `TarefaExtras`: Seguir, Salvar como template, Excluir)
    ao lado do link do ClickUp; saíram o Concluir e a lixeira do topo, e Status é a 1ª propriedade. `?aba=templates` = `TemplatesView` (um template por linha:
    Aplicar, tarefas, horas, departamentos, editado). `?aba=templates&template=<id>` = `TemplateEditor`
    (tarefas e subtarefas como linhas, edição inline de departamento, regra de responsável, início/vencimento
    em D+N, prioridade, tipo, estimativa e "depende de"; clicar na linha abre o `PainelLateral` de 480px com
    nome, propriedades, descrição e checklists, reaproveitando `Propriedade`, `DepartamentoCampo`,
    `Descricao` e `Checklists` de `TarefaPanel`; salva só no botão, avisa ao sair com alteração).
    `{cliente}` no título/descrição vira o nome do cliente ao aplicar.
  - **Aplicar** (`AplicarTemplateView`, tela cheia no lugar do conteúdo): cliente (pasta), lista (padrão
    "Geral") e data de início no topo; a prévia é a ListaView com as tarefas que serão criadas, **editável**:
    célula a célula (responsáveis, início, vencimento, prioridade, tipo, estimativa), nome/descrição/
    checklists no painel lateral, e o X tira a linha (e as subtarefas dela). Os ajustes ficam num mapa por
    item por cima do cálculo do template, então trocar data ou cliente recalcula o resto sem perder o que foi
    mexido; "desfazer N ajustes" e "trazer de volta N removidas" voltam ao calculado. `aplicarTemplate` em
    `Tarefas.jsx` cria pais antes dos filhos via `criarTarefa` (que aceita `etiquetas` e `checklists`), grava
    as dependências como `bloqueia` em `tarefas_relacoes` e abre a lista (e a tarefa, se o template tem uma
    raiz só). Tudo segue para o ClickUp pela outbox.
  - Entradas: item "Templates" na coluna do VertaTask, botão "Templates" no cabeçalho de Tarefas
    (aplica na lista aberta ou leva ao construtor) e "Salvar como template" no painel da tarefa (leva a
    tarefa e as subtarefas com todos os atributos e os prazos convertidos em dias úteis).
  - Sem login: `/dev/templates` (só em DEV, dados em memória; "Criar" só registra o plano no console).
- **Mão de volta VertaTask → ClickUp (2026-10-18, migration 101):** toda escrita de pessoa
  logada em `tarefas_itens` (insert/update/delete) e `tarefas_comentarios` (insert) entra em
  `tarefas_outbox` por trigger (`tarefas_outbox_enfileira`, só com `auth.uid()`: a
  sincronização, o push e os scripts usam a chave de serviço e não re-enfileiram).
  `api/_tarefas_push_core.js` (`empurrar`) esvazia a fila: cria a tarefa no ClickUp (e antes a
  pasta/lista, se nasceram aqui), atualiza só os `campos` que mudaram (nome, descrição, status,
  prioridade, responsáveis add/rem, datas com a regra das 04:00, estimativa, tags, pai,
  arquivada, campos Tipo/Dificuldade/Departamento/Cliente, checklists — migration 115: diferença entre o checklist
  da linha e o do ClickUp, criando/renomeando/marcando/apagando listas e itens, e a linha recebe os ids do ClickUp), exclui e comenta (assinatura
  "(Nome, via VertaTask)"); depois grava `clickup_task_id`/`url`/`clickup_updated_at` com
  `clickup_sync_at = updated_at = agora`. Mover de lista NÃO é replicado (só aviso). Até 5
  tentativas por item; 400/404 desistem na hora. Dispara por `api/tarefas-push.js` (o
  `useTarefas` chama com debounce de 1,5 s após cada escrita) e no começo de
  `api/tarefas-sync.js` (empurra antes de puxar). Testado em 18/10 com criar → editar →
  comentar → excluir numa tarefa de teste na lista Geral da Revenue Lab. Fila:
  `select * from tarefas_outbox where status in ('pendente','erro')`.
  - **Duplicação corrigida em 2026-10-26 (migration 110).** Em 23/10, aplicar um template e
    editar em massa logo depois criou 26 tarefas no ClickUp para 14 do template. Duas causas:
    (1) o push não marcava o que estava processando, e as invocações paralelas da Vercel (uma
    por escrita do front) liam os mesmos itens `pendente`; (2) o `taskCreated` do webhook chegava
    antes de o push gravar o `clickup_task_id` na linha original e inseria uma **cópia** com esse
    id; a gravação batia na unique, o erro era ignorado, a original ficava sem vínculo e cada
    edição dela enfileirava outro `criar`. Agora `empurrar` reivindica os itens pela RPC
    `tarefas_outbox_reivindicar` (status `processando`, `FOR UPDATE SKIP LOCKED`, ttl de 5 min
    para rodada que morreu), grava o id do ClickUp no item e na linha **logo após o POST**
    (nova tentativa reaproveita a tarefa em vez de criar outra), e se a gravação bater na unique
    absorve a cópia (filhos e comentários passam para a original, cópia apagada). Item cuja
    tarefa já tem um `criar` em `processando` noutra rodada é devolvido à fila (`devolvidas`).
    Sem a RPC o push cai na leitura antiga e avisa `aplique a migration 110`.
  - **Fila que ficava para trás (2026-10-26).** A criação mandava 6 ou 7 chamadas ao ClickUp
    por tarefa (criar, até 4 campos personalizados, releitura) e um template não cabia nos 50 s
    de uma invocação; o resto esperava a próxima escrita, o cron ou o botão "ClickUp há X min".
    Agora os campos personalizados vão em `custom_fields` no próprio POST (1 chamada por tarefa;
    `valoresCampos` resolve as opções, `camposPersonalizados` continua no update), `empurrar`
    devolve `restantes` (itens `pendente` ao fim), `api/tarefas-push.js` encadeia rodadas na
    mesma invocação enquanto houver fila e tempo, e `agendarPush` em `useTarefas` chama de novo
    1 s depois enquanto `restantes > 0`. Na tela, tarefa sem `clickup_task_id` em lista que
    existe no ClickUp (`ctx.listasComClickup`) mostra o ícone `CloudUpload` amarelo
    "Aguardando ClickUp" na linha e no cabeçalho do painel, e o botão "ClickUp há X min" soma
    "n aguardando"; o realtime apaga tudo quando o push grava o vínculo. Listas sem
    `clickup_list_id` (ex.: "🤖 Agentes", alimentada pelo Escritório) ficam fora do indicador.
- **Anexos (2026-10-18):** `src/lib/anexos.js` (tipo, tamanho, URL assinada) e
  `src/components/UI/AnexoPreview.jsx` (pré-visualização em tela cheia: imagem, vídeo, áudio, PDF em
  iframe, texto; o resto cartão com Baixar; ← → navegam, Esc fecha). No **chat**, o Composer tem o
  clipe/"+" e aceita colar imagem (até 25 MB, 10 por mensagem); os arquivos vão para o bucket
  privado `chat-attachments/<canal>/…` e a lista fica em `chat_messages.attachments`
  (`[{path,name,type,size}]`); `Chat/Anexos.jsx` mostra miniaturas e cartões. Nas **tarefas**, o
  painel abre o mesmo preview e mostra também os anexos vindos do ClickUp (`anexos[]` com
  `source:'clickup'`, `url`, `thumbnail`, não removíveis aqui): a sincronização relê
  `GET /task/{id}` das abertas que mudaram (`maxAnexos`, 40 por rodada no endpoint) e o script
  aceita `--anexos=N` / `--anexos-de-todas`. A policy antiga do bucket `task-attachments` olhava a
  tabela legada `tasks`; a 102 liberou a pasta `<id da tarefa em tarefas_itens>` para o time.
- **Chat ↔ ClickUp Chat (2026-10-18, migration 102):** `api/_chat_sync_core.js` com `puxar()`
  (canais novos/atualizados + vínculo com o cliente, membros dos canais novos, mensagens dos canais
  com `latest_comment_at` desde `desde`, respostas das threads cuja contagem mudou; idempotente por
  `clickup_message_id`) e `empurrar()` (fila `chat_outbox` por trigger em `chat_messages`
  insert/delete e `chat_channels` insert de canal: envia mensagem/resposta, apaga, cria canal; o
  autor no ClickUp é o dono do token, as outras pessoas vão assinadas "(Nome, via VertaTask)";
  anexos viram links; DM criada aqui não é replicada). Endpoint `api/chat-sync.js`
  (`?push=0|?pull=0|?since|?completo=1`); o `useChat` empurra com debounce ao enviar/apagar e puxa
  ao abrir e a cada 2 min; o cron diário de `tarefas-sync` também roda a rodada do chat. Estado em
  `chat_sync`. Em 18/10 o pull trouxe 3.993 mensagens e 546 respostas desde a importação de
  setembro (19 canais novos). Reações não cruzam.
- **Atividades / Capacidade do time lê o espelho (2026-10-18):** `api/atividades.js` deixou de
  chamar a API do ClickUp para `carga`, `sugerir`, `concluidas` e `listas`; lê `tarefas_*` via
  `api/_atividades_fonte.js`, que converte cada linha para o formato de tarefa do ClickUp que o
  motor (`_atividades_engine.js`) já entendia. Tarefas em lista/pasta arquivada ficam de fora
  (como no ClickUp). `assignees` aceita `clickup_user_id` ou o uuid do perfil (quem não tem
  ClickUp também entra na Capacidade); a resposta ecoa a chave enviada em `clickupUserId` e traz
  `profileId`. As escritas (`criar`, `estimar`, `tipar`) continuam no ClickUp e são refletidas no
  espelho na hora por `espelharTarefaClickUp` (mapTarefa + `clickup_sync_at`/`updated_at` = agora).
  Conferido em 2026-10-18: 8 pessoas em ~7 s (antes "lendo o ClickUp 3 de 8" com rate limit).
- **Ainda não feito:** ligar a Central de Otimizações e o playbook ao Intake, e a decisão sobre desligar o ClickUp.

### Chat (módulo do VertaTask, `/tarefas?aba=chat`): réplica do ClickUp Chat

> **Desde 2026-10-16 o Chat é uma seção do VertaTask**, no item "Chat" da coluna esquerda (com
> contador de não lidas, `useChatNaoLidas`, RPC `chat_unread_counts` a cada 45 s). O componente
> é `src/components/Chat/ChatModulo.jsx` (era `src/pages/Chat.jsx`) e mantém `?aba=chat` ao trocar
> `channel`/`thread`/`msg`. `/chat?...` virou redirect (`RedirectChat` em `legacyRedirects.jsx`)
> porque há links gravados em notificações e mensagens; o item "Chat" saiu da sidebar global.
> O resto desta seção continua valendo.


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

### Otimizações (`/otimizacoes`): sugestões do playbook de todos os clientes

Central que junta as sugestões do playbook (mesmo motor `playbookSugestoes.js` da página
do cliente) de **todos** os clientes, agrupadas por cliente e ordenadas pela urgência.
Cada cartão diz a **Otimização** (ação em uma frase), o **Onde está** (Campanha → Conjunto
→ Anúncio + `ad_id`) e o **Por quê** (contexto + evidências dos últimos 7 dias).

- **Dados:** `useDashboardData({ source: 'api', dias: 20 })` (o mesmo fetch da home, que
  agora vive no `Dashboard` e é passado por prop ao `ProjectListView` e ao
  `OtimizacoesBanner`) + `useSugestoesGlobais(dash)`, que agrupa as linhas do dash por
  projeto pelo vínculo conta → projeto e roda `gerarSugestoesProjeto` por projeto.
- **Janela = 7 dias FECHADOS, igual ao Gerenciador e ao Google Ads** (`janelas()` em
  `playbookSugestoes.js`): termina em ontem (America/Sao_Paulo), nunca em hoje, porque o dia
  parcial fazia o card divergir dos dois. Validado em 2026-10-08 contra a API do Meta (Nomus,
  Bio Cosméticos, Nectar: gasto, impressões, cliques no link e leads idênticos por anúncio,
  nas duas semanas) e contra o Google Ads (Nomus: gasto, cliques e impressões idênticos por
  campanha; conversões diferem em até 0,01 pelo arredondamento por linha). Única métrica que
  NÃO é reproduzível: frequência (o dash guarda a frequência diária; a de 7 dias do Meta usa
  alcance único). `janelaAnalise()` devolve a janela exibida nas telas. Script de conferência:
  comparar `dash_insights` somado por `ad_id` com `/act_<id>/insights?level=ad` no mesmo
  intervalo.
- **Anúncio é identificado pelo `ad_id`**, nunca pelo nome: o mesmo nome ("01") existe em
  vários conjuntos e até dentro do mesmo conjunto. Agrupar por nome soma métricas de
  anúncios diferentes e dá veredito errado. Fallback campanha + conjunto + nome só pra
  linha sem `ad_id`.
- **Decisão** (migration 092): `projeto_sugestoes` aceita `aceita | recusada | descartada`,
  com `motivo`, `canal`, `conta`, `campanha`, `conjunto`, `anuncio`, `ad_id`, `acao`,
  `decidida_em`, `decidida_por` e a fila da automação `execucao_status`
  (`pendente` ao aceitar na central → o robô marca `executada`/`erro` + `executada_em` +
  `execucao_log`). `linhaDecisao()` em `useSugestoesGlobais.js` monta a linha; o hub da
  página do cliente usa a mesma função, mas aceitar lá vira tarefa no ClickUp pra uma
  pessoa e grava `execucao_status = null` (fora da fila do robô).
- **Aceitar na central cria a atividade no ClickUp do cliente** (`criarTarefaDaSugestao` em
  `src/lib/aceitarSugestao.js`, sem modal): lista "Geral" da pasta, tipo e horas da própria
  sugestão, responsável = quem o squad do cliente designou ao departamento do tipo (cai em
  quem está aceitando se o squad não define), data pela carga real do time (`sugerir`), e a
  descrição em markdown com o caminho e o link do gerenciador. A decisão grava
  `clickup_task_id`, `clickup_task_url` e `atividade_id`; o histórico mostra o botão "Abrir a
  atividade no ClickUp" e, logo após aceitar, uma faixa com o link. Se o ClickUp falhar (sem
  pasta, sem responsável), a decisão é gravada mesmo assim com `execucao_log.erro_tarefa` e o
  histórico oferece "Criar tarefa no ClickUp" pra tentar de novo. Continua entrando na fila da
  automação (`execucao_status = 'pendente'`). Validado em produção em 2026-10-08 criando e
  apagando uma tarefa de teste no projeto Revenue Lab.
- **Fila pra automação:** `select * from projeto_sugestoes where execucao_status = 'pendente'`
  (índice parcial `idx_projeto_sugestoes_fila`); o `payload` tem a sugestão inteira
  (caminho, evidências, passos, regra).
- **Link direto no gerenciador:** `linkGerenciador(canal, ids)` em `playbookSugestoes.js`
  monta a URL no nível mais específico da regra (Meta: `adsmanager/manage/ads?act=<account_id>
  &selected_ad_ids=` | `selected_adset_ids=` | `adsets?...&selected_campaign_ids=`; Google:
  `ads.google.com/aw/adgroups?campaignId=<id>&__e=<customer_id>`). Os IDs vêm do jsonb do
  `dash_insights` (`account_id`, `campaign_id`, `adset_id`, `ad_id` no Meta; `customer_id`,
  `campaign_id` no Google), gravados pelo coletor `dashboard-api` desde 2026-10-08; linha
  antiga sem ID = sugestão sem botão. O link abre no perfil logado do navegador, que precisa
  ter acesso à conta. Vai também na descrição do ClickUp e no `payload.caminho.url`.
  **Google via MCC não respeita o deep link** (testado em 2026-10-08): abre o seletor de
  contas e, escolhida a MCC, cai no nível da gerenciadora sem a campanha; só o `ocid`
  interno (que não vem pela API) pularia isso. Por isso o card mostra o CID formatado
  (`fmtCid`) pra colar na busca do seletor.
- Recusar exige motivo. "Reabrir" apaga a decisão (volta a aparecer se a regra ainda valer);
  não aparece em decisão já executada. Item "Otimizações" na seção Operação da sidebar e
  atalho na home (`src/components/Dashboard/OtimizacoesBanner.jsx`).
- **Painel de Otimizações dentro do Dashboard de Tráfego** (substituiu o card "Análise IA" do
  viewer, em 2026-10-12). Aparece na aba Campanhas de toda conta Meta e Google, no fim da
  página, e **acompanha o escopo**: conta inteira, campanha (`drillCampaign`), conjunto/grupo
  (`drillAdset`) ou um anúncio (selo ✨ n ao lado do nome na tabela de anúncios, que filtra o
  painel só nele). Mostra só o que pertence ao escopo, via `caminho` da sugestão
  (`otmEscopo()` em `viewer.html`). Google só gera sugestão de campanha e conta, então no nível
  do grupo o painel explica isso. Abas Pendentes / Decididas, com aceitar, recusar com motivo,
  reabrir e "criar tarefa no ClickUp" de novo. Não aparece no link compartilhado (`?shared=1`).
  - **Motor único:** o viewer é HTML estático em `public/` e não importa de `src/`, então usa
    `public/dash-teste/vendor/playbookSugestoes.js`, **gerado** de `src/lib/playbookSugestoes.js`
    por `scripts/sync-playbook-vendor.mjs` (roda no `predev` e no `prebuild`). Nunca edite a cópia.
    A janela é fixa, 7 dias fechados contra os 7 anteriores, e não segue o filtro de período.
  - **Mesmas decisões da Central:** lê/grava `projeto_sugestoes` (leitura direta por REST com o
    token da sessão; gravação pela ponte). A chave da sugestão leva o prefixo `conta|` quando o
    projeto tem mais de uma conta com dado nos últimos 20 dias (`otmVarias()`, espelha
    `gerarSugestoesProjeto`); se isso divergir, a mesma sugestão aparece pendente num lugar e
    decidida no outro. `gerarSugestoesConta()` é o ponto comum entre projeto e conta única.
  - **Ponte `window.parent.__rlOtimizacoes`** (`src/components/OtimizacoesBridge.jsx`, montada no
    `AppLayout`): `aceitar`, `recusar`, `criarTarefa`, `reabrir`. Reaproveita
    `aceitarComTarefa()` (`src/lib/aceitarSugestao.js`), o mesmo caminho da página /otimizacoes
    (cria a atividade no ClickUp pelo squad do cliente e entra na fila da automação). O viewer não
    reimplementa nada disso. Sem a ponte (viewer aberto direto, sem login, conta sem projeto
    vinculado) o painel fica só de leitura e diz o motivo.

### Página do cliente (`/cliente/:id`): hub em 2 colunas

`ClientProfile.jsx` abre na seção `hub` (visão geral) com layout inspirado em CRM: **esquerda**
(340px; 380px a partir de `2xl`) cartão do cliente (logo, contrato, LTV, squad, risco, momento, links), ações rápidas
(Otimização / Anotação / Tarefa / Reunião) e `HubInformacoes` (dados cadastrais); **centro** o menu da página e,
abaixo, `HubCentro` (abas do hub) ou o módulo aberto com breadcrumb "Visão geral › Menu › Grupo › Módulo",
ocupando o resto da largura. A antiga coluna
direita (`HubDireita`: resumo de Jornada, Central de anúncios, LPs, Campanhas, Anexos, Links, NPS e
Atas) foi removida em 2026-10-26 a pedido do Matheus. Abaixo de `xl` as colunas empilham e os módulos viram drawer pelo hambúrguer.

- **Menu da página** (`src/components/ProjetoHub/MenuCliente.jsx`, 2026-10-27): substituiu a barra de abas do
  `HubCentro` e o antigo menu de Módulos. "Visão geral" + cinco menus suspensos, nesta ordem (pedido do Matheus):
  **Cliente** (Cadastro: Dados, Banco de Mídia, Links, Anexos · Estratégia: Kickoff, Produto/Serviço, Personas,
  Oferta, Estratégia, Ferramentas), **Projetos** (Tarefas, Reuniões, Anotações, Jornada, NPS), **Resultados**
  (Desempenho: Tráfego, Funil · Otimização: Sugestões, Otimizações · Leads e vendas: CRM, Banco de Dados; numa
  coluna só, `colunas: 1`), **Planejamento** (ROI, Plan. de campanhas, Labs Meta/Google) e **Criação** (Anúncios ·
  Landing pages). A estrutura é a constante `MENU_CLIENTE`: item `'aba:<id>'` abre uma aba do hub (estado `abaHub`
  no `ClientProfile`, que agora controla o `HubCentro` por `tab`/`onAbrirTab`), o resto é id de seção; o rótulo do
  menu é livre, o id não muda. Não há gaveta "Outros": item em teste leva `beta: true` (selo no item). O painel abre
  para a direita do botão e recua só o que passar da tela (`Painel`). A lupa no fim busca em todos os itens; no
  mobile o drawer mostra a mesma hierarquia (`MenuClienteLista`). O número de sugestões pendentes vem de
  `useSugestoesHub` (no `ClientProfile`, pra aparecer com um módulo aberto). Trocar de seção leva ao topo da página.
- **Coluna do cliente recolhível em todas as visões** (botão no começo do menu, `localStorage['rl:cliente-info-recolhida']`):
  recolhida, o Voltar e o nome do cliente vão para a barra do menu.

- **Timeline** (`src/hooks/useProjetoHub.js`): união de `projeto_otimizacoes` (otimizações
  feitas + anotações, migration 089), `atividades_planejadas` do projeto, `tarefas_itens`
  da pasta do cliente (réplica do ClickUp) e `meeting_minutes`, agrupada por mês. Abas do hub (escolhidas pelo
  menu): Resumo (= Visão geral), Tarefas, Sugestões, Otimizações e Anotações; Reuniões virou o módulo de atas e
  Resultados virou os módulos de Tráfego e Funil. A aba **Tarefas** é a área do VertaTask
  (`TarefasDoCliente` → `AreaTarefas`, carregada sob demanda): a linha do tempo de tarefas, as tarefas planejadas e
  o filtro de período que a aba tinha saíram (2026-10-26). Com `?tarefa=`, `?view=` ou `?lista=` na URL a página abre
  nessa aba; sair dela limpa esses parâmetros. Para não haver dois scrolls na mesma região, nessa aba a área vai do
  ponto onde começa até o fim da tela (`useAlturaAteOFim`, margem de 24 px) e a coluna esquerda fica `sticky` com
  rolagem própria (`travarRolagem` no `ClientProfile`, que guarda a aba aberta): a página não rola.
- **Sugestões do playbook** (`src/lib/playbookSugestoes.js`, puro): regras do Roadmap Ads e
  dos guardrails aplicadas aos últimos 7 dias do `dash_insights` (via `useDashboardData`
  com `projectId` e `dias: 16`) vs. os 7 anteriores, por conta vinculada. **Toda regra de
  CPL / conversão / escala olha só campanhas de FUNDO e MEIO** (`classifyFunnel`); topo de
  funil nunca é julgado por CPL, e o "CPL da conta" também exclui topo. Meta (fundo/meio):
  sem entrega, meta de CPL indefinida, anúncio sem conversão (≥ 2× CPL ideal ou R$ 35, ≥ 3
  dias), anúncio com CPL ≥ 2× meta, CTR link < 0,5% (não vale pra topo), saturação (freq ≥
  3,5 + CTR caindo), fundo com < 3 criativos ativos, escalar conjunto (CPL ≤ 0,8× meta,
  estável 3 dias), CPL fundo+meio +30%, sem campanha FUNDO, sem TOPO com verba ≥ R$ 2k.
  Meta (topo): a régua do Protocolo é vídeo (taxa de gancho = 3 s / impressões ≥ 30%,
  tempo médio > 10 s, retenção 25% / ThruPlay) e visita ao perfil / seguidores, que o dash
  não traz; a regra `meta:topo_gancho` troca vídeo com gancho < 30% (≥ R$ 35, ≥ 2k
  impressões, ≥ 3 dias). Google: campanha sem conversão, CPL ≥ 2× meta, perda por
  orçamento ≥ 30%, CTR < 2%, taxa de conversão < 5%. Conversão Meta = coluna `Conversões`
  (fallback CFG). Cada sugestão tem `chave` estável; o estado vive em `projeto_sugestoes`
  (aceita → some; descartada → volta após `valida_ate`, 14 dias).
- **Resultados de Tráfego** (seção `trafego`, slug `resultados-de-trafego`; `TrafegoModule` em
  `src/components/ResultadosModule.jsx`): `ContasVinculadas` (vincular/desvincular contas de anúncio,
  `dashboard_accounts.project_id`, busca e aviso quando a conta está em outro cliente) e
  `ProjectTrafficDashboard`, iframe do mesmo `public/dash-teste/viewer.html` em modo
  `?embed=1&cliente=<conta>&canal=meta|google` (autenticado como o `/dashboard`, travado na conta). Uma pílula por
  conta/canal quando há mais de uma. Só funciona logado e com as rotas `/api` (vercel dev ou produção).
- **Resultados de Funil** (seção `resultados`, que é a chave do portal; `ResultadosModule`): B2B (semanal) e
  B2C (diário/semanal/por loja). Faixa "Funil do mês" (`FunilDoMes`: cada etapa marcada **API** = investimento e
  leads do autofill ou **Lançado** = MQL/SQL/vendas/receita), tabela por período com cabeçalho API · Lançado ·
  Calculado e o lançamento abrindo na própria linha ("Lançar vendas" em semana com API e sem venda), gráfico único
  `GraficosEvolucao` (investido e receita em barras no eixo de reais, leads em linha no eixo da direita; cores
  `.viz` em `src/index.css`, validadas para daltonismo), Plano vs Realizado e Meta × Google. Sem conta vinculada
  aparece um aviso com atalho para Tráfego.
- **Preview do Resultados sem login**: `/dev/resultados` (só em DEV) com dados fictícios
  (`src/dev/mockResultados.js`): alterna Tráfego/Funil, B2B/B2C e claro/escuro. O tráfego vem de
  `public/dash-teste/mock/*.csv`, gerados por `scripts/gerar_mock_dash.mjs` no `predev` (gitignored; datas até
  ontem); o viewer lê esses arquivos com `?mock=1` (ignora a sessão). Edições e vínculos ficam em memória.
- **Tema visual**: a página inteira usa a classe `fx` (`src/index.css`), que replica o tema
  Fynix do dashboard (tokens `rl-*` redefinidos, Urbanist, cards raio 16, hero azul
  `.fx-hero`, círculo azul-suave `.fx-soft`). Além de `/cliente/:id`, `/` e `/dev/hub`,
  também está no login, no portal e nas páginas públicas.
  O `fx` tem **duas variantes**: `.fx` (claro) e `.dark .fx` (escuro, neutros com tom
  azulado e azul de ação clareado para contraste). Era só-claro até então, o que fazia o
  botão de tema não surtir efeito nessas telas. Valores que antes estavam cravados nas
  regras (`#fff`, `#123C86`, `#E5EDFB`, as pílulas de variação do `ResumoHub`) viraram
  variáveis `--fx-*`, então **uma cor nova se declara nos dois blocos, não na regra**.
- **Preview sem login**: `/dev/hub` (só em DEV) renderiza `ClientProfile` com projeto
  fictício, `AppContext` falso e fixture `src/dev/fixtures/hub_meta.json` (gitignored;
  gerar com `json_agg(data)` de `dash_insights` de uma conta). `useProjetoHub` e o dash
  leem `window.__DEV_HUB` quando existe.
- **Aceitar** abre `NovaTarefaClickUpModal`, que reaproveita `usePlanejador` (mesmo fluxo
  do /atividades: lista "Geral" da pasta, responsável sugerido pelo squad, data pela carga
  real, `criar` no ClickUp) pré-preenchido com título, briefing em markdown, tipo, horas e
  prioridade da sugestão. Exige `clickup_folder_id` no projeto.
- Testar o motor com Node: copiar `playbookSugestoes.js` e `dashboardData.js` como `.mjs`
  no scratchpad e alimentar com `json_agg(data)` de `dash_insights` de uma conta.
