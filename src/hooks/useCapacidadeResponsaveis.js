// Capacidade dos responsáveis da tarefa nova, para o calendário de vencimento (VertaTask).
// Lê a agenda de cada pessoa em /api/atividades (action=disponibilidade, a mesma agenda da
// Capacidade do time) quando os responsáveis mudam; as horas da tarefa entram na conta na hora,
// sem nova leitura. Guarda por pessoa por 2 min para trocar responsável e voltar sem esperar.
import { useEffect, useMemo, useState } from 'react'
import { disponibilidadeResponsaveis } from '../lib/atividades'
import { capacidadeNoCalendario, horasDaNova } from '../lib/capacidadeCalendario'

const TTL_MS = 2 * 60 * 1000
const cache = new Map() // profileId → { em, dias, hoje }
let configCache = null

/** Primeiro nome; com primeiro nome repetido entre os escolhidos, mais a inicial do sobrenome. */
function nomesCurtos(ids, membrosMap) {
  const partes = ids.map((id) => String(membrosMap?.get(id)?.name || '?').trim().split(/\s+/))
  const conta = new Map()
  for (const p of partes) conta.set(p[0], (conta.get(p[0]) || 0) + 1)
  return new Map(ids.map((id, i) => {
    const p = partes[i]
    return [id, conta.get(p[0]) > 1 && p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0]]
  }))
}

// No /dev/lista (só em DEV) a resposta vem de window.__DEV_DISPONIBILIDADE, no formato da API.
function lerDisponibilidade(assignees) {
  const dev = import.meta.env.DEV && typeof window !== 'undefined' ? window.__DEV_DISPONIBILIDADE : null
  if (dev) return new Promise((ok) => setTimeout(() => ok({ ...dev, pessoas: dev.pessoas.filter((p) => assignees.includes(p.profileId)) }), 400))
  return disponibilidadeResponsaveis({ assignees })
}

/**
 * @param {string[]} responsaveis  uuids dos perfis
 * @param {Map} membrosMap         id → perfil (para o nome)
 * @param {object} tarefa          { estimativa_min, tipo_tarefa, dificuldade }
 */
export function useCapacidadeResponsaveis(responsaveis, membrosMap, tarefa) {
  const ids = useMemo(() => [...new Set((responsaveis || []).filter(Boolean))].sort(), [responsaveis])
  const chave = ids.join(',')
  const [dados, setDados] = useState({ chave: '', pessoas: [], hoje: null, erro: '' })
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    if (!ids.length) return
    let vivo = true
    const agora = Date.now()
    const frescos = ids.filter((id) => cache.has(id) && agora - cache.get(id).em < TTL_MS)
    const montar = (erro = '') => ({
      chave,
      pessoas: ids.filter((id) => cache.has(id)).map((id) => ({ id, dias: cache.get(id).dias })),
      hoje: ids.map((id) => cache.get(id)?.hoje).find(Boolean) || null,
      erro,
    })
    if (frescos.length === ids.length && configCache) { setDados(montar()); return }
    setCarregando(true)
    const faltam = ids.filter((id) => !frescos.includes(id))
    lerDisponibilidade(faltam.length ? faltam : ids)
      .then((r) => {
        for (const p of r?.pessoas || []) cache.set(p.profileId || p.chave, { em: Date.now(), dias: p.dias, hoje: r.hoje })
        if (r?.config) configCache = r.config
        const semLeitura = (r?.erros || []).length
        if (vivo) setDados(montar(semLeitura ? (r.erros[0]?.error || 'erro') : ''))
      })
      .catch((e) => { if (vivo) setDados(montar(e?.message || 'erro')) })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
    // ids muda junto com a chave
  }, [chave]) // eslint-disable-line react-hooks/exhaustive-deps

  const { horas, origem } = horasDaNova(tarefa || {}, configCache || {})
  const resultado = useMemo(() => {
    if (!dados.pessoas.length || dados.chave !== chave) return null
    const hoje = dados.hoje || new Date().toISOString().slice(0, 10)
    const nomes = nomesCurtos(ids, membrosMap)
    const pessoas = dados.pessoas.map((p) => ({ nome: nomes.get(p.id) || '?', dias: p.dias }))
    return capacidadeNoCalendario(pessoas, horas, hoje)
  }, [dados, chave, ids, horas, membrosMap])

  if (!ids.length) return null
  return {
    carregando: carregando || dados.chave !== chave,
    erro: dados.chave === chave ? dados.erro : '',
    horas, origem,
    porDia: resultado?.porDia || new Map(),
    sugerida: resultado?.sugerida || null,
    nivelSugerida: resultado?.nivelSugerida || null,
    nomes: [...nomesCurtos(ids, membrosMap).values()],
  }
}
