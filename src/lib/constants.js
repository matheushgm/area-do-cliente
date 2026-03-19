// ─── Squad ────────────────────────────────────────────────────────────────────

// Paleta cíclica de 4 cores usada nos badges de squad
// Importar em: Dashboard, ClientProfile, UserManagement
export const SQUAD_COLORS = [
  { bg: 'bg-rl-gold/10',    border: 'border-rl-gold/30',    text: 'text-rl-gold'   },
  { bg: 'bg-rl-cyan/10',    border: 'border-rl-cyan/30',    text: 'text-rl-cyan'   },
  { bg: 'bg-rl-purple/10',  border: 'border-rl-purple/30',  text: 'text-rl-purple' },
  { bg: 'bg-green-500/10',  border: 'border-green-500/30',  text: 'text-green-400' },
]

// ─── Serviços ─────────────────────────────────────────────────────────────────

export const SERVICES_CONFIG = [
  { id: 'meta_ads',             label: 'Gestão de Meta Ads',                emoji: '📘' },
  { id: 'google_ads',           label: 'Gestão de Google Ads',              emoji: '🔍' },
  { id: 'tiktok_ads',           label: 'Gestão de TikTok Ads',              emoji: '🎵' },
  {
    id: 'criacao_roteiros',     label: 'Criação de Roteiros de Criativos',   emoji: '✏️',
    sub: [
      { key: 'imagemQty', label: 'Qtd. Imagens', placeholder: '0' },
      { key: 'videoQty',  label: 'Qtd. Vídeos',  placeholder: '0' },
    ],
  },
  {
    id: 'edicao_criativos',     label: 'Edição de Criativos',               emoji: '🎬',
    sub: [
      { key: 'estaticosQty', label: 'Qtd. Estáticos', placeholder: '0' },
      { key: 'videoQty',     label: 'Qtd. Vídeos',    placeholder: '0' },
    ],
  },
  {
    id: 'assessoria_comercial', label: 'Assessoria Comercial',               emoji: '💼',
    sub: [
      { key: 'nivel', label: 'Nível', type: 'select', options: ['Nível 1', 'Nível 2', 'Nível 3'] },
    ],
  },
  { id: 'consultoria',          label: 'Consultoria',                        emoji: '📊' },
  { id: 'mentoria',             label: 'Mentoria',                           emoji: '🎓' },
  { id: 'social_media',         label: 'Social Media',                       emoji: '📱' },
  { id: 'email_marketing',      label: 'E-mail Marketing',                   emoji: '📧' },
  { id: 'ai_whatsapp',          label: 'AI no WhatsApp',                     emoji: '🤖' },
  {
    id: 'landing_page',         label: 'Criação de Landing Page',            emoji: '🌐',
    sub: [
      { key: 'qty', label: 'Quantidade de Páginas', placeholder: '1' },
    ],
  },
]

// ─── Negócio ──────────────────────────────────────────────────────────────────

// Labels simples para exibição (display-only)
export const BUSINESS_LABELS = {
  b2b:         'B2B',
  local:       'Negócio Local',
  ecommerce:   'E-commerce',
  infoproduto: 'Infoproduto',
}

// Opções com ícone para o formulário de edição
export const EDIT_BUSINESS_TYPES = [
  { value: 'b2b',         label: 'B2B',          icon: '🏢' },
  { value: 'local',       label: 'Negócio Local', icon: '📍' },
  { value: 'ecommerce',   label: 'E-commerce',    icon: '🛒' },
  { value: 'infoproduto', label: 'Infoproduto',   icon: '🎓' },
]

// ─── Segmentos ────────────────────────────────────────────────────────────────

export const SEGMENTOS = [
  'Beleza e Estética', 'Saúde e Bem-estar', 'Alimentação / Gastronomia',
  'Clínica / Odontologia', 'Academia / Fitness', 'Moda e Vestuário',
  'E-commerce / Varejo', 'Imobiliário', 'Tecnologia / SaaS',
  'Educação / Cursos Online', 'Serviços Profissionais', 'Consultoria Empresarial',
  'Marketing Digital', 'Social Media', 'Turismo e Viagens',
  'Construção Civil', 'Automotivo', 'Farmácia / Drogaria', 'Pet Shop / Veterinária',
  'Advocacia / Jurídico', 'Financeiro / Seguros', 'Ótica',
  'Entretenimento / Eventos', 'Logística / Transporte', 'Indústria / Manufatura',
]

// ─── Maturidade digital ───────────────────────────────────────────────────────

// Labels para exibição
export const MATURITY_LABELS = {
  '1': 'Iniciante — nunca anunciou online',
  '2': 'Básico — já testou anúncios',
  '3': 'Intermediário — tem histórico de campanhas',
  '4': 'Avançado — processos definidos',
  '5': 'Expert — gestão data-driven',
}

// Opções para o formulário de edição
export const EDIT_MATURITY_OPTIONS = [
  { value: '1', label: 'Iniciante — nunca anunciou' },
  { value: '2', label: 'Básico — já testou anúncios' },
  { value: '3', label: 'Intermediário — tem histórico' },
  { value: '4', label: 'Avançado — processos definidos' },
  { value: '5', label: 'Expert — gestão data-driven' },
]

// ─── Contrato ─────────────────────────────────────────────────────────────────

export const CONTRACT_MODEL_LABELS = {
  aceleracao: '🚀 Programa de Aceleração',
  assessoria: '📅 Assessoria Mensal',
}

export const CONTRACT_PAYMENT_LABELS = {
  unico:  'Valor Único',
  mensal: 'Parcelado (Mensal)',
}
