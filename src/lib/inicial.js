// Inicial (página de entrada): regras puras dos quadrantes.
//
// Tudo sai do rollup `dash_daily` (uma linha por canal, conta, dia e campanha, com
// gasto e conversões; conversão Meta = WhatsApp + leads + vendas, a mesma do
// Dashboard de Tráfego) mais os cadastros do projeto. Nenhuma função aqui lê o
// banco: o hook `useInicial` carrega e passa os dados, o que deixa as contas
// testáveis no Node (`scripts/testar_inicial.mjs`).
//
// Dias: todas as janelas terminam ONTEM (dia fechado). O coletor regrava os
// últimos dias de hora em hora, então o "hoje" é parcial e faria quase toda conta
// parecer sem conversão de manhã.

import { classifyFunnel } from './dashboardData.js'

const COMBINING = /[̀-ͯ]/g
const norm = (s) => String(s || '').toUpperCase().normalize('NFD').replace(COMBINING, '')
const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0 }

// ─── Datas (yyyy-mm-dd, fuso de São Paulo) ───────────────────────────────────
export function hojeSP(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora)
}
export function somaDias(iso, dias) {
  const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10)
}
export function diasEntre(a, b) { // b - a, em dias
  return Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5)
}
export const inicioDoMes = (iso) => iso.slice(0, 8) + '01'
export function fimDoMes(iso) {
  const d = new Date(iso.slice(0, 8) + '01T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return d.toISOString().slice(0, 10)
}
const dataValida = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.slice(0, 10))

// Campanha de fundo pelo nome ("FUNDO", "BOFU"), como pediu o Matheus: só elas
// contam para o alerta de conta sem conversão.
export const ehFundo = (campanha) => /(^|[^A-Z])(FUNDO|BOFU|BOF)([^A-Z]|$)/.test(norm(campanha))

// ─── Contas e projetos ──────────────────────────────────────────────────────
// contas: linhas de dashboard_accounts_public. Devolve o mapa nome da conta → vínculo.
export function mapaDeContas(contas = []) {
  const m = new Map()
  for (const c of contas) {
    const nome = c.account_name?.trim(); if (!nome) continue
    m.set(nome, { projectId: c.project_id || null, oculta: !!c.hidden })
  }
  return m
}

// Linhas do dash_daily que entram: conta não oculta (oculta = churn ou conta que
// não operamos) e, quando vinculada, de projeto que não está em churn.
export function linhasValidas(linhas, contas, projetos) {
  return linhas.filter((r) => {
    const c = contas.get(r.account?.trim())
    if (c?.oculta) return false
    if (c?.projectId && projetos.get(c.projectId)?.churn) return false
    return true
  })
}

// ─── 1. Contas com fundo no ar e sem conversão ──────────────────────────────
// Por canal + conta: campanhas de FUNDO que gastaram nos últimos `dias` dias (até
// ontem) e não tiveram nenhuma conversão. Conta cujo fundo não gastou na janela
// (pausado, sem saldo) não entra: o alerta é para dinheiro indo sem retorno.
export function fundoSemConversao(linhas, { dias, hoje, contas }) {
  const ate = somaDias(hoje, -1)
  const de = somaDias(hoje, -dias)
  const porConta = new Map()
  const ultimaConv = new Map()
  for (const r of linhas) {
    if (!ehFundo(r.campaign)) continue
    const chave = r.channel + '|' + r.account
    const conv = n(r.conv)
    if (conv > 0 && r.day <= ate) {
      const ult = ultimaConv.get(chave)
      if (!ult || r.day > ult) ultimaConv.set(chave, r.day)
    }
    if (r.day < de || r.day > ate) continue
    const a = porConta.get(chave) || { canal: r.channel, conta: r.account, gasto: 0, conv: 0, campanhas: new Map() }
    a.gasto += n(r.spend); a.conv += conv
    const camp = a.campanhas.get(r.campaign) || { nome: r.campaign, gasto: 0 }
    camp.gasto += n(r.spend); a.campanhas.set(r.campaign, camp)
    porConta.set(chave, a)
  }
  const out = []
  for (const [chave, a] of porConta) {
    if (a.gasto <= 0 || a.conv > 0) continue
    out.push({
      chave,
      canal: a.canal,
      conta: a.conta,
      projectId: contas.get(a.conta?.trim())?.projectId || null,
      gasto: a.gasto,
      campanhas: [...a.campanhas.values()].filter((c) => c.gasto > 0).sort((x, y) => y.gasto - x.gasto),
      ultimaConversao: ultimaConv.get(chave) || null,
    })
  }
  return out.sort((x, y) => y.gasto - x.gasto)
}

