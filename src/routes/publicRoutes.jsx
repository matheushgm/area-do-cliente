import { lazy } from 'react'
import { Route } from 'react-router-dom'
import { RedirectIfAuthed } from './guards'
import PaginaPublica from '../components/Publico/PaginaPublica'

// Rotas sem login. Cada path aqui já foi enviado para cliente ou parceiro —
// NÃO renomeie nenhum; só acrescente. Toda página pública vai dentro de <PaginaPublica>
// (idioma por `?lang=`/navegador e seletor PT | EN); só o login e a redefinição de senha, que são
// do time, ficam de fora.

// ── Auth ───────────────────────────────────────────────────
const Login = lazy(() => import('../pages/Login'))
const ResetPassword = lazy(() => import('../pages/ResetPassword'))

// ── Portal do cliente / parceiro (senha própria) ───────────
const Portal = lazy(() => import('../pages/Portal'))
const PedidoPublico = lazy(() => import('../pages/PedidoPublico'))
const ListaPublica = lazy(() => import('../pages/ListaPublica'))
const VagaPublica = lazy(() => import('../pages/VagaPublica'))

// ── Formulários e documentos por token do projeto ──────────
const ClientForm = lazy(() => import('../pages/ClientForm'))
const OfertaMatadoraPublico = lazy(() => import('../pages/OfertaMatadoraPublico'))
const MecanismoUnicoPublico = lazy(() => import('../pages/MecanismoUnicoPublico'))
const B2CClientForm = lazy(() => import('../pages/B2CClientForm'))
const B2BClientForm = lazy(() => import('../pages/B2BClientForm'))
const MeetingMinutePublico = lazy(() => import('../pages/MeetingMinutePublico'))
const MatrizObjecaoPublico = lazy(() => import('../pages/MatrizObjecaoPublico'))
const PrecificacaoPublico = lazy(() => import('../pages/PrecificacaoPublico'))
const CampanhasPublico = lazy(() => import('../pages/CampanhasPublico'))
const NPSClientForm = lazy(() => import('../pages/NPSClientForm'))
const CRMPublico = lazy(() => import('../pages/CRMPublico'))
const WebinarPublico = lazy(() => import('../pages/WebinarPublico'))
const BancoDadosPublico = lazy(() => import('../pages/BancoDadosPublico'))

// ── Aprovação pelo cliente ─────────────────────────────────
const AprovacaoAnunciosPublico = lazy(() => import('../pages/AprovacaoAnunciosPublico'))
const AprovacaoCopyPublico = lazy(() => import('../pages/AprovacaoCopyPublico'))
const CriativosPublico = lazy(() => import('../pages/CriativosPublico'))

// ── Bancos compartilháveis (sem token, filtros na querystring) ──
const BancoDeAnunciosPublico = lazy(() => import('../pages/BancoDeAnunciosPublico'))
const BancoDeLPsPublico = lazy(() => import('../pages/BancoDeLPsPublico'))
const RoteirosExpressPublico = lazy(() => import('../pages/RoteirosExpressPublico'))

export const publicRoutes = [
  <Route key="login" path="/login" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />,
  <Route key="reset" path="/reset-password" element={<ResetPassword />} />,

  <Route key="portal" path="/portal/:projectId" element={<PaginaPublica><Portal /></PaginaPublica>} />,

  <Route key="client" path="/client/:token" element={<PaginaPublica><ClientForm /></PaginaPublica>} />,
  <Route key="oferta" path="/oferta/:token" element={<PaginaPublica><OfertaMatadoraPublico /></PaginaPublica>} />,
  <Route key="mecanismo" path="/mecanismo/:token" element={<PaginaPublica><MecanismoUnicoPublico /></PaginaPublica>} />,
  <Route key="b2c" path="/b2c/:token" element={<PaginaPublica canto="topo"><B2CClientForm /></PaginaPublica>} />,
  <Route key="b2b" path="/b2b/:token" element={<PaginaPublica canto="topo"><B2BClientForm /></PaginaPublica>} />,
  <Route key="ata" path="/ata/:token" element={<PaginaPublica><MeetingMinutePublico /></PaginaPublica>} />,
  <Route key="objecoes" path="/objecoes/:token" element={<PaginaPublica><MatrizObjecaoPublico /></PaginaPublica>} />,
  <Route key="precificacao" path="/precificacao/:token" element={<PaginaPublica><PrecificacaoPublico /></PaginaPublica>} />,
  <Route key="campanhas" path="/campanhas/:token" element={<PaginaPublica><CampanhasPublico /></PaginaPublica>} />,
  <Route key="nps" path="/nps/:token" element={<PaginaPublica><NPSClientForm /></PaginaPublica>} />,
  <Route key="crm" path="/crm/:token" element={<PaginaPublica><CRMPublico /></PaginaPublica>} />,
  <Route key="webinar" path="/webinar/:token" element={<PaginaPublica><WebinarPublico /></PaginaPublica>} />,
  <Route key="leads" path="/leads/:token" element={<PaginaPublica><BancoDadosPublico /></PaginaPublica>} />,

  <Route key="aprovacao" path="/aprovacao/:token" element={<PaginaPublica><AprovacaoAnunciosPublico /></PaginaPublica>} />,
  <Route key="pedido" path="/pedido/:token" element={<PaginaPublica><PedidoPublico /></PaginaPublica>} />,
  <Route key="lista-publica" path="/lista/:token" element={<PaginaPublica><ListaPublica /></PaginaPublica>} />,
  <Route key="vaga" path="/vaga/:cargo" element={<PaginaPublica><VagaPublica /></PaginaPublica>} />,
  <Route key="aprovacao-copy" path="/aprovacao-copy/:token" element={<PaginaPublica><AprovacaoCopyPublico /></PaginaPublica>} />,
  <Route key="criativos" path="/criativos/:projectId/:token" element={<PaginaPublica><CriativosPublico /></PaginaPublica>} />,

  <Route key="banco-publico" path="/banco-publico" element={<PaginaPublica><BancoDeAnunciosPublico /></PaginaPublica>} />,
  <Route key="banco-lps-publico" path="/banco-lps-publico" element={<PaginaPublica><BancoDeLPsPublico /></PaginaPublica>} />,
  <Route key="roteiros" path="/roteiros/:token" element={<PaginaPublica><RoteirosExpressPublico /></PaginaPublica>} />,
]
