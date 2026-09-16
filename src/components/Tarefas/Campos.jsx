// Editores inline dos campos de uma tarefa (status, responsável, data,
// prioridade, dropdowns, estimativa), na linguagem visual do Linear (tokens
// ln-*, mesma do módulo Atividades). Todos abrem um Popover em portal, para
// não serem cortados pela rolagem da tabela.
import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Check, Search, X, Clock3, Plus, User } from 'lucide-react'
import {
  PRIORIDADES, TIPOS_TAREFA, DIFICULDADES, rotuloStatus, corDaPessoa, iniciais, pessoasDaTarefa,
  fmtDataNumerica, fmtDataCurta, paraInputDate, deInputDate, fmtEstimativa, parseEstimativa, paraData, inicioDoDia,
} from '../../lib/tarefas'

export const FOCO = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ln-t2'

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
    const alturaEstim = Math.min(340, vh - 16)
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
      style={{ position: 'fixed', left: pos.left, top: pos.top, width, zIndex: 90, boxShadow: 'var(--ln-shadow-panel)' }}
      className="ln bg-ln-panel border border-ln-ink/[0.08] rounded-lg overflow-hidden max-h-[340px] flex flex-col text-ln-t2"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  )
}

function BuscaMenu({ valor, onChange, placeholder = 'Buscar...' }) {
  return (
    <div className="flex items-center gap-2 h-9 px-3 border-b border-ln-ink/5">
      <Search className="w-3.5 h-3.5 text-ln-t4 shrink-0" />
      <input
        autoFocus
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-ln-t1 placeholder:text-ln-t4"
      />
    </div>
  )
}

function ItemMenu({ ativo, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 h-8 px-2.5 text-[13px] text-left rounded-md transition-colors duration-150 hover:bg-ln-ink/5 ${ativo ? 'text-ln-t1' : 'text-ln-t2'} ${className}`}
    >
      {children}
      {ativo && <Check className="w-3.5 h-3.5 ml-auto text-ln-accent shrink-0" />}
    </button>
  )
}

// ─── Status ───────────────────────────────────────────────────────────────────

/** Círculo de status como no Linear: vazio (aberto), meio (em andamento), check (concluído). */
export function StatusIcon({ status, statuses, size = 16, className = '' }) {
  const s = statuses?.find((x) => x.key === status) || { key: status, label: rotuloStatus(status), cor: '#87909e', tipo: 'custom' }
  const label = s.label || rotuloStatus(s.key)
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} role="img" aria-label={label} className={`shrink-0 ${className}`} style={{ color: s.cor }}>
      <title>{label}</title>
      {s.tipo === 'closed' ? (
        <>
          <circle cx="8" cy="8" r="6.5" fill="currentColor" />
          <path d="M5 8.2l2 2 4-4.2" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : s.tipo === 'open' ? (
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.2 2" />
      ) : (
        <>
          <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 3.5 a4.5 4.5 0 0 1 0 9 z" fill="currentColor" />
        </>
      )}
    </svg>
  )
}

export function StatusPill({ status, statuses, className = '' }) {
  const s = statuses?.find((x) => x.key === status) || { key: status, label: rotuloStatus(status), cor: '#87909e', tipo: 'custom' }
  return (
    <span className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-full ring-1 ring-inset ring-ln-line text-xs text-ln-t2 whitespace-nowrap max-w-full ${className}`} title={s.label || rotuloStatus(s.key)}>
      <StatusIcon status={status} statuses={statuses} size={13} />
      <span className="truncate">{s.label || rotuloStatus(s.key)}</span>
    </span>
  )
}

export function StatusCampo({ item, statuses, onChange, modo = 'pill', className = '' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  return (
    <>
      <button ref={ref} type="button" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }} className={`inline-flex items-center max-w-full rounded-md ${FOCO} ${className}`} title="Mudar status">
        {modo === 'icon' ? <StatusIcon status={item.status} statuses={statuses} /> : <StatusPill status={item.status} statuses={statuses} />}
      </button>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={220}>
        <div className="p-1 overflow-y-auto">
          {statuses.map((s) => (
            <ItemMenu key={s.key} ativo={s.key === item.status} onClick={() => { setOpen(false); onChange(s) }}>
              <StatusIcon status={s.key} statuses={statuses} size={14} />
              <span className="truncate">{s.label || rotuloStatus(s.key)}</span>
            </ItemMenu>
          ))}
        </div>
      </Popover>
    </>
  )
}

