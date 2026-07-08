// Edge Function — dispara um lead de exemplo para o CRM e devolve a resposta
// crua (status + corpo), sem gravar nada. Usado pelo botão "Testar envio".
import { isAuthed, sendToCrm, buildBody } from './_crm.js'

export const config = { runtime: 'edge' }

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json' },
  })
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  if (!(await isAuthed(req))) return json({ error: 'Não autorizado.' }, 401)

  let body
  try { body = await req.json() } catch { return json({ error: 'JSON inválido.' }, 400) }

  const { config: cfg, dados = {} } = body
  if (!cfg?.endpoint) return json({ error: 'Informe o endpoint do CRM antes de testar.' }, 400)

  // Valida o template antes de sair batendo no CRM — erro mais claro pro usuário.
  const built = buildBody(cfg, dados)
  if (!built.ok) return json({ ok: false, status: 0, response: built.error, sent: built.raw })

  const result = await sendToCrm(cfg, dados)
  return json(result)
}
