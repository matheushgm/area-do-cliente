// Configuração das fases da Jornada do cliente + lógica de status por módulo.
//
// Cada item de fase referencia o `id` do módulo na sidebar de ClientProfile,
// pra que clicar abra direto aquele módulo. Pra ferramentas internas
// (Mecanismo Único, Promessa, Planejamento Anual), usamos a flag
// `viaFerramentas: true` — o navegador da Jornada manda pra Ferramentas
// passando o tool id, e a FerramentasModule abre direto naquele tool.

import { t } from '../../i18n'

const FASES_BASE = [
  {
    id: 'preparacao',
    number: 1,
    color: 'rl-blue',
    bgClass: 'bg-rl-blue/5',
    borderClass: 'border-rl-blue/30',
    accent: '#2563EB',
    modules: [
      { id: 'dados',        emoji: '🗂' },
      { id: 'produtos',     emoji: '📦' },
      { id: 'icp',          emoji: '🎯' },
      { id: 'kickoff',      emoji: '🧭' },
      { id: 'roi',          emoji: '📊' },
    ],
  },
  {
    id: 'criacao',
    number: 2,
    color: 'rl-purple',
    bgClass: 'bg-rl-purple/5',
    borderClass: 'border-rl-purple/30',
    accent: '#7C3AED',
    modules: [
      { id: 'mecanismo_unico', emoji: '✨', viaFerramentas: true },
      { id: 'oferta',          emoji: '⚡' },
      { id: 'promessa',        emoji: '🎯', viaFerramentas: true },
      { id: 'campaign',        emoji: '📅' },
      { id: 'estrategiav2',    emoji: '🗺' },
      { id: 'criativos',       emoji: '🎬' },
      { id: 'landingpage',     emoji: '📄' },
      { id: 'metalab',         emoji: '🧪' },
      { id: 'googleads',       emoji: '🔍' },
    ],
  },
  {
    id: 'no_ar',
    number: 3,
    color: 'rl-gold',
    bgClass: 'bg-rl-gold/5',
    borderClass: 'border-rl-gold/30',
    accent: '#D97706',
    modules: [
      { id: 'debriefing', emoji: '📣' },
      { id: 'resultados', emoji: '📈' },
    ],
  },
  {
    id: 'primeiros_resultados',
    number: 4,
    color: 'rl-green',
    bgClass: 'bg-rl-green/5',
    borderClass: 'border-rl-green/30',
    accent: '#059669',
    modules: [
      { id: 'nps', emoji: '⭐' },
    ],
  },
]

// Textos no idioma de quem lê: title/desc/badge da fase e label/desc do módulo são
// getters que leem o dicionário `jornada` na hora (ids e flags não mudam).
function comTextos(fase) {
  const base = `jornada.fases.${fase.id}`
  Object.defineProperties(fase, {
    title: { get: () => t(`${base}.titulo`), enumerable: true },
    desc:  { get: () => t(`${base}.desc`), enumerable: true },
    badge: { get: () => t(`${base}.selo`), enumerable: true },
  })
  for (const mod of fase.modules) {
    Object.defineProperties(mod, {
      label: { get: () => t(`${base}.modulos.${mod.id}.rotulo`), enumerable: true },
      desc:  { get: () => t(`${base}.modulos.${mod.id}.desc`), enumerable: true },
    })
  }
  return fase
}

export const PHASES = FASES_BASE.map(comTextos)

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
      // Conta respostas de verdade: um marco sem respostas é um array vazio, e
      // array vazio é truthy — o teste antigo dava 'concluido' para marco limpo.
      return (project.npsMarcos || []).some((m) => (m.respostas || []).length > 0)
        ? 'concluido' : 'pendente'

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
