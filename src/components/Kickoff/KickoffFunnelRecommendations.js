// Catálogo de funis + lógica de recomendação. Roda no fim do diagnóstico
// Kickoff e devolve quais funis fazem sentido pra esse cliente, com a
// justificativa de cada match.
//
// Nome, descrição de cada funil e as razões moram em
// src/i18n/locales/{pt,en}/kickoffRecomendacoes.js. `label` e `desc` são getters (traduzem
// no idioma de agora a cada leitura), então quem importa FUNNELS (Central de anúncios,
// Central de LPs) continua lendo `f.label` / `f.desc`. As razões são traduzidas na hora em
// que a recomendação é calculada (o painel recalcula ao trocar o idioma).
import { t } from '../../i18n'
import { ligarCampo } from './KickoffQuestions'

const razao = (funil, chave) => t(`kickoffRecomendacoes.razoes.${funil}.${chave}`)

export const FUNNELS = [
  { id: 'webinar', icon: '🎥' },
  { id: 'diagnostico', icon: '🔍' },
  { id: 'webinar_pago', icon: '💎' },
  { id: 'vsl', icon: '📹' },
  { id: 'lancamento', icon: '🚀' },
  { id: 'wymb', icon: '🛡️' },
  { id: 'aplicacao', icon: '📋' },
  { id: 'ecommerce', icon: '🛒' },
  { id: 'isca_digital', icon: '🧲' },
  { id: 'quiz', icon: '❓' },
  { id: 'whatsapp', icon: '💬' },
  { id: 'desafio', icon: '🏆' },
]

for (const f of FUNNELS) {
  ligarCampo(f, 'label', `kickoffRecomendacoes.funis.${f.id}.label`)
  ligarCampo(f, 'desc', `kickoffRecomendacoes.funis.${f.id}.desc`)
}

export const FUNNELS_BY_ID = Object.fromEntries(FUNNELS.map((f) => [f.id, f]))

