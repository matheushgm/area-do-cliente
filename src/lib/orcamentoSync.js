// Orçamento do mês: um número só para o Planejamento de Campanhas e a Calculadora de ROI.
//
// "Orçamento Total do Mês" da 1ª conta (aba) do Planejamento de Campanhas
// (`campaign_plans.answers.accounts[0].orcamentoTotal`, repetido na raiz do plano)
// e "Orçamento em Mídia" do 1º cenário da Calculadora de ROI
// (`roi_calculators.media_orcamento`, espelhado em `roi_cenarios[0]`) são o mesmo
// campo. Mudou um, `sincronizarOrcamento` leva para o outro no mesmo patch do
// `updateProject`.
//
// Só a 1ª conta sincroniza porque é ela que o app inteiro já trata como o orçamento
// do plano (raiz do plano, dashboard, Checagem de orçamento), e as outras abas
// muitas vezes são meses antigos ("Julho.2026", "08/2026").
//
// A sincronização só age quando o valor MUDA no patch: editar outro campo de um
// módulo não reescreve o outro, então projetos que já estavam diferentes ficam
// como estão até alguém mexer no orçamento. Valor zero ou vazio não é levado
// (apagar o campo para digitar de novo não zera o outro módulo).

const num = (v) => {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

/** Orçamento do mês do plano: 1ª conta; plano legado (sem contas) usa a raiz. */
export function orcamentoDoPlano(plan) {
  if (!plan || typeof plan !== 'object') return 0
  if (Array.isArray(plan.accounts) && plan.accounts.length) return num(plan.accounts[0]?.orcamentoTotal)
  return num(plan.orcamentoTotal ?? plan.totalBudget)
}

/** Orçamento em Mídia da calculadora (aceita camelCase e snake_case). */
export function orcamentoDoRoi(calc) {
  if (!calc || typeof calc !== 'object') return 0
  return num(calc.mediaOrcamento ?? calc.media_orcamento)
}

/** Plano com o orçamento da 1ª conta trocado (e a raiz, que repete a 1ª conta). */
export function planoComOrcamento(plan, valor) {
  const base = plan || {}
  if (Array.isArray(base.accounts) && base.accounts.length) {
    const [primeira, ...resto] = base.accounts
    const usado = num(primeira?.valorJaUsado)
    return {
      ...base,
      accounts: [{ ...primeira, orcamentoTotal: valor }, ...resto],
      orcamentoTotal: valor,
      valorJaUsado: usado,
      totalBudget: Math.max(0, valor - usado),
    }
  }
  const usado = num(base.valorJaUsado)
  return { ...base, orcamentoTotal: valor, totalBudget: Math.max(0, valor - usado) }
}

/**
 * Resultado da calculadora de ROI para um `calc` (mesma conta do ROICalculator).
 * Devolve null quando não há lucro por venda (ticket, compras ou margem zerados).
 */
export function calcularResultadoRoi(calc) {
  const mo = num(calc?.mediaOrcamento)
  const cm = num(calc?.custoMarketing)
  const tm = num(calc?.ticketMedio)
  const qc = num(calc?.qtdCompras)
  const mb = num(calc?.margemBruta)
  const rd = num(calc?.roiDesejado)
  const tl = num(calc?.taxaLead2MQL)
  const ts = num(calc?.taxaMQL2SQL)
  const tv = num(calc?.taxaSQL2Venda)

  const totalInv   = mo + cm
  const lucroVenda = tm * qc * (mb / 100)
  if (!lucroVenda) return null

  const retAlvo = totalInv * (1 + rd / 100)
  const vendas  = Math.ceil(retAlvo / lucroVenda)
  const sqls    = tv ? Math.ceil(vendas / (tv / 100)) : Infinity
  const mqls    = ts ? Math.ceil(sqls   / (ts / 100)) : Infinity
  const leads   = tl ? Math.ceil(mqls   / (tl / 100)) : Infinity
  const fat     = vendas * tm * qc
  const lBruto  = fat * (mb / 100)
  return {
    totalInvestimento: totalInv, lucroPorVenda: lucroVenda,
    vendasNecessarias: vendas, sqlsNecessarios: sqls, mqlsNecessarios: mqls, leadsNecessarios: leads,
    faturamento: fat, lucroBruto: lBruto, lucroLiquido: lBruto - totalInv,
    // CAC = (mídia + marketing) / vendas: custo total de aquisição por cliente
    cac:             vendas ? totalInv / vendas : Infinity,
    vendasBreakeven: Math.ceil(totalInv / lucroVenda),
    // CPL/CPMQL/CPSQL usam APENAS o orçamento de mídia (não inclui marketing)
    // porque são métricas de performance dos canais pagos.
    custoPorLead:    leads ? mo / leads : Infinity,
    custoPorMQL:     mqls  ? mo / mqls  : Infinity,
    custoPorSQL:     sqls  ? mo / sqls  : Infinity,
  }
}

/** Calculadora (roiCalc + roiResult + 1º cenário) com o Orçamento em Mídia trocado. */
function roiComOrcamento(projeto, valor) {
  const calc = { ...projeto.roiCalc, mediaOrcamento: valor, media_orcamento: valor }
  const result = calcularResultadoRoi(calc)
  const out = { roiCalc: calc, roiResult: result ?? projeto.roiResult ?? null }

  const cenarios = Array.isArray(projeto.roiCenarios) ? projeto.roiCenarios : null
  if (cenarios && cenarios.length) {
    const [primeiro, ...resto] = cenarios
    const calcCenario = { ...(primeiro.calc || projeto.roiCalc), mediaOrcamento: valor }
    out.roiCenarios = [{
      ...primeiro,
      calc: calcCenario,
      result: calcularResultadoRoi(calcCenario) ?? primeiro.result ?? null,
      updatedAt: new Date().toISOString(),
    }, ...resto]
  }
  return out
}

/**
 * Recebe o projeto como está (antes do patch) e o patch do `updateProject`;
 * devolve o patch com o outro módulo acompanhando a mudança de orçamento.
 */
export function sincronizarOrcamento(projeto, patch) {
  if (!projeto || !patch) return patch
  const mexeuPlano = patch.campaignPlan !== undefined
  const mexeuRoi   = patch.roiCalc !== undefined || patch.roiCenarios !== undefined

  // Planejamento → Calculadora. Só se a calculadora já existe: criar uma linha só
  // com o orçamento deixaria ticket, margem e taxas vazios.
  if (mexeuPlano && !mexeuRoi && projeto.roiCalc) {
    const novo  = orcamentoDoPlano(patch.campaignPlan)
    const antes = orcamentoDoPlano(projeto.campaignPlan)
    if (novo > 0 && novo !== antes && novo !== orcamentoDoRoi(projeto.roiCalc)) {
      return { ...patch, ...roiComOrcamento(projeto, novo) }
    }
  }

  // Calculadora → Planejamento. Só se o plano já existe (plano novo nasce com o
  // orçamento da calculadora, ver CampaignPlanner).
  if (patch.roiCalc !== undefined && !mexeuPlano && projeto.campaignPlan) {
    const novo  = orcamentoDoRoi(patch.roiCalc)
    const antes = orcamentoDoRoi(projeto.roiCalc)
    if (novo > 0 && novo !== antes && novo !== orcamentoDoPlano(projeto.campaignPlan)) {
      return { ...patch, campaignPlan: planoComOrcamento(projeto.campaignPlan, novo) }
    }
  }

  return patch
}
