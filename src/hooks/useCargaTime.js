// Carga do time (painel de capacidade): lê as tarefas_* (espelho do ClickUp, as mesmas tabelas do
// VertaTask) em lotes de 3 pessoas e entrega as linhas conforme chegam.
//
// Tempo real: assina as mudanças de tarefas_itens e relê só as pessoas afetadas, cerca de 2 s depois.
// A releitura do time inteiro a cada 5 min fica como garantia caso o canal caia. O último resultado
// fica em sessionStorage só para a página abrir já pintada: ao montar, sempre busca o dado novo.
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { cargaTime } from '../lib/atividades'
import { enriquecerPessoa, departamentosDe } from '../lib/atividadesCarga'
import { supabase } from '../lib/supabase'
import { assinarTarefasItens } from '../lib/tarefasItensRealtime'
import { completarIndiceCarga, criarFilaCarga, perfisAfetadosPeloEvento } from '../lib/atividadesRealtime'

const LOTE = 3
const TTL_MS = 5 * 60 * 1000           // cache da sessão
const AUTO_REFRESH_MS = 5 * 60 * 1000  // garantia: relê o time inteiro enquanto a aba está visível
const ESPERA_REALTIME_MS = 2000        // agrupa as mudanças em sequência numa leitura só
const PAGINA_INDICE = 1000
const KEY = 'atividades_carga_v1'

function lerCache() {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const c = JSON.parse(raw)
    if (!c?.geradoEm || Date.now() - new Date(c.geradoEm).getTime() > TTL_MS) return null
    // cache só de erros não vale: melhor tentar de novo
    if (!Array.isArray(c.pessoas) || c.pessoas.length === 0) return null
    return c
  } catch { return null }
}
function gravarCache(c) {
  try { sessionStorage.setItem(KEY, JSON.stringify(c)) } catch { /* sem espaço: segue sem cache */ }
}

/** Tarefas abertas e seus responsáveis: é como o realtime descobre quem perdeu uma tarefa. */
async function lerIndiceCarga() {
  const rows = []
  for (let de = 0; ; de += PAGINA_INDICE) {
    const { data, error } = await supabase
      .from('tarefas_itens')
      .select('id,responsaveis')
      .neq('status_tipo', 'closed')
      .eq('arquivada', false)
      .order('id')
      .range(de, de + PAGINA_INDICE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGINA_INDICE) return rows
  }
}

// chave enviada à API: clickup_user_id (número) ou, para quem não tem ClickUp, o uuid do perfil
const chaveDe = (m) => m.clickupId || m.id

/**
 * @param {Array<{id, nome, avatar, clickupId}>} membros  time (perfis com ou sem ClickUp)
 * @param {Array} squads  para descobrir o departamento de cada um
 */
