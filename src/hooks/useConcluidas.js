// Tarefas concluídas nos últimos 7 dias (relatório do módulo Atividades).
// Uma única leitura cobre os três filtros (hoje / ontem / 7 dias): a troca de
// período é feita no browser, sem nova chamada. Cache de sessão de 5 minutos
// para a aba abrir já preenchida; relê sozinho quando fica velho.
import { useState, useEffect, useCallback, useRef } from 'react'
import { tarefasConcluidas } from '../lib/atividades'
import { hojeISO } from '../lib/atividadesCarga'
import { intervaloDoPeriodo } from '../lib/atividadesConcluidas'

const TTL_MS = 5 * 60 * 1000
const KEY = 'atividades_concluidas_v1'

function lerCache(desde, ate) {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const c = JSON.parse(raw)
    if (c?.desde !== desde || c?.ate !== ate) return null
    if (!c?.geradoEm || Date.now() - new Date(c.geradoEm).getTime() > TTL_MS) return null
    return c
  } catch { return null }
}
function gravarCache(c) {
  try { sessionStorage.setItem(KEY, JSON.stringify(c)) } catch { /* sem espaço: segue sem cache */ }
}

/**
 * @param {boolean} ativo  só lê o ClickUp quando o relatório está visível
 */
export function useConcluidas(ativo) {
  const [dados, setDados] = useState(null) // { hoje, desde, ate, geradoEm, tarefas, truncado }
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState(null)
  const seq = useRef(0)
  const hoje = hojeISO()
  const { desde, ate } = intervaloDoPeriodo('7dias', hoje)

  const carregar = useCallback(async ({ refresh = false } = {}) => {
    const minha = ++seq.current
    setLoading(true)
    setErro(null)
    try {
      const r = await tarefasConcluidas({ desde, ate, refresh })
      if (seq.current !== minha) return
      const c = { ...r, geradoEm: r.geradoEm || new Date().toISOString() }
      setDados(c)
      gravarCache(c)
    } catch (e) {
      if (seq.current !== minha) return
      setErro(e?.message || 'Falha ao ler o ClickUp')
    } finally {
      if (seq.current === minha) setLoading(false)
    }
  }, [desde, ate])

  // primeira leitura ao ativar: cache da sessão (se fresco) e, se não houver, ClickUp
  const jaLeu = useRef(false)
  useEffect(() => {
    if (!ativo || jaLeu.current) return
    jaLeu.current = true
    const c = lerCache(desde, ate)
    if (c) { setDados(c); return }
    carregar()
  }, [ativo, desde, ate, carregar])

  // relê sozinho quando a leitura envelhece e a aba está visível
  const dadosRef = useRef(dados)
  dadosRef.current = dados
  const carregarRef = useRef(carregar)
  carregarRef.current = carregar
  useEffect(() => {
    if (!ativo) return
    const velho = () => !dadosRef.current?.geradoEm || Date.now() - new Date(dadosRef.current.geradoEm).getTime() >= TTL_MS
    const tick = () => { if (document.visibilityState === 'visible' && velho()) carregarRef.current({ refresh: true }) }
    const timer = setInterval(tick, 60 * 1000)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick) }
  }, [ativo])

  const refresh = useCallback(() => carregar({ refresh: true }), [carregar])

  return {
    tarefas: dados?.tarefas || [],
    hoje: dados?.hoje || hoje,
    desde,
    ate,
    geradoEm: dados?.geradoEm || null,
    truncado: !!dados?.truncado,
    loading,
    erro,
    refresh,
  }
}