// ─── Recomendação ─────────────────────────────────────────────────────────────
// Recebe o objeto completo do kickoff + answers. Para cada funil, soma os
// pontos quando uma condição é satisfeita. Retorna lista ordenada por pontos,
// com as razões textuais que justificaram cada match.
//
// Pontuação:
//   - condição forte (perfect fit):    +3
//   - condição média (faz sentido):    +2
//   - condição leve (pode caber):      +1
//   - anti-match (não combina):        -2
//
// Limite de matches positivos pra ser "recomendado" (vs apenas "também válido"):
//   >= 3 pontos = Top recomendado
//   1-2 pontos  = Vale considerar
//   <= 0 pontos = Esconde
export function recommendFunnels({ answers = {}, ofertaMatadora = null } = {}) {
  const modelo  = answers.modelo_produto || null
  const om      = ofertaMatadora?.answers || {}
  const consciencia = om.om_consciencia
  const autoridade  = om.om_autoridade
  const dorLatente  = om.om_dor_latente

  const baixaConsciencia = consciencia === 'inconsciente' || consciencia === 'problema'
  const altaConsciencia  = consciencia === 'produto' || consciencia === 'pronto'
  const baixaAutoridade  = autoridade === 'desconhecida' || autoridade === 'pouca'
  const altaAutoridade   = autoridade === 'consolidada' || autoridade === 'lider'
  const dorForte         = dorLatente === 'aguda' || dorLatente === 'percebida'

  const investimentoPassado = Number(answers.investimento_passado) || 0
  const jaInvesteEmTrafego  = investimentoPassado > 0

  const matches = {}
  // `reason` é a chave do texto em kickoffRecomendacoes.razoes.<funil>.
  function add(funnelId, points, reason) {
    if (!matches[funnelId]) matches[funnelId] = { score: 0, reasons: [] }
    matches[funnelId].score += points
    if (points > 0) matches[funnelId].reasons.push(razao(funnelId, reason))
  }

  // ── Funil de Webinar ──────────────────────────────────────────────────────
  if (baixaConsciencia) add('webinar', 3, 'baixaConsciencia')
  if (baixaAutoridade)  add('webinar', 3, 'baixaAutoridade')
  if (modelo === 'consultoria') add('webinar', 2, 'consultoria')
  if (modelo === 'whatsapp')    add('webinar', 1, 'whatsapp')
  if (modelo === 'ecommerce') add('webinar', -2)

  // ── Funil de Diagnóstico ──────────────────────────────────────────────────
  if (modelo === 'saas')        add('diagnostico', 3, 'saas')
  if (modelo === 'servicos')    add('diagnostico', 2, 'servicos')
  if (modelo === 'consultoria') add('diagnostico', 3, 'consultoria')
  if (modelo === 'ecommerce') add('diagnostico', -2)

  // ── Funil de Webinar Pago ─────────────────────────────────────────────────
  if (modelo === 'infoproduto') add('webinar_pago', 3, 'infoproduto')
  if (modelo === 'coach')       add('webinar_pago', 3, 'coach')
  if (modelo === 'consultoria') add('webinar_pago', 1, 'consultoria')

  // ── Funil de VSL ──────────────────────────────────────────────────────────
  if (dorForte && consciencia === 'problema') add('vsl', 3, 'dorLatente')
  if (modelo === 'infoproduto' || modelo === 'coach') add('vsl', 1, 'infoCoach')
  if (modelo === 'consultoria') add('vsl', 1, 'consultoria')

  // ── Funil de Lançamento ───────────────────────────────────────────────────
  if (modelo === 'infoproduto') add('lancamento', 3, 'infoproduto')
  if (modelo === 'coach')       add('lancamento', 2, 'coach')

  // ── Funil Win-Your-Money-Back ─────────────────────────────────────────────
  if (modelo === 'servicos')    add('wymb', 3, 'servicos')
  if (modelo === 'consultoria') add('wymb', 2, 'consultoria')

  // ── Funil de Aplicação ────────────────────────────────────────────────────
  if (altaAutoridade) add('aplicacao', 3, 'altaAutoridade')
  if (modelo === 'saas' || modelo === 'servicos') add('aplicacao', 2, 'saasServicos')
  if (modelo === 'consultoria') add('aplicacao', 3, 'consultoria')
  if (modelo === 'ecommerce') add('aplicacao', -2)

  // ── Funil de E-commerce ───────────────────────────────────────────────────
  if (modelo === 'ecommerce') add('ecommerce', 3, 'ecommerce')
  if (modelo === 'whatsapp')  add('ecommerce', 2, 'whatsapp')

  // ── Funil de Isca Digital ─────────────────────────────────────────────────
  if (jaInvesteEmTrafego) add('isca_digital', 3, 'jaInveste')
  if (modelo === 'saas' || modelo === 'servicos') add('isca_digital', 1, 'saasServicos')
  if (modelo === 'consultoria') add('isca_digital', 2, 'consultoria')
  if (modelo === 'whatsapp')    add('isca_digital', 3, 'whatsapp')

  // ── Funil de Quiz ─────────────────────────────────────────────────────────
  // Quiz é mais B2B — checamos se o businessType passou via answers
  // ou via flag explícita. (O businessType vem do orquestrador.)
  // Como recommendFunnels não recebe businessType direto, vamos confiar no modelo.
  if (modelo === 'saas' || modelo === 'servicos') add('quiz', 2, 'saasServicos')
  if (modelo === 'consultoria') add('quiz', 2, 'consultoria')
  if (modelo === 'whatsapp')    add('quiz', 2, 'whatsapp')
  if (altaConsciencia) add('quiz', 1, 'altaConsciencia')

  // ── Funil de Mensagem no WhatsApp ─────────────────────────────────────────
  if (modelo === 'whatsapp')    add('whatsapp', 3, 'whatsapp')
  if (modelo === 'servicos')    add('whatsapp', 3, 'servicos')
  if (modelo === 'ecommerce')   add('whatsapp', 1, 'ecommerce')
  if (altaConsciencia)          add('whatsapp', 2, 'altaConsciencia')
  if (dorForte)                 add('whatsapp', 1, 'dorForte')
  if (modelo === 'infoproduto' || modelo === 'coach') add('whatsapp', -2)

  // ── Funil de Desafio ──────────────────────────────────────────────────────
  if (modelo === 'servicos')    add('desafio', 2, 'servicos')
  if (modelo === 'coach')       add('desafio', 3, 'coach')
  if (modelo === 'consultoria') add('desafio', 1, 'consultoria')

  // ── Funil de Lançamento ───────────────────────────────────────────────────
  // (Continua principalmente pra infoprodutos/coaches — já mapeado acima,
  //  mas reforçamos pra WhatsApp que aproveita lista de transmissão.)
  if (modelo === 'whatsapp')    add('lancamento', 2, 'whatsapp')

  // Constrói lista final ordenada
  return FUNNELS
    .map((f) => {
      const m = matches[f.id]
      if (!m || m.score <= 0) return null
      return {
        ...f,
        score: m.score,
        reasons: m.reasons,
        tier: m.score >= 3 ? 'top' : 'consider',
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
}

// Versão alternativa: aceita businessType pra refinar Quiz (B2B/Híbrido boost)
export function recommendFunnelsWithBusiness({ answers, ofertaMatadora, businessType }) {
  const baseList = recommendFunnels({ answers, ofertaMatadora })
  // Quiz ganha +1 quando é B2B/Híbrido
  if (businessType === 'b2b' || businessType === 'hibrido') {
    const quiz = baseList.find((f) => f.id === 'quiz')
    if (quiz) {
      quiz.score += 1
      quiz.reasons.unshift(razao('quiz', 'b2bHibrido'))
      if (quiz.score >= 3) quiz.tier = 'top'
    } else {
      // Insere mesmo se não tinha entrado
      baseList.push({
        ...FUNNELS_BY_ID.quiz,
        score: 2,
        reasons: [razao('quiz', 'b2bHibrido')],
        tier: 'consider',
      })
    }
    baseList.sort((a, b) => b.score - a.score)
  }
  return baseList
}
