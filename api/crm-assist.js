// Edge Function — a IA lê a documentação da API do CRM e propõe a configuração
// de integração (endpoint, headers e bodyTemplate com placeholders {{chave}}).
// Só o time autenticado pode chamar.
import { isAuthed } from './_crm.js'

export const config = { runtime: 'edge' }

const MODEL = 'claude-sonnet-4-5'
const DOCS_TIMEOUT_MS = 10000
const DOCS_MAX_CHARS = 60000

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json' },
  })
}

/** Busca a doc e reduz HTML a texto (heurística simples, suficiente para docs). */
async function fetchDocs(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), DOCS_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'RevenueLab-CRM-Assist' } })
    if (!res.ok) return { ok: false, error: `A doc respondeu ${res.status}.` }
    const html = await res.text()
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!text) return { ok: false, error: 'A página não retornou texto legível (pode exigir login/JS).' }
    return { ok: true, text: text.slice(0, DOCS_MAX_CHARS) }
  } catch (e) {
    const msg = e.name === 'AbortError' ? 'Timeout ao buscar a doc.' : `Falha ao buscar a doc: ${e.message}`
    return { ok: false, error: msg }
  } finally {
    clearTimeout(timer)
  }
}

const SYSTEM = `Você é um engenheiro de integrações. A partir da documentação de uma API de CRM, você monta a configuração de um POST que cria/insere um lead.

Responda APENAS com um objeto JSON válido, sem markdown, sem crases, sem texto fora do JSON, neste formato exato:
{
  "endpoint": "URL completa do POST que cria o lead",
  "method": "POST",
  "headers": [{ "key": "Authorization", "value": "Bearer <SUA_API_KEY>" }],
  "bodyTemplate": "string contendo um JSON com placeholders",
  "notas": "1-3 frases: o que o usuário precisa preencher/conferir"
}

Regras rígidas:
- "bodyTemplate" é uma STRING contendo JSON. Dentro dela, use placeholders no formato {{chave}} usando EXATAMENTE as chaves dos campos do banco que eu te passar. Ex: "{\\"name\\": \\"{{nome}}\\", \\"email\\": \\"{{email}}\\"}"
- Coloque cada placeholder de texto DENTRO de aspas no JSON. Só deixe sem aspas se o campo do CRM for numérico/booleano.
- NUNCA invente uma chave de API real. Para segredos use marcadores como <SUA_API_KEY> ou <SEU_TOKEN> no value do header.
- Só mapeie campos do CRM que existirem na documentação. Não invente campos do CRM.
- Se a documentação não trouxer o endpoint, deixe "endpoint" com o valor que o usuário informou (ou "" se não houver) e explique em "notas".
- Se algum campo obrigatório do CRM não tiver correspondente nos nossos campos, deixe um valor fixo sensato ou "" e avise em "notas".`

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  if (!(await isAuthed(req))) return json({ error: 'Não autorizado.' }, 401)

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY não configurada no servidor.' }, 500)

  let body
  try { body = await req.json() } catch { return json({ error: 'JSON inválido.' }, 400) }

  const { campos = [], endpoint = '', docsText = '', docsUrl = '' } = body

  // Junta a doc: texto colado + (opcional) conteúdo buscado do link.
  let docs = String(docsText || '').slice(0, DOCS_MAX_CHARS)
  let docsAviso = null
  if (docsUrl) {
    const fetched = await fetchDocs(docsUrl)
    if (fetched.ok) docs += `\n\n--- Conteúdo buscado de ${docsUrl} ---\n${fetched.text}`
    else docsAviso = fetched.error
  }
  if (!docs.trim()) {
    return json({ error: docsAviso || 'Cole o texto da documentação ou informe um link acessível.' }, 400)
  }

  const camposLista = campos.map((c) => `- {{${c.key}}} (${c.label || c.key}, tipo ${c.type || 'text'})`).join('\n')
  const userMsg = `Campos disponíveis no nosso banco de leads (use estas chaves nos placeholders):
${camposLista || '(nenhum campo definido)'}

${endpoint ? `Endpoint do CRM informado pelo usuário: ${endpoint}` : 'O usuário não informou o endpoint — extraia da documentação.'}

Documentação da API do CRM:
"""
${docs}
"""

Monte a configuração do POST que cria um lead nesse CRM.`

  let res
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: SYSTEM,
        messages: [{ role: 'user', content: userMsg }],
      }),
    })
  } catch (e) {
    return json({ error: `Falha ao chamar a IA: ${e.message}` }, 502)
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) return json({ error: data?.error?.message || `Erro ${res.status} na IA.` }, 502)

  const text = Array.isArray(data?.content) ? (data.content.find((b) => b.type === 'text')?.text || '') : ''
  // A IA às vezes envolve em ```json — limpamos antes do parse.
  const limpo = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()

  let cfg
  try { cfg = JSON.parse(limpo) } catch {
    return json({ error: 'A IA não devolveu um JSON válido. Tente colar um trecho mais específico da doc.', raw: limpo.slice(0, 1500) }, 422)
  }

  // Normaliza o formato esperado pelo front.
  const out = {
    endpoint: typeof cfg.endpoint === 'string' ? cfg.endpoint : endpoint,
    method: cfg.method || 'POST',
    headers: Array.isArray(cfg.headers) ? cfg.headers.filter((h) => h && h.key) : [],
    bodyTemplate: typeof cfg.bodyTemplate === 'string'
      ? cfg.bodyTemplate
      : JSON.stringify(cfg.bodyTemplate ?? {}, null, 2),
    notas: cfg.notas || '',
  }

  return json({ config: out, docsAviso })
}
