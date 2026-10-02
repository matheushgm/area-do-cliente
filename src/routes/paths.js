// Paths COM parâmetro, montados por função. Paths literais (`/tarefas`,
// `/chat`…) continuam strings nos `navigate()` — uma constante para cada um
// seria indireção sem ganho, já que a navegação do app é imperativa e espalhada.
//
// Links públicos: as URLs abaixo já estão na mão de clientes. Mudar qualquer
// uma delas quebra link enviado — só acrescente.

const enc = encodeURIComponent

// ── Interno ────────────────────────────────────────────────
// `secao` é o SLUG da seção (ver src/lib/clientSections.js), não o id.
export const cliente = (id, secao) => `/cliente/${id}${secao ? `/${secao}` : ''}`

// ── Público (não mudar) ────────────────────────────────────
export const portal = (projectId) => `/portal/${projectId}`
export const client = (token) => `/client/${token}`
export const oferta = (token) => `/oferta/${token}`
export const mecanismo = (token) => `/mecanismo/${token}`
export const b2b = (token) => `/b2b/${token}`
export const b2c = (token) => `/b2c/${token}`
export const ata = (token) => `/ata/${token}`
export const objecoes = (token) => `/objecoes/${token}`
export const precificacao = (token) => `/precificacao/${token}`
export const campanhas = (token) => `/campanhas/${token}`
export const aprovacao = (token) => `/aprovacao/${token}`
export const aprovacaoCopy = (token) => `/aprovacao-copy/${token}`
export const nps = (token, marco) => `/nps/${token}${marco ? `?marco=${enc(marco)}` : ''}`
export const crm = (token) => `/crm/${token}`
export const webinar = (token) => `/webinar/${token}`
export const roteiros = (token) => `/roteiros/${token}`
export const criativos = (projectId, token) => `/criativos/${projectId}/${token}`
