// Coluna esquerda do módulo Tarefas: árvore Pastas (clientes) → Listas, no
// visual do Linear (mesma coluna de navegação densa do app).
import { useState, useMemo, useRef } from 'react'
import { ChevronRight, Folder, List, Plus, Search, UserCircle2, MoreHorizontal, Pencil, Archive, X } from 'lucide-react'
import { Popover, FOCO } from './Campos'

function MenuPasta({ onRenomear, onNovaLista, onArquivar }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  return (
    <>
      <button ref={ref} type="button" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }} className="ln-iconbtn !w-6 !h-6 opacity-0 group-hover/pasta:opacity-100 focus-visible:opacity-100" title="Opções" aria-label="Opções da pasta">
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={190} align="right">
        <div className="p-1 text-[13px]">
          <button type="button" onClick={() => { setOpen(false); onNovaLista() }} className="w-full flex items-center gap-2 h-8 px-2.5 rounded-md text-ln-t2 hover:bg-ln-ink/5"><Plus className="w-3.5 h-3.5 text-ln-t4" /> Nova lista</button>
          <button type="button" onClick={() => { setOpen(false); onRenomear() }} className="w-full flex items-center gap-2 h-8 px-2.5 rounded-md text-ln-t2 hover:bg-ln-ink/5"><Pencil className="w-3.5 h-3.5 text-ln-t4" /> Renomear</button>
          <button type="button" onClick={() => { setOpen(false); onArquivar() }} className="w-full flex items-center gap-2 h-8 px-2.5 rounded-md text-ln-t2 hover:bg-ln-ink/5 hover:text-ln-red"><Archive className="w-3.5 h-3.5 text-ln-t4" /> Arquivar</button>
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
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.keyCode === 13) && v.trim()) onOk(v.trim()); if (e.key === 'Escape') { e.stopPropagation(); onCancel() } }}
      onBlur={() => (v.trim() && v.trim() !== inicial ? onOk(v.trim()) : onCancel())}
      placeholder={placeholder}
      onClick={(e) => e.stopPropagation()}
      className="ln-input !h-6 !px-1.5 !text-xs"
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
  const [renomeando, setRenomeando] = useState(null)

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

  function gravar(n) { try { localStorage.setItem('tarefas.expandidas', JSON.stringify([...n])) } catch { /* noop */ } }
  function toggle(id) {
    setExpandidas((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); gravar(n); return n })
  }
  const selPasta = (id) => {
    onSel({ tipo: 'pasta', id })
    setExpandidas((prev) => { if (prev.has(id)) return prev; const n = new Set(prev); n.add(id); gravar(n); return n })
    onFechar?.()
  }
  const selLista = (id) => { onSel({ tipo: 'lista', id }); onFechar?.() }

  const soltas = listasPorPasta.get('__soltas') || []
  const itemCls = (ativo) => `group/pasta w-full flex items-center gap-1 h-7 pl-1 pr-1 rounded-md text-[13px] cursor-pointer transition-colors duration-150 ${ativo ? 'bg-ln-ink/[0.06] text-ln-t1 font-medium' : 'text-ln-t2 hover:bg-ln-ink/[0.03]'} ${FOCO}`
  const listaCls = (ativo) => `group/lista w-full flex items-center gap-1.5 h-7 px-2 rounded-md text-[13px] cursor-pointer transition-colors duration-150 ${ativo ? 'bg-ln-ink/[0.06] text-ln-t1 font-medium' : 'text-ln-t3 hover:bg-ln-ink/[0.03] hover:text-ln-t2'} ${FOCO}`

  const conteudo = (
    <div className="flex flex-col h-full">
      <div className="h-11 shrink-0 flex items-center gap-1.5 px-2 border-b border-ln-ink/5">
        <div className="ln-input !h-7 flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5 text-ln-t4 shrink-0" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pasta ou lista" className="flex-1 min-w-0 bg-transparent outline-none text-xs text-ln-t1 placeholder:text-ln-t4" />
          {busca && <button type="button" onClick={() => setBusca('')} className="text-ln-t4 hover:text-ln-t2" aria-label="Limpar busca"><X className="w-3 h-3" /></button>}
        </div>
        <button type="button" onClick={onFechar} className="ln-iconbtn md:hidden" aria-label="Fechar"><X className="w-4 h-4" /></button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
        <button
          type="button"
          onClick={() => { onSel({ tipo: 'minhas' }); onFechar?.() }}
          className={`w-full flex items-center gap-2 h-7 px-2 rounded-md text-[13px] transition-colors duration-150 ${sel.tipo === 'minhas' ? 'bg-ln-ink/[0.06] text-ln-t1 font-medium' : 'text-ln-t2 hover:bg-ln-ink/[0.03]'} ${FOCO}`}
        >
          <UserCircle2 className="w-4 h-4 shrink-0 text-ln-accent" /> Minhas tarefas
        </button>

        <div className="flex items-center justify-between h-8 px-2 mt-2">
          <span className="text-[11px] font-medium text-ln-t4">Clientes</span>
          <button type="button" onClick={() => setNovaPasta(true)} className="ln-iconbtn !w-6 !h-6" title="Nova pasta" aria-label="Nova pasta"><Plus className="w-3.5 h-3.5" /></button>
        </div>

        {novaPasta && (
          <div className="px-1 py-1">
            <CampoNome placeholder="Nome da pasta" onOk={async (nome) => { setNovaPasta(false); const r = await onCriarPasta(nome); if (r?.data) selPasta(r.data.id) }} onCancel={() => setNovaPasta(false)} />
          </div>
        )}

        {pastasVisiveis.map((p) => {
          const abertaP = expandidas.has(p.id) || !!busca
          const ls = listasPorPasta.get(p.id) || []
          const ativa = sel.tipo === 'pasta' && sel.id === p.id
          const projeto = p.project_id ? projetosMap.get(p.project_id) : null
          return (
            <div key={p.id}>
              <div role="button" tabIndex={0} onClick={() => selPasta(p.id)} onKeyDown={(e) => { if (e.key === 'Enter') selPasta(p.id) }} className={itemCls(ativa)}>
                <button type="button" onClick={(e) => { e.stopPropagation(); toggle(p.id) }} className="ln-iconbtn !w-5 !h-5 !rounded" aria-label={abertaP ? 'Recolher' : 'Expandir'}>
                  <ChevronRight className={`w-3 h-3 transition-transform duration-150 ${abertaP ? 'rotate-90' : ''}`} />
                </button>
                <Folder className="w-3.5 h-3.5 shrink-0 text-ln-t4" />
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
                <div className="ml-[18px] pl-1.5 border-l border-ln-ink/[0.08]">
                  {ls.map((l) => {
                    const ativaL = sel.tipo === 'lista' && sel.id === l.id
                    return (
                      <div key={l.id} role="button" tabIndex={0} onClick={() => selLista(l.id)} onKeyDown={(e) => { if (e.key === 'Enter') selLista(l.id) }} className={listaCls(ativaL)}>
                        <List className="w-3.5 h-3.5 shrink-0 text-ln-t4" />
                        {renomeando?.tipo === 'lista' && renomeando.id === l.id ? (
                          <CampoNome inicial={l.nome} onOk={(nome) => { setRenomeando(null); onAtualizarLista(l.id, { nome }) }} onCancel={() => setRenomeando(null)} />
                        ) : (
                          <span className="flex-1 min-w-0 truncate">{l.nome}</span>
                        )}
                        <button type="button" onClick={(e) => { e.stopPropagation(); setRenomeando({ tipo: 'lista', id: l.id }) }} className="ln-iconbtn !w-5 !h-5 !rounded opacity-0 group-hover/lista:opacity-100 focus-visible:opacity-100" title="Renomear" aria-label="Renomear lista">
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    )
                  })}
                  {novaListaEm === p.id ? (
                    <div className="px-1 py-1">
                      <CampoNome placeholder="Nome da lista" onOk={async (nome) => { setNovaListaEm(null); const r = await onCriarLista(p.id, nome); if (r?.data) selLista(r.data.id) }} onCancel={() => setNovaListaEm(null)} />
                    </div>
                  ) : (
                    <button type="button" onClick={() => setNovaListaEm(p.id)} className={`flex items-center gap-1.5 h-6 px-2 rounded-md text-xs text-ln-t4 hover:text-ln-t2 ${FOCO}`}>
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
            <div className="h-8 px-2 mt-2 flex items-center text-[11px] font-medium text-ln-t4">Listas soltas</div>
            {soltas.map((l) => {
              const ativaL = sel.tipo === 'lista' && sel.id === l.id
              return (
                <div key={l.id} role="button" tabIndex={0} onClick={() => selLista(l.id)} onKeyDown={(e) => { if (e.key === 'Enter') selLista(l.id) }} className={listaCls(ativaL)}>
                  <List className="w-3.5 h-3.5 shrink-0 text-ln-t4" />
                  <span className="flex-1 min-w-0 truncate">{l.nome}</span>
                </div>
              )
            })}
          </>
        )}

        {!pastasVisiveis.length && !soltas.length && (
          <p className="px-3 py-6 text-xs text-ln-t4 text-center">Nenhuma pasta encontrada.</p>
        )}
      </div>
    </div>
  )

  return (
    <>
      <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-ln-ink/5 h-full min-h-0">
        {conteudo}
      </aside>
      {aberta && (
        <div className="md:hidden absolute inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/30" onClick={onFechar} aria-hidden="true" />
          <aside className="relative z-10 w-72 h-full bg-ln-panel border-r border-ln-ink/[0.08] shadow-2xl">{conteudo}</aside>
        </div>
      )}
    </>
  )
}
