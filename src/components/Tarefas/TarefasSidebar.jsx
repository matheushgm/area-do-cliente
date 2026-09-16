// Barra lateral do módulo Tarefas: árvore Pastas (clientes) → Listas, como o
// painel esquerdo do ClickUp. Cada pasta expande para mostrar as listas.
import { useState, useMemo, useRef } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, List, Plus, Search, UserCircle2, MoreHorizontal, Pencil, Archive, X } from 'lucide-react'
import { Popover } from './Campos'

function MenuPasta({ onRenomear, onNovaLista, onArquivar }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  return (
    <>
      <button ref={ref} type="button" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }} className="p-0.5 rounded text-rl-muted hover:text-rl-text hover:bg-rl-border/60 opacity-0 group-hover/pasta:opacity-100 transition" title="Opções">
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={190}>
        <div className="py-1 text-[13px]">
          <button type="button" onClick={() => { setOpen(false); onNovaLista() }} className="w-full flex items-center gap-2 px-3 py-1.5 text-rl-subtle hover:bg-rl-surface hover:text-rl-text"><Plus className="w-3.5 h-3.5" /> Nova lista</button>
          <button type="button" onClick={() => { setOpen(false); onRenomear() }} className="w-full flex items-center gap-2 px-3 py-1.5 text-rl-subtle hover:bg-rl-surface hover:text-rl-text"><Pencil className="w-3.5 h-3.5" /> Renomear</button>
          <button type="button" onClick={() => { setOpen(false); onArquivar() }} className="w-full flex items-center gap-2 px-3 py-1.5 text-rl-subtle hover:bg-rl-surface hover:text-red-500"><Archive className="w-3.5 h-3.5" /> Arquivar</button>
        </div>
      </Popover>
    </>
  )
}

function CampoNome({ inicial = '', placeholder, onOk, onCancel }) {
  const [v, setV] = useState(inicial)
  return (
    <input
      autoFocus
      value={v}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.keyCode === 13) && v.trim()) onOk(v.trim()); if (e.key === 'Escape') onCancel() }}
      onBlur={() => (v.trim() && v.trim() !== inicial ? onOk(v.trim()) : onCancel())}
      placeholder={placeholder}
      onClick={(e) => e.stopPropagation()}
      className="w-full h-6 px-1.5 rounded border border-rl-purple bg-rl-surface text-[13px] text-rl-text outline-none"
    />
  )
}

