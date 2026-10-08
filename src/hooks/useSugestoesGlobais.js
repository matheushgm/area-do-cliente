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
import { gerarSugestoesProjeto, PRIORIDADE_ORDEM } from '../lib/playbookSugestoes'
import { hojeISO } from '../lib/atividadesCarga'

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
    execucao_status: status === 'aceita' ? 'pendente' : null,
    valida_ate: null,
    ...extra,
  }
}

// Decide se uma sugestão calculada agora ainda está pendente dado o registro
// de decisão (mesma regra da página do cliente).
export function pendente(st, hoje) {
  if (!st) return true
  if (st.status === 'aceita' || st.status === 'recusada') return false
  return !!(st.valida_ate && st.valida_ate < hoje)
}

export function useSugestoesGlobais(dash) {
  const { user, projects } = useApp()
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
      const sugs = gerarSugestoesProjeto({ meta: rows.meta, google: rows.google, accounts: dash.accounts || {} })
      for (const s of sugs) out.push({ ...s, projectId: pid })
    }
    return out
  }, [porProjeto, dash.accounts])

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
          nome: p?.companyName || p?.company_name || sugestoes[0]?.conta || 'Cliente',
          responsavel: p?.responsibleName || p?.responsible_name || null,
          sugestoes: sugestoes.slice().sort((a, b) => PRIORIDADE_ORDEM[a.prioridade] - PRIORIDADE_ORDEM[b.prioridade]),
        }
      })
      .sort((a, b) => score(a.sugestoes) - score(b.sugestoes) || b.sugestoes.length - a.sugestoes.length || a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [pendentes, projetoPorId])

  const decidir = useCallback(async (sug, status, { motivo = null } = {}) => {
    const row = linhaDecisao(sug, status, { projectId: sug.projectId, user, motivo })
    const { data, error } = await supabase
      .from('projeto_sugestoes')
      .upsert(row, { onConflict: 'project_id,chave' })
      .select()
      .single()
    if (error) throw new Error(error.message)
    setDecisoes((prev) => [data, ...prev.filter((d) => !(d.project_id === data.project_id && d.chave === data.chave))])
    return data
  }, [user])

  const reabrir = useCallback(async (d) => {
    const { error } = await supabase.from('projeto_sugestoes').delete().eq('id', d.id)
    if (error) throw new Error(error.message)
    setDecisoes((prev) => prev.filter((x) => x.id !== d.id))
  }, [])

  const historico = useMemo(() => decisoes.map((d) => ({
    ...d,
    nomeCliente: projetoPorId.get(d.project_id)?.companyName || projetoPorId.get(d.project_id)?.company_name || d.conta || 'Cliente',
  })), [decisoes, projetoPorId])

  const recarregarDecisoes = useCallback(() => { setLoadingDecisoes(true); return carregarDecisoes() }, [carregarDecisoes])

  return {
    grupos, pendentes, historico, decidir, reabrir, recarregarDecisoes,
    loading: dash.loading || loadingDecisoes, erro: erro || dash.error,
    clientesComDados: porProjeto.size,
  }
}
