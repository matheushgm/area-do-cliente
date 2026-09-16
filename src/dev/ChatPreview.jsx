// Preview de DESENVOLVIMENTO do Chat, sem login. Rota /dev/chat (só em DEV).
// Injeta um AppContext fake e um hook de dados que roda em memória sobre
// src/dev/fixtures/chat.json (export do Supabase, gitignored).
import { useState, useEffect, useMemo, useCallback } from 'react'
import { AppContext } from '../context/AppContext'
import Chat from '../pages/Chat'
import { extrairMencoes } from '../lib/chat'

let FX = null

function useChatFixture({ user, teamMembers }) {
  const userId = user?.id
  const [canaisBase] = useState(FX.canais)
  const [membrosLista, setMembrosLista] = useState(FX.membros)
  const [todas, setTodas] = useState(FX.mensagens)
  const [lidos, setLidos] = useState({})
  const [canalAtivo, setCanalAtivo] = useState(null)
  const [threadId, setThreadId] = useState(null)
  const membrosMap = useMemo(() => new Map(teamMembers.map((m) => [m.id, m])), [teamMembers])

  const canais = useMemo(() => canaisBase.map((c) => {
    const ms = membrosLista.filter((m) => m.channel_id === c.id)
    const minha = ms.find((m) => m.user_id === userId)
    const outros = ms.filter((m) => m.user_id !== userId).map((m) => m.user_id)
    const dmCom = c.type === 'dm' && outros[0] ? membrosMap.get(outros[0]) : null
    const msgs = todas.filter((m) => m.channel_id === c.id)
    const lidoEm = lidos[c.id] || (minha?.last_read_at ? new Date(minha.last_read_at).getTime() - 3 * 86400000 : 0)
    const naoLidas = minha ? msgs.filter((m) => m.user_id !== userId && new Date(m.created_at).getTime() > lidoEm) : []
    return {
      ...c, nome: c.type === 'dm' ? (dmCom?.name || 'Conversa') : c.name, member_ids: ms.map((m) => m.user_id),
      souMembro: !!minha, favorito: !!minha?.favorite, naoLidas: naoLidas.length,
      mencoes: naoLidas.filter((m) => (m.mentioned_user_ids || []).includes(userId)).length, dmCom,
      last_message_at: msgs.at(-1)?.created_at || c.created_at,
    }
  }), [canaisBase, membrosLista, todas, lidos, userId, membrosMap])

  const mensagens = useMemo(() => todas.filter((m) => m.channel_id === canalAtivo && !m.parent_id), [todas, canalAtivo])
  const respondentes = useMemo(() => {
    const r = new Map()
    for (const m of todas) if (m.parent_id && m.channel_id === canalAtivo) { const l = r.get(m.parent_id) || []; if (!l.includes(m.user_id)) l.push(m.user_id); r.set(m.parent_id, l) }
    return r
  }, [todas, canalAtivo])
  const respostas = useMemo(() => todas.filter((m) => m.parent_id === threadId), [todas, threadId])

  const marcarLido = useCallback((id) => setLidos((p) => ({ ...p, [id]: Date.now() })), [])
  const garantirMembro = useCallback(async (id) => setMembrosLista((p) => p.some((m) => m.channel_id === id && m.user_id === userId) ? p : [...p, { channel_id: id, user_id: userId, favorite: false, last_read_at: new Date().toISOString() }]), [userId])
  const enviar = useCallback(async ({ canalId, texto, parentId = null, tambemNoCanal }) => {
    await garantirMembro(canalId)
    const base = { channel_id: canalId, user_id: userId, content: texto, mentioned_user_ids: extrairMencoes(texto, teamMembers), created_at: new Date().toISOString(), reactions: {}, replies_count: 0 }
    const novas = [{ ...base, id: crypto.randomUUID(), parent_id: parentId }]
    if (parentId && tambemNoCanal) novas.push({ ...base, id: crypto.randomUUID(), parent_id: null })
    setTodas((p) => p.map((m) => parentId && m.id === parentId ? { ...m, replies_count: (m.replies_count || 0) + 1, last_reply_at: base.created_at } : m).concat(novas))
    return { data: novas }
  }, [garantirMembro, userId, teamMembers])
  const excluir = useCallback(async (msg) => setTodas((p) => p.filter((m) => m.id !== msg.id).map((m) => m.id === msg.parent_id ? { ...m, replies_count: Math.max(0, m.replies_count - 1) } : m)), [])
  const reagir = useCallback(async (msg, emoji) => setTodas((p) => p.map((m) => {
    if (m.id !== msg.id) return m
    const r = { ...(m.reactions || {}) }; const l = [...(r[emoji] || [])]; const i = l.indexOf(userId)
    if (i >= 0) l.splice(i, 1); else l.push(userId)
    if (l.length) r[emoji] = l; else delete r[emoji]
    return { ...m, reactions: r }
  })), [userId])
  const alternarFavorito = useCallback(async (c) => { await garantirMembro(c.id); setMembrosLista((p) => p.map((m) => m.channel_id === c.id && m.user_id === userId ? { ...m, favorite: !m.favorite } : m)) }, [garantirMembro, userId])
  const criarCanal = useCallback(async () => ({ error: 'Preview: criação desativada' }), [])
  const abrirDM = useCallback(async (outro) => {
    const ex = canais.find((c) => c.type === 'dm' && c.member_ids.includes(outro.id) && c.member_ids.includes(userId))
    return ex ? { data: ex } : { error: 'Preview: sem DM com essa pessoa' }
  }, [canais, userId])

  return {
    canais, carregando: false, membrosMap, canalAtivo, setCanalAtivo, mensagens, respondentes, carregandoMsgs: false,
    threadId, setThreadId, respostas, carregandoThread: false,
    enviar, excluir, reagir, alternarFavorito, criarCanal, abrirDM, garantirMembro, marcarLido, recarregar: () => {},
  }
}

export default function ChatPreview() {
  const [pronto, setPronto] = useState(false)
  const [erro, setErro] = useState(null)
  useEffect(() => {
    fetch('/src/dev/fixtures/chat.json').then((r) => { if (!r.ok) throw new Error(`fixture ${r.status}`); return r.json() })
      .then((d) => { FX = d; setPronto(true) })
      .catch((e) => setErro(`Sem fixture: ${e.message}.`))
  }, [])
  if (erro) return <div className="p-8 text-sm text-red-400">{erro}</div>
  if (!pronto) return <div className="p-8 text-sm text-rl-muted">Carregando fixture…</div>
  const teamMembers = FX.perfis
  const projects = FX.projetos.map((p) => ({ id: p.id, companyName: p.company_name, company_name: p.company_name }))
  const admin = teamMembers.find((m) => m.email === 'matheus@revenuelab.com.br') || teamMembers[0]
  const value = {
    user: { id: admin?.id, email: admin?.email, name: admin?.name || 'Dev', avatar: admin?.avatar || 'DV', role: 'admin' },
    login: async () => {}, logout: () => {}, loginWithGoogle: async () => {}, loadingAuth: false, authError: null,
    projects, squads: [], teamMembers, loadingProjects: false, isSupabaseReady: true,
    addProject: async () => {}, updateProject: async () => {}, deleteProject: async () => {},
    addSquad: async () => {}, updateSquad: async () => {}, deleteSquad: async () => {},
    tasks: [], loadingTasks: false, addTask: async () => {}, updateTask: async () => {}, deleteTask: async () => {},
  }
  return (
    <AppContext.Provider value={value}>
      <Chat chatHook={useChatFixture} />
    </AppContext.Provider>
  )
}
