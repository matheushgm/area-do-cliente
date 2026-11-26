// Portal do cliente / parceiro — /portal/:projectId
//
// Duas famílias de ações no mesmo endpoint:
//
//  Gestão (time logado, JWT do Supabase; admin ou membro do squad do projeto):
//    GET  ?action=list&projectId=…          → chaves do projeto (sem o hash)
//    POST { action:'save', projectId, id?, label, password?, enabled, permissions, expires_at }
//    POST { action:'delete', projectId, id }
//
//  Visitante (sem Supabase Auth):
//    POST { action:'login', projectId, password } → { token, label, permissions }
//    GET  ?action=data&projectId=…  (Authorization: Bearer <token>)
//         → { company, label, permissions, project, modules: { <id>: … } }
//    GET  ?action=file&projectId=…&bucket=…&path=…  → { url } (URL assinada, 1 h)
//
// Senha: hash keyed com o segredo do servidor (`v1$<salt>$<hmac>`), nunca sai
// do servidor. Token de sessão: payload base64url + HMAC, 7 dias, invalidado se
// a senha mudar ou a chave for desativada/expirar/excluída.
// Força bruta: 8 falhas por projeto+IP ou 60 por projeto em 15 min → 429.
//
// A tabela project_shares tem RLS sem policies: só esta função (chave de
// serviço) lê e escreve. Ver migration 090.
import { getUser, hmacHex, json, jsonErr, msg, sb, serviceKey, lerPaginado } from './_http.js'
import { tokenDashPortal } from './_dash_token.js'
import { sanitizePermissions } from '../src/lib/portalModules.js'
import { sanitizePlan } from './campanhas-public.js'
import { SESSION_TTL_MS, safeEq, hashVersion, isExpired, signSession, readPortalSession } from './_portal_auth.js'

export const config = { runtime: 'edge' }

const NO_STORE   = { 'Cache-Control': 'no-store' }
const WINDOW_MIN = 15
const MAX_FAILS_IP = 8
const MAX_FAILS_PROJECT = 60
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ok  = (body, status = 200) => json(body, status, NO_STORE)
const err = (message, status = 400, extra) => jsonErr(message, status, extra)

// ─── util ────────────────────────────────────────────────────────────────────
function clientIp(req) {
  const xf = req.headers.get('x-forwarded-for') || ''
  return (xf.split(',')[0] || req.headers.get('x-real-ip') || 'unknown').trim().slice(0, 64)
}
function enc(v) { return encodeURIComponent(v) }

async function hashPassword(secret, password, salt = crypto.randomUUID()) {
  const h = await hmacHex(secret, `portal|${salt}|${password}`)
  return `v1$${salt}$${h}`
}
async function verifyPassword(secret, stored, password) {
  const [v, salt, h] = String(stored || '').split('$')
  if (v !== 'v1' || !salt || !h) return false
  const calc = await hmacHex(secret, `portal|${salt}|${password}`)
  return safeEq(calc, h)
}

function publicShare(s) {
  const { password_hash, ...rest } = s // eslint-disable-line no-unused-vars
  return rest
}

// ─── acesso do time ao projeto (admin ou membro do squad) ───────────────────
async function canManage(user, projectId) {
  if (user?.app_metadata?.role === 'admin') return true
  const { data: rows } = await sb(`/projects_v2?id=eq.${enc(projectId)}&select=squad&limit=1`)
  const squad = rows?.[0]?.squad
  if (!squad) return false
  const { data: sq } = await sb(`/squads?id=eq.${enc(squad)}&select=members&limit=1`)
  return (sq?.[0]?.members || []).some((m) => m?.profile_id === user.id)
}

