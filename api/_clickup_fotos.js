// Fotos do time vindas do ClickUp (migration 123). Uma chamada (GET /team) traz os membros
// de todos os workspaces do token com `profilePicture`; a do workspace sincronizado é gravada
// em profiles.foto_url, cruzando por profiles.clickup_user_id. Roda na rodada diária do cron
// (quem troca a foto lá aparece aqui no dia seguinte) e no script local
// (scripts/atualizar_fotos_clickup.mjs). Nunca lança: o resultado é só um item do resumo.

const CLICKUP_BASE = 'https://api.clickup.com/api/v2'

/** { ok, membros, atualizadas, semFoto, aviso? } */
export async function atualizarFotos({ sb, token, team, prazo = Infinity, fetchFn = fetch }) {
  try {
    if (Date.now() > prazo) return { ok: false, aviso: 'Sem tempo para atualizar as fotos do time.' }
    const res = await fetchFn(`${CLICKUP_BASE}/team`, { headers: { Authorization: token } })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new Error(json?.err || `ClickUp GET /team: ${res.status}`)
    const ws = (json?.teams || []).find((t) => String(t.id) === String(team))
    if (!ws) throw new Error(`workspace ${team} não está no token`)
    const fotoDe = new Map((ws.members || []).map((m) => [String(m.user?.id), m.user?.profilePicture || null]))

    const { data: perfis, error } = await sb.from('profiles').select('id, clickup_user_id, foto_url').not('clickup_user_id', 'is', null)
    if (error) throw new Error(error.message)
    let atualizadas = 0, semFoto = 0
    for (const p of perfis || []) {
      if (!fotoDe.has(String(p.clickup_user_id))) continue // saiu do workspace: mantém o que tinha
      const foto = fotoDe.get(String(p.clickup_user_id))
      if (!foto) semFoto++
      if ((p.foto_url || null) === foto) continue
      const { error: e } = await sb.from('profiles').update({ foto_url: foto }).eq('id', p.id)
      if (!e) atualizadas++
    }
    return { ok: true, membros: fotoDe.size, atualizadas, semFoto }
  } catch (e) {
    return { ok: false, aviso: `Não consegui atualizar as fotos do time: ${e.message}` }
  }
}
