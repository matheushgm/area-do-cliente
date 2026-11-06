// Dados do módulo Sprints do VertaTask (tabelas tarefas_sprint*). As tarefas em si continuam em
// useTarefas: mudar status, responsável ou estimativa segue para o ClickUp pela outbox de sempre;
// quem está em qual sprint fica só aqui.
//
// `banco` é o único ponto que fala com o Supabase, para o harness /dev/sprints rodar a mesma lógica
// com dados em memória.
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'
import { CONFIG_SPRINT_PADRAO, participantesDaSprint, planoDeFechamento } from '../lib/sprints'

const unico = (r) => { if (r.error) throw r.error; return r.data }

export const bancoSupabase = {
  async lerConfig() {
    const r = await apiFetch('/api/atividades', { body: { action: 'config' } })
    return r?.config || null
  },
  async lerSprints() {
    const [s, p] = await Promise.all([
      supabase.from('tarefas_sprints').select('*').order('inicio', { ascending: false }).limit(60),
      supabase.from('tarefas_sprint_pessoas').select('*').order('created_at').limit(1000),
    ])
    return { sprints: unico(s) || [], pessoas: unico(p) || [] }
  },
  async lerItens(ids) {
    if (!ids.length) return []
    return unico(await supabase.from('tarefas_sprint_itens').select('*').in('sprint_id', ids).order('posicao').limit(1000)) || []
  },
  inserir: async (tabela, linhas) => unico(await supabase.from(tabela).insert(linhas).select()),
  atualizar: async (tabela, id, patch) => unico(await supabase.from(tabela).update(patch).eq('id', id).select().single()),
  apagar: async (tabela, id) => { const { error } = await supabase.from(tabela).delete().eq('id', id); if (error) throw error },
  rpc: async (nome, args) => { const { error } = await supabase.rpc(nome, args); if (error) throw error },
  assinar(aoMudar) {
    const ch = supabase.channel('vertatask-sprints')
    for (const table of ['tarefas_sprints', 'tarefas_sprint_pessoas', 'tarefas_sprint_itens']) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table }, aoMudar)
    }
    ch.subscribe()
    return () => supabase.removeChannel(ch)
  },
}

const msg = (e) => {
  if (e?.code === '23505') return 'Essa sprint já existe. Recarregue a página.'
  return e?.message || 'Não foi possível salvar.'
}

