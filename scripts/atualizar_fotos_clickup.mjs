// Grava em profiles.foto_url a foto de cada pessoa no ClickUp (migration 123), na hora, sem
// esperar a rodada diária do cron. Mesma lógica de api/_clickup_fotos.js.
//
//   node scripts/atualizar_fotos_clickup.mjs
//
// Lê SUPABASE_URL, SUPABASE_SECRET_KEY (ou SERVICE_ROLE), CLICKUP_API_TOKEN e
// CLICKUP_TEAM_ID de .env e .env.local.
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { atualizarFotos } from '../api/_clickup_fotos.js'

function lerEnv(f) {
  try { return Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n').filter((l) => l && !l.startsWith('#') && l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] })) } catch { return {} }
}
const env = { ...lerEnv('.env'), ...lerEnv('.env.local'), ...process.env }
const limpo = (v) => String(v || '').replace(/\\n/g, '').trim()
const URL = env.SUPABASE_URL
const KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
const TOKEN = limpo(env.CLICKUP_API_TOKEN)
const TEAM = limpo(env.CLICKUP_TEAM_ID) || '9009170774'
if (!URL || !KEY || !TOKEN) { console.error('SUPABASE_URL / SUPABASE_SECRET_KEY / CLICKUP_API_TOKEN ausentes'); process.exit(1) }

const sb = createClient(URL, KEY, { auth: { persistSession: false } })
const r = await atualizarFotos({ sb, token: TOKEN, team: TEAM })
console.log(r)
if (!r.ok) process.exit(1)
