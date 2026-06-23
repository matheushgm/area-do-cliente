// Public Edge Function — questionário público "Roteiros Express".
// Sem login: validado por um token de compartilhamento fixo.
//   action=submit       → grava as respostas (service role) e devolve o id
//   action=generate     → gera 2 roteiros com a IA (stream SSE), a partir da linha do banco
//   action=refine       → refina 1 roteiro (stream SSE); limite de 1x por roteiro (server-side)
//   action=save-scripts → persiste os roteiros gerados/refinados na linha
export const config = { runtime: 'edge' }

const SUPABASE_URL  = process.env.SUPABASE_URL
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY

// Precisa ser igual ao usado no front (src/lib/roteirosExpress.js → PUBLIC_TOKEN).
const PUBLIC_TOKEN = 'express-rl-9f3a'
const MODEL = 'claude-sonnet-4-5'
const SPLIT = '[[ROTEIRO]]'

const REQUIRED_KEYS = ['p1', 'p2', 'p3', 'p4', 'p5', 'c1', 'c2', 'c3', 'c4', 'c5']
const QLABEL = {
  p1: 'O que vende:', p2: 'Maior transformação:', p3: 'Diferencial:',
  p4: 'Oferta/condição:', p5: 'Ação desejada (CTA):',
  c1: 'Cliente ideal:', c2: 'Maior dor:', c3: 'Maior sonho:',
  c4: 'Objeção/medo:', c5: 'Como costuma comprar:',
}

const SYSTEM_GERAR = `Você é um especialista em roteiros de vídeos de anúncios online de alta conversão, usando a estrutura do Laboratório de Anúncios (Revenue Lab). Os vídeos têm 30 a 60 segundos e rodam no Meta Ads (Reels/Feed) e YouTube Ads.

A partir das informações de produto e de cliente fornecidas, crie EXATAMENTE 2 roteiros de vídeo altamente persuasivos, prontos para o cliente usar como anúncio. Use ganchos e etapas de funil DIFERENTES entre os dois (ex.: um para quem ainda não tem consciência do problema e outro para quem já busca uma solução).

Cada roteiro segue a ESTRUTURA DO LABORATÓRIO DE ANÚNCIOS (4 etapas):

## ROTEIRO [N]: Gancho [Tipo] | [Etapa do Funil]

**GANCHO (0s - 3s):**
[frase exata, disruptiva e contra-intuitiva, que para o scroll nos 3 primeiros segundos e conversa direto com o público]

**MENSAGEM (3s - 45s):**
[narração que leva o público do Ponto A ao Ponto B, mostrando o sonho, reduzindo a percepção de dificuldade, o tempo e o sacrifício para alcançá-lo. Integre a quebra das objeções de forma natural, nunca como um bloco separado]

**CTA FINAL (45s - 60s):**
[reforça a promessa do gancho + um motivo claro de urgência ou escassez + a ação exata que a pessoa deve tomar]

**📝 LEGENDA DO POST:** [legenda curta com emojis para acompanhar o vídeo]

Regras críticas:
- O GANCHO precisa quebrar o padrão nos PRIMEIROS 3 SEGUNDOS. Seja contra-intuitivo e específico ao público.
- A quebra de objeções deve estar INTEGRADA à mensagem, nunca isolada.
- O CTA deve reforçar a promessa e ter um gatilho de urgência ou escassez específico.
- Português brasileiro conversacional, direto e energético. Fale com "você".
- Seja específico ao negócio informado, nunca genérico.
- NÃO use travessões (—) em nenhuma parte do roteiro.
- NÃO inclua sugestões de cena ou direção visual.
- NÃO use emojis no corpo do roteiro — use emojis apenas na LEGENDA DO POST.
- Gere APENAS os 2 roteiros, sem introdução, sem tabelas e sem comentários ao final.
- Separe os 2 roteiros com uma linha contendo exatamente: ${SPLIT}`

const SYSTEM_REFINAR = `Você é um especialista em roteiros de vídeos de anúncios de alta conversão (Laboratório de Anúncios / Revenue Lab).

Você vai receber um roteiro já pronto e um pedido de ajuste do usuário. Reescreva o roteiro COMPLETO aplicando o pedido, mantendo a mesma estrutura:

## ROTEIRO: Gancho [Tipo] | [Etapa do Funil]
**GANCHO (0s - 3s):** ...
**MENSAGEM (3s - 45s):** ...
**CTA FINAL (45s - 60s):** ...
**📝 LEGENDA DO POST:** ...

Regras:
- Mantenha o gancho forte nos 3 primeiros segundos e a quebra de objeções integrada à mensagem.
- Português brasileiro conversacional, persuasivo e específico ao negócio.
- NÃO use travessões (—). NÃO inclua sugestões de cena. Emojis apenas na legenda.
- Devolva APENAS o roteiro reescrito, sem comentários antes ou depois.`