// ─── limite de tentativas ───────────────────────────────────────────────────
async function tooManyAttempts(projectId, ip) {
  const since = new Date(Date.now() - WINDOW_MIN * 60 * 1000).toISOString()
  const base = `/portal_login_attempts?project_id=eq.${enc(projectId)}&ok=is.false&at=gte.${enc(since)}&select=id`
  // Busca até o limite: se vierem `MAX` linhas, estourou.
  const [{ data: a }, { data: b }] = await Promise.all([
    sb(`${base}&ip=eq.${enc(ip)}&limit=${MAX_FAILS_IP}`),
    sb(`${base}&limit=${MAX_FAILS_PROJECT}`),
  ])
  return (Array.isArray(a) && a.length >= MAX_FAILS_IP) || (Array.isArray(b) && b.length >= MAX_FAILS_PROJECT)
}
async function recordAttempt(projectId, ip, okFlag) {
  await sb('/portal_login_attempts', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify({ project_id: projectId, ip, ok: okFlag }) })
  // Limpeza oportunista (1 em ~20 chamadas): apaga registros com mais de 1 dia.
  if (Math.random() < 0.05) {
    const old = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    await sb(`/portal_login_attempts?at=lt.${enc(old)}`, { method: 'DELETE', prefer: 'return=minimal' })
  }
}

// ─── carregadores por módulo (só os liberados) ──────────────────────────────
// Whitelist do que o portal pode ver de projects_v2 — nada de contrato, risco,
// churn, observações internas ou ids de integração.
const DADOS_COLS = [
  'company_name', 'business_type', 'segmento', 'responsible_name', 'responsible_role',
  'other_people', 'services', 'services_data', 'competitors', 'digital_maturity',
  'has_sales_team', 'logo_url', 'dashboard_url', 'created_at',
]

// ─── Dashboard de tráfego (contas vinculadas ao projeto) ─────────────────────
// Uma entrada por conta e canal com dado no rollup: o resumo do mês até hoje (o mesmo que
// o cliente vê no Gerenciador), o mesmo trecho do mês passado e um token de 24 h para o
// viewer em modo compartilhado (api/_dash_token.js). Contas ocultas ficam de fora.
const diaSP = (d = new Date()) => d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
function janelasDoMes(hoje = diaSP()) {
  const [a, m, d] = hoje.split('-').map(Number)
  const pad = (n) => String(n).padStart(2, '0')
  const ini = `${a}-${pad(m)}-01`
  const pa = m === 1 ? a - 1 : a, pm = m === 1 ? 12 : m - 1
  const diasPm = new Date(pa, pm, 0).getDate()
  return {
    hoje, ini,
    antIni: `${pa}-${pad(pm)}-01`,
    antFim: `${pa}-${pad(pm)}-${pad(Math.min(d, diasPm))}`,
  }
}
async function carregarDashboard(id) {
  const { data: contas } = await sb(`/dashboard_accounts?project_id=eq.${enc(id)}&select=account_name,hidden&order=account_name.asc`)
  const nomes = (Array.isArray(contas) ? contas : []).filter((c) => !c.hidden).map((c) => c.account_name).filter(Boolean)
  if (!nomes.length) return { contas: [] }
  const j = janelasDoMes()
  const lista = `(${nomes.map((n) => `"${String(n).replace(/"/g, '\\"')}"`).join(',')})`
  const key = serviceKey()
  const linhas = await lerPaginado(
    `${process.env.SUPABASE_URL}/rest/v1/dash_daily?account=in.${enc(lista)}&day=gte.${j.antIni}&select=channel,account,day,campaign,spend,conv,clicks,impressions&order=channel.asc,account.asc,day.asc,campaign.asc`,
    { apikey: key, Authorization: `Bearer ${key}` },
    { rotulo: 'portal-dash' },
  ).catch(() => [])
  // Canais de cada conta: o que aparece no rollup desde o começo do mês passado.
  const canais = new Map()
  for (const nome of nomes) {
    for (const canal of ['meta', 'google']) {
      const tem = linhas.some((l) => l.account === nome && l.channel === canal)
      if (tem) canais.set(`${canal}|${nome}`, { conta: nome, canal })
    }
  }
  // Conta parada há mais de um mês: busca o último dia gravado, para ela não sumir do portal.
  const semDado = nomes.filter((nome) => !['meta', 'google'].some((canal) => canais.has(`${canal}|${nome}`)))
  const extras = await Promise.all(semDado.flatMap((nome) => ['meta', 'google'].map(async (canal) => {
    const { data } = await sb(`/dash_daily?channel=eq.${canal}&account=eq.${enc(nome)}&select=day&order=day.desc&limit=1`)
    return Array.isArray(data) && data.length ? { conta: nome, canal, ultimoDia: data[0].day } : null
  })))
  for (const x of extras.filter(Boolean)) canais.set(`${x.canal}|${x.conta}`, x)
  const vazio = () => ({ investimento: 0, conversoes: 0, cliques: 0, impressoes: 0 })
  const somar = (alvo, l) => {
    alvo.investimento += Number(l.spend) || 0
    alvo.conversoes += Number(l.conv) || 0
    alvo.cliques += Number(l.clicks) || 0
    alvo.impressoes += Number(l.impressions) || 0
  }
  const out = []
  for (const c of canais.values()) {
    const doCanal = linhas.filter((l) => l.account === c.conta && l.channel === c.canal)
    const mes = vazio(), anterior = vazio()
    const porDia = {}
    let ultimoDia = c.ultimoDia || null
    for (const l of doCanal) {
      if (!ultimoDia || l.day > ultimoDia) ultimoDia = l.day
      if (l.day >= j.ini && l.day <= j.hoje) {
        somar(mes, l)
        const dd = (porDia[l.day] ||= { investimento: 0, conversoes: 0 })
        dd.investimento += Number(l.spend) || 0
        dd.conversoes += Number(l.conv) || 0
      } else if (l.day >= j.antIni && l.day <= j.antFim) somar(anterior, l)
    }
    out.push({
      conta: c.conta, canal: c.canal, ultimoDia,
      mes, anterior,
      diario: Object.entries(porDia).sort(([a], [b]) => a.localeCompare(b)).map(([dia, v]) => ({ dia, ...v })),
      token: await tokenDashPortal(c.conta, c.canal),
    })
  }
  out.sort((a, b) => b.mes.investimento - a.mes.investimento || a.conta.localeCompare(b.conta))
  return { contas: out, periodo: { de: j.ini, ate: j.hoje, anteriorDe: j.antIni, anteriorAte: j.antFim } }
}

