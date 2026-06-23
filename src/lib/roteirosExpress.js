// Definições compartilhadas da ferramenta "Roteiros Express" — usadas tanto pela
// página pública (wizard) quanto pela página interna (geração + respostas).

// Token do link público de compartilhamento.
// DEVE ser igual ao usado na edge function api/roteiros-express.js.
export const PUBLIC_TOKEN = 'express-rl-9f3a'

// Caminho da rota pública (montagem do link compartilhável).
export const publicLink = (origin) => `${origin}/roteiros/${PUBLIC_TOKEN}`

// ─── Perguntas (5 produto + 5 cliente) ────────────────────────────────────────
export const PRODUTO_QS = [
  { id: 'p1', label: 'O que você vende?', hint: 'Produto ou serviço, em poucas palavras.', ph: 'Ex.: Curso online de confeitaria para iniciantes' },
  { id: 'p2', label: 'Qual a maior transformação que você entrega?', hint: 'O resultado real que o cliente alcança.', ph: 'Ex.: Sair do zero e vender o primeiro bolo em 30 dias' },
  { id: 'p3', label: 'O que te diferencia dos concorrentes?', hint: 'Seu diferencial ou mecanismo único.', ph: 'Ex.: Método com receitas testadas e suporte no WhatsApp' },
  { id: 'p4', label: 'Qual a sua oferta ou condição especial?', hint: 'Garantia, frete grátis, desconto, bônus...', ph: 'Ex.: 7 dias de garantia + 3 ebooks de bônus' },
  { id: 'p5', label: 'Qual ação a pessoa deve tomar?', hint: 'A chamada para ação (CTA) do anúncio.', ph: 'Ex.: Chamar no WhatsApp para garantir a vaga' },
]

export const CLIENTE_QS = [
  { id: 'c1', label: 'Quem é o seu cliente ideal?', hint: 'Idade, gênero, profissão, contexto.', ph: 'Ex.: Mulheres de 30 a 45 anos que querem renda extra em casa' },
  { id: 'c2', label: 'Qual a maior dor dele hoje?', hint: 'O problema que mais incomoda.', ph: 'Ex.: Está endividada e sem tempo para um emprego fixo' },
  { id: 'c3', label: 'Qual o maior sonho ou desejo dele?', hint: 'Ligado ao que você vende.', ph: 'Ex.: Ter o próprio negócio e liberdade financeira' },
  { id: 'c4', label: 'Qual a principal objeção ou medo?', hint: 'O que o impede de comprar.', ph: 'Ex.: Acha que é difícil e que não tem talento para isso' },
  { id: 'c5', label: 'Como ele costuma comprar?', hint: 'Online, loja física, indicação...', ph: 'Ex.: Compra pelo celular, descobre coisas no Instagram' },
]

export const ALL_QS = [...PRODUTO_QS, ...CLIENTE_QS]
export const EMPTY_ANSWERS = Object.fromEntries(ALL_QS.map((q) => [q.id, '']))

// Delimitador que a IA usa para separar os 2 roteiros (some no display).
export const SPLIT = '[[ROTEIRO]]'

// ─── Prompts de geração (metodologia Laboratório de Anúncios) ─────────────────
export const SYSTEM_GERAR = `Você é um especialista em roteiros de vídeos de anúncios online de alta conversão, usando a estrutura do Laboratório de Anúncios (Revenue Lab). Os vídeos têm 30 a 60 segundos e rodam no Meta Ads (Reels/Feed) e YouTube Ads.

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

export const SYSTEM_REFINAR = `Você é um especialista em roteiros de vídeos de anúncios de alta conversão (Laboratório de Anúncios / Revenue Lab).

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

export function buildUserBrief(answers) {
  const linhas = (qs) => qs.map((q, i) => `${i + 1}. ${q.label} ${answers[q.id]?.trim() || '(não informado)'}`).join('\n')
  return `## PRODUTO / SERVIÇO
${linhas(PRODUTO_QS)}

## CLIENTE / PÚBLICO-ALVO
${linhas(CLIENTE_QS)}

Com base nisso, gere os 2 roteiros de vídeo seguindo a estrutura do Laboratório de Anúncios.`
}

// Divide o texto completo da IA nos 2 roteiros (limpa travessões e delimitador).
export function splitScripts(fullText) {
  const clean = (fullText || '').replace(/—/g, '-')
  const parts = clean.split(SPLIT).map((s) => s.trim()).filter(Boolean).slice(0, 2)
  return (parts.length ? parts : [clean.trim()]).map((content) => ({ content, refineUsed: false }))
}

// ─── Cliente público (sem login) → /api/roteiros-express ──────────────────────

// POST JSON simples (submit / save-scripts).
export async function postRoteiro(action, payload = {}) {
  const res = await fetch('/api/roteiros-express', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: PUBLIC_TOKEN, action, ...payload }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`)
  return data
}

// POST com resposta em streaming SSE (generate / refine). onChunk(textoAcumulado).
export async function streamRoteiro(action, payload, onChunk) {
  const res = await fetch('/api/roteiros-express', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: PUBLIC_TOKEN, action, ...payload }),
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
