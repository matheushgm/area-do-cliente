// Engine de cálculo de precificação (serviço + produto + SaaS).
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

// Custo mensal de um colaborador convertido em custo por hora e multiplicado
// pelas horas que ele dedica ao serviço. Puro — usado no cálculo por linha.
function calcularColaborador(c = {}) {
  const salario  = n(c.salarioMensal)
  const encargos = pct(c.encargosPct)
  const carga    = n(c.cargaHorariaMensal)
  const horas    = n(c.horasDedicadas)

  const custoHora    = carga > 0 ? (salario * (1 + encargos)) / carga : 0
  const custoMaoObra = custoHora * horas

  return { id: c.id, nome: c.nome || '', custoHora, horasDedicadas: horas, custoMaoObra }
}

// ─── Modo Serviço ────────────────────────────────────────────────────────────
// Aceita N colaboradores (`inputs.colaboradores`), cada um custeado
// separadamente e somado. Compatível com o formato antigo (campos flat de um
// único colaborador direto no item) — tratado como uma lista de 1.
export function calcularServico(inputs = {}) {
  const fixos   = n(inputs.custosFixos)
  const imposto = pct(inputs.impostoPct)
  const margem  = pct(inputs.margemPct)

  const lista = Array.isArray(inputs.colaboradores) && inputs.colaboradores.length
    ? inputs.colaboradores
    : [{
        nome:               inputs.colaboradorNome,
        salarioMensal:      inputs.salarioMensal,
        encargosPct:        inputs.encargosPct,
        cargaHorariaMensal: inputs.cargaHorariaMensal,
        horasDedicadas:     inputs.horasDedicadas,
      }]

  const colaboradores  = lista.map(calcularColaborador)
  const custoMaoObra   = colaboradores.reduce((s, c) => s + c.custoMaoObra, 0)
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
    colaboradores,   // breakdown de custo por colaborador
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

// ─── Modo SaaS ───────────────────────────────────────────────────────────────
// Precifica um PLANO de SaaS a partir de três decisões:
//   1. Tem implantação/onboarding? Se sim, custo hora-homem × horas de
//      implantação vira o custo do onboarding, com margem própria → preço de
//      setup cobrado UMA vez.
//   2. Cobrança por usuário (seats) ou ilimitado (flat por conta)?
//   3. Tempo médio que o cliente fica ativo (meses) → projeta o LTV.
//
// Preço = custo / (1 - imposto% - margem%) — a mesma lógica de margem-sobre-
// preço usada em serviço/produto, aplicada tanto na mensalidade quanto no setup.
export function calcularSaas(inputs = {}) {
  const imposto = pct(inputs.impostoPct)
  const margem  = pct(inputs.margemPct)
  const fator   = 1 - imposto - margem

  // ── 1. Implantação (cobrança única) ──────────────────────────────────────
  const temImplantacao = !!inputs.temImplantacao
  const custoHoraHomem = n(inputs.custoHoraHomem)
  const horasImplant   = n(inputs.horasImplantacao)
  const margemImplant  = pct(inputs.margemImplantacaoPct)
  const fatorImplant   = 1 - imposto - margemImplant

  const custoImplantacao = temImplantacao ? custoHoraHomem * horasImplant : 0

  // ── 2. Recorrência mensal ────────────────────────────────────────────────
  const porUsuario = inputs.modeloCobranca === 'por_usuario'
  const numUsuarios = porUsuario ? Math.max(1, n(inputs.numUsuarios) || 1) : 1
  const custoMensalConta   = n(inputs.custoMensalConta)                       // infra/suporte fixo por conta
  const custoMensalUsuario = porUsuario ? n(inputs.custoMensalUsuario) : 0    // custo marginal por seat

  const custoRecorrente = custoMensalConta + custoMensalUsuario * numUsuarios

  // ── 3. Ciclo de vida ─────────────────────────────────────────────────────
  const mesesAtivo = Math.max(0, n(inputs.tempoMedioAtivoMeses))

  // ── Erros de viabilidade ─────────────────────────────────────────────────
  let erro = null
  if (fator <= 0) {
    erro = 'Imposto + margem da mensalidade somam 100% ou mais — reduza algum dos dois pra calcular um preço viável.'
  } else if (temImplantacao && custoImplantacao > 0 && fatorImplant <= 0) {
    erro = 'Imposto + margem da implantação somam 100% ou mais — reduza algum dos dois.'
  }

  // ── Preços derivados ─────────────────────────────────────────────────────
  const precoImplantacao = !erro && temImplantacao && custoImplantacao > 0
    ? custoImplantacao / fatorImplant
    : 0
  const margemImplantReais = precoImplantacao - custoImplantacao - precoImplantacao * imposto

  const mensalidade   = !erro && custoRecorrente > 0 ? custoRecorrente / fator : 0
  const precoPorUsuario = porUsuario && numUsuarios > 0 ? mensalidade / numUsuarios : 0
  const impostoReais  = mensalidade * imposto
  const margemReais   = mensalidade * margem
  const markupPct     = custoRecorrente > 0 && mensalidade > 0 ? (mensalidade / custoRecorrente - 1) * 100 : 0
  const lucroLiquido  = mensalidade - custoRecorrente - impostoReais   // lucro líquido mensal

  // ── Projeção no tempo de vida do cliente ─────────────────────────────────
  const mrr = mensalidade
  const arr = mensalidade * 12
  const receitaCiclo = precoImplantacao + mensalidade * mesesAtivo   // LTV (receita)
  const custoCiclo   = custoImplantacao + custoRecorrente * mesesAtivo
  const impostoCiclo = receitaCiclo * imposto
  const lucroCiclo   = receitaCiclo - custoCiclo - impostoCiclo      // LTV (lucro líquido)

  return {
    // config resolvida
    temImplantacao,
    porUsuario,
    numUsuarios,
    mesesAtivo,
    // implantação
    custoImplantacao,
    precoImplantacao,
    margemImplantReais,
    // recorrência (mensal)
    custoRecorrente,
    mensalidade,
    precoPorUsuario,
    impostoReais,
    margemReais,
    markupPct,
    lucroLiquido,
    // ciclo de vida
    mrr,
    arr,
    receitaCiclo,
    custoCiclo,
    lucroCiclo,
    // aliases p/ o card genérico (precoVenda / custoTotal)
    precoVenda: mensalidade,
    custoTotal: custoRecorrente,
    erro,
  }
}