export function useSprints(user, { ativo = true, banco = bancoSupabase } = {}) {
  const [sprints, setSprints] = useState([])
  const [pessoas, setPessoas] = useState([])
  const [itens, setItens] = useState([])
  const [config, setConfig] = useState(CONFIG_SPRINT_PADRAO)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [sprintsDeItens, setSprintsDeItens] = useState([]) // quais sprints estão com os itens carregados
  const idsItens = useRef([])

  const recarregar = useCallback(async () => {
    try {
      const r = await banco.lerSprints()
      setSprints(r.sprints); setPessoas(r.pessoas)
      if (idsItens.current.length) setItens(await banco.lerItens(idsItens.current))
      setErro(null)
    } catch (e) {
      console.error('Erro ao carregar sprints:', e)
      setErro(msg(e))
    } finally {
      setLoading(false)
    }
  }, [banco])

  useEffect(() => {
    if (!ativo) return undefined
    recarregar()
    banco.lerConfig?.().then((c) => { if (c) setConfig({ ...CONFIG_SPRINT_PADRAO, ...c }) }).catch(() => {})
    let timer = null
    const parar = banco.assinar?.(() => { clearTimeout(timer); timer = setTimeout(recarregar, 300) })
    return () => { clearTimeout(timer); parar?.() }
  }, [ativo, banco, recarregar])

  /** A tela diz quais sprints está mostrando (a aberta e a anterior a ela). */
  const carregarItens = useCallback(async (ids) => {
    const chave = [...ids].sort().join(',')
    if (chave === [...idsItens.current].sort().join(',')) return
    idsItens.current = ids
    setSprintsDeItens(ids)
    try { setItens(await banco.lerItens(ids)) } catch (e) { setErro(msg(e)) }
  }, [banco])

  const tentar = useCallback(async (fn) => {
    try { return { data: await fn() } } catch (e) { console.error(e); await recarregar(); return { error: msg(e) } }
  }, [recarregar])

  // ── Sprint ─────────────────────────────────────────────────────────────────
  const criarSprint = useCallback(({ numero, nome, inicio, fim, membros, cfg, anteriores }) => tentar(async () => {
    const [s] = await banco.inserir('tarefas_sprints', [{ numero, nome: nome.trim(), inicio, fim, criado_por: user?.id || null }])
    const linhas = participantesDaSprint({ membros, anteriores, inicio, fim, cfg }).map((p) => ({ ...p, sprint_id: s.id }))
    const criadas = linhas.length ? await banco.inserir('tarefas_sprint_pessoas', linhas) : []
    setSprints((prev) => [s, ...prev.filter((x) => x.id !== s.id)])
    setPessoas((prev) => [...prev, ...criadas])
    return s
  }), [banco, tentar, user?.id])

  const atualizarSprint = useCallback((id, patch) => tentar(async () => {
    const s = await banco.atualizar('tarefas_sprints', id, patch)
    setSprints((prev) => prev.map((x) => (x.id === id ? s : x)))
    return s
  }), [banco, tentar])

  const excluirSprint = useCallback((id) => tentar(async () => {
    await banco.apagar('tarefas_sprints', id)
    setSprints((prev) => prev.filter((x) => x.id !== id))
    setPessoas((prev) => prev.filter((x) => x.sprint_id !== id))
    setItens((prev) => prev.filter((x) => x.sprint_id !== id))
  }), [banco, tentar])

  // ── Sprint de cada pessoa ──────────────────────────────────────────────────
  const atualizarPessoa = useCallback((id, patch) => {
    setPessoas((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    return tentar(() => banco.atualizar('tarefas_sprint_pessoas', id, patch))
  }, [banco, tentar])

  const adicionarPessoa = useCallback((sprintId, linha) => tentar(async () => {
    const [p] = await banco.inserir('tarefas_sprint_pessoas', [{ ...linha, sprint_id: sprintId }])
    setPessoas((prev) => [...prev, p])
    return p
  }), [banco, tentar])

  const removerPessoa = useCallback((linha) => tentar(async () => {
    await banco.apagar('tarefas_sprint_pessoas', linha.id)
    setPessoas((prev) => prev.filter((x) => x.id !== linha.id))
    const doItem = itens.filter((i) => i.sprint_id === linha.sprint_id && i.pessoa_id === linha.pessoa_id)
    for (const i of doItem) await banco.apagar('tarefas_sprint_itens', i.id)
    setItens((prev) => prev.filter((i) => !(i.sprint_id === linha.sprint_id && i.pessoa_id === linha.pessoa_id)))
  }), [banco, tentar, itens])

  const confirmarPessoa = useCallback((linha, minutos) => tentar(async () => {
    await banco.rpc('tarefas_sprint_confirmar', { p_pessoa: linha.id, p_itens: minutos })
    await recarregar()
  }), [banco, tentar, recarregar])

  const reabrirPessoa = useCallback((linha) => tentar(async () => {
    await banco.rpc('tarefas_sprint_reabrir', { p_pessoa: linha.id })
    await recarregar()
  }), [banco, tentar, recarregar])

  // ── Tarefas da sprint ──────────────────────────────────────────────────────
  /** Depois de confirmada, o que entra é fora do plano (o "Added" do relatório do ClickUp). */
  const adicionarTarefas = useCallback((sprintId, linhaPessoa, tarefas, { origem = 'planejada' } = {}) => tentar(async () => {
    const fora = !!linhaPessoa.confirmada_em
    const jaLa = itens.filter((i) => i.sprint_id === sprintId && i.pessoa_id === linhaPessoa.pessoa_id)
    const voltando = tarefas.map((t) => jaLa.find((i) => i.tarefa_id === t.id)).filter(Boolean)
    const novas = tarefas.filter((t) => !jaLa.some((i) => i.tarefa_id === t.id))
    let inseridas = []
    if (novas.length) {
      inseridas = await banco.inserir('tarefas_sprint_itens', novas.map((t, k) => ({
        sprint_id: sprintId, pessoa_id: linhaPessoa.pessoa_id, tarefa_id: t.id, titulo: t.titulo, origem,
        fora_do_plano: fora, adicionada_por: user?.id || null, posicao: Date.now() / 1000 + k,
      })))
    }
    const atualizadas = []
    for (const i of voltando) atualizadas.push(await banco.atualizar('tarefas_sprint_itens', i.id, { removida_em: null, fora_do_plano: fora, adicionada_em: new Date().toISOString() }))
    setItens((prev) => [...prev.map((x) => atualizadas.find((a) => a.id === x.id) || x), ...inseridas])
    return inseridas
  }), [banco, tentar, itens, user?.id])

  /** Antes de confirmar some de vez; depois fica como "removida" no relatório. */
  const removerItem = useCallback((item, linhaPessoa) => tentar(async () => {
    if (linhaPessoa?.confirmada_em) {
      const a = await banco.atualizar('tarefas_sprint_itens', item.id, { removida_em: new Date().toISOString() })
      setItens((prev) => prev.map((x) => (x.id === item.id ? a : x)))
    } else {
      await banco.apagar('tarefas_sprint_itens', item.id)
      setItens((prev) => prev.filter((x) => x.id !== item.id))
    }
  }), [banco, tentar])

  const decidirItem = useCallback((item, decisao) => {
    setItens((prev) => prev.map((x) => (x.id === item.id ? { ...x, decisao } : x)))
    return tentar(() => banco.atualizar('tarefas_sprint_itens', item.id, { decisao }))
  }, [banco, tentar])

  // ── Concluir ───────────────────────────────────────────────────────────────
  /**
   * Fecha a sprint. Garante antes a próxima (o transbordo precisa de destino) e aplica tudo numa
   * transação só, em tarefas_sprint_concluir. Devolve a próxima para a tela abrir.
   */
  const concluirSprint = useCallback(({ sprint, proxima, sugestao, tarefas, membros, cfg, itensDaSprint }) => tentar(async () => {
    const linhas = pessoas.filter((p) => p.sprint_id === sprint.id)
    let destino = proxima
    let destinoPessoas = proxima ? pessoas.filter((p) => p.sprint_id === proxima.id) : []
    if (!destino) {
      const [s] = await banco.inserir('tarefas_sprints', [{ numero: sugestao.numero, nome: sugestao.nome, inicio: sugestao.inicio, fim: sugestao.fim, criado_por: user?.id || null }])
      destino = s
      const novas = participantesDaSprint({ membros, anteriores: linhas, inicio: s.inicio, fim: s.fim, cfg }).map((p) => ({ ...p, sprint_id: s.id }))
      destinoPessoas = novas.length ? await banco.inserir('tarefas_sprint_pessoas', novas) : []
    }
    const plano = planoDeFechamento({ sprint, proxima: destino, pessoas: linhas, itens: itensDaSprint, tarefas, cfg, proximasPessoas: destinoPessoas })
    await banco.rpc('tarefas_sprint_concluir', { p_sprint: sprint.id, p_resultados: plano.resultados, p_novos: plano.novos, p_pessoas: plano.pessoas })
    await recarregar()
    return { proxima: destino, plano }
  }), [banco, tentar, pessoas, recarregar, user?.id])

  const pessoasPorSprint = useMemo(() => {
    const m = new Map()
    for (const p of pessoas) { if (!m.has(p.sprint_id)) m.set(p.sprint_id, []); m.get(p.sprint_id).push(p) }
    return m
  }, [pessoas])

  return {
    sprints, pessoas, itens, config, loading, erro, pessoasPorSprint, sprintsDeItens,
    carregarItens, recarregar,
    criarSprint, atualizarSprint, excluirSprint, concluirSprint,
    atualizarPessoa, adicionarPessoa, removerPessoa, confirmarPessoa, reabrirPessoa,
    adicionarTarefas, removerItem, decidirItem,
  }
}
