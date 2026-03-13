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
```

Não há testes automatizados nem linter configurado neste projeto.

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
- `teamMembers` — array de perfis do time com `disabled=false`, buscado da tabela `profiles`
- `loadingProjects` / `isSupabaseReady` — estado de sincronização com a nuvem

### Persistência e sincronização

- **Offline-first:** toda mutação salva em `localStorage` imediatamente
- **Debounce:** `updateProject` tem debounce de 1s por `id` antes de escrever no Supabase (via `upsertTimers` ref)
- **Race condition:** `pendingWrites` ref contador — o listener de realtime ignora eventos enquanto há escritas locais pendentes
- **Realtime granular:** listener usa handlers separados por evento (`INSERT`/`UPDATE`/`DELETE`), atualizando apenas o registro afetado no state local

### Jornada de onboarding (`ProjectDetail`)

O onboarding segue 3 etapas obrigatórias em sequência, controladas por `completedSteps[]` dentro do projeto:

1. `roi` → `ROICalculator` — salva `roiCalc` + `roiResult`
2. `strategy` → `PersonaCreator` — salva `personas` (gerado via IA)
3. `oferta` → `OfertaMatadora` — salva `ofertaData` (gerado via IA)

Quando as 3 estão completas (`allDone`), a página renderiza diretamente `ClientProfile` (perfil consolidado). Etapas são desbloqueadas sequencialmente — a anterior precisa estar em `completedSteps` para habilitar a próxima.

### IA (Claude API)

- `src/lib/claude.js` — `streamClaude()` faz POST para `/api/anthropic` com SSE streaming; não transmite nem recebe apiKey
- `api/anthropic.js` — Vercel Edge Function; lê `process.env.ANTHROPIC_API_KEY` e faz proxy para `api.anthropic.com`
- Renderização de output da IA: `react-markdown` + `rehype-sanitize` (sem `dangerouslySetInnerHTML`)
- Em desenvolvimento local, use `vercel dev`; o Vite puro (`npm run dev`) não serve `/api/*` e a IA não funcionará

### Supabase

- `src/lib/supabase.js` — retorna `null` se as env vars não estiverem definidas
- Tabela `projects`: colunas `id`, `data` (JSONB com todo o projeto), `created_at`, `updated_at`
  - RLS habilitado: admins acessam todos os projetos; accounts acessam apenas os próprios (`data->>'accountId' = auth.uid()`)
  - A role é lida diretamente do JWT: `auth.jwt() -> 'user_metadata' ->> 'role'`
- Tabela `profiles`: colunas `id`, `name`, `email`, `avatar`, `role`, `disabled boolean`, `created_at` — espelha os metadados do Auth; usada para listar membros do time no Dashboard e pela gestão de usuários
  - RLS habilitado: leitura para qualquer autenticado; admins podem escrever qualquer perfil (policies `profiles_admin_write` e `profiles_admin_insert`); cada usuário só escreve o próprio

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

### Draft de onboarding

`NewOnboarding` persiste rascunho em `localStorage` sob a chave `rl_onboarding_draft`; restaurado automaticamente na próxima visita.

### Gestão de Usuários

- `api/admin-users.js` — Vercel Edge Function que usa `SUPABASE_SERVICE_ROLE_KEY` para operações privilegiadas no Supabase Auth
  - Verifica o JWT do request e exige `role === 'admin'` antes de executar qualquer ação
  - Actions suportadas: `create_user` (cria usuário no Auth + perfil em `profiles`), `update_user` (atualiza metadados e perfil), `toggle_user` (ativa/desativa via campo `disabled` em `profiles` e `user_metadata`)
- `src/pages/UserManagement.jsx` — página de gestão; protegida pelo HOC `RequireAdmin` em `App.jsx`, que redireciona para `/` caso o usuário não seja admin
- Item "Usuários" na sidebar (`AppSidebar.jsx`) é renderizado apenas para admins

### Estilo

Tailwind CSS com design system próprio (`rl-*`). Classes utilitárias como `glass-card`, `btn-primary`, `bg-gradient-dark`, `shadow-glow` são definidas em `src/index.css`.
