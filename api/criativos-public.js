// Public Edge Function — ferramenta pública "Criativos com IA" de um cliente.
// Sem login: validada por token HMAC (`projectId|senha`) gerado em
// api/criativos-share-token.js. O cliente digita a senha; o servidor recalcula
// o HMAC e compara. As prompts e o contexto do cliente ficam SOMENTE no servidor.
//
//   action=auth      → valida senha e devolve o contexto mínimo (empresa + dores)
//   action=generate  → gera criativos (estático ou vídeo) com a IA (stream SSE)
export const config = { runtime: 'edge' }

const SUPABASE_URL  = process.env.SUPABASE_URL
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = 'claude-sonnet-4-5'

// ─── Tipos de criativo (em sincronia com src/lib/criativosPublic.js) ──────────
const AD_TYPES = [
  { id: 'clickbait', label: 'Clickbait', emoji: '🎣', desc: 'Título altamente intrigante relacionado ao público-alvo' },
  { id: 'sensacao', label: 'Sensação', emoji: '⚡', desc: 'Criação de sensações fortes para envolver o público' },
  { id: 'mito', label: 'Mito', emoji: '🏛️', desc: 'Anúncio em torno de um mito ou história cativante' },
  { id: 'dilema', label: 'Dilema', emoji: '⚖️', desc: 'Destaca um dilema que ressoa com o público' },
  { id: 'prova', label: 'Prova', emoji: '✅', desc: 'Evidências sólidas, resultados ou testemunhos' },
  { id: 'contraste', label: 'Contraste', emoji: '🔄', desc: 'Situação contrastante para gerar impacto visual' },
  { id: 'visual', label: 'Visual', emoji: '👁️', desc: 'Orientado por elementos visuais impactantes' },
  { id: 'oportunidade', label: 'Oportunidade', emoji: '🚀', desc: 'A oportunidade como ponto focal da mensagem' },
  { id: 'historia', label: 'História', emoji: '📖', desc: 'Narrativa envolvente que conecta ao produto' },
  { id: 'certo_errado', label: 'Certo vs. Errado', emoji: '🎯', desc: 'Comparação entre práticas certas e erradas' },
  { id: 'demonstracao', label: 'Demonstração', emoji: '🎬', desc: 'Demonstração direta do produto ou serviço' },
  { id: 'ultra_segmentado', label: 'Ultra Segmentado', emoji: '🔍', desc: 'Altamente segmentado para um público específico' },
  { id: 'apelo_emocional', label: 'Apelo Emocional', emoji: '❤️', desc: 'Explora o apelo emocional do público-alvo' },
  { id: 'curiosidade', label: 'Curiosidade', emoji: '🤔', desc: 'Desperta a curiosidade irresistível do público' },
  { id: 'reflexao', label: 'Reflexão', emoji: '💭', desc: 'Provoca reflexão profunda no público' },
  { id: 'comparacao', label: 'Comparação', emoji: '📊', desc: 'Comparação relevante entre alternativas' },
  { id: 'problema_solucao', label: 'Problema e Solução', emoji: '🔧', desc: 'Apresenta um problema e revela a solução' },
  { id: 'explicacao', label: 'Explicação', emoji: '📋', desc: 'Explicação detalhada, educativa do produto/serviço' },
]
const AD_TYPE_MAP = Object.fromEntries(AD_TYPES.map((t) => [t.id, t]))

