// Quem executa cada otimização da Central (/otimizacoes) desde 24/11/2026, quando o
// gestor de tráfego do Escritório dos Agentes passou a rodar a fila todo dia:
//
//   auto     o agente executa sozinho na rodada diária (pausar anúncio identificado
//            pelo ad_id, remanejar 20% entre conjuntos ABO, reduzir 20% da verba de
//            campanha do Google). Dentro dos guardrails (✅ PODE SOZINHO).
//   critica  o agente não executa sem aprovação: vai para a aba Crítico. Desligar
//            conjunto/campanha e AUMENTAR verba (o maior risco, pedido de 23/10/2026).
//   manual   precisa de uma pessoa (subir criativo, investigar, criar campanha). Fica
//            em Pendentes e o agente comenta o que falta.
//
// Arquivo puro, sem imports: o Escritório (Node) importa este mesmo arquivo do
// checkout da main, então a regra é uma só para a tela e para o agente.

export const MODO_POR_REGRA = {
  'meta:ad_sem_conv': 'auto',
  'meta:ad_cpl_alto': 'auto',
  'meta:topo_gancho': 'auto',
  'meta:conj_remanejar': 'auto',
  'google:camp_cpl_alto': 'auto',
  'meta:conj_desligar': 'critica',
  'meta:escalar': 'critica',
  'google:perda_orcamento': 'critica',
}

// Por que cada regra crítica precisa de aprovação (vai no cartão da aba Crítico).
export const MOTIVO_CRITICA = {
  'meta:conj_desligar': 'Desliga um conjunto inteiro (o anúncio é o último ativo dele).',
  'meta:escalar': 'Aumenta a verba do conjunto em 20%.',
  'google:perda_orcamento': 'Aumenta a verba diária da campanha em 20%.',
}

/** "meta:ad_sem_conv" a partir da chave (com ou sem o prefixo "conta|"). */
export function regraDaChave(chave = '') {
  const m = String(chave).match(/(?:^|\|)((?:meta|google):[a-z_]+):/)
  return m ? m[1] : null
}

/**
 * 'auto' | 'critica' | 'manual' para uma sugestão (o objeto do motor ou o payload
 * gravado). Uma regra 'auto' sem o ID de que o agente precisa vira 'manual'.
 */
export function modoDoAgente(sug) {
  const regra = regraDaChave(sug?.chave)
  const modo = MODO_POR_REGRA[regra] || 'manual'
  const c = sug?.caminho || {}
  if (modo === 'auto') {
    if (/^meta:(ad_|topo_)/.test(regra) && !c.adId) return 'manual'
    if (regra === 'meta:conj_remanejar' && !(sug.remanejar?.de?.adsetId && sug.remanejar?.para?.adsetId)) return 'manual'
    if (regra === 'google:camp_cpl_alto' && !(c.campaignId && c.customerId)) return 'manual'
  }
  if (modo === 'critica') {
    if (regra === 'meta:conj_desligar' && !(c.adId && c.adsetId)) return 'manual'
    if (regra === 'meta:escalar' && !(c.adsetId || c.campaignId)) return 'manual'
    if (regra === 'google:perda_orcamento' && !(c.campaignId && c.customerId)) return 'manual'
  }
  return modo
}

// Nome com que o agente assina decisões e comentários.
export const NOME_AGENTE = 'Gestor de Tráfego (agente)'
