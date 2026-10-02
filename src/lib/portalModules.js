// Módulos que podem ser liberados no portal do cliente / parceiro.
// Compartilhado entre o front (src/lib/portal.js → matriz de permissões e
// sidebar do portal) e api/portal.js (importa por caminho relativo; fica em
// src/ porque no `vercel dev` tudo sob /api/ vira rota e o Vite não consegue
// servir o módulo).
// `id` = mesmo id da seção no ClientProfile.

export const PORTAL_MODULES = [
  { id: 'dados',       label: 'Dados do Cliente' },
  { id: 'kickoff',     label: 'Kickoff' },
  { id: 'produtos',    label: 'Produto / Serviço' },
  { id: 'icp',         label: 'Personas' },
  { id: 'oferta',      label: 'Oferta Matadora' },
  { id: 'roi',         label: 'Calculadora de ROI' },
  { id: 'campaign',    label: 'Campanhas' },
  { id: 'debriefing',  label: 'Central de anúncios' },
  { id: 'lpcentral',   label: 'Central de Landing Pages' },
  { id: 'landingpage', label: 'Landing pages (IA)' },
  { id: 'googleads',   label: 'Google Ads com IA' },
  { id: 'metalab',     label: 'Lab. Meta Ads' },
  { id: 'estrategiav2',label: 'Estratégia' },
  { id: 'resultados',  label: 'Resultados' },
  { id: 'nps',         label: 'NPS' },
  { id: 'atas',        label: 'Atas de Reunião' },
  { id: 'links',       label: 'Links Importantes' },
  { id: 'anexos',      label: 'Anexos' },
  // Interativos: têm nível "edit" de verdade (o portal grava).
  { id: 'aprovacao',   label: 'Aprovação de anúncios e LPs', levels: ['none', 'view', 'edit'], editLabel: 'Aprovar' },
  { id: 'criativos',   label: 'Criação de anúncios (IA)',    levels: ['none', 'edit'],         editLabel: 'Usar' },
]

// Níveis que um módulo aceita. Sem `levels` declarado = só leitura por enquanto
// (edit existe no esquema mas o portal ainda não renderiza edição).
export function moduleLevels(m) {
  return m.levels || ['none', 'view']
}

export const PERMISSION_LEVELS = ['none', 'view', 'edit']

export const PERMISSION_LABELS = {
  none: 'Sem acesso',
  view: 'Visualizar',
  edit: 'Editar',
}

export const MODULE_IDS = new Set(PORTAL_MODULES.map((m) => m.id))

// Normaliza o JSON de permissões vindo do cliente: só módulos conhecidos e
// só níveis válidos (none some do objeto).
export function sanitizePermissions(input) {
  const out = {}
  if (!input || typeof input !== 'object') return out
  for (const [k, v] of Object.entries(input)) {
    if (!MODULE_IDS.has(k)) continue
    if (v === 'view' || v === 'edit') out[k] = v
  }
  return out
}
