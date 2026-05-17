// Engine de cálculo de precificação (serviço + produto).
// Funções puras, sem dependência de React. Testáveis isoladamente.
//
// Premissa fundamental: imposto e margem de lucro são percentuais
// CALCULADOS SOBRE O PREÇO DE VENDA, não sobre o custo. Por isso a fórmula:
//
//     precoVenda = custoTotal / (1 - imposto% - margem%)
//
// Assim, depois de pagar o imposto e cobrir o custo, sobra exatamente
// `margem%` do preço de venda como lucro líquido — que é o que o cliente
// realmente quer dizer com "margem de lucro de X%".

function n(val) {
  const x = Number(val)
  return Number.isFinite(x) ? x : 0
}

function pct(val) {
  const x = Number(val)
  return Number.isFinite(x) ? x / 100 : 0
}

// ─── Modo Serviço ────────────────────────────────────────────────────────────
export function calcularServico(inputs = {}) {
  const salario   = n(inputs.salarioMensal)
  const encargos  = pct(inputs.encargosPct)
  const carga     = n(inputs.cargaHorariaMensal)
  const horas     = n(inputs.horasDedicadas)
  const fixos     = n(inputs.custosFixos)
  const imposto   = pct(inputs.impostoPct)
  const margem    = pct(inputs.margemPct)

  const custoHora      = carga > 0 ? (salario * (1 + encargos)) / carga : 0
  const custoMaoObra   = custoHora * horas
  const custoTotal     = custoMaoObra + fixos
  const fator          = 1 - imposto - margem

  let erro = null
  if (fator <= 0) {
    erro = 'Imposto + margem somam 100% ou mais — reduza algum dos dois pra calcular um preço viável.'
  }

  const precoVenda     = !erro && custoTotal > 0 ? custoTotal / fator : 0
  const impostoReais   = precoVenda * imposto
  const margemReais    = precoVenda * margem
  const markupPct      = custoTotal > 0 && precoVenda > 0 ? (precoVenda / custoTotal - 1) * 100 : 0
  const lucroLiquido   = precoVenda - custoTotal - impostoReais

  return {
    custoHora,
    custoMaoObra,
    custoTotal,
    precoVenda,
    impostoReais,
    margemReais,
    markupPct,
    lucroLiquido,
    erro,
  }
}

// ─── Modo Produto ────────────────────────────────────────────────────────────
export function calcularProduto(inputs = {}) {
  const custoProd  = n(inputs.custoProduto)
  const adicionais = n(inputs.custosAdicionais)
  const imposto    = pct(inputs.impostoPct)
  const margem     = pct(inputs.margemPct)

  const custoTotal = custoProd + adicionais
  const fator      = 1 - imposto - margem

  let erro = null
  if (fator <= 0) {
    erro = 'Imposto + margem somam 100% ou mais — reduza algum dos dois pra calcular um preço viável.'
  }

  const precoVenda     = !erro && custoTotal > 0 ? custoTotal / fator : 0
  const impostoReais   = precoVenda * imposto
  const margemReais    = precoVenda * margem
  const markupPct      = custoTotal > 0 && precoVenda > 0 ? (precoVenda / custoTotal - 1) * 100 : 0
  const lucroLiquido   = precoVenda - custoTotal - impostoReais

  return {
    custoTotal,
    precoVenda,
    impostoReais,
    margemReais,
    markupPct,
    lucroLiquido,
    erro,
  }
}
