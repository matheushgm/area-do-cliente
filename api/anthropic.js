// Edge Runtime: sem timeout fixo, suporta streaming nativo
export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let body
  try { body = await req.json() }
  catch {
    return new Response(
      JSON.stringify({ error: { message: 'Corpo da requisição inválido.' } }),
      { status: 400, headers: { 'content-type': 'application/json' } }
    )
  }

  const { apiKey, ...payload } = body

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: { message: 'API key não informada. Configure nas Configurações (⚙️).' } }),
      { status: 400, headers: { 'content-type': 'application/json' } }
    )
  }

  if (!apiKey.startsWith('sk-ant-')) {
    return new Response(
      JSON.stringify({ error: { message: 'API key inválida. Deve começar com sk-ant-' } }),
      { status: 400, headers: { 'content-type': 'application/json' } }
    )
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':          apiKey,
        'anthropic-version':  '2023-06-01',
        'anthropic-beta':     'prompt-caching-2024-07-31',
        'content-type':       'application/json',
      },
      body: JSON.stringify(payload),
    })

    // Passthrough direto — funciona para streaming (text/event-stream) e JSON normal
    const contentType = response.headers.get('content-type') || 'application/json'
    return new Response(response.body, {
      status: response.status,
      headers: { 'content-type': contentType },
    })

  } catch (err) {
    return new Response(
      JSON.stringify({ error: { message: `Erro interno: ${err.message}` } }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    )
  }
}
