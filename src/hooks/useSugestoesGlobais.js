// Sugestões do playbook de TODOS os clientes numa lista só (página /otimizacoes).
//
// Reaproveita o mesmo motor da página do cliente (`gerarSugestoesProjeto`):
// lê o dash_insights das contas vinculadas a algum projeto (20 dias, como a
// home), agrupa as linhas por projeto e roda as regras. As decisões ficam em
// `projeto_sugestoes` (aceita / recusada / descartada) e são o histórico que a
// automação lê pra executar a otimização no Meta/Google.
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { gerarSugestoesProjeto, pendente, PRIORIDADE_ORDEM } from '../lib/playbookSugestoes'
import { hojeISO } from '../lib/atividadesCarga'
import { useI18n } from '../i18n'
import { modoDoAgente } from '../lib/otimizacoesAgente'

// Só entra na fila do agente (gestor de tráfego do Escritório) o que ele sabe
// executar: modoDoAgente 'auto' ou 'critica' (src/lib/otimizacoesAgente.js). O resto
// (subir criativo, investigar) vira tarefa no ClickUp pra uma pessoa e fica 'manual'.
// A função reconciliar_fila_otimizacoes (migrations 098 e 137) segue a mesma divisão.

// Linha de `projeto_sugestoes` a partir de uma sugestão: além do payload inteiro,
// copia canal/conta/caminho/ação em colunas próprias pra automação consultar por SQL.
export function linhaDecisao(sug, status, { projectId, user, motivo = null, extra = {} }) {
  return {
    project_id: projectId,
    chave: sug.chave,
    status,
    titulo: sug.titulo,
    payload: sug,
    canal: sug.canal || null,
    conta: sug.conta || null,
    campanha: sug.caminho?.campanha || null,
    conjunto: sug.caminho?.conjunto || null,
    anuncio: sug.caminho?.anuncio || null,
    ad_id: sug.caminho?.adId || null,
    acao: sug.acao || null,
    motivo,
    decidida_em: new Date().toISOString(),
    decidida_por: user?.name || user?.email || null,
    created_by: user?.id || null,
    execucao_status: status !== 'aceita' ? null : modoDoAgente(sug) !== 'manual' ? 'pendente' : 'manual',
    valida_ate: null,
    ...extra,
  }
}

