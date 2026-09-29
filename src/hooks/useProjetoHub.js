// Dados do hub do projeto (coluna central da página do cliente): otimizações e
// anotações registradas pelo time, tarefas planejadas pelo Planejador, tarefas
// do ClickUp (réplica local), atas de reunião e o estado das sugestões do
// playbook. Tudo vira uma timeline única ordenada por data.
import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'

const iso = (d) => (d ? String(d).slice(0, 10) : null)
// Preview sem login (/dev/hub): a página injeta window.__DEV_HUB.hub com os dados
const devFixture = () => (import.meta.env.DEV && typeof window !== 'undefined' ? window.__DEV_HUB?.hub : null)

export function useProjetoHub(projectId) {
  const { user } = useApp()
  const [otimizacoes, setOtimizacoes] = useState([])
  const [sugestoesStatus, setSugestoesStatus] = useState([])
  const [planejadas, setPlanejadas] = useState([])
  const [tarefas, setTarefas] = useState([])
  const [atas, setAtas] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  const carregar = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setErro(null)
    const fx = devFixture()
    if (fx) {
      setOtimizacoes(fx.otimizacoes || []); setSugestoesStatus(fx.sugestoesStatus || [])
      setPlanejadas(fx.planejadas || []); setTarefas(fx.tarefas || []); setAtas(fx.atas || [])
      setLoading(false)
      return
    }
    const [o, s, p, t, a] = await Promise.all([
      supabase.from('projeto_otimizacoes').select('*').eq('project_id', projectId)
        .order('data', { ascending: false }).order('created_at', { ascending: false }).limit(200),
      supabase.from('projeto_sugestoes').select('*').eq('project_id', projectId),
      supabase.from('atividades_planejadas').select('*').eq('project_id', projectId)
        .order('created_at', { ascending: false }).limit(60),
      supabase.from('tarefas_itens')
        .select('id,titulo,status,status_tipo,prioridade,responsaveis,responsaveis_extra,data_vencimento,data_conclusao,clickup_url,tipo_tarefa,created_at,parent_id,lista:tarefas_listas!inner(id,nome,pasta:tarefas_pastas!inner(project_id))')
        .eq('lista.pasta.project_id', projectId)
        .eq('arquivada', false)
        .order('created_at', { ascending: false }).limit(150),
      supabase.from('meeting_minutes').select('id,title,meeting_date,next_actions,notes,created_at')
        .eq('project_id', projectId).order('meeting_date', { ascending: false }).limit(30),
    ])
    const falha = [o, s, p, t, a].find((r) => r.error)
    if (falha) setErro(falha.error.message)
    setOtimizacoes(o.data || [])
    setSugestoesStatus(s.data || [])
    setPlanejadas(p.data || [])
    setTarefas(t.data || [])
    setAtas(a.data || [])
    setLoading(false)
  }, [projectId])

  useEffect(() => { carregar() }, [carregar])

  // ── Escrita: otimizações e anotações ──────────────────────────────────────
  const adicionarRegistro = useCallback(async (registro) => {
    const payload = {
      project_id: projectId,
      created_by: user?.id || null,
      autor_nome: user?.name || user?.email || null,
      ...registro,
    }
    const { data, error } = devFixture()
      ? { data: { id: 'dev-' + Date.now(), created_at: new Date().toISOString(), ...payload }, error: null }
      : await supabase.from('projeto_otimizacoes').insert(payload).select().single()
    if (error) throw new Error(error.message)
    setOtimizacoes((prev) => [data, ...prev].sort((x, y) => (y.data + y.created_at).localeCompare(x.data + x.created_at)))
    return data
  }, [projectId, user])

  const atualizarRegistro = useCallback(async (id, patch) => {
    const { data, error } = await supabase.from('projeto_otimizacoes').update(patch).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    setOtimizacoes((prev) => prev.map((r) => (r.id === id ? data : r)))
    return data
  }, [])

  const removerRegistro = useCallback(async (id) => {
    const { error } = await supabase.from('projeto_otimizacoes').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setOtimizacoes((prev) => prev.filter((r) => r.id !== id))
  }, [])

  // ── Sugestões do playbook: aceitar / descartar ────────────────────────────
  const marcarSugestao = useCallback(async (sug, status, extra = {}) => {
    const row = {
      project_id: projectId,
      chave: sug.chave,
      status,
      titulo: sug.titulo,
      payload: sug,
      created_by: user?.id || null,
      ...extra,
    }
    const { data, error } = devFixture()
      ? { data: { id: 'dev-' + Date.now(), created_at: new Date().toISOString(), ...row }, error: null }
      : await supabase.from('projeto_sugestoes').upsert(row, { onConflict: 'project_id,chave' }).select().single()
    if (error) throw new Error(error.message)
    setSugestoesStatus((prev) => [...prev.filter((r) => r.chave !== sug.chave), data])
    return data
  }, [projectId, user])

  const reabrirSugestao = useCallback(async (chave) => {
    const { error } = await supabase.from('projeto_sugestoes').delete().eq('project_id', projectId).eq('chave', chave)
    if (error) throw new Error(error.message)
    setSugestoesStatus((prev) => prev.filter((r) => r.chave !== chave))
  }, [projectId])

  const registrarPlanejada = useCallback((registro) => {
    if (registro) setPlanejadas((prev) => [registro, ...prev])
  }, [])

  // ── Timeline unificada ────────────────────────────────────────────────────
  const timeline = useMemo(() => {
    const itens = []
    for (const r of otimizacoes) {
      itens.push({
        id: `o:${r.id}`, kind: r.tipo === 'anotacao' ? 'anotacao' : 'otimizacao',
        data: r.data, ts: r.created_at, titulo: r.acao, registro: r,
        url: r.clickup_task_url || null,
      })
    }
    for (const p of planejadas) {
      itens.push({
        id: `p:${p.id}`, kind: 'planejada', data: iso(p.created_at), ts: p.created_at,
        titulo: p.titulo, registro: p, url: p.clickup_task_url || null,
        prazo: p.data_escolhida, status: p.status,
      })
    }
    for (const t of tarefas) {
      if (t.parent_id) continue
      const fechada = t.status_tipo === 'closed'
      itens.push({
        id: `t:${t.id}`, kind: 'tarefa', data: iso(fechada ? t.data_conclusao || t.created_at : t.created_at), ts: t.created_at,
        titulo: t.titulo, registro: t, url: t.clickup_url || null,
        prazo: iso(t.data_vencimento), fechada, status: t.status, lista: t.lista?.nome,
      })
    }
    for (const a of atas) {
      itens.push({
        id: `a:${a.id}`, kind: 'reuniao', data: iso(a.meeting_date) || iso(a.created_at), ts: a.created_at,
        titulo: a.title || 'Reunião', registro: a,
      })
    }
    return itens.sort((x, y) => ((y.data || '') + (y.ts || '')).localeCompare((x.data || '') + (x.ts || '')))
  }, [otimizacoes, planejadas, tarefas, atas])

  return {
    loading, erro, recarregar: carregar,
    otimizacoes, planejadas, tarefas, atas, sugestoesStatus, timeline,
    adicionarRegistro, atualizarRegistro, removerRegistro,
    marcarSugestao, reabrirSugestao, registrarPlanejada,
  }
}