// ─── 2 e 3. CPL do cliente contra o alvo ────────────────────────────────────
// Por projeto, somando as contas vinculadas: gasto e conversões das campanhas que
// não são de topo (topo não se julga por CPL), na janela que termina ontem.
// `janela`: '7d' | '14d' | 'mes'.
export function janelaCpl(janela, hoje) {
  const ate = somaDias(hoje, -1)
  if (janela === 'mes') {
    const de = inicioDoMes(ate) // dia 1: o mês que fechou ontem
    return { de, ate }
  }
  return { de: somaDias(hoje, janela === '14d' ? -14 : -7), ate }
}

export function cplPorProjeto(linhas, { de, ate, contas, metas }) {
  const acc = new Map()
  for (const r of linhas) {
    if (r.day < de || r.day > ate) continue
    if (classifyFunnel(r.campaign) === 'topo') continue
    const pid = contas.get(r.account?.trim())?.projectId
    if (!pid) continue
    const a = acc.get(pid) || { projectId: pid, gasto: 0, conv: 0, canais: new Set() }
    a.gasto += n(r.spend); a.conv += n(r.conv)
    if (n(r.spend) > 0) a.canais.add(r.channel)
    acc.set(pid, a)
  }
  const out = []
  for (const a of acc.values()) {
    const alvo = metas.get(a.projectId)
    if (!alvo || alvo <= 0 || a.gasto <= 0) continue
    const cpl = a.conv > 0 ? a.gasto / a.conv : null
    out.push({ ...a, canais: [...a.canais].sort(), alvo, cpl, razao: cpl != null ? cpl / alvo : null })
  }
  return out
}

// Acima do alvo: CPL > alvo, ou nenhuma conversão com gasto que já passou do alvo
// (um lead teria custado mais que a meta).
export function acimaDoCpl(lista) {
  return lista
    .filter((p) => (p.cpl != null ? p.cpl > p.alvo : p.gasto > p.alvo))
    .sort((a, b) => (b.razao ?? Infinity) - (a.razao ?? Infinity) || b.gasto - a.gasto)
}

// Escaláveis: CPL abaixo do alvo com pelo menos MIN_CONV_ESCALA conversões na
// janela (com 1 ou 2 leads o CPL baixo ainda pode ser sorte).
export const MIN_CONV_ESCALA = 3
export function escalaveis(lista) {
  return lista
    .filter((p) => p.cpl != null && p.cpl < p.alvo && p.conv >= MIN_CONV_ESCALA)
    .sort((a, b) => a.razao - b.razao)
}

// ─── 5 e 6. Pace do orçamento ───────────────────────────────────────────────
// Orçamento do projeto: o Planejamento de Campanhas (1ª conta) quando o período
// dele está valendo hoje; senão a Calculadora de ROI, como orçamento do mês. É a
// mesma ordem da rotina de Checagem de orçamento.
export function orcamentoVigente({ plano, roi, hoje }) {
  const ontem = somaDias(hoje, -1)
  if (plano) {
    const a = plano.answers || {}
    const valor = Array.isArray(a.accounts) && a.accounts.length ? n(a.accounts[0]?.orcamentoTotal) : n(a.orcamentoTotal ?? a.totalBudget)
    const ini = dataValida(a.startDate) ? a.startDate.slice(0, 10) : null
    const fim = dataValida(a.endDate) ? a.endDate.slice(0, 10) : null
    if (valor > 0 && ini && fim && ini <= ontem && fim >= hoje && fim >= ini) {
      return { valor, de: ini, ate: fim, fonte: 'plano' }
    }
  }
  const valorRoi = n(roi?.media_orcamento)
  if (valorRoi > 0) return { valor: valorRoi, de: inicioDoMes(ontem), ate: fimDoMes(ontem), fonte: 'roi' }
  return null
}