export function useCargaTime(membros, squads) {
  const [porId, setPorId] = useState(() => new Map())     // chave → resultado da API
  const [erros, setErros] = useState(() => new Map())     // chave → mensagem
  const [loading, setLoading] = useState(false)
  const [progresso, setProgresso] = useState({ lidas: 0, total: 0 })
  const [geradoEm, setGeradoEm] = useState(null)
  const [hoje, setHoje] = useState(null)

  const ids = useMemo(() => membros.map(chaveDe).filter(Boolean), [membros])
  const idsChave = ids.join(',')
  const idsRef = useRef(ids)
  idsRef.current = ids
  const chavePorPerfil = useRef(new Map())
  chavePorPerfil.current = useMemo(() => new Map(membros.map((m) => [m.id, chaveDe(m)])), [membros])

  // A fila escreve aqui e publica cópias no estado: as leituras não dependem de closure velha.
  const porIdRef = useRef(new Map())
  const errosRef = useRef(new Map())
  const hojeRef = useRef(null)
  const leuAlgo = useRef(false)
  const completaEm = useRef(0)
  const filaRef = useRef(null)

  const publicar = useCallback(() => {
    setPorId(new Map(porIdRef.current))
    setErros(new Map(errosRef.current))
  }, [])

  const fila = useCallback(() => {
    if (filaRef.current) return filaRef.current
    filaRef.current = criarFilaCarga({
      tamanhoLote: LOTE,
      ler: (lote) => cargaTime({ assignees: lote, refresh: true }),
      aoLer: (r) => {
        if (r.hoje) { hojeRef.current = r.hoje; setHoje(r.hoje) }
        for (const p of r.pessoas || []) { porIdRef.current.set(p.clickupUserId, p); errosRef.current.delete(p.clickupUserId) }
        for (const e of r.erros || []) { errosRef.current.set(e.clickupUserId, e.error); porIdRef.current.delete(e.clickupUserId) }
        leuAlgo.current = true
        publicar()
      },
      aoFalhar: (e, lote, silencioso) => {
        // Leitura em segundo plano que falha não apaga o dado bom da tela: a garantia tenta de novo.
        if (silencioso) console.warn('[Atividades] releitura da carga falhou:', e.message)
        for (const id of lote) {
          if (!silencioso || !porIdRef.current.has(id)) errosRef.current.set(id, e.message)
        }
        publicar()
      },
      aoProgresso: ({ visivel, lidas, total }) => {
        setLoading(visivel)
        if (visivel) setProgresso({ lidas, total })
      },
      aoTerminar: ({ completa }) => {
        if (completa) completaEm.current = Date.now()
        if (!leuAlgo.current) return
        leuAlgo.current = false
        const agora = new Date().toISOString()
        setGeradoEm(agora)
        if (porIdRef.current.size > 0) {
          gravarCache({ geradoEm: agora, hoje: hojeRef.current, pessoas: Array.from(porIdRef.current.values()), erros: Array.from(errosRef.current.entries()) })
        }
      },
    })
    return filaRef.current
  }, [publicar])

  useEffect(() => () => { filaRef.current?.encerrar(); filaRef.current = null }, [])

  // primeira carga: pinta o cache da sessão (se fresco) e busca o dado novo mesmo assim
  useEffect(() => {
    if (idsRef.current.length === 0) return
    const c = lerCache()
    if (c) {
      porIdRef.current = new Map((c.pessoas || []).map((p) => [p.clickupUserId, p]))
      errosRef.current = new Map(c.erros || [])
      hojeRef.current = c.hoje
      publicar()
      setGeradoEm(c.geradoEm)
      setHoje(c.hoje)
    }
    fila().pedir(idsRef.current, { silencioso: !!c, completa: true })
    // só na montagem / quando o conjunto de ids muda
  }, [idsChave, fila, publicar])

  // Tempo real: relê quem ganhou ou perdeu carga. Com a aba escondida, acumula e relê ao voltar.
  useEffect(() => {
    if (idsRef.current.length === 0) return
    const indice = new Map()
    const afetados = new Set()
    let timer = null
    let vivo = true
    const visivel = () => document.visibilityState === 'visible'
    const lerIndice = () => lerIndiceCarga()
      .then((rows) => { if (vivo) completarIndiceCarga(indice, rows) })
      .catch((e) => console.warn('[Atividades] índice de responsáveis:', e.message))
    const descarregar = () => {
      timer = null
      if (afetados.size === 0 || !visivel()) return
      const chaves = [...afetados]
      afetados.clear()
      fila().pedir(chaves, { silencioso: true })
    }
    const agendar = () => { if (!timer && visivel() && afetados.size > 0) timer = setTimeout(descarregar, ESPERA_REALTIME_MS) }

    lerIndice()
    const cancelar = assinarTarefasItens({
      aoMudar: (evento) => {
        for (const perfil of perfisAfetadosPeloEvento(indice, evento)) {
          const chave = chavePorPerfil.current.get(perfil)
          if (chave) afetados.add(chave)
        }
        agendar()
      },
      aoReconectar: () => {
        lerIndice()
        fila().pedir(idsRef.current, { silencioso: true, completa: true })
      },
    })
    document.addEventListener('visibilitychange', agendar)
    return () => {
      vivo = false
      cancelar()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', agendar)
    }
  }, [idsChave, fila])

  // Garantia caso o canal caia ou um evento se perca: relê o time inteiro sem indicador na tela.
  useEffect(() => {
    if (idsRef.current.length === 0) return
    const tick = () => {
      if (document.visibilityState !== 'visible' || Date.now() - completaEm.current < AUTO_REFRESH_MS) return
      fila().pedir(idsRef.current, { silencioso: true, completa: true })
    }
    const timer = setInterval(tick, 60 * 1000)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick) }
  }, [idsChave, fila])

  const pessoas = useMemo(() => {
    return membros.map((m) => {
      const meta = { profileId: m.id, nome: m.nome, avatar: m.avatar, foto: m.foto || null, clickupId: m.clickupId, departamentos: departamentosDe(m.id, squads) }
      const api = porId.get(chaveDe(m)) || null
      const erro = erros.get(chaveDe(m)) || null
      return enriquecerPessoa(api, meta, { erro, hoje })
    })
  }, [membros, squads, porId, erros, hoje])

  const lidas = useMemo(() => pessoas.filter((p) => p.api).length, [pessoas])
  const refresh = useCallback((apenas = null) => {
    const alvo = apenas ? idsRef.current.filter((id) => apenas.includes(id)) : idsRef.current
    return fila().pedir(alvo, { completa: !apenas })
  }, [fila])
  const recarregar = useCallback(() => refresh(), [refresh])

  return {
    pessoas,
    lidas,
    loading,
    progresso,
    geradoEm,
    hoje,
    envelhecido: geradoEm ? Date.now() - new Date(geradoEm).getTime() > 30 * 60 * 1000 : false,
    refresh,
    recarregar,
  }
}
