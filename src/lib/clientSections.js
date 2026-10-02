// Tradução entre o id de uma seção do ClientProfile e o slug que ela usa na
// URL (`/cliente/:id/:secao`).
//
// ATENÇÃO: os ids NÃO podem ser renomeados. Os que também aparecem em
// `portalModules.js` são chaves de `project_shares.permissions` (jsonb no
// banco, lido por api/portal.js) — renomear um id revoga silenciosamente a
// permissão que um cliente já tem. O slug existe justamente para deixar a URL
// legível sem tocar no id.

export const DEFAULT_SECTION = 'hub'

// id → slug. Só precisa entrar aqui o id cujo slug é diferente dele mesmo.
const SLUG_BY_ID = {
  debriefing: 'central-de-anuncios',
  lpcentral: 'central-de-lps',
  icp: 'personas',
  campaign: 'campanhas',
  landingpage: 'landing-pages',
  metalab: 'meta-lab',
  googleads: 'google-ads',
  'banco-midia': 'banco-de-midia',
  estrategiav2: 'estrategia',
  bancodados: 'banco-de-dados',
}

// Ids sem slug próprio (slug = id). Mantido explícito para servir de whitelist:
// uma seção que não está em nenhuma das duas listas é URL inválida.
const IDENTITY_IDS = [
  'jornada', 'dados', 'kickoff', 'produtos', 'oferta', 'roi', 'anexos',
  'criativos', 'resultados', 'links', 'nps', 'crm', 'atas', 'ferramentas',
  'compartilhar',
]

export const SECTION_IDS = [DEFAULT_SECTION, ...IDENTITY_IDS, ...Object.keys(SLUG_BY_ID)]

const ID_BY_SLUG = Object.fromEntries([
  ...IDENTITY_IDS.map((id) => [id, id]),
  ...Object.entries(SLUG_BY_ID).map(([id, slug]) => [slug, id]),
])

// O hub é a raiz: `/cliente/:id` sem segmento.
export function slugFromSection(id) {
  if (!id || id === DEFAULT_SECTION) return ''
  return SLUG_BY_ID[id] || (IDENTITY_IDS.includes(id) ? id : '')
}

// Devolve null quando o slug não existe — quem chama redireciona pro hub.
export function sectionFromSlug(slug) {
  if (!slug) return DEFAULT_SECTION
  return ID_BY_SLUG[slug] || null
}
