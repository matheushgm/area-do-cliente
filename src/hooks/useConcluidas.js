// Tarefas concluídas num intervalo de dias (relatório do módulo Atividades).
// Recebe o intervalo que a tela precisa e lê o ClickUp só quando o que já
// está carregado não cobre esse intervalo (os filtros Hoje / Ontem cabem
// dentro dos 7 dias; o personalizado pede o que for). A API aceita 31 dias por
// chamada, então intervalos maiores são lidos em fatias e juntados.
// Cache de sessão de 5 minutos para a aba abrir já preenchida.
import { useState, useEffect, useCallback, useRef } from 'react'
import { tarefasConcluidas } from '../lib/atividades'
import { hojeISO } from '../lib/atividadesCarga'
import { addDias } from '../lib/atividadesConcluidas'

const TTL_MS = 5 * 60 * 1000
const KEY = 'atividades_concluidas_v2'
const FATIA_DIAS = 31

function lerCache(desde, ate) {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const c = JSON.parse(raw)
    if (!(c?.desde <= desde && c?.ate >= ate)) return null
    if (!c?.geradoEm || Date.now() - new Date(c.geradoEm).getTime() > TTL_MS) return null
    return c
  } catch { return null }
}
function gravarCache(c) {
  try { sessionStorage.setItem(KEY, JSON.stringify(c)) } catch { /* sem espaço: segue sem cache */ }
}

/** Lê [desde, ate] em fatias de até 31 dias e junta. */
async function lerIntervalo(desde, ate, refresh) {
  const tarefas = []
  let truncado = false
  let hoje = null
  let ini = desde
  while (ini <= ate) {
    const fim = addDias(ini, FATIA_DIAS - 1) < ate ? addDias(ini, FATIA_DIAS - 1) : ate
    const r = await tarefasConcluidas({ desde: ini, ate: fim, refresh })
    tarefas.push(...(r.tarefas || []))
    truncado = truncado || !!r.truncado
    hoje = r.hoje || hoje
    ini = addDias(fim, 1)
  }
  tarefas.sort((a, b) => (b.concluidaEm || '').localeCompare(a.concluidaEm || ''))
  return { desde, ate, hoje, tarefas, truncado, geradoEm: new Date().toISOString() }
}

/**
 * @param {boolean} ativo  só lê o ClickUp quando o relatório está visível
 * @param {{desde: string, ate: string}} intervalo  o que a tela precisa (yyyy-mm-dd)
 */
export function useConcluidas(ativo, intervalo) {
  const [dados, setDados] = useState(null) // { desde, ate, hoje, tarefas, truncado, geradoEm }
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState(null)
  const seq = useRef(0)
  const hoje = hojeISO()
  const { desde, ate } = intervalo
  const cobre = !!dados && dados.desde <= desde && dados.ate >= ate

  const carregar = useCallback(async ({ refresh = false } = {}) => {
    const minha = ++seq.current
    setLoading(true)
    setErro(null)
    try {
      const c = await lerIntervalo(desde, ate, refresh)
      if (seq.current !== minha) return
      setDados(c)
      gravarCache(c)
    } catch (e) {
      if (seq.current !== minha) return
      setErro(e?.message || 'Falha ao ler o ClickUp')
    } finally {
      if (seq.current === minha) setLoading(false)
    }
  }, [desde, ate])

  // lê quando o intervalo pedido não está coberto (cache da sessão primeiro).
  // Um intervalo que falhou não é pedido de novo sozinho: o botão de reler cuida.
  const falhou = useRef(null)
  useEffect(() => {
    if (!ativo || cobre || loading) return
    const chave = `${desde}:${ate}`
    if (erro && falhou.current === chave) return
    const c = lerCache(desde, ate)
    if (c) { setDados(c); return }
    falhou.current = chave
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, cobre, desde, ate])

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

  const refresh = useCallback(() => { falhou.current = null; return carregar({ refresh: true }) }, [carregar])

  return {
    // só o que cabe no intervalo pedido (o carregado pode ser maior)
    tarefas: cobre ? dados.tarefas.filter((t) => t.dia >= desde && t.dia <= ate) : [],
    hoje: dados?.hoje || hoje,
    desde,
    ate,
    geradoEm: cobre ? dados.geradoEm : null,
    truncado: cobre ? !!dados.truncado : false,
    loading,
    erro,
    refresh,
  }
}
