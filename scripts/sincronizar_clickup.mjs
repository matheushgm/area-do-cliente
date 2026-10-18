// Sincronização ClickUp → VertaTask rodando LOCAL, sem o limite de 60 s da
// Vercel. Usa o mesmo núcleo do endpoint (api/_tarefas_sync_core.js).
//
//   node scripts/sincronizar_clickup.mjs [--completo] [--reconciliar] [--since=<ISO>]
//        [--sem-comentarios] [--max-comentarios=N] [--espacos=id,id]
//
//   --completo      passa por TODAS as tarefas dos spaces (não só as alteradas):
//                   corrige o que a sincronização diária perdeu. ~13 mil tarefas
//                   em ~140 páginas, respeitando o limite de 100 req/min.
//   --reconciliar   confere o que está aberto aqui mas sumiu do ClickUp
//                   (apagada → arquivada; fechada/movida → atualizada).
//   --since=ISO     ponto de partida (padrão: tarefas_sync.ultimo_inicio - 15 min).
//
// Lê SUPABASE_URL, SUPABASE_SECRET_KEY (ou SERVICE_ROLE), CLICKUP_API_TOKEN,
// CLICKUP_TEAM_ID e CLICKUP_SYNC_SPACE_IDS de .env e .env.local. Grava o
// resultado em tarefas_sync, como o endpoint, para o cron continuar dali.
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { sincronizar, SPACES_PADRAO } from '../api/_tarefas_sync_core.js'

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true] }))

function lerEnv(f) {
  try { return Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n').filter((l) => l && !l.startsWith('#') && l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] })) } catch { return {} }
}
const env = { ...lerEnv('.env'), ...lerEnv('.env.local'), ...process.env }
const URL = env.SUPABASE_URL
const KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
// Alguns valores do .env vêm com um "\n" literal no fim (mesmo tratamento do endpoint).
const limpo = (v) => String(v || '').replace(/\\n/g, '').trim()
const TOKEN = limpo(env.CLICKUP_API_TOKEN)
const TEAM = limpo(env.CLICKUP_TEAM_ID) || '9009170774'
if (!URL || !KEY || !TOKEN) { console.error('SUPABASE_URL / SUPABASE_SECRET_KEY / CLICKUP_API_TOKEN ausentes'); process.exit(1) }
const spaces = String(args.espacos || env.CLICKUP_SYNC_SPACE_IDS || '').split(',').map((s) => s.trim()).filter(Boolean)

const sb = createClient(URL, KEY, { auth: { persistSession: false } })
const inicio = Date.now()
const { data: estado } = await sb.from('tarefas_sync').select('*').eq('id', 'clickup').maybeSingle()
let desde = args.since ? new Date(args.since) : (estado?.ultimo_inicio ? new Date(new Date(estado.ultimo_inicio).getTime() - 15 * 60_000) : new Date(Date.now() - 86400000))
if (isNaN(desde.getTime())) desde = new Date(Date.now() - 86400000)
await sb.from('tarefas_sync').upsert({ id: 'clickup', ultimo_inicio: new Date(inicio).toISOString(), updated_at: new Date().toISOString() })

const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`)
log(`início · completo=${!!args.completo} reconciliar=${!!args.reconciliar} desde=${args.completo ? '(tudo)' : desde.toISOString()}`)
try {
  const resumo = await sincronizar({
    sb, token: TOKEN, team: TEAM, spaces: spaces.length ? spaces : SPACES_PADRAO, desde,
    completo: !!args.completo, reconciliar: !!args.reconciliar,
    comentarios: !args['sem-comentarios'], maxComentarios: Number(args['max-comentarios']) || 400,
    orcamentoMs: 6 * 60 * 60_000, log,
  })
  await sb.from('tarefas_sync').upsert({ id: 'clickup', ultimo_inicio: new Date(inicio).toISOString(), ultimo_fim: new Date().toISOString(), ultimo_ok: true, resumo: { via: 'script', ...resumo }, updated_at: new Date().toISOString() })
  const { avisos, ...resto } = resumo
  console.log(JSON.stringify(resto, null, 2))
  if (avisos.length) { console.log(`${avisos.length} avisos:`); for (const a of avisos.slice(0, 60)) console.log('  - ' + a); if (avisos.length > 60) console.log(`  … e mais ${avisos.length - 60}`) }
} catch (e) {
  await sb.from('tarefas_sync').upsert({ id: 'clickup', ultimo_inicio: estado?.ultimo_inicio || desde.toISOString(), ultimo_fim: new Date().toISOString(), ultimo_ok: false, resumo: { via: 'script', erro: e.message }, updated_at: new Date().toISOString() })
  console.error('ERRO:', e.message)
  process.exit(1)
}