// ─── System prompts (metodologia Revenue Lab / Laboratório de Anúncios) ───────
const DORES_SYSTEM = `Você é um especialista em copywriting para anúncios estáticos em português brasileiro, usando a metodologia Revenue Lab / Laboratório de Anúncios.

Para cada combinação de dor + tipo de criativo, gere headlines e subheadlines com a metodologia ADIG:
- Anunciar o público-alvo
- Dar um objetivo / resultado
- Indicar um intervalo de tempo (quando houver)
- Garantia ou palavra forte

Cada variação deve contemplar os 4 elementos da fórmula de Alex Hormozi: resultado do sonho, percepção de alcance, tempo e esforço mínimo.

O tipo de criativo define o ÂNGULO das headlines:
- Prova: evidências, dados, depoimentos reais
- Mito: narrativa, história cativante
- Problema e Solução: enuncia o problema diretamente e revela a solução
- Clickbait: cria curiosidade irresistível
(use o ângulo do tipo indicado para orientar cada bloco)

Use as informações de público-alvo, personas e oferta fornecidas no contexto do cliente para personalizar ao máximo. Não gere análise de público — vá direto às headlines.

ESTRUTURA OBRIGATÓRIA — um bloco por combinação dor + tipo:

# DOR: [texto exato da dor] | [Emoji] [Nome do Tipo]

## Headlines:
- [Headline 1 — ideal 7 máx. 12 palavras]
- [Headline 2 — ideal 7 máx. 12 palavras]
(tantas quantas solicitadas para este bloco)

## Subheadlines:
- [Subheadline 1 — complementa a headline 1, máx. 20 palavras]
- [Subheadline 2 — complementa a headline 2, máx. 20 palavras]
(uma subheadline por headline)

---

Diretrizes:
- Gere EXATAMENTE um bloco separado por combinação dor + tipo — nunca agrupe tipos dentro de um mesmo bloco
- Português brasileiro coloquial e persuasivo — evite palavras que a IA usa mas que humanos não usam
- Use "você" diretamente
- Seja específico ao negócio, nunca genérico
- Não use travessões (—)
- Separe cada bloco com "---"`

const VIDEO_SYSTEM = `Você é um especialista em roteiros de vídeos de anúncios online de alta conversão, usando a estrutura do Laboratório de Anúncios (Revenue Lab).

Os vídeos têm duração entre 30 e 60 segundos e são criados para Meta Ads e YouTube Ads.

Use as informações de público-alvo, personas e oferta já fornecidas no contexto do cliente para personalizar cada roteiro. Não gere análise de público — vá direto aos roteiros.

Crie cada roteiro seguindo a ESTRUTURA DO LABORATÓRIO DE ANÚNCIOS (4 etapas):

## ROTEIRO [N]: Gancho: [Tipo] | [Etapa do Funil]

**GANCHO (0s – 3s):**
[frase exata: disruptiva, contra-intuitiva, que para o scroll]

**MENSAGEM (3s – 45s):**
[narração mostrando transformação do Ponto A → Ponto B, com quebra de objeção integrada naturalmente]

**CTA FINAL (45s – 60s)**
[reforça promessa + gatilho de escassez/urgência + ação clara]

**📝 LEGENDA DO POST:** [legenda com emojis]

---

Regras críticas:
- O GANCHO deve quebrar o padrão nos PRIMEIROS 3 SEGUNDOS. Seja contra-intuitivo
- A quebra de objeções deve estar INTEGRADA à mensagem (nunca separada)
- CTA com gatilho de escassez ou urgência específico
- Português brasileiro conversacional e energético
- Não use travessões (—) em nenhuma parte do output
- Não inclua sugestões de cena ou visual em nenhuma parte do roteiro
- Não use emojis no roteiro — use emojis apenas na LEGENDA DO POST
- Gere EXATAMENTE a quantidade indicada por tipo, na ordem listada
- Gere APENAS os roteiros — sem tabelas, sem resumos, sem insights ao final
- Separe cada roteiro com "---"`

// ─── Helpers de resposta ──────────────────────────────────────────────────────
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

async function hmacHex(secret, msg) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg))
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
}

