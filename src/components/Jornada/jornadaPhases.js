// Configuração das fases da Jornada do cliente + lógica de status por módulo.
//
// Cada item de fase referencia o `id` do módulo na sidebar de ClientProfile,
// pra que clicar abra direto aquele módulo. Pra ferramentas internas
// (Mecanismo Único, Promessa, Planejamento Anual), usamos a flag
// `viaFerramentas: true` — o navegador da Jornada manda pra Ferramentas
// passando o tool id, e a FerramentasModule abre direto naquele tool.

export const PHASES = [
  {
    id: 'preparacao',
    number: 1,
    title: 'Preparação',
    desc: 'Conheça o negócio, o público e o objetivo — a base de tudo.',
    color: 'rl-blue',
    bgClass: 'bg-rl-blue/5',
    borderClass: 'border-rl-blue/30',
    accent: '#2563EB',
    badge: 'Base universal',
    modules: [
      { id: 'dados',        label: 'Dados do Cliente',        emoji: '🗂',  desc: 'Informações cadastrais, contratuais e do negócio.' },
      { id: 'produtos',     label: 'Produto / Serviço',        emoji: '📦',  desc: 'O que o cliente vende, ICP por linha de receita.' },
      { id: 'icp',          label: 'Personas',                 emoji: '🎯',  desc: 'Sonhos, dores, objeções e hábitos do cliente ideal.' },
      { id: 'kickoff',      label: 'Kickoff',                  emoji: '🧭',  desc: 'Diagnóstico inicial em 9 pilares e veredito de oferta matadora.' },
      { id: 'roi',          label: 'Calculadora de ROI',       emoji: '📊',  desc: 'Leads, MQLs, SQLs e vendas necessários pra atingir o ROI alvo.' },
      { id: 'estrategiav2', label: 'Análise Competitiva',      emoji: '🗺',  desc: 'Mapa de concorrência e oportunidades de diferenciação.' },
      { id: 'links',        label: 'Links Importantes',        emoji: '🔗',  desc: 'Centralize os links do projeto pra acesso rápido.' },
    ],
  },
  {
    id: 'criacao',
    number: 2,
    title: 'Criação',
    desc: 'Construa os ativos que vão gerar demanda.',
    color: 'rl-purple',
    bgClass: 'bg-rl-purple/5',
    borderClass: 'border-rl-purple/30',
    accent: '#7C3AED',
    badge: 'Ativos',
    modules: [
      { id: 'mecanismo_unico', label: 'Mecanismo Único',          emoji: '✨', desc: 'Playbook de diferenciação em 6 seções + posicionamento com IA.', viaFerramentas: true },
      { id: 'oferta',          label: 'Oferta Matadora',          emoji: '⚡', desc: 'Estrutura de oferta com bônus, garantia e gatilhos.' },
      { id: 'promessa',        label: 'Criação de Promessa',      emoji: '🎯', desc: 'Estrutura a grande promessa do produto/serviço.', viaFerramentas: true },
      { id: 'campaign',        label: 'Campanha',                 emoji: '📅', desc: 'Planejamento de campanhas por canal e estágio do funil.' },
      { id: 'criativos',       label: 'Criativos com IA',         emoji: '🎬', desc: 'Geração de criativos estáticos e roteiros de vídeo.' },
      { id: 'landingpage',     label: 'Landing Page com IA',      emoji: '📄', desc: 'Estrutura de landing page dobra a dobra com IA.' },
      { id: 'metalab',         label: 'Laboratório de Meta Ads',  emoji: '🧪', desc: 'Protocolo de testes em 3 fases (criativos, públicos, ganchos).' },
      { id: 'googleads',       label: 'Google Ads com IA',        emoji: '🔍', desc: 'Grupos de palavras-chave + geração de copy de anúncio.' },
    ],
  },
  {
    id: 'no_ar',
    number: 3,
    title: 'Campanhas no ar',
    desc: 'Execução, controle e acompanhamento em tempo real.',
    color: 'rl-gold',
    bgClass: 'bg-rl-gold/5',
    borderClass: 'border-rl-gold/30',
    accent: '#D97706',
    badge: 'Execução',
    modules: [
      { id: 'debriefing', label: 'Central de anúncios', emoji: '📣', desc: 'Rastreamento dos criativos no ar + status por anúncio.' },
      { id: 'resultados', label: 'Resultados',          emoji: '📈', desc: 'Performance B2B / B2C com link pro cliente preencher.' },
    ],
  },
  {
    id: 'primeiros_resultados',
    number: 4,
    title: 'Primeiros resultados',
    desc: 'Valide a satisfação e o resultado percebido pelo cliente.',
    color: 'rl-green',
    bgClass: 'bg-rl-green/5',
    borderClass: 'border-rl-green/30',
    accent: '#059669',
    badge: 'Validação',
    modules: [
      { id: 'nps', label: 'NPS', emoji: '⭐', desc: 'Pesquisa de satisfação por marco do contrato.' },
    ],
  },
]

