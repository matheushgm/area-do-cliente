import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import AppSidebar from '../components/AppSidebar'
import Modal from '../components/UI/Modal'
import Toast from '../components/UI/Toast'
import { useToast } from '../hooks/useToast'
import {
  MessageSquare, Hash, Plus, Send, Menu, Zap, X, Search,
  Loader2, ArrowLeft,
} from 'lucide-react'

// ─── Utils ──────────────────────────────────────────────────────────────────
function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date(); today.setHours(0,0,0,0)
  const yest  = new Date(today.getTime() - 86400000)
  const dDay  = new Date(d); dDay.setHours(0,0,0,0)
  if (dDay.getTime() === today.getTime()) return 'Hoje'
  if (dDay.getTime() === yest.getTime())  return 'Ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: dDay.getFullYear() !== today.getFullYear() ? 'numeric' : undefined })
}

function initialsOf(name = '') {
  return name.trim().split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '??'
}

// ─── Render mensagem com @mentions destacadas ───────────────────────────────
function renderMessageContent(content, mentionedIds, memberMap, currentUserId) {
  if (!content) return null
  // Se nao houver mencionados, render direto
  if (!Array.isArray(mentionedIds) || mentionedIds.length === 0) return content
  // Constroi mapa nome → membro pra pessoas mencionadas
  const tokens = mentionedIds
    .map((id) => memberMap.get(id))
    .filter(Boolean)
    .map((m) => ({ id: m.id, name: m.name, slug: m.name.replace(/\s+/g, '_') }))
  if (tokens.length === 0) return content
  // Regex que captura @nome ou @nome_sobrenome (palavras separadas por _ ou .)
  const pattern = new RegExp('@(' + tokens.map((t) => t.slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'g')
  const parts = []
  let lastIndex = 0
  let match
  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) parts.push(content.slice(lastIndex, match.index))
    const token = tokens.find((t) => t.slug === match[1])
    const isMe = token?.id === currentUserId
    parts.push(
      <span
        key={match.index}
        className={`px-1 rounded font-semibold ${isMe ? 'bg-rl-gold/20 text-rl-gold' : 'bg-rl-purple/20 text-rl-purple'}`}
      >
        @{token?.name || match[1]}
      </span>
    )
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < content.length) parts.push(content.slice(lastIndex))
  return parts
}

// ─── Avatar ─────────────────────────────────────────────────────────────────
function Avatar({ name, size = 'md' }) {
  const cls = size === 'sm' ? 'w-6 h-6 text-[9px]' : size === 'lg' ? 'w-9 h-9 text-xs' : 'w-7 h-7 text-[10px]'
  return (
    <div className={`${cls} rounded-full bg-gradient-rl flex items-center justify-center font-bold text-white shrink-0`}>
      {initialsOf(name)}
    </div>
  )
}

