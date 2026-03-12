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
```

O Vite expõe `SUPABASE_URL` e `SUPABASE_ANON_KEY` ao browser via `define` em `vite.config.js`. `SUPABASE_SERVICE_ROLE_KEY` fica apenas no servidor (Edge Function) e nunca é exposto ao cliente.

A chave da Anthropic (`sk-ant-...`) **não vai para o `.env`** — é configurada pelo usuário na interface (Settings) e salva no `localStorage`.

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
- `projects` / `addProject` / `updateProject` / `deleteProject` — CRUD de projetos
- `anthropicKey` / `setAnthropicKey` — chave da API salva em `localStorage`
- `teamMembers` — array de perfis do time, buscado da tabela `profiles` no Supabase
- `loadingProjects` / `isSupabaseReady` — estado de sincronização com a nuvem

**Persistência dupla:** toda mutação salva em `localStorage` (offline-first) e faz upsert/delete no Supabase em paralelo. Na montagem, se o Supabase estiver configurado, os dados da nuvem sobrescrevem o `localStorage`. Há também um listener de realtime (`postgres_changes`) que re-sincroniza quando outro dispositivo faz alterações.

### Jornada de onboarding (`ProjectDetail`)

O onboarding segue 3 etapas obrigatórias em sequência, controladas por `completedSteps[]` dentro do projeto:

1. `roi` → `ROICalculator` — salva `roiCalc` + `roiResult`
2. `strategy` → `PersonaCreator` — salva `personas` (gerado via IA)
3. `oferta` → `OfertaMatadora` — salva `ofertaData` (gerado via IA)

Quando as 3 estão completas (`allDone`), a página renderiza diretamente `ClientProfile` (perfil consolidado). Etapas são desbloqueadas sequencialmente — a anterior precisa estar em `completedSteps` para habilitar a próxima.

### IA (Claude API)

- `src/lib/claude.js` — função `streamClaude()` que faz POST para `/api/anthropic` com SSE streaming
- `api/anthropic.js` — Vercel Edge Function que faz proxy para `api.anthropic.com`, mantendo o streaming passthrough. A `apiKey` vai no body da requisição (nunca em variável de ambiente do servidor)
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
- A cada login (`SIGNED_IN`), `upsertProfile()` sincroniza os metadados na tabela `profiles`
- Os 6 usuários do time já estão criados no projeto Supabase — não é necessário recriar
- **Configuração ao usar em novo ambiente:**
  - Authentication → Providers → Google: habilitar e configurar Client ID/Secret
  - Authentication → URL Configuration: adicionar domínio em "Redirect URLs"

### Gestão de Usuários

- `api/admin-users.js` — Vercel Edge Function que usa `SUPABASE_SERVICE_ROLE_KEY` para operações privilegiadas no Supabase Auth
  - Verifica o JWT do request e exige `role === 'admin'` antes de executar qualquer ação
  - Actions suportadas: `create_user` (cria usuário no Auth + perfil em `profiles`), `update_user` (atualiza metadados e perfil), `toggle_user` (ativa/desativa via campo `disabled` em `profiles` e `user_metadata`)
- `src/pages/UserManagement.jsx` — página de gestão; protegida pelo HOC `RequireAdmin` em `App.jsx`, que redireciona para `/` caso o usuário não seja admin
- Item "Usuários" na sidebar (`AppSidebar.jsx`) é renderizado apenas para admins

### Estilo

Tailwind CSS com design system próprio (`rl-*`). Classes utilitárias como `glass-card`, `btn-primary`, `bg-gradient-dark`, `shadow-glow` são definidas em `src/index.css`.