function safeEq(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const clip = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

async function sb(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`, // service_role: bypassa RLS; filtramos por project_id
    },
  })
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch { data = null }
  return { data: Array.isArray(data) ? data : [], status: res.status }
}

// ─── Carrega o projeto + relações necessárias para o contexto ─────────────────
async function loadProject(projectId) {
  const id = encodeURIComponent(projectId)
  const [proj, personas, produtos, ofertas] = await Promise.all([
    sb(`/projects_v2?id=eq.${id}&select=company_name,business_type,segmento,competitors&limit=1`),
    sb(`/personas?project_id=eq.${id}&select=id,name,answers,generated_content`),
    sb(`/produtos?project_id=eq.${id}&select=id,nome,tipo,answers`),
    sb(`/ofertas?project_id=eq.${id}&select=answers,generated_content&limit=1`),
  ])
  const row = proj.data[0]
  if (!row) return null
  return {
    companyName: row.company_name,
    businessType: row.business_type,
    segmento: row.segmento,
    competitors: row.competitors || [],
    produtos: (produtos.data || []).map((p) => ({ id: p.id, nome: p.nome, tipo: p.tipo, answers: p.answers || {} })),
    personas: (personas.data || []).map((p) => ({
      id: p.id, name: p.name, answers: p.answers || {}, generatedProfile: p.generated_content ?? null,
    })),
    ofertaData: ofertas.data[0]
      ? { ...(typeof ofertas.data[0].answers === 'object' && ofertas.data[0].answers ? ofertas.data[0].answers : {}) }
      : null,
  }
}

// ─── Contexto do cliente em Markdown (espelha src/lib/buildContext.js) ─────────
const BTYPE = { b2b: 'B2B', local: 'Negócio Local', ecommerce: 'E-commerce', infoproduto: 'Infoproduto' }
const PRODUTO_LABELS = {
  q1: 'O que resolve', q2: 'Quando o cliente precisa', q3: 'Vida depois do produto',
  q4: 'Diferencial vs concorrente', q5: 'Por que comprar agora', q6: 'Vida sem o produto',
  q7: 'Objeções de compra', q8: 'Tentativas anteriores', q9: 'Por que desconfiam',
  q10: 'Cases / resultados mensuráveis', q11: 'Tempo para 1º resultado', q12: 'O que mais elogiam',
  q13: 'Diferencial único', q14: 'Custo de inação (3 meses)', q15: 'Sazonalidade / janela de oportunidade',
  q16: 'Garantia', q17: 'Se der errado',
}

function productBlock(produtos = []) {
  const list = (produtos || []).filter((p) => p.nome || p.answers)
  if (!list.length) return ''
  const lines = ['## PRODUTO / SERVIÇO']
  list.forEach((p) => {
    const tipoLabel = p.tipo === 'servico' ? 'Serviço' : 'Produto Físico'
    lines.push(`\n### ${p.nome || 'Produto Principal'} (${tipoLabel})`)
    const a = p.answers || {}
    Object.entries(PRODUTO_LABELS).forEach(([key, label]) => {
      if (a[key]?.trim?.()) lines.push(`${label}: ${a[key].trim()}`)
    })
  })
  return lines.join('\n')
}

function personaBlock(personas = []) {
  const list = (personas || []).filter((p) => p.name || p.answers)
  if (!list.length) return ''
  const lines = ['## PERSONAS / PÚBLICO-ALVO']
  list.forEach((p) => {
    lines.push(`\n### ${p.name || 'Persona Principal'}`)
    const a = p.answers || {}
    const pick = (k) => (Array.isArray(a[k]) ? a[k] : []).filter((s) => s?.trim?.()).slice(0, 4).join('; ')
    if (pick('resultado')) lines.push(`Resultado desejado: ${pick('resultado')}`)
    if (pick('sonhos')) lines.push(`Sonhos: ${pick('sonhos')}`)
    if (pick('objecoes')) lines.push(`Objeções: ${pick('objecoes')}`)
    if (pick('medos')) lines.push(`Medos: ${pick('medos')}`)
    if (pick('erros')) lines.push(`Erros comuns: ${pick('erros')}`)
  })
  return lines.join('\n')
}

