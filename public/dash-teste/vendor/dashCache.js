// GERADO por scripts/sync-playbook-vendor.mjs a partir de src/lib/dashCache.js.
// NÃO EDITE AQUI: a alteração se perde na próxima geração. Edite o original.
// Cache local (IndexedDB) dos dados do Dashboard de Tráfego, com busca incremental.
//
// Sem dependências de propósito: o viewer (public/dash-teste/viewer.html) é HTML
// estático e usa uma cópia gerada por scripts/sync-playbook-vendor.mjs. Edite aqui.
//
// Como sabe o que mudou: o coletor (dashboard-api) reescreve em dash_insights os
// últimos 8 dias a cada rodada e, em seguida, recalcula o rollup dash_daily da
// MESMA faixa (refresh_dash_daily apaga e reinsere, então updated_at = agora). O
// rollup vira o relógio do canal: o maior updated_at diz se houve rodada nova desde
// a última leitura, e o menor `day` gravado depois disso diz a partir de que dia
// rebaixar. Os dias desde esse ponto são trocados INTEIROS no cache (o que some de
// lá também some aqui); os anteriores ficam como estavam. Não dá para usar o
// updated_at do dash_insights: o upsert do coletor não mexe nele, então linha que
// muda depois de inserida continua com a hora da inserção.
//
// Mesma origem = mesmo IndexedDB: a home, o /otimizacoes, a página do cliente e o
// viewer (inclusive dentro do iframe) compartilham as entradas. Uma entrada de
// "todas as contas" também serve a quem pede só algumas, recortada aqui.

const DB_NOME = 'rl_dash_cache'
const DB_VERSAO = 1
const MAX_ENTRADAS = 25
const RECARGA_COMPLETA_MS = 7 * 24 * 3600e3 // rede de segurança: baixa tudo de novo a cada 7 dias
const CHECAGEM_MS = 30e3                     // abaixo disso, nem pergunta ao banco se mudou

const COLUNA_DIA = { meta: 'Dia', google: 'Data' }

const isoHoje = () => new Date().toISOString().slice(0, 10)
const somaDias = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const diasEntre = (de, ate) => Math.round((Date.parse(ate + 'T00:00:00Z') - Date.parse(de + 'T00:00:00Z')) / 864e5)

// ─── IndexedDB (falha = segue só com a memória da página) ────────────────────
let dbPromise = null
function abrirDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NOME, DB_VERSAO)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('linhas')) db.createObjectStore('linhas', { keyPath: 'id' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch { resolve(null) }
  })
  return dbPromise
}

function tx(db, stores, modo, fn) {
  return new Promise((resolve) => {
    try {
      const t = db.transaction(stores, modo)
      const out = fn(t)
      t.oncomplete = () => resolve(out?.result ?? out)
      t.onerror = t.onabort = () => resolve(null)
    } catch { resolve(null) }
  })
}

async function lerIdb(store, id) {
  const db = await abrirDb(); if (!db) return null
  return tx(db, [store], 'readonly', (t) => t.objectStore(store).get(id))
}

async function gravarIdb(entrada) {
  const db = await abrirDb(); if (!db) return
  const { rows, ...meta } = entrada
  await tx(db, ['meta', 'linhas'], 'readwrite', (t) => {
    t.objectStore('meta').put(meta)
    t.objectStore('linhas').put({ id: meta.id, rows })
  })
  // Despejo: as menos usadas saem quando passa do teto.
  const todas = await tx(db, ['meta'], 'readonly', (t) => t.objectStore('meta').getAll())
  if (!todas || todas.length <= MAX_ENTRADAS) return
  const sobra = todas.sort((a, b) => a.usadoEm - b.usadoEm).slice(0, todas.length - MAX_ENTRADAS)
  await tx(db, ['meta', 'linhas'], 'readwrite', (t) => {
    for (const m of sobra) { t.objectStore('meta').delete(m.id); t.objectStore('linhas').delete(m.id); memoria.delete(m.id) }
  })
}

// Grava fora do caminho crítico: serializar dezenas de milhares de linhas trava a
// thread por algumas centenas de ms, e quem pediu os dados não precisa esperar.
const gravarDepois = (entrada) => setTimeout(() => { gravarIdb(entrada) }, 0)

// ─── Entradas ────────────────────────────────────────────────────────────────
// id = fonte|canal|contas (ordenadas) ou "*" para todas. A janela (`desde`, null =
// histórico inteiro) é atributo da entrada, não da chave: uma entrada com mais dias
// serve a quem pede menos.
const memoria = new Map()
const idDe = (fonte, canal, contas) => `${fonte}|${canal}|${contas ? contas.join('\u0001') : '*'}`
const cobre = (e, inicio) => e && (e.desde == null || (inicio != null && e.desde <= inicio))

