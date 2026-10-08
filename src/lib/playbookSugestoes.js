// Sugestões de otimização a partir do playbook de tráfego da Revenue Lab.
//
// Funções puras: recebem as linhas do dash_insights (Meta e Google) do projeto,
// a meta de CPL da conta e devolvem uma lista de sugestões com evidência.
// Cada sugestão tem uma `chave` estável (regra + entidade) pra que o usuário
// possa aceitar (vira tarefa no ClickUp) ou descartar sem ela voltar no dia
// seguinte. As regras seguem o Roadmap Ads (playbook por faixa de verba) e os
// guardrails da operação: desligar só com gasto mínimo e depois de 72h,
// escalar em passos de 20%, 3 criativos novos por semana no fundo, etc.

import { num, googleImpr, classifyFunnel, CFG, addDays, maxDate, fmtDate } from './dashboardData'

const META_STATUS_AD = 'Status do Aúncio'   // o typo é da planilha original
const GASTO_MINIMO_SEM_RESULTADO = 35        // R$, guardrail quando não há meta

export const PRIORIDADE_ORDEM = { urgente: 0, alta: 1, media: 2 }
export const PRIORIDADE_LABEL = { urgente: 'Urgente', alta: 'Alta', media: 'Média' }
export const PRIORIDADE_CLICKUP = { urgente: 'urgent', alta: 'high', media: 'normal' }

