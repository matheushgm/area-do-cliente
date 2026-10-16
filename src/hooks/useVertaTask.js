// Dados do VertaTask: ciclos, módulos e a fila de Intake, direto no Supabase
// (RLS: todo o time). As tarefas em si continuam em useTarefas.
import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'

export function useVertaTask(user) {
  const [ciclos, setCiclos] = useState([])
  const [modulos, setModulos] = useState([])
  const [intake, setIntake] = useState([])
  const [loading, setLoading] = useState(true)

  const ciclosMap = useMemo(() => new Map(ciclos.map((c) => [c.id, c])), [ciclos])
  const modulosMap = useMemo(() => new Map(modulos.map((m) => [m.id, m])), [modulos])

  const carregar = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    try {
      const [c, m, i] = await Promise.all([
        supabase.from('tarefas_ciclos').select('*').eq('arquivado', false).order('inicio'),
        supabase.from('tarefas_modulos').select('*').eq('arquivado', false).order('nome'),
        supabase.from('tarefas_intake').select('*').order('created_at', { ascending: false }).limit(300),
      ])
      if (c.error) throw c.error
      if (m.error) throw m.error
      if (i.error) throw i.error
      setCiclos(c.data || [])
      setModulos(m.data || [])
      setIntake(i.data || [])
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

  // ── Módulos ────────────────────────────────────────────────────────────────
  const criarModulo = useCallback(async ({ nome, descricao, project_id }) => {
    const { data, error } = await supabase.from('tarefas_modulos').insert({ nome: nome.trim(), descricao: descricao?.trim() || null, project_id: project_id || null }).select().single()
    if (error) return { error: error.message }
    setModulos((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome))))
    return { data }
  }, [])

  const atualizarModulo = useCallback(async (id, patch) => {
    const { data, error } = await supabase.from('tarefas_modulos').update(patch).eq('id', id).select().single()
    if (error) return { error: error.message }
    setModulos((prev) => prev.map((m) => (m.id === id ? data : m)).filter((m) => !m.arquivado))
    return { data }
  }, [])

  const excluirModulo = useCallback(async (id) => {
    const { error } = await supabase.from('tarefas_modulos').delete().eq('id', id)
    if (error) return { error: error.message }
    setModulos((prev) => prev.filter((m) => m.id !== id))
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

  const decidirIntake = useCallback(async (id, { status, tarefa_id = null, motivo_recusa = null }) => {
    const patch = { status, tarefa_id, motivo_recusa, decidido_por: user?.id || null, decidido_em: new Date().toISOString() }
    const { data, error } = await supabase.from('tarefas_intake').update(patch).eq('id', id).select().single()
    if (error) return { error: error.message }
    setIntake((prev) => prev.map((i) => (i.id === id ? data : i)))
    return { data }
  }, [user?.id])

  const reabrirIntake = useCallback(async (id) => {
    const { data, error } = await supabase.from('tarefas_intake').update({ status: 'pendente', tarefa_id: null, motivo_recusa: null, decidido_por: null, decidido_em: null }).eq('id', id).select().single()
    if (error) return { error: error.message }
    setIntake((prev) => prev.map((i) => (i.id === id ? data : i)))
    return { data }
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tarefas_modulos' }, aplicar(setModulos, (a, b) => a.nome.localeCompare(b.nome)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tarefas_intake' }, ({ eventType, new: row, old }) => {
        setIntake((prev) => {
          if (eventType === 'DELETE') return prev.filter((x) => x.id !== old.id)
          const i = prev.findIndex((x) => x.id === row.id)
          if (i < 0) return [row, ...prev]
          const n = [...prev]; n[i] = row; return n
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const intakePendentes = useMemo(() => intake.filter((i) => i.status === 'pendente'), [intake])

  return {
    ciclos, modulos, intake, intakePendentes, ciclosMap, modulosMap, loading,
    carregar, criarCiclo, atualizarCiclo, excluirCiclo, criarModulo, atualizarModulo, excluirModulo,
    criarIntake, decidirIntake, reabrirIntake,
  }
}
