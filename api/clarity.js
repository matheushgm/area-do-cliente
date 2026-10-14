import { createClient } from '@supabase/supabase-js'
import { bearer, getUser } from './_http.js'
// Serverless Function (Node) — integração com o Microsoft Clarity.
//
//   GET  /api/clarity?project_id=<uuid>   (JWT) estado da conexão + fotos dos últimos 30 dias
//   POST /api/clarity {action:'conectar', project_id, token}   valida o token e já guarda a 1ª foto
//   POST /api/clarity {action:'sync', project_id}              atualiza só a dimensão URL (1 chamada)
//   POST /api/clarity {action:'desconectar', project_id}
//   GET  /api/clarity   (Authorization: Bearer <CRON_SECRET>)  rotina diária: todas as conexões, 4 dimensões
//
// A API de exportação do Clarity: 10 chamadas/dia por projeto, até 3 dias, até 3
// dimensões por chamada. A rotina diária gasta 4; o botão "Atualizar" gasta 1 e
// o contador chamadas_hoje trava em 9 para sempre sobrar margem. O token nunca
// sai do servidor.
export const config = { maxDuration: 60 }

const CLARITY = 'https://www.clarity.ms/export-data/api/v1/project-live-insights'
const LIMITE_DIA = 9

// Cada dimensão guardada = um conjunto de dimensões do Clarity (máx. 3).
const DIMENSOES = {
  url: ['URL'],
  device: ['Device'],
  origem: ['Source', 'Medium'],
  campanha: ['Campaign'],
}

function envClean(name) {
  return String(process.env[name] || '').replace(/\\n/g, '').trim()
}

function hojeBRT() {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)
}

async function chamarClarity(token, dims) {
  const qs = new URLSearchParams({ numOfDays: '1' })
  dims.forEach((d, i) => qs.set(`dimension${i + 1}`, d))
  const res = await fetch(`${CLARITY}?${qs}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  if (res.status === 401 || res.status === 403) throw Object.assign(new Error('Token do Clarity inválido ou sem permissão de exportação.'), { status: 400 })
  if (res.status === 429) throw Object.assign(new Error('Limite diário de 10 chamadas do Clarity atingido. Tente amanhã.'), { status: 429 })
  if (!res.ok) throw Object.assign(new Error(`Clarity respondeu ${res.status}.`), { status: 502 })
  const json = await res.json().catch(() => null)
  if (!Array.isArray(json)) throw Object.assign(new Error('Resposta inesperada do Clarity.'), { status: 502 })
  return json
}

// Coleta as dimensões pedidas, respeitando o teto diário. Devolve { feitas, erro }.
async function coletar(sb, conn, nomes) {
  const hoje = hojeBRT()
  let usadas = conn.chamadas_dia === hoje ? conn.chamadas_hoje : 0
  const feitas = []
  let erro = null
  for (const nome of nomes) {
    if (usadas >= LIMITE_DIA) { erro = 'Teto diário de chamadas ao Clarity atingido; o resto fica para amanhã.'; break }
    try {
      const dados = await chamarClarity(conn.api_token, DIMENSOES[nome])
      usadas++
      const { error } = await sb.from('clarity_snapshots').upsert({
        project_id: conn.project_id, dia: hoje, dimensao: nome, dados, coletado_em: new Date().toISOString(),
      })
      if (error) throw new Error(error.message)
      feitas.push(nome)
    } catch (e) {
      usadas++
      erro = e.message
      if (e.status === 400 || e.status === 429) break
    }
  }
  await sb.from('clarity_conexoes').update({
    ultimo_sync: new Date().toISOString(), ultimo_erro: erro, chamadas_dia: hoje, chamadas_hoje: usadas,
  }).eq('project_id', conn.project_id)
  return { feitas, erro }
}

async function estado(sb, projectId) {
  const { data: conn } = await sb.from('clarity_conexoes').select('project_id, ativo, ultimo_sync, ultimo_erro, chamadas_dia, chamadas_hoje').eq('project_id', projectId).maybeSingle()
  if (!conn) return { conectado: false, snapshots: [] }
  const desde = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const { data: snapshots } = await sb.from('clarity_snapshots').select('dia, dimensao, dados, coletado_em').eq('project_id', projectId).gte('dia', desde).order('dia', { ascending: false })
  const hoje = hojeBRT()
  return {
    conectado: true,
    ativo: conn.ativo,
    ultimo_sync: conn.ultimo_sync,
    ultimo_erro: conn.ultimo_erro,
    chamadas_restantes: Math.max(0, LIMITE_DIA - (conn.chamadas_dia === hoje ? conn.chamadas_hoje : 0)),
    snapshots: snapshots || [],
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: { message: 'Método não permitido.' } })
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: { message: 'Servidor não configurado.' } })
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  const tok = bearer(req)
  const cron = envClean('CRON_SECRET')
  const viaCron = !!(cron && tok && tok === cron)
  if (!viaCron) {
    const auth = await getUser(req)
    if (!auth.ok) return res.status(401).json({ error: { message: 'Não autorizado.' } })
  }

  const body = req.method === 'POST' ? (req.body || {}) : {}
  const projectId = body.project_id || req.query?.project_id

  // ── Rotina diária: todas as conexões ativas ───────────────────────────────
  if (viaCron && !projectId) {
    const { data: conns } = await sb.from('clarity_conexoes').select('*').eq('ativo', true)
    const resumo = []
    for (const c of conns || []) {
      const r = await coletar(sb, c, Object.keys(DIMENSOES))
      resumo.push({ project_id: c.project_id, ...r })
    }
    return res.status(200).json({ ok: true, resumo })
  }

  if (!projectId) return res.status(400).json({ error: { message: 'project_id obrigatório.' } })

  if (req.method === 'GET') return res.status(200).json(await estado(sb, projectId))

  const action = body.action
  if (action === 'conectar') {
    const token = String(body.token || '').trim()
    if (token.length < 40) return res.status(400).json({ error: { message: 'Cole o token completo da API do Clarity.' } })
    const conn = { project_id: projectId, api_token: token, chamadas_dia: hojeBRT(), chamadas_hoje: 0 }
    // Valida o token com uma chamada real e já guarda a foto de URL.
    try {
      const dados = await chamarClarity(token, DIMENSOES.url)
      const { error: e1 } = await sb.from('clarity_conexoes').upsert({ ...conn, ativo: true, ultimo_sync: new Date().toISOString(), ultimo_erro: null, chamadas_hoje: 1 })
      if (e1) return res.status(500).json({ error: { message: e1.message } })
      await sb.from('clarity_snapshots').upsert({ project_id: projectId, dia: hojeBRT(), dimensao: 'url', dados, coletado_em: new Date().toISOString() })
    } catch (e) {
      return res.status(e.status || 500).json({ error: { message: e.message } })
    }
    return res.status(200).json(await estado(sb, projectId))
  }

  if (action === 'sync') {
    const { data: conn } = await sb.from('clarity_conexoes').select('*').eq('project_id', projectId).maybeSingle()
    if (!conn) return res.status(404).json({ error: { message: 'Clarity não conectado neste projeto.' } })
    const r = await coletar(sb, conn, ['url'])
    if (r.erro && !r.feitas.length) return res.status(429).json({ error: { message: r.erro } })
    return res.status(200).json(await estado(sb, projectId))
  }

  if (action === 'desconectar') {
    await sb.from('clarity_conexoes').delete().eq('project_id', projectId)
    return res.status(200).json({ conectado: false, snapshots: [] })
  }

  return res.status(400).json({ error: { message: 'Ação inválida.' } })
}
