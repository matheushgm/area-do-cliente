import { useState, useRef, useEffect } from 'react'
import { Plus, AtSign, Smile, SendHorizontal, ChevronDown, Bold, Italic, List } from 'lucide-react'
import ChatAvatar from './ChatAvatar'
import { slugDe } from '../../lib/chat'

const EMOJIS = ['👍', '❤️', '😂', '🙌', '🔥', '✅', '👀', '🎉', '😅', '🙏', '💪', '🚀']

// Caixa de escrita no padrão do ClickUp: borda arredondada, barra de ações
// embaixo (+, tipo "Mensagem", @, emoji) e botão de enviar à direita.
// Enter envia, Shift+Enter quebra linha, @ abre a lista de menções.
export default function Composer({ placeholder, membros = [], meuId, onEnviar, compacto = false, extra = null, autoFocus = false }) {
  const [texto, setTexto] = useState('')
  const [mencao, setMencao] = useState(null) // { query, inicio, fim }
  const [emojiAberto, setEmojiAberto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [texto])

  useEffect(() => { if (autoFocus) ref.current?.focus() }, [autoFocus])

  const candidatos = mencao
    ? membros.filter((m) => m.id !== meuId && m.name.toLowerCase().includes(mencao.query.toLowerCase())).slice(0, 8)
    : []

  function inserir(trecho, cursorRel = trecho.length) {
    const el = ref.current
    const ini = el?.selectionStart ?? texto.length
    const fim = el?.selectionEnd ?? texto.length
    const novo = texto.slice(0, ini) + trecho + texto.slice(fim)
    setTexto(novo)
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(ini + cursorRel, ini + cursorRel) })
  }

  function aplicarMencao(m) {
    const antes = texto.slice(0, mencao.inicio)
    const depois = texto.slice(mencao.fim)
    const ins = `@${slugDe(m.name)} `
    setTexto(antes + ins + depois)
    setMencao(null)
    requestAnimationFrame(() => { const el = ref.current; if (el) { el.focus(); el.setSelectionRange((antes + ins).length, (antes + ins).length) } })
  }

  function envolver(marca) {
    const el = ref.current
    if (!el) return
    const ini = el.selectionStart, fim = el.selectionEnd
    const sel = texto.slice(ini, fim) || 'texto'
    const novo = texto.slice(0, ini) + marca + sel + marca + texto.slice(fim)
    setTexto(novo)
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(ini + marca.length, ini + marca.length + sel.length) })
  }

  async function enviar() {
    const t = texto.trim()
    if (!t || enviando) return
    setEnviando(true)
    const ok = await onEnviar(t)
    setEnviando(false)
    if (ok !== false) { setTexto(''); setMencao(null); requestAnimationFrame(() => { if (ref.current) ref.current.style.height = 'auto' }) }
  }

  function onChange(e) {
    const v = e.target.value
    const cursor = e.target.selectionStart
    setTexto(v)
    const antes = v.slice(0, cursor)
    const m = antes.match(/(?:^|\s)@([\p{L}\p{N}_.]*)$/u)
    if (m) setMencao({ query: m[1], inicio: cursor - m[1].length - 1, fim: cursor })
    else setMencao(null)
  }

  function onKeyDown(e) {
    if (mencao && candidatos.length) {
      if (e.key === 'Escape') { e.preventDefault(); setMencao(null); return }
      if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') { e.preventDefault(); aplicarMencao(candidatos[0]); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() }
  }

  return (
    <div className="relative">
      {mencao && candidatos.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 w-64 max-h-56 overflow-y-auto bg-ln-panel border border-ln-ink/[0.08] rounded-lg z-20" style={{ boxShadow: 'var(--ln-shadow-panel)' }}>
          <p className="px-3 pt-2 pb-1 text-[11px] font-medium text-ln-t4">Pessoas</p>
          {candidatos.map((m) => (
            <button key={m.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarMencao(m)} className="w-full flex items-center gap-2 px-3 h-8 text-left hover:bg-ln-ink/5">
              <ChatAvatar pessoa={m} size={20} />
              <span className="text-[13px] text-ln-t1 truncate">{m.name}</span>
            </button>
          ))}
        </div>
      )}
      <div className={`rounded-[10px] border border-ln-ink/[0.12] bg-ln-card focus-within:border-ln-ink/25 transition-colors ${compacto ? '' : 'shadow-[0_1px_2px_rgba(0,0,0,0.04)]'}`}>
        <textarea
          ref={ref}
          value={texto}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onBlur={() => setTimeout(() => setMencao(null), 150)}
          placeholder={placeholder}
          rows={1}
          className={`block w-full bg-transparent resize-none outline-none text-[14px] leading-[21px] text-ln-t1 placeholder:text-ln-t4 ${compacto ? 'px-3 pt-2.5 pb-1' : 'px-3.5 pt-3 pb-1.5'}`}
        />
        {extra && <div className="px-3 pb-1">{extra}</div>}
        <div className={`flex items-center gap-0.5 ${compacto ? 'px-2 pb-2' : 'px-2.5 pb-2.5'}`}>
          <button type="button" onClick={() => ref.current?.focus()} className="w-6 h-6 rounded-md inline-flex items-center justify-center text-ln-t3 hover:bg-ln-ink/5 hover:text-ln-t1 border border-ln-ink/10 mr-1" title="Adicionar" aria-label="Adicionar">
            <Plus className="w-3.5 h-3.5" />
          </button>
          {!compacto && (
            <span className="hidden sm:inline-flex items-center gap-1 h-6 px-1.5 rounded-md border border-ln-ink/10 text-[11px] text-ln-t2 mr-1">Mensagem <ChevronDown className="w-3 h-3 text-ln-t4" /></span>
          )}
          <button type="button" onClick={() => envolver('**')} className="ln-iconbtn !w-6 !h-6 !rounded-md" title="Negrito" aria-label="Negrito"><Bold className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => envolver('_')} className="ln-iconbtn !w-6 !h-6 !rounded-md" title="Itálico" aria-label="Itálico"><Italic className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => inserir('\n- ')} className="ln-iconbtn !w-6 !h-6 !rounded-md" title="Lista" aria-label="Lista"><List className="w-3.5 h-3.5" /></button>
          <span className="w-px h-4 bg-ln-ink/10 mx-1" />
          <button type="button" onClick={() => { inserir('@', 1); setMencao({ query: '', inicio: (ref.current?.selectionStart ?? texto.length), fim: (ref.current?.selectionStart ?? texto.length) + 1 }) }} className="ln-iconbtn !w-6 !h-6 !rounded-md" title="Mencionar alguém" aria-label="Mencionar"><AtSign className="w-3.5 h-3.5" /></button>
          <div className="relative">
            <button type="button" onClick={() => setEmojiAberto((v) => !v)} className="ln-iconbtn !w-6 !h-6 !rounded-md" title="Emoji" aria-label="Emoji"><Smile className="w-3.5 h-3.5" /></button>
            {emojiAberto && (
              <div className="absolute bottom-full left-0 mb-1 p-1.5 grid grid-cols-6 gap-0.5 bg-ln-panel border border-ln-ink/[0.08] rounded-lg z-20" style={{ boxShadow: 'var(--ln-shadow-panel)' }} onMouseLeave={() => setEmojiAberto(false)}>
                {EMOJIS.map((e) => <button key={e} type="button" onClick={() => { inserir(e + ' '); setEmojiAberto(false) }} className="w-7 h-7 rounded hover:bg-ln-ink/5 text-[16px]">{e}</button>)}
              </div>
            )}
          </div>
          <div className="flex-1" />
          <button
            type="button"
            onClick={enviar}
            disabled={!texto.trim() || enviando}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-ln-brand text-white disabled:bg-ln-ink/[0.06] disabled:text-ln-t4 transition-colors"
            title="Enviar (Enter)"
            aria-label="Enviar"
          >
            <SendHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
