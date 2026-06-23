// Public Edge Function — recebe respostas do questionário público "Roteiros
// Express". Sem login: validado por um token de compartilhamento fixo + honeypot.
// Grava na tabela public.roteiros_express usando a service role.
export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

// Token do link público. Precisa ser o MESMO usado no front
// (src/pages/RoteirosExpressPublico.jsx → PUBLIC_TOKEN).
const PUBLIC_TOKEN = 'express-rl-9f3a'

// Chaves esperadas no questionário (5 produto + 5 cliente).
const REQUIRED_KEYS = ['p1', 'p2', 'p3', 'p4', 'p5', 'c1', 'c2', 'c3', 'c4', 'c5']

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey:         SERVICE_KEY,
      Authorization:  `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer:         opts.prefer || 'return=representation',
    },
  })
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch { data = text }
  return { data, status: res.status }
}

const clip = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'Servidor não configurado.' }, 500)

  let body
  try { body = await req.json() } catch { return json({ error: 'JSON inválido.' }, 400) }

  const { token, answers, nome, contato, website } = body || {}

  if (token !== PUBLIC_TOKEN) return json({ error: 'Link inválido.' }, 403)

  // Honeypot: bots preenchem campos ocultos. Responde "ok" sem gravar.
  if (website) return json({ success: true })

  if (!answers || typeof answers !== 'object') {
    return json({ error: 'Respostas ausentes.' }, 400)
  }

  // Todas as 10 perguntas precisam estar respondidas.
  const clean = {}
  for (const k of REQUIRED_KEYS) {
    const v = clip(answers[k], 1200)
    if (!v) return json({ error: 'Responda todas as perguntas.' }, 400)
    clean[k] = v
  }

  const row = {
    nome:    clip(nome, 160) || null,
    contato: clip(contato, 160) || null,
    answers: clean,
    status:  'novo',
    origem:  'link-publico',
  }

  const { status, data } = await sb('/roteiros_express', {
    method: 'POST',
    prefer: 'return=minimal',
    body: JSON.stringify(row),
  })

  if (status >= 400) return json({ error: 'Erro ao salvar.', detail: data }, 500)
  return json({ success: true })
}
