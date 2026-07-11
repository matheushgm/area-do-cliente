// ─── Banco de Anúncios / Banco de LP — classificação por funil ───────────────
// Fonte única de verdade da lista de funis. Reusada pelo Banco de Anúncios
// (estáticos/vídeos) e pelo Banco de LP (landing pages).
// Importar em: BancoDeAnuncios, BancoDeAnunciosPublico, BancoDeLPs, BancoDeLPsPublico
export const BANCO_FUNIS = [
  'Funil de Webinar',
  'Funil de Aplicação',
  'Funil de Diagnóstico',
  'Funil de E-commerce (Venda Direta)',
  'Funil de Webinar Pago',
  'Funil de Isca Digital',
  'Funil de VSL',
  'Funil de Quiz',
  'Lançamento',
  'Funil de Desafio',
  'Funil Win-Your-Money-Back',
]

// ─── Squad ────────────────────────────────────────────────────────────────────

// Paleta cíclica de 4 cores usada nos badges de squad
// Importar em: Dashboard, ClientProfile, UserManagement
export const SQUAD_COLORS = [
  { bg: 'bg-rl-gold/10',    border: 'border-rl-gold/30',    text: 'text-rl-gold'   },
  { bg: 'bg-rl-cyan/10',    border: 'border-rl-cyan/30',    text: 'text-rl-cyan'   },
  { bg: 'bg-rl-purple/10',  border: 'border-rl-purple/30',  text: 'text-rl-purple' },
  { bg: 'bg-green-500/10',  border: 'border-green-500/30',  text: 'text-green-400' },
]

// ─── ClickUp — campo "Departamento" ──────────────────────────────────────────
// Cada departamento tem id (matches ClickUp option id), nome (com trim — alguns
// têm espaço extra no final no ClickUp) e cor para exibição.
// Importar em: UserManagement (modal de departamentos), api/clickup (resolver
//             option_id → nome → profile via squad.departmentAssignments).
export const CLICKUP_DEPARTMENT_FIELD_ID = 'e60bebff-b035-49c2-879b-972777ed041e'
export const CLICKUP_DEPARTMENTS = [
  { id: 'a44f7b38-1972-41a6-857a-feacc52ce689', name: 'Gestor de tráfego',     color: '#0231E8' },
  { id: 'a04634c3-be4e-4d30-987c-02f485ceaaf8', name: 'Estrategista',          color: '#ff7800' },
  { id: 'f29de476-0d11-45e1-afc0-0a3bd9e3aa47', name: 'Comercial',             color: '#2ecd6f' },
  { id: '15d2487a-cbac-4ebf-873e-35154dc1c4b0', name: 'Cliente',               color: '#AF7E2E' },
  { id: '70447c34-6b7e-457b-842d-b41bc0a7bb07', name: 'Copywriter',            color: '#667684' },
  { id: 'c5afae7f-be83-4d99-bfec-fa9edc93ef6f', name: 'Web Designer',          color: '#81B1FF' },
  { id: '6592c59b-3fab-4c91-a0d9-2448e4d5e81d', name: 'Designer',              color: '#bf55ec' },
  { id: '1f8ec57f-cbf4-413c-b8e7-a067ee991f18', name: 'Account Manager',       color: '#E65100' },
  { id: '5bee1f1a-4595-4dc1-bf9a-1e69e6fc4f36', name: 'Automação / Integração',color: '#f9d900' },
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
  {
    id: 'social_media',         label: 'Social Media',                       emoji: '📱',
    sub: [
      { key: 'carrosselQty',  label: 'Qtd. Carrossel',          placeholder: '0' },
      { key: 'reelsQty',      label: 'Qtd. Reels',              placeholder: '0' },
      { key: 'estaticaQty',   label: 'Qtd. Estática',           placeholder: '0' },
      { key: 'storiesQty',    label: 'Qtd. Stories',            placeholder: '0' },
      { key: 'storiesFreq',   label: 'Frequência Stories', type: 'select',
        options: ['Diária', '5x por semana', '3x por semana', '2x por semana', '1x por semana'] },
    ],
  },
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