function buildContext(project) {
  const lines = ['# CONTEXTO COMPLETO DO CLIENTE\n']
  lines.push(`## EMPRESA: ${project.companyName || 'Cliente'}`)
  if (project.businessType) lines.push(`Nicho/Tipo: ${BTYPE[project.businessType] || project.businessType}`)
  if (project.segmento) lines.push(`Segmento: ${project.segmento}`)
  if (project.productDescription) lines.push(`Produto/Serviço: ${project.productDescription}`)
  if (project.mainGoal) lines.push(`Objetivo: ${project.mainGoal}`)
  if (project.targetAudience) lines.push(`Público-Alvo: ${project.targetAudience}`)
  if (project.averageTicket) lines.push(`Ticket Médio: R$ ${project.averageTicket}`)
  const comps = (project.competitors || []).filter(Boolean)
  if (comps.length) lines.push(`Concorrentes: ${comps.join(', ')}`)

  const pb = productBlock(project.produtos)
  if (pb) lines.push('\n' + pb)
  const pe = personaBlock(project.personas)
  if (pe) lines.push('\n' + pe)

  const o = project.ofertaData
  if (o && (o.nome || o.resultadoSonho)) {
    lines.push('\n## OFERTA')
    if (o.nome) lines.push(`Nome: ${o.nome}`)
    if (o.resultadoSonho) lines.push(`Resultado do Sonho: ${o.resultadoSonho}`)
    if (o.porqueVaiFuncionar) lines.push(`Por que funciona: ${o.porqueVaiFuncionar}`)
    if (o.velocidade) lines.push(`Prazo/Velocidade: ${o.velocidade}`)
    if (o.esforcoMinimo) lines.push(`Esforço mínimo: ${o.esforcoMinimo}`)
    if (o.garantia) lines.push(`Garantia: ${o.garantia}`)
    if (o.escassez) lines.push(`Escassez/Urgência: ${o.escassez}`)
    const bonus = (o.bonus || []).filter(Boolean)
    if (bonus.length) lines.push(`Bônus: ${bonus.join(' | ')}`)
  }
  const ctx = lines.join('\n')
  return ctx.length > 50000 ? ctx.slice(0, 50000) + '\n\n[contexto truncado]' : ctx
}

// ─── Extrai as "PRINCIPAIS DORES" dos generatedProfile das personas ───────────
function parseDores(personas) {
  const result = []
  for (const persona of personas || []) {
    const text = persona.generatedProfile || ''
    if (!text) continue
    const lines = text.split('\n')
    let personaName = persona.name || ''
    for (const line of lines) {
      const nameMatch = line.match(/^\s*-\s*Nome:\s*(.+)/)
      if (nameMatch) { personaName = nameMatch[1].trim(); break }
    }
    let inSection = false
    for (const line of lines) {
      const trimmed = line.trim()
      if (/^PRINCIPAIS\s+DORES/i.test(trimmed)) { inSection = true; continue }
      if (inSection) {
        if (trimmed === '---') break
        const match = trimmed.match(/^-\s*[Dd]or:\s*(.+)/)
        if (match) {
          result.push({
            id: `${persona.id}_${result.length}`,
            text: match[1].trim(),
            personaName: personaName || 'Persona',
          })
        }
      }
    }
  }
  return result
}

// Fallback: quando a persona não tem perfil gerado (sem "PRINCIPAIS DORES"),
// usa os medos/objeções/erros das respostas como dores candidatas.
function fallbackDores(personas) {
  const out = []
  for (const p of personas || []) {
    const a = p.answers || {}
    for (const key of ['medos', 'objecoes', 'erros']) {
      for (const item of Array.isArray(a[key]) ? a[key] : []) {
        const text = (typeof item === 'string' ? item : '').trim()
        if (text) out.push({ id: `${p.id}_${key}_${out.length}`, text, personaName: p.name || 'Persona' })
      }
    }
  }
  return out.slice(0, 30)
}

// ─── Instruções de geração (espelham autoInstruction do CriativosModule) ──────
function buildVideoInstruction(adTypes) {
  const typesStr = adTypes
    .map(({ id, qty }) => {
      const t = AD_TYPE_MAP[id]
      return `${t.emoji} ${t.label} (${qty} ${qty === 1 ? 'variação' : 'variações'}): ${t.desc}`
    })
    .join('\n')
  return `---\n\n## SOLICITAÇÃO\n\nTipos de gancho a gerar:\n${typesStr}`
}

function buildStaticInstruction(dores) {
  const sections = dores
    .map(({ text, types }) => {
      const typeLines = types
        .map(({ id, qty }) => {
          const t = AD_TYPE_MAP[id]
          return `- ${t.emoji} ${t.label}: ${qty} headline${qty !== 1 ? 's' : ''} + ${qty} subheadline${qty !== 1 ? 's' : ''} — ângulo: ${t.desc}`
        })
        .join('\n')
      return `### DOR: "${text}"\n${typeLines}`
    })
    .join('\n\n')
  return `---\n\n## SOLICITAÇÃO\n\n${sections}`
}

