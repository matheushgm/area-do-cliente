// Botão de menções da sidebar global: aparece em todas as telas internas (Área do Cliente,
// VertaTask, chat). Mostra quantas menções você ainda não viu e abre um painel com duas
// abas: Comentários (marcaram você num comentário de tarefa) e Chat (marcaram você numa
// mensagem). Clicar leva ao comentário/mensagem e marca como lida.
// Dados: useMencoes (notifications 'tarefa_mencao' e 'mention'; migration 139).
import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AtSign, CheckCheck, Check, X, MessageSquare, ListTodo, Loader2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useI18n } from '../i18n'
import { useMencoes } from '../hooks/useMencoes'
import { marcarMencoesLidas, resumoDaMencao } from '../lib/mencoes'
import { horaRelativa } from '../lib/chat'
import ChatAvatar from './Chat/ChatAvatar'

const LARGURA = 400

function Badge({ n, className = '' }) {
  if (!n) return null
  return (
    <span className={`min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full bg-rl-red text-white text-[10px] font-bold leading-none tabular-nums ${className}`}>
      {n > 99 ? '99+' : n}
    </span>
  )
}

export default function MencoesSino({ recolhida = false, onNavegar }) {
  const { user, teamMembers } = useApp()
  const { t } = useI18n()
  const navigate = useNavigate()
  const m = useMencoes(user?.id)
  const [aberto, setAberto] = useState(false)
  const [aba, setAba] = useState('comentarios')
  const [soNaoLidas, setSoNaoLidas] = useState(false)
  const botaoRef = useRef(null)
  const painelRef = useRef(null)
  const [pos, setPos] = useState(null)

  // Abre na aba que tem coisa nova.
  function alternar() {
    if (!aberto) {
      if (!m.naoLidas[aba] && m.naoLidas[aba === 'chat' ? 'comentarios' : 'chat']) setAba(aba === 'chat' ? 'comentarios' : 'chat')
      m.recarregar()
    }
    setAberto((v) => !v)
  }

  useLayoutEffect(() => {
    if (!aberto) return undefined
    const calcular = () => {
      const r = botaoRef.current?.getBoundingClientRect()
      const altura = Math.min(620, window.innerHeight - 16)
      if (!r || window.innerWidth < 640) { setPos({ left: 8, top: 8, width: window.innerWidth - 16, altura }); return }
      const top = Math.max(8, Math.min(r.top, window.innerHeight - altura - 8))
      setPos({ left: r.right + 8, top, width: LARGURA, altura })
    }
    calcular()
    window.addEventListener('resize', calcular)
    return () => window.removeEventListener('resize', calcular)
  }, [aberto])

  useEffect(() => {
    if (!aberto) return undefined
    const fora = (e) => {
      if (painelRef.current?.contains(e.target) || botaoRef.current?.contains(e.target)) return
      setAberto(false)
    }
    const esc = (e) => { if (e.key === 'Escape') setAberto(false) }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [aberto])

  const membrosMap = new Map((teamMembers || []).map((p) => [p.id, p]))
  const lista = (m.itens[aba] || []).filter((n) => !soNaoLidas || !n.read_at)

  async function abrir(n) {
    setAberto(false)
    onNavegar?.()
    if (!n.read_at) { m.marcarLocal({ ids: [n.id] }); marcarMencoesLidas({ ids: [n.id] }) }
    if (n.link) navigate(n.link)
  }
  function lida(e, n) {
    e.stopPropagation()
    m.marcarLocal({ ids: [n.id] })
    marcarMencoesLidas({ ids: [n.id] })
  }
  function todas() {
    m.marcarLocal({ categoria: aba })
    marcarMencoesLidas({ categoria: aba })
  }

  const rotulo = `${t('mencoes.titulo')}${m.total ? ` · ${t('mencoes.naoLidasAria', { count: m.total })}` : ''}`

  return (
    <>
      {recolhida ? (
        <button
          ref={botaoRef}
          onClick={alternar}
          aria-label={rotulo}
          aria-expanded={aberto}
          aria-haspopup="dialog"
          title={t('mencoes.abrir')}
          className={`relative w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-150 border ${
            aberto ? 'bg-rl-purple/15 text-rl-purple border-rl-purple/25' : 'text-rl-muted hover:bg-rl-surface hover:text-rl-text border-transparent'
          }`}
        >
          <AtSign className="w-4 h-4" />
          <Badge n={m.total} className="absolute -top-0.5 -right-0.5 ring-2 ring-rl-surface" />
        </button>
      ) : (
        <button
          ref={botaoRef}
          onClick={alternar}
          aria-label={rotulo}
          aria-expanded={aberto}
          aria-haspopup="dialog"
          title={t('mencoes.abrir')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 border ${
            aberto ? 'bg-rl-purple/15 text-rl-purple border-rl-purple/25' : 'text-rl-muted hover:bg-rl-surface hover:text-rl-text border-transparent'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <AtSign className="w-4 h-4 shrink-0" />
            {t('mencoes.titulo')}
          </span>
          <Badge n={m.total} />
        </button>
      )}

      {aberto && pos && createPortal(
        <div
          ref={painelRef}
          role="dialog"
          aria-label={t('mencoes.titulo')}
          className="fixed z-[120] flex flex-col rounded-2xl border border-rl-border bg-rl-card text-rl-text shadow-2xl overflow-hidden animate-slide-up"
          style={{ left: pos.left, top: pos.top, width: pos.width, maxHeight: pos.altura }}
        >
          {/* Cabeçalho */}
          <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
            <AtSign className="w-4 h-4 text-rl-purple" />
            <h2 className="text-[15px] font-semibold flex-1">{t('mencoes.titulo')}</h2>
            <button
              onClick={todas}
              disabled={!m.naoLidas[aba]}
              className="inline-flex items-center gap-1 h-7 px-2 rounded-lg text-[12px] font-medium text-rl-purple hover:bg-rl-purple/10 disabled:text-rl-muted/60 disabled:hover:bg-transparent transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" /> {t('mencoes.marcarTodas')}
            </button>
            <button onClick={() => setAberto(false)} className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface" aria-label={t('comum.fechar')}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Abas */}
          <div className="flex items-center gap-1 px-3 border-b border-rl-border" role="tablist">
            {[
              { id: 'comentarios', Icon: ListTodo, label: t('mencoes.comentarios') },
              { id: 'chat', Icon: MessageSquare, label: t('mencoes.chat') },
            ].map(({ id, Icon, label }) => (
              <button
                key={id}
                role="tab"
                aria-selected={aba === id}
                onClick={() => setAba(id)}
                className={`relative inline-flex items-center gap-1.5 h-9 px-2.5 text-[13px] font-medium transition-colors ${
                  aba === id ? 'text-rl-text' : 'text-rl-muted hover:text-rl-text'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                <Badge n={m.naoLidas[id]} />
                {aba === id && <span className="absolute left-1.5 right-1.5 -bottom-px h-0.5 rounded-full bg-rl-purple" />}
              </button>
            ))}
            <label className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-rl-muted cursor-pointer select-none pr-1">
              <input type="checkbox" checked={soNaoLidas} onChange={(e) => setSoNaoLidas(e.target.checked)} className="accent-[rgb(var(--rl-purple))]" />
              {t('mencoes.soNaoLidas')}
            </label>
          </div>

          {/* Lista */}
          <div className="flex-1 min-h-0 overflow-y-auto py-1" role="tabpanel">
            {m.carregando && !lista.length ? (
              <p className="flex items-center justify-center gap-2 py-10 text-[13px] text-rl-muted"><Loader2 className="w-4 h-4 animate-spin" /> {t('mencoes.carregando')}</p>
            ) : !lista.length ? (
              <div className="px-8 py-10 text-center">
                <AtSign className="w-7 h-7 mx-auto mb-2 text-rl-muted/50" />
                <p className="text-[13px] text-rl-muted">
                  {soNaoLidas && (m.itens[aba] || []).length ? t('mencoes.vazioNaoLidas') : t(aba === 'chat' ? 'mencoes.vazioChat' : 'mencoes.vazioComentarios')}
                </p>
              </div>
            ) : lista.map((n) => (
              <ItemMencao key={n.id} n={n} aba={aba} membrosMap={membrosMap} t={t} onAbrir={() => abrir(n)} onLida={(e) => lida(e, n)} />
            ))}
          </div>

          <p className="px-4 py-2 border-t border-rl-border text-[11px] text-rl-muted">{t('mencoes.rodape')}</p>
        </div>,
        document.body,
      )}
    </>
  )
}

function ItemMencao({ n, aba, membrosMap, t, onAbrir, onLida }) {
  const d = n.data || {}
  const remetente = membrosMap.get(d.sender_id)
  const nome = remetente?.name || d.sender_nome || n.title?.split(' mencionou')[0] || t('mencoes.alguem')
  const naoLida = !n.read_at
  let onde = null
  if (aba === 'chat') {
    const canal = d.canal_nome || n.title?.match(/#(.+)$/)?.[1]
    onde = canal && d.canal_tipo !== 'dm' ? t('mencoes.emCanal', { canal }) : t('mencoes.emDm')
    if (d.parent_id) onde += ` · ${t('mencoes.naThread')}`
  }
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir() } }}
      className={`group relative flex gap-3 mx-1.5 px-2.5 py-2.5 rounded-xl cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-rl-purple/40 ${
        naoLida ? 'bg-rl-purple/[0.06] hover:bg-rl-purple/10' : 'hover:bg-rl-surface'
      }`}
    >
      <ChatAvatar pessoa={remetente} id={d.sender_id} nome={nome} size={32} className="mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] leading-snug">
          <span className={naoLida ? 'font-semibold text-rl-text' : 'font-medium text-rl-subtle'}>{nome}</span>
          {onde && <span className="text-rl-muted"> {onde}</span>}
          <span className="text-rl-muted"> · {horaRelativa(n.created_at)}</span>
        </p>
        {aba === 'comentarios' && (d.tarefa_titulo || d.pasta) && (
          <p className="mt-0.5 flex items-center gap-1.5 min-w-0 text-[12px] text-rl-subtle">
            <ListTodo className="w-3 h-3 shrink-0 text-rl-muted" />
            <span className="truncate">{d.tarefa_titulo || t('mencoes.tarefa')}</span>
            {d.pasta && <span className="shrink-0 max-w-[40%] truncate px-1.5 py-px rounded-md bg-rl-surface border border-rl-border text-[10.5px] text-rl-muted">{d.pasta}</span>}
          </p>
        )}
        <p className={`mt-1 text-[12.5px] leading-snug line-clamp-2 ${naoLida ? 'text-rl-text' : 'text-rl-muted'}`}>{resumoDaMencao(n.body)}</p>
      </div>
      {naoLida && (
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="w-2 h-2 mt-1.5 rounded-full bg-rl-purple" aria-hidden />
          <button
            onClick={onLida}
            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1 rounded-md text-rl-muted hover:text-rl-purple hover:bg-rl-purple/10 transition-opacity"
            title={t('mencoes.marcarLida')}
            aria-label={t('mencoes.marcarLida')}
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