// ─── Responsáveis ─────────────────────────────────────────────────────────────

export function Avatar({ pessoa, size = 20, className = '' }) {
  const fonte = Math.max(8, Math.round(size * 0.42))
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold leading-none text-white shrink-0 ring-2 ring-ln-panel ${className}`}
      style={{ width: size, height: size, backgroundColor: pessoa.cor, fontSize: fonte }}
      title={pessoa.nome}
    >
      {pessoa.iniciais}
    </span>
  )
}

export function Avatares({ item, membrosMap, size = 20, max = 3, vazio = true }) {
  const pessoas = pessoasDaTarefa(item, membrosMap)
  if (!pessoas.length) {
    return vazio ? (
      <span className="inline-flex items-center justify-center rounded-full border border-dashed border-ln-t4/60 text-ln-t4" style={{ width: size, height: size }} title="Sem responsável">
        <User style={{ width: size * 0.55, height: size * 0.55 }} />
      </span>
    ) : null
  }
  const vis = pessoas.slice(0, max)
  const resto = pessoas.length - vis.length
  return (
    <span className="inline-flex items-center -space-x-1.5">
      {vis.map((p) => <Avatar key={p.id} pessoa={p} size={size} />)}
      {resto > 0 && (
        <span className="inline-flex items-center justify-center rounded-full bg-ln-ink/10 text-ln-t3 font-medium ring-2 ring-ln-panel" style={{ width: size, height: size, fontSize: 9 }}>+{resto}</span>
      )}
    </span>
  )
}

export function ResponsavelCampo({ item, membros, membrosMap, onChange, size = 20, max = 3, comNome = false, className = '' }) {
  const [open, setOpen] = useState(false)
  const [busca, setBusca] = useState('')
  const ref = useRef(null)
  const sel = new Set(item.responsaveis || [])
  const lista = membros.filter((m) => !m.disabled && m.name?.toLowerCase().includes(busca.toLowerCase()))
  const pessoas = pessoasDaTarefa(item, membrosMap)
  function toggle(id) {
    const next = sel.has(id) ? [...sel].filter((x) => x !== id) : [...sel, id]
    onChange(next)
  }
  return (
    <>
      <button ref={ref} type="button" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }} className={`inline-flex items-center gap-1.5 rounded-md min-w-0 ${FOCO} ${className}`} title="Responsáveis">
        <Avatares item={item} membrosMap={membrosMap} size={size} max={max} />
        {comNome && (
          <span className={`text-xs truncate ${pessoas.length ? 'text-ln-t2' : 'text-ln-t4'}`}>
            {pessoas.length ? pessoas.map((p) => p.nome.split(' ')[0]).join(', ') : 'sem responsável'}
          </span>
        )}
      </button>
      <Popover anchorRef={ref} open={open} onClose={() => { setOpen(false); setBusca('') }} width={260}>
        <BuscaMenu valor={busca} onChange={setBusca} placeholder="Buscar pessoa..." />
        <div className="p-1 overflow-y-auto">
          {lista.map((m) => {
            const p = { id: m.id, nome: m.name, iniciais: m.avatar || iniciais(m.name), cor: corDaPessoa(m.id) }
            return (
              <ItemMenu key={m.id} ativo={sel.has(m.id)} onClick={() => toggle(m.id)}>
                <Avatar pessoa={p} size={18} />
                <span className="truncate">{m.name}</span>
              </ItemMenu>
            )
          })}
          {(item.responsaveis_extra || []).length > 0 && (
            <div className="px-2.5 pt-2 pb-1 text-[10px] uppercase tracking-wide text-ln-t4">Do ClickUp (sem perfil)</div>
          )}
          {(item.responsaveis_extra || []).map((e) => (
            <div key={e.clickup_id} className="flex items-center gap-2.5 h-8 px-2.5 text-[13px] text-ln-t3">
              <Avatar pessoa={{ nome: e.nome, iniciais: e.iniciais || iniciais(e.nome), cor: e.cor || corDaPessoa(e.nome) }} size={18} />
              <span className="truncate flex-1">{e.nome}</span>
              <button type="button" className="ln-iconbtn !w-6 !h-6" title="Remover" onClick={() => onChange(item.responsaveis || [], (item.responsaveis_extra || []).filter((x) => x.clickup_id !== e.clickup_id))}>
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {!lista.length && <div className="px-2.5 py-3 text-xs text-ln-t4">Ninguém encontrado.</div>}
        </div>
      </Popover>
    </>
  )
}

// ─── Datas ────────────────────────────────────────────────────────────────────

function corDaData(valor, item) {
  if (!valor) return 'text-ln-t4'
  if (item?.status_tipo === 'closed') return 'text-ln-t4'
  const d = inicioDoDia(paraData(valor)).getTime()
  const h = inicioDoDia().getTime()
  if (d < h) return 'text-ln-red'
  if (d === h) return 'text-ln-green'
  return 'text-ln-t3'
}

export function DataCampo({ valor, onChange, item, formato = 'numerica', placeholder = 'sem data', className = '' }) {
  const inputRef = useRef(null)
  const texto = valor ? (formato === 'curta' ? fmtDataCurta(valor) : fmtDataNumerica(valor)) : ''
  return (
    <span className={`relative inline-flex items-center gap-1 group/data min-w-0 ${className}`} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => { try { inputRef.current?.showPicker?.() } catch { /* noop */ } inputRef.current?.focus() }}
        className={`text-xs tabular whitespace-nowrap rounded ${corDaData(valor, item)} hover:text-ln-t1 ${FOCO}`}
      >
        {texto || placeholder || <span className="inline-block w-8 h-3 rounded bg-ln-ink/[0.04]" aria-hidden="true" />}
      </button>
      {texto && (
        <button type="button" onClick={() => onChange(null)} className="opacity-0 group-hover/data:opacity-100 text-ln-t4 hover:text-ln-red transition" title="Limpar" aria-label="Limpar data">
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
        aria-hidden="true"
      />
    </span>
  )
}

// ─── Prioridade (barras, como no Linear) ─────────────────────────────────────

const BARRAS = { urgent: 3, high: 3, normal: 2, low: 1 }

export function PrioridadeIcon({ valor, className = '' }) {
  const p = PRIORIDADES.find((x) => x.key === valor)
  const cheias = p ? BARRAS[p.key] : 0
  const label = p ? `Prioridade: ${p.label}` : 'Sem prioridade'
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" role="img" aria-label={label} className={`shrink-0 ${className}`}>
      <title>{label}</title>
      {[0, 1, 2].map((i) => (
        <rect key={i} x={1.5 + i * 5} y={10.5 - i * 3.5} width="3" height={4.5 + i * 3.5} rx="1"
          className={`${p?.key === 'urgent' ? 'fill-ln-red' : p?.key === 'high' ? 'fill-ln-orange' : 'fill-ln-t3'} ${i < cheias ? '' : 'opacity-30'}`} />
      ))}
    </svg>
  )
}

export function PrioridadeCampo({ valor, onChange, comTexto = true, className = '' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const p = PRIORIDADES.find((x) => x.key === valor)
  return (
    <>
      <button ref={ref} type="button" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }} className={`inline-flex items-center gap-1.5 rounded-md text-xs ${p ? 'text-ln-t2' : 'text-ln-t4'} ${FOCO} ${className}`} title="Prioridade">
        <PrioridadeIcon valor={valor} />
        {comTexto && <span className="truncate">{p ? p.label : 'sem prioridade'}</span>}
      </button>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={190}>
        <div className="p-1">
          {PRIORIDADES.map((x) => (
            <ItemMenu key={x.key} ativo={x.key === valor} onClick={() => { setOpen(false); onChange(x.key) }}>
              <PrioridadeIcon valor={x.key} />
              {x.label}
            </ItemMenu>
          ))}
          <div className="border-t border-ln-ink/5 my-1" />
          <ItemMenu ativo={!valor} onClick={() => { setOpen(false); onChange(null) }}>
            <PrioridadeIcon valor={null} /> Sem prioridade
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
    <span className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-full ring-1 ring-inset ring-ln-line text-xs text-ln-t3 max-w-full ${className}`} title={texto}>
      <i className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cor || '#87909e' }} />
      <span className="truncate">{texto}</span>
    </span>
  )
}