const LOADERS = {
  dados: async (id, row) => Object.fromEntries(DADOS_COLS.map((c) => [c, row[c] ?? null])),
  dashboard: async (id) => carregarDashboard(id),
  kickoff: async (id, row) => row.kickoff ?? null,
  // debriefing: a Central de anúncios do portal busca o que precisa nas APIs de aprovação
  // (api/anuncios-aprovacao.js e api/copy-aprovacao.js), que só devolvem o que o cliente vê.
  lpcentral: async (id, row) => row.lp_central ?? null,
  links: async (id, row) => row.links ?? {},
  metalab: async (id, row) => ({ budget: row.meta_lab_budget ?? null, audienceType: row.meta_lab_audience_type ?? null }),
  produtos: async (id) => {
    const { data } = await sb(`/produtos?project_id=eq.${enc(id)}&select=id,nome,tipo,answers,summary,created_at&order=created_at.asc`)
    return Array.isArray(data) ? data : []
  },
  icp: async (id) => {
    const { data } = await sb(`/personas?project_id=eq.${enc(id)}&select=id,name,answers,generated_content,created_at&order=created_at.asc`)
    return (Array.isArray(data) ? data : []).map((p) => ({ id: p.id, name: p.name, answers: p.answers || {}, generatedProfile: p.generated_content ?? null }))
  },
  oferta: async (id) => {
    const { data } = await sb(`/ofertas?project_id=eq.${enc(id)}&select=id,answers,generated_content,created_at&order=created_at.asc`)
    return (Array.isArray(data) ? data : []).map((o) => ({
      ...(o.answers && typeof o.answers === 'object' ? o.answers : {}),
      id: o.id, generatedOffer: o.generated_content ?? null, createdAt: o.created_at,
    }))
  },
  roi: async (id, row) => {
    const { data } = await sb(`/roi_calculators?project_id=eq.${enc(id)}&select=*&order=created_at.asc&limit=1`)
    const r = Array.isArray(data) ? data[0] : null
    return { calc: r || null, result: r?.result ?? null, cenarios: row.roi_cenarios ?? null }
  },
  campaign: async (id) => {
    const { data } = await sb(`/campaign_plans?project_id=eq.${enc(id)}&select=id,name,answers,created_at&order=created_at.desc&limit=1`)
    const r = Array.isArray(data) ? data[0] : null
    return r ? { name: r.name, ...(sanitizePlan(r.answers) || { startDate: null, endDate: null, accounts: [] }) } : null
  },
  landingpage: async (id) => {
    const { data } = await sb(`/landing_pages?project_id=eq.${enc(id)}&select=id,answers,generated_content,generated_at,rating&order=generated_at.desc`)
    return (Array.isArray(data) ? data : []).map((lp) => ({ id: lp.id, ...(lp.answers && typeof lp.answers === 'object' ? lp.answers : {}), content: lp.generated_content ?? null, createdAt: lp.generated_at, rating: lp.rating ?? null }))
  },
  googleads: async (id) => {
    const { data } = await sb(`/google_ads?project_id=eq.${enc(id)}&select=id,answers,generated_content,generated_at,rating,created_at&order=created_at.desc`)
    return (Array.isArray(data) ? data : [])
      .map((g) => ({ id: g.id, ...(g.answers && typeof g.answers === 'object' ? g.answers : {}), content: g.generated_content ?? null, createdAt: g.generated_at ?? g.created_at, rating: g.rating ?? null }))
      .filter((g) => !g.isDraft)
  },
  estrategiav2: async (id) => {
    const { data } = await sb(`/estrategia_v2?project_id=eq.${enc(id)}&select=*&limit=1`)
    return Array.isArray(data) ? data[0] ?? null : null
  },
  resultados: async (id) => {
    const { data } = await sb(`/resultados?project_id=eq.${enc(id)}&select=data&limit=1`)
    return Array.isArray(data) ? data[0]?.data ?? {} : {}
  },
  nps: async (id) => {
    const { data } = await sb(`/nps_marcos?project_id=eq.${enc(id)}&select=id,label,descricao,ordem,due_at,nps_respostas(id,score,nome,q2,q3,q4,q5,q6,submitted_at)&order=ordem.asc`)
    // Sem e-mail/telefone dos respondentes.
    return (Array.isArray(data) ? data : []).map((m) => ({
      id: m.id, label: m.label, descricao: m.descricao, ordem: m.ordem, dueAt: m.due_at,
      respostas: (m.nps_respostas || []).map((r) => ({ id: r.id, score: r.score, name: r.nome, q2: r.q2, q3: r.q3, q4: r.q4, q5: r.q5, q6: r.q6, submittedAt: r.submitted_at })),
    }))
  },
  atas: async (id) => {
    const { data } = await sb(`/meeting_minutes?project_id=eq.${enc(id)}&select=*&order=created_at.desc`)
    return Array.isArray(data) ? data : []
  },
  anexos: async (id) => {
    const { data } = await sb(`/attachments?project_id=eq.${enc(id)}&select=*&order=uploaded_at.desc`)
    return Array.isArray(data) ? data : []
  },
}

