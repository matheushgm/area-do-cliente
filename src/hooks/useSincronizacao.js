// Dados do painel Sincronização do VertaTask: fila VertaTask → ClickUp (tarefas_outbox), rastro
// da volta (tarefas_sync_log, migration 121), estado das rodadas e do webhook (tarefas_sync) e,
// no modo de uma tarefa só, o histórico de edições (tarefas_atividade). Relê a cada 15 s com
// a aba visível; sem realtime, porque uma edição em massa geraria centenas de eventos.
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'

const POLL_MS = 15_000
const COLS_TAREFA = 'id, titulo, lista_id, parent_id, clickup_task_id, clickup_url, arquivada, status, status_tipo'
const tabelaFalta = (e) => !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|could not find the table/i.test(e.message || ''))

async function emFatias(ids, fn, n = 150) {
  const out = []
  for (let i = 0; i < ids.length; i += n) {
    const { data } = await fn(ids.slice(i, i + n))
    out.push(...(data || []))
  }
  return out
}

export function useSincronizacao({ dias = 7, tarefaId = null, ecos = false } = {}) {
  const [d, setD] = useState({ fila: [], log: [], estado: {}, tarefas: new Map(), atividade: [], logIndisponivel: false })
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const vivo = useRef(true)
  const chave = useRef(0)

  const carregar = useCallback(async () => {
    const minha = ++chave.current
    // /dev/sincronizacao (só em DEV): dados em memória, sem banco
    const dev = import.meta.env.DEV ? window.__DEV_SYNC : null
    if (dev) { setD(dev.dados({ dias, tarefaId, ecos })); setCarregando(false); return }
    const desde = new Date(Date.now() - dias * 86400000).toISOString()
    try {
      let qFila = supabase.from('tarefas_outbox').select('*').order('id', { ascending: false })
      let qLog = supabase.from('tarefas_sync_log').select('*').order('id', { ascending: false })
      if (tarefaId) {
        qFila = qFila.eq('tarefa_id', tarefaId).limit(500)
        qLog = qLog.eq('tarefa_id', tarefaId).limit(500)
      } else {
        qFila = qFila.gte('created_at', desde).limit(3000)
        qLog = qLog.gte('created_at', desde).limit(2000)
      }
      if (!ecos) qLog = qLog.neq('acao', 'sem_mudanca')
      const [rFila, rAbertos, rLog, rEstado, rAtiv] = await Promise.all([
        qFila,
        // o que ainda não terminou aparece sempre, mesmo fora do período
        tarefaId ? Promise.resolve({ data: [] }) : supabase.from('tarefas_outbox').select('*').in('status', ['pendente', 'processando', 'erro']).order('id').limit(1000),
        qLog,
        supabase.from('tarefas_sync').select('*'),
        tarefaId ? supabase.from('tarefas_atividade').select('*').eq('tarefa_id', tarefaId).order('created_at', { ascending: false }).limit(200) : Promise.resolve({ data: [] }),
      ])
      if (rFila.error) throw new Error(rFila.error.message)
      const porId = new Map()
      for (const it of [...(rFila.data || []), ...(rAbertos.data || [])]) porId.set(it.id, it)
      const fila = [...porId.values()].sort((a, b) => b.id - a.id)
      const logIndisponivel = tabelaFalta(rLog.error)
      const log = rLog.error ? [] : (rLog.data || [])

      // títulos das tarefas citadas (pelo id e, no log sem id, pelo id do ClickUp)
      const ids = [...new Set([...fila.map((i) => i.tarefa_id), ...log.map((l) => l.tarefa_id), tarefaId].filter(Boolean))]
      const cus = [...new Set(log.filter((l) => !l.tarefa_id && l.clickup_task_id).map((l) => l.clickup_task_id))]
      const [porIds, porCu] = await Promise.all([
        emFatias(ids, (f) => supabase.from('tarefas_itens').select(COLS_TAREFA).in('id', f)),
        emFatias(cus, (f) => supabase.from('tarefas_itens').select(COLS_TAREFA).in('clickup_task_id', f)),
      ])
      const tarefas = new Map()
      for (const x of [...porIds, ...porCu]) { tarefas.set(x.id, x); if (x.clickup_task_id) tarefas.set(`cu:${x.clickup_task_id}`, x) }

      if (!vivo.current || minha !== chave.current) return
      setD({
        fila, log, logIndisponivel, tarefas,
        estado: Object.fromEntries((rEstado.data || []).map((r) => [r.id, r])),
        atividade: rAtiv.data || [],
      })
      setErro(null)
    } catch (e) {
      if (vivo.current && minha === chave.current) setErro(e.message)
    } finally {
      if (vivo.current && minha === chave.current) setCarregando(false)
    }
  }, [dias, tarefaId, ecos])

  useEffect(() => {
    vivo.current = true
    setCarregando(true)
    carregar()
    const id = setInterval(() => { if (document.visibilityState === 'visible') carregar() }, POLL_MS)
    return () => { vivo.current = false; clearInterval(id) }
  }, [carregar])

  // depois de mexer na fila, empurra na hora em vez de esperar a próxima escrita ou o cron
  const empurrar = useCallback(async () => {
    if (import.meta.env.DEV && window.__DEV_SYNC) return carregar()
    try { await apiFetch('/api/tarefas-push', { body: {} }) } catch { /* o cron e o botão assumem */ }
    carregar()
  }, [carregar])

  const rpc = useCallback(async (nome, args, empurrarDepois = true) => {
    const dev = import.meta.env.DEV ? window.__DEV_SYNC : null
    const { data, error } = dev ? dev.rpc(nome, args) : await supabase.rpc(nome, args)
    if (error) return { error: /could not find the function/i.test(error.message) ? 'Aplique a migration 121 para usar esta ação.' : error.message }
    carregar()
    if (empurrarDepois) empurrar()
    return { data }
  }, [carregar, empurrar])

  return {
    ...d, carregando, erro, recarregar: carregar,
    reenviar: (ids) => rpc('tarefas_outbox_reenviar', { p_ids: ids }),
    ignorar: (ids) => rpc('tarefas_outbox_ignorar', { p_ids: ids }, false),
    forcar: (id) => rpc('tarefas_outbox_forcar', { p_tarefa: id }),
    sincronizarAgora: async () => {
      if (import.meta.env.DEV && window.__DEV_SYNC) return { ok: true }
      const r = await apiFetch('/api/tarefas-sync', { body: {} })
      carregar()
      return r
    },
  }
}