export function OpcaoCampo({ valor, opcoes, onChange, placeholder = 'não informado', className = '' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const atual = opcoes.find((o) => o.key === valor) || (valor ? { key: valor, cor: '#87909e' } : null)
  return (
    <>
      <button ref={ref} type="button" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }} className={`inline-flex items-center max-w-full rounded-md ${FOCO} ${className}`}>
        {atual ? <Chip texto={atual.key} cor={atual.cor} /> : <span className="text-xs text-ln-t4">{placeholder}</span>}
      </button>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={230}>
        <div className="p-1 overflow-y-auto">
          {opcoes.map((o) => (
            <ItemMenu key={o.key} ativo={o.key === valor} onClick={() => { setOpen(false); onChange(o.key) }}>
              <i className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: o.cor }} />
              <span className="truncate">{o.key}</span>
            </ItemMenu>
          ))}
          {valor && !opcoes.some((o) => o.key === valor) && (
            <ItemMenu ativo onClick={() => setOpen(false)}>
              <i className="w-2 h-2 rounded-full shrink-0 bg-ln-t4" />{valor}
            </ItemMenu>
          )}
          <div className="border-t border-ln-ink/5 my-1" />
          <ItemMenu ativo={!valor} onClick={() => { setOpen(false); onChange(null) }}>
            <X className="w-3.5 h-3.5 text-ln-t4" /> Limpar
          </ItemMenu>
        </div>
      </Popover>
    </>
  )
}

