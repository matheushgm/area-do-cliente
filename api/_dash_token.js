// Token do link de leitura de UMA conta do Dashboard de Tráfego (`cliente|canal`).
// Dois formatos, os dois conferidos por /api/dash-public e /api/ad-preview-public:
//
//   • permanente: hmac(`cliente|canal`), gerado por /api/dash-share-token (botão 🔗 Link).
//     Não expira; só deixa de valer se a chave do servidor mudar.
//   • do portal: `<exp>.<hmac(portal-dash|cliente|canal|exp)>`, gerado por api/portal.js
//     quando o módulo Dashboard está liberado na chave. Vale TTL_PORTAL_MS: o portal pede um
//     novo a cada carga, então desativar a chave ou tirar o módulo corta o acesso em até 1 dia.
//
// O segredo é sempre SUPABASE_SERVICE_ROLE_KEY (o mesmo do link permanente), não o
// serviceKey() do portal: as duas pontas precisam assinar com a mesma chave.
import { hmacHex } from './_http.js'

export const TTL_PORTAL_MS = 24 * 60 * 60 * 1000

export function segredoDash() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY
}

function safeEq(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function tokenDashPortal(cliente, canal, agora = Date.now()) {
  const exp = agora + TTL_PORTAL_MS
  const sig = await hmacHex(segredoDash(), `portal-dash|${cliente}|${canal}|${exp}`)
  return `${exp}.${sig}`
}

// true se o token vale para esta conta e canal (qualquer um dos dois formatos).
export async function tokenDashValido(cliente, canal, token) {
  const t = String(token || '').trim().toLowerCase()
  if (!t || !cliente) return false
  const secret = segredoDash()
  if (!secret) return false
  const ponto = t.indexOf('.')
  if (ponto === -1) return safeEq(t, await hmacHex(secret, `${cliente}|${canal}`))
  const exp = Number(t.slice(0, ponto))
  if (!Number.isFinite(exp) || exp < Date.now()) return false
  return safeEq(t.slice(ponto + 1), await hmacHex(secret, `portal-dash|${cliente}|${canal}|${exp}`))
}
