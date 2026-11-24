// Sugestões de otimização a partir do playbook de tráfego da Revenue Lab.
//
// Funções puras: recebem as linhas do dash_insights (Meta e Google) do projeto,
// a meta de CPL da conta e devolvem uma lista de sugestões com evidência.
// Cada sugestão tem uma `chave` estável (regra + entidade) pra que o usuário
// possa aceitar (vira tarefa no ClickUp) ou descartar sem ela voltar no dia
// seguinte. As regras seguem o Roadmap Ads (playbook por faixa de verba) e os
// guardrails da operação: desligar só com gasto mínimo e depois de 72h,
// escalar em passos de 20%, 3 criativos novos por semana no fundo, etc.

import { num, googleImpr, classifyFunnel, CFG, addDays, maxDate, fmtDate, fmtBR } from './dashboardData'
import { TEXTOS, idiomaPlaybook } from './playbookTextos'

const META_STATUS_AD = 'Status do Aúncio'   // o typo é da planilha original
const GASTO_MINIMO_SEM_RESULTADO = 35        // R$, guardrail quando não há meta

export const PRIORIDADE_ORDEM = { urgente: 0, alta: 1, media: 2 }
export const PRIORIDADE_LABEL = { urgente: 'Urgente', alta: 'Alta', media: 'Média' }
export const PRIORIDADE_CLICKUP = { urgente: 'urgent', alta: 'high', media: 'normal' }

// Idioma dos textos (ver playbookTextos.js). `T` e `lang` são trocados no começo de cada
// geração (`usarIdioma`), que roda inteira de forma síncrona; os rótulos soltos abaixo
// (prioridade, tipo, local) leem o idioma na hora da chamada.
let lang = 'pt'
let T = TEXTOS.pt
function usarIdioma() { lang = idiomaPlaybook(); T = TEXTOS[lang] }

export function rotuloPrioridade(p) { return TEXTOS[idiomaPlaybook()].prioridade[p] || p }
// "Tipo de tarefa" do ClickUp: o valor gravado é o nome da opção em português.
export function rotuloTipo(tipo) { return TEXTOS[idiomaPlaybook()].tipo[tipo] || tipo }