// ─── New channel modal ──────────────────────────────────────────────────────
function NewChannelModal({ teamMembers, currentUserId, onClose, onCreate }) {
  const [name, setName] = useState('')
  const [selected, setSelected] = useState(new Set([currentUserId]))
  const [submitting, setSubmitting] = useState(false)

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    if (!cleanName) return
    setSubmitting(true)
    await onCreate({ name: cleanName, memberIds: Array.from(selected) })
    setSubmitting(false)
  }

  return (
    <Modal onClose={onClose} maxWidth="md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-rl-text">Novo canal</h2>
        <button onClick={onClose} className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition">
          <X className="w-4 h-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-rl-muted mb-1.5 uppercase tracking-wider">Nome</label>
          <div className="relative">
            <Hash className="w-4 h-4 text-rl-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              placeholder="ex: marketing"
              className="w-full bg-rl-surface border border-rl-border rounded-lg pl-9 pr-3 py-2 text-sm text-rl-text focus:outline-none focus:border-rl-purple"
            />
          </div>
          <p className="text-[10px] text-rl-muted mt-1">Letras minúsculas, números e hífens.</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-rl-muted mb-1.5 uppercase tracking-wider">Membros</label>
          <div className="max-h-60 overflow-y-auto border border-rl-border rounded-lg divide-y divide-rl-border/50">
            {teamMembers.map((m) => (
              <label key={m.id} className="flex items-center gap-2 px-3 py-2 hover:bg-rl-surface cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(m.id)}
                  onChange={() => toggle(m.id)}
                  disabled={m.id === currentUserId}
                  className="w-4 h-4 accent-rl-purple"
                />
                <Avatar name={m.name} size="sm" />
                <span className="text-sm text-rl-text">{m.name}</span>
                {m.id === currentUserId && <span className="text-[10px] text-rl-muted ml-auto">você</span>}
              </label>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-rl-border">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-rl-muted hover:text-rl-text">Cancelar</button>
          <button type="submit" disabled={submitting || !name.trim()} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
            {submitting ? 'Criando...' : 'Criar canal'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── New DM modal ───────────────────────────────────────────────────────────
function NewDMModal({ teamMembers, currentUserId, onClose, onSelect }) {
  const [search, setSearch] = useState('')
  const filtered = teamMembers.filter((m) =>
    m.id !== currentUserId &&
    m.name.toLowerCase().includes(search.toLowerCase())
  )
  return (
    <Modal onClose={onClose} maxWidth="md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-rl-text">Nova conversa</h2>
        <button onClick={onClose} className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="relative mb-3">
        <Search className="w-4 h-4 text-rl-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          autoFocus
          type="text"
          placeholder="Buscar pessoa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-rl-surface border border-rl-border rounded-lg pl-9 pr-3 py-2 text-sm text-rl-text focus:outline-none focus:border-rl-purple"
        />
      </div>
      <ul className="max-h-72 overflow-y-auto border border-rl-border rounded-lg divide-y divide-rl-border/50">
        {filtered.length === 0 ? (
          <li className="px-3 py-4 text-xs text-rl-muted text-center">Nenhum usuário encontrado</li>
        ) : filtered.map((m) => (
          <li key={m.id}>
            <button
              onClick={() => onSelect(m)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-rl-surface text-left transition"
            >
              <Avatar name={m.name} size="sm" />
              <span className="text-sm text-rl-text">{m.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

// ─── Channel list ───────────────────────────────────────────────────────────
function ChannelList({ channels, dms, activeChannelId, onSelect, onNewChannel, onNewDM, currentUserId, memberMap }) {
  return (
    <div className="flex flex-col h-full">
      {/* Channels */}
      <div className="px-3 py-2">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[10px] font-semibold text-rl-muted uppercase tracking-wider">Canais</h3>
          <button onClick={onNewChannel} title="Novo canal" className="p-1 rounded text-rl-muted hover:text-rl-text hover:bg-rl-surface transition">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <ul className="space-y-0.5">
          {channels.length === 0 && (
            <li className="text-[11px] text-rl-muted px-2 py-1">Nenhum canal</li>
          )}
          {channels.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => onSelect(c)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition ${
                  activeChannelId === c.id
                    ? 'bg-rl-purple/20 text-rl-purple'
                    : 'text-rl-text hover:bg-rl-surface'
                }`}
              >
                <Hash className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{c.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-rl-border/50 mx-2" />

      {/* DMs */}
      <div className="px-3 py-2 flex-1 min-h-0">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[10px] font-semibold text-rl-muted uppercase tracking-wider">Mensagens diretas</h3>
          <button onClick={onNewDM} title="Nova conversa" className="p-1 rounded text-rl-muted hover:text-rl-text hover:bg-rl-surface transition">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <ul className="space-y-0.5">
          {dms.length === 0 && (
            <li className="text-[11px] text-rl-muted px-2 py-1">Sem conversas</li>
          )}
          {dms.map((dm) => {
            const otherId   = (dm.member_ids || []).find((id) => id !== currentUserId)
            const other     = otherId ? memberMap.get(otherId) : null
            const otherName = other?.name || 'Conversa'
            return (
              <li key={dm.id}>
                <button
                  onClick={() => onSelect(dm)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition ${
                    activeChannelId === dm.id
                      ? 'bg-rl-purple/20 text-rl-purple'
                      : 'text-rl-text hover:bg-rl-surface'
                  }`}
                >
                  <Avatar name={otherName} size="sm" />
                  <span className="truncate">{otherName}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

// ─── Message list ───────────────────────────────────────────────────────────
function MessageList({ messages, memberMap, currentUserId }) {
  const endRef = useRef(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  // Agrupar por dia
  const groups = useMemo(() => {
    const out = []
    let lastDay = null
    for (const m of messages) {
      const day = new Date(m.created_at); day.setHours(0,0,0,0)
      const key = day.toISOString()
      if (key !== lastDay) {
        out.push({ type: 'date', key: 'date-' + key, label: fmtDate(m.created_at) })
        lastDay = key
      }
      out.push({ type: 'msg', key: m.id, msg: m })
    }
    return out
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-rl-muted">
        <div className="text-center">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Nenhuma mensagem ainda. Envie a primeira!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
      {groups.map((g) => {
        if (g.type === 'date') {
          return (
            <div key={g.key} className="flex items-center gap-2 my-3">
              <div className="flex-1 h-px bg-rl-border" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-rl-muted">{g.label}</span>
              <div className="flex-1 h-px bg-rl-border" />
            </div>
          )
        }
        const m = g.msg
        const author = memberMap.get(m.user_id)
        const isMine = m.user_id === currentUserId
        return (
          <div key={g.key} className="group flex items-start gap-2.5 px-2 py-1 rounded-lg hover:bg-rl-surface/40">
            <Avatar name={author?.name || '?'} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className={`text-sm font-semibold ${isMine ? 'text-rl-purple' : 'text-rl-text'}`}>
                  {author?.name || 'Usuário'}
                </span>
                <span className="text-[10px] text-rl-muted">{fmtTime(m.created_at)}</span>
                {m.edited_at && <span className="text-[10px] text-rl-muted">(editada)</span>}
              </div>
              <p className="text-sm text-rl-text whitespace-pre-wrap break-words">
                {renderMessageContent(m.content, m.mentioned_user_ids, memberMap, currentUserId)}
              </p>
            </div>
          </div>
        )
      })}
      <div ref={endRef} />
    </div>
  )
}

// ─── Página principal ──────────────────────────────────────────────────────
export default function Chat() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, teamMembers } = useApp()
  const { toast, showToast } = useToast()

  const [sidebarOpen, setSidebarOpen]   = useState(false)
  const [channels,    setChannels]      = useState([])
  const [loading,     setLoading]       = useState(true)
  const [activeId,    setActiveId]      = useState(null)
  const [messages,    setMessages]      = useState([])
  const [loadingMsgs, setLoadingMsgs]   = useState(false)
  const [draft,       setDraft]         = useState('')
  const [mentionState, setMentionState] = useState(null) // { query, start, end } | null
  const draftRef = useRef(null)
  const [showNewCh,   setShowNewCh]     = useState(false)
  const [showNewDM,   setShowNewDM]     = useState(false)
  const [refreshTick, setRefreshTick]   = useState(0)
  const refreshChannels = () => setRefreshTick((t) => t + 1)

  const memberMap = useMemo(() => {
    const m = new Map()
    teamMembers.forEach((tm) => m.set(tm.id, tm))
    return m
  }, [teamMembers])

  // Carrega canais do usuário
  useEffect(() => {
    if (!supabase || !user?.id) return
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data: members, error: e1 } = await supabase
        .from('chat_channel_members')
        .select('channel_id')
        .eq('user_id', user.id)
      if (cancelled) return
      if (e1) { console.error(e1); setLoading(false); return }
      const ids = (members || []).map((m) => m.channel_id)
      if (ids.length === 0) { setChannels([]); setLoading(false); return }
      const { data: chs, error: e2 } = await supabase
        .from('chat_channels')
        .select('*')
        .in('id', ids)
        .order('created_at')
      if (cancelled) return
      if (e2) { console.error(e2); setLoading(false); return }
      const { data: allMembers, error: e3 } = await supabase
        .from('chat_channel_members')
        .select('channel_id, user_id')
        .in('channel_id', ids)
      if (cancelled) return
      if (e3) console.error(e3)
      const memMap = new Map()
      ;(allMembers || []).forEach((mm) => {
        if (!memMap.has(mm.channel_id)) memMap.set(mm.channel_id, [])
        memMap.get(mm.channel_id).push(mm.user_id)
      })
      setChannels((chs || []).map((c) => ({ ...c, member_ids: memMap.get(c.id) || [] })))
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [user?.id, refreshTick])

  // Selecionar canal: ?channel=<id> tem prioridade, depois #geral, depois primeiro
  useEffect(() => {
    if (channels.length === 0) return
    const wanted = searchParams.get('channel')
    if (wanted && channels.some((c) => c.id === wanted)) {
      setActiveId(wanted)
      return
    }
    if (!activeId) {
      const geral = channels.find((c) => c.type === 'channel' && c.name === 'geral')
      setActiveId((geral || channels[0]).id)
    }
  }, [channels, activeId, searchParams])

  // Carrega mensagens do canal ativo
  useEffect(() => {
    if (!activeId || !supabase) return
    setLoadingMsgs(true)
    supabase
      .from('chat_messages')
      .select('*')
      .eq('channel_id', activeId)
      .order('created_at')
      .limit(200)
      .then(({ data, error }) => {
        if (error) { console.error(error); setLoadingMsgs(false); return }
        setMessages(data || [])
        setLoadingMsgs(false)
      })
  }, [activeId])

  // Realtime: novas mensagens do canal ativo
  useEffect(() => {
    if (!supabase || !activeId) return
    const channel = supabase
      .channel(`chat-${activeId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${activeId}` },
        ({ new: row }) => {
          setMessages((prev) => prev.some((m) => m.id === row.id) ? prev : [...prev, row])
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeId])

  // Realtime: novos canais (alguém te adicionou)
  useEffect(() => {
    if (!supabase || !user?.id) return
    const channel = supabase
      .channel('chat-membership')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_channel_members', filter: `user_id=eq.${user.id}` },
        () => { refreshChannels() },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  // Extrai IDs de membros mencionados a partir do texto (@nome_sobrenome)
  function extractMentions(text, candidates) {
    const ids = []
    const matches = text.matchAll(/@([\w.]+)/g)
    for (const m of matches) {
      const slug = m[1]
      const found = candidates.find((c) => c.name.replace(/\s+/g, '_') === slug)
      if (found && !ids.includes(found.id)) ids.push(found.id)
    }
    return ids
  }

  async function handleSend(e) {
    e?.preventDefault()
    const text = draft.trim()
    if (!text || !activeId || !supabase) return
    const channelMembers = teamMembers.filter((m) => activeChannel?.member_ids?.includes(m.id))
    const mentioned = extractMentions(text, channelMembers)
    const optimistic = {
      id: crypto.randomUUID(),
      channel_id: activeId,
      user_id: user.id,
      content: text,
      mentioned_user_ids: mentioned,
      created_at: new Date().toISOString(),
      _optimistic: true,
    }
    setMessages((prev) => [...prev, optimistic])
    setDraft('')
    setMentionState(null)
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({ channel_id: activeId, user_id: user.id, content: text, mentioned_user_ids: mentioned })
      .select()
      .single()
    if (error) {
      console.error(error)
      showToast('Falha ao enviar mensagem', 'error')
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      return
    }
    setMessages((prev) => prev.map((m) => m.id === optimistic.id ? data : m))
  }

  async function handleCreateChannel({ name, memberIds }) {
    const { data: ch, error } = await supabase
      .from('chat_channels')
      .insert({ name, type: 'channel', created_by: user.id })
      .select()
      .single()
    if (error) { showToast(error.message, 'error'); return }
    const ids = Array.from(new Set([...memberIds, user.id]))
    const rows = ids.map((uid) => ({ channel_id: ch.id, user_id: uid }))
    const { error: e2 } = await supabase.from('chat_channel_members').insert(rows)
    if (e2) { showToast(e2.message, 'error'); return }
    setShowNewCh(false)
    showToast('Canal criado')
    refreshChannels()
    setActiveId(ch.id)
  }

  async function handleStartDM(other) {
    // Busca DM existente entre os dois usuários
    const existing = channels.find((c) => c.type === 'dm' && c.member_ids?.length === 2 && c.member_ids.includes(user.id) && c.member_ids.includes(other.id))
    if (existing) {
      setShowNewDM(false)
      setActiveId(existing.id)
      return
    }
    const { data: ch, error } = await supabase
      .from('chat_channels')
      .insert({ type: 'dm', created_by: user.id })
      .select()
      .single()
    if (error) { showToast(error.message, 'error'); return }
    const { error: e2 } = await supabase.from('chat_channel_members').insert([
      { channel_id: ch.id, user_id: user.id },
      { channel_id: ch.id, user_id: other.id },
    ])
    if (e2) { showToast(e2.message, 'error'); return }
    setShowNewDM(false)
    refreshChannels()
    setActiveId(ch.id)
  }

  const activeChannel = channels.find((c) => c.id === activeId)
  const channelsList  = channels.filter((c) => c.type === 'channel').sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  const dmsList       = channels.filter((c) => c.type === 'dm')
  const dmOther       = activeChannel?.type === 'dm'
    ? memberMap.get((activeChannel.member_ids || []).find((id) => id !== user.id))
    : null

  // Mobile: alterna entre lista e thread
  const [mobileView, setMobileView] = useState('list') // 'list' | 'thread'
  useEffect(() => { if (activeId) setMobileView('thread') }, [activeId])

  return (
    <div className="min-h-screen flex bg-gradient-dark">
      <AppSidebar
        filter="chat"
        setFilter={() => navigate('/')}
        counts={{}}
        activeAccounts={[]}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-rl-border bg-rl-bg/90 backdrop-blur-xl">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu de navegação"
            className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-rl flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-rl-text text-sm">Chat</span>
          </div>
        </div>

        <div className="flex-1 flex h-[calc(100vh-3.5rem)] lg:h-screen min-h-0">
          {/* Channel list */}
          <aside className={`${mobileView === 'list' ? 'flex' : 'hidden'} md:flex w-full md:w-64 shrink-0 flex-col border-r border-rl-border bg-rl-surface/40`}>
            <div className="px-4 py-3 border-b border-rl-border flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-rl-purple" />
              <h2 className="text-sm font-bold text-rl-text">Chat</h2>
            </div>
            {loading ? (
              <div className="flex-1 flex items-center justify-center text-rl-muted">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            ) : (
              <ChannelList
                channels={channelsList}
                dms={dmsList}
                activeChannelId={activeId}
                onSelect={(c) => setActiveId(c.id)}
                onNewChannel={() => setShowNewCh(true)}
                onNewDM={() => setShowNewDM(true)}
                currentUserId={user.id}
                memberMap={memberMap}
              />
            )}
          </aside>

          {/* Thread */}
          <section className={`${mobileView === 'thread' ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0`}>
            {!activeChannel ? (
              <div className="flex-1 flex items-center justify-center text-rl-muted">
                <div className="text-center">
                  <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Selecione um canal ou conversa</p>
                </div>
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div className="px-4 py-3 border-b border-rl-border flex items-center gap-2 sticky top-0 bg-rl-bg/95 backdrop-blur z-10">
                  <button
                    onClick={() => setMobileView('list')}
                    className="md:hidden p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition"
                    aria-label="Voltar"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  {activeChannel.type === 'channel' ? (
                    <>
                      <Hash className="w-4 h-4 text-rl-muted" />
                      <h3 className="text-sm font-bold text-rl-text">{activeChannel.name}</h3>
                      <span className="text-[10px] text-rl-muted ml-2">
                        {(activeChannel.member_ids || []).length} {(activeChannel.member_ids || []).length === 1 ? 'membro' : 'membros'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Avatar name={dmOther?.name || '?'} size="sm" />
                      <h3 className="text-sm font-bold text-rl-text">{dmOther?.name || 'Conversa'}</h3>
                    </>
                  )}
                </div>

                {/* Messages */}
                {loadingMsgs ? (
                  <div className="flex-1 flex items-center justify-center text-rl-muted">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                ) : (
                  <MessageList messages={messages} memberMap={memberMap} currentUserId={user.id} />
                )}

                {/* Input */}
                <form onSubmit={handleSend} className="px-3 py-3 border-t border-rl-border bg-rl-bg/95 relative">
                  {(() => {
                    const channelMembers = teamMembers.filter((m) => activeChannel?.member_ids?.includes(m.id))
                    const matches = mentionState
                      ? channelMembers.filter((m) => m.id !== user.id && m.name.toLowerCase().includes(mentionState.query.toLowerCase()))
                      : []
                    function applyMention(member) {
                      const before = draft.slice(0, mentionState.start)
                      const after  = draft.slice(mentionState.end)
                      const slug   = member.name.replace(/\s+/g, '_')
                      const inserted = `@${slug} `
                      const newText = before + inserted + after
                      setDraft(newText)
                      setMentionState(null)
                      requestAnimationFrame(() => {
                        const el = draftRef.current
                        if (el) {
                          const pos = (before + inserted).length
                          el.focus()
                          el.setSelectionRange(pos, pos)
                        }
                      })
                    }
                    return (
                      <>
                        {mentionState && matches.length > 0 && (
                          <div className="absolute bottom-full left-3 right-14 mb-1 max-h-48 overflow-y-auto glass-card border border-rl-border rounded-lg shadow-2xl z-20">
                            {matches.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => applyMention(m)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-rl-surface transition"
                              >
                                <Avatar name={m.name} size="sm" />
                                <span className="text-sm text-rl-text">{m.name}</span>
                                <span className="ml-auto text-[10px] text-rl-muted">@{m.name.split(' ')[0].toLowerCase()}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="flex items-end gap-2">
                          <textarea
                            ref={draftRef}
                            value={draft}
                            onChange={(e) => {
                              const value = e.target.value
                              const cursor = e.target.selectionStart
                              setDraft(value)
                              // Detecta @parcial ANTES do cursor
                              const before = value.slice(0, cursor)
                              const m = before.match(/(?:^|\s)@([\w.]*)$/)
                              if (m) {
                                const start = cursor - m[1].length - 1 // posição do '@'
                                setMentionState({ query: m[1], start, end: cursor })
                              } else {
                                setMentionState(null)
                              }
                            }}
                            onKeyDown={(e) => {
                              if (mentionState) {
                                if (e.key === 'Escape') { e.preventDefault(); setMentionState(null); return }
                                if (e.key === 'Enter' && !e.shiftKey && matches.length > 0) {
                                  e.preventDefault()
                                  applyMention(matches[0])
                                  return
                                }
                              }
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handleSend()
                              }
                            }}
                            placeholder={activeChannel.type === 'channel'
                              ? `Mensagem em #${activeChannel.name} — use @ para mencionar`
                              : `Mensagem para ${dmOther?.name || ''}`
                            }
                            rows={1}
                            className="flex-1 bg-rl-surface border border-rl-border rounded-xl px-3 py-2 text-sm text-rl-text placeholder:text-rl-muted focus:outline-none focus:border-rl-purple resize-none max-h-32"
                          />
                          <button
                            type="submit"
                            disabled={!draft.trim()}
                            className="btn-primary p-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Enviar"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    )
                  })()}
                </form>
              </>
            )}
          </section>
        </div>
      </div>

      {showNewCh && (
        <NewChannelModal
          teamMembers={teamMembers}
          currentUserId={user.id}
          onClose={() => setShowNewCh(false)}
          onCreate={handleCreateChannel}
        />
      )}
      {showNewDM && (
        <NewDMModal
          teamMembers={teamMembers}
          currentUserId={user.id}
          onClose={() => setShowNewDM(false)}
          onSelect={handleStartDM}
        />
      )}

      <Toast toast={toast} />
    </div>
  )
}
