import { sessionToken } from '../lib/api'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SHEETS, parseCSV } from '../lib/dashboardData'
import { lerDash } from '../lib/dashCache'

// ─────────────────────────────────────────────────────────────────────────────
// Hook de dados do Dashboard de Tráfego (modelo consolidado).
//
// Fonte de verdade = o PROJETO (projects_v2). Cada conta (dashboard_accounts)
// aponta para um projeto via project_id; squad, pasta ClickUp e CPL DERIVAM do
// projeto. squad_id e clickup_folder_id na conta são apenas OVERRIDE (nullable),
// usados sobretudo em contas sem projeto na AC.
//
// Fontes carregadas:
//   - planilhas Meta/Google (CSV público)
//   - dashboard_accounts          (base: account_name, project_id, squad_id, clickup_folder_id)
//   - dashboard_projects_public   (view: id, company_name, squad_name, clickup_folder_id)
//   - cpl_targets_public          (company_name → cpl_target)
//   - squads                      (id → name)
// ─────────────────────────────────────────────────────────────────────────────

// [{ account, channel }] → { conta: ['meta', 'google'] }, com o nome aparado.
function canaisPorConta(rows) {
  const ch = {}
  for (const r of rows || []) {
    const n = r.account?.trim(); if (!n || !r.channel) continue
    ;(ch[n] ||= []).includes(r.channel) || ch[n].push(r.channel)
  }
  return ch
}

// Em que canais cada conta tem dado: uma consulta de 1 linha por conta e canal no
// rollup (chave primária channel, account, …). Devolve no formato de uma resposta
// do supabase-js ({ data }) para entrar no mesmo Promise.all.
async function canaisDasContas(contas) {
  const pares = (contas || []).flatMap(conta => ['meta', 'google'].map(channel => ({ conta, channel })))
  const res = await Promise.all(pares.map(({ conta, channel }) =>
    supabase.from('dash_daily').select('account,channel').eq('channel', channel).eq('account', conta.trim()).limit(1)))
  return { data: res.flatMap(r => r.data || []) }
}

async function loadSheets(source = 'sheets', { accountNames = null, dias = null } = {}) {
  // Fonte NOVA (API): lê do dash_insights via /api/dash-data (mesmas colunas),
  // autenticado com o JWT da sessão. Usado pelo módulo Resultados do cliente.
  //
  // `accountNames` (lista) restringe às contas de um projeto e `dias` à janela
  // recente: o canal Meta inteiro tem dezenas de milhares de linhas e a leitura
  // completa estourava o limite de 25s da função Edge (HTTP 504). Lista vazia
  // = projeto sem conta vinculada → nem chama a API.
  if (source === 'api') {
    if (accountNames && accountNames.length === 0) return { meta: [], google: [] }
    // Pelo cache local (src/lib/dashCache.js): só baixa os dias que o coletor
    // regravou desde a última leitura, e reaproveita o que outra tela já baixou.
    const cfg = {
      token: (await sessionToken()) || '',
      sbUrl: import.meta.env.SUPABASE_URL, sbKey: import.meta.env.SUPABASE_ANON_KEY, parseCSV,
    }
    const ler = (canal, rotulo) => lerDash({ ...cfg, fonte: 'data', canal, contas: accountNames, dias })
      .catch(e => { throw new Error(`${rotulo} (API): ${e.message}`) })
    const [meta, google] = await Promise.all([ler('meta', 'Meta'), ler('google', 'Google')])
    return { meta, google }
  }
  // Fonte ANTIGA (planilhas Google CSV) — usada pelo /dashboard.
  const [metaText, googleText] = await Promise.all([
    fetch(SHEETS.meta).then(r => { if (!r.ok) throw new Error('Meta Ads: HTTP ' + r.status); return r.text() }),
    fetch(SHEETS.google).then(r => { if (!r.ok) throw new Error('Google Ads: HTTP ' + r.status); return r.text() }),
  ])
  return { meta: parseCSV(metaText), google: parseCSV(googleText) }
}

