// Editores inline dos campos de uma tarefa (status, responsável, data,
// prioridade, dropdowns, estimativa). Todos abrem um Popover em portal, para
// não serem cortados pela rolagem da tabela.
import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Check, Flag, Search, X, Clock3, CalendarDays, User, Plus } from 'lucide-react'
import {
  PRIORIDADES, TIPOS_TAREFA, DIFICULDADES, rotuloStatus, corDaPessoa, iniciais, pessoasDaTarefa,
  fmtDataNumerica, fmtDataCurta, corDaData, paraInputDate, deInputDate, fmtEstimativa, parseEstimativa,
} from '../../lib/tarefas'

// ─── Popover ──────────────────────────────────────────────────────────────────

export function Popover({ anchorRef, open, onClose, children, width = 240, align = 'left' }) {
  const [pos, setPos] = useState(null)
  const ref = useRef(null)

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return
    const r = anchorRef.current.getBoundingClientRect()
    const vw = window.innerWidth, vh = window.innerHeight
    let left = align === 'right' ? r.right - width : r.left
    left = Math.max(8, Math.min(left, vw - width - 8))
    let top = r.bottom + 4
    const alturaEstim = Math.min(360, vh - 16)
    if (top + alturaEstim > vh) top = Math.max(8, r.top - alturaEstim - 4)
    setPos({ left, top })
  }, [open, anchorRef, width, align])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (ref.current?.contains(e.target)) return
      if (anchorRef.current?.contains(e.target)) return
      onClose?.()
    }
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose?.() } }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey, true) }
  }, [open, onClose, anchorRef])

  if (!open || !pos) return null
  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', left: pos.left, top: pos.top, width, zIndex: 90 }}
      className="bg-rl-card border border-rl-border rounded-xl shadow-2xl overflow-hidden animate-slide-up max-h-[360px] flex flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  )
}

function BuscaMenu({ valor, onChange, placeholder = 'Buscar...' }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-rl-border">
      <Search className="w-3.5 h-3.5 text-rl-muted shrink-0" />
      <input
        autoFocus
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent outline-none text-[13px] text-rl-text placeholder:text-rl-muted"
      />
    </div>
  )
}

function ItemMenu({ ativo, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] text-left transition-colors hover:bg-rl-surface ${ativo ? 'text-rl-text' : 'text-rl-subtle'} ${className}`}
    >
      {children}
      {ativo && <Check className="w-3.5 h-3.5 ml-auto text-rl-purple shrink-0" />}
    </button>
  )
}

// ─── Status ───────────────────────────────────────────────────────────────────

export function StatusPill({ status, statuses, size = 'md', className = '' }) {
  const s = statuses?.find((x) => x.key === status) || { key: status, label: rotuloStatus(status), cor: '#87909e' }
  if (size === 'icon') {
    // ícone redondo antes do nome, como na lista do ClickUp
    return (
      <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-white shrink-0 ${className}`} style={{ backgroundColor: s.cor }} title={s.label || rotuloStatus(s.key)}>
        {s.tipo === 'closed' ? <Check className="w-2.5 h-2.5" /> : <Clock3 className="w-2.5 h-2.5" />}
      </span>
    )
  }
  const h = size === 'sm' ? 'h-5 px-1.5 text-[10px]' : 'h-[22px] px-2 text-[11px]'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-bold uppercase tracking-wide text-white whitespace-nowrap max-w-full ${h} ${className}`}
      style={{ backgroundColor: s.cor }}
      title={s.label || rotuloStatus(s.key)}
    >
      {s.tipo === 'closed' ? <Check className="w-3 h-3 shrink-0" /> : <Clock3 className="w-3 h-3 shrink-0" />}
      <span className="truncate">{s.label || rotuloStatus(s.key)}</span>
    </span>
  )
}

export function StatusCampo({ item, statuses, onChange, size = 'md', className = '' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  return (
    <>
      <button ref={ref} type="button" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }} className={`inline-flex max-w-full ${className}`} title="Mudar status">
        <StatusPill status={item.status} statuses={statuses} size={size} />
      </button>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={220}>
        <div className="py-1 overflow-y-auto">
          {statuses.map((s) => (
            <ItemMenu key={s.key} ativo={s.key === item.status} onClick={() => { setOpen(false); onChange(s) }}>
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.cor }} />
              <span className="uppercase text-[11px] font-bold tracking-wide">{s.label || rotuloStatus(s.key)}</span>
            </ItemMenu>
          ))}
        </div>
      </Popover>
    </>
  )
}

// ─── Responsáveis ─────────────────────────────────────────────────────────────

export function Avatar({ pessoa, size = 24, className = '' }) {
  const fonte = Math.max(9, Math.round(size * 0.4))
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-bold text-white shrink-0 ring-2 ring-rl-card ${className}`}
      style={{ width: size, height: size, backgroundColor: pessoa.cor, fontSize: fonte }}
      title={pessoa.nome}
    >
      {pessoa.iniciais}
    </span>
  )
}

