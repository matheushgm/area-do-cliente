// Chat da Área do Cliente no modelo do ClickUp Chat: coluna de canais
// (favoritos / canais / DMs, filtros Não lida · DMs · Canais), conversa com
// separadores de dia, menções, reações e threads num painel lateral.
// Dados: src/hooks/useChat.js (tabelas chat_*; migrations 041/043/086/087).
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import AppSidebar from '../components/AppSidebar'
import Toast from '../components/UI/Toast'
import { useToast } from '../hooks/useToast'
import { useChat } from '../hooks/useChat'
import ChatSidebar from '../components/Chat/ChatSidebar'
import MessageList from '../components/Chat/MessageList'
import Composer from '../components/Chat/Composer'
import ThreadPanel from '../components/Chat/ThreadPanel'
import ChatAvatar, { AvatarStack } from '../components/Chat/ChatAvatar'
import { NovoCanalDialog, NovaDMDialog } from '../components/Chat/NovoDialogs'
import { Hash, Lock, Star, Menu, PanelLeft, Loader2, MessageSquare, ArrowLeft, Users, LogIn } from 'lucide-react'

export default function Chat() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, teamMembers, projects } = useApp()
  const { toast, showToast } = useToast()
  const chat = useChat({ user, teamMembers })

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [listaAberta, setListaAberta] = useState(true) // mobile: lista × conversa
  const [dialogo, setDialogo] = useState(null)        // 'canal' | 'dm'
  const [threadExpandida, setThreadExpandida] = useState(false)
  const [destaque, setDestaque] = useState(null)

  const canalAtivo = useMemo(() => chat.canais.find((c) => c.id === chat.canalAtivo) || null, [chat.canais, chat.canalAtivo])
  const raizThread = useMemo(() => chat.mensagens.find((m) => m.id === chat.threadId) || null, [chat.mensagens, chat.threadId])
  const membrosCanal = useMemo(() => teamMembers.filter((m) => canalAtivo?.member_ids?.includes(m.id)), [teamMembers, canalAtivo])
  const membrosParaMencao = canalAtivo?.type === 'dm' ? membrosCanal : teamMembers

  // ── URL: ?channel= (&thread= &msg=) ─────────────────────────────────────
  useEffect(() => {
    if (chat.carregando || chat.canais.length === 0) return
    const wanted = searchParams.get('channel')
    if (wanted && chat.canais.some((c) => c.id === wanted)) {
      if (chat.canalAtivo !== wanted) chat.setCanalAtivo(wanted)
    } else if (!chat.canalAtivo) {
      const fav = chat.canais.find((c) => c.favorito)
      const geral = chat.canais.find((c) => c.type === 'channel' && /^geral/i.test(c.nome || ''))
      const primeiro = fav || geral || chat.canais.find((c) => c.type === 'channel') || chat.canais[0]
      if (primeiro) selecionar(primeiro)
    }
    const thread = searchParams.get('thread')
    if (thread && thread !== chat.threadId) chat.setThreadId(thread)
    const msg = searchParams.get('msg')
    if (msg) setDestaque(msg)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.carregando, chat.canais.length, searchParams])

  const selecionar = useCallback((c) => {
    chat.setCanalAtivo(c.id)
    setListaAberta(false)
    setDestaque(null)
    setSearchParams({ channel: c.id }, { replace: true })
  }, [chat, setSearchParams])

  function abrirThread(msg) {
    chat.setThreadId(msg.id)
    setSearchParams({ channel: msg.channel_id, thread: msg.id }, { replace: true })
  }
  function fecharThread() {
    chat.setThreadId(null)
    setThreadExpandida(false)
    if (canalAtivo) setSearchParams({ channel: canalAtivo.id }, { replace: true })
  }

  // Esc fecha thread; foco em texto não interfere
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && chat.threadId && !dialogo) fecharThread() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.threadId, dialogo, canalAtivo?.id])

  // Marca como lido ao voltar para a aba
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible' && chat.canalAtivo) chat.marcarLido(chat.canalAtivo) }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [chat])

  async function enviarNoCanal(texto) {
    const r = await chat.enviar({ canalId: canalAtivo.id, texto })
    if (r?.error) { showToast('Falha ao enviar: ' + r.error, 'error'); return false }
    return true
  }
  async function enviarNaThread(texto, tambem) {
    const r = await chat.enviar({ canalId: canalAtivo.id, texto, parentId: raizThread.id, tambemNoCanal: tambem })
    if (r?.error) { showToast('Falha ao enviar: ' + r.error, 'error'); return false }
    return true
  }

  async function criarCanal(dados) {
    const r = await chat.criarCanal(dados)
    if (r?.error) { showToast(r.error, 'error'); return }
    setDialogo(null)
    showToast('Canal criado')
    chat.setCanalAtivo(r.data.id)
    setSearchParams({ channel: r.data.id }, { replace: true })
  }
  async function abrirDM(pessoa) {
    const r = await chat.abrirDM(pessoa)
    if (r?.error) { showToast(r.error, 'error'); return }
    setDialogo(null)
    chat.setCanalAtivo(r.data.id)
    setListaAberta(false)
    setSearchParams({ channel: r.data.id }, { replace: true })
  }

  const projetosOrdenados = useMemo(() => [...(projects || [])].sort((a, b) => (a.company_name || a.companyName || '').localeCompare(b.company_name || b.companyName || '', 'pt-BR')), [projects])
  const threadAberta = !!(chat.threadId && raizThread)

  return (
    <div className="min-h-screen flex bg-gradient-dark">
      <AppSidebar filter="chat" setFilter={() => navigate('/')} counts={{}} activeAccounts={[]} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="ln flex-1 min-w-0 flex h-screen bg-ln-bg text-ln-t1">
        {/* Coluna de canais */}
        <aside className={`${listaAberta ? 'flex' : 'hidden'} md:flex w-full md:w-[260px] shrink-0 flex-col border-r border-ln-border bg-ln-panel/60 min-h-0`}>
          <div className="lg:hidden h-11 px-2 flex items-center border-b border-ln-border">
            <button onClick={() => setSidebarOpen(true)} aria-label="Abrir menu de navegação" className="ln-iconbtn"><Menu className="w-4 h-4" /></button>
            <span className="ml-1 text-[13px] font-semibold">Área do Cliente</span>
          </div>
          {chat.carregando ? (
            <div className="flex-1 flex items-center justify-center text-ln-t4"><Loader2 className="w-4 h-4 animate-spin" /></div>
          ) : (
            <ChatSidebar
              canais={chat.canais}
              canalAtivoId={chat.canalAtivo}
              onSelecionar={selecionar}
              onNovoCanal={() => setDialogo('canal')}
              onNovaDM={() => setDialogo('dm')}
            />
          )}
        </aside>

        {/* Conversa */}
        <section className={`${listaAberta ? 'hidden' : 'flex'} md:flex flex-1 min-w-0 flex-col min-h-0 ${threadAberta && threadExpandida ? 'md:hidden' : ''}`}>
          {!canalAtivo ? (
            <div className="flex-1 flex items-center justify-center text-ln-t4">
              {chat.carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <div className="text-center">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-[13px]">Selecione um canal ou conversa</p>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Cabeçalho do canal */}
              <header className="h-11 px-3 flex items-center gap-1.5 border-b border-ln-border shrink-0">
                <button onClick={() => setListaAberta(true)} className="ln-iconbtn md:hidden" aria-label="Voltar para a lista"><ArrowLeft className="w-4 h-4" /></button>
                <button onClick={() => setSidebarOpen(true)} aria-label="Abrir menu de navegação" className="ln-iconbtn hidden md:inline-flex lg:hidden"><PanelLeft className="w-4 h-4" /></button>
                {canalAtivo.type === 'dm'
                  ? <ChatAvatar pessoa={canalAtivo.dmCom} nome={canalAtivo.nome} size={20} />
                  : canalAtivo.visibility === 'private' ? <Lock className="w-4 h-4 text-ln-t3" /> : <Hash className="w-4 h-4 text-ln-t3" />}
                <h1 className="text-[14px] font-semibold text-ln-t1 truncate">{canalAtivo.nome}</h1>
                {canalAtivo.type === 'channel' && (
                  <button onClick={() => chat.alternarFavorito(canalAtivo)} className={`ln-iconbtn !w-6 !h-6 ${canalAtivo.favorito ? '!text-ln-yellow' : ''}`} title={canalAtivo.favorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'} aria-label="Favoritar">
                    <Star className="w-3.5 h-3.5" fill={canalAtivo.favorito ? 'currentColor' : 'none'} />
                  </button>
                )}
                {canalAtivo.project_id && (
                  <button onClick={() => navigate(`/project/${canalAtivo.project_id}`)} className="ln-pill !h-6 ml-1 hidden sm:inline-flex" title="Abrir o cliente">Cliente</button>
                )}
                <div className="flex-1" />
                {canalAtivo.type === 'channel' && (
                  <div className="inline-flex items-center gap-1.5 text-ln-t3" title={membrosCanal.map((m) => m.name).join(', ')}>
                    <AvatarStack ids={canalAtivo.member_ids} membrosMap={chat.membrosMap} size={20} max={3} />
                    <span className="text-[12px] tabular inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" />{canalAtivo.member_ids.length}</span>
                  </div>
                )}
              </header>

              {/* Aba "Canal" como no ClickUp */}
              <div className="h-9 px-4 flex items-end gap-4 border-b border-ln-border shrink-0">
                <span className="h-full inline-flex items-center text-[12px] font-medium text-ln-t1 border-b-2 border-ln-t1">{canalAtivo.type === 'dm' ? 'Conversa' : 'Canal'}</span>
              </div>

              {chat.carregandoMsgs ? (
                <div className="flex-1 flex items-center justify-center text-ln-t4"><Loader2 className="w-4 h-4 animate-spin" /></div>
              ) : (
                <MessageList
                  canal={canalAtivo}
                  mensagens={chat.mensagens}
                  respondentes={chat.respondentes}
                  meuId={user.id}
                  membros={teamMembers}
                  membrosMap={chat.membrosMap}
                  onReagir={chat.reagir}
                  onResponder={abrirThread}
                  onExcluir={chat.excluir}
                  onAbrirThread={abrirThread}
                  mensagemDestaque={destaque}
                />
              )}

              <div className="px-4 pb-4 pt-1 shrink-0">
                {!canalAtivo.souMembro && canalAtivo.type === 'channel' && (
                  <div className="mb-2 flex items-center justify-between gap-3 h-9 px-3 rounded-lg bg-ln-ink/[0.03] border border-ln-ink/[0.06] text-[12px] text-ln-t3">
                    <span>Você está vendo <b className="text-ln-t1">#{canalAtivo.nome}</b> sem participar. Entre para receber notificações.</span>
                    <button onClick={() => chat.garantirMembro(canalAtivo.id)} className="ln-primary !h-6"><LogIn className="w-3 h-3" /> Entrar no canal</button>
                  </div>
                )}
                <Composer
                  placeholder={canalAtivo.type === 'dm' ? `Escreva para ${canalAtivo.nome}` : `Escreva para #${canalAtivo.nome}, use @ para mencionar`}
                  membros={membrosParaMencao}
                  meuId={user.id}
                  onEnviar={enviarNoCanal}
                />
              </div>
            </>
          )}
        </section>

        {/* Thread */}
        {threadAberta && (
          <aside className={`fixed inset-0 z-40 md:static md:z-auto md:border-l md:border-ln-border ${threadExpandida ? 'md:flex-1' : 'md:w-[400px] lg:w-[440px]'} shrink-0 min-h-0 flex`}>
            <div className="w-full h-full">
              <ThreadPanel
                raiz={raizThread}
                respostas={chat.respostas}
                carregando={chat.carregandoThread}
                canal={canalAtivo}
                meuId={user.id}
                membros={teamMembers}
                membrosMap={chat.membrosMap}
                onFechar={fecharThread}
                onEnviar={enviarNaThread}
                onReagir={chat.reagir}
                onExcluir={chat.excluir}
                expandido={threadExpandida}
                onExpandir={() => setThreadExpandida((v) => !v)}
              />
            </div>
          </aside>
        )}
      </div>

      {dialogo === 'canal' && (
        <NovoCanalDialog membros={teamMembers} meuId={user.id} projetos={projetosOrdenados} onFechar={() => setDialogo(null)} onCriar={criarCanal} />
      )}
      {dialogo === 'dm' && (
        <NovaDMDialog membros={teamMembers} meuId={user.id} onFechar={() => setDialogo(null)} onEscolher={abrirDM} />
      )}
      <Toast toast={toast} />
    </div>
  )
}
