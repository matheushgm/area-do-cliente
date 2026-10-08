import { lazy } from 'react'
import { Route, Navigate } from 'react-router-dom'
import { RequireAuth, RequireAdmin, RequireSquadsAccess } from './guards'
import { RedirectProjetoLegado, RedirectComQuery } from './legacyRedirects'
import AppLayout from './AppLayout'

// Rotas que exigem login. Diferente das públicas, estas podem ser renomeadas
// à vontade — ninguém guarda esses links. Exceção: paths que podem estar
// gravados na coluna `link` das notificações (NotificationCenter navega pra lá
// sem passar por nenhum código nosso) — esses ganham redirect.

// ── Clientes ───────────────────────────────────────────────
const Dashboard = lazy(() => import('../pages/Dashboard'))
const NewOnboarding = lazy(() => import('../pages/NewOnboarding'))
const ProjectDetail = lazy(() => import('../pages/ProjectDetail'))

// ── Operação ───────────────────────────────────────────────
const Tarefas = lazy(() => import('../pages/Tarefas'))
const Atividades = lazy(() => import('../pages/Atividades'))
const Otimizacoes = lazy(() => import('../pages/Otimizacoes'))
const Atividades15min = lazy(() => import('../pages/Atividades15min'))
const Chat = lazy(() => import('../pages/Chat'))

// ── Biblioteca ─────────────────────────────────────────────
const BancoDeAnuncios = lazy(() => import('../pages/BancoDeAnuncios'))
const BancoDeLPs = lazy(() => import('../pages/BancoDeLPs'))
const RoteirosExpress = lazy(() => import('../pages/RoteirosExpress'))

// ── Dados ──────────────────────────────────────────────────
const DashboardApiTeste = lazy(() => import('../pages/DashboardApiTeste'))
const FunilCanvas = lazy(() => import('../pages/FunilCanvas'))
const AdsRoadmap = lazy(() => import('../pages/AdsRoadmap'))
const SquadsReport = lazy(() => import('../pages/SquadsReport'))

// ── Administração ──────────────────────────────────────────
const UserManagement = lazy(() => import('../pages/UserManagement'))

// ── Dev (só no build de desenvolvimento) ───────────────────
const DevHub = lazy(() => import('../pages/DevHub'))

export const appRoutes = [
  // Páginas com a sidebar global: o AppLayout monta a AppSidebar uma vez e
  // renderiza a página no <Outlet>. Quem não está aqui (login, públicas,
  // /cliente/:id, /cliente/novo) tem navegação própria.
  <Route key="shell" element={<RequireAuth><AppLayout /></RequireAuth>}>
    <Route key="home" path="/" element={<Dashboard />} />

    <Route key="tarefas" path="/tarefas" element={<Tarefas />} />
    <Route key="otimizacoes" path="/otimizacoes" element={<Otimizacoes />} />
    <Route key="atividades" path="/atividades" element={<Atividades />} />
    <Route key="atividades-15min" path="/atividades-15min" element={<Atividades15min />} />
    <Route key="chat" path="/chat" element={<Chat />} />

    <Route key="banco-anuncios" path="/banco-de-anuncios" element={<BancoDeAnuncios />} />
    <Route key="banco-lps" path="/banco-de-lps" element={<BancoDeLPs />} />
    <Route key="roteiros-express" path="/roteiros-express" element={<RoteirosExpress />} />

    {/* O dashboard antigo (planilhas) foi removido, então este é O dashboard —
        não precisa mais do sufixo "-teste" que marcava a convivência dos dois. */}
    <Route key="dashboard" path="/dashboard" element={<DashboardApiTeste />} />
    <Route key="funil" path="/funil" element={<FunilCanvas />} />
    <Route key="ads-roadmap" path="/ads-roadmap" element={<AdsRoadmap />} />
    <Route key="relatorio-squads" path="/relatorio-squads" element={<RequireSquadsAccess><SquadsReport /></RequireSquadsAccess>} />

    <Route key="usuarios" path="/usuarios" element={<RequireAdmin><UserManagement /></RequireAdmin>} />

    {/* O segmento de seção é opcional, mas o `?` do path saiu no react-router
        v6 — por isso as duas declarações. Sem seção = hub. */}
    <Route key="cliente" path="/cliente/:id" element={<ProjectDetail />} />
    <Route key="cliente-secao" path="/cliente/:id/:secao" element={<ProjectDetail />} />
  </Route>,

  // Fora do shell: o onboarding é um fluxo focado, com navegação própria.
  <Route key="cliente-novo" path="/cliente/novo" element={<RequireAuth><NewOnboarding /></RequireAuth>} />,

  // ── Legado ───────────────────────────────────────────────
  // Paths internos renomeados não precisam de redirect (ninguém guarda esses
  // links) — exceto os que podem estar gravados na coluna `link` das
  // notificações, de onde o NotificationCenter navega sem passar por nós.
  <Route key="legado-projeto" path="/project/:id" element={<RedirectProjetoLegado />} />,
  <Route key="legado-projeto-secao" path="/project/:id/:secao" element={<RedirectProjetoLegado />} />,
  <Route key="legado-dashboard" path="/dashboard-teste" element={<RedirectComQuery to="/dashboard" />} />,

  ...(import.meta.env.DEV
    ? [<Route key="dev-hub" path="/dev/hub" element={<DevHub />} />]
    : []),

  <Route key="catch-all" path="*" element={<Navigate to="/" replace />} />,
]