export function Avatares({ item, membrosMap, size = 24, max = 3, vazio = true }) {
  const pessoas = pessoasDaTarefa(item, membrosMap)
  if (!pessoas.length) {
    return vazio ? (
      <span className="inline-flex items-center justify-center rounded-full border border-dashed border-rl-muted/60 text-rl-muted" style={{ width: size, height: size }} title="Sem responsável">
        <User className="w-3 h-3" />
      </span>
    ) : null
  }
  const vis = pessoas.slice(0, max)
  const resto = pessoas.length - vis.length
  return (
    <span className="inline-flex items-center -space-x-1.5">
      {vis.map((p) => <Avatar key={p.id} pessoa={p} size={size} />)}
      {resto > 0 && (
        <span className="inline-flex items-center justify-center rounded-full bg-rl-surface text-rl-subtle font-semibold ring-2 ring-rl-card" style={{ width: size, height: size, fontSize: 10 }}>+{resto}</span>
      )}
    </span>
  )
}

export function ResponsavelCampo({ item, membros, membrosMap, onChange, size = 24, max = 3, className = '' }) {
  const [open, setOpen] = useState(false)
  const [busca, setBusca] = useState('')
  const ref = useRef(null)
  const sel = new Set(item.responsaveis || [])
  const lista = membros.filter((m) => !m.disabled && m.name?.toLowerCase().includes(busca.toLowerCase()))
  function toggle(id) {
    const next = sel.has(id) ? [...sel].filter((x) => x !== id) : [...sel, id]
    onChange(next)
  }
  return (
    <>
      <button ref={ref} type="button" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }} className={`inline-flex items-center ${className}`} title="Responsáveis">
        <Avatares item={item} membrosMap={membrosMap} size={size} max={max} />
      </button>
      <Popover anchorRef={ref} open={open} onClose={() => { setOpen(false); setBusca('') }} width={260}>
        <BuscaMenu valor={busca} onChange={setBusca} placeholder="Buscar pessoa..." />
        <div className="py-1 overflow-y-auto">
          {lista.map((m) => {
            const p = { id: m.id, nome: m.name, iniciais: m.avatar || iniciais(m.name), cor: corDaPessoa(m.id) }
            return (
              <ItemMenu key={m.id} ativo={sel.has(m.id)} onClick={() => toggle(m.id)}>
                <Avatar pessoa={p} size={22} />
                <span className="truncate">{m.name}</span>
              </ItemMenu>
            )
          })}
          {(item.responsaveis_extra || []).length > 0 && (
            <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-rl-muted">Do ClickUp (sem perfil)</div>
          )}
          {(item.responsaveis_extra || []).map((e) => (
            <div key={e.clickup_id} className="flex items-center gap-2.5 px-3 py-1.5 text-[13px] text-rl-subtle">
              <Avatar pessoa={{ nome: e.nome, iniciais: e.iniciais || iniciais(e.nome), cor: e.cor || corDaPessoa(e.nome) }} size={22} />
              <span className="truncate flex-1">{e.nome}</span>
              <button type="button" className="text-rl-muted hover:text-red-500" title="Remover" onClick={() => onChange(item.responsaveis || [], (item.responsaveis_extra || []).filter((x) => x.clickup_id !== e.clickup_id))}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {!lista.length && <div className="px-3 py-3 text-xs text-rl-muted">Ninguém encontrado.</div>}
        </div>
      </Popover>
    </>
  )
}

// ─── Datas ────────────────────────────────────────────────────────────────────

export function DataCampo({ valor, onChange, item, formato = 'numerica', placeholder = '', className = '', icone = false }) {
  const inputRef = useRef(null)
  const texto = valor ? (formato === 'curta' ? fmtDataCurta(valor) : fmtDataNumerica(valor)) : ''
  const cor = item ? corDaData({ ...item, data_vencimento: valor }) : 'text-rl-subtle'
  return (
    <span className={`relative inline-flex items-center gap-1 group/data ${className}`} onClick={(e) => e.stopPropagation()}>
      {icone && <CalendarDays className="w-3.5 h-3.5 text-rl-muted" />}
      <button
        type="button"
        onClick={() => { try { inputRef.current?.showPicker?.() } catch { /* noop */ } inputRef.current?.focus() }}
        className={`text-[13px] whitespace-nowrap ${texto ? cor : 'text-rl-muted/70'} hover:underline decoration-dotted`}
      >
        {texto || placeholder || '–'}
      </button>
      {texto && (
        <button type="button" onClick={() => onChange(null)} className="opacity-0 group-hover/data:opacity-100 text-rl-muted hover:text-red-500 transition" title="Limpar">
          <X className="w-3 h-3" />
        </button>
      )}
      <input
        ref={inputRef}
        type="date"
        value={paraInputDate(valor)}
        onChange={(e) => onChange(deInputDate(e.target.value))}
        className="absolute inset-0 w-0 h-0 opacity-0 pointer-events-none"
        tabIndex={-1}
      />
    </span>
  )
}

// ─── Prioridade ───────────────────────────────────────────────────────────────

export function PrioridadeFlag({ valor, comTexto = true, size = 14 }) {
  const p = PRIORIDADES.find((x) => x.key === valor)
  if (!p) {
    return <span className="inline-flex items-center gap-1.5 text-rl-muted/70 text-[13px]"><Flag style={{ width: size, height: size }} className="opacity-60" />{comTexto && <span className="sr-only">Sem prioridade</span>}</span>
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-rl-subtle whitespace-nowrap">
      <Flag style={{ width: size, height: size, color: p.cor, fill: p.cor }} />
      {comTexto && p.label}
    </span>
  )
}

export function PrioridadeCampo({ valor, onChange, comTexto = true, className = '' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  return (
    <>
      <button ref={ref} type="button" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }} className={`inline-flex items-center ${className}`} title="Prioridade">
        <PrioridadeFlag valor={valor} comTexto={comTexto} />
      </button>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={180}>
        <div className="py-1">
          {PRIORIDADES.map((p) => (
            <ItemMenu key={p.key} ativo={p.key === valor} onClick={() => { setOpen(false); onChange(p.key) }}>
              <Flag className="w-3.5 h-3.5" style={{ color: p.cor, fill: p.cor }} />
              {p.label}
            </ItemMenu>
          ))}
          <div className="border-t border-rl-border my-1" />
          <ItemMenu ativo={!valor} onClick={() => { setOpen(false); onChange(null) }}>
            <X className="w-3.5 h-3.5 text-rl-muted" /> Limpar
          </ItemMenu>
        </div>
      </Popover>
    </>
  )
}

