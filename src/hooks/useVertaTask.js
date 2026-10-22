// Dados do VertaTask: ciclos, Intake, etiquetas, views compartilhadas e templates,
// direto no Supabase (RLS: todo o time). As tarefas em si continuam em useTarefas.
import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const porNome = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR')

export function useVertaTask(user) {
  const [ciclos, setCiclos] = useState([])
  const [intake, setIntake] = useState([])
  const [etiquetas, setEtiquetas] = useState([])
  const [views, setViews] = useState([])
  const [modelos, setModelos] = useState([])
  const [loading, setLoading] = useState(true)

  const ciclosMap = useMemo(() => new Map(ciclos.map((c) => [c.id, c])), [ciclos])
  const etiquetasMap = useMemo(() => new Map(etiquetas.map((e) => [e.id, e])), [etiquetas])

  const carregar = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    try {
      const [c, i, et, vw, md] = await Promise.all([
        supabase.from('tarefas_ciclos').select('*').eq('arquivado', false).order('inicio'),
        supabase.from('tarefas_intake').select('*').order('created_at', { ascending: false }).limit(300),
        supabase.from('tarefas_etiquetas').select('*').order('nome'),
        supabase.from('tarefas_views').select('*').order('created_at'),
        supabase.from('tarefas_modelos').select('*').order('nome'),
      ])
      if (c.error) throw c.error
      if (i.error) throw i.error
      setCiclos(c.data || [])
      setIntake(i.data || [])
      setEtiquetas(et.data || [])
      setViews(vw.data || [])
      setModelos(md.data || [])
    } catch (e) {
      console.error('Erro ao carregar VertaTask:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // ── Ciclos ─────────────────────────────────────────────────────────────────
  const criarCiclo = useCallback(async ({ nome, inicio, fim }) => {
    const { data, error } = await supabase.from('tarefas_ciclos').insert({ nome: nome.trim(), inicio, fim }).select().single()
    if (error) return { error: error.message }
    setCiclos((prev) => (prev.some((c) => c.id === data.id) ? prev : [...prev, data].sort((a, b) => a.inicio.localeCompare(b.inicio))))
    return { data }
  }, [])

  const atualizarCiclo = useCallback(async (id, patch) => {
    const { data, error } = await supabase.from('tarefas_ciclos').update(patch).eq('id', id).select().single()
    if (error) return { error: error.message }
    setCiclos((prev) => prev.map((c) => (c.id === id ? data : c)).filter((c) => !c.arquivado))
    return { data }
  }, [])

  const excluirCiclo = useCallback(async (id) => {
    const { error } = await supabase.from('tarefas_ciclos').delete().eq('id', id)
    if (error) return { error: error.message }
    setCiclos((prev) => prev.filter((c) => c.id !== id))
    return {}
  }, [])

  // ── Intake ─────────────────────────────────────────────────────────────────
  const criarIntake = useCallback(async ({ titulo, descricao, origem, project_id, prioridade }) => {
    const { data, error } = await supabase.from('tarefas_intake').insert({
      titulo: titulo.trim(), descricao: descricao?.trim() || null, origem: origem || 'Manual',
      project_id: project_id || null, prioridade: prioridade || null, criado_por: user?.id || null,
    }).select().single()
    if (error) return { error: error.message }
    setIntake((prev) => (prev.some((i) => i.id === data.id) ? prev : [data, ...prev]))
    return { data }
  }, [user?.id])

  const decidirIntake = useCallback(async (id, { status, tarefa_id = null, motivo_recusa = null, ...extra }) => {
    const patch = { status, tarefa_id, motivo_recusa, ...extra, decidido_por: user?.id || null, decidido_em: new Date().toISOString() }
    const { data, error } = await supabase.from('tarefas_intake').update(patch).eq('id', id).select().single()
    if (error) return { error: error.message }
    setIntake((prev) => prev.map((i) => (i.id === id ? data : i)))
    return { data }
  }, [user?.id])

  const reabrirIntake = useCallback(async (id) => {
    const { data, error } = await supabase.from('tarefas_intake').update({ status: 'pendente', tarefa_id: null, motivo_recusa: null, adiado_ate: null, duplicada_de: null, decidido_por: null, decidido_em: null }).eq('id', id).select().single()
    if (error) return { error: error.message }
    setIntake((prev) => prev.map((i) => (i.id === id ? data : i)))
    return { data }
  }, [])

  // ── Etiquetas ──────────────────────────────────────────────────────────────
  const criarEtiqueta = useCallback(async ({ nome, cor }) => {
    const { data, error } = await supabase.from('tarefas_etiquetas').insert({ nome: nome.trim(), cor: cor || '#2A25F0' }).select().single()
    if (error) return { error: error.code === '23505' ? 'Já existe uma etiqueta com esse nome.' : error.message }
    setEtiquetas((prev) => (prev.some((e) => e.id === data.id) ? prev : [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))))
    return { data }
  }, [])
  const excluirEtiqueta = useCallback(async (id) => {
    const { error } = await supabase.from('tarefas_etiquetas').delete().eq('id', id)
    if (error) return { error: error.message }
    setEtiquetas((prev) => prev.filter((e) => e.id !== id))
    return {}
  }, [])

  // ── Views compartilhadas ───────────────────────────────────────────────────
  const criarView = useCallback(async ({ nome, config, acesso = 'publica' }) => {
    const { data, error } = await supabase.from('tarefas_views').insert({ nome: nome.trim(), config, acesso, dono_id: user?.id }).select().single()
    if (error) return { error: error.message }
    setViews((prev) => (prev.some((v) => v.id === data.id) ? prev : [...prev, data]))
    return { data }
  }, [user?.id])
  const atualizarView = useCallback(async (id, patch) => {
    const { data, error } = await supabase.from('tarefas_views').update(patch).eq('id', id).select().single()
    if (error) return { error: error.message }
    setViews((prev) => prev.map((v) => (v.id === id ? data : v)))
    return { data }
  }, [])
  const excluirView = useCallback(async (id) => {
    const { error } = await supabase.from('tarefas_views').delete().eq('id', id)
    if (error) return { error: error.message }
    setViews((prev) => prev.filter((v) => v.id !== id))
    return {}
  }, [])

  // ── Templates (tarefas_modelos) ────────────────────────────────────────────
  // itens = árvore do template (ver src/lib/templates.js); payload é legado.
  const criarModelo = useCallback(async ({ nome, descricao = null, itens = [] }) => {
    const { data, error } = await supabase.from('tarefas_modelos').insert({ nome: nome.trim(), descricao, itens, dono_id: user?.id }).select().single()
    if (error) return { error: error.message }
    setModelos((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data].sort(porNome)))
    return { data }
  }, [user?.id])
  const atualizarModelo = useCallback(async (id, patch) => {
    const { data, error } = await supabase.from('tarefas_modelos').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().single()
    if (error) return { error: error.message }
    setModelos((prev) => prev.map((m) => (m.id === id ? data : m)).sort(porNome))
    return { data }
  }, [])
  const excluirModelo = useCallback(async (id) => {
    const { error } = await supabase.from('tarefas_modelos').delete().eq('id', id)
    if (error) return { error: error.message }
    setModelos((prev) => prev.filter((m) => m.id !== id))
    return {}
  }, [])

  // ── Realtime ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) return undefined
    const aplicar = (setter, ordenar) => ({ eventType, new: row, old }) => {
      setter((prev) => {
        if (eventType === 'DELETE') return prev.filter((x) => x.id !== old.id)
        if (row.arquivado) return prev.filter((x) => x.id !== row.id)
        const i = prev.findIndex((x) => x.id === row.id)
        const next = i < 0 ? [...prev, row] : prev.map((x) => (x.id === row.id ? row : x))
        return ordenar ? next.sort(ordenar) : next
      })
    }
    const ch = supabase
      .channel('vertatask-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tarefas_ciclos' }, aplicar(setCiclos, (a, b) => a.inicio.localeCompare(b.inicio)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tarefas_modelos' }, aplicar(setModelos, porNome))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tarefas_intake' }, ({ eventType, new: row, old }) => {
        setIntake((prev) => {
          if (eventType === 'DELETE') return prev.filter((x) => x.id !== old.id)
          const i = prev.findIndex((x) => x.id === row.id)
          if (i < 0) return [row, ...prev]
          const n = [...prev]; n[i] = row; return n
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tarefas_etiquetas' }, ({ eventType, new: row, old }) => {
        setEtiquetas((prev) => {
          if (eventType === 'DELETE') return prev.filter((x) => x.id !== old.id)
          const i = prev.findIndex((x) => x.id === row.id)
          if (i < 0) return [...prev, row].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
          const n = [...prev]; n[i] = row; return n
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tarefas_views' }, ({ eventType, new: row, old }) => {
        setViews((prev) => {
          if (eventType === 'DELETE') return prev.filter((x) => x.id !== old.id)
          const i = prev.findIndex((x) => x.id === row.id)
          if (i < 0) return [...prev, row]
          const n = [...prev]; n[i] = row; return n
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  // adiado volta para a fila quando a data passa
  const intakePendentes = useMemo(() => intake.filter((i) => i.status === 'pendente' || (i.status === 'adiado' && i.adiado_ate && new Date(i.adiado_ate) <= new Date())), [intake])
  const intakeAdiados = useMemo(() => intake.filter((i) => i.status === 'adiado' && i.adiado_ate && new Date(i.adiado_ate) > new Date()), [intake])

  return {
    ciclos, intake, intakePendentes, intakeAdiados, ciclosMap, loading,
    etiquetas, etiquetasMap, views, modelos,
    criarEtiqueta, excluirEtiqueta, criarView, atualizarView, excluirView, criarModelo, atualizarModelo, excluirModelo,
    carregar, criarCiclo, atualizarCiclo, excluirCiclo,
    criarIntake, decidirIntake, reabrirIntake,
  }
}
