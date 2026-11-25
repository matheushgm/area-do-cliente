// Dados do Chat (modelo do ClickUp Chat): canais públicos + DMs + threads,
// não lidas, favoritos, reações e realtime. Tabelas chat_channels /
// chat_channel_members / chat_messages (migrations 041, 043, 086, 087).
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { extrairMencoes } from '../lib/chat'
import { marcarMencoesLidas } from '../lib/mencoes'

const LIMITE_MSGS = 300

export function useChat({ user, teamMembers }) {
  const [canais, setCanais] = useState([])
  const [membrosPorCanal, setMembrosPorCanal] = useState(new Map()) // channel_id → [{user_id, last_read_at, favorite}]
  const [naoLidas, setNaoLidas] = useState(new Map())               // channel_id → { unread, mentions }
  const [carregando, setCarregando] = useState(true)
  const [tick, setTick] = useState(0)
  const recarregar = useCallback(() => setTick((t) => t + 1), [])

  const [canalAtivo, setCanalAtivoState] = useState(null)
  const [mensagens, setMensagens] = useState([])                     // raízes do canal ativo
  const [respondentes, setRespondentes] = useState(new Map())        // root_id → [user_id]
  const [carregandoMsgs, setCarregandoMsgs] = useState(false)
  const [temAnteriores, setTemAnteriores] = useState(false)          // há raízes mais antigas que as carregadas
  const [carregandoAnteriores, setCarregandoAnteriores] = useState(false)
  const [raizAvulsa, setRaizAvulsa] = useState(null)                 // raiz da thread aberta que não está entre as carregadas
  // Thread pedida junto com a troca de canal (link de notificação `?channel=&thread=`): a troca
  // de canal limpa a thread, então ela é guardada aqui e aplicada depois da limpeza.
  const threadInicial = useRef(null)
  const setCanalAtivo = useCallback((id, thread = null) => {
    threadInicial.current = thread || null
    setCanalAtivoState(id)
  }, [])

  const [threadId, setThreadId] = useState(null)
  const [respostas, setRespostas] = useState([])
  const [carregandoThread, setCarregandoThread] = useState(false)

  const canalAtivoRef = useRef(null)
  const threadRef = useRef(null)
  useEffect(() => { canalAtivoRef.current = canalAtivo }, [canalAtivo])
  useEffect(() => { threadRef.current = threadId }, [threadId])
  const mensagensRef = useRef([])
  useEffect(() => { mensagensRef.current = mensagens }, [mensagens])
  const userId = user?.id

  const membrosMap = useMemo(() => new Map(teamMembers.map((m) => [m.id, m])), [teamMembers])

  // ── Canais + membros + não lidas ────────────────────────────────────────
  useEffect(() => {
    if (!supabase || !userId) return
    let cancelado = false
    ;(async () => {
      setCarregando(true)
      const [{ data: chs, error: e1 }, { data: mems, error: e2 }, { data: unread }] = await Promise.all([
        supabase.from('chat_channels').select('*').eq('archived', false).order('created_at'),
        supabase.from('chat_channel_members').select('channel_id, user_id, last_read_at, favorite'),
        supabase.rpc('chat_unread_counts'),
      ])
      if (cancelado) return
      if (e1) console.error(e1)
      if (e2) console.error(e2)
      const mm = new Map()
      for (const m of mems || []) { if (!mm.has(m.channel_id)) mm.set(m.channel_id, []); mm.get(m.channel_id).push(m) }
      setMembrosPorCanal(mm)
      setNaoLidas(new Map((unread || []).map((u) => [u.channel_id, { unread: Number(u.unread), mentions: Number(u.mentions) }])))
      setCanais(chs || [])
      setCarregando(false)
    })()
    return () => { cancelado = true }
  }, [userId, tick])

  const canaisEnriquecidos = useMemo(() => canais.map((c) => {
    const ms = membrosPorCanal.get(c.id) || []
    const minha = ms.find((m) => m.user_id === userId)
    const outros = ms.filter((m) => m.user_id !== userId).map((m) => m.user_id)
    let nome = c.name
    if (c.type === 'dm') {
      const outro = outros[0] ? membrosMap.get(outros[0]) : null
      nome = outro?.name || (outros.length === 0 ? `${user?.name} (você)` : 'Conversa')
    }
    return {
      ...c,
      nome,
      member_ids: ms.map((m) => m.user_id),
      souMembro: !!minha,
      favorito: !!minha?.favorite,
      naoLidas: naoLidas.get(c.id)?.unread || 0,
      mencoes: naoLidas.get(c.id)?.mentions || 0,
      dmCom: c.type === 'dm' ? (outros[0] ? membrosMap.get(outros[0]) : null) : null,
    }
  }), [canais, membrosPorCanal, naoLidas, membrosMap, userId, user?.name])

  // ── Mensagens do canal ativo ────────────────────────────────────────────
  // Quem respondeu em cada thread das raízes dadas (avatares do resumo da thread).
  async function lerRespondentes(raizes) {
    const comThread = raizes.filter((m) => m.replies_count > 0).map((m) => m.id)
    const resp = new Map()
    if (!comThread.length) return resp
    const { data: rs } = await supabase.from('chat_messages').select('parent_id, user_id').in('parent_id', comThread).order('created_at')
    for (const r of rs || []) {
      if (!resp.has(r.parent_id)) resp.set(r.parent_id, [])
      const lista = resp.get(r.parent_id)
      if (r.user_id && !lista.includes(r.user_id)) lista.push(r.user_id)
    }
    return resp
  }

  // `silencioso`: releitura depois de reconectar/voltar para a aba. Não pisca o carregando e
  // junta com o que já está na tela (mantém as antigas que a pessoa carregou).
  const carregarMensagens = useCallback(async (canalId, { silencioso = false } = {}) => {
    if (!supabase || !canalId) return
    if (!silencioso) setCarregandoMsgs(true)
    const { data, error } = await supabase
      .from('chat_messages').select('*')
      .eq('channel_id', canalId).is('parent_id', null)
      .order('created_at', { ascending: false }).limit(LIMITE_MSGS)
    if (error) { console.error(error); setCarregandoMsgs(false); return }
    const raizes = (data || []).reverse()
    const resp = await lerRespondentes(raizes)
    if (canalAtivoRef.current !== canalId) return
    if (silencioso) {
      const ids = new Set(raizes.map((m) => m.id))
      const desde = raizes[0]?.created_at
      setMensagens((prev) => [...prev.filter((m) => !ids.has(m.id) && desde && m.created_at < desde), ...raizes])
      setRespondentes((prev) => new Map([...prev, ...resp]))
    } else {
      setRespondentes(resp)
      setMensagens(raizes)
      setTemAnteriores((data || []).length >= LIMITE_MSGS)
    }
    setCarregandoMsgs(false)
  }, [])

  // Mensagens mais antigas que a primeira carregada. `ate` (data) traz tudo até ela, para o
  // link de uma mensagem antiga (`?msg=`) conseguir mostrá-la.
  const carregarAnteriores = useCallback(async ({ ate } = {}) => {
    const canalId = canalAtivoRef.current
    const primeira = mensagensRef.current[0]
    if (!supabase || !canalId || !primeira) return
    setCarregandoAnteriores(true)
    let q = supabase.from('chat_messages').select('*')
      .eq('channel_id', canalId).is('parent_id', null)
      .lt('created_at', primeira.created_at)
      .order('created_at', { ascending: false })
    q = ate ? q.gte('created_at', ate).limit(2000) : q.limit(LIMITE_MSGS)
    const { data, error } = await q
    if (error) { console.error(error); setCarregandoAnteriores(false); return }
    const antigas = (data || []).reverse()
    const resp = await lerRespondentes(antigas)
    if (canalAtivoRef.current !== canalId) return
    setMensagens((prev) => [...antigas.filter((m) => !prev.some((x) => x.id === m.id)), ...prev])
    setRespondentes((prev) => new Map([...resp, ...prev]))
    if (ate) {
      // Ainda pode haver mais antigas que `ate`: confere com uma linha.
      const { data: mais } = await supabase.from('chat_messages').select('id').eq('channel_id', canalId).is('parent_id', null).lt('created_at', ate).limit(1)
      setTemAnteriores(!!mais?.length)
    } else setTemAnteriores(antigas.length >= LIMITE_MSGS)
    setCarregandoAnteriores(false)
  }, [])

  useEffect(() => {
    setMensagens([]); setRespondentes(new Map()); setRespostas([]); setTemAnteriores(false)
    setThreadId(threadInicial.current)
    threadInicial.current = null
    if (canalAtivo) carregarMensagens(canalAtivo)
  }, [canalAtivo, carregarMensagens])

  // ── Thread aberta ───────────────────────────────────────────────────────
  const carregarThread = useCallback(async (id, { silencioso = false } = {}) => {
    if (!supabase || !id) return
    if (!silencioso) setCarregandoThread(true)
    const { data, error } = await supabase.from('chat_messages').select('*').eq('parent_id', id).order('created_at')
    if (threadRef.current !== id) return
    if (error) console.error(error)
    setRespostas(data || [])
    setCarregandoThread(false)
  }, [])

  useEffect(() => {
    if (!supabase || !threadId) { setRespostas([]); return }
    carregarThread(threadId)
  }, [threadId, carregarThread])

  // A raiz da thread pode ser mais antiga que as raízes carregadas (link de notificação de
  // uma thread antiga): busca ela sozinha para o painel abrir mesmo assim.
  useEffect(() => {
    if (!supabase || !threadId || mensagens.some((m) => m.id === threadId)) { setRaizAvulsa(null); return undefined }
    if (carregandoMsgs) return undefined
    let cancelado = false
    supabase.from('chat_messages').select('*').eq('id', threadId).maybeSingle().then(({ data }) => {
      if (!cancelado) setRaizAvulsa(data && data.channel_id === canalAtivoRef.current ? data : null)
    })
    return () => { cancelado = true }
  }, [threadId, mensagens, carregandoMsgs])
  const raizThread = useMemo(
    () => mensagens.find((m) => m.id === threadId) || (raizAvulsa?.id === threadId ? raizAvulsa : null),
    [mensagens, threadId, raizAvulsa],
  )

  // ── Marcar como lido ────────────────────────────────────────────────────
  const marcarLido = useCallback(async (canalId) => {
    if (!supabase || !userId || !canalId) return
    setNaoLidas((prev) => { if (!prev.get(canalId)?.unread) return prev; const n = new Map(prev); n.delete(canalId); return n })
    await supabase.from('chat_channel_members').update({ last_read_at: new Date().toISOString() }).eq('channel_id', canalId).eq('user_id', userId)
  }, [userId])

  useEffect(() => { if (canalAtivo) marcarLido(canalAtivo) }, [canalAtivo, marcarLido])

  // ── Realtime (uma assinatura para tudo) ─────────────────────────────────
  useEffect(() => {
    if (!supabase || !userId) return
    let jaConectou = false
    let escondidaDesde = null
    const ch = supabase.channel('chat-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, ({ new: row }) => {
        const canalId = row.channel_id
        setCanais((prev) => prev.map((c) => c.id === canalId ? { ...c, last_message_at: row.created_at } : c))
        if (canalId === canalAtivoRef.current) {
          if (!row.parent_id) {
            setMensagens((prev) => prev.some((m) => m.id === row.id) ? prev : [...prev, row])
          } else {
            setMensagens((prev) => prev.map((m) => m.id === row.parent_id
              ? { ...m, replies_count: (m.replies_count || 0) + (prev.some((x) => x.id === row.id) ? 0 : 1), last_reply_at: row.created_at }
              : m))
            if (row.user_id) setRespondentes((prev) => {
              const n = new Map(prev); const l = [...(n.get(row.parent_id) || [])]
              if (!l.includes(row.user_id)) l.push(row.user_id); n.set(row.parent_id, l); return n
            })
            if (row.parent_id === threadRef.current) setRespostas((prev) => prev.some((r) => r.id === row.id) ? prev : [...prev, row])
          }
          if (row.user_id !== userId && document.visibilityState === 'visible') {
            marcarLido(canalId)
            // A notificação nasce na mesma transação da mensagem; a pessoa já está vendo.
            if ((row.mentioned_user_ids || []).includes(userId)) marcarMencoesLidas({ canalId })
          } else if (row.user_id !== userId) bump(canalId, row)
        } else if (row.user_id !== userId) {
          bump(canalId, row)
        }
        function bump(id, r) {
          setNaoLidas((prev) => {
            const n = new Map(prev); const cur = n.get(id) || { unread: 0, mentions: 0 }
            n.set(id, { unread: cur.unread + 1, mentions: cur.mentions + ((r.mentioned_user_ids || []).includes(userId) ? 1 : 0) })
            return n
          })
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, ({ new: row }) => {
        const patch = (m) => m.id === row.id ? { ...m, ...row } : m
        setMensagens((prev) => prev.map(patch))
        setRespostas((prev) => prev.map(patch))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, ({ old }) => {
        setMensagens((prev) => prev.filter((m) => m.id !== old.id))
        setRespostas((prev) => prev.filter((m) => m.id !== old.id))
        if (old.parent_id) setMensagens((prev) => prev.map((m) => m.id === old.parent_id ? { ...m, replies_count: Math.max(0, (m.replies_count || 1) - 1) } : m))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_channels' }, () => recarregar())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_channel_members', filter: `user_id=eq.${userId}` }, () => recarregar())
      .subscribe((status) => {
        // O realtime não reenvia o que passou com a conexão fora (notebook dormindo, wi-fi
        // caiu): a cada reconexão relê canais, não lidas, a conversa aberta e a thread.
        if (status !== 'SUBSCRIBED') return
        if (jaConectou) ressincronizar()
        jaConectou = true
      })
    function ressincronizar() {
      recarregar()
      if (canalAtivoRef.current) carregarMensagens(canalAtivoRef.current, { silencioso: true })
      if (threadRef.current) carregarThread(threadRef.current, { silencioso: true })
    }
    // Aba escondida por mais de 1 min: o navegador pode ter congelado o socket sem avisar.
    const aoVisibilidade = () => {
      if (document.visibilityState === 'hidden') { escondidaDesde = Date.now(); return }
      if (escondidaDesde && Date.now() - escondidaDesde > 60000) ressincronizar()
      escondidaDesde = null
    }
    document.addEventListener('visibilitychange', aoVisibilidade)
    window.addEventListener('online', ressincronizar)
    return () => {
      supabase.removeChannel(ch)
      document.removeEventListener('visibilitychange', aoVisibilidade)
      window.removeEventListener('online', ressincronizar)
    }
  }, [userId, marcarLido, recarregar, carregarMensagens, carregarThread])

  // ── Ações ───────────────────────────────────────────────────────────────
  const garantirMembro = useCallback(async (canalId) => {
    const ms = membrosPorCanal.get(canalId) || []
    if (ms.some((m) => m.user_id === userId)) return
    await supabase.from('chat_channel_members').upsert({ channel_id: canalId, user_id: userId }, { onConflict: 'channel_id,user_id', ignoreDuplicates: true })
    setMembrosPorCanal((prev) => { const n = new Map(prev); n.set(canalId, [...(n.get(canalId) || []), { channel_id: canalId, user_id: userId, last_read_at: new Date().toISOString(), favorite: false }]); return n })
  }, [membrosPorCanal, userId])

  // Sincronização com o ClickUp Chat desligada desde 2026-10-29 (era o único consumo da API do
  // ClickUp que nunca parava: um pull a cada 2 min por aba aberta). O chat continua só aqui;
  // A tarja "offline" (coluna do VertaTask e topo do módulo) usa `CHAT_OFFLINE` de src/lib/chat.js.

  const enviar = useCallback(async ({ canalId, texto, parentId = null, tambemNoCanal = false, attachments = [] }) => {
    const limpo = (texto || '').trim()
    if ((!limpo && !attachments.length) || !canalId || !supabase) return { error: 'vazio' }
    await garantirMembro(canalId)
    const mencionados = extrairMencoes(limpo, teamMembers)
    const linhas = [{ channel_id: canalId, user_id: userId, content: limpo, mentioned_user_ids: mencionados, parent_id: parentId, attachments }]
    if (parentId && tambemNoCanal) linhas.push({ channel_id: canalId, user_id: userId, content: limpo, mentioned_user_ids: mencionados, parent_id: null, attachments })
    const { data, error } = await supabase.from('chat_messages').insert(linhas).select()
    if (error) { console.error(error); return { error: error.message } }
    for (const row of data || []) {
      if (!row.parent_id) setMensagens((prev) => prev.some((m) => m.id === row.id) ? prev : [...prev, row])
      else {
        setRespostas((prev) => prev.some((m) => m.id === row.id) ? prev : [...prev, row])
        setMensagens((prev) => prev.map((m) => m.id === row.parent_id ? { ...m, replies_count: (m.replies_count || 0) + 1, last_reply_at: row.created_at } : m))
        setRespondentes((prev) => { const n = new Map(prev); const l = [...(n.get(row.parent_id) || [])]; if (!l.includes(userId)) l.push(userId); n.set(row.parent_id, l); return n })
      }
    }
    return { data }
  }, [garantirMembro, teamMembers, userId])

  const excluir = useCallback(async (msg) => {
    setMensagens((prev) => prev.filter((m) => m.id !== msg.id))
    setRespostas((prev) => prev.filter((m) => m.id !== msg.id))
    if (msg.parent_id) setMensagens((prev) => prev.map((m) => m.id === msg.parent_id ? { ...m, replies_count: Math.max(0, (m.replies_count || 1) - 1) } : m))
    const { error } = await supabase.from('chat_messages').delete().eq('id', msg.id)
    if (error) console.error(error)
  }, [])

  const reagir = useCallback(async (msg, emoji) => {
    // otimista
    const aplicar = (m) => {
      if (m.id !== msg.id) return m
      const r = { ...(m.reactions || {}) }
      const lista = [...(r[emoji] || [])]
      const i = lista.indexOf(userId)
      if (i >= 0) lista.splice(i, 1); else lista.push(userId)
      if (lista.length) r[emoji] = lista; else delete r[emoji]
      return { ...m, reactions: r }
    }
    setMensagens((prev) => prev.map(aplicar))
    setRespostas((prev) => prev.map(aplicar))
    const { error } = await supabase.rpc('chat_toggle_reaction', { p_message: msg.id, p_emoji: emoji })
    if (error) console.error(error)
  }, [userId])

  const alternarFavorito = useCallback(async (canal) => {
    await garantirMembro(canal.id)
    const novo = !canal.favorito
    setMembrosPorCanal((prev) => { const n = new Map(prev); n.set(canal.id, (n.get(canal.id) || []).map((m) => m.user_id === userId ? { ...m, favorite: novo } : m)); return n })
    const { error } = await supabase.from('chat_channel_members').update({ favorite: novo }).eq('channel_id', canal.id).eq('user_id', userId)
    if (error) console.error(error)
  }, [garantirMembro, userId])

  const criarCanal = useCallback(async ({ nome, membros, privado, projectId = null }) => {
    const { data: ch, error } = await supabase.from('chat_channels')
      .insert({ name: nome, type: 'channel', created_by: userId, visibility: privado ? 'private' : 'public', project_id: projectId })
      .select().single()
    if (error) return { error: error.message }
    const ids = Array.from(new Set([...(membros || []), userId]))
    const { error: e2 } = await supabase.from('chat_channel_members').insert(ids.map((uid) => ({ channel_id: ch.id, user_id: uid })))
    if (e2) return { error: e2.message }
    recarregar()
    return { data: ch }
  }, [userId, recarregar])

  const abrirDM = useCallback(async (outro) => {
    const existente = canaisEnriquecidos.find((c) => c.type === 'dm' && c.member_ids.length === 2 && c.member_ids.includes(userId) && c.member_ids.includes(outro.id))
    if (existente) return { data: existente }
    const { data: ch, error } = await supabase.from('chat_channels').insert({ type: 'dm', created_by: userId, visibility: 'private' }).select().single()
    if (error) return { error: error.message }
    const { error: e2 } = await supabase.from('chat_channel_members').insert([{ channel_id: ch.id, user_id: userId }, { channel_id: ch.id, user_id: outro.id }])
    if (e2) return { error: e2.message }
    recarregar()
    return { data: ch }
  }, [canaisEnriquecidos, userId, recarregar])

  return {
    canais: canaisEnriquecidos, carregando, membrosMap,
    canalAtivo, setCanalAtivo, mensagens, respondentes, carregandoMsgs,
    temAnteriores, carregandoAnteriores, carregarAnteriores,
    threadId, setThreadId, raizThread, respostas, carregandoThread,
    enviar, excluir, reagir, alternarFavorito, criarCanal, abrirDM, garantirMembro, marcarLido, recarregar,
  }
}

/**
 * Total de mensagens não lidas, para o contador do Chat na navegação do VertaTask.
 * Consulta leve (RPC chat_unread_counts) a cada 45 s e sempre que `atualizar` muda.
 */
export function useChatNaoLidas(userId, atualizar) {
  const [total, setTotal] = useState(0)
  useEffect(() => {
    if (!supabase || !userId) return undefined
    let vivo = true
    const ler = async () => {
      const { data } = await supabase.rpc('chat_unread_counts')
      if (vivo) setTotal((data || []).reduce((a, u) => a + Number(u.unread || 0), 0))
    }
    ler()
    const t = setInterval(ler, 45000)
    return () => { vivo = false; clearInterval(t) }
  }, [userId, atualizar])
  return total
}