const fmtMoney = (n) => 'R$ ' + (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtPct = (n, d = 2) => (n == null ? '—' : n.toFixed(d).replace('.', ',') + '%')
const fmtInt = (n) => Math.round(n ?? 0).toLocaleString('pt-BR')

// Conversão Meta: a coluna `Conversões` do dash (evento de otimização da campanha)
// quando existe; senão a soma legada WhatsApp + leads + vendas (CFG).
function convMeta(r) {
  if (r['Conversões'] != null && r['Conversões'] !== '' && r['Conversões'] !== '-') return num(r['Conversões'])
  return CFG.meta.convKeys.reduce((a, k) => a + num(r[k]), 0)
}

function isPaused(status) { return /paus|inativ|off|disabled|archiv/i.test(status || '') }

// ─── Agregação ───────────────────────────────────────────────────────────────
function aggMeta(rows) {
  let spend = 0, imps = 0, clicks = 0, conv = 0, fSum = 0, fImps = 0
  let v3s = 0, vPlays = 0, v25 = 0, v95 = 0, tSum = 0, tN = 0
  for (const r of rows) {
    const i = num(r['Impressões'])
    spend += num(r['Valor investido'])
    imps += i
    clicks += num(r['Número de cliques no link'])
    conv += convMeta(r)
    const f = num(r['Frequência'])
    if (f > 0 && i > 0) { fSum += f * i; fImps += i }
    // Vídeo (topo de funil). "Exibido" conta autoplay e fica ~ igual às
    // impressões; a taxa de gancho é 3 s / impressões, como no Gerenciador.
    v3s += num(r['Número de vezes que assistiram os 3 primeiros segundos'])
    vPlays += num(r['Número de vezes que o vídeo foi exibido'])
    v25 += num(r['Número de vezes que assistiram 25% do vídeo'])
    v95 += num(r['Número de vezes que assistiram 95% do vídeo'])
    const t = num(r['Tempo médio do vídeo em segundos'])
    if (t > 0 && i > 0) { tSum += t * i; tN += i }
  }
  return {
    spend, imps, clicks, conv,
    ctr: imps > 0 ? clicks / imps * 100 : null,
    cpl: conv > 0 ? spend / conv : null,
    freq: fImps > 0 ? fSum / fImps : null,
    dias: new Set(rows.map((r) => r._d)).size,
    temVideo: vPlays > 0 || v3s > 0,
    gancho: imps > 0 && (vPlays > 0 || v3s > 0) ? v3s / imps * 100 : null,
    ret25: v3s > 0 ? v25 / v3s * 100 : null,
    thruplay: v3s > 0 ? v95 / v3s * 100 : null,
    tempoMedio: tN > 0 ? tSum / tN : null,
  }
}

function aggGoogle(rows) {
  let spend = 0, imps = 0, clicks = 0, conv = 0, perdaSum = 0, perdaN = 0
  for (const r of rows) {
    spend += num(r['Gasto'])
    imps += googleImpr(r)
    clicks += num(r['CLiques']) || num(r['Cliques'])
    conv += num(r['Conversões'])
    const perda = r['% de perda por orçamento']
    if (perda != null && perda !== '' && perda !== '-') { perdaSum += num(perda); perdaN++ }
  }
  return {
    spend, imps, clicks, conv,
    ctr: imps > 0 ? clicks / imps * 100 : null,
    cpl: conv > 0 ? spend / conv : null,
    convRate: clicks > 0 ? conv / clicks * 100 : null,
    perdaOrcamento: perdaN > 0 ? perdaSum / perdaN : null,
    dias: new Set(rows.map((r) => r._d)).size,
  }
}

function groupRows(rows, keyFn) {
  const m = new Map()
  for (const r of rows) {
    const k = keyFn(r)
    if (!k) continue
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(r)
  }
  return m
}

// Status mais recente de um anúncio (linha do último dia)
function ultimoStatus(rows, dateKey, statusKey) {
  let best = null
  for (const r of rows) if (!best || (r[dateKey] || '') > (best[dateKey] || '')) best = r
  return best?.[statusKey] || ''
}

// Normaliza a data da linha pra ISO (a planilha pode vir dd/mm/aaaa) e
// devolve as janelas: últimos `dias` dias e os `dias` anteriores.
function janelas(rows, dateKey, dias = 7) {
  const norm = rows.map((r) => (r._d ? r : { ...r, _d: fmtDate(r[dateKey]) })).filter((r) => r._d)
  const fim = maxDate(norm, '_d')
  if (!fim) return { atual: [], anterior: [], inicio: null, fim: null }
  const inicio = addDays(fim, -(dias - 1))
  const inicioAnt = addDays(inicio, -dias)
  const fimAnt = addDays(inicio, -1)
  return {
    fim, inicio,
    atual: norm.filter((r) => r._d >= inicio && r._d <= fim),
    anterior: norm.filter((r) => r._d >= inicioAnt && r._d <= fimAnt),
  }
}

// Monta a descrição em markdown que vai para o ClickUp
// Caminho até a entidade no gerenciador (Campanha → Conjunto → Anúncio).
// Só entram os níveis que a regra conhece; o card e o ClickUp mostram iguais.
function caminhoLinhas(caminho) {
  if (!caminho) return []
  const out = []
  if (caminho.campanha) out.push(`- Campanha: ${caminho.campanha}`)
  if (caminho.conjunto) out.push(`- Conjunto: ${caminho.conjunto}`)
  if (caminho.anuncio) out.push(`- Anúncio: ${caminho.anuncio}${caminho.adId ? ` (ID ${caminho.adId})` : ''}`)
  if (caminho.url) out.push(`- Abrir no gerenciador: ${caminho.url}`)
  if (caminho.link) out.push(`- Link do anúncio: ${caminho.link}`)
  return out
}

// Link direto pro Gerenciador de Anúncios (Meta) ou pro Google Ads, no nível
// mais específico que a regra conhece. Os IDs vêm das linhas do dash
// (account_id / campaign_id / adset_id / ad_id no Meta; customer_id /
// campaign_id no Google). Sem o ID da conta não há link.
export function linkGerenciador(canal, c = {}) {
  if (canal === 'meta') {
    if (!c.accountId) return null
    const base = 'https://adsmanager.facebook.com/adsmanager/manage'
    if (c.adId) return `${base}/ads?act=${c.accountId}&selected_ad_ids=${c.adId}`
    if (c.adsetId) return `${base}/ads?act=${c.accountId}&selected_adset_ids=${c.adsetId}`
    if (c.campaignId) return `${base}/adsets?act=${c.accountId}&selected_campaign_ids=${c.campaignId}`
    return `${base}/campaigns?act=${c.accountId}`
  }
  if (canal === 'google') {
    if (!c.customerId) return null
    const e = `__e=${c.customerId}`
    if (c.campaignId) return `https://ads.google.com/aw/adgroups?campaignId=${c.campaignId}&${e}`
    return `https://ads.google.com/aw/campaigns?${e}`
  }
  return null
}

// Monta o `caminho` de uma sugestão já com o link do gerenciador.
function caminhoDe(canal, c) {
  return { ...c, url: linkGerenciador(canal, c) }
}

// Valor mais recente de uma coluna de ID nas linhas (a conta é igual em todas;
// conjunto/campanha de um anúncio também, mas pega a linha mais nova por segurança)
function idDe(rows, key) {
  let best = null
  for (const r of rows) if (r[key] && (!best || (r._d || '') > (best._d || ''))) best = r
  return best ? String(best[key]) : null
}

// Valores distintos de uma coluna nas linhas (ex.: conjuntos em que um anúncio rodou)
function distintos(rows, key) {
  return [...new Set(rows.map((r) => (r[key] || '').trim()).filter(Boolean))]
}

function descricao({ acao, regra, contexto, caminho, evidencias, passos }) {
  const linhas = []
  if (acao) linhas.push(`**Otimização:** ${acao}`, '')
  if (contexto) linhas.push(contexto, '')
  const cam = caminhoLinhas(caminho)
  if (cam.length) {
    linhas.push('**Onde está (Gerenciador de Anúncios):**', ...cam, '')
  }
  if (evidencias?.length) {
    linhas.push('**Evidência (últimos 7 dias):**')
    for (const e of evidencias) linhas.push(`- ${e.label}: ${e.valor}`)
    linhas.push('')
  }
  if (passos?.length) {
    linhas.push('**O que fazer:**')
    passos.forEach((p, i) => linhas.push(`${i + 1}. ${p}`))
    linhas.push('')
  }
  if (regra) linhas.push(`_Regra do playbook: ${regra}_`)
  return linhas.join('\n')
}

function sugestao(base) {
  return { horas: 1, tipo: 'Otimização', ...base, descricao: descricao(base) }
}

// ─── Meta Ads ────────────────────────────────────────────────────────────────
function regrasMeta(rowsMeta, metaCpl, conta) {
  const out = []
  if (!rowsMeta.length) return out
  const w = janelas(rowsMeta, 'Dia', 7)
  const atual = w.atual
  const canal = 'meta'
  const pref = conta ? `[${conta}] ` : ''

  // Topo de funil NÃO se avalia por CPL/conversão: lá a régua é visita ao perfil,
  // seguidores e vídeo (gancho, retenção). Toda regra de CPL, conversão e escala
  // olha só campanhas de fundo e meio; a conta como um todo também.
  const accountId = idDe(atual, 'account_id')
  const contaCam = (extra = {}) => caminhoDe(canal, { accountId, ...extra })
  const funilDe = (r) => classifyFunnel(r['Nome da campanha'])
  const ehConversao = (r) => { const f = funilDe(r); return f === 'fundo' || f === 'meio' }
  const atualConv = atual.filter(ehConversao)
  const tot = aggMeta(atual)
  const totConv = aggMeta(atualConv)
  const totConvAnt = aggMeta(w.anterior.filter(ehConversao))

  // Sem entrega: gastou na semana anterior e zerou nos últimos 2 dias
  const ultimos2 = atual.filter((r) => r._d >= addDays(w.fim, -1))
  const gasto2 = ultimos2.reduce((a, r) => a + num(r['Valor investido']), 0)
  const totAnt = aggMeta(w.anterior)
  if (totAnt.spend > 50 && tot.spend > 0 && gasto2 === 0) {
    out.push(sugestao({
      chave: `meta:sem_entrega:${conta || 'conta'}`, canal, prioridade: 'urgente',
      titulo: `${pref}Verificar entrega da conta Meta (sem gasto há 2 dias)`,
      acao: 'Conferir saldo, limite de gasto e anúncios rejeitados da conta.',
      caminho: contaCam(),
      regra: 'conta ativa não pode ficar sem entrega; checar saldo, limite de gasto e rejeições',
      contexto: `A conta gastou ${fmtMoney(totAnt.spend)} na semana anterior e não registra gasto nos últimos 2 dias.`,
      evidencias: [
        { label: 'Gasto semana anterior', valor: fmtMoney(totAnt.spend) },
        { label: 'Gasto últimos 2 dias', valor: fmtMoney(gasto2) },
      ],
      passos: ['Conferir saldo / limite de gasto da conta e forma de pagamento', 'Checar anúncios rejeitados ou em análise', 'Confirmar que campanhas e conjuntos estão ativos'],
      horas: 0.5,
    }))
  }

  if (metaCpl == null && totConv.spend > 0) {
    out.push(sugestao({
      chave: `meta:cpl_indefinido:${conta || 'conta'}`, canal, prioridade: 'media',
      titulo: `${pref}Definir a meta de CPL da conta no dashboard`,
      acao: 'Cadastrar a meta de CPL da conta no dashboard de tráfego.',
      regra: 'toda decisão de desligar/escalar depende do CPL ideal (2× a meta desliga, 0,8× escala)',
      contexto: 'A conta não tem meta de CPL cadastrada. Sem ela, as regras de desligar e escalar do playbook ficam desativadas.',
      evidencias: [{ label: 'CPL atual (fundo + meio)', valor: totConv.cpl != null ? fmtMoney(totConv.cpl) : 'sem conversão' }],
      passos: ['Calcular o CPL ideal a partir da Calculadora de ROI do projeto', 'Cadastrar a meta na coluna de metas do dashboard de tráfego'],
      tipo: 'Estratégia', horas: 0.5,
    }))
  }

  // Por anúncio pelo `ad_id` (identificador único no Meta). O nome NÃO identifica
  // o anúncio: "01" pode existir em vários conjuntos e campanhas, e mesmo dentro
  // do mesmo conjunto dois anúncios podem ter o mesmo nome. Nunca somar métricas
  // de anúncios diferentes só porque o nome coincide. Linhas antigas sem ad_id
  // caem no fallback campanha + conjunto + nome.
  const SEP = '\u0001'
  const porAd = groupRows(atualConv, (r) => {
    if (!r['Nome do Anúncio']) return null
    const id = (r.ad_id || '').toString().trim()
    return id ? `id${SEP}${id}` : ['nm', r['Nome da campanha'] || '', r['Conjunto de Anúncio'] || '', r['Nome do Anúncio']].join(SEP)
  })
  const gastoMin = metaCpl ? Math.max(GASTO_MINIMO_SEM_RESULTADO, metaCpl * 2) : GASTO_MINIMO_SEM_RESULTADO
  const semConv = [], cplAlto = []
  for (const [k, rs] of porAd) {
    if (isPaused(ultimoStatus(rs, '_d', META_STATUS_AD))) continue
    const a = aggMeta(rs)
    if (a.dias < 3) continue // nunca antes de 72h
    const ultimo = rs.reduce((b, r) => (!b || r._d > b._d ? r : b), null)
    const nome = ultimo['Nome do Anúncio']
    const camp = ultimo['Nome da campanha'] || ''
    const conj = ultimo['Conjunto de Anúncio'] || ''
    const adId = k.startsWith('id' + SEP) ? k.slice(3) : null
    const link = distintos(rs, 'Link do anúncio')[0] || null
    const ids = { adsetId: idDe(rs, 'adset_id'), campaignId: idDe(rs, 'campaign_id') }
    if (a.conv === 0 && a.spend >= gastoMin) semConv.push({ nome, camp, conj, adId, link, ids, a })
    else if (metaCpl && a.conv > 0 && a.cpl >= metaCpl * 2 && a.spend >= metaCpl * 2) cplAlto.push({ nome, camp, conj, adId, link, ids, a })
  }
  for (const { nome, camp, conj, adId, link, ids, a } of semConv.sort((x, y) => y.a.spend - x.a.spend).slice(0, 5)) {
    out.push(sugestao({
      chave: `meta:ad_sem_conv:${adId || `${camp}::${conj}::${nome}`}`, canal, prioridade: 'urgente', entidade: nome,
      titulo: `${pref}Desligar o anúncio "${nome}" (${fmtMoney(a.spend)} sem conversão)`,
      acao: `Pausar este anúncio e renomear com o sufixo _TESTADO.`,
      caminho: contaCam({ campanha: camp, conjunto: conj, anuncio: nome, adId, link, ...ids }),
      regra: 'desligar anúncio com gasto ≥ 2× o CPL ideal e zero conversão, depois de 72h; marcar _TESTADO',
      contexto: `No conjunto "${conj}" da campanha "${camp}", este anúncio gastou ${fmtMoney(a.spend)} em ${a.dias} dias sem nenhuma conversão.`,
      evidencias: [
        { label: 'Gasto', valor: fmtMoney(a.spend) },
        { label: 'Conversões', valor: '0' },
        { label: 'CTR link', valor: fmtPct(a.ctr) },
        { label: 'Dias no ar na janela', valor: String(a.dias) },
      ],
      passos: ['Pausar o anúncio no Gerenciador', 'Renomear com o sufixo _TESTADO', 'Registrar a otimização na Área do Cliente'],
      horas: 0.5,
    }))
  }
  for (const { nome, camp, conj, adId, link, ids, a } of cplAlto.sort((x, y) => y.a.cpl - x.a.cpl).slice(0, 5)) {
    out.push(sugestao({
      chave: `meta:ad_cpl_alto:${adId || `${camp}::${conj}::${nome}`}`, canal, prioridade: 'alta', entidade: nome,
      titulo: `${pref}Desligar o anúncio "${nome}" (CPL ${fmtMoney(a.cpl)}, meta ${fmtMoney(metaCpl)})`,
      acao: `Pausar este anúncio (CPL ${(a.cpl / metaCpl).toFixed(1).replace('.', ',')}× a meta) e marcar _TESTADO.`,
      caminho: contaCam({ campanha: camp, conjunto: conj, anuncio: nome, adId, link, ...ids }),
      regra: 'anúncio priorizado com CPL acima de 2× a meta e gasto ≥ 2× a meta é desligado e marcado _TESTADO',
      contexto: `No conjunto "${conj}" da campanha "${camp}", este anúncio está com CPL ${(a.cpl / metaCpl).toFixed(1).replace('.', ',')}× a meta.`,
      evidencias: [
        { label: 'CPL', valor: fmtMoney(a.cpl) },
        { label: 'Meta de CPL', valor: fmtMoney(metaCpl) },
        { label: 'Gasto', valor: fmtMoney(a.spend) },
        { label: 'Conversões', valor: fmtInt(a.conv) },
      ],
      passos: ['Pausar o anúncio e marcar _TESTADO', 'Se for o único anúncio priorizado do conjunto, subir um substituto antes'],
      horas: 0.5,
    }))
  }

  // Por campanha
  const porCamp = groupRows(atual, (r) => r['Nome da campanha'])
  const porCampAnt = groupRows(w.anterior, (r) => r['Nome da campanha'])
  let temFundo = false, temTopo = false
  for (const [camp, rs] of porCamp) {
    const a = aggMeta(rs)
    if (a.spend <= 0) continue
    const funil = classifyFunnel(camp)
    if (funil === 'fundo') temFundo = true
    if (funil === 'topo') temTopo = true
    const adsAtivos = new Set(rs.filter((r) => !isPaused(r[META_STATUS_AD])).map((r) => r['Nome do Anúncio'])).size
    const ant = porCampAnt.get(camp) ? aggMeta(porCampAnt.get(camp)) : null

    if (funil !== 'topo' && a.spend >= 50 && a.imps >= 2000 && a.ctr != null && a.ctr < 0.5) {
      out.push(sugestao({
        chave: `meta:ctr_baixo:${camp}`, canal, prioridade: 'alta', entidade: camp,
        titulo: `${pref}Trocar criativos da campanha "${camp}" (CTR ${fmtPct(a.ctr)})`,
        acao: 'Subir 3 criativos novos nesta campanha, com gancho diferente dos atuais.',
        caminho: contaCam({ campanha: camp, campaignId: idDe(rs, 'campaign_id') }),
        regra: 'CTR de link abaixo de 0,5% indica criativo/gancho fraco; benchmark Revenue Lab ≥ 1%',
        contexto: `A campanha entregou ${fmtInt(a.imps)} impressões com CTR de link de ${fmtPct(a.ctr)}.`,
        evidencias: [
          { label: 'CTR link', valor: fmtPct(a.ctr) },
          { label: 'Impressões', valor: fmtInt(a.imps) },
          { label: 'Gasto', valor: fmtMoney(a.spend) },
          { label: 'Anúncios ativos', valor: String(adsAtivos) },
        ],
        passos: ['Briefar 3 criativos novos com gancho diferente (1 hipótese, 3 variações)', 'Subir na mesma campanha, sem desligar os atuais até o Meta priorizar'],
        tipo: 'Subir Criativo', horas: 1,
      }))
    }

    if (funil === 'fundo' && a.freq != null && a.freq >= 3.5 && ant?.ctr != null && a.ctr != null && a.ctr < ant.ctr * 0.9) {
      out.push(sugestao({
        chave: `meta:saturacao:${camp}`, canal, prioridade: 'alta', entidade: camp,
        titulo: `${pref}Renovar criativos da campanha "${camp}" (frequência ${a.freq.toFixed(1).replace('.', ',')})`,
        acao: 'Subir 3 criativos novos nesta campanha antes de mexer em orçamento.',
        caminho: contaCam({ campanha: camp, campaignId: idDe(rs, 'campaign_id') }),
        regra: 'frequência ≥ 3,5 com CTR em queda = público saturado; renovar criativos antes de mexer em orçamento',
        contexto: `Frequência média de ${a.freq.toFixed(1).replace('.', ',')} e CTR caiu de ${fmtPct(ant.ctr)} para ${fmtPct(a.ctr)} vs. a semana anterior.`,
        evidencias: [
          { label: 'Frequência', valor: a.freq.toFixed(2).replace('.', ',') },
          { label: 'CTR atual vs anterior', valor: `${fmtPct(a.ctr)} vs ${fmtPct(ant.ctr)}` },
          { label: 'Gasto', valor: fmtMoney(a.spend) },
        ],
        passos: ['Subir 3 criativos novos no fundo', 'Avaliar ampliar o público do conjunto frio'],
        tipo: 'Subir Criativo', horas: 1,
      }))
    }

    if (funil === 'fundo' && adsAtivos > 0 && adsAtivos < 3 && a.spend >= 30) {
      out.push(sugestao({
        chave: `meta:poucos_criativos:${camp}`, canal, prioridade: 'media', entidade: camp,
        titulo: `${pref}Subir criativos novos no fundo "${camp}" (só ${adsAtivos} ativo${adsAtivos > 1 ? 's' : ''})`,
        acao: `Subir 3 criativos novos nesta campanha, mantendo o${adsAtivos > 1 ? 's' : ''} ${adsAtivos} ativo${adsAtivos > 1 ? 's' : ''}.`,
        caminho: contaCam({ campanha: camp, campaignId: idDe(rs, 'campaign_id') }),
        regra: 'fundo em CBO roda com todos os criativos ativos: 3 novos por semana, até 12 por mês, 6 de gaveta',
        contexto: `A campanha de fundo tem apenas ${adsAtivos} anúncio${adsAtivos > 1 ? 's' : ''} ativo${adsAtivos > 1 ? 's' : ''} na última semana. O Meta precisa de opções pra priorizar.`,
        evidencias: [
          { label: 'Anúncios ativos', valor: String(adsAtivos) },
          { label: 'Gasto da campanha', valor: fmtMoney(a.spend) },
          { label: 'CPL', valor: a.cpl != null ? fmtMoney(a.cpl) : 'sem conversão' },
        ],
        passos: ['Puxar 3 criativos da gaveta ou briefar 3 novos', 'Subir na campanha de fundo mantendo os atuais'],
        tipo: 'Subir Criativo', horas: 1,
      }))
    }

    // Escalar: conjunto com CPL ≤ 0,8× a meta, volume e estabilidade (3 dias). Só fundo/meio.
    if (metaCpl && (funil === 'fundo' || funil === 'meio')) {
      const porConj = groupRows(rs, (r) => r['Conjunto de Anúncio'])
      for (const [conj, crs] of porConj) {
        const c = aggMeta(crs)
        if (c.conv < 3 || c.cpl == null || c.cpl > metaCpl * 0.8 || c.dias < 3) continue
        const ult3 = aggMeta(crs.filter((r) => r._d >= addDays(w.fim, -2)))
        if (ult3.cpl == null || ult3.cpl > metaCpl) continue
        out.push(sugestao({
          chave: `meta:escalar:${camp}::${conj}`, canal, prioridade: 'media', entidade: conj,
          titulo: `${pref}Escalar +20% o conjunto "${conj}" (CPL ${fmtMoney(c.cpl)}, meta ${fmtMoney(metaCpl)})`,
          acao: 'Aumentar o orçamento deste conjunto em 20% (se a campanha for CBO, aumentar o orçamento da campanha em 20%).',
          caminho: contaCam({ campanha: camp, conjunto: conj, campaignId: idDe(crs, 'campaign_id'), adsetId: idDe(crs, 'adset_id') }),
          regra: 'escalar vencedor em até +20% por dia quando CPL ≤ meta e estável há 3 dias',
          contexto: `Conjunto da campanha "${camp}" com CPL ${Math.round((1 - c.cpl / metaCpl) * 100)}% abaixo da meta e ${fmtInt(c.conv)} conversões na semana.`,
          evidencias: [
            { label: 'CPL 7 dias', valor: fmtMoney(c.cpl) },
            { label: 'CPL últimos 3 dias', valor: fmtMoney(ult3.cpl) },
            { label: 'Conversões', valor: fmtInt(c.conv) },
            { label: 'Gasto', valor: fmtMoney(c.spend) },
          ],
          passos: ['Aumentar o orçamento em 20% (não mais, pra não resetar o aprendizado)', 'Reavaliar em 3 dias antes do próximo passo'],
          horas: 0.5,
        }))
      }
    }
  }

  // CPL das campanhas de conversão (fundo + meio) piorou vs semana anterior
  if (totConv.cpl != null && totConvAnt.cpl != null && totConvAnt.conv >= 3 && totConv.cpl > totConvAnt.cpl * 1.3) {
    out.push(sugestao({
      chave: `meta:cpl_piorou:${conta || 'conta'}`, canal, prioridade: 'alta',
      titulo: `${pref}Investigar alta de CPL no fundo/meio (${fmtMoney(totConvAnt.cpl)} → ${fmtMoney(totConv.cpl)})`,
      acao: 'Comparar as campanhas de fundo e meio entre as duas semanas e achar o que puxou o CPL pra cima.',
      caminho: contaCam(),
      regra: 'variação de CPL acima de 30% entre semanas pede diagnóstico antes de qualquer ajuste de verba (topo fica de fora da conta)',
      contexto: `O CPL das campanhas de fundo e meio subiu ${Math.round((totConv.cpl / totConvAnt.cpl - 1) * 100)}% em relação à semana anterior.`,
      evidencias: [
        { label: 'CPL atual', valor: fmtMoney(totConv.cpl) },
        { label: 'CPL semana anterior', valor: fmtMoney(totConvAnt.cpl) },
        { label: 'Conversões atual / anterior', valor: `${fmtInt(totConv.conv)} / ${fmtInt(totConvAnt.conv)}` },
        { label: 'Gasto atual / anterior', valor: `${fmtMoney(totConv.spend)} / ${fmtMoney(totConvAnt.spend)}` },
      ],
      passos: ['Comparar CTR, CPM e taxa de conversão por campanha entre as duas semanas', 'Checar se algum anúncio novo puxou o CPL pra cima', 'Confirmar rastreamento (pixel/CAPI) e destino do WhatsApp/LP'],
      tipo: 'Relatório', horas: 1,
    }))
  }

  // ─── Topo de funil: avaliado por vídeo (gancho, retenção, tempo médio) ──────
  // Protocolo: taxa de gancho acima de 30%, tempo médio bom acima de 10 s,
  // renovar criativos a cada 7 dias mantendo os melhores. Visitas ao perfil e
  // seguidores não chegam ao dash, então ficam de fora aqui.
  const porAdTopo = groupRows(atual.filter((r) => funilDe(r) === 'topo'), (r) => {
    if (!r['Nome do Anúncio']) return null
    const id = (r.ad_id || '').toString().trim()
    return id ? `id${SEP}${id}` : ['nm', r['Nome da campanha'] || '', r['Conjunto de Anúncio'] || '', r['Nome do Anúncio']].join(SEP)
  })
  const ganchoBaixo = []
  for (const [k, rs] of porAdTopo) {
    if (isPaused(ultimoStatus(rs, '_d', META_STATUS_AD))) continue
    const a = aggMeta(rs)
    if (a.dias < 3 || a.spend < GASTO_MINIMO_SEM_RESULTADO || a.imps < 2000 || !a.temVideo || a.gancho == null) continue
    if (a.gancho < 30) {
      const ultimo = rs.reduce((b, r) => (!b || r._d > b._d ? r : b), null)
      ganchoBaixo.push({
        nome: ultimo['Nome do Anúncio'], camp: ultimo['Nome da campanha'] || '', conj: ultimo['Conjunto de Anúncio'] || '',
        adId: k.startsWith('id' + SEP) ? k.slice(3) : null, link: distintos(rs, 'Link do anúncio')[0] || null, a,
        adsetId: idDe(rs, 'adset_id'), campaignId: idDe(rs, 'campaign_id'),
      })
    }
  }
  for (const { nome, camp, conj, adId, link, adsetId, campaignId, a } of ganchoBaixo.sort((x, y) => x.a.gancho - y.a.gancho).slice(0, 5)) {
    out.push(sugestao({
      chave: `meta:topo_gancho:${adId || `${camp}::${conj}::${nome}`}`, canal, prioridade: 'media', entidade: nome,
      titulo: `${pref}Trocar o vídeo de topo "${nome}" (gancho ${fmtPct(a.gancho, 0)}, mínimo 30%)`,
      acao: `Pausar este vídeo de topo e subir um substituto com os 3 primeiros segundos mais fortes.`,
      caminho: contaCam({ campanha: camp, conjunto: conj, anuncio: nome, adId, link, adsetId, campaignId }),
      regra: 'topo de funil não se julga por CPL: vídeo com taxa de gancho abaixo de 30% (3 s / impressões) é trocado na renovação semanal',
      contexto: `Anúncio de topo com ${fmtInt(a.imps)} impressões em ${a.dias} dias: só ${fmtPct(a.gancho, 0)} das pessoas passaram dos 3 primeiros segundos.`,
      evidencias: [
        { label: 'Taxa de gancho', valor: fmtPct(a.gancho, 1) },
        { label: 'Retenção até 25%', valor: a.ret25 != null ? fmtPct(a.ret25, 1) : '—' },
        { label: 'ThruPlay (95%)', valor: a.thruplay != null ? fmtPct(a.thruplay, 1) : '—' },
        { label: 'Tempo médio', valor: a.tempoMedio != null ? a.tempoMedio.toFixed(1).replace('.', ',') + ' s' : '—' },
        { label: 'Gasto', valor: fmtMoney(a.spend) },
      ],
      passos: ['Pausar o vídeo e marcar _TESTADO', 'Subir um criativo novo no mesmo conjunto (gancho diferente nos 3 primeiros segundos)', 'Conferir no Gerenciador custo por visita ao perfil e seguidores, que o dash não traz'],
      tipo: 'Subir Criativo', horas: 1,
    }))
  }

  // Estrutura do playbook por faixa de verba
  if (tot.spend > 0) {
    const verbaMensal = tot.spend / Math.max(1, tot.dias) * 30
    if (!temFundo) {
      out.push(sugestao({
        chave: `meta:sem_fundo:${conta || 'conta'}`, canal, prioridade: 'alta',
        titulo: `${pref}Criar a campanha de fundo de funil (não há campanha "FUNDO" ativa)`,
      acao: 'Criar uma campanha de fundo em CBO com 3 criativos de oferta direta.',
      caminho: contaCam(),
        regra: 'toda faixa de verba começa com 1 campanha de fundo em CBO (WhatsApp ou lead); topo é opcional a partir de R$ 2k',
        contexto: `Nenhuma campanha com "fundo" no nome gastou na última semana. Verba mensal estimada: ${fmtMoney(verbaMensal)}.`,
        evidencias: [
          { label: 'Campanhas com gasto', valor: [...porCamp.keys()].slice(0, 4).join(', ') || '—' },
          { label: 'Verba mensal estimada', valor: fmtMoney(verbaMensal) },
        ],
        passos: ['Criar campanha AF_FUNDO em CBO seguindo a nomenclatura do protocolo', 'Subir 3 criativos de oferta direta', 'Conferir se a nomenclatura das campanhas atuais segue o padrão (TOPO/MEIO/FUNDO)'],
        tipo: 'Criar Campanha', horas: 2,
      }))
    }
    if (temFundo && !temTopo && verbaMensal >= 2000) {
      out.push(sugestao({
        chave: `meta:sem_topo:${conta || 'conta'}`, canal, prioridade: 'media',
        titulo: `${pref}Criar campanha de topo de funil (verba ≈ ${fmtMoney(verbaMensal)}/mês)`,
      acao: 'Criar uma campanha de topo com 10 a 20% da verba.',
      caminho: contaCam(),
        regra: 'a partir de R$ 2k/mês o playbook prevê fundo + topo; a partir de R$ 3k o fundo separa conjunto quente e frio',
        contexto: `Só há campanha de fundo rodando. Com ${fmtMoney(verbaMensal)}/mês a conta está na faixa que prevê topo pra alimentar o remarketing.`,
        evidencias: [
          { label: 'Verba mensal estimada', valor: fmtMoney(verbaMensal) },
          { label: 'Campanhas ativas', valor: [...porCamp.keys()].slice(0, 4).join(', ') },
        ],
        passos: ['Definir 10 a 20% da verba pro topo (vídeo/ThruPlay ou engajamento)', 'Criar a campanha e o conjunto de remarketing no fundo'],
        tipo: 'Criar Campanha', horas: 2,
      }))
    }
  }

  return out
}

// ─── Google Ads ──────────────────────────────────────────────────────────────
function regrasGoogle(rowsGoogle, metaCpl, conta) {
  const out = []
  if (!rowsGoogle.length) return out
  const w = janelas(rowsGoogle, 'Data', 7)
  const atual = w.atual
  const tot = aggGoogle(atual)
  const canal = 'google'
  const pref = conta ? `[${conta}] ` : ''
  const gastoMin = metaCpl ? Math.max(GASTO_MINIMO_SEM_RESULTADO, metaCpl * 2) : GASTO_MINIMO_SEM_RESULTADO

  const customerId = idDe(atual, 'customer_id')
  const contaCam = (extra = {}) => caminhoDe(canal, { customerId, ...extra })
  const porCamp = groupRows(atual, (r) => r['Campanha'])
  for (const [camp, rs] of porCamp) {
    const a = aggGoogle(rs)
    if (a.spend <= 0) continue
    if (a.conv === 0 && a.spend >= gastoMin && a.dias >= 3) {
      out.push(sugestao({
        chave: `google:camp_sem_conv:${camp}`, canal, prioridade: 'alta', entidade: camp,
        titulo: `${pref}Revisar a campanha "${camp}" no Google (${fmtMoney(a.spend)} sem conversão)`,
        acao: 'Negativar em exata os termos de pesquisa que não são cliente e revisar a conversão desta campanha.',
        caminho: contaCam({ campanha: camp, campaignId: idDe(rs, 'campaign_id') }),
        regra: 'campanha com gasto ≥ 2× o CPL ideal e zero conversão: negativar termos e revisar antes de cortar',
        contexto: `Gastou ${fmtMoney(a.spend)} em ${a.dias} dias sem conversão.`,
        evidencias: [
          { label: 'Gasto', valor: fmtMoney(a.spend) },
          { label: 'Cliques', valor: fmtInt(a.clicks) },
          { label: 'CTR', valor: fmtPct(a.ctr) },
        ],
        passos: ['Abrir o relatório de termos de pesquisa e negativar em correspondência exata o que não é cliente', 'Conferir se a conversão está disparando na LP', 'Se não houver termo bom, reduzir o orçamento em 20%'],
        horas: 1,
      }))
    } else if (metaCpl && a.conv > 0 && a.cpl >= metaCpl * 2 && a.spend >= metaCpl * 2) {
      out.push(sugestao({
        chave: `google:camp_cpl_alto:${camp}`, canal, prioridade: 'alta', entidade: camp,
        titulo: `${pref}Reduzir orçamento -20% da campanha "${camp}" (CPL ${fmtMoney(a.cpl)}, meta ${fmtMoney(metaCpl)})`,
        acao: 'Reduzir o orçamento diário desta campanha em 20%.',
        caminho: contaCam({ campanha: camp, campaignId: idDe(rs, 'campaign_id') }),
        regra: 'reduzir perdedor em até -20% por dia quando CPL está acima da meta',
        contexto: `CPL ${(a.cpl / metaCpl).toFixed(1).replace('.', ',')}× a meta com ${fmtInt(a.conv)} conversões.`,
        evidencias: [
          { label: 'CPL', valor: fmtMoney(a.cpl) },
          { label: 'Meta de CPL', valor: fmtMoney(metaCpl) },
          { label: 'Gasto', valor: fmtMoney(a.spend) },
          { label: 'Taxa de conversão', valor: fmtPct(a.convRate, 1) },
        ],
        passos: ['Reduzir o orçamento diário em 20%', 'Negativar termos ruins em exata', 'Revisar grupos com CPL acima da média'],
        horas: 1,
      }))
    }
    if (a.conv > 0 && a.perdaOrcamento != null && a.perdaOrcamento >= 30 && (!metaCpl || a.cpl <= metaCpl)) {
      out.push(sugestao({
        chave: `google:perda_orcamento:${camp}`, canal, prioridade: 'media', entidade: camp,
        titulo: `${pref}Aumentar +20% o orçamento da campanha "${camp}" (perde ${fmtPct(a.perdaOrcamento, 0)} por orçamento)`,
        acao: 'Aumentar o orçamento diário desta campanha em 20%.',
        caminho: contaCam({ campanha: camp, campaignId: idDe(rs, 'campaign_id') }),
        regra: 'campanha dentro da meta perdendo parcela de impressão por orçamento é candidata a escalar em +20%',
        contexto: `A campanha deixa de aparecer em ${fmtPct(a.perdaOrcamento, 0)} das buscas por falta de orçamento, com CPL ${fmtMoney(a.cpl)}.`,
        evidencias: [
          { label: 'Perda por orçamento', valor: fmtPct(a.perdaOrcamento, 0) },
          { label: 'CPL', valor: fmtMoney(a.cpl) },
          { label: 'Conversões', valor: fmtInt(a.conv) },
        ],
        passos: ['Subir o orçamento diário em 20%', 'Acompanhar CPL por 3 dias antes de novo aumento'],
        horas: 0.5,
      }))
    }
    if (a.imps >= 500 && a.ctr != null && a.ctr < 2) {
      out.push(sugestao({
        chave: `google:ctr_baixo:${camp}`, canal, prioridade: 'media', entidade: camp,
        titulo: `${pref}Revisar anúncios e termos da campanha "${camp}" (CTR ${fmtPct(a.ctr)})`,
        acao: 'Revisar títulos/descrições dos anúncios responsivos e apertar as palavras amplas desta campanha.',
        caminho: contaCam({ campanha: camp, campaignId: idDe(rs, 'campaign_id') }),
        regra: 'CTR de pesquisa abaixo de 2% indica anúncio pouco relevante ou termos amplos demais; benchmark ≥ 5%',
        contexto: `${fmtInt(a.imps)} impressões com CTR ${fmtPct(a.ctr)}.`,
        evidencias: [
          { label: 'CTR', valor: fmtPct(a.ctr) },
          { label: 'Impressões', valor: fmtInt(a.imps) },
          { label: 'Cliques', valor: fmtInt(a.clicks) },
        ],
        passos: ['Revisar títulos e descrições dos anúncios responsivos (força do anúncio)', 'Apertar correspondência das palavras amplas', 'Negativar termos irrelevantes em exata'],
        horas: 1,
      }))
    }
  }

  if (tot.clicks >= 100 && tot.convRate != null && tot.convRate < 5) {
    out.push(sugestao({
      chave: `google:conv_rate:${conta || 'conta'}`, canal, prioridade: 'media',
      titulo: `${pref}Revisar a landing page do Google (taxa de conversão ${fmtPct(tot.convRate, 1)})`,
      acao: 'Rodar o ciclo de CRO da landing page que recebe o tráfego do Google.',
      caminho: contaCam(),
      regra: 'taxa de conversão de pesquisa abaixo de 5% aponta pra LP ou oferta, não pra mídia',
      contexto: `${fmtInt(tot.clicks)} cliques viraram ${fmtInt(tot.conv)} conversões na última semana.`,
      evidencias: [
        { label: 'Taxa de conversão', valor: fmtPct(tot.convRate, 1) },
        { label: 'Cliques', valor: fmtInt(tot.clicks) },
        { label: 'Conversões', valor: fmtInt(tot.conv) },
      ],
      passos: ['Rodar o ciclo de CRO da LP (promessa, prova, formulário)', 'Conferir velocidade e versão mobile da página'],
      tipo: 'Copy de Landing Page', horas: 2,
    }))
  }

  return out
}

/**
 * Gera as sugestões de otimização do projeto.
 * @param {object} p
 * @param {Array}  p.meta        linhas do canal Meta (já filtradas pras contas do projeto)
 * @param {Array}  p.google      linhas do canal Google
 * @param {number|null} p.metaCpl  meta de CPL da conta (R$)
 * @param {string} [p.conta]     nome da conta (prefixo do título quando há várias)
 */
export function gerarSugestoes({ meta = [], google = [], metaCpl = null, conta = null }) {
  const todas = [...regrasMeta(meta, metaCpl, conta), ...regrasGoogle(google, metaCpl, conta)]
  return todas.sort((a, b) => PRIORIDADE_ORDEM[a.prioridade] - PRIORIDADE_ORDEM[b.prioridade])
}

/**
 * Gera por conta vinculada (quando o projeto tem mais de uma conta) e junta.
 * @param {object} p
 * @param {Array} p.meta
 * @param {Array} p.google
 * @param {object} p.accounts   mapa nome da conta → { cplTarget: {value} }
 */
export function gerarSugestoesProjeto({ meta = [], google = [], accounts = {} }) {
  const contas = new Set([...meta.map((r) => r['Nome da conta']), ...google.map((r) => r['Nome da conta'])].filter(Boolean))
  const varias = contas.size > 1
  const out = []
  for (const conta of contas) {
    const metaCpl = accounts[conta]?.cplTarget?.value ?? null
    out.push(...gerarSugestoes({
      meta: meta.filter((r) => r['Nome da conta'] === conta),
      google: google.filter((r) => r['Nome da conta'] === conta),
      metaCpl: metaCpl > 0 ? Number(metaCpl) : null,
      conta: varias ? conta : null,
    }).map((s) => ({ ...s, conta, chave: varias ? `${conta}|${s.chave}` : s.chave })))
  }
  return out.sort((a, b) => PRIORIDADE_ORDEM[a.prioridade] - PRIORIDADE_ORDEM[b.prioridade])
}
