import { useState } from 'react'
import { X, Loader2, Maximize2, Minimize2 } from 'lucide-react'
import { MessageItem } from './MessageList'
import Composer from './Composer'
import { primeiroNome } from '../../lib/chat'

// Painel lateral da thread, como no ClickUp: "Thread de Fulano", mensagem
// raiz, divisor "N respostas", respostas e composer com a opção de mandar
// também no canal.
export default function ThreadPanel({ raiz, respostas, carregando, canal, meuId, membros, membrosMap, onFechar, onEnviar, onReagir, onExcluir, expandido, onExpandir }) {
  const [tambem, setTambem] = useState(false)
  const autor = membrosMap.get(raiz?.user_id)
  if (!raiz) return null
  return (
    <div className="flex flex-col h-full min-h-0 bg-ln-bg">
      <div className="h-11 px-3 flex items-center gap-2 border-b border-ln-border shrink-0">
        <h3 className="text-[13px] font-semibold text-ln-t1 truncate flex-1">Thread de {primeiroNome(autor?.name || 'Usuário')}</h3>
        {onExpandir && (
          <button onClick={onExpandir} className="ln-iconbtn hidden md:inline-flex" title={expandido ? 'Voltar ao painel' : 'Expandir'} aria-label="Expandir thread">
            {expandido ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        )}
        <button onClick={onFechar} className="ln-iconbtn" title="Fechar (Esc)" aria-label="Fechar thread"><X className="w-4 h-4" /></button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto py-2">
        <MessageItem msg={raiz} autor={autor} agrupada={false} meuId={meuId} membros={membros} membrosMap={membrosMap} onReagir={onReagir} onExcluir={onExcluir} podeResponder={false} />
        <div className="flex items-center gap-2 px-6 my-2">
          <span className="text-[11px] font-medium text-ln-t4 shrink-0">{raiz.replies_count || respostas.length} {(raiz.replies_count || respostas.length) === 1 ? 'resposta' : 'respostas'}</span>
          <div className="flex-1 h-px bg-ln-border" />
        </div>
        {carregando ? (
          <div className="flex justify-center py-6 text-ln-t4"><Loader2 className="w-4 h-4 animate-spin" /></div>
        ) : respostas.map((r, i) => {
          const ant = respostas[i - 1]
          const agrupada = !!ant && ant.user_id === r.user_id && new Date(r.created_at) - new Date(ant.created_at) < 5 * 60 * 1000
          return (
            <MessageItem key={r.id} msg={r} autor={membrosMap.get(r.user_id)} agrupada={agrupada} meuId={meuId} membros={membros} membrosMap={membrosMap} onReagir={onReagir} onExcluir={onExcluir} podeResponder={false} />
          )
        })}
        <div className="h-2" />
      </div>

      <div className="px-3 pb-3 pt-1 shrink-0">
        <Composer
          compacto
          autoFocus
          placeholder="Responda na thread"
          membros={membros}
          meuId={meuId}
          onEnviar={(t) => onEnviar(t, tambem)}
          extra={canal?.type === 'channel' ? (
            <label className="inline-flex items-center gap-1.5 text-[11px] text-ln-t3 cursor-pointer select-none">
              <input type="checkbox" checked={tambem} onChange={(e) => setTambem(e.target.checked)} className="w-3 h-3 accent-[rgb(var(--ln-brand))]" />
              Enviar também para #{canal.nome}
            </label>
          ) : null}
        />
      </div>
    </div>
  )
}
