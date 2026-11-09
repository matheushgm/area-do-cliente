import { sessionToken } from './api'
import { t, idiomaAtual } from '../i18n'

// Texto gerado pela IA segue o idioma de quem gera. Cada módulo acrescenta isto ao
// `system` quando liga o idioma: NÃO é automático, porque várias telas leem a saída
// por regex em rótulos em português (`# DOR`, `**GANCHO:**`, `## ROTEIRO`…) e
// quebrariam com a resposta em inglês. Ligue só onde a leitura da saída já aceita
// os dois idiomas. Em português devolve '' (o prompt já pede português).
// Por padrão os rótulos do formato pedido pelo prompt (títulos, `GANCHO:`…) continuam
// como estão; `{ rotulos: true }` traduz também esses rótulos, para telas que só
// exibem o texto. Delimitadores (`[[ROTEIRO]]`) e chaves de JSON nunca mudam.
export function instrucaoDeIdioma({ rotulos = false } = {}) {
  if (idiomaAtual() !== 'en') return ''
  return '\n\nIMPORTANT: Write your entire answer in English (American), even though these instructions and the client data are in Portuguese. Keep proper names, brand names and quoted client text as they are. Keep delimiters such as [[...]] and any JSON keys exactly as specified.' +
    (rotulos
      ? ' Also translate the headings and section labels of the required output format into natural English (e.g. GANCHO → HOOK, MENSAGEM → MESSAGE, LEGENDA DO POST → POST CAPTION, TOPO DE FUNIL → TOP OF FUNNEL).'
      : ' Keep the headings and section labels of the required output format exactly as written in the instructions.')
}
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
  // Sem token o servidor responde 401 — a mensagem chega pelo fluxo de erro abaixo.
  const token = await sessionToken().catch(() => null)
  const headers = { 'content-type': 'application/json', 'X-Idioma': idiomaAtual() }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch('/api/anthropic', {
    method: 'POST',
    headers,
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
    try { data = await res.json() } catch { throw new Error(`${t('comum.erro')} ${res.status}`) }
    if (!res.ok) throw new Error(data?.error?.message || `${t('comum.erro')} ${res.status}`)
    // Fallback: retorna texto normal se veio JSON (não deveria acontecer)
    const textBlock = Array.isArray(data.content) ? data.content.find(b => b.type === 'text') : null
    if (!textBlock?.text) throw new Error(t('ia.respostaVazia'))
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
        throw new Error(event.error?.message || t('ia.erroStreaming'))
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

  if (!fullText) throw new Error(t('ia.respostaVaziaTente'))
  return fullText
}
