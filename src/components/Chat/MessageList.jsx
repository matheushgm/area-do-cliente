import { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react'
import { MessageSquare, Reply, Smile, Trash2, ChevronDown, ChevronRight, Hash } from 'lucide-react'
import ChatAvatar, { AvatarStack } from './ChatAvatar'
import ChatMarkdown from './ChatMarkdown'
import { chaveDia, rotuloDia, hora, horaRelativa, ultimaResposta } from '../../lib/chat'

const REACOES_RAPIDAS = ['👍', '❤️', '😂']
const MAIS_REACOES = ['🙌', '🔥', '✅', '👀', '🎉', '😅', '🙏', '💪', '🚀', '😍', '🤔', '👏']
const JANELA_AGRUPAMENTO_MS = 5 * 60 * 1000

export function DateDivider({ label }) {
  return (
    <div className="relative flex items-center justify-center my-2 px-6">
      <div className="absolute inset-x-6 top-1/2 h-px bg-ln-border" />
      <span className="relative inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-ln-bg border border-ln-border text-[11px] font-semibold text-ln-t2">
        {label}<ChevronDown className="w-3 h-3 text-ln-t4" />
      </span>
    </div>
  )
}

function Reacoes({ msg, meuId, membrosMap, onReagir }) {
  const entradas = Object.entries(msg.reactions || {}).filter(([, u]) => u?.length)
  if (!entradas.length) return null
  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {entradas.map(([emoji, usuarios]) => {
        const meu = usuarios.includes(meuId)
        const nomes = usuarios.map((u) => membrosMap.get(u)?.name || 'Alguém').join(', ')
        return (
          <button
            key={emoji}
            onClick={() => onReagir(msg, emoji)}
            title={nomes}
            className={`inline-flex items-center gap-1 h-6 px-1.5 rounded-full text-[12px] border transition-colors ${meu ? 'bg-ln-accent/10 border-ln-accent/40 text-ln-t1' : 'bg-ln-ink/[0.03] border-ln-ink/10 text-ln-t2 hover:bg-ln-ink/[0.06]'}`}
          >
            <span>{emoji}</span><span className="font-medium tabular">{usuarios.length}</span>
          </button>
        )
      })}
    </div>
  )
}

function Toolbar({ msg, minha, onReagir, onResponder, onExcluir, podeResponder }) {
  const [mais, setMais] = useState(false)
  return (
    <div className="absolute -top-3.5 right-4 hidden group-hover:flex items-center gap-0.5 h-7 px-1 rounded-lg bg-ln-panel border border-ln-ink/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.08)] z-10">
      {REACOES_RAPIDAS.map((e) => (
        <button key={e} onClick={() => onReagir(msg, e)} className="w-6 h-6 rounded hover:bg-ln-ink/5 text-[14px]" title={`Reagir ${e}`}>{e}</button>
      ))}
      <div className="relative">
        <button onClick={() => setMais((v) => !v)} className="ln-iconbtn !w-6 !h-6 !rounded" title="Mais reações" aria-label="Mais reações"><Smile className="w-3.5 h-3.5" /></button>
        {mais && (
          <div className="absolute top-full right-0 mt-1 p-1 grid grid-cols-6 gap-0.5 bg-ln-panel border border-ln-ink/[0.08] rounded-lg z-20" style={{ boxShadow: 'var(--ln-shadow-panel)' }} onMouseLeave={() => setMais(false)}>
            {MAIS_REACOES.map((e) => <button key={e} onClick={() => { onReagir(msg, e); setMais(false) }} className="w-7 h-7 rounded hover:bg-ln-ink/5 text-[15px]">{e}</button>)}
          </div>
        )}
      </div>
      {podeResponder && (
        <>
          <span className="w-px h-4 bg-ln-ink/10 mx-0.5" />
          <button onClick={() => onResponder(msg)} className="ln-iconbtn !w-6 !h-6 !rounded" title="Responder na thread" aria-label="Responder na thread"><Reply className="w-3.5 h-3.5" /></button>
        </>
      )}
      {minha && (
        <button onClick={() => { if (confirm('Excluir esta mensagem?')) onExcluir(msg) }} className="ln-iconbtn !w-6 !h-6 !rounded hover:!text-ln-red" title="Excluir" aria-label="Excluir mensagem"><Trash2 className="w-3.5 h-3.5" /></button>
      )}
    </div>
  )
}

