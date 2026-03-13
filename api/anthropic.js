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

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: { message: 'ANTHROPIC_API_KEY não configurada no servidor.' } }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    )
  }

  const payload = body

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':          apiKey,
        'anthropic-version':  '2023-06-01',
        'anthropic-beta':     'prompt-caching-2024-07-31,pdfs-2024-09-25',
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
    console.error('[/api/anthropic] Erro interno:', err)
    return new Response(
      JSON.stringify({ error: { message: 'Erro interno. Tente novamente.' } }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    )
  }
}
