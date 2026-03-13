# Revenue Lab Internal

Plataforma interna de gestão de onboarding de clientes da Revenue Lab. Permite que account managers conduzam e documentem o processo de onboarding, gerando um perfil completo do cliente ao final.

## O que faz

### Fluxo de onboarding (por cliente)

O processo segue 3 etapas obrigatórias em sequência:

1. **Calculadora de ROI** — calcula investimento, retorno esperado e projeções financeiras do cliente
2. **Criação de ICP (Persona Creator)** — define o perfil de cliente ideal usando IA para gerar personas
3. **Oferta Matadora** — estrutura a oferta principal do cliente com auxílio de IA

Ao completar as 3 etapas, o projeto se torna um **Perfil Completo** — um documento consolidado do cliente.

### Funcionalidades

- Autenticação via Supabase Auth (email/senha + Google OAuth)
- Dashboard com cards de projetos, stats (em onboarding, ativos, total) e filtros por status ou membro do time
- Controle de acesso: admins veem todos os projetos; usuários comuns veem apenas os seus
- IA integrada (Claude API) para geração de personas, ofertas, criativos, Google Ads, landing pages e estratégia
- Sincronização em nuvem via Supabase com schema normalizado
- Upload de arquivos para Supabase Storage (PDFs, logos, anexos)
- Exportação de perfis em PDF
- Gestão de usuários (admin): criar, editar nome/role, desativar/reativar membros do time

## Stack

- React 18 + Vite + Tailwind CSS
- React Router v6
- Supabase (auth + banco de dados + storage)
- Anthropic Claude API (IA generativa)

## Estrutura de pastas

```
area-do-cliente/
│
├── api/
│   ├── anthropic.js          # Serverless function (Vercel) — proxy para a API da Anthropic/Claude
│   └── admin-users.js        # Edge Function (Vercel) — operações admin no Supabase Auth
│
├── src/
│   ├── main.jsx               # Entry point do React
│   ├── App.jsx                # Componente raiz com roteamento
│   ├── index.css              # Estilos globais (Tailwind base)
│   │
│   ├── pages/                 # Páginas da aplicação (rotas)
│   │   ├── Login.jsx          # Tela de login
│   │   ├── Dashboard.jsx      # Dashboard principal
│   │   ├── ClientProfile.jsx  # Perfil do cliente
│   │   ├── ProjectDetail.jsx  # Detalhes de um projeto/campanha
│   │   ├── NewOnboarding.jsx  # Fluxo de onboarding de novo cliente
│   │   ├── OfertaMatadora.jsx # Criador de oferta matadora
│   │   ├── PersonaCreator.jsx # Criador de persona
│   │   └── UserManagement.jsx # Gestão de usuários do time (admin only)
│   │
│   ├── components/            # Componentes reutilizáveis
│   │   ├── AppSidebar.jsx         # Menu lateral da aplicação
│   │   ├── CampaignPlanner.jsx    # Planejador de campanhas
│   │   ├── CriativosModule.jsx    # Módulo de criativos
│   │   ├── EstrategiaModule.jsx   # Módulo de estratégia (narrativa IA)
│   │   ├── EstrategiaV2Module.jsx # Módulo de estratégia estruturada (SWOT, riscos, funis)
│   │   ├── GoogleAdsModule.jsx    # Módulo Google Ads
│   │   ├── MetaLabModule.jsx      # Módulo Meta (Facebook/Instagram Ads)
│   │   ├── LandingPageModule.jsx  # Módulo de landing pages
│   │   ├── ResultadosModule.jsx   # Módulo de resultados/métricas
│   │   ├── AnexosModule.jsx       # Módulo de anexos/arquivos
│   │   ├── BancoMidiaModule.jsx   # Biblioteca de marca (fotos, vídeos, cores, tipografia)
│   │   ├── ROICalculator.jsx      # Calculadora de ROI
│   │   └── RatingSelector.jsx     # Componente de avaliação
│   │
│   ├── context/
│   │   └── AppContext.jsx     # Context global — CRUD de projetos com roteamento por tabela
│   │
│   └── lib/
│       ├── claude.js          # Cliente para chamadas à API do Claude (IA)
│       ├── supabase.js        # Cliente Supabase + helpers de Storage
│       └── buildContext.js    # Helper para montar o contexto enviado ao Claude
│
├── supabase/
│   └── migrations/            # DDL versionado (001–016); aplicar em ordem no Supabase
│
├── docs/
│   └── schema-inputs.md       # Mapeamento completo de inputs → tipos SQL por entidade
│
├── index.html                 # HTML raiz do Vite
├── vite.config.js             # Configuração do Vite (bundler)
├── tailwind.config.js         # Configuração do Tailwind CSS
├── postcss.config.js          # Configuração do PostCSS
├── vercel.json                # Configuração de deploy na Vercel
├── package.json               # Dependências e scripts
└── .env.example               # Variáveis de ambiente necessárias
```

