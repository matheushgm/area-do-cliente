import { Navigate, useParams, useLocation } from 'react-router-dom'
import { cliente } from './paths'

// `<Navigate to>` é estático: não interpola `:id` nem carrega a querystring.
// Estes dois componentes existem só para isso.

// `/project/:id[/:secao]` → `/cliente/:id[/:secao]`.
// Não dá para simplesmente apagar o path antigo: MeetingMinutesModule grava
// `/project/<id>` na coluna `link` da tabela `notifications`, e o
// NotificationCenter navega pra lá direto, sem passar por código nosso. As
// linhas já gravadas continuam chegando aqui.
export function RedirectProjetoLegado() {
  const { id, secao } = useParams()
  const { search, hash } = useLocation()
  return <Navigate to={`${cliente(id, secao)}${search}${hash}`} replace />
}

// `/chat?channel=&thread=&msg=` → `/tarefas?aba=chat&...`: o Chat virou módulo do
// VertaTask. Os links antigos (notificações, mensagens, favoritos) continuam valendo.
export function RedirectChat() {
  const { search, hash } = useLocation()
  const p = new URLSearchParams(search)
  p.set('aba', 'chat')
  return <Navigate to={`/tarefas?${p.toString()}${hash}`} replace />
}

// `/atividades` → `/tarefas?aba=atividades`: o planejador de capacidade virou seção do VertaTask.
export function RedirectAtividades() {
  const { search, hash } = useLocation()
  const p = new URLSearchParams(search)
  p.set('aba', 'atividades')
  return <Navigate to={`/tarefas?${p.toString()}${hash}`} replace />
}

// `/` virou a Inicial (2026-11-27) e a lista de clientes foi para `/clientes`. Link antigo
// da lista (`/?lista=novos|churn`, `/?visao=crescimento&...`) vai para `/clientes` com a
// mesma querystring; `/` sem esses parâmetros mostra a Inicial (children).
export function RaizOuClientesLegado({ children }) {
  const { search, hash } = useLocation()
  const p = new URLSearchParams(search)
  if (p.has('lista') || p.has('visao')) return <Navigate to={`/clientes${search}${hash}`} replace />
  return children
}

// Redirect simples que preserva querystring e hash.
export function RedirectComQuery({ to }) {
  const { search, hash } = useLocation()
  return <Navigate to={`${to}${search}${hash}`} replace />
}