// ─── Status por módulo ────────────────────────────────────────────────────────
// Retorna 'concluido' | 'andamento' | 'pendente' baseado no que existe no
// project. Pra módulos sem indicador claro de "em andamento", retorna binário.
export function getModuleStatus(project, moduleId) {
  if (!project) return 'pendente'
  switch (moduleId) {
    case 'dados': return 'concluido' // cliente só existe se tem dados básicos

    case 'kickoff': {
      const k = project.kickoff
      if (k?.completedAt) return 'concluido'
      if (k?.businessType) return 'andamento'
      return 'pendente'
    }

    case 'produtos':
      return project.produtos?.length ? 'concluido' : 'pendente'

    case 'icp':
      return project.personas?.length ? 'concluido' : 'pendente'

    case 'roi':
      return project.roiCalc ? 'concluido' : 'pendente'

    case 'estrategiav2': {
      const e = project.estrategiaV2
      if (e && typeof e === 'object' && Object.keys(e).length > 0) return 'concluido'
      return 'pendente'
    }

    case 'links':
      return project.links?.length ? 'concluido' : 'pendente'

    case 'mecanismo_unico': {
      const m = project.mecanismoUnico
      if (!m) return 'pendente'
      if (m.aiAnalysis || m.positioningAI) return 'concluido'
      const hasContent = !!(
        m.nomeMecanismo ||
        m.vilaoPrincipal ||
        m.euAjudo ||
        (m.concorrentes && m.concorrentes.length) ||
        (m.diferentes   && m.diferentes.length)
      )
      return hasContent ? 'andamento' : 'pendente'
    }

    case 'oferta':
      return project.ofertaData ? 'concluido' : 'pendente'

    case 'promessa': {
      const p = project.promessa
      if (!p) return 'pendente'
      if (p.result || p.narrativa) return 'concluido'
      // tem campos preenchidos mas sem geração?
      const hasContent = !!(p.objetivo || (p.editedBlocks && Object.keys(p.editedBlocks).length))
      return hasContent ? 'andamento' : 'pendente'
    }

    case 'campaign':
      return project.campaignPlan ? 'concluido' : 'pendente'

    case 'criativos':
      return (project.creatives || []).some((c) => !c.isDraft) ? 'concluido' : 'pendente'

    case 'landingpage':
      return project.landingPages?.length ? 'concluido' : 'pendente'

    case 'metalab':
      return project.metaLabBudget ? 'concluido' : 'pendente'

    case 'googleads':
      return (project.googleAds || []).some((g) => !g.isDraft) ? 'concluido' : 'pendente'

    case 'debriefing':
      return project.debriefing?.ads?.length ? 'concluido' : 'pendente'

    case 'resultados':
      return project.resultados?.modelo ? 'concluido' : 'pendente'

    case 'nps':
      return (project.nps && Object.values(project.nps).some(Boolean)) ? 'concluido' : 'pendente'

    default:
      return 'pendente'
  }
}

// ─── Estatísticas agregadas ───────────────────────────────────────────────────
export function computeProgress(project) {
  const allModules = PHASES.flatMap((p) => p.modules)
  let done = 0
  let andamento = 0
  for (const m of allModules) {
    const s = getModuleStatus(project, m.id)
    if (s === 'concluido') done++
    else if (s === 'andamento') andamento++
  }
  const total = allModules.length
  // % considera concluído = 1, andamento = 0.5
  const raw = (done + andamento * 0.5) / total
  return {
    total,
    done,
    andamento,
    pendente: total - done - andamento,
    percent: Math.round(raw * 100),
  }
}

export function computePhaseProgress(project, phase) {
  let done = 0
  let andamento = 0
  for (const m of phase.modules) {
    const s = getModuleStatus(project, m.id)
    if (s === 'concluido') done++
    else if (s === 'andamento') andamento++
  }
  const total = phase.modules.length
  return { total, done, andamento, pendente: total - done - andamento }
}
