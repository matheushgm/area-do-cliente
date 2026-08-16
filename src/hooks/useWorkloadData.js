import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { buildWorkload } from '../lib/workload'

// Colunas necessárias para a página. Selecionar explícito (em vez de `*`) evita
// trazer campos grandes que a UI não usa.
const COLS = 'task_id,name,url,status,status_bucket,closed,assignees,due_date,' +
             'start_date,date_updated,time_estimate_ms,list_name,folder_name,space_name,priority'

const PAGE = 1000  // limite default do PostgREST — paginamos para não truncar

const isOpen = t => !t.closed && !t.deleted_at

/**
 * Estado da Capacidade do Time, lido do cache `clickup_tasks` no Supabase.
 *
 * Nunca chama a API do ClickUp: quem popula o cache é o webhook (tempo real) e
 * o sync de reconciliação. Por isso o custo de requisição ao ClickUp é o mesmo
 * com 1 ou com 20 pessoas olhando a página.
 */
export function useWorkloadData() {
  const [tasks, setTasks]         = useState([])
  const [syncState, setSyncState] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [syncing, setSyncing]     = useState(false)
  const [error, setError]         = useState(null)
  const mounted = useRef(true)

  const load = useCallback(async () => {
    if (!supabase) { setError('Supabase não configurado.'); setLoading(false); return }
    setError(null)
    try {
      const all = []
      for (let from = 0; ; from += PAGE) {
        const { data, error: e } = await supabase
          .from('clickup_tasks')
          .select(COLS)
          .eq('closed', false)
          .is('deleted_at', null)
          .range(from, from + PAGE - 1)
        if (e) throw e
        all.push(...(data || []))
        if (!data || data.length < PAGE) break
      }
      const { data: st } = await supabase
        .from('clickup_sync_state').select('*').eq('id', 'workspace').maybeSingle()

      if (!mounted.current) return
      setTasks(all)
      setSyncState(st || null)
    } catch (e) {
      if (mounted.current) setError(e?.message || 'Erro ao carregar tarefas.')
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    load()
    return () => { mounted.current = false }
  }, [load])

  // Realtime: o webhook grava no Supabase e a tela reflete na hora, sem polling.
  useEffect(() => {
    if (!supabase) return
    const ch = supabase
      .channel('clickup_tasks_workload')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clickup_tasks' }, payload => {
        if (!mounted.current) return
        const row = payload.new
        const id  = row?.task_id ?? payload.old?.task_id
        if (!id) return
        setTasks(prev => {
          const rest = prev.filter(t => t.task_id !== id)
          // Tarefa fechada/apagada sai da carga; aberta entra ou é substituída.
          if (payload.eventType === 'DELETE' || !row || !isOpen(row)) return rest
          return [...rest, row]
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  /** Dispara o sync de reconciliação (botão "Atualizar agora"). */
  const syncNow = useCallback(async (mode = 'incremental') => {
    if (!supabase) return { ok: false, error: 'Supabase não configurado.' }
    setSyncing(true)
    try {
      const { data: s } = await supabase.auth.getSession()
      const token = s?.session?.access_token
      if (!token) return { ok: false, error: 'Sessão expirada.' }

      const res  = await fetch(`/api/clickup-sync?mode=${mode}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) return { ok: false, error: body?.error || `HTTP ${res.status}` }
      await load()
      return { ok: true, ...body }
    } catch (e) {
      return { ok: false, error: e?.message || 'Erro inesperado.' }
    } finally {
      if (mounted.current) setSyncing(false)
    }
  }, [load])

  const workload = useMemo(() => buildWorkload(tasks), [tasks])

  return { workload, tasks, syncState, loading, syncing, error, reload: load, syncNow }
}
