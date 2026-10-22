import { getUser, jsonErr } from './_http.js'
// Edge function: lê o LOG DE ATIVIDADES do Meta (o que realmente mudou na conta:
// pausas, anúncios/campanhas criados, orçamento, público) e devolve já traduzido
// em itens { data, cat, texto, nivel, autor }, nas mesmas categorias da aba
// "Otimizações" do Modo Apresentação (src/lib/otimizacoesLeigo.js).
//
// GET ?accounts=Nome1|Nome2&since=AAAA-MM-DD&until=AAAA-MM-DD  (login obrigatório)
// Tokens no servidor: META_TOKEN (+ META_TOKEN_CICAL / META_TOKENS_EXTRA).
//
// No log do Meta os níveis vêm com nome trocado: object_type CAMPAIGN_GROUP =
// campanha, CAMPAIGN = conjunto, ADGROUP = anúncio.
export const config = { runtime: 'edge' }

const GRAPH = 'https://graph.facebook.com/v19.0'
const MAX_PAGES = 6

function normStr(s) {
  return (s || '').toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ')
}

async function graphGet(path, params, token) {
  const qs = new URLSearchParams({ ...params, access_token: token })
  const r = await fetch(`${GRAPH}/${path}?${qs}`)
  const body = await r.json().catch(() => ({}))
  if (!r.ok || body.error) throw new Error(body.error?.message || `Graph API HTTP ${r.status}`)
  return body
}