export function useSugestoesGlobais(dash) {
  const { user, projects } = useApp()
  // O texto das sugestões é gerado no idioma da tela: trocar o idioma regera.
  const { t, lang, locale } = useI18n()
  const [decisoes, setDecisoes] = useState([])
  const [loadingDecisoes, setLoadingDecisoes] = useState(true)
  const [erro, setErro] = useState(null)

  // Não liga o loading aqui (o effect inicial já começa com true); o botão
  // "Recarregar" usa `recarregarDecisoes`, que liga antes de chamar.
  const carregarDecisoes = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase
      .from('projeto_sugestoes')
      .select('*')
      .order('decidida_em', { ascending: false })
      .limit(2000)
    if (error) setErro(error.message)
    else setDecisoes(data || [])
    setLoadingDecisoes(false)
  }, [])

  useEffect(() => { carregarDecisoes() }, [carregarDecisoes])

  // Comentários por sugestão (migration 137), do time e do agente. Chave = project_id|chave.
  const [comentarios, setComentarios] = useState([])
  const carregarComentarios = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase
      .from('projeto_sugestoes_comentarios')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(5000)
    if (!error) setComentarios(data || [])
  }, [])
  useEffect(() => {
    carregarComentarios()
    if (!supabase) return
    let timer = null
    // Tempo real: o agente responde de hora em hora e o time vê sem recarregar.
    const canal = supabase
      .channel('otimizacoes-comentarios')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projeto_sugestoes_comentarios' }, (ev) => {
        setComentarios((prev) => {
          if (ev.eventType === 'DELETE') return prev.filter((c) => c.id !== ev.old?.id)
          const sem = prev.filter((c) => c.id !== ev.new.id)
          return [...sem, ev.new].sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
        })
      })
      // Decisões gravadas pelo agente chegam em rajada: relê uma vez, 2 s depois da última.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projeto_sugestoes' }, () => {
        clearTimeout(timer)
        timer = setTimeout(() => carregarDecisoes(), 2000)
      })
      .subscribe()
    return () => { clearTimeout(timer); supabase.removeChannel(canal) }
  }, [carregarComentarios, carregarDecisoes])
  const comentariosPorChave = useMemo(() => {
    const m = new Map()
    for (const c of comentarios) {
      const k = `${c.project_id}|${c.chave}`
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(c)
    }
    return m
  }, [comentarios])
  const comentar = useCallback(async (projectId, chave, texto) => {
    const linha = { project_id: projectId, chave, autor_tipo: 'pessoa', autor_id: user?.id || null, autor_nome: user?.name || user?.email || null, texto }
    const { data, error } = await supabase.from('projeto_sugestoes_comentarios').insert(linha).select().single()
    if (error) throw new Error(error.message)
    setComentarios((prev) => (prev.some((c) => c.id === data.id) ? prev : [...prev, data]))
    return data
  }, [user])

  const projetoPorId = useMemo(() => new Map((projects || []).map((p) => [p.id, p])), [projects])

  // Linhas do dash por projeto (conta → projectId pelo vínculo do dashboard)
  const porProjeto = useMemo(() => {
    const out = new Map()
    const push = (canal, r) => {
      const conta = r['Nome da conta']
      const pid = dash.accounts?.[conta]?.projectId
      if (!pid) return
      if (!out.has(pid)) out.set(pid, { meta: [], google: [] })
      out.get(pid)[canal].push(r)
    }
    for (const r of dash.raw?.meta || []) push('meta', r)
    for (const r of dash.raw?.google || []) push('google', r)
    return out
  }, [dash.raw, dash.accounts])

  const todas = useMemo(() => {
    const out = []
    for (const [pid, rows] of porProjeto) {
      const sugs = gerarSugestoesProjeto({ meta: rows.meta, google: rows.google, accounts: dash.accounts || {}, metaStatus: dash.metaStatus })
      for (const s of sugs) out.push({ ...s, projectId: pid })
    }
    return out
  }, [porProjeto, dash.accounts, dash.metaStatus, lang]) // eslint-disable-line react-hooks/exhaustive-deps -- lang: o motor lê o idioma na hora, então regera o texto na troca

  const hoje = hojeISO()
  const statusPorChave = useMemo(() => {
    const m = new Map()
    for (const d of decisoes) m.set(`${d.project_id}|${d.chave}`, d)
    return m
  }, [decisoes])

  const pendentes = useMemo(
    () => todas.filter((s) => pendente(statusPorChave.get(`${s.projectId}|${s.chave}`), hoje)),
    [todas, statusPorChave, hoje],
  )

  // Agrupadas por cliente, cliente com mais urgência primeiro
  const grupos = useMemo(() => {
    const m = new Map()
    for (const s of pendentes) {
      if (!m.has(s.projectId)) m.set(s.projectId, [])
      m.get(s.projectId).push(s)
    }
    const score = (arr) => Math.min(...arr.map((s) => PRIORIDADE_ORDEM[s.prioridade] ?? 9))
    return [...m.entries()]
      .map(([projectId, sugestoes]) => {
        const p = projetoPorId.get(projectId)
        return {
          projectId,
          nome: p?.companyName || p?.company_name || sugestoes[0]?.conta || t('otimizacoes.cliente'),
          responsavel: p?.responsibleName || p?.responsible_name || null,
          sugestoes: sugestoes.slice().sort((a, b) => PRIORIDADE_ORDEM[a.prioridade] - PRIORIDADE_ORDEM[b.prioridade]),
        }
      })
      .sort((a, b) => score(a.sugestoes) - score(b.sugestoes) || b.sugestoes.length - a.sugestoes.length || a.nome.localeCompare(b.nome, locale))
  }, [pendentes, projetoPorId, t, locale])

  const decidir = useCallback(async (sug, status, { motivo = null, extra = {} } = {}) => {
    const row = linhaDecisao(sug, status, { projectId: sug.projectId, user, motivo, extra })
    const { data, error } = await supabase
      .from('projeto_sugestoes')
      .upsert(row, { onConflict: 'project_id,chave' })
      .select()
      .single()
    if (error) throw new Error(error.message)
    setDecisoes((prev) => [data, ...prev.filter((d) => !(d.project_id === data.project_id && d.chave === data.chave))])
    return data
  }, [user])

  // Atualiza campos de uma decisão já gravada (ex.: anexar a tarefa do ClickUp numa nova tentativa)
  const atualizarDecisao = useCallback(async (d, patch) => {
    const { data, error } = await supabase.from('projeto_sugestoes').update(patch).eq('id', d.id).select().single()
    if (error) throw new Error(error.message)
    setDecisoes((prev) => prev.map((x) => (x.id === d.id ? data : x)))
    return data
  }, [])

  // Aba Crítico: aprovar põe na fila do agente; reprovar vira recusa com motivo.
  const aprovarCritica = useCallback((d) => atualizarDecisao(d, {
    status: 'aceita', execucao_status: 'pendente',
    aprovada_por: user?.name || user?.email || null, aprovada_em: new Date().toISOString(),
  }), [atualizarDecisao, user])
  const reprovarCritica = useCallback((d, motivo) => atualizarDecisao(d, {
    status: 'recusada', execucao_status: null, motivo,
    aprovada_por: user?.name || user?.email || null, aprovada_em: new Date().toISOString(),
  }), [atualizarDecisao, user])

  const reabrir = useCallback(async (d) => {
    const { error } = await supabase.from('projeto_sugestoes').delete().eq('id', d.id)
    if (error) throw new Error(error.message)
    setDecisoes((prev) => prev.filter((x) => x.id !== d.id))
  }, [])

  const nomeDe = useCallback((d) => projetoPorId.get(d.project_id)?.companyName || projetoPorId.get(d.project_id)?.company_name || d.conta || t('otimizacoes.cliente'), [projetoPorId, t])
  const historico = useMemo(() => decisoes.filter((d) => d.status !== 'critica').map((d) => ({ ...d, nomeCliente: nomeDe(d) })), [decisoes, nomeDe])
  // Esperando aprovação (o agente julgou crítica), mais antigas primeiro
  const criticas = useMemo(() => decisoes.filter((d) => d.status === 'critica')
    .map((d) => ({ ...d, nomeCliente: nomeDe(d) }))
    .sort((a, b) => (a.decidida_em < b.decidida_em ? -1 : 1)), [decisoes, nomeDe])

  const recarregarDecisoes = useCallback(() => { setLoadingDecisoes(true); carregarComentarios(); return carregarDecisoes() }, [carregarDecisoes, carregarComentarios])

  return {
    grupos, pendentes, historico, criticas, decidir, atualizarDecisao, reabrir, recarregarDecisoes,
    aprovarCritica, reprovarCritica, comentariosPorChave, comentar,
    loading: dash.loading || loadingDecisoes, erro: erro || dash.error,
    clientesComDados: porProjeto.size,
    projetosComDados: porProjeto,   // Map projectId → linhas (quem tem conta vinculada no dash)
  }
}
