// Timer do VertaTask (tarefas_tempo, migration 145). Um timer rodando por pessoa.
//
// `useTimer(user)` é um estado compartilhado (o painel da tarefa, o cabeçalho e a coluna esquerda
// mostram o mesmo relógio): um canal realtime só por página, aberto pelo primeiro que usar.
// `useTempoDaTarefa(tarefaId)` lê as entradas de uma tarefa (todas as pessoas) para o painel.
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'

// ── estado compartilhado do timer da pessoa ──────────────────────────────────
let estado = { rodando: null, tarefa: null, carregado: false } // rodando = linha de tarefas_tempo com fim nulo
const ouvintes = new Set()
let usuarioAtual = null
let canal = null
let usos = 0

function emitir(patch) {
  estado = { ...estado, ...patch }
  ouvintes.forEach((f) => f())
}
// mudança em qualquer entrada (painel da tarefa e dashboard releem)
const ouvintesEntradas = new Set()
function avisarEntradas(tarefaId) { ouvintesEntradas.forEach((f) => f(tarefaId)) }

async function lerTarefa(id) {
  if (!id) return null
  const { data } = await supabase.from('tarefas_itens').select('id, titulo, lista_id, parent_id').eq('id', id).maybeSingle()
  return data || null
}

async function lerRodando(userId) {
  if (!supabase || !userId) return
  const { data, error } = await supabase.from('tarefas_tempo').select('*').eq('user_id', userId).is('fim', null).maybeSingle()
  if (error) { console.warn('Timer: não foi possível ler o timer rodando', error); emitir({ carregado: true }); return }
  emitir({ rodando: data || null, tarefa: data ? await lerTarefa(data.tarefa_id) : null, carregado: true })
}

function ligar(userId) {
  usos += 1
  if (usuarioAtual === userId && canal) return
  desligarCanal()
  usuarioAtual = userId
  lerRodando(userId)
  canal = supabase
    .channel(`tarefas-tempo-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tarefas_tempo' }, ({ eventType, new: row, old }) => {
      avisarEntradas(row?.tarefa_id || old?.tarefa_id || null)
      const minha = (row?.user_id || old?.user_id) === userId
      if (!minha && eventType !== 'DELETE') return
      if (eventType === 'DELETE') { if (estado.rodando?.id === old?.id) emitir({ rodando: null, tarefa: null }); return }
      if (!row.fim) {
        if (estado.rodando?.id !== row.id) lerTarefa(row.tarefa_id).then((t) => emitir({ rodando: row, tarefa: t }))
      } else if (estado.rodando?.id === row.id) emitir({ rodando: null, tarefa: null })
    })
    .subscribe((status) => { if (status === 'SUBSCRIBED') lerRodando(userId) })
}
function desligarCanal() {
  if (canal) supabase.removeChannel(canal)
  canal = null
}
function soltar() {
  usos = Math.max(0, usos - 1)
  if (!usos) { desligarCanal(); usuarioAtual = null }
}

/** Relógio que bate a cada segundo enquanto `ativo`. */
export function useAgora(ativo) {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    if (!ativo) return undefined
    const bater = () => setAgora(Date.now())
    const primeiro = setTimeout(bater, 0)
    const id = setInterval(bater, 1000)
    return () => { clearTimeout(primeiro); clearInterval(id) }
  }, [ativo])
  return agora
}

export function useTimer(user) {
  const userId = user?.restrito ? null : user?.id || null
  const snap = useSyncExternalStore(
    useCallback((f) => { ouvintes.add(f); return () => ouvintes.delete(f) }, []),
    () => estado,
  )
  useEffect(() => {
    if (!userId || !supabase) return undefined
    ligar(userId)
    return soltar
  }, [userId])

  const iniciar = useCallback(async (tarefa) => {
    if (!userId) return { error: 'sem usuário' }
    const { data, error } = await supabase.rpc('tarefas_timer_iniciar', { p_tarefa: tarefa.id })
    if (error) return { error: error.message }
    const anterior = estado.rodando
    emitir({ rodando: data, tarefa: { id: tarefa.id, titulo: tarefa.titulo, lista_id: tarefa.lista_id, parent_id: tarefa.parent_id } })
    avisarEntradas(tarefa.id)
    if (anterior && anterior.tarefa_id !== tarefa.id) avisarEntradas(anterior.tarefa_id)
    return { data, anterior }
  }, [userId])

  const parar = useCallback(async () => {
    if (!userId) return { error: 'sem usuário' }
    const anterior = estado.rodando
    const { data, error } = await supabase.rpc('tarefas_timer_parar')
    if (error) return { error: error.message }
    emitir({ rodando: null, tarefa: null })
    if (anterior) avisarEntradas(anterior.tarefa_id)
    return { data: (data || [])[0] || null }
  }, [userId])

  return { habilitado: !!userId, carregado: snap.carregado, rodando: snap.rodando, tarefa: snap.tarefa, iniciar, parar }
}

/** Entradas de tempo de uma tarefa (de todo o time), com total; relê quando alguém mexe. */
export function useTempoDaTarefa(tarefaId, user) {
  const [entradas, setEntradas] = useState([])
  const [carregando, setCarregando] = useState(false)
  const userId = user?.id || null

  const ler = useCallback(async () => {
    if (!supabase || !tarefaId) { setEntradas([]); return }
    setCarregando(true)
    const { data, error } = await supabase.from('tarefas_tempo').select('*').eq('tarefa_id', tarefaId).order('inicio', { ascending: false }).limit(500)
    setCarregando(false)
    if (!error) setEntradas(data || [])
  }, [tarefaId])

  useEffect(() => { ler() }, [ler])
  useEffect(() => {
    const f = (id) => { if (!id || id === tarefaId) ler() }
    ouvintesEntradas.add(f)
    return () => { ouvintesEntradas.delete(f) }
  }, [tarefaId, ler])

  const adicionarManual = useCallback(async ({ inicio, segundos, nota }) => {
    if (!userId) return { error: 'sem usuário' }
    const ini = new Date(inicio)
    const row = { tarefa_id: tarefaId, user_id: userId, inicio: ini.toISOString(), fim: new Date(ini.getTime() + segundos * 1000).toISOString(), origem: 'manual', nota: nota || null }
    const { error } = await supabase.from('tarefas_tempo').insert(row)
    if (error) return { error: error.message }
    avisarEntradas(tarefaId)
    return {}
  }, [tarefaId, userId])

  const excluir = useCallback(async (id) => {
    const { error } = await supabase.from('tarefas_tempo').delete().eq('id', id)
    if (error) return { error: error.message }
    if (estado.rodando?.id === id) emitir({ rodando: null, tarefa: null })
    avisarEntradas(tarefaId)
    return {}
  }, [tarefaId])

  return { entradas, carregando, recarregar: ler, adicionarManual, excluir }
}

/** Para o dashboard reler quando o tempo de qualquer tarefa muda. */
export function useAoMudarTempo(f) {
  useEffect(() => {
    ouvintesEntradas.add(f)
    return () => { ouvintesEntradas.delete(f) }
  }, [f])
}
