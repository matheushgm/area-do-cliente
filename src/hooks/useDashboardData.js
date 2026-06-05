import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SHEETS, parseCSV } from '../lib/dashboardData'

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

async function loadSheets() {
  const [metaText, googleText] = await Promise.all([
    fetch(SHEETS.meta).then(r => { if (!r.ok) throw new Error('Meta Ads: HTTP ' + r.status); return r.text() }),
    fetch(SHEETS.google).then(r => { if (!r.ok) throw new Error('Google Ads: HTTP ' + r.status); return r.text() }),
  ])
  return { meta: parseCSV(metaText), google: parseCSV(googleText) }
}

export function useDashboardData() {
  const [raw, setRaw] = useState({ meta: [], google: [] })
  // Linhas-base de dashboard_accounts: { [account_name]: { project_id, squad_id, clickup_folder_id } }
  const [accountRows, setAccountRows] = useState({})
  const [projectsList, setProjectsList] = useState([])   // [{ id, company_name, squad_name, clickup_folder_id }]
  const [squadsList, setSquadsList] = useState([])        // [{ id, name }]
  const [cplTargets, setCplTargets] = useState({})        // { company_name: number }
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
      const [sheets, accRes, projRes, cplRes, sqRes] = await Promise.all([
        loadSheets(),
        supabase.from('dashboard_accounts_public').select('account_name,project_id,squad_id,clickup_folder_id'),
        supabase.from('dashboard_projects_public').select('id,company_name,squad_name,clickup_folder_id'),
        supabase.from('cpl_targets_public').select('company_name,cpl_target'),
        supabase.from('dashboard_squads_public').select('id,name'),
      ])
      if (!mounted.current) return
      const accMap = {}
      ;(accRes.data || []).forEach(r => { accMap[r.account_name] = { project_id: r.project_id, squad_id: r.squad_id, clickup_folder_id: r.clickup_folder_id } })
      const cpl = {}
      ;(cplRes.data || []).forEach(r => { const n = r.company_name?.trim(); if (n && r.cpl_target != null) cpl[n] = parseFloat(r.cpl_target) })

      setRaw(sheets)
      setAccountRows(accMap)
      setProjectsList((projRes.data || []).slice().sort((a, b) => (a.company_name || '').localeCompare(b.company_name || '', 'pt-BR')))
      setCplTargets(cpl)
      setSquadsList(sqRes.data || [])
      setLastUpdate(new Date())
    } catch (e) {
      if (mounted.current) setError(e.message)
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    load()
    return () => { mounted.current = false }
  }, [load])

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
      const cplVal = acCompanyName != null ? cplTargets[acCompanyName] : null
      out[name] = {
        projectId: row.project_id ?? null,
        squadOverrideId: row.squad_id ?? null,
        clickupOverride: row.clickup_folder_id ?? null,
        acCompanyName,
        squad,
        clickupFolderId,
        cplTarget: cplVal != null ? { value: cplVal, acName: acCompanyName } : null,
      }
    })
    return out
  }, [accountRows, projectsById, squadById, cplTargets])

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
  }, [])

  const setSquad = useCallback((accountName, squadName) => {
    const squadId = squadName ? (squadsList.find(s => s.name === squadName)?.id ?? null) : null
    return upsertAccount(accountName, { squad_id: squadId })
  }, [squadsList, upsertAccount])

  const linkProject = useCallback((accountName, projectId) => upsertAccount(accountName, { project_id: projectId || null }), [upsertAccount])
  const setClickupFolder = useCallback((accountName, folderId) => upsertAccount(accountName, { clickup_folder_id: folderId || null }), [upsertAccount])

  return {
    raw, accounts, squadByAccount, projectsList, squadsList, cplTargets,
    loading, error, lastUpdate,
    reload: load, setSquad, linkProject, setClickupFolder,
  }
}