// ─── Dropdown genérico (tipo de tarefa, dificuldade) ──────────────────────────

export function Chip({ texto, cor, className = '' }) {
  if (!texto) return null
  return (
    <span className={`inline-flex items-center h-[22px] px-2 rounded-md text-[12px] font-medium text-white truncate max-w-full ${className}`} style={{ backgroundColor: cor || '#87909e' }} title={texto}>
      {texto}
    </span>
  )
}

export function OpcaoCampo({ valor, opcoes, onChange, placeholder = '–', className = '' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const atual = opcoes.find((o) => o.key === valor) || (valor ? { key: valor, cor: '#87909e' } : null)
  return (
    <>
      <button ref={ref} type="button" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }} className={`inline-flex items-center max-w-full ${className}`}>
        {atual ? <Chip texto={atual.key} cor={atual.cor} /> : <span className="text-[13px] text-rl-muted/70">{placeholder}</span>}
      </button>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={210}>
        <div className="py-1 overflow-y-auto">
          {opcoes.map((o) => (
            <ItemMenu key={o.key} ativo={o.key === valor} onClick={() => { setOpen(false); onChange(o.key) }}>
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: o.cor }} />
              {o.key}
            </ItemMenu>
          ))}
          {valor && !opcoes.some((o) => o.key === valor) && (
            <ItemMenu ativo onClick={() => setOpen(false)}>
              <span className="w-2.5 h-2.5 rounded-sm shrink-0 bg-rl-muted" />{valor}
            </ItemMenu>
          )}
          <div className="border-t border-rl-border my-1" />
          <ItemMenu ativo={!valor} onClick={() => { setOpen(false); onChange(null) }}>
            <X className="w-3.5 h-3.5 text-rl-muted" /> Limpar
          </ItemMenu>
        </div>
      </Popover>
    </>
  )
}

