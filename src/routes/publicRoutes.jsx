import { lazy } from 'react'
import { Route } from 'react-router-dom'
import { RedirectIfAuthed } from './guards'

// Rotas sem login. Cada path aqui já foi enviado para cliente ou parceiro —
// NÃO renomeie nenhum; só acrescente.

// ── Auth ───────────────────────────────────────────────────
const Login = lazy(() => import('../pages/Login'))
const ResetPassword = lazy(() => import('../pages/ResetPassword'))

// ── Portal do cliente / parceiro (senha própria) ───────────
const Portal = lazy(() => import('../pages/Portal'))

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

  <Route key="portal" path="/portal/:projectId" element={<Portal />} />,

  <Route key="client" path="/client/:token" element={<ClientForm />} />,
  <Route key="oferta" path="/oferta/:token" element={<OfertaMatadoraPublico />} />,
  <Route key="mecanismo" path="/mecanismo/:token" element={<MecanismoUnicoPublico />} />,
  <Route key="b2c" path="/b2c/:token" element={<B2CClientForm />} />,
  <Route key="b2b" path="/b2b/:token" element={<B2BClientForm />} />,
  <Route key="ata" path="/ata/:token" element={<MeetingMinutePublico />} />,
  <Route key="objecoes" path="/objecoes/:token" element={<MatrizObjecaoPublico />} />,
  <Route key="precificacao" path="/precificacao/:token" element={<PrecificacaoPublico />} />,
  <Route key="campanhas" path="/campanhas/:token" element={<CampanhasPublico />} />,
  <Route key="nps" path="/nps/:token" element={<NPSClientForm />} />,
  <Route key="crm" path="/crm/:token" element={<CRMPublico />} />,
  <Route key="webinar" path="/webinar/:token" element={<WebinarPublico />} />,

  <Route key="aprovacao" path="/aprovacao/:token" element={<AprovacaoAnunciosPublico />} />,
  <Route key="aprovacao-copy" path="/aprovacao-copy/:token" element={<AprovacaoCopyPublico />} />,
  <Route key="criativos" path="/criativos/:projectId/:token" element={<CriativosPublico />} />,

  <Route key="banco-publico" path="/banco-publico" element={<BancoDeAnunciosPublico />} />,
  <Route key="banco-lps-publico" path="/banco-lps-publico" element={<BancoDeLPsPublico />} />,
  <Route key="roteiros" path="/roteiros/:token" element={<RoteirosExpressPublico />} />,
]
