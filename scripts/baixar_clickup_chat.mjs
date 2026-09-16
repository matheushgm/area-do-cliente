// Baixa o ClickUp Chat (canais, DMs, membros e mensagens + threads) para um JSON.
//   node scripts/baixar_clickup_chat.mjs <saida.json> [dias=7]
import fs from 'node:fs'

function lerEnv(arquivo) {
  if (!fs.existsSync(arquivo)) return {}
  return Object.fromEntries(fs.readFileSync(arquivo, 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#')).map((l) => {
    const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '').replace(/\\n/g, '')]
  }))
}
const env = { ...lerEnv('.env'), ...lerEnv('.env.local') }
const TOKEN = env.CLICKUP_API_TOKEN, TEAM = env.CLICKUP_TEAM_ID
const H = { Authorization: TOKEN, 'Content-Type': 'application/json' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const [saida, diasArg] = process.argv.slice(2)
if (!saida) { console.error('uso: node scripts/baixar_clickup_chat.mjs <saida.json> [dias]'); process.exit(1) }
const SINCE = Date.now() - Number(diasArg || 7) * 86400000

async function get(path) {
  for (let i = 0; i < 6; i++) {
    const r = await fetch('https://api.clickup.com/api/v3' + path, { headers: H })
    if (r.status === 429) { await sleep(15000); continue }
    if (!r.ok) throw new Error(r.status + ' ' + path + ' ' + await r.text())
    return r.json()
  }
}

const out = { since: SINCE, channels: [], members: {} }
const team = await (await fetch(`https://api.clickup.com/api/v2/team/${TEAM}`, { headers: H })).json()
for (const m of team.team.members) out.members[m.user.id] = { id: m.user.id, name: m.user.username, email: m.user.email, color: m.user.color, initials: m.user.initials, avatar: m.user.profilePicture }

let cursor = null
const canais = []
do {
  const j = await get(`/workspaces/${TEAM}/chat/channels?limit=100${cursor ? '&cursor=' + cursor : ''}`)
  canais.push(...(j.channels || j.data || [])); cursor = j.next_cursor
} while (cursor)
console.error('canais', canais.length)

for (const c of canais) {
  const msgs = []
  let cur = null, parou = false
  do {
    const j = await get(`/workspaces/${TEAM}/chat/channels/${c.id}/messages?limit=100&content_format=text/md${cur ? '&cursor=' + cur : ''}`)
    for (const m of j.data || []) { if (Number(m.date) >= SINCE) msgs.push(m); else parou = true }
    cur = parou ? null : j.next_cursor
  } while (cur)
  for (const m of msgs) {
    if (m.replies_count > 0) {
      const j = await get(`/workspaces/${TEAM}/chat/messages/${m.id}/replies?limit=100&content_format=text/md`)
      m._replies = j.data || []
    }
  }
  let members = []
  try { const j = await get(`/workspaces/${TEAM}/chat/channels/${c.id}/members?limit=100`); members = (j.data || []).map((u) => String(u.id)) } catch (e) { console.error('membros', c.id, e.message) }
  out.channels.push({ ...c, members, messages: msgs })
  if (msgs.length) console.error(c.type, c.name || c.id, msgs.length, 'msgs')
}
fs.writeFileSync(saida, JSON.stringify(out))
console.error('ok →', saida)