async function carregarEntrada(id) {
  if (memoria.has(id)) return memoria.get(id)
  const meta = await lerIdb('meta', id)
  if (!meta) return null
  const linhas = await lerIdb('linhas', id)
  if (!linhas?.rows) return null
  const e = { ...meta, rows: linhas.rows, checadoEm: 0 }
  memoria.set(id, e)
  return e
}

// ─── Relógio do canal (rollup) ───────────────────────────────────────────────
const relogios = new Map() // canal → { em, promessa }
function sbGet(cfg, path) {
  return fetch(`${cfg.sbUrl}/rest/v1/${path}`, {
    headers: { apikey: cfg.sbKey, Authorization: `Bearer ${cfg.token}` },
    cache: 'no-store',
  }).then((r) => { if (!r.ok) throw new Error(`dash_daily: HTTP ${r.status}`); return r.json() })
}
// Maior updated_at do rollup do canal = carimbo da última rodada do coletor.
function versaoAtual(cfg, canal, fresco) {
  const c = relogios.get(canal)
  if (c && !fresco && Date.now() - c.em < CHECAGEM_MS) return c.promessa
  const promessa = sbGet(cfg, `dash_daily?channel=eq.${canal}&select=updated_at&order=updated_at.desc&limit=1`)
    .then((j) => j[0]?.updated_at || null)
  promessa.catch(() => relogios.delete(canal))
  relogios.set(canal, { em: Date.now(), promessa })
  return promessa
}
// Primeiro dia que o coletor regravou depois de `versao`.
function diaMaisAntigoDesde(cfg, canal, versao) {
  return sbGet(cfg, `dash_daily?channel=eq.${canal}&updated_at=gt.${encodeURIComponent(versao)}&select=day&order=day.asc&limit=1`)
    .then((j) => j[0]?.day || null)
}

// ─── Servidor ────────────────────────────────────────────────────────────────
async function baixar(cfg, fonte, canal, contas, dias) {
  const p = new URLSearchParams({ channel: canal })
  ;(contas || []).forEach((a) => p.append('account', a))
  if (dias) p.set('dias', String(dias))
  const r = await fetch(`/api/dash-${fonte}?${p}`, { headers: { Authorization: `Bearer ${cfg.token}` }, cache: 'no-store' })
  if (!r.ok) {
    const m = await r.clone().json().then((j) => j?.error?.message).catch(() => null)
    const e = new Error(`${canal}: HTTP ${r.status}${m ? ` — ${m}` : ''}`)
    e.status = r.status
    throw e
  }
  return cfg.parseCSV(await r.text())
}

async function carregarCompleta(cfg, fonte, canal, contas, dias, inicio) {
  // A versão é pedida ANTES dos dados (em paralelo, sem esperar): o que o coletor
  // gravar durante o download entra na próxima diferença em vez de se perder.
  const [versao, rows] = await Promise.all([
    versaoAtual(cfg, canal, true).catch(() => null),
    baixar(cfg, fonte, canal, contas, dias),
  ])
  const agora = Date.now()
  const e = { id: idDe(fonte, canal, contas), fonte, canal, contas, desde: inicio, versao, cheioEm: agora, usadoEm: agora, checadoEm: agora, rows }
  memoria.set(e.id, e)
  gravarDepois(e)
  return e
}

// Uma atualização por entrada de cada vez: pedidos com janelas diferentes podem cair
// na mesma entrada ao mesmo tempo (home + banner, hub + Funil).
const atualizando = new Map()
function atualizar(cfg, e, fresco) {
  if (!fresco && Date.now() - e.checadoEm < CHECAGEM_MS) return Promise.resolve(e)
  if (atualizando.has(e.id)) return atualizando.get(e.id)
  const p = aplicarDiferenca(cfg, e, fresco).finally(() => atualizando.delete(e.id))
  atualizando.set(e.id, p)
  return p
}

