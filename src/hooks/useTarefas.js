// Camada de dados do módulo Tarefas: pastas → listas → tarefas → comentários,
// direto no Supabase (RLS: todo o time). Atualizações otimistas + realtime
// para que duas pessoas na mesma lista vejam as mudanças uma da outra.
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { apiFetch } from '../lib/api'
import { supabase } from '../lib/supabase'
import { STATUSES_PADRAO, statusDaLista, statusInicial } from '../lib/tarefas'

const PAGINA = 1000

async function selectPaginado(query) {
  const out = []
  for (let de = 0; de < 100000; de += PAGINA) {
    const { data, error } = await query.range(de, de + PAGINA - 1)
    if (error) throw error
    out.push(...(data || []))
    if (!data || data.length < PAGINA) break
  }
  return out
}

/**
 * Como o selectPaginado, mas a 1ª página traz a contagem e as demais saem juntas (2 idas ao
 * servidor em vez de uma por página). `montar(comContagem)` devolve uma query NOVA a cada
 * chamada, com ordem total (desempate por id), senão as páginas repetem ou pulam linhas.
 */
async function selectParalelo(montar) {
  const { data, count, error } = await montar(true).range(0, PAGINA - 1)
  if (error) throw error
  const resto = Math.max(0, Math.ceil((count ?? 0) / PAGINA) - 1)
  const paginas = await Promise.all(Array.from({ length: resto }, (_, k) => montar(false).range((k + 1) * PAGINA, (k + 2) * PAGINA - 1)))
  const out = [...(data || [])]
  for (const pg of paginas) { if (pg.error) throw pg.error; out.push(...(pg.data || [])) }
  return out
}

