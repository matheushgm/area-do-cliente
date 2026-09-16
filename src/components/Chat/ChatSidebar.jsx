import { useState, useMemo, useRef } from 'react'
import { Hash, Lock, Search, SquarePen, X, Plus, ChevronDown, ChevronRight, Star } from 'lucide-react'
import ChatAvatar from './ChatAvatar'
import { Popover } from '../Tarefas/Campos'

const FILTROS = [
  { id: 'nao-lida', rotulo: 'Não lida' },
  { id: 'dms', rotulo: 'DMs' },
  { id: 'canais', rotulo: 'Canais' },
]

function LinhaCanal({ canal, ativo, onClick }) {
  const naoLida = canal.naoLidas > 0
  const Icone = canal.type === 'dm' ? null : canal.visibility === 'private' ? Lock : Hash
  return (
    <button
      onClick={onClick}
      className={`group w-full flex items-center gap-2 h-7 px-2 rounded-md text-[13px] text-left transition-colors ${
        ativo ? 'bg-ln-ink/[0.07] text-ln-t1' : 'text-ln-t2 hover:bg-ln-ink/[0.04]'
      }`}
    >
      {Icone
        ? <Icone className={`w-3.5 h-3.5 shrink-0 ${naoLida ? 'text-ln-t1' : 'text-ln-t4'}`} />
        : <ChatAvatar pessoa={canal.dmCom} nome={canal.nome} size={18} />}
      <span className={`truncate flex-1 ${naoLida ? 'font-semibold text-ln-t1' : ''}`}>{canal.nome}</span>
      {canal.mencoes > 0 ? (
        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-ln-red text-white text-[10px] font-bold inline-flex items-center justify-center">@{canal.mencoes}</span>
      ) : naoLida ? (
        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-ln-brand text-white text-[10px] font-bold inline-flex items-center justify-center">{canal.naoLidas > 99 ? '99+' : canal.naoLidas}</span>
      ) : null}
    </button>
  )
}