// Normaliza/valida a seleção de tipos vinda do cliente. Descarta ids inválidos,
// limita a quantidade por tipo (1..10) e o número de tipos.
function sanitizeTypes(raw) {
  const out = []
  for (const t of Array.isArray(raw) ? raw.slice(0, 18) : []) {
    if (!AD_TYPE_MAP[t?.id]) continue
    const qty = Math.max(1, Math.min(10, parseInt(t?.qty, 10) || 1))
    out.push({ id: t.id, qty })
  }
  return out
}

async function anthropicSSE(system, instruction, context, maxTokens) {
  if (!ANTHROPIC_KEY) return json({ error: 'IA não configurada no servidor.' }, 500)
  const messages = [{
    role: 'user',
    content: [
      { type: 'text', text: context, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: instruction },
    ],
  }]
  const systemBlocks = [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system: systemBlocks, messages, stream: true }),
  })
  return new Response(r.body, {
    status: r.status,
    headers: {
      'content-type': r.headers.get('content-type') || 'text/event-stream',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'Servidor não configurado.' }, 500)

  let body
  try { body = await req.json() } catch { return json({ error: 'JSON inválido.' }, 400) }

  const action = body?.action || 'auth'
  const projectId = String(body?.projectId || '').trim()
  const token = String(body?.token || '').trim().toLowerCase()
  const password = String(body?.password || '').trim()
  if (!projectId || !token) return json({ error: 'Link incompleto.' }, 400)
  if (!password) return json({ error: 'Informe a senha de acesso.' }, 401)

  // Valida token = HMAC(projectId|senha). Sem a senha certa, o HMAC não bate.
  const expected = await hmacHex(SERVICE_KEY, `${projectId}|${password}`)
  if (!safeEq(token, expected)) return json({ error: 'Senha incorreta ou link inválido.' }, 403)

  const project = await loadProject(projectId)
  if (!project) return json({ error: 'Cliente não encontrado.' }, 404)

  // ── auth: devolve o contexto mínimo para a UI ───────────────────────────────
  if (action === 'auth') {
    let dores = parseDores(project.personas)
    if (!dores.length) dores = fallbackDores(project.personas)
    return json({
      success: true,
      companyName: project.companyName || 'Cliente',
      dores,
      produtos: project.produtos.map((p) => ({ id: p.id, nome: p.nome })).filter((p) => p.nome),
      personas: project.personas.map((p) => ({ id: p.id, name: p.name })).filter((p) => p.name),
    })
  }

  // ── generate: monta a instrução e faz o streaming da IA ─────────────────────
  if (action === 'generate') {
    const mode = body?.mode === 'video' ? 'video' : 'estatico'
    const context = buildContext(project)

    if (mode === 'video') {
      const adTypes = sanitizeTypes(body?.adTypes)
      if (!adTypes.length) return json({ error: 'Selecione ao menos um tipo de gancho.' }, 400)
      const total = adTypes.reduce((s, t) => s + t.qty, 0)
      if (total > 40) return json({ error: 'Muitos roteiros de uma vez. Gere no máximo 40.' }, 400)
      return anthropicSSE(VIDEO_SYSTEM, buildVideoInstruction(adTypes), context, 16000)
    }

    // estático
    const rawDores = Array.isArray(body?.dores) ? body.dores.slice(0, 12) : []
    const dores = []
    for (const d of rawDores) {
      const text = clip(d?.text, 400)
      const types = sanitizeTypes(d?.types)
      if (text && types.length) dores.push({ text, types })
    }
    if (!dores.length) return json({ error: 'Selecione ao menos uma dor com um tipo de criativo.' }, 400)
    const total = dores.reduce((s, d) => s + d.types.reduce((a, t) => a + t.qty, 0), 0)
    if (total > 40) return json({ error: 'Muitas variações de uma vez. Gere no máximo 40.' }, 400)
    return anthropicSSE(DORES_SYSTEM, buildStaticInstruction(dores), context, 16000)
  }

  return json({ error: 'Ação desconhecida.' }, 400)
}
