// Tarefas concluídas num intervalo de dias (relatório do módulo Atividades).
// Recebe o intervalo que a tela precisa e lê as tarefas_* (espelho do ClickUp) quando
// o que já está carregado não cobre esse intervalo (os filtros Hoje / Ontem cabem
// dentro dos 7 dias; o personalizado pede o que for). A API aceita 31 dias por
// chamada, então intervalos maiores são lidos em fatias e juntados.
// Tempo real: mudança em tarefas_itens que afeta o período relê em cerca de 3 s, sem indicador.
// O cache de sessão de 5 minutos só serve para a aba abrir preenchida: ao abrir, sempre relê.
import { useState, useEffect, useCallback, useRef } from 'react'
import { tarefasConcluidas } from '../lib/atividades'
import { hojeISO } from '../lib/atividadesCarga'
import { addDias } from '../lib/atividadesConcluidas'
import { eventoMudaConcluidas } from '../lib/atividadesRealtime'
import { assinarTarefasItens } from '../lib/tarefasItensRealtime'

const TTL_MS = 5 * 60 * 1000
const ESPERA_REALTIME_MS = 3000
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

  const dadosRef = useRef(dados)
  dadosRef.current = dados

  // Silenciosa: sem indicador e sem trocar dado bom por erro. Mantém todo o período já
  // carregado, para a troca de filtro continuar sem nova leitura.
  const carregar = useCallback(async ({ refresh = false, silencioso = false } = {}) => {
    const minha = ++seq.current
    if (!silencioso) {
      setLoading(true)
      setErro(null)
    }
    try {
      const atual = silencioso ? dadosRef.current : null
      const de = atual?.desde && atual.desde < desde ? atual.desde : desde
      const a = atual?.ate && atual.ate > ate ? atual.ate : ate
      const c = await lerIntervalo(de, a, refresh)
      if (seq.current !== minha) return
      setDados(c)
      gravarCache(c)
    } catch (e) {
      if (seq.current !== minha) return
      if (silencioso) console.warn('[Atividades] releitura das concluídas falhou:', e?.message)
      else setErro(e?.message || 'Falha ao ler as tarefas concluídas')
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
    if (c) {
      // pinta na hora e busca o dado novo, para o F5 nunca mostrar leitura velha
      dadosRef.current = c
      setDados(c)
      carregar({ refresh: true, silencioso: true })
      return
    }
    falhou.current = chave
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, cobre, desde, ate])

  const carregarRef = useRef(carregar)
  carregarRef.current = carregar

  // Tempo real: relê quando a mudança afeta o período carregado. Com a aba escondida, relê ao voltar.
  useEffect(() => {
    if (!ativo) return
    let timer = null
    let mudou = false
    let base = null
    let carregado = null
    const visivel = () => document.visibilityState === 'visible'
    const disparar = () => {
      timer = null
      if (!mudou || !visivel()) return
      mudou = false
      carregarRef.current({ refresh: true, silencioso: true })
    }
    const agendar = () => { if (!timer && mudou && visivel()) timer = setTimeout(disparar, ESPERA_REALTIME_MS) }
    const cancelar = assinarTarefasItens({
      aoMudar: (evento) => {
        const d = dadosRef.current
        if (d !== base) {
          base = d
          carregado = d ? { desde: d.desde, ate: d.ate, ids: new Set(d.tarefas.map((t) => t.id)) } : null
        }
        if (eventoMudaConcluidas(carregado, evento)) { mudou = true; agendar() }
      },
      aoReconectar: () => { mudou = true; agendar() },
    })
    document.addEventListener('visibilitychange', agendar)
    return () => {
      cancelar()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', agendar)
    }
  }, [ativo])

  // Garantia caso o canal caia: relê sem indicador quando a leitura envelhece e a aba está visível
  useEffect(() => {
    if (!ativo) return
    const velho = () => !dadosRef.current?.geradoEm || Date.now() - new Date(dadosRef.current.geradoEm).getTime() >= TTL_MS
    const tick = () => { if (document.visibilityState === 'visible' && velho()) carregarRef.current({ refresh: true, silencioso: true }) }
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
