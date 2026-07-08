// Definições compartilhadas da ferramenta pública "Criativos com IA".
// Usadas pela página pública (CriativosPublico) e pelo botão de compartilhar no
// CriativosModule. A geração acontece sem login, validada por token HMAC + senha
// na edge function api/criativos-public.js (as prompts vivem no servidor).

// ─── Tipos de criativo (ADIG / Laboratório de Anúncios) ───────────────────────
// Mantido em sincronia com AD_TYPES em api/criativos-public.js (server valida os ids).
export const AD_TYPES = [
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

// ─── Link público (montado a partir do projeto + token gerado no servidor) ─────
export const publicCriativosLink = (origin, projectId, token) =>
  `${origin}/criativos/${projectId}/${token}`

// ─── Cliente público (sem login) → /api/criativos-public ──────────────────────

// POST JSON simples (auth). Devolve o contexto mínimo do cliente.
export async function postCriativo(action, payload = {}) {
  const res = await fetch('/api/criativos-public', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`)
  return data
}

// POST com resposta em streaming SSE (generate). onChunk(textoAcumulado).
export async function streamCriativo(action, payload, onChunk, signal) {
  const res = await fetch('/api/criativos-public', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
    signal,
  })
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('event-stream')) {
    let data
    try { data = await res.json() } catch { throw new Error(`Erro ${res.status}`) }
    throw new Error(data?.error || `Erro ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6).trim()
      if (!raw || raw === '[DONE]') continue
      let event
      try { event = JSON.parse(raw) } catch { continue }
      if (event.type === 'error') throw new Error(event.error?.message || 'Erro no streaming da IA.')
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta?.text) {
        fullText += event.delta.text
        onChunk(fullText.replace(/—/g, '-'))
      }
    }
  }
  if (!fullText) throw new Error('A IA retornou uma resposta vazia. Tente novamente.')
  return fullText
}
