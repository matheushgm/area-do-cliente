import { json, msg } from './_http.js'
// Edge Function — dispara um lead de exemplo para o CRM e devolve a resposta
// crua (status + corpo), sem gravar nada. Usado pelo botão "Testar envio".
import { isAuthed, sendToCrm, buildBody } from './_crm.js'

export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: msg(req, { pt: 'Método não permitido.', en: 'Method not allowed.' }) }, 405)
  if (!(await isAuthed(req))) return json({ error: msg(req, { pt: 'Não autorizado.', en: 'Unauthorized.' }) }, 401)

  let body
  try { body = await req.json() } catch { return json({ error: msg(req, { pt: 'JSON inválido.', en: 'Invalid JSON.' }) }, 400) }

  const { config: cfg, dados = {} } = body
  if (!cfg?.endpoint) return json({ error: msg(req, { pt: 'Informe o endpoint do CRM antes de testar.', en: 'Enter the CRM endpoint before testing.' }) }, 400)

  // Valida o template antes de sair batendo no CRM — erro mais claro pro usuário.
  const built = buildBody(cfg, dados)
  if (!built.ok) return json({ ok: false, status: 0, response: built.error, sent: built.raw })

  const result = await sendToCrm(cfg, dados)
  return json(result)
}
