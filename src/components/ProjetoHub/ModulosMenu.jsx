// Botão "Buscar" no fim do menu da página do cliente (MenuCliente): abre um dropdown com
// busca por nome em todos os itens dos menus (abas do hub e módulos).
import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, CheckCircle2 } from 'lucide-react'

const normalizar = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function ModulosMenu({ modulos = [], onAbrir }) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [cursor, setCursor] = useState(0)
  const ref = useRef(null)
  const inputRef = useRef(null)
  const listaRef = useRef(null)

  const filtrados = useMemo(() => {
    const q = normalizar(busca.trim())
    return q ? modulos.filter((m) => normalizar(`${m.label} ${m.grupo || ''}`).includes(q)) : modulos
  }, [modulos, busca])

  function alternar() {
    if (!aberto) { setBusca(''); setCursor(0) }
    setAberto((v) => !v)
  }

  useEffect(() => {
    if (!aberto) return
    const t = setTimeout(() => inputRef.current?.focus(), 0)
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false) }
    document.addEventListener('mousedown', h)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', h) }
  }, [aberto])

  // Mantém o item destacado visível ao navegar pelo teclado
  useEffect(() => {
    listaRef.current?.querySelector(`[data-idx="${cursor}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  function escolher(m) {
    if (!m) return
    setAberto(false)
    onAbrir(m.id)
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, filtrados.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); escolher(filtrados[cursor]) }
    else if (e.key === 'Escape') { e.preventDefault(); setAberto(false) }
  }

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={alternar}
        className={`flex items-center gap-1.5 px-3 py-2.5 text-sm whitespace-nowrap transition-colors ${aberto ? 'text-rl-text font-semibold' : 'text-rl-subtle hover:text-rl-text'}`}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        title="Buscar módulo"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="hidden 2xl:inline">Buscar</span>
      </button>
      {aberto && (
        <div className="absolute right-0 mt-1 w-72 glass-card border border-rl-border shadow-xl z-30 p-1.5">
          <div className="relative mb-1">
            <Search className="w-4 h-4 text-rl-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={inputRef}
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setCursor(0) }}
              onKeyDown={onKeyDown}
              placeholder="Buscar no menu…"
              className="input-field !py-2 !pl-9 !pr-3"
            />
          </div>
          <div ref={listaRef} className="max-h-80 overflow-y-auto" role="listbox">
            {filtrados.length === 0 ? (
              <p className="text-xs text-rl-muted text-center py-4">Nenhum módulo encontrado</p>
            ) : filtrados.map((m, i) => {
              const Icon = m.icon
              const ativo = i === cursor
              return (
                <button
                  key={m.id}
                  data-idx={i}
                  role="option"
                  aria-selected={ativo}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => escolher(m)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors ${ativo ? 'bg-rl-surface text-rl-text' : 'text-rl-subtle'}`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${m.color || 'text-rl-muted'}`} />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate">{m.label}</span>
                    {m.grupo && <span className="block truncate text-[10px] text-rl-muted">{m.grupo}</span>}
                  </span>
                  {m.filled && <CheckCircle2 className="w-3 h-3 shrink-0 text-rl-green opacity-80" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