function Secao({ titulo, aberta, onToggle, acao, children, vazio }) {
  return (
    <div className="mt-3">
      <div className="group flex items-center h-6 px-2">
        <button onClick={onToggle} className="flex items-center gap-1 text-[11px] font-medium text-ln-t4 hover:text-ln-t2 transition-colors">
          {aberta ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {titulo}
        </button>
        {acao && (
          <button onClick={acao.onClick} title={acao.titulo} className="ml-auto w-5 h-5 rounded inline-flex items-center justify-center text-ln-t4 opacity-0 group-hover:opacity-100 hover:bg-ln-ink/5 hover:text-ln-t2 transition">
            <Plus className="w-3 h-3" />
          </button>
        )}
      </div>
      {aberta && (
        <div className="space-y-px mt-0.5">
          {children}
          {vazio && <p className="px-2 py-1 text-[12px] text-ln-t4">{vazio}</p>}
        </div>
      )}
    </div>
  )
}

export default function ChatSidebar({ canais, canalAtivoId, onSelecionar, onNovoCanal, onNovaDM, onFechar }) {
  const [busca, setBusca] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [filtro, setFiltro] = useState(null)
  const [abertas, setAbertas] = useState({ fav: true, canais: true, dms: true })
  const [menuNovo, setMenuNovo] = useState(false)
  const novoRef = useRef(null)

  const toggle = (k) => setAbertas((a) => ({ ...a, [k]: !a[k] }))

  const { favoritos, listaCanais, dms } = useMemo(() => {
    const q = busca.trim().toLowerCase()
    let base = canais.filter((c) => !q || (c.nome || '').toLowerCase().includes(q))
    if (filtro === 'nao-lida') base = base.filter((c) => c.naoLidas > 0)
    if (filtro === 'dms') base = base.filter((c) => c.type === 'dm')
    if (filtro === 'canais') base = base.filter((c) => c.type === 'channel')
    const porAtividade = (a, b) => new Date(b.last_message_at || b.created_at) - new Date(a.last_message_at || a.created_at)
    const porNome = (a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR')
    const favoritos = base.filter((c) => c.favorito).sort(porNome)
    const listaCanais = base.filter((c) => c.type === 'channel' && !c.favorito).sort(porNome)
    const dms = base.filter((c) => c.type === 'dm' && !c.favorito).sort(porAtividade)
    return { favoritos, listaCanais, dms }
  }, [canais, busca, filtro])

  const linha = (c) => <LinhaCanal key={c.id} canal={c} ativo={c.id === canalAtivoId} onClick={() => onSelecionar(c)} />

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Cabeçalho */}
      <div className="h-11 px-3 flex items-center gap-1 shrink-0">
        <h2 className="text-[15px] font-semibold text-ln-t1 flex-1">Chat</h2>
        <button onClick={() => { setBuscando((v) => !v); setBusca('') }} className="ln-iconbtn !w-6 !h-6" title="Buscar" aria-label="Buscar conversa">
          <Search className="w-3.5 h-3.5" />
        </button>
        <button ref={novoRef} onClick={() => setMenuNovo(true)} className="inline-flex items-center gap-0.5 h-6 px-1.5 rounded-md text-ln-t3 hover:bg-ln-ink/5 hover:text-ln-t1 transition" title="Nova mensagem" aria-label="Nova mensagem">
          <SquarePen className="w-3.5 h-3.5" /><ChevronDown className="w-3 h-3" />
        </button>
        {onFechar && <button onClick={onFechar} className="ln-iconbtn !w-6 !h-6 md:hidden" aria-label="Fechar lista"><X className="w-4 h-4" /></button>}
        <Popover anchorRef={novoRef} open={menuNovo} onClose={() => setMenuNovo(false)} width={200} align="right">
          <button onClick={() => { setMenuNovo(false); onNovaDM() }} className="w-full text-left px-3 py-1.5 text-[13px] text-ln-t1 hover:bg-ln-ink/5">Nova mensagem direta</button>
          <button onClick={() => { setMenuNovo(false); onNovoCanal() }} className="w-full text-left px-3 py-1.5 text-[13px] text-ln-t1 hover:bg-ln-ink/5">Novo canal</button>
        </Popover>
      </div>

      {buscando && (
        <div className="px-3 pb-2">
          <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar canal ou pessoa" className="ln-input !h-7" />
        </div>
      )}

      {/* Filtros */}
      <div className="px-3 pb-1 flex items-center gap-1 shrink-0">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro((cur) => cur === f.id ? null : f.id)}
            className={`h-6 px-2 rounded-md text-[12px] transition-colors ${filtro === f.id ? 'bg-ln-ink/[0.08] text-ln-t1 font-medium' : 'text-ln-t3 hover:bg-ln-ink/5 hover:text-ln-t1'}`}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      {/* Listas */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3">
        {favoritos.length > 0 && (
          <Secao titulo="Favoritos" aberta={abertas.fav} onToggle={() => toggle('fav')}>
            {favoritos.map(linha)}
          </Secao>
        )}
        <Secao titulo="Canais" aberta={abertas.canais} onToggle={() => toggle('canais')} acao={{ onClick: onNovoCanal, titulo: 'Novo canal' }} vazio={listaCanais.length === 0 ? 'Nenhum canal' : null}>
          {listaCanais.map(linha)}
        </Secao>
        <Secao titulo="Mensagens diretas" aberta={abertas.dms} onToggle={() => toggle('dms')} acao={{ onClick: onNovaDM, titulo: 'Nova mensagem direta' }} vazio={dms.length === 0 ? 'Sem conversas' : null}>
          {dms.map(linha)}
        </Secao>
      </div>

      <div className="h-9 px-3 border-t border-ln-border flex items-center gap-2 text-[11px] text-ln-t4 shrink-0">
        <Star className="w-3 h-3" /> Favorite um canal pela estrela no cabeçalho
      </div>
    </div>
  )
}