export function useTarefas(user) {
  const [pastas, setPastas] = useState([])
  const [listas, setListas] = useState([])
  const [loadingEstrutura, setLoadingEstrutura] = useState(true)
  const [itens, setItens] = useState({})            // id → tarefa
  const [comentarios, setComentarios] = useState({}) // tarefaId → [comentário]
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)
  const carregadas = useRef(new Set())               // lista_id já carregada
  const minhasCarregadas = useRef(false)
  const camposCarregados = useRef({ ciclo_id: new Set() }) // VertaTask: ciclo já carregado

  const listasMap = useMemo(() => new Map(listas.map((l) => [l.id, l])), [listas])
  const pastasMap = useMemo(() => new Map(pastas.map((p) => [p.id, p])), [pastas])

  // ── Estrutura ──────────────────────────────────────────────────────────────
  const carregarEstrutura = useCallback(async () => {
    setLoadingEstrutura(true)
    try {
      const [{ data: p, error: e1 }, { data: l, error: e2 }] = await Promise.all([
        supabase.from('tarefas_pastas').select('*').eq('arquivada', false).order('posicao').order('nome'),
        supabase.from('tarefas_listas').select('*').eq('arquivada', false).order('posicao').order('nome'),
      ])
      if (e1) throw e1
      if (e2) throw e2
      setPastas(p || [])
      setListas(l || [])
    } catch (e) {
      console.error('Erro ao carregar estrutura de tarefas:', e)
      setErro(e.message)
    } finally {
      setLoadingEstrutura(false)
    }
  }, [])

  useEffect(() => { carregarEstrutura() }, [carregarEstrutura])

  // ── Tarefas ────────────────────────────────────────────────────────────────
  const mesclar = useCallback((rows) => {
    if (!rows?.length) return
    setItens((prev) => {
      const next = { ...prev }
      for (const r of rows) next[r.id] = r
      return next
    })
  }, [])

  const carregarListas = useCallback(async (listaIds, { force = false } = {}) => {
    const faltam = (listaIds || []).filter((id) => force || !carregadas.current.has(id))
    if (!faltam.length) return
    setCarregando(true)
    try {
      const rows = await selectPaginado(
        supabase.from('tarefas_itens').select('*').in('lista_id', faltam).eq('arquivada', false).order('posicao').order('created_at'),
      )
      faltam.forEach((id) => carregadas.current.add(id))
      mesclar(rows)
    } catch (e) {
      console.error('Erro ao carregar tarefas:', e)
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }, [mesclar])

  /** VertaTask: tarefas de um ciclo, de qualquer lista. campo = 'ciclo_id'. */
  const carregarPorCampo = useCallback(async (campo, valor, { force = false } = {}) => {
    if (!supabase || !valor) return
    if (!force && camposCarregados.current[campo]?.has(valor)) return
    setCarregando(true)
    try {
      const rows = await selectPaginado(
        supabase.from('tarefas_itens').select('*').eq(campo, valor).eq('arquivada', false).order('posicao').order('created_at'),
      )
      camposCarregados.current[campo].add(valor)
      // subtarefas das tarefas carregadas (o ciclo está só no pai)
      const ids = rows.map((r) => r.id)
      for (let i = 0; i < ids.length; i += 150) {
        const { data: subs } = await supabase.from('tarefas_itens').select('*').in('parent_id', ids.slice(i, i + 150)).eq('arquivada', false)
        if (subs?.length) rows.push(...subs)
      }
      mesclar(rows)
    } catch (e) {
      console.error('Erro ao carregar tarefas do ciclo:', e)
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }, [mesclar])

  const carregarMinhas = useCallback(async () => {
    if (!supabase || !user?.id || minhasCarregadas.current) return
    setCarregando(true)
    try {
      const rows = await selectPaginado(
        supabase.from('tarefas_itens').select('*').contains('responsaveis', [user.id]).eq('arquivada', false).order('data_vencimento', { ascending: true, nullsFirst: false }),
      )
      minhasCarregadas.current = true
      mesclar(rows)
    } catch (e) {
      console.error('Erro ao carregar minhas tarefas:', e)
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }, [user?.id, mesclar])

  /** VertaTask, "Todas as tarefas": tudo que está aberto (as concluídas ficam nas pastas). */
  const abertasCarregadas = useRef(false)
  const carregarAbertas = useCallback(async ({ force = false } = {}) => {
    if (!supabase || (abertasCarregadas.current && !force)) return
    setCarregando(true)
    try {
      const rows = await selectParalelo((comContagem) => supabase.from('tarefas_itens')
        .select('*', comContagem ? { count: 'exact' } : undefined).neq('status_tipo', 'closed').eq('arquivada', false)
        .order('data_vencimento', { ascending: true, nullsFirst: false }).order('id'))
      abertasCarregadas.current = true
      mesclar(rows)
    } catch (e) {
      console.error('Erro ao carregar tarefas abertas:', e)
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }, [mesclar])

  /** Uma tarefa por id (deep-link) + suas subtarefas + o pai, se houver. */
  const carregarTarefa = useCallback(async (id) => {
    if (!supabase || !id) return null
    const { data, error } = await supabase.from('tarefas_itens').select('*').eq('id', id).maybeSingle()
    if (error || !data) return null
    const extras = [data]
    const { data: subs } = await supabase.from('tarefas_itens').select('*').eq('parent_id', id)
    if (subs) extras.push(...subs)
    // Subtarefa: a cadeia de pais até a raiz e as irmãs, para o painel mostrar onde ela fica.
    if (data.parent_id) {
      const { data: irmas } = await supabase.from('tarefas_itens').select('*').eq('parent_id', data.parent_id).eq('arquivada', false)
      if (irmas) extras.push(...irmas.filter((s) => s.id !== id))
      const vistos = new Set([id])
      let paiId = data.parent_id
      while (paiId && !vistos.has(paiId) && vistos.size < 8) {
        vistos.add(paiId)
        const { data: pai } = await supabase.from('tarefas_itens').select('*').eq('id', paiId).maybeSingle()
        if (!pai) break
        extras.push(pai)
        paiId = pai.parent_id
      }
    }
    mesclar(extras)
    return data
  }, [mesclar])

  // Mão de volta para o ClickUp: a escrita entrou na fila (trigger); um pouco
  // depois pedimos ao servidor para esvaziá-la. Falha aqui não atrapalha a UI:
  // o cron diário também empurra a fila.
  const pushTimer = useRef(null)
  const agendarPush = useCallback((atraso = 1500) => {
    clearTimeout(pushTimer.current)
    pushTimer.current = setTimeout(async () => {
      try {
        const r = await apiFetch('/api/tarefas-push', { body: {} })
        // ficou fila (uma invocação não deu conta): chama de novo até esvaziar, em vez de
        // esperar a próxima escrita, o botão "ClickUp há X min" ou o cron
        if (r?.restantes > 0) agendarPush(1000)
      } catch { /* o cron diário e o botão também empurram */ }
    }, atraso)
  }, [])
  useEffect(() => () => clearTimeout(pushTimer.current), [])

  const criarTarefa = useCallback(async (payload) => {
    const lista = listasMap.get(payload.lista_id)
    const statuses = lista ? statusDaLista(lista) : STATUSES_PADRAO
    const st = payload.status ? statuses.find((s) => s.key === payload.status) : statusInicial(statuses)
    const row = {
      lista_id: payload.lista_id,
      parent_id: payload.parent_id || null,
      titulo: String(payload.titulo || '').trim() || 'Nova tarefa',
      descricao: payload.descricao || null,
      status: st?.key || 'a fazer',
      status_tipo: st?.tipo || 'open',
      prioridade: payload.prioridade || null,
      responsaveis: payload.responsaveis || [],
      data_inicio: payload.data_inicio || null,
      data_vencimento: payload.data_vencimento || null,
      estimativa_min: payload.estimativa_min || null,
      tipo_tarefa: payload.tipo_tarefa || null,
      dificuldade: payload.dificuldade || null,
      departamento: payload.departamento || [],
      tags: payload.tags || [],
      etiquetas: payload.etiquetas || [],
      checklists: payload.checklists || [],
      ciclo_id: payload.ciclo_id || null,
      posicao: payload.posicao ?? Date.now(),
      criado_por: user?.id || null,
      criador_nome: user?.name || null,
    }
    const { data, error } = await supabase.from('tarefas_itens').insert(row).select().single()
    if (!error) agendarPush()
    if (error) return { error: error.message }
    mesclar([data])
    return { data }
  }, [listasMap, user, mesclar, agendarPush])

  const atualizarTarefa = useCallback(async (id, patch) => {
    const anterior = itens[id]
    // otimista
    setItens((prev) => prev[id] ? { ...prev, [id]: { ...prev[id], ...patch, updated_at: new Date().toISOString() } } : prev)
    const { data, error } = await supabase.from('tarefas_itens').update(patch).eq('id', id).select().single()
    if (!error) agendarPush()
    if (error) {
      if (anterior) setItens((prev) => ({ ...prev, [id]: anterior }))
      return { error: error.message }
    }
    mesclar([data])
    return { data }
  }, [itens, mesclar, agendarPush])

  /** Troca o status calculando status_tipo e data_conclusao. */
  const mudarStatus = useCallback((item, statusObj) => {
    const fechando = statusObj.tipo === 'closed'
    return atualizarTarefa(item.id, {
      status: statusObj.key,
      status_tipo: statusObj.tipo || 'custom',
      data_conclusao: fechando ? new Date().toISOString() : null,
    })
  }, [atualizarTarefa])

  /** Aplica o mesmo patch a várias tarefas já gravadas (a gravação em lote é feita por quem chama). */
  const aplicarLocal = useCallback((ids, patch) => {
    const set = new Set(ids)
    setItens((prev) => {
      const next = { ...prev }
      for (const id of set) if (next[id]) next[id] = { ...next[id], ...patch }
      return next
    })
  }, [])

  const excluirTarefa = useCallback(async (id) => {
    const { error } = await supabase.from('tarefas_itens').delete().eq('id', id)
    if (!error) agendarPush()
    if (error) return { error: error.message }
    setItens((prev) => {
      const next = { ...prev }
      delete next[id]
      for (const k of Object.keys(next)) if (next[k].parent_id === id) delete next[k]
      return next
    })
    return {}
  }, [agendarPush])

  // ── Pastas e listas ────────────────────────────────────────────────────────
  const criarPasta = useCallback(async ({ nome, project_id = null }) => {
    const { data, error } = await supabase.from('tarefas_pastas').insert({ nome: nome.trim(), project_id, posicao: Date.now() }).select().single()
    if (error) return { error: error.message }
    setPastas((prev) => [...prev, data])
    // toda pasta nasce com uma lista "Geral", como no ClickUp
    const { data: lista } = await supabase.from('tarefas_listas').insert({ pasta_id: data.id, nome: 'Geral', statuses: STATUSES_PADRAO, posicao: 0 }).select().single()
    if (lista) setListas((prev) => [...prev, lista])
    return { data, lista }
  }, [])

  const atualizarPasta = useCallback(async (id, patch) => {
    const { data, error } = await supabase.from('tarefas_pastas').update(patch).eq('id', id).select().single()
    if (error) return { error: error.message }
    setPastas((prev) => prev.map((p) => (p.id === id ? data : p)).filter((p) => !p.arquivada))
    return { data }
  }, [])

  const criarLista = useCallback(async ({ pasta_id, nome, statuses }) => {
    const { data, error } = await supabase.from('tarefas_listas').insert({ pasta_id, nome: nome.trim(), statuses: statuses || STATUSES_PADRAO, posicao: Date.now() }).select().single()
    if (error) return { error: error.message }
    setListas((prev) => [...prev, data])
    carregadas.current.add(data.id)
    return { data }
  }, [])

  const atualizarLista = useCallback(async (id, patch) => {
    const { data, error } = await supabase.from('tarefas_listas').update(patch).eq('id', id).select().single()
    if (error) return { error: error.message }
    setListas((prev) => prev.map((l) => (l.id === id ? data : l)).filter((l) => !l.arquivada))
    return { data }
  }, [])

  // ── Comentários ────────────────────────────────────────────────────────────
  const carregarComentarios = useCallback(async (tarefaId) => {
    if (!supabase || !tarefaId) return []
    const { data, error } = await supabase.from('tarefas_comentarios').select('*').eq('tarefa_id', tarefaId).order('created_at')
    if (error) { console.error(error); return [] }
    setComentarios((prev) => ({ ...prev, [tarefaId]: data || [] }))
    return data || []
  }, [])

  const criarComentario = useCallback(async (tarefaId, texto) => {
    const { data, error } = await supabase.from('tarefas_comentarios').insert({
      tarefa_id: tarefaId, texto: texto.trim(), autor_id: user?.id || null, autor_nome: user?.name || null,
    }).select().single()
    if (!error) agendarPush()
    if (error) return { error: error.message }
    setComentarios((prev) => {
      const atual = prev[tarefaId] || []
      if (atual.some((c) => c.id === data.id)) return prev
      return { ...prev, [tarefaId]: [...atual, data] }
    })
    return { data }
  }, [user, agendarPush])

  const excluirComentario = useCallback(async (tarefaId, id) => {
    const { error } = await supabase.from('tarefas_comentarios').delete().eq('id', id)
    if (error) return { error: error.message }
    setComentarios((prev) => ({ ...prev, [tarefaId]: (prev[tarefaId] || []).filter((c) => c.id !== id) }))
    return {}
  }, [])

  // ── Realtime ───────────────────────────────────────────────────────────────
  useEffect(() => {
    // Eventos de tarefa em lote: a sincronização e o push gravam dezenas de linhas de uma vez,
    // e cada setItens recalculava filtros, grupos e a lista inteira. Junta o que chega em
    // 150 ms e aplica num único setItens (copiando o mapa só se algo mudou).
    const fila = []
    let timer = null
    const aplicarLote = () => {
      timer = null
      const lote = fila.splice(0)
      setItens((prev) => {
        let n = prev
        const editavel = () => { if (n === prev) n = { ...prev } }
        for (const { eventType, row, old } of lote) {
          if (eventType === 'DELETE') { if (n[old.id]) { editavel(); delete n[old.id] } continue }
          const conhecida = carregadas.current.has(row.lista_id) || !!n[row.id] || (row.parent_id && !!n[row.parent_id])
            || (row.ciclo_id && camposCarregados.current.ciclo_id.has(row.ciclo_id))
          if (!conhecida) continue
          editavel()
          if (row.arquivada) delete n[row.id]
          else n[row.id] = row
        }
        return n
      })
    }
    const ch = supabase
      .channel('tarefas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tarefas_itens' }, ({ eventType, new: row, old }) => {
        fila.push({ eventType, row, old })
        if (!timer) timer = setTimeout(aplicarLote, 150)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tarefas_comentarios' }, ({ new: row }) => {
        setComentarios((prev) => {
          const atual = prev[row.tarefa_id]
          if (!atual || atual.some((c) => c.id === row.id)) return prev
          return { ...prev, [row.tarefa_id]: [...atual, row] }
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tarefas_listas' }, ({ eventType, new: row, old }) => {
        setListas((prev) => {
          if (eventType === 'DELETE' || row?.arquivada) return prev.filter((l) => l.id !== (old?.id || row?.id))
          const i = prev.findIndex((l) => l.id === row.id)
          if (i < 0) return [...prev, row]
          const n = [...prev]; n[i] = row; return n
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tarefas_pastas' }, ({ eventType, new: row, old }) => {
        setPastas((prev) => {
          if (eventType === 'DELETE' || row?.arquivada) return prev.filter((p) => p.id !== (old?.id || row?.id))
          const i = prev.findIndex((p) => p.id === row.id)
          if (i < 0) return [...prev, row]
          const n = [...prev]; n[i] = row; return n
        })
      })
      .subscribe()
    return () => { if (timer) clearTimeout(timer); supabase.removeChannel(ch) }
  }, [])

  return {
    pastas, listas, pastasMap, listasMap, loadingEstrutura, carregando, erro,
    itens, comentarios,
    carregarEstrutura, carregarListas, carregarMinhas, carregarAbertas, carregarPorCampo, carregarTarefa, aplicarLocal,
    criarTarefa, atualizarTarefa, mudarStatus, excluirTarefa,
    criarPasta, atualizarPasta, criarLista, atualizarLista,
    carregarComentarios, criarComentario, excluirComentario,
  }
}
