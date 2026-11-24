// Sugestões da Central de Otimizações (/otimizacoes) calculadas fora do navegador,
// para o gestor de tráfego do Escritório dos Agentes (pedido do Matheus, 24/11/2026).
//
// Reproduz o que a tela faz (useDashboardData({ source: 'api', dias: 20, status: true })
// + useSugestoesGlobais): lê as mesmas views e o mesmo recorte do dash_insights com a
// chave de serviço, passa as linhas pelo mesmo formato do CSV de /api/dash-data (tudo
// texto) e roda o MESMO motor (vendor/playbookSugestoes.js, gerado de
// src/lib/playbookSugestoes.js). A chave de cada sugestão sai igual à da tela, então
// a decisão gravada aqui casa com o cartão de lá.
//
// Uso:
//   SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/otimizacoes_pendentes.mjs [--saida x.json] [--resumo]
// Importável: calcularOtimizacoes({ url, key }) → { janela, pendentes, decisoes, projetos, contas }
import { writeFileSync } from 'node:fs'
import { gerarSugestoesProjeto, pendente, janelaAnalise } from '../public/dash-teste/vendor/playbookSugestoes.js'
import { modoDoAgente, regraDaChave, MOTIVO_CRITICA } from '../src/lib/otimizacoesAgente.js'

const DIAS = 20 // igual à /otimizacoes (ver "Janelas por tela" no CLAUDE.md)
const isoHojeUTC = () => new Date().toISOString().slice(0, 10) // o mesmo isoHoje do dashCache
const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
const somaDias = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }

function cliente({ url, key }) {
  const base = `${url.replace(/\/$/, '')}/rest/v1/`
  const headers = { apikey: key, Authorization: `Bearer ${key}` }
  // Página a página (1000 é o teto do Supabase), em série: os recortes aqui são pequenos.
  async function todas(caminho) {
    const out = []
    for (let de = 0; ; de += 1000) {
      const r = await fetch(base + caminho, { headers: { ...headers, Range: `${de}-${de + 999}`, 'Range-Unit': 'items' } })
      if (!r.ok) throw new Error(`Supabase ${caminho.split('?')[0]}: ${r.status} ${(await r.text()).slice(0, 300)}`)
      const lote = await r.json()
      out.push(...lote)
      if (lote.length < 1000) return out
    }
  }
  return { todas }
}

// Igual ao toCSV de /api/dash-data + parseCSV do front: todo valor vira texto aparado.
function comoCSV(rows) {
  return rows.map((r) => {
    const o = {}
    for (const [k, v] of Object.entries(r || {})) o[k.trim()] = String(v == null ? '' : v).trim()
    return o
  }).filter((r) => Object.values(r).some((v) => v))
}

async function emOndas(itens, n, fn) {
  const out = []
  for (let i = 0; i < itens.length; i += n) out.push(...(await Promise.all(itens.slice(i, i + n).map(fn))))
  return out
}