export function TipoTarefaCampo(props) { return <OpcaoCampo opcoes={TIPOS_TAREFA} {...props} /> }
export function DificuldadeCampo(props) { return <OpcaoCampo opcoes={DIFICULDADES} {...props} /> }

// ─── Estimativa ───────────────────────────────────────────────────────────────

export function EstimativaCampo({ valor, onChange, className = '' }) {
  const [editando, setEditando] = useState(false)
  const [txt, setTxt] = useState('')
  function abrir(e) { e.stopPropagation(); setTxt(fmtEstimativa(valor)); setEditando(true) }
  function salvar() {
    setEditando(false)
    const min = parseEstimativa(txt)
    if ((min || null) !== (valor || null)) onChange(min || null)
  }
  if (editando) {
    return (
      <input
        autoFocus
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={salvar}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.keyCode === 13)) salvar(); if (e.key === 'Escape') setEditando(false) }}
        onClick={(e) => e.stopPropagation()}
        placeholder="ex: 1h 30m"
        className="w-20 h-6 px-1.5 rounded border border-rl-purple bg-rl-surface text-[13px] text-rl-text outline-none"
      />
    )
  }
  return (
    <button type="button" onClick={abrir} className={`inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap ${valor ? 'text-rl-subtle' : 'text-rl-muted/70'} ${className}`} title="Estimativa de tempo">
      <Clock3 className="w-3.5 h-3.5 text-rl-muted" />
      {valor ? fmtEstimativa(valor) : '–'}
    </button>
  )
}

// ─── Botão de adicionar (linha "+ Adicionar Tarefa") ──────────────────────────

export function AdicionarInline({ onCriar, placeholder = 'Adicionar Tarefa', className = '', autoFocus = false, compacto = false }) {
  const [aberto, setAberto] = useState(autoFocus)
  const [titulo, setTitulo] = useState('')
  const [salvando, setSalvando] = useState(false)
  async function salvar(continuar) {
    const t = titulo.trim()
    if (!t) { setAberto(false); return }
    setSalvando(true)
    await onCriar(t)
    setSalvando(false)
    setTitulo('')
    if (!continuar) setAberto(false)
  }
  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className={`inline-flex items-center gap-1.5 text-[13px] text-rl-muted hover:text-rl-text transition ${className}`}>
        <Plus className="w-3.5 h-3.5" /> {placeholder}
      </button>
    )
  }
  return (
    <div className={`flex items-center gap-2 ${className}`} onClick={(e) => e.stopPropagation()}>
      <input
        autoFocus
        value={titulo}
        disabled={salvando}
        onChange={(e) => setTitulo(e.target.value)}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.keyCode === 13)) { e.preventDefault(); salvar(true) }
          if (e.key === 'Escape') { e.stopPropagation(); setAberto(false); setTitulo('') }
        }}
        onBlur={() => { if (!titulo.trim()) setAberto(false) }}
        placeholder="Nome da tarefa (Enter para salvar)"
        className={`flex-1 min-w-0 ${compacto ? 'h-7' : 'h-8'} px-2.5 rounded-md border border-rl-purple bg-rl-surface text-[13px] text-rl-text placeholder:text-rl-muted outline-none`}
      />
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => salvar(false)} disabled={salvando || !titulo.trim()} className="h-7 px-2.5 rounded-md bg-rl-purple text-white text-xs font-semibold disabled:opacity-40">
        Salvar
      </button>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setAberto(false); setTitulo('') }} className="h-7 px-2 rounded-md text-xs text-rl-muted hover:text-rl-text">
        Cancelar
      </button>
    </div>
  )
}