async function metaAccountsOfToken(token) {
  const out = []
  let path = 'me/adaccounts'
  let params = { fields: 'name,account_id', limit: '500' }
  for (let page = 0; page < 3; page++) {
    const body = await graphGet(path, params, token)
    out.push(...(body.data || []))
    const next = body.paging?.next
    if (!next) break
    const u = new URL(next)
    path = u.pathname.replace(/^\/v[\d.]+\//, '')
    params = Object.fromEntries(u.searchParams)
    delete params.access_token
  }
  return out
}

// Dia (AAAA-MM-DD) no horário de Brasília.
function diaBR(iso) {
  const d = new Date(new Date(iso).getTime() - 3 * 3600 * 1000)
  return d.toISOString().slice(0, 10)
}
const fmtDiaBR = (dia) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`
const brl = (cents) => 'R$ ' + (Number(cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const parse = (s) => { try { return JSON.parse(s) } catch { return {} } }
const lista = (nomes, max = 3) => nomes.slice(0, max).map((n) => `"${n}"`).join(', ') + (nomes.length > max ? ` e mais ${nomes.length - max}` : '')
const ATIVO = /^ativ/i
const INATIVO = /^inativ/i

// Traduz os eventos brutos de UMA conta em itens para o cliente.
function traduzir(events) {
  const itens = []
  const add = (ev, cat, texto, nivel) => itens.push({
    origem: 'log', canal: 'meta', cat, texto, nivel, data: diaBR(ev.event_time), autor: ev.actor_name || null,
  })
  const novosAds = new Map() // dia -> nomes

  for (const ev of events) {
    const t = ev.event_type
    const x = parse(ev.extra_data)
    const nome = ev.object_name || ''
    // Mudanças feitas pelo próprio Meta (revisão de anúncio etc.) não são decisão do time.
    const sistema = ev.actor_name === 'Meta'

    if (t === 'update_campaign_run_status' && !sistema) {
      if (ATIVO.test(x.old_value) && INATIVO.test(x.new_value)) add(ev, 'pausou', `Campanha pausada: "${nome}".`, 'campanha')
      else if (INATIVO.test(x.old_value) && ATIVO.test(x.new_value)) add(ev, 'outras', `Campanha reativada: "${nome}".`, 'campanha')
    } else if (t === 'update_ad_set_run_status' && !sistema) {
      if (ATIVO.test(x.old_value) && INATIVO.test(x.new_value)) add(ev, 'pausou', `Conjunto de anúncios pausado: "${nome}".`, 'conjunto')
      else if (INATIVO.test(x.old_value) && ATIVO.test(x.new_value)) add(ev, 'outras', `Conjunto de anúncios reativado: "${nome}".`, 'conjunto')
    } else if (t === 'update_ad_run_status' && !sistema) {
      if (ATIVO.test(x.old_value) && INATIVO.test(x.new_value)) add(ev, 'pausou', `Anúncio pausado: "${nome}".`, 'anuncio')
      else if (INATIVO.test(x.old_value) && ATIVO.test(x.new_value)) add(ev, 'outras', `Anúncio reativado: "${nome}".`, 'anuncio')
    } else if (t === 'create_ad') {
      const dia = diaBR(ev.event_time)
      if (!novosAds.has(dia)) novosAds.set(dia, { ev, nomes: [] })
      novosAds.get(dia).nomes.push(nome)
    } else if (t === 'create_campaign_group') {
      add(ev, 'estrutura', `Campanha criada: "${nome}".`, 'campanha')
    } else if (t === 'create_ad_set') {
      add(ev, 'publico', `Conjunto de anúncios novo: "${nome}".`, 'conjunto')
    } else if (t === 'update_ad_set_target_spec') {
      add(ev, 'publico', `Público do conjunto "${nome}" foi ajustado.`, 'conjunto')
    } else if (/budget/.test(t || '')) {
      const o = Number(x.old_value), n = Number(x.new_value)
      const alvo = /campaign/.test(t) ? 'campanha' : 'conjunto'
      const delta = Number.isFinite(o) && Number.isFinite(n) && o > 0 && n > 0 ? ` (de ${brl(o)} para ${brl(n)} por dia)` : ''
      add(ev, 'orcamento', `Orçamento do ${alvo} "${nome}" foi alterado${delta}.`, alvo)
    }
  }
  for (const [, { ev, nomes }] of novosAds) {
    const n = nomes.length
    add(ev, 'novoAnuncio', `${n} ${n === 1 ? 'anúncio novo subiu' : 'anúncios novos subiram'}: ${lista(nomes)}.`, 'anuncio')
  }
  // Ruído de lançamento: o que acontece junto com a criação (reativar, ajustar
  // público do conjunto recém-criado) já está dito no próprio "criado". E o log
  // repete o mesmo ajuste várias vezes no mesmo dia.
  const criados = new Set(events
    .filter((e) => e.event_type === 'create_campaign_group' || e.event_type === 'create_ad_set')
    .map((e) => e.object_name).filter(Boolean))
  const vistos = new Set()
  return itens.filter((i) => {
    const nomeCriado = [...criados].some((n) => i.texto.includes(`"${n}"`))
    if (nomeCriado && (/foi ajustado\.$/.test(i.texto) || /reativad/.test(i.texto))) return false
    const k = `${i.data}|${i.texto}`
    if (vistos.has(k)) return false
    vistos.add(k)
    return true
  })
}

async function pullAccount(actId, token, since, until) {
  const out = []
  let path = `${actId}/activities`
  let params = {
    fields: 'event_time,event_type,object_id,object_name,object_type,extra_data,actor_name',
    since, until, limit: '500',
  }
  for (let page = 0; page < MAX_PAGES; page++) {
    const body = await graphGet(path, params, token)
    out.push(...(body.data || []))
    const next = body.paging?.next
    if (!next) break
    const u = new URL(next)
    path = u.pathname.replace(/^\/v[\d.]+\//, '')
    params = Object.fromEntries(u.searchParams)
    delete params.access_token
  }
  return out
}

export default async function handler(req) {
  const tokens = [
    process.env.META_TOKEN || process.env.META_ACCESS_TOKEN,
    process.env.META_TOKEN_CICAL,
    ...String(process.env.META_TOKENS_EXTRA || '').split(',').map((t) => t.trim()),
  ].filter(Boolean)
  if (!tokens.length) return jsonErr('Indisponível: META_TOKEN não configurada na Vercel.', 503)

  const auth = await getUser(req)
  if (!auth.ok) return jsonErr(auth.message, 401)

  const url = new URL(req.url)
  const names = (url.searchParams.get('accounts') || '').split('|').map((s) => s.trim()).filter(Boolean)
  const since = url.searchParams.get('since') || ''
  const until = url.searchParams.get('until') || ''
  if (!names.length) return jsonErr('Informe ?accounts=Nome1|Nome2.', 400)
  if (names.length > 10) return jsonErr('Máximo de 10 contas por chamada.', 400)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || !/^\d{4}-\d{2}-\d{2}$/.test(until)) return jsonErr('Informe since e until (AAAA-MM-DD).', 400)

  // nome → act_<id> (primeiro token que enxerga a conta vence)
  const resolved = new Map()
  for (const token of tokens) {
    let list = []
    try { list = await metaAccountsOfToken(token) } catch { continue }
    for (const a of list) {
      const key = normStr(a.name)
      if (!resolved.has(key)) resolved.set(key, { actId: `act_${a.account_id}`, token })
    }
  }

  const itens = []
  const accounts = []
  const warnings = []
  await Promise.all(names.map(async (name) => {
    const hit = resolved.get(normStr(name))
    if (!hit) { warnings.push(`Conta "${name}" não encontrada nos tokens do Meta.`); return }
    try {
      const ev = await pullAccount(hit.actId, hit.token, since, until)
      accounts.push(name)
      for (const i of traduzir(ev)) itens.push({ ...i, conta: name })
    } catch (e) {
      warnings.push(`${name}: ${e.message}`)
    }
  }))
  itens.sort((a, b) => (a.data < b.data ? 1 : -1))

  return new Response(JSON.stringify({ itens, accounts, warnings }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'private, max-age=120' },
  })
}