// Faixa do pace: previsto de fechamento entre 90% e 110% do orçamento está no ritmo.
export const PACE_MIN = 0.9
export const PACE_MAX = 1.1

export function paceDosProjetos(linhas, { hoje, contas, orcamentos }) {
  const ontem = somaDias(hoje, -1)
  const gastoDia = new Map() // projectId → Map(dia → gasto)
  for (const r of linhas) {
    if (r.day > ontem) continue
    const pid = contas.get(r.account?.trim())?.projectId
    if (!pid || !orcamentos.has(pid)) continue
    const m = gastoDia.get(pid) || new Map()
    m.set(r.day, (m.get(r.day) || 0) + n(r.spend))
    gastoDia.set(pid, m)
  }
  // Só projeto com conta vinculada e visível: sem conta, o gasto 0 não é pace
  // baixo, é projeto que não tem anúncio no dashboard.
  const comConta = new Set()
  for (const c of contas.values()) if (c.projectId && !c.oculta) comConta.add(c.projectId)
  const out = []
  for (const [pid, orc] of orcamentos) {
    if (!comConta.has(pid)) continue
    const totalDias = diasEntre(orc.de, orc.ate) + 1
    const decorridos = Math.min(totalDias, diasEntre(orc.de, ontem) + 1)
    if (decorridos <= 0) continue
    const restantes = totalDias - decorridos
    const dias = gastoDia.get(pid) || new Map()
    let gasto = 0
    for (const [d, v] of dias) if (d >= orc.de && d <= orc.ate) gasto += v
    let ult3 = 0
    for (let i = 1; i <= 3; i++) ult3 += dias.get(somaDias(hoje, -i)) || 0
    const ritmo = ult3 / 3
    const previsto = gasto + ritmo * restantes
    const esperado = orc.valor * decorridos / totalDias
    const razao = previsto / orc.valor
    const necessario = restantes > 0 ? Math.max(0, orc.valor - gasto) / restantes : 0
    out.push({
      projectId: pid, orcamento: orc.valor, fonte: orc.fonte, de: orc.de, ate: orc.ate,
      gasto, esperado, previsto, razao, ritmo, necessario, restantes, decorridos, totalDias,
    })
  }
  return out
}

export const abaixoDoPace = (lista) => lista.filter((p) => p.razao < PACE_MIN).sort((a, b) => a.razao - b.razao)
export const acimaDoPace = (lista) => lista.filter((p) => p.razao > PACE_MAX).sort((a, b) => b.razao - a.razao)

// ─── 4. Alterações feitas nas contas ────────────────────────────────────────
// Sugestões executadas da Central de Otimizações (projeto_sugestoes). O log do
// agente diz o que foi feito de fato ("Pausou o anúncio X", "Verba diária: R$ 35
// → R$ 28"); sem log, vale o título da sugestão.
export const ehAgente = (quem) => /\(agente\)|agente/i.test(String(quem || ''))

export function alteracoes(rows = []) {
  return rows.map((r) => {
    const log = r.execucao_log?.agente || r.execucao_log || {}
    const acoes = Array.isArray(log.acoes) && log.acoes.length ? log.acoes : null
    return {
      id: r.id,
      projectId: r.project_id,
      quando: r.executada_em || r.decidida_em,
      quem: r.decidida_por || '',
      agente: ehAgente(r.decidida_por),
      canal: r.canal || null,
      conta: r.conta || null,
      campanha: r.campanha || null,
      alvo: r.anuncio || r.conjunto || r.campanha || null,
      acoes: acoes || [r.titulo].filter(Boolean),
      titulo: r.titulo,
    }
  })
}