## Como rodar

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Preencha SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY e ANTHROPIC_API_KEY
```

Há dois modos de desenvolvimento:

| Comando | Porta | O que serve |
|---|---|---|
| `npm run dev` | 5173 | Apenas frontend (sem `/api/*`) |
| `vercel dev` | 3000 | Frontend + Edge Functions — necessário para IA e gestão de usuários |

> Use `vercel dev` para o desenvolvimento completo. `npm run dev` é suficiente para trabalho exclusivo no frontend.

## Autenticação

O sistema usa **Supabase Auth**. Os usuários do time são gerenciados via painel de administração da aplicação.

- Login com Google restringe acesso a e-mails com perfil existente em `profiles` — usuários não cadastrados são bloqueados automaticamente.

Configure no painel do Supabase antes de usar em novo ambiente:

1. **Authentication → Providers → Google** — habilite e configure o Client ID/Secret do Google Cloud Console (opcional)
2. **Authentication → Redirect URLs** — adicione a URL raiz **e** wildcard (ex: `http://localhost:3000` e `http://localhost:3000/**`) para o PKCE flow funcionar corretamente
3. **Google Cloud Console → OAuth Client → URIs de redirecionamento** — adicione `https://<projeto>.supabase.co/auth/v1/callback`

Nome, avatar e role de cada usuário são armazenados em `user_metadata` no Supabase Auth e sincronizados automaticamente na tabela `profiles` a cada login.

## Banco de dados

O schema é normalizado. A tabela principal é `projects_v2`; cada domínio tem sua própria tabela com FK para o projeto.

### Tabelas

| Tabela | Descrição |
|---|---|
| `projects_v2` | Projetos — empresa, contrato, equipe, serviços; UUID PK |
| `profiles` | Perfis do time — sincronizados do Auth |
| `roi_calculators` | Cenários de ROI (múltiplos por projeto) |
| `personas` | Personas geradas por IA |
| `ofertas` | Oferta matadora (1 por projeto) |
| `campaign_plans` | Planos de campanha |
| `resultados` | Métricas semanais/mensais (UNIQUE por projeto + período) |
| `criativos` | Criativos gerados por IA |
| `google_ads` | Campanhas Google Ads geradas por IA |
| `landing_pages` | Landing pages geradas por IA |
| `banco_midia` | Biblioteca de marca (1:1 com projeto) |
| `estrategia` | Narrativa estratégica gerada por IA (1:1 com projeto) |
| `estrategia_v2` | Análise estratégica estruturada — SWOT, concorrentes, riscos, funis (1:1) |
| `attachments` | Anexos — metadados + path no Storage |

### Row Level Security (RLS)

Todas as tabelas têm RLS habilitado:

| Escopo | Regra |
|---|---|
| `projects_v2` | Admins acessam todos; accounts acessam apenas onde `account_id = auth.uid()` |
| Tabelas filhas | RLS via subquery: `project_id IN (SELECT id FROM projects_v2 WHERE account_id = auth.uid())` |
| `profiles` | Qualquer autenticado lê; admins escrevem qualquer perfil; cada usuário escreve o próprio |

A role é lida diretamente do token JWT (`auth.jwt() -> 'user_metadata' ->> 'role'`), sem depender de tabela auxiliar.

### Supabase Storage

| Bucket | Uso |
|---|---|
| `attachments` | Anexos de projetos (PDFs, docs) |
| `brand-logos` | Logotipos de marca |
| `brand-media` | Fotos e vídeos do banco de mídia |
| `project-docs` | Raio-X e SLA do onboarding |

Todos os buckets são privados. Path: `{projectId}/{filename}`.

### Aplicar migrations em novo ambiente

```bash
# As migrations estão em supabase/migrations/ — aplicar em ordem numérica (001 → 016)
# via Supabase Dashboard → SQL Editor, ou com a Supabase CLI:
supabase db push
```
