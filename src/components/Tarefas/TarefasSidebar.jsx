// Coluna esquerda do módulo Tarefas: árvore Pastas (clientes) → Listas, no
// visual do Linear (mesma coluna de navegação densa do app).
import { useState, useMemo, useRef, Fragment } from 'react'
import { ChevronRight, List, Plus, Search, User, MoreHorizontal, Pencil, Archive, X, Inbox, Repeat, Box, ListChecks, MessageSquare, CalendarCheck, FileText, BarChart3, EyeOff, Globe } from 'lucide-react'
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

const CORES_PASTA = ['#2A25F0', '#518CFF', '#1F8A5B', '#E2564B', '#C99A2E', '#8FA6FF', '#14049C', '#5A6072']
function corDaPasta(nome = '') {
  let h = 0
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) >>> 0
  return CORES_PASTA[h % CORES_PASTA.length]
}

function NavItem({ icon: Icon, ativo, onClick, children, badge }) {
  return (
    <button type="button" onClick={onClick} className={`w-full flex items-center gap-2.5 h-9 px-2.5 rounded-lg text-[14px] font-medium text-left transition-colors duration-150 ${ativo ? 'bg-ln-accent/10 text-ln-accent' : 'text-ln-t2 hover:bg-ln-ink/[0.04]'} ${FOCO}`}>
      <Icon className="w-[18px] h-[18px] shrink-0" />
      <span className="truncate">{children}</span>
      {badge > 0 && <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-ln-brand text-white text-[11.5px] font-bold inline-flex items-center justify-center tabular">{badge}</span>}
    </button>
  )
}

const SECAO = 'px-2.5 pt-4 pb-1.5 text-[11px] tracking-[0.14em] uppercase font-bold text-ln-t4'

export default function TarefasSidebar({
  pastas, listas, projetos, sel, onSel,
  onCriarPasta, onCriarLista, onAtualizarPasta, onAtualizarLista,
  aberta, onFechar,
  nav = { aba: 'tarefas', onAba: () => {}, intake: 0 }, views = [], userId, onAplicarView, onExcluirView, onAlternarAcessoView, contagem = {},
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

  // Pastas do space Clientes ficam na seção de sempre; as dos outros spaces do
  // ClickUp (Operações, PROMPTS…) ganham uma seção própria com o nome do space.
  const pastasClientes = useMemo(() => pastasVisiveis.filter((p) => !p.espaco || p.espaco === 'Clientes'), [pastasVisiveis])
  const outrosEspacos = useMemo(() => {
    const m = new Map()
    for (const p of pastasVisiveis) { if (!p.espaco || p.espaco === 'Clientes') continue; if (!m.has(p.espaco)) m.set(p.espaco, []); m.get(p.espaco).push(p) }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
  }, [pastasVisiveis])

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
  const itemCls = (ativo) => `group/pasta w-full flex items-center gap-1 h-7 pl-1 pr-1 rounded-md text-[13px] cursor-pointer transition-colors duration-150 ${ativo ? 'bg-ln-accent/10 text-ln-accent font-semibold' : 'text-ln-t2 hover:bg-ln-ink/[0.04]'} ${FOCO}`
  const listaCls = (ativo) => `group/lista w-full flex items-center gap-1.5 h-7 px-2 rounded-md text-[13px] cursor-pointer transition-colors duration-150 ${ativo ? 'bg-ln-accent/10 text-ln-accent font-semibold' : 'text-ln-t3 hover:bg-ln-ink/[0.04] hover:text-ln-t2'} ${FOCO}`

  // Uma pasta da árvore (usada pela seção Clientes e pelas seções dos outros spaces).
  const renderPasta = (p) => {
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
                <i className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: corDaPasta(p.nome) }} />
                {renomeando?.tipo === 'pasta' && renomeando.id === p.id ? (
                  <CampoNome inicial={p.nome} onOk={(nome) => { setRenomeando(null); onAtualizarPasta(p.id, { nome }) }} onCancel={() => setRenomeando(null)} />
                ) : (
                  <span className="flex-1 min-w-0 truncate" title={projeto ? `${p.nome} · ${projeto.companyName || ''}` : p.nome}>{p.nome}</span>
                )}
                {contagem[p.id] > 0 && <span className="text-xs text-ln-t4 tabular">{contagem[p.id]}</span>}
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
  }

  const conteudo = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-[18px] pt-[18px] pb-3">
        <img src="/vertatask-simbolo.png" alt="" className="w-[26px] h-[26px]" />
        <span className="vt-display font-bold text-[17px] text-ln-t1 tracking-tight">Verta<span className="font-medium text-ln-accent">Task</span></span>
        <button type="button" onClick={onFechar} className="ln-iconbtn md:hidden ml-auto" aria-label="Fechar"><X className="w-4 h-4" /></button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2.5 pb-3">
        <NavItem icon={Inbox} ativo={nav.aba === 'intake'} onClick={() => { nav.onAba('intake'); onFechar?.() }} badge={nav.intake}>Intake</NavItem>
        <NavItem icon={User} ativo={nav.aba === 'tarefas' && sel.tipo === 'minhas'} onClick={() => { onSel({ tipo: 'minhas' }); onFechar?.() }}>Minhas tarefas</NavItem>
        <NavItem icon={ListChecks} ativo={nav.aba === 'tarefas' && sel.tipo === 'todas'} onClick={() => { onSel({ tipo: 'todas' }); onFechar?.() }}>Todas as tarefas</NavItem>
        <NavItem icon={Repeat} ativo={nav.aba === 'ciclos'} onClick={() => { nav.onAba('ciclos'); onFechar?.() }}>Cycles</NavItem>
        <NavItem icon={Box} ativo={nav.aba === 'modulos'} onClick={() => { nav.onAba('modulos'); onFechar?.() }}>Modules</NavItem>
        <NavItem icon={FileText} ativo={nav.aba === 'paginas'} onClick={() => { nav.onAba('paginas'); onFechar?.() }}>Pages</NavItem>
        <NavItem icon={BarChart3} ativo={nav.aba === 'analytics'} onClick={() => { nav.onAba('analytics'); onFechar?.() }}>Analytics</NavItem>
        <NavItem icon={CalendarCheck} ativo={nav.aba === 'atividades'} onClick={() => { nav.onAba('atividades'); onFechar?.() }}>Atividades</NavItem>
        <NavItem icon={MessageSquare} ativo={nav.aba === 'chat'} onClick={() => { nav.onAba('chat'); onFechar?.() }} badge={nav.chat}>Chat</NavItem>

        <div className={SECAO}>Views salvas</div>
        {views.length === 0 && <p className="px-2.5 text-xs text-ln-t4">Nenhuma ainda. Use Salvar view na barra de filtros.</p>}
        {views.map((v) => (
          <div key={v.id} className="group/view flex items-center">
            <button type="button" onClick={() => { onAplicarView?.(v); onFechar?.() }} className={`flex-1 min-w-0 flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-[13.5px] text-ln-t2 hover:bg-ln-ink/[0.04] ${FOCO}`}>
              <i className="w-2 h-2 rounded-full shrink-0 bg-ln-blue" /><span className="truncate">{v.nome}</span>
              {v.acesso === 'privada' && <EyeOff className="w-3 h-3 text-ln-t4 shrink-0" aria-label="Só você vê" />}
            </button>
            {v.dono_id === userId && (
              <>
                <button type="button" onClick={() => onAlternarAcessoView?.(v)} className="ln-iconbtn !w-6 !h-6 opacity-0 group-hover/view:opacity-100 focus-visible:opacity-100" title={v.acesso === 'publica' ? 'Compartilhada: clique para deixar só para você' : 'Só sua: clique para compartilhar'} aria-label="Mudar quem vê a view">{v.acesso === 'publica' ? <Globe className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}</button>
                <button type="button" onClick={() => onExcluirView?.(v.id)} className="ln-iconbtn !w-6 !h-6 opacity-0 group-hover/view:opacity-100 focus-visible:opacity-100" title="Remover view" aria-label={`Remover a view ${v.nome}`}><X className="w-3 h-3" /></button>
              </>
            )}
          </div>
        ))}

        <div className={`${SECAO} flex items-center justify-between !pr-1`}>
          Clientes
          <button type="button" onClick={() => setNovaPasta(true)} className="ln-iconbtn !w-6 !h-6" title="Nova pasta" aria-label="Nova pasta"><Plus className="w-3.5 h-3.5" /></button>
        </div>
        <div className="ln-input !h-8 flex items-center gap-1.5 mb-1.5">
          <Search className="w-3.5 h-3.5 text-ln-t4 shrink-0" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente ou lista" className="flex-1 min-w-0 bg-transparent outline-none text-xs text-ln-t1 placeholder:text-ln-t4" />
          {busca && <button type="button" onClick={() => setBusca('')} className="text-ln-t4 hover:text-ln-t2" aria-label="Limpar busca"><X className="w-3 h-3" /></button>}
        </div>

        {novaPasta && (
          <div className="px-1 py-1">
            <CampoNome placeholder="Nome da pasta" onOk={async (nome) => { setNovaPasta(false); const r = await onCriarPasta(nome); if (r?.data) selPasta(r.data.id) }} onCancel={() => setNovaPasta(false)} />
          </div>
        )}

        {pastasClientes.map(renderPasta)}
        {outrosEspacos.map(([nome, ps]) => (
          <Fragment key={nome}>
            <div className={SECAO}>{nome}</div>
            {ps.map(renderPasta)}
          </Fragment>
        ))}

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
      <aside className="hidden md:flex flex-col w-[248px] shrink-0 border-r border-ln-ink/[0.08] h-full min-h-0 bg-ln-panel">
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