// ─── Precisam de criativos ──────────────────────────────────────────────────
// Sugestões pendentes do playbook (as mesmas da Central de Otimizações, geradas por
// gerarSugestoesProjeto) do tipo "Subir Criativo": CTR baixo, saturação, poucos
// criativos no fundo, gancho fraco no topo e troca do último anúncio do conjunto.
// A chave é "regra:entidade", com o prefixo "conta|" quando o projeto tem várias contas.
export const MOTIVOS_CRIATIVO = ['ctr_baixo', 'saturacao', 'poucos_criativos', 'topo_gancho', 'ad_trocar']
export function motivoDaChave(chave) {
  const semConta = String(chave || '').split('|').pop()
  return semConta.split(':')[1] || null
}

export function precisamDeCriativo(sugestoes = [], { churn = new Set() } = {}) {
  const porProjeto = new Map()
  for (const s of sugestoes) {
    if (s.tipo !== 'Subir Criativo' || !s.projectId || churn.has(s.projectId)) continue
    const g = porProjeto.get(s.projectId) || { projectId: s.projectId, total: 0, motivos: new Map(), contas: new Set(), canais: new Set(), campanhas: [], urgente: false }
    g.total += 1
    const m = motivoDaChave(s.chave) || 'outro'
    g.motivos.set(m, (g.motivos.get(m) || 0) + 1)
    if (s.conta) g.contas.add(s.conta)
    if (s.canal) g.canais.add(s.canal)
    const camp = s.caminho?.campanha
    if (camp && !g.campanhas.includes(camp)) g.campanhas.push(camp)
    if (s.prioridade === 'urgente' || s.prioridade === 'alta') g.urgente = true
    porProjeto.set(s.projectId, g)
  }
  return [...porProjeto.values()]
    .map((g) => ({ ...g, motivos: [...g.motivos.entries()].sort((a, b) => b[1] - a[1]), contas: [...g.contas], canais: [...g.canais].sort() }))
    .sort((a, b) => Number(b.urgente) - Number(a.urgente) || b.total - a.total)
}

// ─── Precisam de teste de landing page ──────────────────────────────────────
// Taxa de conversão da página abaixo de TAXA_LP_MIN, por canal + conta, sem as
// campanhas de topo. Meta: conversões da campanha ÷ visualizações da página de
// destino, só nas campanhas que levam para site (com visualização de página);
// WhatsApp, formulário instantâneo e perfil ficam de fora sozinhos. Google:
// conversões ÷ cliques, a mesma taxa da regra de landing page do playbook. Precisa
// de volume mínimo (MIN_VISITAS_LP visitas ou cliques) para a taxa valer.
export const TAXA_LP_MIN = 5
export const MIN_VISITAS_LP = 100

export function landingPagesAbaixo(linhas, { de, ate, contas }) {
  const acc = new Map()
  for (const r of linhas) {
    if (r.day < de || r.day > ate) continue
    if (classifyFunnel(r.campaign) === 'topo') continue
    const visitas = r.channel === 'meta' ? n(r.lpv) : n(r.clicks)
    if (visitas <= 0) continue
    const chave = r.channel + '|' + r.account
    const a = acc.get(chave) || { chave, canal: r.channel, conta: r.account, visitas: 0, conv: 0, gasto: 0, campanhas: new Map() }
    a.visitas += visitas; a.conv += n(r.conv); a.gasto += n(r.spend)
    const c = a.campanhas.get(r.campaign) || { nome: r.campaign, visitas: 0, conv: 0 }
    c.visitas += visitas; c.conv += n(r.conv)
    a.campanhas.set(r.campaign, c)
    acc.set(chave, a)
  }
  const out = []
  for (const a of acc.values()) {
    if (a.visitas < MIN_VISITAS_LP) continue
    const taxa = (a.conv / a.visitas) * 100
    if (taxa >= TAXA_LP_MIN) continue
    // Campanha que mais puxa a taxa para baixo: a de mais visitas abaixo do mínimo.
    const piores = [...a.campanhas.values()]
      .map((c) => ({ ...c, taxa: c.visitas > 0 ? (c.conv / c.visitas) * 100 : null }))
      .filter((c) => c.taxa != null && c.taxa < TAXA_LP_MIN)
      .sort((x, y) => y.visitas - x.visitas)
    out.push({
      chave: a.chave, canal: a.canal, conta: a.conta,
      projectId: contas.get(a.conta?.trim())?.projectId || null,
      visitas: a.visitas, conv: a.conv, gasto: a.gasto, taxa, piores,
    })
  }
  return out.sort((x, y) => x.taxa - y.taxa || y.visitas - x.visitas)
}

