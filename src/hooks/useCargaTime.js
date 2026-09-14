// Carga do time (painel de capacidade): lê o ClickUp em lotes de 3 pessoas e
// entrega as linhas conforme chegam. Guarda o último resultado em
// sessionStorage por 10 minutos para a página abrir já pintada.
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { cargaTime } from '../lib/atividades'
import { enriquecerPessoa, departamentosDe } from '../lib/atividadesCarga'

const LOTE = 3
const TTL_MS = 5 * 60 * 1000           // cache da sessão
const AUTO_REFRESH_MS = 5 * 60 * 1000  // relê o ClickUp sozinho enquanto a aba está visível
const KEY = 'atividades_carga_v1'

function lerCache() {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const c = JSON.parse(raw)
    if (!c?.geradoEm || Date.now() - new Date(c.geradoEm).getTime() > TTL_MS) return null
    // cache só de erros não vale: melhor tentar o ClickUp de novo
    if (!Array.isArray(c.pessoas) || c.pessoas.length === 0) return null
    return c
  } catch { return null }
}
function gravarCache(c) {
  try { sessionStorage.setItem(KEY, JSON.stringify(c)) } catch { /* sem espaço: segue sem cache */ }
}

/**
 * @param {Array<{id, nome, avatar, clickupId}>} membros  time (perfis com ou sem ClickUp)
 * @param {Array} squads  para descobrir o departamento de cada um
 */
export function useCargaTime(membros, squads) {
  const [porId, setPorId] = useState(() => new Map())     // clickupId → resultado da API
  const [erros, setErros] = useState(() => new Map())     // clickupId → mensagem
  const [loading, setLoading] = useState(false)
  const [progresso, setProgresso] = useState({ lidas: 0, total: 0 })
  const [geradoEm, setGeradoEm] = useState(null)
  const [hoje, setHoje] = useState(null)
  const seq = useRef(0)

  const ids = useMemo(() => membros.map((m) => m.clickupId).filter((n) => n > 0), [membros])

  const carregar = useCallback(async ({ refresh = false, apenas = null } = {}) => {
    const alvo = apenas ? ids.filter((id) => apenas.includes(id)) : ids
    if (alvo.length === 0) return
    const minha = ++seq.current
    setLoading(true)
    setProgresso({ lidas: 0, total: alvo.length })
    const novo = apenas ? new Map(porId) : new Map()
    const novosErros = apenas ? new Map(erros) : new Map()
    let ultimoHoje = hoje
    for (let i = 0; i < alvo.length; i += LOTE) {
      const lote = alvo.slice(i, i + LOTE)
      try {
        const r = await cargaTime({ assignees: lote, refresh })
        if (seq.current !== minha) return
        ultimoHoje = r.hoje || ultimoHoje
        for (const p of r.pessoas || []) { novo.set(p.clickupUserId, p); novosErros.delete(p.clickupUserId) }
        for (const e of r.erros || []) { novosErros.set(e.clickupUserId, e.error); novo.delete(e.clickupUserId) }
      } catch (e) {
        if (seq.current !== minha) return
        for (const id of lote) novosErros.set(id, e.message)
      }
      setPorId(new Map(novo))
      setErros(new Map(novosErros))
      setHoje(ultimoHoje)
      setProgresso({ lidas: Math.min(alvo.length, i + LOTE), total: alvo.length })
    }
    const agora = new Date().toISOString()
    setGeradoEm(agora)
    setLoading(false)
    if (novo.size > 0) gravarCache({ geradoEm: agora, hoje: ultimoHoje, pessoas: Array.from(novo.values()), erros: Array.from(novosErros.entries()) })
  }, [ids, porId, erros, hoje])

  // primeira carga: cache da sessão (se fresco) e, se não houver, ClickUp
  useEffect(() => {
    if (ids.length === 0) return
    const c = lerCache()
    if (c) {
      setPorId(new Map((c.pessoas || []).map((p) => [p.clickupUserId, p])))
      setErros(new Map(c.erros || []))
      setGeradoEm(c.geradoEm)
      setHoje(c.hoje)
      return
    }
    carregar()
    // só na montagem / quando o conjunto de ids muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(',')])

  // Integração nos dois sentidos: o que é editado aqui vai na hora para o
  // ClickUp; o que muda lá chega em até 5 minutos enquanto a página está aberta
  // (e imediatamente ao voltar para a aba, se a leitura estiver velha).
  const geradoEmRef = useRef(geradoEm)
  geradoEmRef.current = geradoEm
  const carregarRef = useRef(carregar)
  carregarRef.current = carregar
  useEffect(() => {
    if (ids.length === 0) return
    const velho = () => !geradoEmRef.current || Date.now() - new Date(geradoEmRef.current).getTime() >= AUTO_REFRESH_MS
    const tick = () => { if (document.visibilityState === 'visible' && velho()) carregarRef.current({ refresh: true }) }
    const timer = setInterval(tick, 60 * 1000)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick) }
  }, [ids])

  const pessoas = useMemo(() => {
    return membros.map((m) => {
      const meta = { profileId: m.id, nome: m.nome, avatar: m.avatar, clickupId: m.clickupId, departamentos: departamentosDe(m.id, squads) }
      const api = m.clickupId ? porId.get(m.clickupId) : null
      const erro = m.clickupId ? erros.get(m.clickupId) || null : null
      return enriquecerPessoa(api, meta, { erro, hoje })
    })
  }, [membros, squads, porId, erros, hoje])

  const lidas = useMemo(() => pessoas.filter((p) => p.api).length, [pessoas])
  const refresh = useCallback((apenas = null) => carregar({ refresh: true, apenas }), [carregar])
  const recarregar = useCallback(() => carregar({ refresh: false }), [carregar])

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