// Opções:
//   source    'sheets' (planilhas CSV) | 'api' (dash_insights via /api/dash-data)
//   projectId (só com 'api') carrega apenas as contas vinculadas a este projeto
//   dias      (só com 'api') janela de dias recentes em vez do histórico inteiro
//   linhas    false = não baixa as linhas de anúncio (`raw` fica vazio); para quem só
//             precisa das contas e dos vínculos, como o módulo Resultados de Tráfego
//   canais    (só com 'api' + projectId) preenche `accountChannels` das contas do
//             projeto; a lista de TODAS as contas (seletor "+ vincular conta") só vem
//             com carregarTodasContas(). Só a seção Resultados de Tráfego usa os dois.
export function useDashboardData({ source = 'sheets', projectId = null, dias = null, linhas = true, canais = false } = {}) {
  const [raw, setRaw] = useState({ meta: [], google: [] })
  // Todas as contas presentes no dashboard (view dash_accounts_public), lidas sob
  // demanda por carregarTodasContas(): com projectId o `raw` só tem as contas do
  // projeto, e o seletor "+ vincular conta" precisa da lista completa.
  const [allAccountNames, setAllAccountNames] = useState([])
  // Canais (meta/google) em que cada conta tem dados: { [account]: ['meta', ...] }
  const [accountChannels, setAccountChannels] = useState({})
  // Linhas-base de dashboard_accounts: { [account_name]: { project_id, squad_id, clickup_folder_id } }
  const [accountRows, setAccountRows] = useState({})
  const [projectsList, setProjectsList] = useState([])   // [{ id, company_name, squad_name, clickup_folder_id }]
  const [squadsList, setSquadsList] = useState([])        // [{ id, name }]
  const [cplTargets, setCplTargets] = useState({})        // { company_name: number }
  // Metas por métrica da Central de Otimizações: { company_name: { cac, mql, formulario } }
  const [metasExtra, setMetasExtra] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const mounted = useRef(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Lê das views *_public (security definer) para que o modo compartilhado
      // (/dashboard?shared=1) funcione também sem login — anon não enxerga as
      // tabelas-base dashboard_accounts/squads por RLS. As escritas (setSquad,
      // linkProject…) continuam indo para a tabela-base e exigem authenticated.
      const accQuery = supabase.from('dashboard_accounts_public').select('account_name,project_id,squad_id,clickup_folder_id,hidden')
      // Com projectId, as contas vêm ANTES dos dados: são elas que dizem o que
      // pedir à API (só as vinculadas ao projeto).
      let accRes, accountNames = null
      if (source === 'api' && projectId) {
        accRes = await accQuery
        if (accRes.error) throw new Error('Contas: ' + accRes.error.message)
        accountNames = (accRes.data || []).filter(r => r.project_id === projectId).map(r => r.account_name)
      }
      const [sheets, accRes2, projRes, cplRes, sqRes, namesRes] = await Promise.all([
        linhas ? loadSheets(source, { accountNames, dias }) : Promise.resolve({ meta: [], google: [] }),
        accRes ? Promise.resolve(accRes) : accQuery,
        supabase.from('dashboard_projects_public').select('id,company_name,squad_name,clickup_folder_id'),
        supabase.from('cpl_targets_public').select('company_name,cpl_target,cac_target,mql_target,metrica_formulario'),
        supabase.from('dashboard_squads_public').select('id,name'),
        // Canais em que cada conta DO PROJETO tem dado: uma linha por conta e canal
        // no rollup, pelo índice. A view de todas as contas lia ~115 mil linhas
        // (3,3 s) a cada abertura da página do cliente, e o iframe esperava por ela.
        source === 'api' && projectId && canais ? canaisDasContas(accountNames) : Promise.resolve({ data: null }),
      ])
      if (!mounted.current) return
      accRes = accRes2
      const accMap = {}
      ;(accRes.data || []).forEach(r => { accMap[r.account_name] = { project_id: r.project_id, squad_id: r.squad_id, clickup_folder_id: r.clickup_folder_id, hidden: !!r.hidden } })
      if (namesRes.data) setAccountChannels(prev => ({ ...prev, ...canaisPorConta(namesRes.data) }))
      const cpl = {}, metas = {}
      ;(cplRes.data || []).forEach(r => {
        const n = r.company_name?.trim(); if (!n) return
        if (r.cpl_target != null) cpl[n] = parseFloat(r.cpl_target)
        metas[n] = {
          cac: r.cac_target != null ? parseFloat(r.cac_target) : null,
          mql: r.mql_target != null ? parseFloat(r.mql_target) : null,
          formulario: r.metrica_formulario || 'lead',
        }
      })

      setRaw(sheets)
      setAccountRows(accMap)
      setProjectsList((projRes.data || []).slice().sort((a, b) => (a.company_name || '').localeCompare(b.company_name || '', 'pt-BR')))
      setCplTargets(cpl)
      setMetasExtra(metas)
      setSquadsList(sqRes.data || [])
      setLastUpdate(new Date())
    } catch (e) {
      if (mounted.current) setError(e.message)
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [source, projectId, dias, linhas, canais])

  useEffect(() => {
    mounted.current = true
    load()
    return () => { mounted.current = false }
  }, [load])

  // Lista de todas as contas do dashboard, para o seletor "+ vincular conta": só
  // quando alguém abre o seletor (uma vez por instância do hook).
  const todasPromessa = useRef(null)
  const carregarTodasContas = useCallback(() => {
    if (!todasPromessa.current) {
      todasPromessa.current = supabase.from('dash_accounts_public').select('account,channel').then(({ data, error }) => {
        if (error) { todasPromessa.current = null; return }
        if (!mounted.current || !data) return
        const ch = canaisPorConta(data)
        setAllAccountNames(Object.keys(ch).sort((a, b) => a.localeCompare(b, 'pt-BR')))
        setAccountChannels(prev => ({ ...ch, ...prev }))
      })
    }
    return todasPromessa.current
  }, [])

  // ── Resolução por conta (deriva do projeto; override quando presente) ────────
  const projectsById = useMemo(() => {
    const m = {}; projectsList.forEach(p => { m[p.id] = p }); return m
  }, [projectsList])
  const squadById = useMemo(() => {
    const m = {}; squadsList.forEach(s => { m[s.id] = s.name }); return m
  }, [squadsList])

  const accounts = useMemo(() => {
    const out = {}
    Object.entries(accountRows).forEach(([name, row]) => {
      const project = row.project_id ? projectsById[row.project_id] : null
      const acCompanyName = project?.company_name ?? null
      const squad = (row.squad_id ? squadById[row.squad_id] : null) ?? project?.squad_name ?? null
      const clickupFolderId = row.clickup_folder_id ?? project?.clickup_folder_id ?? null
      // cplTargets é indexado por company_name aparado (.trim) — apara aqui também
      // para casar nomes com espaço sobrando.
      const cplVal = acCompanyName != null ? cplTargets[acCompanyName.trim()] : null
      const mx = acCompanyName != null ? metasExtra[acCompanyName.trim()] : null
      out[name] = {
        projectId: row.project_id ?? null,
        squadOverrideId: row.squad_id ?? null,
        clickupOverride: row.clickup_folder_id ?? null,
        acCompanyName,
        squad,
        clickupFolderId,
        hidden: !!row.hidden,
        cplTarget: cplVal != null ? { value: cplVal, acName: acCompanyName } : null,
        cacTarget: mx?.cac ?? null,
        mqlTarget: mx?.mql ?? null,
        metricaFormulario: mx?.formulario ?? 'lead',
      }
    })
    return out
  }, [accountRows, projectsById, squadById, cplTargets, metasExtra])

  // Mapa simples nome → squad (usado pela lista e pelo filtro de squad).
  const squadByAccount = useMemo(() => {
    const m = {}; Object.entries(accounts).forEach(([n, a]) => { if (a.squad) m[n] = a.squad }); return m
  }, [accounts])

  // ── Mutadores (upsert parcial em dashboard_accounts; só toca a coluna passada) ─
  const upsertAccount = useCallback(async (accountName, patch) => {
    setAccountRows(prev => ({ ...prev, [accountName]: { ...prev[accountName], ...patch } }))
    await supabase.from('dashboard_accounts').upsert(
      { account_name: accountName, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'account_name' },
    )
    // No modo por projeto o `raw` só tem as contas vinculadas: (des)vincular
    // muda esse conjunto, então busca os dados de novo.
    if (projectId && 'project_id' in patch) await load()
  }, [projectId, load])

  const setSquad = useCallback((accountName, squadName) => {
    const squadId = squadName ? (squadsList.find(s => s.name === squadName)?.id ?? null) : null
    return upsertAccount(accountName, { squad_id: squadId })
  }, [squadsList, upsertAccount])

  const linkProject = useCallback((accountName, projectId) => upsertAccount(accountName, { project_id: projectId || null }), [upsertAccount])
  const setClickupFolder = useCallback((accountName, folderId) => upsertAccount(accountName, { clickup_folder_id: folderId || null }), [upsertAccount])
  const setHidden = useCallback((accountName, hidden) => upsertAccount(accountName, { hidden: !!hidden }), [upsertAccount])

  return {
    raw, accounts, squadByAccount, projectsList, squadsList, cplTargets, allAccountNames, accountChannels,
    loading, error, lastUpdate,
    reload: load, setSquad, linkProject, setClickupFolder, setHidden, carregarTodasContas,
  }
}