async function aplicarDiferenca(cfg, e, fresco) {
  const versao = await versaoAtual(cfg, e.canal, fresco)
  e.checadoEm = Date.now()
  if (!versao || (e.versao && versao <= e.versao)) return e
  const hoje = isoHoje()
  // Sem versão gravada (relógio falhou na carga) não dá para saber o que mudou:
  // rebaixa a janela que o coletor reescreve, com folga.
  let corte = e.versao ? await diaMaisAntigoDesde(cfg, e.canal, e.versao) : somaDias(hoje, -9)
  if (!corte) { e.versao = versao; return e }
  if (e.desde && corte < e.desde) corte = e.desde
  // `dias=0` o servidor lê como "sem janela", por isso o piso de 1 e o filtro abaixo.
  const delta = (await baixar(cfg, e.fonte, e.canal, e.contas, Math.max(1, diasEntre(corte, hoje))))
  const col = COLUNA_DIA[e.canal]
  const rows = e.rows.filter((r) => (r[col] || '') < corte)
  for (const r of delta) if ((r[col] || '') >= corte) rows.push(r)
  e.rows = rows
  e.versao = versao
  gravarDepois(e)
  return e
}

function recorte(e, contas, inicio) {
  const col = COLUNA_DIA[e.canal]
  const filtraConta = contas && !e.contas
  const ok = filtraConta ? new Set(contas.map((c) => c.trim())) : null
  const out = []
  for (const r of e.rows) {
    if (inicio && (r[col] || '') < inicio) continue
    if (ok && !ok.has((r['Nome da conta'] || '').trim())) continue
    out.push({ ...r }) // cópia: quem recebe pode mexer nas linhas (o viewer soma MQL)
  }
  return out
}

const emAndamento = new Map()

// Dono do cache = usuário do token (claim `sub`). A RLS de hoje deixa todo usuário
// logado ler tudo, mas o cache não deve depender disso nem só do botão Sair: se a
// sessão for de outra pessoa, tudo o que está guardado é descartado.
function usuarioDo(token) {
  try { return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub || null } catch { return null }
}
let donoConferido = null
async function conferirDono(uid) {
  if (donoConferido === uid) return
  const db = await abrirDb()
  const atual = db ? (await tx(db, ['meta'], 'readonly', (t) => t.objectStore('meta').get('__dono')))?.uid : null
  if (atual !== uid) {
    await limparCacheDash()
    const db2 = await abrirDb()
    if (db2) await tx(db2, ['meta'], 'readwrite', (t) => t.objectStore('meta').put({ id: '__dono', uid, usadoEm: Infinity }))
  }
  donoConferido = uid
}

// Linhas de /api/dash-data (fonte 'data') ou /api/dash-rollup (fonte 'rollup'), só
// meta e google, pelo cache. `dias` = mesma janela do servidor (null = histórico
// inteiro); `contas` = recorte por conta (null = todas). `fresco` ignora a espera
// de 30 s entre checagens (botão Atualizar). `cfg` = { token, sbUrl, sbKey, parseCSV }.
export async function lerDash({ fonte, canal, contas = null, dias = null, fresco = false, ...cfg }) {
  const uid = usuarioDo(cfg.token)
  if (!uid) throw Object.assign(new Error('Sessão inválida.'), { status: 401 })
  await conferirDono(uid)
  const lista = contas ? [...new Set(contas.map((c) => c.trim()).filter(Boolean))].sort() : null
  const inicio = dias ? somaDias(isoHoje(), -dias) : null
  const chave = `${idDe(fonte, canal, lista)}|${inicio}|${fresco}`
  if (emAndamento.has(chave)) return emAndamento.get(chave)
  const p = (async () => {
    const id = idDe(fonte, canal, lista)
    let e = await carregarEntrada(id)
    if (!cobre(e, inicio)) e = null
    if (!e && lista) {
      const geral = await carregarEntrada(idDe(fonte, canal, null))
      if (cobre(geral, inicio)) e = geral
    }
    if (!e || Date.now() - e.cheioEm > RECARGA_COMPLETA_MS) {
      e = await carregarCompleta(cfg, fonte, canal, lista, dias, inicio)
    } else {
      try { e = await atualizar(cfg, e, fresco) } catch (err) {
        // Sem rede ou sessão expirada: mostra o que já tem e tenta de novo na próxima.
        if (err?.status === 401) throw err
        console.warn('[dashCache] usando o cache sem atualizar:', err?.message || err)
      }
    }
    e.usadoEm = Date.now()
    return recorte(e, lista, inicio)
  })()
  emAndamento.set(chave, p)
  try { return await p } finally { emAndamento.delete(chave) }
}

// Logout: os dados de anúncio não podem ficar no navegador para o próximo usuário.
export async function limparCacheDash() {
  memoria.clear(); relogios.clear(); donoConferido = null
  const db = await abrirDb()
  if (db) await tx(db, ['meta', 'linhas'], 'readwrite', (t) => { t.objectStore('meta').clear(); t.objectStore('linhas').clear() })
}