export function MessageItem({ msg, autor, agrupada, meuId, membros, membrosMap, respondentes, onReagir, onResponder, onExcluir, onAbrirThread, podeResponder = true, destaque = false }) {
  const minha = msg.user_id === meuId
  return (
    <div className={`group relative flex gap-2.5 px-6 ${agrupada ? 'py-0.5' : 'pt-2 pb-0.5'} hover:bg-ln-ink/[0.025] ${destaque ? 'bg-ln-accent/[0.06]' : ''}`}>
      <Toolbar msg={msg} minha={minha} onReagir={onReagir} onResponder={onResponder} onExcluir={onExcluir} podeResponder={podeResponder} />
      <div className="w-7 shrink-0 flex justify-center">
        {agrupada
          ? <span className="text-[10px] text-ln-t4 opacity-0 group-hover:opacity-100 leading-[21px] tabular">{hora(msg.created_at)}</span>
          : <ChatAvatar pessoa={autor} id={msg.user_id} nome={autor?.name} size={28} className="mt-0.5" />}
      </div>
      <div className="flex-1 min-w-0">
        {!agrupada && (
          <div className="flex items-baseline gap-1.5 leading-4 mb-0.5">
            <span className="text-[13px] font-semibold text-ln-t1 truncate">{autor?.name || 'Usuário'}</span>
            <span className="text-[12px] text-ln-t4 shrink-0">{horaRelativa(msg.created_at)}</span>
            {msg.edited_at && <span className="text-[11px] text-ln-t4">(editada)</span>}
          </div>
        )}
        <ChatMarkdown texto={msg.content} membros={membros} meuId={meuId} />
        <Reacoes msg={msg} meuId={meuId} membrosMap={membrosMap} onReagir={onReagir} />
        {podeResponder && msg.replies_count > 0 && (
          <button onClick={() => onAbrirThread(msg)} className="group/t mt-1 mb-0.5 -ml-1 flex items-center gap-1.5 h-7 pl-1 pr-2 rounded-md hover:bg-ln-ink/[0.04] max-w-full">
            <AvatarStack ids={respondentes || []} membrosMap={membrosMap} size={18} />
            <span className="text-[12px] font-medium text-ln-t2">{msg.replies_count} {msg.replies_count === 1 ? 'resposta' : 'respostas'}</span>
            <span className="text-[12px] text-ln-t4 truncate group-hover/t:hidden">Última resposta {ultimaResposta(msg.last_reply_at)}</span>
            <span className="text-[12px] text-ln-t3 hidden group-hover/t:inline">Exibir conversa</span>
            <ChevronRight className="w-3.5 h-3.5 text-ln-t4 hidden group-hover/t:inline ml-auto" />
          </button>
        )}
      </div>
    </div>
  )
}

// Agrupa mensagens consecutivas do mesmo autor (janela de 5 min) e insere
// separadores de dia, como o ClickUp.
export function agruparMensagens(mensagens) {
  const itens = []
  let ultimoDia = null
  let anterior = null
  for (const m of mensagens) {
    const dia = chaveDia(m.created_at)
    if (dia !== ultimoDia) {
      itens.push({ tipo: 'dia', key: 'dia-' + dia, label: rotuloDia(m.created_at) })
      ultimoDia = dia
      anterior = null
    }
    const agrupada = !!anterior
      && anterior.user_id === m.user_id
      && (anterior.replies_count || 0) === 0
      && new Date(m.created_at) - new Date(anterior.created_at) < JANELA_AGRUPAMENTO_MS
    itens.push({ tipo: 'msg', key: m.id, msg: m, agrupada })
    anterior = m
  }
  return itens
}

export default function MessageList({ canal, mensagens, respondentes, meuId, membros, membrosMap, onReagir, onResponder, onExcluir, onAbrirThread, mensagemDestaque }) {
  const scrollRef = useRef(null)
  const fimRef = useRef(null)
  const presoNoFim = useRef(true)
  const itens = useMemo(() => agruparMensagens(mensagens), [mensagens])

  // Mantém no fim quando chegam mensagens e o usuário já estava no fim
  useLayoutEffect(() => {
    if (presoNoFim.current) fimRef.current?.scrollIntoView({ block: 'end' })
  }, [itens.length, canal?.id])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => { presoNoFim.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80 }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!mensagemDestaque) return
    const el = document.getElementById('msg-' + mensagemDestaque)
    if (el) { presoNoFim.current = false; el.scrollIntoView({ block: 'center' }) }
  }, [mensagemDestaque, itens.length])

  return (
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
      {/* Cabeçalho de boas-vindas do canal, como no ClickUp */}
      <div className="px-6 pt-8 pb-4">
        <div className="w-12 h-12 rounded-xl bg-ln-ink/[0.05] flex items-center justify-center mb-3">
          {canal?.type === 'dm'
            ? <ChatAvatar pessoa={canal.dmCom} nome={canal.nome} size={48} />
            : <Hash className="w-6 h-6 text-ln-t3" />}
        </div>
        <h3 className="text-[17px] font-semibold text-ln-t1">{canal?.type === 'dm' ? canal.nome : `# ${canal?.nome}`}</h3>
        <p className="text-[13px] text-ln-t3 mt-0.5">
          {canal?.type === 'dm'
            ? 'Esta é a sua conversa direta. As mensagens ficam só entre vocês.'
            : canal?.description || `Este é o começo do canal #${canal?.nome}.`}
        </p>
      </div>
      {mensagens.length === 0 && (
        <div className="px-6 py-10 text-center text-ln-t4">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-[13px]">Nenhuma mensagem ainda. Envie a primeira!</p>
        </div>
      )}
      {itens.map((it) => it.tipo === 'dia'
        ? <DateDivider key={it.key} label={it.label} />
        : (
          <div key={it.key} id={'msg-' + it.msg.id}>
            <MessageItem
              msg={it.msg}
              autor={membrosMap.get(it.msg.user_id)}
              agrupada={it.agrupada}
              meuId={meuId}
              membros={membros}
              membrosMap={membrosMap}
              respondentes={respondentes.get(it.msg.id)}
              onReagir={onReagir}
              onResponder={onResponder}
              onExcluir={onExcluir}
              onAbrirThread={onAbrirThread}
              destaque={mensagemDestaque === it.msg.id}
            />
          </div>
        ))}
      <div ref={fimRef} className="h-3" />
    </div>
  )
}
