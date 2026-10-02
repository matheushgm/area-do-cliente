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

// Redirect simples que preserva querystring e hash.
export function RedirectComQuery({ to }) {
  const { search, hash } = useLocation()
  return <Navigate to={`${to}${search}${hash}`} replace />
}