// bucket → módulos que liberam assinar arquivos dele (basta um)
const FILE_BUCKETS = {
  'attachments':  ['anexos', 'debriefing'], // anexos avulsos + peças da Central de anúncios
  'project-docs': ['dados'],
  'brand-logos':  ['dados'],
}

// ─── handler ────────────────────────────────────────────────────────────────
export default async function handler(req) {
  const SECRET = serviceKey()
  if (!process.env.SUPABASE_URL || !SECRET) return err(msg(req, { pt: 'Servidor não configurado.', en: 'Server not configured.' }), 500)

  const url = new URL(req.url)
  let body = {}
  if (req.method === 'POST') {
    try { body = await req.json() } catch { return err(msg(req, { pt: 'JSON inválido.', en: 'Invalid JSON.' }), 400) }
  } else if (req.method !== 'GET') {
    return err(msg(req, { pt: 'Método não permitido.', en: 'Method not allowed.' }), 405)
  }
  const action    = String(body.action || url.searchParams.get('action') || '')
  const projectId = String(body.projectId || url.searchParams.get('projectId') || '').trim()
  if (!UUID_RE.test(projectId)) return err(msg(req, { pt: 'projectId inválido.', en: 'Invalid projectId.' }), 400)

  // ── Gestão (JWT) ──────────────────────────────────────────────────────────
  if (action === 'list' || action === 'save' || action === 'delete') {
    const auth = await getUser(req)
    if (!auth.ok) return err(auth.message, 401)
    if (!(await canManage(auth.user, projectId))) return err(msg(req, { pt: 'Sem acesso a este projeto.', en: 'You don\'t have access to this project.' }), 403)

    if (action === 'list') {
      const { data } = await sb(`/project_shares?project_id=eq.${enc(projectId)}&select=*&order=created_at.asc`)
      return ok({ shares: (Array.isArray(data) ? data : []).map(publicShare) })
    }

    if (action === 'delete') {
      if (!UUID_RE.test(String(body.id || ''))) return err(msg(req, { pt: 'id inválido.', en: 'Invalid id.' }), 400)
      const r = await sb(`/project_shares?id=eq.${enc(body.id)}&project_id=eq.${enc(projectId)}`, { method: 'DELETE', prefer: 'return=minimal' })
      if (!r.ok) return err(msg(req, { pt: 'Falha ao excluir.', en: 'Could not delete.' }), 500)
      return ok({ ok: true })
    }

    // save
    const patch = {}
    if (body.label !== undefined) {
      const label = String(body.label || '').trim().slice(0, 80)
      if (!label) return err(msg(req, { pt: 'Nome da chave obrigatório.', en: 'A key name is required.' }), 400)
      patch.label = label
    }
    if (body.enabled !== undefined) patch.enabled = !!body.enabled
    if (body.permissions !== undefined) patch.permissions = sanitizePermissions(body.permissions)
    if (body.expires_at !== undefined) {
      if (body.expires_at === null || body.expires_at === '') patch.expires_at = null
      else {
        const d = new Date(body.expires_at)
        if (isNaN(d)) return err(msg(req, { pt: 'Validade inválida.', en: 'Invalid expiration date.' }), 400)
        patch.expires_at = d.toISOString()
      }
    }
    if (body.password !== undefined && body.password !== null && body.password !== '') {
      const pwd = String(body.password)
      if (pwd.length < 6 || pwd.length > 128) return err(msg(req, { pt: 'A senha precisa ter entre 6 e 128 caracteres.', en: 'The password must be 6 to 128 characters long.' }), 400)
      patch.password_hash = await hashPassword(SECRET, pwd)
    }

    if (body.id) {
      if (!UUID_RE.test(String(body.id))) return err(msg(req, { pt: 'id inválido.', en: 'Invalid id.' }), 400)
      const r = await sb(`/project_shares?id=eq.${enc(body.id)}&project_id=eq.${enc(projectId)}`, { method: 'PATCH', body: JSON.stringify(patch) })
      if (!r.ok || !Array.isArray(r.data) || !r.data.length) return err(msg(req, { pt: 'Chave não encontrada.', en: 'Key not found.' }), 404)
      return ok({ share: publicShare(r.data[0]) })
    }

    if (!patch.label) return err(msg(req, { pt: 'Nome da chave obrigatório.', en: 'A key name is required.' }), 400)
    if (!patch.password_hash) return err(msg(req, { pt: 'Senha obrigatória.', en: 'A password is required.' }), 400)
    const row = {
      project_id:  projectId,
      label:       patch.label,
      password_hash: patch.password_hash,
      enabled:     patch.enabled ?? true,
      permissions: patch.permissions ?? {},
      expires_at:  patch.expires_at ?? null,
      created_by:  auth.user?.id || null,
    }
    const r = await sb('/project_shares', { method: 'POST', body: JSON.stringify(row) })
    if (!r.ok || !Array.isArray(r.data) || !r.data.length) return err(msg(req, { pt: 'Falha ao criar a chave.', en: 'Could not create the key.' }), 500)
    return ok({ share: publicShare(r.data[0]) })
  }

  // ── Login do visitante ────────────────────────────────────────────────────
  if (action === 'login') {
    if (req.method !== 'POST') return err(msg(req, { pt: 'Método não permitido.', en: 'Method not allowed.' }), 405)
    const password = String(body.password || '')
    const ip = clientIp(req)
    if (!password) return err(msg(req, { pt: 'Senha obrigatória.', en: 'A password is required.' }), 400)
    if (await tooManyAttempts(projectId, ip)) return err(msg(req, { pt: 'Muitas tentativas. Tente mais tarde.', en: 'Too many attempts. Please try again later.' }), 429)

    const { data } = await sb(`/project_shares?project_id=eq.${enc(projectId)}&enabled=is.true&select=*`)
    const candidates = (Array.isArray(data) ? data : []).filter((s) => !isExpired(s))
    let match = null
    for (const s of candidates) {
      if (await verifyPassword(SECRET, s.password_hash, password)) { match = s; break }
    }
    await recordAttempt(projectId, ip, !!match)
    // 404 genérico quando não há chave nenhuma; 401 quando a senha não bate.
    if (!match) return err(candidates.length ? msg(req, { pt: 'Senha incorreta.', en: 'Wrong password.' }) : msg(req, { pt: 'Portal indisponível.', en: 'Portal unavailable.' }), candidates.length ? 401 : 404)

    await sb(`/project_shares?id=eq.${enc(match.id)}`, {
      method: 'PATCH', prefer: 'return=minimal',
      body: JSON.stringify({ last_access_at: new Date().toISOString(), access_count: (match.access_count || 0) + 1 }),
    })
    const token = await signSession(SECRET, { sid: match.id, pid: projectId, exp: Date.now() + SESSION_TTL_MS, hv: hashVersion(match.password_hash) })
    return ok({ token, label: match.label, permissions: match.permissions || {} })
  }

  // ── Sessão do visitante ───────────────────────────────────────────────────
  if (action === 'data' || action === 'file') {
    const sess = await readPortalSession(req, projectId)
    if (!sess.ok) return err(sess.message, sess.status)
    const { share, permissions } = sess

    if (action === 'file') {
      const bucket = String(url.searchParams.get('bucket') || '')
      const path   = String(url.searchParams.get('path') || '')
      const needed = FILE_BUCKETS[bucket]
      if (!needed || !needed.some((m) => permissions[m])) return err(msg(req, { pt: 'Sem acesso.', en: 'Access denied.' }), 403)
      if (!path.startsWith(`${projectId}/`) || path.includes('..')) return err(msg(req, { pt: 'Caminho inválido.', en: 'Invalid path.' }), 400)
      const r = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/sign/${bucket}/${path.split('/').map(enc).join('/')}`, {
        method: 'POST',
        headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'content-type': 'application/json' },
        body: JSON.stringify({ expiresIn: 3600 }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok || !j?.signedURL) return err(msg(req, { pt: 'Arquivo não encontrado.', en: 'File not found.' }), 404)
      return ok({ url: `${process.env.SUPABASE_URL}/storage/v1${j.signedURL}` })
    }

    const { data: prows } = await sb(`/projects_v2?id=eq.${enc(projectId)}&select=*&limit=1`)
    const row = Array.isArray(prows) ? prows[0] : null
    if (!row) return err(msg(req, { pt: 'Projeto não encontrado.', en: 'Project not found.' }), 404)

    const ids = Object.keys(permissions).filter((k) => LOADERS[k])
    const results = await Promise.all(ids.map((k) => LOADERS[k](projectId, row).catch((e) => { console.error(`[portal] ${k}:`, e?.message); return null })))
    const modules = Object.fromEntries(ids.map((k, i) => [k, results[i]]))

    return ok({
      company: row.company_name || '',
      label: share.label,
      permissions,
      project: { id: row.id, company_name: row.company_name, logo_url: row.logo_url || null, business_type: row.business_type || null, segmento: row.segmento || null },
      modules,
    })
  }

  return err(`${msg(req, { pt: 'Ação desconhecida', en: 'Unknown action' })}: ${action}`, 400)
}