export function TipoTarefaCampo(props) { return <OpcaoCampo opcoes={TIPOS_TAREFA} {...props} /> }
export function DificuldadeCampo(props) { return <OpcaoCampo opcoes={DIFICULDADES} {...props} /> }

// ─── Estimativa ───────────────────────────────────────────────────────────────

export function EstimativaCampo({ valor, onChange, vazio = 'sem estimativa', className = '' }) {
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
        onKeyDown={(e) => { if (e.key === 'Enter') salvar(); if (e.key === 'Escape') { e.stopPropagation(); setEditando(false) } }}
        onClick={(e) => e.stopPropagation()}
        placeholder="ex: 1h 30m"
        className="ln-input !w-20 !h-6 !px-1.5 !text-xs tabular"
      />
    )
  }
  return (
    <button type="button" onClick={abrir} className={`inline-flex items-center gap-1.5 text-xs tabular whitespace-nowrap rounded ${valor ? 'text-ln-t3' : 'text-ln-t4'} hover:text-ln-t1 ${FOCO} ${className}`} title="Estimativa de tempo">
      {(valor || vazio) && <Clock3 className="w-3.5 h-3.5 text-ln-t4" />}
      {valor ? fmtEstimativa(valor) : vazio}
    </button>
  )
}

// ─── Linha "+ Adicionar" ──────────────────────────────────────────────────────

export function AdicionarInline({ onCriar, placeholder = 'Adicionar tarefa', className = '', autoFocus = false }) {
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
      <button type="button" onClick={() => setAberto(true)} className={`inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-xs text-ln-t4 hover:text-ln-t2 hover:bg-ln-ink/[0.03] transition-colors ${FOCO} ${className}`}>
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
          if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); salvar(true) }
          if (e.key === 'Escape') { e.stopPropagation(); setAberto(false); setTitulo('') }
        }}
        onBlur={() => { if (!titulo.trim()) setAberto(false) }}
        placeholder="Nome da tarefa (Enter salva)"
        className="ln-input !h-7 flex-1 min-w-0"
      />
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => salvar(false)} disabled={salvando || !titulo.trim()} className="ln-primary">Salvar</button>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setAberto(false); setTitulo('') }} className="ln-pill">Cancelar</button>
    </div>
  )
}