export async function calcularOtimizacoes({ url, key }) {
  const sb = cliente({ url, key })
  const inicio = somaDias(isoHojeUTC(), -DIAS)
  const dias = []
  for (let d = inicio; d <= isoHojeUTC(); d = somaDias(d, 1)) dias.push(d)

  const lerCanal = async (canal) => (await emOndas(dias, 6, (dia) =>
    sb.todas(`dash_insights?channel=eq.${canal}&day=eq.${dia}&select=data&order=row_key.asc`))).flat().map((r) => r.data)

  const [metaRaw, googleRaw, statusRaw, contasRows, projRows, cplRows, decisoes, projetos] = await Promise.all([
    lerCanal('meta'),
    lerCanal('google'),
    sb.todas('dash_insights?channel=eq.meta_status&select=data&order=row_key.asc').then((r) => r.map((x) => x.data)),
    sb.todas('dashboard_accounts_public?select=account_name,project_id,squad_id,clickup_folder_id,hidden'),
    sb.todas('dashboard_projects_public?select=id,company_name,squad_name,clickup_folder_id'),
    sb.todas('cpl_targets_public?select=company_name,cpl_target,cac_target,mql_target,metrica_formulario'),
    sb.todas('projeto_sugestoes?select=*&order=decidida_em.desc'),
    sb.todas('projects_v2?select=id,company_name,squad,responsible_name,status'),
  ])
  const meta = comoCSV(metaRaw)
  const google = comoCSV(googleRaw)
  const metaStatus = comoCSV(statusRaw)

  // accounts: o mesmo objeto do useDashboardData (só o que o motor lê)
  const projPorId = new Map(projRows.map((p) => [p.id, p]))
  const cpl = {}, metas = {}
  for (const r of cplRows) {
    const n = r.company_name?.trim(); if (!n) continue
    if (r.cpl_target != null) cpl[n] = parseFloat(r.cpl_target)
    metas[n] = {
      cac: r.cac_target != null ? parseFloat(r.cac_target) : null,
      mql: r.mql_target != null ? parseFloat(r.mql_target) : null,
      formulario: r.metrica_formulario || 'lead',
    }
  }
  const accounts = {}
  for (const row of contasRows) {
    const p = row.project_id ? projPorId.get(row.project_id) : null
    const nome = p?.company_name ?? null
    const cplVal = nome != null ? cpl[nome.trim()] : null
    const mx = nome != null ? metas[nome.trim()] : null
    accounts[row.account_name] = {
      projectId: row.project_id ?? null,
      acCompanyName: nome,
      hidden: !!row.hidden,
      cplTarget: cplVal != null ? { value: cplVal, acName: nome } : null,
      cacTarget: mx?.cac ?? null,
      mqlTarget: mx?.mql ?? null,
      metricaFormulario: mx?.formulario ?? 'lead',
    }
  }

  // Linhas por projeto (conta → projeto pelo vínculo do dashboard), como useSugestoesGlobais
  const porProjeto = new Map()
  const push = (canal, r) => {
    const pid = accounts[r['Nome da conta']]?.projectId
    if (!pid) return
    if (!porProjeto.has(pid)) porProjeto.set(pid, { meta: [], google: [] })
    porProjeto.get(pid)[canal].push(r)
  }
  for (const r of meta) push('meta', r)
  for (const r of google) push('google', r)

  const nomeProjeto = new Map(projetos.map((p) => [p.id, p]))
  const decisaoPor = new Map(decisoes.map((d) => [`${d.project_id}|${d.chave}`, d]))
  const hoje = hojeSP()
  const pendentes = []
  // Toda sugestão que a regra dispara HOJE, decidida ou não (project_id|chave → sugestão):
  // o agente só executa uma decisão antiga da fila se a regra ainda valer.
  const vigentes = {}
  for (const [pid, rows] of porProjeto) {
    const sugs = gerarSugestoesProjeto({ meta: rows.meta, google: rows.google, accounts, metaStatus })
    for (const s of sugs) {
      vigentes[`${pid}|${s.chave}`] = { ...s, projectId: pid, regraId: regraDaChave(s.chave), modo: modoDoAgente(s) }
      if (!pendente(decisaoPor.get(`${pid}|${s.chave}`), hoje)) continue
      const p = nomeProjeto.get(pid)
      pendentes.push({ ...s, projectId: pid, cliente: p?.company_name || s.conta, responsavel: p?.responsible_name || null, regraId: regraDaChave(s.chave), modo: modoDoAgente(s) })
    }
  }
  return {
    janela: janelaAnalise(meta, google),
    pendentes,
    vigentes,
    motivosCritica: MOTIVO_CRITICA,
    decisoes,
    clientesAnalisados: porProjeto.size,
    linhas: { meta: meta.length, google: google.length, metaStatus: metaStatus.length },
  }
}

// ── Linha de comando ─────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.SUPABASE_URL || 'https://dwbdzoljmdmihitssxhn.supabase.co'
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) { console.error('Defina SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY).'); process.exit(1) }
  const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null }
  const t0 = Date.now()
  const r = await calcularOtimizacoes({ url, key })
  const porModo = r.pendentes.reduce((a, s) => ({ ...a, [s.modo]: (a[s.modo] || 0) + 1 }), {})
  console.error(`${r.pendentes.length} pendentes em ${r.clientesAnalisados} clientes (${JSON.stringify(porModo)}), janela ${r.janela?.inicio} a ${r.janela?.fim}, ${((Date.now() - t0) / 1000).toFixed(1)} s`)
  if (arg('--saida')) writeFileSync(arg('--saida'), JSON.stringify(r, null, 2))
  else if (!process.argv.includes('--resumo')) console.log(JSON.stringify(r.pendentes, null, 2))
}