// ─── Tendência dos últimos 3 dias ───────────────────────────────────────────
// A mesma "Tend. 3d" do Dashboard de Tráfego (buildStats em dashboardData.js), por
// canal + conta e com todas as campanhas: conversões dos 3 últimos dias fechados
// (t1) contra os 3 anteriores (t0). Queda = caindo dia após dia ou -25% ou mais;
// Alta = mais de +20%. Mudou lá, mude aqui.
// Previsão do mês = conversões do mês até ontem + média diária dos 3 dias × dias que faltam.
export function tendencia3d(linhas, { hoje, contas, metas }) {
  const ontem = somaDias(hoje, -1)
  const t1 = [somaDias(ontem, -2), somaDias(ontem, -1), ontem]
  const t0 = [somaDias(ontem, -5), somaDias(ontem, -4), somaDias(ontem, -3)]
  const iniMes = inicioDoMes(hoje)
  const restantes = diasEntre(hoje, fimDoMes(hoje)) + 1 // hoje incluído
  const acc = new Map()
  for (const r of linhas) {
    if (r.day < t0[0] || r.day > ontem) {
      if (!(r.day >= iniMes && r.day <= ontem)) continue
    }
    const chave = r.channel + '|' + r.account
    const a = acc.get(chave) || { chave, canal: r.channel, conta: r.account, dias: new Map(), mesConv: 0 }
    if (r.day >= iniMes && r.day <= ontem) a.mesConv += n(r.conv)
    if (r.day >= t0[0] && r.day <= ontem) {
      const d = a.dias.get(r.day) || { conv: 0, gasto: 0 }
      d.conv += n(r.conv); d.gasto += n(r.spend)
      a.dias.set(r.day, d)
    }
    acc.set(chave, a)
  }
  const ORDEM = { queda: 0, estavel: 1, alta: 2 }
  const out = []
  for (const a of acc.values()) {
    const dia = (d) => a.dias.get(d) || { conv: 0, gasto: 0 }
    const t1vals = t1.map((d) => dia(d).conv)
    const conv3 = t1vals.reduce((s, v) => s + v, 0)
    const gasto3 = t1.reduce((s, d) => s + dia(d).gasto, 0)
    const conv0 = t0.reduce((s, d) => s + dia(d).conv, 0)
    const gasto0 = t0.reduce((s, d) => s + dia(d).gasto, 0)
    if (gasto3 + gasto0 <= 0) continue // conta parada nos 6 dias
    const pct = conv0 > 0 ? ((conv3 - conv0) / conv0) * 100 : (conv3 > 0 ? 100 : 0)
    const caindo = (t1vals[2] < t1vals[1] && t1vals[1] < t1vals[0]) || pct <= -25
    const tendencia = caindo ? 'queda' : pct > 20 ? 'alta' : 'estavel'
    const projectId = contas.get(a.conta?.trim())?.projectId || null
    out.push({
      chave: a.chave, canal: a.canal, conta: a.conta, projectId,
      conv3, gasto3, conv0, pct, t1vals, tendencia,
      cpl3: conv3 > 0 ? gasto3 / conv3 : null,
      alvo: projectId ? metas.get(projectId) ?? null : null,
      previsaoMes: a.mesConv + (conv3 / 3) * restantes,
    })
  }
  return out.sort((x, y) => ORDEM[x.tendencia] - ORDEM[y.tendencia] || y.gasto3 - x.gasto3)
}
