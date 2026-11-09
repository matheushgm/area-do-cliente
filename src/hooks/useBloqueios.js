// Quem bloqueia cada tarefa carregada (relações `bloqueia` de tarefas_relacoes, onde a tarefa é
// `relacionada_id`). Só conta quem bloqueia e ainda está aberto: concluída ou arquivada libera.
// A situação de quem bloqueia vem de `itens` quando ela está carregada (acompanha a edição na
// hora) e, se não, da leitura junto com a relação. Lê só os ids novos a cada carga; mudança em
// tarefas_relacoes (realtime) relê as tarefas carregadas.
import { useEffect, useMemo, useRef, useState } from 'react'

const LOTE = 150

async function lerBloqueios(sb, ids) {
  const out = []
  for (let i = 0; i < ids.length; i += LOTE) {
    const { data, error } = await sb
      .from('tarefas_relacoes')
      .select('tarefa_id,relacionada_id,bloqueadora:tarefas_itens!tarefa_id(id,titulo,status_tipo,arquivada)')
      .eq('tipo', 'bloqueia')
      .in('relacionada_id', ids.slice(i, i + LOTE))
    if (error) throw error
    out.push(...(data || []))
  }
  return out
}

const aberta = (t) => !!t && t.status_tipo !== 'closed' && !t.arquivada

/** itens: { id: tarefa }. Devolve { [id]: [{ id, titulo }] } só das tarefas bloqueadas. */
export function useBloqueios(sb, itens) {
  const [linhas, setLinhas] = useState({}) // relacionada_id -> linhas lidas
  const consultados = useRef(new Set())
  const atuais = useRef(itens)

  useEffect(() => {
    atuais.current = itens
    if (!sb || !itens) return
    const novos = Object.keys(itens).filter((id) => !consultados.current.has(id))
    if (!novos.length) return
    for (const id of novos) consultados.current.add(id)
    // sem cancelar na troca de `itens` (muda a cada edição): os ids já estão marcados como lidos
    lerBloqueios(sb, novos)
      .then((rows) => {
        setLinhas((ant) => {
          const m = { ...ant }
          for (const id of novos) delete m[id]
          for (const r of rows) (m[r.relacionada_id] ||= []).push(r)
          return m
        })
      })
      .catch(() => { for (const id of novos) consultados.current.delete(id) })
  }, [sb, itens])

  // relação criada ou apagada (aqui, no painel, no Gantt ou vinda do ClickUp): relê o consultado
  useEffect(() => {
    if (!sb) return
    let timer = null
    const reler = () => {
      clearTimeout(timer)
      timer = setTimeout(async () => {
        // só o que está carregado agora (trocar de pasta não deixa a releitura crescer)
        const ids = Object.keys(atuais.current || {})
        consultados.current = new Set(ids)
        if (!ids.length) return
        try {
          const rows = await lerBloqueios(sb, ids)
          const m = {}
          for (const r of rows) (m[r.relacionada_id] ||= []).push(r)
          setLinhas(m)
        } catch { /* fica o que já estava */ }
      }, 400)
    }
    const canal = sb.channel(`bloqueios-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tarefas_relacoes' }, reler)
      .subscribe()
    return () => { clearTimeout(timer); sb.removeChannel(canal) }
  }, [sb])

  return useMemo(() => {
    const out = {}
    for (const [id, rows] of Object.entries(linhas)) {
      const abertas = []
      for (const r of rows) {
        const b = itens?.[r.tarefa_id] || r.bloqueadora
        if (aberta(b)) abertas.push({ id: b.id, titulo: b.titulo })
      }
      if (abertas.length) out[id] = abertas
    }
    return out
  }, [linhas, itens])
}