export default function TarefasSidebar({
  pastas, listas, projetos, sel, onSel,
  onCriarPasta, onCriarLista, onAtualizarPasta, onAtualizarLista,
  aberta, onFechar,
}) {
  const [busca, setBusca] = useState('')
  const [expandidas, setExpandidas] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('tarefas.expandidas') || '[]')) } catch { return new Set() }
  })
  const [novaPasta, setNovaPasta] = useState(false)
  const [novaListaEm, setNovaListaEm] = useState(null)
  const [renomeando, setRenomeando] = useState(null) // { tipo:'pasta'|'lista', id }

  const listasPorPasta = useMemo(() => {
    const m = new Map()
    for (const l of listas) {
      const k = l.pasta_id || '__soltas'
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(l)
    }
    return m
  }, [listas])

  const projetosMap = useMemo(() => new Map((projetos || []).map((p) => [p.id, p])), [projetos])

  const pastasVisiveis = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const ordenadas = [...pastas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    if (!q) return ordenadas
    return ordenadas.filter((p) => p.nome.toLowerCase().includes(q) || (listasPorPasta.get(p.id) || []).some((l) => l.nome.toLowerCase().includes(q)))
  }, [pastas, busca, listasPorPasta])

  function toggle(id) {
    setExpandidas((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      try { localStorage.setItem('tarefas.expandidas', JSON.stringify([...n])) } catch { /* noop */ }
      return n
    })
  }

  const selPasta = (id) => {
    onSel({ tipo: 'pasta', id })
    setExpandidas((prev) => { if (prev.has(id)) return prev; const n = new Set(prev); n.add(id); try { localStorage.setItem('tarefas.expandidas', JSON.stringify([...n])) } catch { /* noop */ } return n })
    onFechar?.()
  }
  const selLista = (id) => { onSel({ tipo: 'lista', id }); onFechar?.() }

  const soltas = listasPorPasta.get('__soltas') || []

  const conteudo = (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 h-8 px-2.5 rounded-lg bg-rl-surface border border-rl-border">
          <Search className="w-3.5 h-3.5 text-rl-muted shrink-0" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pasta ou lista" className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-rl-text placeholder:text-rl-muted" />
          {busca && <button type="button" onClick={() => setBusca('')} className="text-rl-muted hover:text-rl-text"><X className="w-3.5 h-3.5" /></button>}
        </div>
      </div>

      <nav className="px-2 pb-2">
        <button
          type="button"
          onClick={() => { onSel({ tipo: 'minhas' }); onFechar?.() }}
          className={`w-full flex items-center gap-2 h-8 px-2 rounded-lg text-[13px] font-medium transition ${sel.tipo === 'minhas' ? 'bg-rl-purple/12 text-rl-purple' : 'text-rl-subtle hover:bg-rl-surface hover:text-rl-text'}`}
        >
          <UserCircle2 className="w-4 h-4 shrink-0" /> Minhas tarefas
        </button>
      </nav>

      <div className="flex items-center justify-between px-3.5 pt-1 pb-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-rl-muted">Clientes</span>
        <button type="button" onClick={() => setNovaPasta(true)} className="p-1 rounded text-rl-muted hover:text-rl-text hover:bg-rl-surface" title="Nova pasta">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4 scroll-hide">
        {novaPasta && (
          <div className="px-2 py-1">
            <CampoNome placeholder="Nome da pasta" onOk={async (nome) => { setNovaPasta(false); const r = await onCriarPasta(nome); if (r?.data) { toggle(r.data.id); selPasta(r.data.id) } }} onCancel={() => setNovaPasta(false)} />
          </div>
        )}

        {pastasVisiveis.map((p) => {
          const abertaP = expandidas.has(p.id) || !!busca
          const ls = listasPorPasta.get(p.id) || []
          const ativa = sel.tipo === 'pasta' && sel.id === p.id
          const projeto = p.project_id ? projetosMap.get(p.project_id) : null
          return (
            <div key={p.id} className="mb-0.5">
              <div
                role="button"
                tabIndex={0}
                onClick={() => selPasta(p.id)}
                onKeyDown={(e) => { if ((e.key === 'Enter' || e.keyCode === 13)) selPasta(p.id) }}
                className={`group/pasta flex items-center gap-1 h-8 pl-1 pr-1.5 rounded-lg text-[13px] cursor-pointer transition ${ativa ? 'bg-rl-purple/12 text-rl-purple font-semibold' : 'text-rl-text hover:bg-rl-surface'}`}
              >
                <button type="button" onClick={(e) => { e.stopPropagation(); toggle(p.id) }} className="p-0.5 rounded text-rl-muted hover:text-rl-text" aria-label={abertaP ? 'Recolher' : 'Expandir'}>
                  {abertaP ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
                {abertaP ? <FolderOpen className="w-4 h-4 shrink-0 text-rl-gold" /> : <Folder className="w-4 h-4 shrink-0 text-rl-gold" />}
                {renomeando?.tipo === 'pasta' && renomeando.id === p.id ? (
                  <CampoNome inicial={p.nome} onOk={(nome) => { setRenomeando(null); onAtualizarPasta(p.id, { nome }) }} onCancel={() => setRenomeando(null)} />
                ) : (
                  <span className="flex-1 min-w-0 truncate" title={projeto ? `${p.nome} · ${projeto.companyName || ''}` : p.nome}>{p.nome}</span>
                )}
                <MenuPasta
                  onRenomear={() => setRenomeando({ tipo: 'pasta', id: p.id })}
                  onNovaLista={() => { if (!expandidas.has(p.id)) toggle(p.id); setNovaListaEm(p.id) }}
                  onArquivar={() => { if (window.confirm(`Arquivar a pasta "${p.nome}" e todas as listas dela?`)) onAtualizarPasta(p.id, { arquivada: true }) }}
                />
              </div>
              {abertaP && (
                <div className="ml-4 pl-2 border-l border-rl-border/70">
                  {ls.map((l) => {
                    const ativaL = sel.tipo === 'lista' && sel.id === l.id
                    return (
                      <div
                        key={l.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => selLista(l.id)}
                        onKeyDown={(e) => { if ((e.key === 'Enter' || e.keyCode === 13)) selLista(l.id) }}
                        className={`group/lista flex items-center gap-1.5 h-7 px-2 rounded-lg text-[13px] cursor-pointer transition ${ativaL ? 'bg-rl-purple/12 text-rl-purple font-semibold' : 'text-rl-subtle hover:bg-rl-surface hover:text-rl-text'}`}
                      >
                        <List className="w-3.5 h-3.5 shrink-0 opacity-70" />
                        {renomeando?.tipo === 'lista' && renomeando.id === l.id ? (
                          <CampoNome inicial={l.nome} onOk={(nome) => { setRenomeando(null); onAtualizarLista(l.id, { nome }) }} onCancel={() => setRenomeando(null)} />
                        ) : (
                          <span className="flex-1 min-w-0 truncate">{l.nome}</span>
                        )}
                        <button type="button" onClick={(e) => { e.stopPropagation(); setRenomeando({ tipo: 'lista', id: l.id }) }} className="p-0.5 rounded text-rl-muted hover:text-rl-text opacity-0 group-hover/lista:opacity-100" title="Renomear">
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    )
                  })}
                  {novaListaEm === p.id ? (
                    <div className="px-2 py-1">
                      <CampoNome placeholder="Nome da lista" onOk={async (nome) => { setNovaListaEm(null); const r = await onCriarLista(p.id, nome); if (r?.data) selLista(r.data.id) }} onCancel={() => setNovaListaEm(null)} />
                    </div>
                  ) : (
                    <button type="button" onClick={() => setNovaListaEm(p.id)} className="flex items-center gap-1.5 h-6 px-2 text-[12px] text-rl-muted hover:text-rl-text">
                      <Plus className="w-3 h-3" /> Nova lista
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {soltas.length > 0 && (
          <>
            <div className="px-1.5 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-rl-muted">Listas soltas</div>
            {soltas.map((l) => {
              const ativaL = sel.tipo === 'lista' && sel.id === l.id
              return (
                <div key={l.id} role="button" tabIndex={0} onClick={() => selLista(l.id)} onKeyDown={(e) => { if ((e.key === 'Enter' || e.keyCode === 13)) selLista(l.id) }}
                  className={`flex items-center gap-1.5 h-7 px-2 rounded-lg text-[13px] cursor-pointer transition ${ativaL ? 'bg-rl-purple/12 text-rl-purple font-semibold' : 'text-rl-subtle hover:bg-rl-surface hover:text-rl-text'}`}>
                  <List className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <span className="flex-1 min-w-0 truncate">{l.nome}</span>
                </div>
              )
            })}
          </>
        )}

        {!pastasVisiveis.length && !soltas.length && (
          <p className="px-3 py-6 text-xs text-rl-muted text-center">Nenhuma pasta encontrada.</p>
        )}
      </div>
    </div>
  )

  return (
    <>
      <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-rl-border bg-rl-card/60 h-full min-h-0">
        {conteudo}
      </aside>
      {aberta && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50" onClick={onFechar} />
          <aside className="relative z-10 w-72 h-full bg-rl-card border-r border-rl-border animate-slide-in">{conteudo}</aside>
        </div>
      )}
    </>
  )
}
