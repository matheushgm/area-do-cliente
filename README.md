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
- IA integrada (Claude API) para geração de personas e ofertas — chave configurável via Settings
- Sincronização em nuvem via Supabase
- Exportação de perfis em PDF
- Gestão de usuários (admin): criar, editar nome/role, desativar/reativar membros do time

## Stack

- React 18 + Vite + Tailwind CSS
- React Router v6
- Supabase (auth + banco de dados)
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
│   │   ├── EstrategiaModule.jsx   # Módulo de estratégia
│   │   ├── GoogleAdsModule.jsx    # Módulo Google Ads
│   │   ├── MetaLabModule.jsx      # Módulo Meta (Facebook/Instagram Ads)
│   │   ├── LandingPageModule.jsx  # Módulo de landing pages
│   │   ├── ResultadosModule.jsx   # Módulo de resultados/métricas
│   │   ├── AnexosModule.jsx       # Módulo de anexos/arquivos
│   │   ├── ROICalculator.jsx      # Calculadora de ROI
│   │   └── RatingSelector.jsx     # Componente de avaliação por estrelas
│   │
│   ├── context/
│   │   └── AppContext.jsx     # Context global (estado compartilhado entre páginas)
│   │
│   ├── lib/
│   │   ├── claude.js          # Cliente para chamadas à API do Claude (IA)
│   │   ├── supabase.js        # Cliente Supabase (banco de dados/auth)
│   │   └── buildContext.js    # Helper para montar o contexto enviado ao Claude
│   │
│   └── utils/
│       └── exportPDF.js       # Utilitário para exportar dados em PDF
│
├── index.html                 # HTML raiz do Vite
├── vite.config.js             # Configuração do Vite (bundler)
├── tailwind.config.js         # Configuração do Tailwind CSS
├── postcss.config.js          # Configuração do PostCSS
├── vercel.json                # Configuração de deploy na Vercel
├── package.json               # Dependências e scripts
├── start.sh                   # Script de inicialização local
└── .env.example               # Variáveis de ambiente necessárias
```

## Como rodar

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Preencha SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY
```

Há dois modos de desenvolvimento:

| Comando | Porta | O que serve |
|---|---|---|
| `npm run dev` | 5173 | Apenas frontend (sem `/api/*`) |
| `vercel dev` | 3000 | Frontend + Edge Functions — necessário para IA e gestão de usuários |

> Use `vercel dev` para o desenvolvimento completo. `npm run dev` é suficiente para trabalho exclusivo no frontend.

A chave da API Anthropic pode ser configurada diretamente na interface, em **Settings**, sem necessidade de variável de ambiente.

## Autenticação

O sistema usa **Supabase Auth**. Os 6 usuários do time já estão cadastrados no projeto Supabase com senha padrão `Revenue@lab!`.

Configure no painel do Supabase antes de usar em novo ambiente:

1. **Authentication → Providers → Google** — habilite e configure o Client ID/Secret do Google Cloud Console (opcional)
2. **Authentication → URL Configuration** — adicione a URL da aplicação em "Redirect URLs" (ex: `http://localhost:3000` para `vercel dev`, ou `http://localhost:5173` se usar apenas `npm run dev`)

### Usuários

| E-mail | Nome | Role |
|---|---|---|
| matheus@revenuelab.com.br | Matheus Martins | admin |
| account@revenuelab.com.br | Account Manager | account |
| eduardo@revenuelab.com.br | Eduardo | account |
| victor.zampieri@revenuelab.com.br | Victor Zampieri | account |
| mario.marques@revenuelab.com.br | Mario Marques | account |
| matheus.assis@revenuelab.com.br | Matheus Assis | account |

Nome, avatar e role de cada usuário são armazenados em `user_metadata` no Supabase Auth e sincronizados automaticamente na tabela `profiles` a cada login.

## Banco de dados

Tabelas no Supabase:

| Tabela | Descrição |
|---|---|
| `projects` | Projetos de onboarding — coluna `data` (JSONB) contém todo o estado do projeto |
| `profiles` | Perfis do time — colunas `id`, `name`, `email`, `avatar`, `role`, `disabled boolean`, `created_at`; sincronizados do Auth, usados para listagem no Dashboard e gestão de usuários |

### Row Level Security (RLS)

Ambas as tabelas têm RLS habilitado:

| Tabela | Regra |
|---|---|
| `projects` | Admins acessam todos os registros; accounts acessam apenas projetos onde `data->>'accountId'` = `auth.uid()` |
| `profiles` | Qualquer usuário autenticado pode ler todos os perfis; admins podem ler e escrever qualquer perfil (policies `profiles_admin_write` e `profiles_admin_insert`); cada usuário só escreve o próprio |

A role é lida diretamente do token JWT (`auth.jwt() -> 'user_metadata' ->> 'role'`), sem depender de tabela auxiliar.