function buildBrief(answers) {
  const linhas = REQUIRED_KEYS.map((k) => `- ${QLABEL[k]} ${answers?.[k] || '(não informado)'}`).join('\n')
  return `Informações do negócio:\n${linhas}\n\nCom base nisso, gere os 2 roteiros de vídeo seguindo a estrutura do Laboratório de Anúncios.`
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' },
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

async function anthropicSSE(system, messages, maxTokens) {
  if (!ANTHROPIC_KEY) return json({ error: 'IA não configurada no servidor.' }, 500)
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages, stream: true }),
  })
  return new Response(r.body, {
    status: r.status,
    headers: {
      'content-type': r.headers.get('content-type') || 'text/event-stream',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

async function loadRow(id) {
  if (!id) return null
  const { data } = await sb(`/roteiros_express?id=eq.${encodeURIComponent(id)}&select=id,answers,scripts&limit=1`)
  return Array.isArray(data) && data[0] ? data[0] : null
}

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

  const action = body?.action || 'submit'
  if (body?.token !== PUBLIC_TOKEN) return json({ error: 'Link inválido.' }, 403)

  // ── submit: grava as respostas ─────────────────────────────────────────────
  if (action === 'submit') {
    if (body.website) return json({ success: true, id: null }) // honeypot

    const answers = body.answers
    if (!answers || typeof answers !== 'object') return json({ error: 'Respostas ausentes.' }, 400)

    const clean = {}
    for (const k of REQUIRED_KEYS) {
      const v = clip(answers[k], 1200)
      if (!v) return json({ error: 'Responda todas as perguntas.' }, 400)
      clean[k] = v
    }

    const row = {
      nome:    clip(body.nome, 160) || null,
      contato: clip(body.contato, 160) || null,
      answers: clean,
      status:  'novo',
      origem:  'link-publico',
    }
    const { status, data } = await sb('/roteiros_express', { method: 'POST', body: JSON.stringify(row) })
    if (status >= 400) return json({ error: 'Erro ao salvar.', detail: data }, 500)
    return json({ success: true, id: Array.isArray(data) && data[0] ? data[0].id : null })
  }

  // ── generate: cria os 2 roteiros a partir da linha salva ───────────────────
  if (action === 'generate') {
    const row = await loadRow(body.id)
    if (!row) return json({ error: 'Cadastro não encontrado.' }, 404)
    return anthropicSSE(SYSTEM_GERAR, [{ role: 'user', content: buildBrief(row.answers) }], 8000)
  }

  // ── refine: refina 1 roteiro (1x por roteiro, enforced no servidor) ────────
  if (action === 'refine') {
    const { id, index, note } = body
    const row = await loadRow(id)
    if (!row) return json({ error: 'Cadastro não encontrado.' }, 404)
    const scripts = Array.isArray(row.scripts) ? row.scripts : []
    const sc = scripts[index]
    if (!sc || !sc.content) return json({ error: 'Roteiro não encontrado.' }, 400)
    if (sc.refineUsed) return json({ error: 'Este roteiro já foi refinado.' }, 403)
    const cleanNote = clip(note, 800)
    if (!cleanNote) return json({ error: 'Descreva o ajuste desejado.' }, 400)

    // Marca como refinado já (consome o refino mesmo se o cliente não salvar depois).
    const updated = scripts.map((s, i) => (i === index ? { ...s, refineUsed: true } : s))
    await sb(`/roteiros_express?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ scripts: updated }),
    })

    const userMsg = `## ROTEIRO ORIGINAL\n\n${sc.content}\n\n## PEDIDO DE REFINAMENTO\n\n${cleanNote}`
    return anthropicSSE(SYSTEM_REFINAR, [{ role: 'user', content: userMsg }], 4000)
  }

  // ── save-scripts: persiste os roteiros (após o stream terminar no cliente) ──
  if (action === 'save-scripts') {
    const { id, scripts } = body
    if (!id || !Array.isArray(scripts)) return json({ error: 'Dados incompletos.' }, 400)
    const safe = scripts.slice(0, 2).map((s) => ({
      content: clip(s?.content, 8000),
      refineUsed: !!s?.refineUsed,
    }))
    const { status, data } = await sb(`/roteiros_express?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH', prefer: 'return=minimal',
      body: JSON.stringify({ scripts: safe, status: 'gerado' }),
    })
    if (status >= 400) return json({ error: 'Erro ao salvar roteiros.', detail: data }, 500)
    return json({ success: true })
  }

  return json({ error: 'Ação desconhecida.' }, 400)
}
