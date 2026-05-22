import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SHEETS, parseCSV } from '../lib/dashboardData'

// ─────────────────────────────────────────────────────────────────────────────
// Hook de dados do Dashboard de Tráfego.
//
// Centraliza o carregamento das 4 fontes (planilhas Meta/Google em CSV +
// client_squads + cpl_targets_public + client_mapping no Supabase da AC) e expõe
// os mutadores (setSquad, saveMapping, removeMapping, saveClickupFolder).
//
// Tudo passa pelo client Supabase único da AC — que já está autenticado pela
// sessão do usuário logado (RequireAuth), satisfazendo a RLS `authenticated`
// das tabelas migradas.
// ─────────────────────────────────────────────────────────────────────────────

async function loadSheets() {
  const [metaText, googleText] = await Promise.all([
    fetch(SHEETS.meta).then(r => { if (!r.ok) throw new Error('Meta Ads: HTTP ' + r.status); return r.text() }),
    fetch(SHEETS.google).then(r => { if (!r.ok) throw new Error('Google Ads: HTTP ' + r.status); return r.text() }),
  ])
  return { meta: parseCSV(metaText), google: parseCSV(googleText) }
}

async function loadSquads() {
  const { data, error } = await supabase.from('client_squads').select('client_name,squad')
  if (error || !data) return {}
  const map = {}
  data.forEach(r => { map[r.client_name] = r.squad })
  return map
}

// cplTargets (por company_name da AC) + lista de empresas para o dropdown de vínculo.
async function loadCplTargets() {
  const cplTargets = {}
  const acCompanyList = []
  const { data } = await supabase.from('cpl_targets_public').select('company_name,cpl_target')
  if (data) {
    data.forEach(r => {
      const name = r.company_name?.trim()
      if (!name) return
      acCompanyList.push(name)
      if (r.cpl_target != null) cplTargets[name] = parseFloat(r.cpl_target)
    })
    acCompanyList.sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }
  return { cplTargets, acCompanyList }
}

// clientMapping: { [dashboardName]: { acName, clickupFolderId } }
async function loadClientMapping() {
  const map = {}
  const { data } = await supabase.from('client_mapping').select('dashboard_name,ac_company_name,clickup_folder_id')
  if (data) {
    data.forEach(r => {
      map[r.dashboard_name] = { acName: r.ac_company_name || null, clickupFolderId: r.clickup_folder_id || null }
    })
  }
  return map
}

export function useDashboardData() {
  const [raw, setRaw] = useState({ meta: [], google: [] })
  const [squads, setSquads] = useState({})
  const [cplTargets, setCplTargets] = useState({})
  const [acCompanyList, setAcCompanyList] = useState([])
  const [clientMapping, setClientMapping] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const mounted = useRef(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [sheets, sq, cpl, mapping] = await Promise.all([
        loadSheets(),
        loadSquads(),
        loadCplTargets(),
        loadClientMapping(),
      ])
      if (!mounted.current) return
      setRaw(sheets)
      setSquads(sq)
      setCplTargets(cpl.cplTargets)
      setAcCompanyList(cpl.acCompanyList)
      setClientMapping(mapping)
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

  // ── Mutadores ────────────────────────────────────────────────────────────
  const setSquad = useCallback(async (clientName, squad) => {
    setSquads(prev => {
      const next = { ...prev }
      if (squad) next[clientName] = squad
      else delete next[clientName]
      return next
    })
    if (squad) {
      await supabase.from('client_squads').upsert(
        { client_name: clientName, squad, updated_at: new Date().toISOString() },
        { onConflict: 'client_name' },
      )
    } else {
      await supabase.from('client_squads').delete().eq('client_name', clientName)
    }
  }, [])

  // Salva o vínculo dashboard → empresa da AC, preservando o clickup_folder_id atual.
  const saveMapping = useCallback(async (dashName, acName) => {
    const prev = clientMapping[dashName] || {}
    if (acName) {
      await supabase.from('client_mapping').upsert(
        { dashboard_name: dashName, ac_company_name: acName, clickup_folder_id: prev.clickupFolderId || null, updated_at: new Date().toISOString() },
        { onConflict: 'dashboard_name' },
      )
      setClientMapping(p => ({ ...p, [dashName]: { acName, clickupFolderId: prev.clickupFolderId || null } }))
    } else if (prev.clickupFolderId) {
      // Mantém o vínculo de pasta ClickUp, limpa só o nome da AC.
      await supabase.from('client_mapping').upsert(
        { dashboard_name: dashName, ac_company_name: null, clickup_folder_id: prev.clickupFolderId, updated_at: new Date().toISOString() },
        { onConflict: 'dashboard_name' },
      )
      setClientMapping(p => ({ ...p, [dashName]: { acName: null, clickupFolderId: prev.clickupFolderId } }))
    } else {
      await supabase.from('client_mapping').delete().eq('dashboard_name', dashName)
      setClientMapping(p => { const n = { ...p }; delete n[dashName]; return n })
    }
  }, [clientMapping])

  const removeMapping = useCallback(async (dashName) => {
    await supabase.from('client_mapping').delete().eq('dashboard_name', dashName)
    setClientMapping(p => { const n = { ...p }; delete n[dashName]; return n })
  }, [])

  // Salva/atualiza apenas a pasta do ClickUp vinculada (preserva o ac_company_name).
  const saveClickupFolder = useCallback(async (dashName, folderId) => {
    const prev = clientMapping[dashName] || {}
    await supabase.from('client_mapping').upsert(
      { dashboard_name: dashName, ac_company_name: prev.acName || null, clickup_folder_id: folderId || null, updated_at: new Date().toISOString() },
      { onConflict: 'dashboard_name' },
    )
    setClientMapping(p => ({ ...p, [dashName]: { acName: prev.acName || null, clickupFolderId: folderId || null } }))
  }, [clientMapping])

  return {
    raw, squads, cplTargets, acCompanyList, clientMapping,
    loading, error, lastUpdate,
    reload: load, setSquad, saveMapping, removeMapping, saveClickupFolder,
  }
}
