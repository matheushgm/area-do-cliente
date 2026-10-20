// Visualização "Lista" com a MESMA cara da lista do ClickUp (pedido do Matheus,
// 2026-10-18): grupos por data de vencimento ("Em atraso 47"), cabeçalho de
// colunas em cada grupo, linhas finas separadas por borda, e as colunas na
// ordem do ClickUp: Nome · Status · Tipo de tarefa · Responsável · Data criada
// · Data de vencimento · Prioridade · Sprints · Estimativa de tempo · Cliente. Edição inline continua em cada célula (Popovers de
// Campos.jsx). Subtarefas indentadas abaixo do pai quando expandidas.
import { useState, useRef } from 'react'
import { ChevronRight, ChevronDown, CornerDownRight, MessageSquare, ListChecks, GripVertical, Plus, MoreHorizontal, Flag, Hourglass, AlignLeft, Pencil, Link2 } from 'lucide-react'
import { ordenarItens, fmtDataNumerica, fmtVencimentoClickUp, progressoChecklists, rotuloStatus, PRIORIDADES, TIPOS_TAREFA, pessoasDaTarefa } from '../../lib/tarefas'
import {
  StatusCampo, StatusIcon, ResponsavelCampo, DataCampo, PrioridadeCampo, TipoTarefaCampo, EstimativaCampo, AdicionarInline, Popover, ItemMenu, FOCO,
} from './Campos'

// ── Colunas (larguras fixas como no ClickUp; o Nome ocupa o resto) ────────────
const COLS = {
  cheia: [
    { k: 'status',     label: 'Status',              w: 140 },
    { k: 'tipo',       label: 'Tipo de tarefa',      w: 140 },
    { k: 'resp',       label: 'Responsável',         w: 140 },
    { k: 'criada',     label: 'Data criada',         w: 140 },
    { k: 'venc',       label: 'Data de vencimento',  w: 140 },
    { k: 'prio',       label: 'Prioridade',          w: 140 },
    { k: 'sprint',     label: 'Sprints',             w: 160 },
    { k: 'estim',      label: 'Estimativa de tempo', w: 140 },
    { k: 'cliente',    label: 'Cliente',             w: 140 },
  ],
  compacta: [
    { k: 'status',     label: 'Status',              w: 130 },
    { k: 'resp',       label: 'Responsável',         w: 100 },
    { k: 'venc',       label: 'Data de vencimento',  w: 120 },
    { k: 'prio',       label: 'Prioridade',          w: 110 },
    { k: 'estim',      label: 'Estimativa',          w: 100 },
  ],
}
const grid = (cols) => `minmax(420px, 1fr) ${cols.map((c) => `${c.w}px`).join(' ')} 40px`

// ── Células no estilo ClickUp ─────────────────────────────────────────────────

const hex = (c) => (c || '#87909e')
function corTexto(bg) {
  // texto escuro em fundos claros (pills de tipo de tarefa), branco nos escuros
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(bg || '')
  if (!m) return '#fff'
  const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i], 16))
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#1f2330' : '#fff'
}

/** Pill de status preenchida: "A FAZER" azul, "BACKLOG" cinza-claro, etc. */
function StatusPillCU({ status, statuses }) {
  const s = statuses?.find((x) => x.key === status) || { key: status, label: rotuloStatus(status), cor: '#87909e', tipo: 'custom' }
  const aberto = s.tipo === 'open'
  const label = (s.label || rotuloStatus(s.key)).replace(/^[^\p{L}\p{N}]+/u, '')
  return (
    <span
      className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-md text-[11px] font-bold uppercase tracking-wide whitespace-nowrap max-w-full"
      style={aberto ? { background: 'rgb(var(--ln-level2))', color: 'rgb(var(--ln-t2))' } : { background: hex(s.cor), color: '#fff' }}
      title={s.label || rotuloStatus(s.key)}
    >
      <StatusIcon status={status} statuses={statuses} size={12} className={aberto ? '' : '!text-white'} />
      <span className="truncate">{label}</span>
    </span>
  )
}

