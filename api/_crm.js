// Helpers compartilhados do encaminhamento de leads para o CRM.
// Arquivos com prefixo "_" não viram rota na Vercel — são só módulos.

const TIMEOUT_MS = 8000

/**
 * Substitui {{chave}} pelos valores do lead, escapando para inserção segura
 * dentro de uma string JSON. O template é escrito pelo usuário/IA, ex:
 *   {"name": "{{nome}}", "email": "{{email}}", "score": {{score}}}
 * Chave ausente vira string vazia.
 */
export function renderTemplate(template, dados) {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const v = dados?.[key]
    if (v === undefined || v === null) return ''
    // JSON.stringify escapa aspas/barras/quebras; tiramos as aspas externas
    // para que o valor caia dentro das aspas que o template já tem.
    return JSON.stringify(String(v)).slice(1, -1)
  })
}

/** Renderiza e valida o corpo do request. */
export function buildBody(cfg, dados) {
  const raw = renderTemplate(cfg?.bodyTemplate, dados)
  try {
    return { ok: true, body: JSON.parse(raw), raw }
  } catch (e) {
    return { ok: false, error: `Template inválido após substituição: ${e.message}`, raw }
  }
}

/**
 * Envia o lead para o CRM. Nunca lança — sempre devolve um resultado
 * descritivo, para que a captura do lead jamais falhe por causa do CRM.
 */
export async function sendToCrm(cfg, dados) {
  if (!cfg?.endpoint) return { ok: false, status: 0, response: 'Endpoint do CRM não configurado.' }

  const built = buildBody(cfg, dados)
  if (!built.ok) return { ok: false, status: 0, response: built.error }

  const headers = { 'Content-Type': 'application/json' }
  for (const h of cfg.headers || []) {
    if (h?.key) headers[h.key] = h.value ?? ''
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(cfg.endpoint, {
      method: cfg.method || 'POST',
      headers,
      body: JSON.stringify(built.body),
      signal: ctrl.signal,
    })
    const text = (await res.text()).slice(0, 2000)
    return { ok: res.ok, status: res.status, response: text, sent: built.raw }
  } catch (e) {
    const msg = e.name === 'AbortError' ? `Timeout após ${TIMEOUT_MS}ms` : `Falha de rede: ${e.message}`
    return { ok: false, status: 0, response: msg, sent: built.raw }
  } finally {
    clearTimeout(timer)
  }
}

/** Valida o JWT do chamador contra o Supabase. Retorna true/false. */
export async function isAuthed(req) {
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY
  if (!SUPABASE_URL || !SUPABASE_ANON) return false
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return false
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON },
  })
  return res.ok
}