const loc = () => (lang === 'en' ? 'en-US' : 'pt-BR')
const fmtDec = (n, d) => (lang === 'en' ? n.toFixed(d) : n.toFixed(d).replace('.', ','))
const fmtMoney = (n) => 'R$ ' + (n ?? 0).toLocaleString(loc(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtPct = (n, d = 2) => (n == null ? '—' : fmtDec(n, d) + '%')
const fmtInt = (n) => Math.round(n ?? 0).toLocaleString(loc())
// dd/mm em português, mm/dd em inglês
const fmtDia = (iso) => { if (!iso || lang !== 'en') return fmtBR(iso); const [, m, d] = iso.split('-'); return `${m}/${d}` }

// Conversão Meta: a coluna `Conversões` do dash (evento de otimização da campanha)
// quando existe; senão a soma legada WhatsApp + leads + vendas (CFG).
function convMeta(r) {
  if (r['Conversões'] != null && r['Conversões'] !== '' && r['Conversões'] !== '-') {
    const c = num(r['Conversões'])
    // Rede de segurança pra campanha de VENDAS: se o coletor não reconheceu o
    // evento de otimização (Conversões 0) mas há compras na linha, a conversão
    // é a compra. Evita sugerir "desligar sem conversão" pra anúncio que vende.
    if (c === 0 && /SALES|CONVERSIONS/i.test(r['Objetivo de Campanha'] || '')) {
      const vendas = num(r['Número de vendas'])
      if (vendas > 0) return vendas
    }
    return c
  }
  return CFG.meta.convKeys.reduce((a, k) => a + num(r[k]), 0)
}

function isPaused(status) { return /paus|inativ|off|disabled|archiv/i.test(status || '') }

// ─── Métrica de julgamento por campanha ──────────────────────────────────────
// O CPL da calculadora só vale pra campanha de lead/conversa. Compra é julgada
// pelo CAC (custo por venda) e MQL pelo custo por MQL, as duas na base de MÍDIA,
// como o CPL (o gasto do dash é só mídia; ver migration 097). Formulário nativo
// conta como MQL quando o projeto marca `metrica_formulario = 'mql'`
// (formulário condicional/qualificado: Nectar FORMS, Multichat360, WJK).
export const METRICA_LABEL = { lead: 'CPL', mql: 'custo por MQL', compra: 'custo por venda' }
// No texto das sugestões os rótulos vêm do idioma (T.metrica / T.metricaMeta).

export function metricaDaLinha(r, metas = {}) {
  const obj = r['Objetivo de Campanha'] || ''
  const tipo = r['Tipo de resultado'] || ''
  if (/SALES|CONVERSIONS/i.test(obj) || /compra/i.test(tipo)) return 'compra'
  if (/mql/i.test(tipo)) return 'mql'
  if (metas.formularioMql && /formul/i.test(tipo)) return 'mql'
  return 'lead'
}

// Métrica de um grupo de linhas (anúncio, conjunto, campanha): a da linha mais nova.
function metricaDe(rows, metas) {
  const ult = rows.reduce((b, r) => (!b || (r._d || '') > (b._d || '') ? r : b), null)
  return ult ? metricaDaLinha(ult, metas) : 'lead'
}

// Meta da métrica. Sem CAC / custo por MQL cadastrado NÃO cai no CPL: julgar
// compra pelo CPL foi a origem das recusas de 13 a 15/10/2026.
function metaDe(metas, metrica) {
  const v = metrica === 'compra' ? metas.cac : metrica === 'mql' ? metas.mql : metas.cpl
  return v > 0 ? Number(v) : null
}

// ─── Régua de custo: meta da calculadora ou média real da conta ──────────────
// Pedido do Matheus em 14/11/2026: a calculadora de ROI nem sempre está preenchida
// e às vezes pede um custo que a conta nunca fez. Quando a meta está vazia ou o custo
// médio real da conta (14 dias, fundo + meio, mesma métrica) passa de 1,5× a meta, a
// régua de "custo alto" passa a ser a média: um anúncio acima da meta mas abaixo da
// média fica no ar, e saem os que custam bem acima da média (≥ 1,5×).
export const DIVERGENCIA_MEDIA = 1.5 // média real / meta a partir da qual a meta não serve de régua
export const FATOR_ACIMA_MEDIA = 1.5 // com a média como régua, custo alto = ≥ 1,5× a média
export const MIN_CONV_MEDIA = 5 // conversões mínimas em 14 dias pra confiar na média
// Anúncios que o conjunto precisa manter depois de uma pausa (regra do Matheus,
// 14/11/2026). Pausar o último anúncio deixa o conjunto ativo e sem entrega. Nesse
// caso: se a campanha tem outro conjunto ativo com resultado melhor, a sugestão é
// desligar o anúncio E o conjunto e levar a verba pra esse conjunto; senão, trocar
// o criativo (sobe o substituto, depois pausa).
export const MIN_ADS_CONJUNTO = 1

export function reguaDeCusto(meta, media) {
  if (media != null && media > 0 && (!meta || media >= meta * DIVERGENCIA_MEDIA)) {
    return { valor: media, fonte: 'media', fator: FATOR_ACIMA_MEDIA, meta: meta || null, media }
  }
  if (meta) return { valor: meta, fonte: 'meta', fator: 2, meta, media: media ?? null }
  return null
}

// Metas da conta a partir do mapa `accounts` do dashboard (cpl_targets_public).
export function metasDaConta(acc) {
  return {
    cpl: acc?.cplTarget?.value ?? null,
    cac: acc?.cacTarget ?? null,
    mql: acc?.mqlTarget ?? null,
    formularioMql: acc?.metricaFormulario === 'mql',
  }
}

// Funil: o nome manda (TOPO/MEIO/FUNDO). Sem marca no nome, decide o tipo de
// resultado; senão "[Forms] Onix" ou "CBO - SONIC" no WhatsApp (Sempre Chevrolet,
// PVB) ficam sem fundo e fora de toda regra de CPL.
export function funilDaLinha(r) {
  const f = classifyFunnel(r['Nome da campanha'])
  if (f !== 'outro') return f
  const tipo = r['Tipo de resultado'] || ''
  if (/compra|conversa|lead|mql|formul|convers/i.test(tipo)) return 'fundo'
  if (/thruplay|alcance|visitas ao perfil|impress|engajamento|seguidor/i.test(tipo)) return 'topo'
  return 'outro'
}

// A campanha otimiza pra clique/conversão? Engajamento com publicação, ThruPlay,
// alcance, impressões e visita ao perfil entregam pra quem NÃO clica: CTR baixo e
// zero conversão ali são esperados (Óticas AF_MEIO_ENGAJAMENTO / AF_MEIO_VIDEO_VIEW).
function otimizaConversao(r) {
  const tipo = r['Tipo de resultado'] || ''
  const destino = r['Destino do conjunto de anúncio'] || ''
  if (/thruplay|alcance|impress|engajamento com|visitas ao perfil|seguidor/i.test(tipo)) return false
  if (/^(ON_POST|ON_VIDEO|INSTAGRAM_PROFILE)/.test(destino)) return false
  return true
}

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
// Hoje (yyyy-mm-dd) em America/Sao_Paulo, o fuso das contas.
export function hojeSP() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

// Último dia FECHADO que serve de fim da janela: o dia mais recente do dash, mas
// nunca hoje. O Gerenciador do Meta e o Google Ads fecham "Últimos 7 dias" em
// ontem; incluir o dia parcial de hoje fazia o card divergir dos dois (gasto e
// conversões menores, e "sem gasto nos 2 últimos dias" falso de manhã cedo).
function ultimoDiaFechado(maxDia) {
  const ontem = addDays(hojeSP(), -1)
  return maxDia && ontem && maxDia > ontem ? ontem : maxDia
}

// Janela de análise (7 dias fechados) pra mostrar na tela: { inicio, fim } ou null.
export function janelaAnalise(meta = [], google = []) {
  const m = maxDate(meta, 'Dia'), g = maxDate(google, 'Data')
  const fim = ultimoDiaFechado([m, g].filter(Boolean).sort().pop() || null)
  return fim ? { inicio: addDays(fim, -6), fim } : null
}

function janelas(rows, dateKey, dias = 7) {
  const norm = rows.map((r) => (r._d ? r : { ...r, _d: fmtDate(r[dateKey]) })).filter((r) => r._d)
  const fim = ultimoDiaFechado(maxDate(norm, '_d'))
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
  if (caminho.campanha) out.push(T.caminho.campanha(caminho.campanha))
  if (caminho.conjunto) out.push(T.caminho.conjunto(caminho.conjunto))
  if (caminho.anuncio) out.push(T.caminho.anuncio(caminho.anuncio, caminho.adId))
  if (caminho.url) out.push(T.caminho.abrir(caminho.url, caminho.cid))
  if (caminho.link) out.push(T.caminho.link(caminho.link))
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
    // Limite conhecido: quando o acesso é pela MCC, o Google Ads abre o seletor
    // de contas e ignora `__e`/`campaignId` (só o `ocid` interno pularia isso, e
    // ele não vem pela API). O link serve pra abrir o Google Ads; o CID vai no
    // card pra colar na busca do seletor.
    if (!c.customerId) return null
    const e = `__e=${c.customerId}`
    if (c.campaignId) return `https://ads.google.com/aw/adgroups?campaignId=${c.campaignId}&${e}`
    return `https://ads.google.com/aw/campaigns?${e}`
  }
  return null
}

// CID do Google no formato da interface (967-903-4908)
export function fmtCid(id) {
  const d = String(id || '').replace(/\D/g, '')
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : d
}

// Monta o `caminho` de uma sugestão já com o link do gerenciador.
function caminhoDe(canal, c) {
  return { ...c, url: linkGerenciador(canal, c), cid: canal === 'google' && c.customerId ? fmtCid(c.customerId) : null }
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
  if (acao) linhas.push(`${T.descricao.otimizacao} ${acao}`, '')
  if (contexto) linhas.push(contexto, '')
  const cam = caminhoLinhas(caminho)
  if (cam.length) {
    linhas.push(T.descricao.onde, ...cam, '')
  }
  if (evidencias?.length) {
    linhas.push(T.descricao.evidencia)
    for (const e of evidencias) linhas.push(`- ${e.label}: ${e.valor}`)
    linhas.push('')
  }
  if (passos?.length) {
    linhas.push(T.descricao.oQueFazer)
    passos.forEach((p, i) => linhas.push(`${i + 1}. ${p}`))
    linhas.push('')
  }
  if (regra) linhas.push(T.descricao.regra(regra))
  return linhas.join('\n')
}

function sugestao(base) {
  return { horas: 1, tipo: 'Otimização', ...base, descricao: descricao(base) }
}

// ─── Meta Ads ────────────────────────────────────────────────────────────────
// Orçamento de AGORA por ID de campanha/conjunto, do snapshot `meta_status`:
// Map id → { orc: 'ABO' | 'CBO', orcDia, orcTotal }. Usado pela regra de remanejar
// verba entre conjuntos (só ABO, e o valor em reais do corte de 20%).
export function orcamentosDoStatus(rows = []) {
  const m = new Map()
  for (const r of rows || []) {
    const nivel = r['Nível']
    if ((nivel !== 'conjunto' && nivel !== 'campanha') || !r['ID']) continue
    m.set(String(r['ID']), {
      orc: r['Orçamento'] || '', orcDia: num(r['Orçamento diário']) || null, orcTotal: num(r['Orçamento total']) || null,
    })
  }
  return m
}
function orcDe(orcamentos, id) {
  if (!id || !orcamentos) return null
  return (typeof orcamentos.get === 'function' ? orcamentos.get(String(id)) : orcamentos[id]) || null
}

function regrasMeta(rowsMeta, metas, conta, orcamentos = null) {
  const out = []
  const metaCpl = metaDe(metas, 'lead')
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
  const funilDe = funilDaLinha
  // Meio de engajamento/ThruPlay é MEIO no nome mas não gera conversão: fica fora das regras de CPL.
  const ehConversao = (r) => { const f = funilDe(r); return (f === 'fundo' || f === 'meio') && otimizaConversao(r) }
  const atualConv = atual.filter(ehConversao)
  const tot = aggMeta(atual)
  const totConv = aggMeta(atualConv)
  // Custo médio real da conta por métrica (14 dias, fundo + meio), base da régua de custo
  const conv14 = [...atualConv, ...w.anterior.filter(ehConversao)]
  const mediaReal = {}
  for (const mt of ['lead', 'mql', 'compra']) {
    const ag = aggMeta(conv14.filter((r) => metricaDaLinha(r, metas) === mt))
    mediaReal[mt] = ag.conv >= MIN_CONV_MEDIA ? ag.cpl : null
  }
  const notaRegua = (rg, lbl) => (rg?.fonte === 'media'
    ? T.regua.nota({ lbl, media: fmtMoney(rg.media), meta: rg.meta ? fmtMoney(rg.meta) : null })
    : '')
  const evidMedia = (rg, lbl) => (rg?.media != null ? [{ label: T.regua.mediaLabel(lbl), valor: fmtMoney(rg.media) }] : [])

  // Sem entrega: gastou na semana anterior e zerou nos últimos 2 dias
  const ultimos2 = atual.filter((r) => r._d >= addDays(w.fim, -1))
  const gasto2 = ultimos2.reduce((a, r) => a + num(r['Valor investido']), 0)
  const totAnt = aggMeta(w.anterior)
  if (totAnt.spend > 50 && tot.spend > 0 && gasto2 === 0) {
    const R = T.regras.semEntrega
    out.push(sugestao({
      chave: `meta:sem_entrega:${conta || 'conta'}`, canal, prioridade: 'urgente',
      titulo: `${pref}${R.titulo()}`,
      acao: R.acao(),
      caminho: contaCam(),
      regra: R.regra,
      contexto: R.contexto({ gasto: fmtMoney(totAnt.spend) }),
      evidencias: [
        { label: R.ev.gastoAnt, valor: fmtMoney(totAnt.spend) },
        { label: R.ev.gasto2, valor: fmtMoney(gasto2) },
      ],
      passos: R.passos(),
      horas: 0.5,
    }))
  }

  if (metaCpl == null && totConv.spend > 0) {
    const R = T.regras.cplIndefinido
    out.push(sugestao({
      chave: `meta:cpl_indefinido:${conta || 'conta'}`, canal, prioridade: 'media',
      titulo: `${pref}${R.titulo()}`,
      acao: R.acao(),
      regra: R.regra,
      contexto: R.contexto(),
      evidencias: [{ label: R.ev.cplAtual, valor: totConv.cpl != null ? fmtMoney(totConv.cpl) : T.ev.semConversao }],
      passos: R.passos(),
      tipo: 'Estratégia', horas: 0.5,
    }))
  }

  // Por anúncio pelo `ad_id` (identificador único no Meta). O nome NÃO identifica
  // o anúncio: "01" pode existir em vários conjuntos e campanhas, e mesmo dentro
  // do mesmo conjunto dois anúncios podem ter o mesmo nome. Nunca somar métricas
  // de anúncios diferentes só porque o nome coincide. Linhas antigas sem ad_id
  // caem no fallback campanha + conjunto + nome.
  const SEP = '\u0001'
  const chaveAd = (r) => {
    if (!r['Nome do Anúncio']) return null
    const id = (r.ad_id || '').toString().trim()
    return id ? `id${SEP}${id}` : ['nm', r['Nome da campanha'] || '', r['Conjunto de Anúncio'] || '', r['Nome do Anúncio']].join(SEP)
  }
  const porAd = groupRows(atualConv, chaveAd)
  // Anúncios ativos por conjunto (qualquer funil), pra trava de MIN_ADS_CONJUNTO.
  // Conta anúncio com linha na janela e último status ativo.
  const chaveConj = (r) => {
    const id = (r.adset_id || '').toString().trim()
    return id ? `id${SEP}${id}` : ['nm', r['Nome da campanha'] || '', r['Conjunto de Anúncio'] || ''].join(SEP)
  }
  const chaveCamp = (r) => (r.campaign_id || '').toString().trim() || `nm${SEP}${r['Nome da campanha'] || ''}`
  const maisNova = (rs) => rs.reduce((b, r) => (!b || r._d > b._d ? r : b), null)
  const restamNoConj = new Map()
  for (const rs of groupRows(atual, chaveAd).values()) {
    if (isPaused(ultimoStatus(rs, '_d', META_STATUS_AD))) continue
    const c = chaveConj(maisNova(rs))
    restamNoConj.set(c, (restamNoConj.get(c) || 0) + 1)
  }
  // Conjuntos da janela: campanha, status e resultado (pra achar quem recebe a verba)
  const conjs = new Map()
  for (const [c, rs] of groupRows(atual, chaveConj)) {
    const u = maisNova(rs)
    conjs.set(c, {
      nome: u['Conjunto de Anúncio'] || '', camp: chaveCamp(u),
      ativo: !isPaused(u['Status do Conjunto de Anúncio']) && (restamNoConj.get(c) || 0) > 0,
      a: aggMeta(rs), aConv: aggMeta(rs.filter(ehConversao)),
    })
  }
  const desligados = new Set(), destinos = new Set()
  // Melhor outro conjunto ativo da mesma campanha; `nota(x)` devolve número (menor =
  // melhor) ou null quando o conjunto não é melhor que o anúncio avaliado.
  const melhorConj = (cj, nota) => {
    const o = conjs.get(cj)
    if (!o) return null
    let best = null
    for (const [c, x] of conjs) {
      if (c === cj || x.camp !== o.camp || !x.ativo || desligados.has(c)) continue
      const v = nota(x)
      if (v != null && (!best || v < best.v)) best = { c, x, v }
    }
    return best
  }
  // Do pior pro menos pior: pausa enquanto o conjunto mantiver MIN_ADS_CONJUNTO ativos.
  // O último anúncio do conjunto: desliga o conjunto junto se houver pra onde levar a
  // verba, senão vira troca de criativo.
  const separarPausaTroca = (itens, notaPara) => {
    const pausar = [], desligarConj = [], trocar = []
    for (const it of itens) {
      const n = restamNoConj.get(it.cj) ?? 1
      if (n - 1 >= MIN_ADS_CONJUNTO) { restamNoConj.set(it.cj, n - 1); pausar.push(it); continue }
      const dest = destinos.has(it.cj) ? null : melhorConj(it.cj, notaPara(it))
      if (dest) {
        desligados.add(it.cj); destinos.add(dest.c); restamNoConj.set(it.cj, 0)
        desligarConj.push({ ...it, orig: it, dest: dest.x, destId: dest.c.startsWith('id' + SEP) ? dest.c.slice(3) : null })
      } else trocar.push({ ...it, ativosConj: n, orig: it })
    }
    return { pausar, desligarConj, trocar }
  }
  const trocaChave = (chave, novo) => chave.replace(/^meta:(ad_sem_conv|ad_cpl_alto|topo_gancho):/, `meta:${novo}:`)
  // Card de troca: mesmo diagnóstico do card de pausa, ação de subir substituto antes.
  const cardTroca = (base, n, prioridade) => {
    const R = T.regras.adTrocar
    return sugestao({
      ...base,
      chave: trocaChave(base.chave, 'ad_trocar'),
      prioridade,
      titulo: `${pref}${R.titulo({ nome: base.entidade, n })}`,
      acao: R.acao({ n }),
      regra: R.regra,
      contexto: `${base.contexto} ${R.complemento({ n })}`,
      evidencias: [...base.evidencias, { label: R.ev.ativosConj, valor: String(n) }],
      passos: R.passos(),
      tipo: 'Subir Criativo', horas: 1,
    })
  }
  // Card de desligar o conjunto: o anúncio é o último ativo e outro conjunto da
  // campanha está melhor; a verba do conjunto vai pra ele.
  const cardDesligarConj = (base, it, prioridade, destRes) => {
    const R = T.regras.conjDesligar
    const o = conjs.get(it.cj)
    const gDia = fmtMoney(o.a.spend / Math.max(1, o.a.dias))
    const dest = it.dest.nome
    return sugestao({
      ...base,
      chave: trocaChave(base.chave, 'conj_desligar'),
      prioridade, entidade: it.conj,
      titulo: `${pref}${R.titulo({ conj: it.conj, dest })}`,
      acao: R.acao({ nome: base.entidade, conj: it.conj, dest }),
      regra: R.regra,
      contexto: `${base.contexto} ${R.complemento({ dest, gDia, destRes })}`,
      evidencias: [
        ...base.evidencias,
        { label: R.ev.gastoDia, valor: gDia },
        { label: R.ev.destino, valor: dest },
        { label: R.ev.destinoRes, valor: destRes },
      ],
      passos: R.passos({ dest }),
      // Pra quem for executar (pessoa ou agente): o conjunto que recebe a verba.
      destino: { adsetId: it.destId || null, nome: dest },
      tipo: 'Otimização', horas: 0.5,
    })
  }
  const porAdAnt = groupRows(w.anterior.filter(ehConversao), chaveAd)
  const janelaTxt = T.periodo(fmtDia(w.inicio), fmtDia(w.fim))
  const janelaAntTxt = T.periodo(fmtDia(addDays(w.inicio, -7)), fmtDia(addDays(w.inicio, -1)))
  // Evidência e frase do histórico (anúncio) — vazio se o anúncio não rodou na semana anterior
  // `rg` = régua de custo (reguaDeCusto): meta da calculadora ou média real da conta
  const historico = (ant, rg = null, lbl = 'CPL') => {
    const H = T.historico
    if (!ant || ant.spend <= 0) return { frase: '', evid: [{ label: H.naoRodouLabel, valor: H.naoRodou }] }
    const evid = [{ label: H.label(janelaAntTxt), valor: H.valor({ conv: fmtInt(ant.conv), gasto: fmtMoney(ant.spend), lbl, cpl: ant.cpl != null ? fmtMoney(ant.cpl) : null }) }]
    const ref = rg?.valor ?? null
    const bom = ref && ant.cpl != null && ant.cpl <= ref * rg.fator
    const frase = ant.conv > 0
      ? H.converteu({ j: janelaAntTxt, conv: fmtInt(ant.conv), plural: ant.conv > 1, lbl, cpl: fmtMoney(ant.cpl), bom, x: ref ? fmtDec(ant.cpl / ref, 1) : null, media: rg?.fonte === 'media' })
      : H.naoConverteu({ j: janelaAntTxt, gasto: fmtMoney(ant.spend) })
    return { frase, evid, bom }
  }
  const semConv = [], cplAlto = []
  for (const [k, rs] of porAd) {
    if (isPaused(ultimoStatus(rs, '_d', META_STATUS_AD))) continue
    const a = aggMeta(rs)
    if (a.dias < 3) continue // nunca antes de 72h
    const metrica = metricaDe(rs, metas)
    const meta = metaDe(metas, metrica)
    const rg = reguaDeCusto(meta, mediaReal[metrica])
    const gastoMin = rg ? Math.max(GASTO_MINIMO_SEM_RESULTADO, rg.valor * 2) : GASTO_MINIMO_SEM_RESULTADO
    const ultimo = rs.reduce((b, r) => (!b || r._d > b._d ? r : b), null)
    const nome = ultimo['Nome do Anúncio']
    const camp = ultimo['Nome da campanha'] || ''
    const conj = ultimo['Conjunto de Anúncio'] || ''
    const adId = k.startsWith('id' + SEP) ? k.slice(3) : null
    const link = distintos(rs, 'Link do anúncio')[0] || null
    const ids = { adsetId: idDe(rs, 'adset_id'), campaignId: idDe(rs, 'campaign_id') }
    const ant = porAdAnt.has(k) ? aggMeta(porAdAnt.get(k)) : null
    const item = { nome, camp, conj, adId, link, ids, a, ant, metrica, meta, rg, cj: chaveConj(ultimo) }
    const corte = rg ? rg.valor * rg.fator : null
    if (a.conv === 0 && a.spend >= gastoMin) semConv.push(item)
    else if (corte && a.conv > 0 && a.cpl >= corte && a.spend >= corte) cplAlto.push(item)
  }
  // Sem conversão é pior que custo alto: entra primeiro na fila da trava do conjunto.
  semConv.sort((x, y) => y.a.spend - x.a.spend)
  cplAlto.sort((x, y) => y.a.cpl / y.rg.valor - x.a.cpl / x.rg.valor)
  const ehSemConv = new Set(semConv)
  // Recebe a verba: outro conjunto com conversão, custo menor que o deste anúncio e
  // abaixo do corte da régua (não manda verba pra um conjunto que também está caro)
  const { pausar, desligarConj, trocar } = separarPausaTroca([...semConv, ...cplAlto], (it) => (x) => {
    const corte = it.rg ? it.rg.valor * it.rg.fator : Infinity
    const melhor = x.aConv.conv > 0 && x.aConv.cpl < corte && (it.a.conv === 0 || x.aConv.cpl < it.a.cpl)
    return melhor ? x.aConv.cpl : null
  })
  const cardSemConv = ({ nome, camp, conj, adId, link, ids, a, ant, metrica, rg }) => {
    const h = historico(ant, rg, T.metrica[metrica])
    // Convertia na semana anterior e secou: ainda vale agir, mas não como urgência cega
    const vinhaConvertendo = h.bom
    const R = T.regras.adSemConv
    return {
      chave: `meta:ad_sem_conv:${adId || `${camp}::${conj}::${nome}`}`, canal, prioridade: vinhaConvertendo ? 'alta' : 'urgente', entidade: nome,
      titulo: `${pref}${R.titulo({ nome, gasto: fmtMoney(a.spend) })}`,
      acao: R.acao(),
      caminho: contaCam({ campanha: camp, conjunto: conj, anuncio: nome, adId, link, ...ids }),
      regra: R.regra,
      contexto: R.contexto({ conj, camp, gasto: fmtMoney(a.spend), dias: a.dias, j: janelaTxt, frase: h.frase }),
      evidencias: [
        { label: T.ev.janela, valor: janelaTxt },
        { label: T.ev.gasto, valor: fmtMoney(a.spend) },
        { label: T.ev.conversoes, valor: '0' },
        ...evidMedia(rg, T.metrica[metrica]),
        ...h.evid,
        { label: T.ev.ctrLink, valor: fmtPct(a.ctr) },
        { label: R.ev.diasNoAr, valor: String(a.dias) },
      ],
      passos: R.passos(),
      horas: 0.5,
    }
  }
  const cardCplAlto = ({ nome, camp, conj, adId, link, ids, a, ant, metrica, meta, rg }) => {
    const lbl = T.metrica[metrica]
    const h = historico(ant, rg, lbl)
    const porMedia = rg.fonte === 'media'
    const R = porMedia ? T.regras.adCplAltoMedia : T.regras.adCplAlto
    const x = fmtDec(a.cpl / rg.valor, 1)
    return {
      chave: `meta:ad_cpl_alto:${adId || `${camp}::${conj}::${nome}`}`, canal, prioridade: 'alta', entidade: nome,
      titulo: `${pref}${R.titulo({ nome, lbl, cpl: fmtMoney(a.cpl), meta: fmtMoney(rg.valor), media: fmtMoney(rg.valor) })}`,
      acao: R.acao({ lbl, x }),
      caminho: contaCam({ campanha: camp, conjunto: conj, anuncio: nome, adId, link, ...ids }),
      regra: R.regra,
      contexto: R.contexto({ conj, camp, lbl, x, j: janelaTxt, frase: h.frase, nota: notaRegua(rg, lbl) }),
      evidencias: [
        { label: T.ev.janela, valor: janelaTxt },
        ...h.evid,
        { label: lbl.charAt(0).toUpperCase() + lbl.slice(1), valor: fmtMoney(a.cpl) },
        ...(meta ? [{ label: T.metricaMeta[metrica], valor: fmtMoney(meta) }] : []),
        ...evidMedia(rg, lbl),
        { label: T.ev.gasto, valor: fmtMoney(a.spend) },
        { label: T.ev.conversoes, valor: fmtInt(a.conv) },
      ],
      passos: R.passos(),
      horas: 0.5,
    }
  }
  // Só os 5 piores de cada regra viram sugestão
  for (const it of pausar.filter((i) => ehSemConv.has(i)).slice(0, 5)) out.push(sugestao(cardSemConv(it)))
  for (const it of pausar.filter((i) => !ehSemConv.has(i)).slice(0, 5)) out.push(sugestao(cardCplAlto(it)))
  for (const it of trocar.slice(0, 5)) {
    out.push(cardTroca(ehSemConv.has(it.orig) ? cardSemConv(it) : cardCplAlto(it), it.ativosConj, 'alta'))
  }
  for (const it of desligarConj.slice(0, 5)) {
    const d = it.dest.aConv
    const destRes = T.regras.conjDesligar.resConv({ lbl: T.metrica[it.metrica], cpl: fmtMoney(d.cpl), conv: fmtInt(d.conv) })
    out.push(cardDesligarConj(ehSemConv.has(it.orig) ? cardSemConv(it) : cardCplAlto(it), it, 'alta', destRes))
  }

  // ─── Remanejar verba entre conjuntos (pedido do Matheus, 21/11/2026) ──────────
  // Conjunto ABO que nos 7 dias gastou 2× a meta de custo sem trazer resultado dentro
  // disso (custo por resultado ≥ 2× a meta, ou zero resultado com gasto ≥ 2× a meta)
  // perde 20% do orçamento diário, que vai pro conjunto que mais performa na mesma
  // campanha. Olha o CONJUNTO inteiro: com vários anúncios dividindo o gasto, nenhum
  // sozinho chega a 2× a meta e as regras de anúncio não disparam, mas o conjunto já
  // passou. Régua = reguaDeCusto (meta da calculadora; média real se a meta não serve).
  // Fora: campanha com 1 conjunto ativo, CBO (a verba é da campanha) e conjunto que
  // a regra do último anúncio já mandou desligar.
  const reTag = (tag) => new RegExp(`(^|[^a-z])${tag}([^a-z]|$)`, 'i')
  const porConjConv = groupRows(atualConv, chaveConj)
  const remanejar = []
  for (const [c, o] of conjs) {
    if (!o.ativo || desligados.has(c)) continue
    const rs = porConjConv.get(c)
    if (!rs) continue
    const ult = maisNova(rs)
    if (isPaused(ult['Status da Campanha'])) continue
    const a = aggMeta(rs)
    if (a.dias < 3) continue // nunca antes de 72h
    const nAtivos = [...conjs.entries()].filter(([k, x]) => x.camp === o.camp && x.ativo && !desligados.has(k)).length
    if (nAtivos < 2) continue
    const metrica = metricaDe(rs, metas)
    const rg = reguaDeCusto(metaDe(metas, metrica), mediaReal[metrica])
    if (!rg) continue
    const corte = rg.valor * rg.fator
    if (!(a.spend >= corte && (a.conv === 0 || a.cpl >= corte))) continue
    const camp = ult['Nome da campanha'] || ''
    const adsetId = idDe(rs, 'adset_id'), campaignId = idDe(rs, 'campaign_id')
    const orcConj = orcDe(orcamentos, adsetId)
    // ABO/CBO: do snapshot de status (meta_status); sem ele, só pela marca no nome.
    const tipoOrc = orcConj?.orc || orcDe(orcamentos, campaignId)?.orc
      || (reTag('cbo').test(camp) ? 'CBO' : reTag('abo').test(camp) ? 'ABO' : null)
    if (tipoOrc !== 'ABO') continue
    const dest = melhorConj(c, (x) => (x.aConv.conv > 0 && x.aConv.cpl < corte && (a.conv === 0 || x.aConv.cpl < a.cpl) ? x.aConv.cpl : null))
    if (!dest) continue
    const destId = dest.c.startsWith('id' + SEP) ? dest.c.slice(3) : null
    remanejar.push({ c, o, a, rs, metrica, rg, corte, camp, adsetId, campaignId, orcConj, dest, destId, nAtivos })
  }
  // Os mais caros primeiro (sem conversão conta como o pior); 5 no máximo, como as outras.
  const peso = (it) => (it.a.conv === 0 ? Infinity : it.a.cpl / it.rg.valor)
  remanejar.sort((x, y) => peso(y) - peso(x) || y.a.spend - x.a.spend)
  for (const { o, a, metrica, rg, corte, camp, adsetId, campaignId, orcConj, dest, destId, nAtivos } of remanejar.slice(0, 5)) {
    const R = T.regras.conjRemanejar
    const lbl = T.metrica[metrica]
    const conj = o.nome, destNome = dest.x.nome
    const diaAtual = orcConj?.orcDia || null
    const valor = diaAtual ? Math.round(diaAtual * 0.2 * 100) / 100 : null
    const diaDest = orcDe(orcamentos, destId)?.orcDia || null
    const d = dest.x.aConv
    const destRes = T.regras.conjDesligar.resConv({ lbl, cpl: fmtMoney(d.cpl), conv: fmtInt(d.conv) })
    const semConv = a.conv === 0
    out.push(sugestao({
      chave: `meta:conj_remanejar:${adsetId || `${camp}::${conj}`}`, canal, prioridade: 'alta', entidade: conj,
      titulo: `${pref}${R.titulo({ conj, dest: destNome })}`,
      acao: R.acao({
        conj, dest: destNome,
        de: diaAtual ? fmtMoney(diaAtual) : null, deNovo: diaAtual ? fmtMoney(diaAtual - valor) : null,
        valor: valor ? fmtMoney(valor) : null,
        para: diaDest ? fmtMoney(diaDest) : null, paraNovo: diaDest && valor ? fmtMoney(diaDest + valor) : null,
      }),
      caminho: contaCam({ campanha: camp, conjunto: conj, campaignId, adsetId }),
      regra: R.regra,
      contexto: R.contexto({
        conj, camp, gasto: fmtMoney(a.spend), j: janelaTxt, semConv, lbl,
        cpl: semConv ? null : fmtMoney(a.cpl), x: semConv ? null : fmtDec(a.cpl / rg.valor, 1),
        ref: R.ref[rg.fonte], n: nAtivos, dest: destNome, destRes, nota: notaRegua(rg, lbl),
      }),
      evidencias: [
        { label: T.ev.janela, valor: janelaTxt },
        { label: T.ev.gasto, valor: fmtMoney(a.spend) },
        { label: T.ev.conversoes, valor: fmtInt(a.conv) },
        ...(semConv ? [] : [{ label: lbl.charAt(0).toUpperCase() + lbl.slice(1), valor: fmtMoney(a.cpl) }]),
        { label: R.ev.corte, valor: fmtMoney(corte) },
        ...evidMedia(rg, lbl),
        { label: R.ev.conjAtivos, valor: String(nAtivos) },
        ...(diaAtual ? [{ label: R.ev.orcAtual, valor: fmtMoney(diaAtual) }, { label: R.ev.orcNovo, valor: fmtMoney(diaAtual - valor) }] : []),
        { label: R.ev.destino, valor: destNome },
        { label: R.ev.destinoRes, valor: destRes },
        ...(diaDest ? [{ label: R.ev.destinoOrc, valor: fmtMoney(diaDest) }] : []),
      ],
      passos: R.passos({ conj, dest: destNome, valor: valor ? fmtMoney(valor) : null }),
      // Pra quem for executar (pessoa ou robô): de onde sai, pra onde vai e quanto.
      remanejar: {
        de: { adsetId, nome: conj, orcDia: diaAtual, novo: diaAtual ? diaAtual - valor : null },
        para: { adsetId: destId, nome: destNome, orcDia: diaDest, novo: diaDest && valor ? diaDest + valor : null },
        valor, pct: 20,
      },
      tipo: 'Otimização', horas: 0.5,
    }))
  }

  // Por campanha
  const porCamp = groupRows(atual, (r) => r['Nome da campanha'])
  const porCampAnt = groupRows(w.anterior, (r) => r['Nome da campanha'])
  let temFundo = false, temTopo = false
  for (const [camp, rs] of porCamp) {
    const a = aggMeta(rs)
    if (a.spend <= 0) continue
    const ultCamp = rs.reduce((b, r) => (!b || r._d > b._d ? r : b), null)
    const funil = funilDe(ultCamp)
    if (funil === 'fundo') temFundo = true
    if (funil === 'topo') temTopo = true
    // Campanha pausada hoje não recebe sugestão de CTR, saturação nem escala.
    const campPausada = isPaused(ultCamp['Status da Campanha'])
    const adsAtivos = new Set(rs.filter((r) => !isPaused(r[META_STATUS_AD])).map((r) => r['Nome do Anúncio'])).size
    const ant = porCampAnt.get(camp) ? aggMeta(porCampAnt.get(camp)) : null

    if (funil !== 'topo' && !campPausada && otimizaConversao(ultCamp) && a.spend >= 50 && a.imps >= 2000 && a.ctr != null && a.ctr < 0.5) {
      const R = T.regras.ctrBaixo
      out.push(sugestao({
        chave: `meta:ctr_baixo:${camp}`, canal, prioridade: 'alta', entidade: camp,
        titulo: `${pref}${R.titulo({ camp, ctr: fmtPct(a.ctr) })}`,
        acao: R.acao(),
        caminho: contaCam({ campanha: camp, campaignId: idDe(rs, 'campaign_id') }),
        regra: R.regra,
        contexto: R.contexto({ imps: fmtInt(a.imps), ctr: fmtPct(a.ctr) }),
        evidencias: [
          { label: T.ev.ctrLink, valor: fmtPct(a.ctr) },
          { label: T.ev.impressoes, valor: fmtInt(a.imps) },
          { label: T.ev.gasto, valor: fmtMoney(a.spend) },
          { label: T.ev.adsAtivos, valor: String(adsAtivos) },
        ],
        passos: R.passos(),
        tipo: 'Subir Criativo', horas: 1,
      }))
    }

    if (funil === 'fundo' && !campPausada && a.freq != null && a.freq >= 3.5 && ant?.ctr != null && a.ctr != null && a.ctr < ant.ctr * 0.9) {
      const R = T.regras.saturacao
      out.push(sugestao({
        chave: `meta:saturacao:${camp}`, canal, prioridade: 'alta', entidade: camp,
        titulo: `${pref}${R.titulo({ camp, freq: fmtDec(a.freq, 1) })}`,
        acao: R.acao(),
        caminho: contaCam({ campanha: camp, campaignId: idDe(rs, 'campaign_id') }),
        regra: R.regra,
        contexto: R.contexto({ freq: fmtDec(a.freq, 1), ctrAnt: fmtPct(ant.ctr), ctr: fmtPct(a.ctr) }),
        evidencias: [
          { label: R.ev.frequencia, valor: fmtDec(a.freq, 2) },
          { label: R.ev.ctrVs, valor: `${fmtPct(a.ctr)} vs ${fmtPct(ant.ctr)}` },
          { label: T.ev.gasto, valor: fmtMoney(a.spend) },
        ],
        passos: R.passos(),
        tipo: 'Subir Criativo', horas: 1,
      }))
    }

    if (funil === 'fundo' && adsAtivos > 0 && adsAtivos < 3 && a.spend >= 30) {
      const R = T.regras.poucosCriativos
      out.push(sugestao({
        chave: `meta:poucos_criativos:${camp}`, canal, prioridade: 'media', entidade: camp,
        titulo: `${pref}${R.titulo({ camp, n: adsAtivos })}`,
        acao: R.acao({ n: adsAtivos }),
        caminho: contaCam({ campanha: camp, campaignId: idDe(rs, 'campaign_id') }),
        regra: R.regra,
        contexto: R.contexto({ n: adsAtivos }),
        evidencias: [
          { label: T.ev.adsAtivos, valor: String(adsAtivos) },
          { label: R.ev.gastoCampanha, valor: fmtMoney(a.spend) },
          { label: T.ev.cpl, valor: a.cpl != null ? fmtMoney(a.cpl) : T.ev.semConversao },
        ],
        passos: R.passos(),
        tipo: 'Subir Criativo', horas: 1,
      }))
    }

    // Escalar: conjunto com custo ≤ 0,8× a meta da métrica dele, volume e estabilidade (3 dias). Só fundo/meio.
    if (!campPausada && (funil === 'fundo' || funil === 'meio')) {
      const porConj = groupRows(rs.filter(ehConversao), (r) => r['Conjunto de Anúncio'])
      for (const [conj, crs] of porConj) {
        const c = aggMeta(crs)
        const mtr = metricaDe(crs, metas), mC = metaDe(metas, mtr), lC = T.metrica[mtr]
        if (!mC || c.conv < 3 || c.cpl == null || c.cpl > mC * 0.8 || c.dias < 3) continue
        const ult3 = aggMeta(crs.filter((r) => r._d >= addDays(w.fim, -2)))
        if (ult3.cpl == null || ult3.cpl > mC) continue
        const R = T.regras.escalar
        out.push(sugestao({
          chave: `meta:escalar:${camp}::${conj}`, canal, prioridade: 'media', entidade: conj,
          titulo: `${pref}${R.titulo({ conj, lbl: lC, cpl: fmtMoney(c.cpl), meta: fmtMoney(mC) })}`,
          acao: R.acao(),
          caminho: contaCam({ campanha: camp, conjunto: conj, campaignId: idDe(crs, 'campaign_id'), adsetId: idDe(crs, 'adset_id') }),
          regra: R.regra,
          contexto: R.contexto({ camp, lbl: lC, pct: Math.round((1 - c.cpl / mC) * 100), conv: fmtInt(c.conv) }),
          evidencias: [
            { label: R.ev.sete(lC), valor: fmtMoney(c.cpl) },
            { label: R.ev.tres(lC), valor: fmtMoney(ult3.cpl) },
            { label: T.ev.conversoes, valor: fmtInt(c.conv) },
            { label: T.ev.gasto, valor: fmtMoney(c.spend) },
          ],
          passos: R.passos(),
          horas: 0.5,
        }))
      }
    }
  }

  // Custo das campanhas de conversão (fundo + meio) piorou vs semana anterior, uma
  // conta por métrica: somar conversa de WhatsApp com compra num CPL só não diz nada.
  // A chave de lead continua a de antes; MQL e compra ganham sufixo.
  const convAnt = w.anterior.filter(ehConversao)
  for (const metrica of ['lead', 'mql', 'compra']) {
    const daMetrica = (r) => metricaDaLinha(r, metas) === metrica
    const totM = aggMeta(atualConv.filter(daMetrica))
    const totMAnt = aggMeta(convAnt.filter(daMetrica))
    if (!(totM.cpl != null && totMAnt.cpl != null && totMAnt.conv >= 3 && totM.cpl > totMAnt.cpl * 1.3)) continue
    const lbl = T.metrica[metrica]
    const Lbl = lbl.charAt(0).toUpperCase() + lbl.slice(1)
    const R = T.regras.cplPiorou
    out.push(sugestao({
      chave: `meta:cpl_piorou:${conta || 'conta'}${metrica === 'lead' ? '' : `:${metrica}`}`, canal, prioridade: 'alta',
      titulo: `${pref}${R.titulo({ lbl, ant: fmtMoney(totMAnt.cpl), atual: fmtMoney(totM.cpl) })}`,
      acao: R.acao({ lbl }),
      caminho: contaCam(),
      regra: R.regra,
      contexto: R.contexto({ lbl, pct: Math.round((totM.cpl / totMAnt.cpl - 1) * 100) }),
      evidencias: [
        { label: R.ev.atual(lbl, Lbl), valor: fmtMoney(totM.cpl) },
        { label: R.ev.anterior(lbl, Lbl), valor: fmtMoney(totMAnt.cpl) },
        { label: R.ev.conversoes, valor: `${fmtInt(totM.conv)} / ${fmtInt(totMAnt.conv)}` },
        { label: R.ev.gasto, valor: `${fmtMoney(totM.spend)} / ${fmtMoney(totMAnt.spend)}` },
      ],
      passos: R.passos({ lbl }),
      tipo: 'Relatório', horas: 1,
    }))
  }

  // ─── Topo de funil: avaliado por vídeo (gancho, retenção, tempo médio) ──────
  // Protocolo: taxa de gancho acima de 30%, tempo médio bom acima de 10 s,
  // renovar criativos a cada 7 dias mantendo os melhores. Visitas ao perfil e
  // seguidores não chegam ao dash, então ficam de fora aqui.
  const porAdTopo = groupRows(atual.filter((r) => funilDe(r) === 'topo'), chaveAd)
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
        adsetId: idDe(rs, 'adset_id'), campaignId: idDe(rs, 'campaign_id'), cj: chaveConj(ultimo),
      })
    }
  }
  // Mesma trava do conjunto: o vídeo só é pausado se sobrarem MIN_ADS_CONJUNTO ativos
  // Recebe a verba: outro conjunto com taxa de gancho dentro do mínimo de 30%
  const topo = separarPausaTroca(ganchoBaixo.sort((x, y) => x.a.gancho - y.a.gancho),
    () => (x) => (x.a.gancho != null && x.a.gancho >= 30 ? -x.a.gancho : null))
  const cardTopo = ({ nome, camp, conj, adId, link, adsetId, campaignId, a }) => {
    const R = T.regras.topoGancho
    return {
      chave: `meta:topo_gancho:${adId || `${camp}::${conj}::${nome}`}`, canal, prioridade: 'media', entidade: nome,
      titulo: `${pref}${R.titulo({ nome, gancho: fmtPct(a.gancho, 0) })}`,
      acao: R.acao(),
      caminho: contaCam({ campanha: camp, conjunto: conj, anuncio: nome, adId, link, adsetId, campaignId }),
      regra: R.regra,
      contexto: R.contexto({ imps: fmtInt(a.imps), dias: a.dias, gancho: fmtPct(a.gancho, 0) }),
      evidencias: [
        { label: R.ev.gancho, valor: fmtPct(a.gancho, 1) },
        { label: R.ev.ret25, valor: a.ret25 != null ? fmtPct(a.ret25, 1) : '—' },
        { label: R.ev.thruplay, valor: a.thruplay != null ? fmtPct(a.thruplay, 1) : '—' },
        { label: R.ev.tempoMedio, valor: a.tempoMedio != null ? fmtDec(a.tempoMedio, 1) + ' s' : '—' },
        { label: T.ev.gasto, valor: fmtMoney(a.spend) },
      ],
      passos: R.passos(),
      tipo: 'Subir Criativo', horas: 1,
    }
  }
  for (const it of topo.pausar.slice(0, 5)) out.push(sugestao(cardTopo(it)))
  for (const it of topo.trocar.slice(0, 5)) out.push(cardTroca(cardTopo(it), it.ativosConj, 'media'))
  for (const it of topo.desligarConj.slice(0, 5)) {
    const destRes = T.regras.conjDesligar.resGancho({ gancho: fmtPct(it.dest.a.gancho, 0) })
    out.push(cardDesligarConj(cardTopo(it), it, 'media', destRes))
  }

  // Estrutura do playbook por faixa de verba
  if (tot.spend > 0) {
    const verbaMensal = tot.spend / Math.max(1, tot.dias) * 30
    if (!temFundo) {
      const R = T.regras.semFundo
      out.push(sugestao({
        chave: `meta:sem_fundo:${conta || 'conta'}`, canal, prioridade: 'alta',
        titulo: `${pref}${R.titulo()}`,
      acao: R.acao(),
      caminho: contaCam(),
        regra: R.regra,
        contexto: R.contexto({ verba: fmtMoney(verbaMensal) }),
        evidencias: [
          { label: R.ev.campanhas, valor: [...porCamp.keys()].slice(0, 4).join(', ') || '—' },
          { label: T.ev.verbaMensal, valor: fmtMoney(verbaMensal) },
        ],
        passos: R.passos(),
        tipo: 'Criar Campanha', horas: 2,
      }))
    }
    if (temFundo && !temTopo && verbaMensal >= 2000) {
      const R = T.regras.semTopo
      out.push(sugestao({
        chave: `meta:sem_topo:${conta || 'conta'}`, canal, prioridade: 'media',
        titulo: `${pref}${R.titulo({ verba: fmtMoney(verbaMensal) })}`,
      acao: R.acao(),
      caminho: contaCam(),
        regra: R.regra,
        contexto: R.contexto({ verba: fmtMoney(verbaMensal) }),
        evidencias: [
          { label: T.ev.verbaMensal, valor: fmtMoney(verbaMensal) },
          { label: R.ev.campanhas, valor: [...porCamp.keys()].slice(0, 4).join(', ') },
        ],
        passos: R.passos(),
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
  // Régua de custo do Google: meta da calculadora ou CPL médio real da conta em 14 dias
  const tot14 = aggGoogle([...atual, ...w.anterior])
  const rg = reguaDeCusto(metaCpl, tot14.conv >= MIN_CONV_MEDIA ? tot14.cpl : null)
  const gastoMin = rg ? Math.max(GASTO_MINIMO_SEM_RESULTADO, rg.valor * 2) : GASTO_MINIMO_SEM_RESULTADO
  const corte = rg ? rg.valor * rg.fator : null

  const customerId = idDe(atual, 'customer_id')
  const contaCam = (extra = {}) => caminhoDe(canal, { customerId, ...extra })
  const porCamp = groupRows(atual, (r) => r['Campanha'])
  for (const [camp, rs] of porCamp) {
    const a = aggGoogle(rs)
    if (a.spend <= 0) continue
    if (a.conv === 0 && a.spend >= gastoMin && a.dias >= 3) {
      const R = T.regras.gCampSemConv
      out.push(sugestao({
        chave: `google:camp_sem_conv:${camp}`, canal, prioridade: 'alta', entidade: camp,
        titulo: `${pref}${R.titulo({ camp, gasto: fmtMoney(a.spend) })}`,
        acao: R.acao(),
        caminho: contaCam({ campanha: camp, campaignId: idDe(rs, 'campaign_id') }),
        regra: R.regra,
        contexto: R.contexto({ gasto: fmtMoney(a.spend), dias: a.dias }),
        evidencias: [
          { label: T.ev.gasto, valor: fmtMoney(a.spend) },
          { label: T.ev.cliques, valor: fmtInt(a.clicks) },
          { label: T.ev.ctr, valor: fmtPct(a.ctr) },
        ],
        passos: R.passos(),
        horas: 1,
      }))
    } else if (corte && a.conv > 0 && a.cpl >= corte && a.spend >= corte) {
      const porMedia = rg.fonte === 'media'
      const R = porMedia ? T.regras.gCampCplAltoMedia : T.regras.gCampCplAlto
      const nota = porMedia ? T.regua.nota({ lbl: 'CPL', media: fmtMoney(rg.media), meta: rg.meta ? fmtMoney(rg.meta) : null }) : ''
      out.push(sugestao({
        chave: `google:camp_cpl_alto:${camp}`, canal, prioridade: 'alta', entidade: camp,
        titulo: `${pref}${R.titulo({ camp, cpl: fmtMoney(a.cpl), meta: fmtMoney(rg.valor), media: fmtMoney(rg.valor) })}`,
        acao: R.acao(),
        caminho: contaCam({ campanha: camp, campaignId: idDe(rs, 'campaign_id') }),
        regra: R.regra,
        contexto: R.contexto({ x: fmtDec(a.cpl / rg.valor, 1), conv: fmtInt(a.conv), nota }),
        evidencias: [
          { label: T.ev.cpl, valor: fmtMoney(a.cpl) },
          ...(metaCpl ? [{ label: T.ev.metaCpl, valor: fmtMoney(metaCpl) }] : []),
          ...(rg.media != null ? [{ label: T.regua.mediaLabel('CPL'), valor: fmtMoney(rg.media) }] : []),
          { label: T.ev.gasto, valor: fmtMoney(a.spend) },
          { label: T.ev.taxaConversao, valor: fmtPct(a.convRate, 1) },
        ],
        passos: R.passos(),
        horas: 1,
      }))
    }
    if (a.conv > 0 && a.perdaOrcamento != null && a.perdaOrcamento >= 30 && (!rg || a.cpl <= rg.valor)) {
      const R = T.regras.gPerdaOrcamento
      out.push(sugestao({
        chave: `google:perda_orcamento:${camp}`, canal, prioridade: 'media', entidade: camp,
        titulo: `${pref}${R.titulo({ camp, perda: fmtPct(a.perdaOrcamento, 0) })}`,
        acao: R.acao(),
        caminho: contaCam({ campanha: camp, campaignId: idDe(rs, 'campaign_id') }),
        regra: R.regra,
        contexto: R.contexto({ perda: fmtPct(a.perdaOrcamento, 0), cpl: fmtMoney(a.cpl) }),
        evidencias: [
          { label: R.ev.perda, valor: fmtPct(a.perdaOrcamento, 0) },
          { label: T.ev.cpl, valor: fmtMoney(a.cpl) },
          { label: T.ev.conversoes, valor: fmtInt(a.conv) },
        ],
        passos: R.passos(),
        horas: 0.5,
      }))
    }
    if (a.imps >= 500 && a.ctr != null && a.ctr < 2) {
      const R = T.regras.gCtrBaixo
      out.push(sugestao({
        chave: `google:ctr_baixo:${camp}`, canal, prioridade: 'media', entidade: camp,
        titulo: `${pref}${R.titulo({ camp, ctr: fmtPct(a.ctr) })}`,
        acao: R.acao(),
        caminho: contaCam({ campanha: camp, campaignId: idDe(rs, 'campaign_id') }),
        regra: R.regra,
        contexto: R.contexto({ imps: fmtInt(a.imps), ctr: fmtPct(a.ctr) }),
        evidencias: [
          { label: T.ev.ctr, valor: fmtPct(a.ctr) },
          { label: T.ev.impressoes, valor: fmtInt(a.imps) },
          { label: T.ev.cliques, valor: fmtInt(a.clicks) },
        ],
        passos: R.passos(),
        horas: 1,
      }))
    }
  }

  if (tot.clicks >= 100 && tot.convRate != null && tot.convRate < 5) {
    const R = T.regras.gConvRate
    out.push(sugestao({
      chave: `google:conv_rate:${conta || 'conta'}`, canal, prioridade: 'media',
      titulo: `${pref}${R.titulo({ taxa: fmtPct(tot.convRate, 1) })}`,
      acao: R.acao(),
      caminho: contaCam(),
      regra: R.regra,
      contexto: R.contexto({ cliques: fmtInt(tot.clicks), conv: fmtInt(tot.conv) }),
      evidencias: [
        { label: T.ev.taxaConversao, valor: fmtPct(tot.convRate, 1) },
        { label: T.ev.cliques, valor: fmtInt(tot.clicks) },
        { label: T.ev.conversoes, valor: fmtInt(tot.conv) },
      ],
      passos: R.passos(),
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
 * @param {number|null} p.metaCpl  meta de CPL da conta (R$), legado: usado quando não vem `metas`
 * @param {object} [p.metas]     { cpl, cac, mql, formularioMql } (ver metasDaConta)
 * @param {string} [p.conta]     nome da conta (prefixo do título quando há várias)
 * @param {Map|object} [p.orcamentos]  orçamento de agora por ID de campanha/conjunto
 *                               (orcamentosDoStatus); sem ele, ABO/CBO sai do nome
 */
export function gerarSugestoes({ meta = [], google = [], metaCpl = null, metas = null, conta = null, orcamentos = null }) {
  usarIdioma()
  const m = metas || { cpl: metaCpl }
  const todas = [...regrasMeta(meta, m, conta, orcamentos), ...regrasGoogle(google, metaDe(m, 'lead'), conta)]
  return todas.sort((a, b) => PRIORIDADE_ORDEM[a.prioridade] - PRIORIDADE_ORDEM[b.prioridade])
}

// Contas compartilhadas com o nosso usuário, mas que a Revenue Lab não opera: ficam fora de
// toda análise de otimização (Central, hub do cliente e painel do dashboard).
// Compara pelo nome normalizado, igual no Meta e no Google.
const CONTAS_FORA_DA_ANALISE = ['sempre chevrolet']
export function contaForaDaAnalise(nome) {
  const n = String(nome || '').trim().toLowerCase().replace(/\s+/g, ' ')
  return CONTAS_FORA_DA_ANALISE.includes(n)
}

/**
 * Gera por conta vinculada (quando o projeto tem mais de uma conta) e junta.
 * @param {object} p
 * @param {Array} p.meta
 * @param {Array} p.google
 * @param {object} p.accounts   mapa nome da conta → { cplTarget: {value}, cacTarget, mqlTarget, metricaFormulario }
 * @param {Array} [p.metaStatus] linhas do snapshot `meta_status` (orçamento ABO/CBO de agora)
 */
export function gerarSugestoesProjeto({ meta = [], google = [], accounts = {}, metaStatus = null }) {
  const orcamentos = metaStatus ? orcamentosDoStatus(metaStatus) : null
  const contas = new Set([...meta.map((r) => r['Nome da conta']), ...google.map((r) => r['Nome da conta'])].filter(Boolean))
  const varias = contas.size > 1
  const out = []
  for (const conta of contas) {
    if (contaForaDaAnalise(conta)) continue // `varias` já foi contado com ela: as chaves das outras não mudam
    out.push(...gerarSugestoesConta({
      meta: meta.filter((r) => r['Nome da conta'] === conta),
      google: google.filter((r) => r['Nome da conta'] === conta),
      metas: metasDaConta(accounts[conta]),
      conta, varias, orcamentos,
    }))
  }
  return out.sort((a, b) => PRIORIDADE_ORDEM[a.prioridade] - PRIORIDADE_ORDEM[b.prioridade])
}

/**
 * Sugestões de UMA conta, com `conta` e `chave` no mesmo formato do projeto.
 * A chave leva o prefixo `conta|` quando o projeto tem mais de uma conta
 * (`varias`), e é por ela que a decisão em `projeto_sugestoes` casa com a
 * sugestão: quem monta a lista de uma conta só (o dashboard) precisa informar
 * `varias` como a Central de Otimizações calcularia, senão a mesma sugestão
 * apareceria pendente num lugar e decidida no outro.
 */
export function gerarSugestoesConta({ meta = [], google = [], metaCpl = null, metas = null, conta, varias = false, orcamentos = null }) {
  if (contaForaDaAnalise(conta)) return []
  return gerarSugestoes({
    meta, google,
    metas: metas || { cpl: metaCpl },
    conta: varias ? conta : null, orcamentos,
  }).map((s) => ({ ...s, conta, chave: varias ? `${conta}|${s.chave}` : s.chave }))
}

// Decide se uma sugestão calculada agora ainda está pendente dado o registro
// de decisão: sem registro, ou adiada (`descartada`) com a validade vencida.
export function pendente(st, hoje) {
  if (!st) return true
  if (st.status === 'aceita' || st.status === 'recusada') return false
  return !!(st.valida_ate && st.valida_ate < hoje)
}

// ── Título do cartão em 3 linhas: Conta / O que fazer / Local ──────────────────
// A conta vem do campo `conta` ou, quando o projeto tem uma só, do prefixo "[Conta] " do título.
export function tituloConta(s) {
  return s.conta || s.titulo?.match(/^\[(.+?)\]\s/)?.[1] || '-'
}
export function tituloSemConta(s) {
  return (s.titulo || '').replace(/^\[.+?\]\s/, '')
}
// Nível mais específico que a regra conhece: anúncio > conjunto > campanha (rótulo + nome).
export function tituloLocal(s) {
  const c = s.caminho
  if (!c) return ''
  const L = TEXTOS[idiomaPlaybook()].local
  if (c.anuncio) return L.anuncio(c.anuncio)
  if (c.conjunto) return L.conjunto(c.conjunto)
  if (c.campanha) return L.campanha(c.campanha)
  return ''
}