function TipoPillCU({ valor }) {
  if (!valor) return <span className="text-[13px] text-ln-t4 pl-1">–</span>
  const o = TIPOS_TAREFA.find((t) => t.key === valor)
  const bg = hex(o?.cor)
  return (
    <span className="inline-flex items-center gap-1 h-[22px] pl-2 pr-1.5 rounded-md text-xs font-medium whitespace-nowrap max-w-full" style={{ background: bg, color: corTexto(bg) }} title={valor}>
      <span className="truncate">{valor}</span>
      <ChevronDown className="w-3 h-3 shrink-0 opacity-70" />
    </span>
  )
}

const COR_FLAG = { urgent: '#f50000', high: '#ffcc00', normal: '#6fddff', low: '#d8d8d8' }
function PrioridadeCU({ valor }) {
  const p = PRIORIDADES.find((x) => x.key === valor)
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap ${p ? 'text-ln-t2' : 'text-ln-t4'}`} title={p ? p.label : 'Sem prioridade'}>
      <Flag className="w-3.5 h-3.5 shrink-0" style={p ? { color: COR_FLAG[p.key], fill: COR_FLAG[p.key] } : { color: 'rgb(var(--ln-t4))' }} />
      {p && <span>{p.label}</span>}
    </span>
  )
}

function SprintCampo({ item, ciclos, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const atual = (ciclos || []).find((c) => c.id === item.ciclo_id)
  return (
    <>
      <button ref={ref} type="button" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }} className={`inline-flex items-center h-[22px] px-2 rounded-md text-xs whitespace-nowrap max-w-full ${atual ? 'bg-ln-accent/10 text-ln-accent font-medium' : 'ring-1 ring-inset ring-ln-line text-ln-t3 hover:bg-ln-level2'} ${FOCO}`} title={atual ? `Sprint: ${atual.nome}` : 'Adicionar ao sprint'}>
        <span className="truncate">{atual ? atual.nome : 'Adicionar ao sprint'}</span>
      </button>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={240}>
        <div className="p-1 overflow-y-auto">
          {(ciclos || []).length === 0 && <p className="px-2 py-1.5 text-xs text-ln-t4">Nenhum cycle criado ainda.</p>}
          {(ciclos || []).map((c) => (
            <ItemMenu key={c.id} ativo={c.id === item.ciclo_id} onClick={() => { setOpen(false); onChange(c.id) }}>
              <span className="truncate">{c.nome}</span>
            </ItemMenu>
          ))}
          {item.ciclo_id && (<><div className="border-t border-ln-ink/5 my-1" /><ItemMenu onClick={() => { setOpen(false); onChange(null) }}>Remover do sprint</ItemMenu></>)}
        </div>
      </Popover>
    </>
  )
}

function ClientePillCU({ nome }) {
  if (!nome) return <span className="text-[13px] text-ln-t4 pl-1">–</span>
  return (
    <span className="inline-flex items-center gap-1 h-[22px] pl-2 pr-1.5 rounded-md text-xs font-semibold text-white whitespace-nowrap max-w-full" style={{ background: '#1b5cff' }} title={nome}>
      <span className="truncate">{nome}</span>
      <ChevronDown className="w-3 h-3 shrink-0 opacity-80" />
    </span>
  )
}

function ResponsavelCU({ item, ctx }) {
  const pessoas = pessoasDaTarefa(item, ctx.membrosMap)
  return (
    <ResponsavelCampo
      item={item} membros={ctx.membros} membrosMap={ctx.membrosMap} size={22} max={2}
      onChange={(ids, extra) => ctx.onAtualizar(item.id, extra ? { responsaveis: ids, responsaveis_extra: extra } : { responsaveis: ids })}
      className={pessoas.length ? '' : 'opacity-70'}
    />
  )
}

// ── Linha ─────────────────────────────────────────────────────────────────────

function Celula({ k, item, ctx }) {
  const { statuses, onAtualizar, onMudarStatus } = ctx
  switch (k) {
    case 'status': return <StatusCampo item={item} statuses={statuses} onChange={(s) => onMudarStatus(item, s)} modo="custom" render={<StatusPillCU status={item.status} statuses={statuses} />} />
    case 'tipo': return <TipoTarefaCampo valor={item.tipo_tarefa} onChange={(v) => onAtualizar(item.id, { tipo_tarefa: v })} render={<TipoPillCU valor={item.tipo_tarefa} />} />
    case 'resp': return <ResponsavelCU item={item} ctx={ctx} />
    case 'criada': return <span className="text-[13px] text-ln-t2 tabular whitespace-nowrap">{fmtDataNumerica(item.created_at)}</span>
    case 'venc': {
      const { texto, classe } = fmtVencimentoClickUp(item.data_vencimento, item)
      return <DataCampo valor={item.data_vencimento} item={item} placeholder="" onChange={(v) => onAtualizar(item.id, { data_vencimento: v })} render={<span className={`text-[13px] tabular whitespace-nowrap ${classe}`}>{texto}</span>} />
    }
    case 'prio': return <PrioridadeCampo valor={item.prioridade} onChange={(v) => onAtualizar(item.id, { prioridade: v })} render={<PrioridadeCU valor={item.prioridade} />} />
    case 'sprint': return <SprintCampo item={item} ciclos={ctx.ciclos} onChange={(id) => onAtualizar(item.id, { ciclo_id: id })} />
    case 'estim': return (
      <span className="inline-flex items-center gap-1.5 text-[13px] text-ln-t2 tabular whitespace-nowrap">
        <Hourglass className="w-3.5 h-3.5 text-ln-t4 shrink-0" />
        <EstimativaCampo valor={item.estimativa_min} vazio="" onChange={(v) => onAtualizar(item.id, { estimativa_min: v })} className="!text-[13px] [&_svg]:hidden" />
      </span>
    )
    case 'cliente': {
      const lista = ctx.listasMap?.get(item.lista_id)
      const pasta = lista ? ctx.pastasMap?.get(lista.pasta_id) : null
      const projeto = pasta?.project_id ? ctx.projetosMap?.get(pasta.project_id) : null
      return <ClientePillCU nome={projeto?.company_name || projeto?.companyName || pasta?.nome || null} />
    }
    default: return null
  }
}

function Linha({ item, sub = false, filhos = [], expandido, onToggle, ctx, cols, denso }) {
  const { statuses, onAbrir, onMudarStatus, contagemComentarios, selecionadaId } = ctx
  const check = progressoChecklists(item.checklists)
  const nComent = contagemComentarios?.[item.id] || 0
  const concluida = item.status_tipo === 'closed'
  const selecionada = selecionadaId === item.id
  return (
    <div
      role="row"
      tabIndex={0}
      onClick={() => onAbrir(item.id)}
      onKeyDown={(e) => { if (e.key === 'Enter') onAbrir(item.id) }}
      aria-current={selecionada ? 'true' : undefined}
      className={`group/linha grid items-center ${denso ? 'h-[30px]' : 'h-[34px]'} border-b border-ln-line/70 cursor-pointer ${FOCO} ${selecionada ? 'bg-ln-level2' : 'hover:bg-ln-level2/60'}`}
      style={{ gridTemplateColumns: grid(cols) }}
    >
      {/* Nome: congelada à esquerda ao rolar (como no ClickUp). O fundo precisa ser
          opaco, então a cor de hover/seleção entra por um overlay atrás do conteúdo. */}
      <div className={`sticky left-0 z-[1] bg-ln-panel relative flex items-center gap-1 min-w-0 h-full pr-3 ${sub ? 'pl-9' : 'pl-2'}`}>
        <span aria-hidden="true" className={`absolute inset-0 -z-10 ${selecionada ? 'bg-ln-level2' : 'group-hover/linha:bg-ln-level2/60'}`} />
        <span className="hidden sm:inline-flex items-center gap-0.5 w-9 shrink-0 opacity-0 group-hover/linha:opacity-100 transition-opacity">
          <GripVertical className="w-3.5 h-3.5 text-ln-t4" />
          <input type="checkbox" className="w-3 h-3 accent-[#1b5cff]" onClick={(e) => e.stopPropagation()} aria-label="Selecionar" />
        </span>
        <span className="inline-flex items-center justify-center w-4 h-4 shrink-0">
          {!sub && filhos.length > 0 ? (
            <button type="button" onClick={(e) => { e.stopPropagation(); onToggle() }} className="ln-iconbtn !w-4 !h-4 !rounded" title={`${filhos.length} subtarefa(s)`} aria-label={expandido ? 'Recolher subtarefas' : 'Expandir subtarefas'}>
              <ChevronRight className={`w-3 h-3 transition-transform duration-150 ${expandido ? 'rotate-90' : ''}`} />
            </button>
          ) : null}
        </span>
        <StatusCampo item={item} statuses={statuses} modo="icon" onChange={(s) => onMudarStatus(item, s)} className="shrink-0 mr-1.5" />
        <span className={`text-[13px] truncate min-w-0 ${concluida ? 'text-ln-t4 line-through' : 'text-ln-t1'}`} title={item.titulo}>{item.titulo}</span>
        <span className="flex items-center gap-2 text-[11px] text-ln-t4 shrink-0 tabular ml-1.5">
          {!sub && filhos.length > 0 && <span className="inline-flex items-center gap-0.5" title="Subtarefas"><CornerDownRight className="w-3 h-3" />{filhos.length}</span>}
          {item.descricao && item.descricao.trim() && <AlignLeft className="w-3 h-3" aria-label="Tem descrição" />}
          {check.total > 0 && <span className="inline-flex items-center gap-0.5" title="Checklist"><ListChecks className="w-3 h-3" />{check.feitos}/{check.total}</span>}
          {nComent > 0 && <span className="inline-flex items-center gap-0.5" title="Comentários"><MessageSquare className="w-3 h-3" />{nComent}</span>}
        </span>
        {/* ações de hover sobrepostas à direita (não roubam largura do título) */}
        <span className="absolute right-2 top-0 bottom-0 hidden md:inline-flex items-center gap-0.5 pl-6 bg-gradient-to-r from-transparent via-ln-level2/60 to-ln-level2/60 opacity-0 group-hover/linha:opacity-100 transition-opacity">
          <button type="button" onClick={(e) => { e.stopPropagation(); onAbrir(item.id) }} className="ln-iconbtn !w-5 !h-5 !rounded" title="Abrir"><AlignLeft className="w-3 h-3" /></button>
          <button type="button" onClick={(e) => { e.stopPropagation(); ctx.onCriar({ lista_id: item.lista_id, parent_id: item.parent_id || item.id, titulo: 'Nova subtarefa' }) }} className="ln-iconbtn !w-5 !h-5 !rounded" title="Adicionar subtarefa"><Plus className="w-3 h-3" /></button>
          {item.clickup_url && <a href={item.clickup_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="ln-iconbtn !w-5 !h-5 !rounded" title="Abrir no ClickUp"><Link2 className="w-3 h-3" /></a>}
          <button type="button" onClick={(e) => { e.stopPropagation(); onAbrir(item.id) }} className="ln-iconbtn !w-5 !h-5 !rounded" title="Editar"><Pencil className="w-3 h-3" /></button>
        </span>
      </div>
      {cols.map((c) => (
        <div key={c.k} className="flex items-center min-w-0 px-2 overflow-hidden" onClick={(e) => { if (c.k !== 'criada') e.stopPropagation() }}>
          <Celula k={c.k} item={item} ctx={ctx} />
        </div>
      ))}
      <span />
    </div>
  )
}

// ── Grupo ─────────────────────────────────────────────────────────────────────

function Grupo({ grupo, ctx, filhosDe, mostrarConcluidas, denso, cols }) {
  const [aberto, setAberto] = useState(true)
  const [expandidos, setExpandidos] = useState(() => new Set())
  const [novaTarefa, setNovaTarefa] = useState(false)
  const { onCriar, listaPadraoId, agrupar } = ctx
  const itens = ordenarItens(grupo.itens)
  const toggle = (id) => setExpandidos((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const corLabel = grupo.key === 'atrasado' ? 'text-ln-red' : grupo.key === 'hoje' ? 'text-ln-green' : grupo.key === 'amanha' ? 'text-ln-yellow' : 'text-ln-t1'
  return (
    <section className="mb-6" aria-label={grupo.label}>
      {/* Cabeçalho do grupo: ▾ Em atraso 47 ··· + */}
      <div className="sticky left-0 w-fit flex items-center gap-2 h-9 px-3">
        <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} className={`ln-iconbtn !w-5 !h-5 !rounded ${FOCO}`} aria-label={aberto ? 'Recolher grupo' : 'Expandir grupo'}>
          <ChevronDown className={`w-3.5 h-3.5 text-ln-t3 transition-transform duration-150 ${aberto ? '' : '-rotate-90'}`} />
        </button>
        {agrupar === 'status' ? (
          <StatusPillCU status={grupo.key} statuses={ctx.statuses} />
        ) : (
          <span className={`text-[13px] font-semibold ${corLabel}`}>{grupo.label}</span>
        )}
        <span className="text-xs text-ln-t3 tabular">{itens.length}</span>
        <button type="button" className={`ln-iconbtn !w-5 !h-5 !rounded text-ln-t4 ${FOCO}`} title="Mais opções" aria-label="Mais opções"><MoreHorizontal className="w-3.5 h-3.5" /></button>
        {listaPadraoId && (
          <button type="button" onClick={() => { setAberto(true); setNovaTarefa(true) }} className={`ln-iconbtn !w-5 !h-5 !rounded text-ln-t4 ${FOCO}`} title="Adicionar tarefa" aria-label="Adicionar tarefa"><Plus className="w-3.5 h-3.5" /></button>
        )}
      </div>
      {aberto && (
        <div className="min-w-0">
          {/* Cabeçalho das colunas, repetido em cada grupo como no ClickUp */}
          <div className="grid items-center h-7 border-b border-ln-line/70 text-[11px] text-ln-t4" style={{ gridTemplateColumns: grid(cols) }} aria-hidden="true">
            <span className="sticky left-0 z-[1] bg-ln-panel h-full flex items-center pl-[66px]">Nome</span>
            {cols.map((c) => <span key={c.k} className="px-2 truncate">{c.label}</span>)}
            <span className="inline-flex items-center justify-center text-ln-t4"><Plus className="w-3.5 h-3.5" /></span>
          </div>
          {itens.map((it) => {
            const todosFilhos = filhosDe.get(it.id) || []
            const filhos = ordenarItens(todosFilhos.filter((f) => mostrarConcluidas || f.status_tipo !== 'closed' || it.status_tipo === 'closed'))
            const exp = expandidos.has(it.id)
            return (
              <div key={it.id}>
                <Linha item={it} filhos={todosFilhos} expandido={exp} onToggle={() => toggle(it.id)} ctx={ctx} cols={cols} denso={denso} />
                {exp && filhos.map((f) => <Linha key={f.id} item={f} sub ctx={ctx} cols={cols} denso={denso} />)}
                {exp && (
                  <div className="flex items-center h-8 pl-[66px] border-b border-ln-line/70">
                    <AdicionarInline placeholder="Adicionar subtarefa" onCriar={(t) => onCriar({ lista_id: it.lista_id, parent_id: it.id, titulo: t, status: agrupar === 'status' ? grupo.key : undefined })} />
                  </div>
                )}
              </div>
            )
          })}
          {listaPadraoId && (
            <div className="flex items-center h-8 pl-[66px]">
              <AdicionarInline autoFocus={novaTarefa} placeholder="Adicionar tarefa" onCriar={(t) => { setNovaTarefa(false); onCriar({ lista_id: listaPadraoId, titulo: t, status: agrupar === 'status' ? grupo.key : undefined }) }} />
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default function ListaView({ grupos, filhosDe, ctx, mostrarConcluidas, denso = false, compacto = false }) {
  const cols = compacto ? COLS.compacta : COLS.cheia
  // mapas para a coluna Cliente (uma vez por render; listas/pastas/projetos mudam pouco)
  const ctxLista = {
    ...ctx,
    listasMap: new Map((ctx.listas || []).map((l) => [l.id, l])),
    pastasMap: new Map((ctx.pastas || []).map((p) => [p.id, p])),
    projetosMap: new Map((ctx.projetos || []).map((p) => [p.id, p])),
  }
  if (!grupos.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-1.5 py-16 text-center">
        <p className="text-[13px] text-ln-t4">Nenhuma tarefa aqui ainda</p>
        {ctx.listaPadraoId ? (
          <AdicionarInline placeholder="Adicionar a primeira tarefa" onCriar={(t) => ctx.onCriar({ lista_id: ctx.listaPadraoId, titulo: t })} />
        ) : (
          <p className="text-xs text-ln-t4">Escolha uma pasta ou lista à esquerda</p>
        )}
      </div>
    )
  }
  return (
    <div className={`w-max min-w-full ${compacto ? '[&>section]:min-w-[900px]' : '[&>section]:min-w-[1580px]'} pb-24 pt-2 bg-ln-panel`}>
      {grupos.map((g) => <Grupo key={g.key} grupo={g} ctx={ctxLista} filhosDe={filhosDe} mostrarConcluidas={mostrarConcluidas} denso={denso} cols={cols} />)}
    </div>
  )
}
