/**
 * streamClaude — gera texto via Anthropic API com streaming SSE.
 *
 * @param {object}   opts
 * @param {string}   opts.model
 * @param {number}   opts.max_tokens
 * @param {string}   opts.system
 * @param {Array}    opts.messages
 * @param {Function} opts.onChunk   — chamado a cada novo trecho: onChunk(textAcumulado)
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<string>} texto completo gerado
 */
export async function streamClaude({ model, max_tokens, system, messages, onChunk, signal }) {
  const res = await fetch('/api/anthropic', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens,
      system,
      messages,
      stream: true,
    }),
    signal,
  })

  // Se a resposta não for streaming (erro antes de iniciar), trata como JSON
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('event-stream')) {
    let data
    try { data = await res.json() } catch { throw new Error(`Erro ${res.status}`) }
    if (!res.ok) throw new Error(data?.error?.message || `Erro ${res.status}`)
    // Fallback: retorna texto normal se veio JSON (não deveria acontecer)
    const textBlock = Array.isArray(data.content) ? data.content.find(b => b.type === 'text') : null
    if (!textBlock?.text) throw new Error('Resposta vazia da API.')
    onChunk(textBlock.text)
    return textBlock.text
  }

  // Lê o stream SSE linha a linha
  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer    = ''
  let fullText  = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() // guarda linha incompleta para o próximo chunk

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6).trim()
      if (!raw || raw === '[DONE]') continue

      let event
      try { event = JSON.parse(raw) } catch { continue }

      // Erro vindo da Anthropic via stream
      if (event.type === 'error') {
        throw new Error(event.error?.message || 'Erro no streaming da API.')
      }

      // Delta de texto
      if (
        event.type === 'content_block_delta' &&
        event.delta?.type === 'text_delta' &&
        event.delta?.text
      ) {
        fullText += event.delta.text
        onChunk(fullText)
      }
    }
  }

  if (!fullText) throw new Error('A API retornou uma resposta vazia. Tente novamente.')
  return fullText
}
