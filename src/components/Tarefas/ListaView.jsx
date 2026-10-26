// Visualização "Lista" com a MESMA cara da lista do ClickUp (pedido do Matheus,
// 2026-10-18): grupos por data de vencimento ("Em atraso 47"), cabeçalho de
// colunas em cada grupo, linhas finas separadas por borda, e as colunas na
// ordem do ClickUp: Nome · Status · Tipo de tarefa · Responsável · Data criada
// · Data de vencimento · Data de conclusão · Prioridade · Sprints · Estimativa de tempo · Cliente. Edição inline continua em cada célula (Popovers de
// Campos.jsx). Subtarefas indentadas abaixo do pai quando expandidas.
//
// Também serve o construtor e a aplicação de templates, com ganchos opcionais:
// `colunas` (troca as colunas), `ctx.renderCelula(k, item)` (célula própria),
// `ctx.semStatus` (sem o círculo de status), `ctx.acaoLinha(item)` (última coluna),
// `ctx.renderAcoesHover(item)` (troca os atalhos de hover do nome),
// `ctx.ordenar` + `ctx.onOrdenar(o)` ({ campo, dir } ou null: cabeçalho clicável, sobe → desce → sem),
// `ctx.statusesDe(item)` (status da lista da tarefa, para Minhas/Todas, que misturam listas),
// `ctx.rotuloPai(item)` (texto depois do título, ex.: "↳ tarefa-pai" com subtarefas separadas),
// `ctx.expandirTudo` (subtarefas abertas de início), `ctx.acoesHover === false`
// (sem os botões de hover do nome nem a linha "Adicionar subtarefa") e `ctx.simples`
// (lista de um grupo só: sem cabeçalho de grupo, sem arrastar/selecionar e sem o "+"
// do cabeçalho das colunas, que ali não teriam o que fazer) e `ctx.selecao`
// ({ ids: Set, alternar(id), definir(ids, marcar) }: caixa de seleção por linha e
// "selecionar todas" no cabeçalho; quem usa mostra a BarraSelecao).
// Colunas: `ctx.colunas` (config.colunas da view: ordem e ocultas) e `ctx.onColunas(c)`
// (o "+" no fim do cabeçalho abre o editor). Com `colunas` (templates) nada disso vale.
// Largura do Nome: `ctx.larguraNome` (px, null = o que sobrar) e `ctx.onLarguraNome(w)`, que
// liga a alça na borda direita do cabeçalho do Nome (arrastar; ← → com foco; duplo clique volta ao automático).
import { useState, useRef } from 'react'
import { colunasVisiveis, normalizarLarguraNome } from '../../lib/viewsTarefas'
import EditorColunas from './ColunasLista'
import { ChevronRight, ChevronDown, ArrowUp, ArrowDown, CornerDownRight, MessageSquare, ListChecks, Plus, MoreHorizontal, Flag, Hourglass, CloudUpload } from 'lucide-react'
import { ordenarItens, ordenarPorCampo, fmtDataNumerica, fmtVencimentoClickUp, progressoChecklists, rotuloStatus, PRIORIDADES, TIPOS_TAREFA, pessoasDaTarefa } from '../../lib/tarefas'
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
    { k: 'concluida',  label: 'Data de conclusão',   w: 140 },
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
const POR_CHAVE = { cheia: new Map(COLS.cheia.map((c) => [c.k, c])), compacta: new Map(COLS.compacta.map((c) => [c.k, c])) }
/** Colunas visíveis na ordem da view; no modo compacto só as da versão compacta. */
const colunasDaLista = (cfg, compacto) => {
  const m = POR_CHAVE[compacto ? 'compacta' : 'cheia']
  return colunasVisiveis(cfg).filter((k) => m.has(k)).map((k) => m.get(k))
}
const NOME_MIN = 420 // largura mínima do Nome no automático (sem largura arrastada)
const grid = (cols, larguraNome) => `${larguraNome ? `${larguraNome}px` : `minmax(${NOME_MIN}px, 1fr)`} ${cols.map((c) => `${c.w}px`).join(' ')} 40px`

// Célula editável: a célula inteira é o alvo do clique (com hover), não só o valor. Assim
// dá para editar mesmo quando o campo está vazio. Colunas padrão editáveis por chave; coluna
// própria marca `editavel: true`.
const EDITAVEIS = new Set(['status', 'tipo', 'resp', 'venc', 'prio', 'sprint', 'estim'])
const INTERATIVO = 'button, input, select, textarea, a, [contenteditable="true"]'
function cliqueNaCelula(e, editavel) {
  const alvo = e.target.closest(INTERATIVO)
  if (alvo || editavel) e.stopPropagation() // não abre a tarefa
  if (!editavel || alvo) return
  e.currentTarget.querySelector('button')?.click() // o gatilho do editor (Popover, data, estimativa)
}
// recuo das linhas "Adicionar": alinha com o que vem depois da seta (e da caixa de seleção)
const recuo = (ctx) => (ctx.selecao ? 'pl-[50px]' : 'pl-[26px]')

/** Caixa de seleção da linha / do cabeçalho: some até o hover, a não ser que haja seleção. */
function Caixa({ marcada, parcial = false, visivel, onChange, label }) {
  return (
    <input
      type="checkbox" checked={marcada} aria-label={label}
      ref={(el) => { if (el) el.indeterminate = parcial && !marcada }}
      onChange={onChange} onClick={(e) => e.stopPropagation()}
      className={`w-3.5 h-3.5 cursor-pointer accent-[#2A25F0] transition-opacity ${marcada || parcial || visivel ? 'opacity-100' : 'opacity-0 group-hover/linha:opacity-100 focus-visible:opacity-100'}`}
    />
  )
}

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

// ── Ordem manual ──────────────────────────────────────────────────────────────
// Setas no hover da linha: troca a tarefa de lugar com a vizinha (no grupo, ou entre as
// subtarefas do mesmo pai) gravando `posicao`. Com a Lista ordenada por coluna, a primeira
// seta "congela" a ordem que está na tela como ordem manual (renumera o que aparece, em
// cada grupo), tira a ordenação por coluna e só então move.
const posDe = (it) => Number(it.posicao) || 0
const PASSO = 1000

/** Grava `posicao` em sequência na ordem dada (só onde mudou). */
function renumerar(lista, ctx) {
  lista.forEach((x, k) => { const p = (k + 1) * PASSO; if (posDe(x) !== p) ctx.onAtualizar(x.id, { posicao: p }) })
}
function trocar(lista, i, j) {
  const nova = [...lista]
  const [it] = nova.splice(i, 1)
  nova.splice(j, 0, it)
  return nova
}

function mover(item, irmas, dir, ctx) {
  const i = irmas.findIndex((x) => x.id === item.id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= irmas.length) return
  if (ctx.ordenar?.campo) {
    // congela a ordem da tela: os grupos de cima como estão e o trecho da tarefa já movido
    for (const lista of ctx.ordemVisivel || []) if (!lista.some((x) => x.id === item.id)) renumerar(lista, ctx)
    renumerar(trocar(irmas, i, j), ctx)
    ctx.onOrdenar?.(null)
    return
  }
  const viz = irmas[j]
  const alem = irmas[j + dir]
  if (posDe(viz) === posDe(item) || (alem && posDe(alem) === posDe(viz))) {
    renumerar(trocar(irmas, i, j), ctx) // posições repetidas (comum em tarefas criadas aqui)
    return
  }
  // entre a vizinha e a seguinte a ela (ou um passo além da ponta)
  ctx.onAtualizar(item.id, { posicao: alem ? (posDe(viz) + posDe(alem)) / 2 : posDe(viz) + dir * PASSO })
}
function BotoesMover({ item, irmas, ctx }) {
  const i = irmas.findIndex((x) => x.id === item.id)
  const dica = ctx.ordenar?.campo ? ' (a ordem da tela vira a ordem manual)' : ''
  return (<>
    <button type="button" disabled={i <= 0} onClick={(e) => { e.stopPropagation(); mover(item, irmas, -1, ctx) }} className="ln-iconbtn !w-5 !h-5 !rounded disabled:opacity-30" title={`Mover para cima${dica}`} aria-label="Mover para cima"><ArrowUp className="w-3 h-3" /></button>
    <button type="button" disabled={i < 0 || i >= irmas.length - 1} onClick={(e) => { e.stopPropagation(); mover(item, irmas, 1, ctx) }} className="ln-iconbtn !w-5 !h-5 !rounded disabled:opacity-30" title={`Mover para baixo${dica}`} aria-label="Mover para baixo"><ArrowDown className="w-3 h-3" /></button>
  </>)
}

// ── Linha ─────────────────────────────────────────────────────────────────────

function Celula({ k, item, ctx }) {
  const { onAtualizar, onMudarStatus } = ctx
  const statuses = ctx.statusesDe?.(item) || ctx.statuses
  const propria = ctx.renderCelula?.(k, item)
  if (propria !== undefined) return propria
  switch (k) {
    case 'status': return <StatusCampo item={item} statuses={statuses} onChange={(s) => onMudarStatus(item, s)} modo="custom" render={<StatusPillCU status={item.status} statuses={statuses} />} />
    case 'tipo': return <TipoTarefaCampo valor={item.tipo_tarefa} onChange={(v) => onAtualizar(item.id, { tipo_tarefa: v })} render={<TipoPillCU valor={item.tipo_tarefa} />} />
    case 'resp': return <ResponsavelCU item={item} ctx={ctx} />
    case 'criada': return <span className="text-[13px] text-ln-t2 tabular whitespace-nowrap">{fmtDataNumerica(item.created_at)}</span>
    // data em que a tarefa foi para um status de concluída (aqui ou no ClickUp); só leitura
    case 'concluida': return <span className="text-[13px] text-ln-t2 tabular whitespace-nowrap">{item.data_conclusao ? fmtDataNumerica(item.data_conclusao) : ''}</span>
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

function Linha({ item, sub = false, filhos = [], expandido, onToggle, ctx, cols, denso, irmas = [] }) {
  const { onAbrir, onMudarStatus, contagemComentarios, selecionadaId } = ctx
  const statuses = ctx.statusesDe?.(item) || ctx.statuses
  const check = progressoChecklists(item.checklists)
  const nComent = contagemComentarios?.[item.id] || 0
  const concluida = item.status_tipo === 'closed'
  const selecionada = selecionadaId === item.id
  const marcada = !!ctx.selecao?.ids.has(item.id)
  const destaque = selecionada ? 'bg-ln-level2' : marcada ? 'bg-ln-accent/[0.07]' : ''
  return (
    <div
      role="row"
      tabIndex={0}
      onClick={() => onAbrir(item.id)}
      onKeyDown={(e) => { if (e.key === 'Enter') onAbrir(item.id) }}
      aria-current={selecionada ? 'true' : undefined}
      className={`group/linha grid items-center ${denso ? 'h-[30px]' : 'h-[34px]'} border-b border-ln-line/70 cursor-pointer ${FOCO} ${destaque || 'hover:bg-ln-level2/60'}`}
      style={{ gridTemplateColumns: grid(cols, ctx.larguraNome) }}
    >
      {/* Nome: congelada à esquerda ao rolar (como no ClickUp). O fundo precisa ser
          opaco, então a cor de hover/seleção entra por um overlay atrás do conteúdo. */}
      <div className={`sticky left-0 z-[1] bg-ln-panel relative flex items-center gap-1 min-w-0 h-full pr-3 ${sub ? 'pl-9' : 'pl-2'}`}>
        <span aria-hidden="true" className={`absolute inset-0 -z-10 ${destaque || 'group-hover/linha:bg-ln-level2/60'}`} />
        {ctx.selecao && (
          <span className="inline-flex items-center justify-center w-5 shrink-0">
            <Caixa marcada={marcada} visivel={ctx.selecao.ids.size > 0} onChange={() => ctx.selecao.alternar(item.id)} label={`Selecionar ${item.titulo || 'tarefa'}`} />
          </span>
        )}
        <span className="inline-flex items-center justify-center w-4 h-4 shrink-0">
          {!sub && filhos.length > 0 ? (
            <button type="button" onClick={(e) => { e.stopPropagation(); onToggle() }} className="ln-iconbtn !w-4 !h-4 !rounded" title={`${filhos.length} subtarefa(s)`} aria-label={expandido ? 'Recolher subtarefas' : 'Expandir subtarefas'}>
              <ChevronRight className={`w-3 h-3 transition-transform duration-150 ${expandido ? 'rotate-90' : ''}`} />
            </button>
          ) : null}
        </span>
        {!ctx.semStatus && <StatusCampo item={item} statuses={statuses} modo="icon" onChange={(s) => onMudarStatus(item, s)} className="shrink-0 mr-1.5" />}
        <span className={`text-[13px] truncate min-w-0 ${concluida ? 'text-ln-t4 line-through' : 'text-ln-t1'}`} title={item.titulo}>{item.titulo}</span>
        {ctx.rotuloPai?.(item)}
        <span className="flex items-center gap-2 text-[11px] text-ln-t4 shrink-0 tabular ml-1.5">
          {!sub && filhos.length > 0 && <span className="inline-flex items-center gap-0.5" title="Subtarefas"><CornerDownRight className="w-3 h-3" />{filhos.length}</span>}
          {check.total > 0 && <span className="inline-flex items-center gap-0.5" title="Checklist"><ListChecks className="w-3 h-3" />{check.feitos}/{check.total}</span>}
          {nComent > 0 && <span className="inline-flex items-center gap-0.5" title="Comentários"><MessageSquare className="w-3 h-3" />{nComent}</span>}
          {/* ainda não chegou ao ClickUp (fila do push); some sozinho pelo realtime quando o vínculo é gravado */}
          {!item.clickup_task_id && ctx.listasComClickup?.has(item.lista_id) && <CloudUpload className="w-3 h-3 text-ln-yellow" aria-label="Aguardando ClickUp" title="Ainda não foi para o ClickUp" />}
        </span>
        {/* ações de hover sobrepostas à direita (não roubam largura do título) */}
        {ctx.acoesHover !== false && <span className="absolute right-2 top-0 bottom-0 hidden md:inline-flex items-center gap-0.5 pl-6 bg-gradient-to-r from-transparent via-ln-level2/60 to-ln-level2/60 opacity-0 group-hover/linha:opacity-100 transition-opacity">
          {ctx.renderAcoesHover ? <span className="inline-flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>{ctx.renderAcoesHover(item)}</span> : (<>
            <BotoesMover item={item} irmas={irmas} ctx={ctx} />
            <button type="button" onClick={(e) => { e.stopPropagation(); ctx.onCriar({ lista_id: item.lista_id, parent_id: item.parent_id || item.id, titulo: 'Nova subtarefa' }) }} className="ln-iconbtn !w-5 !h-5 !rounded" title="Adicionar subtarefa"><Plus className="w-3 h-3" /></button>
          </>)}
        </span>}
      </div>
      {cols.map((c) => {
        const editavel = c.editavel ?? EDITAVEIS.has(c.k)
        return (
          <div
            key={c.k}
            onClick={(e) => cliqueNaCelula(e, editavel)}
            className={`flex items-center min-w-0 px-2 overflow-hidden self-stretch ${editavel ? 'cursor-pointer rounded-[4px] hover:bg-ln-ink/[0.06] hover:ring-1 hover:ring-inset hover:ring-ln-line' : ''}`}
          >
            <Celula k={c.k} item={item} ctx={ctx} />
          </div>
        )
      })}
      <span className="flex items-center justify-center" onClick={ctx.acaoLinha ? (e) => e.stopPropagation() : undefined}>{ctx.acaoLinha?.(item)}</span>
    </div>
  )
}

// Título da coluna: clicável quando a lista aceita ordenar (ctx.onOrdenar) e a coluna é padrão.
const ORDENAVEIS = new Set(['nome', 'status', 'tipo', 'resp', 'criada', 'venc', 'concluida', 'prio', 'sprint', 'estim', 'cliente'])
/** Alça na borda direita do cabeçalho do Nome: arrastar muda a largura ao vivo (todos os grupos) e grava ao soltar. */
function AlcaNome({ ctx }) {
  const [arrastando, setArrastando] = useState(false)
  const gravar = (w) => ctx.onLarguraNome(normalizarLarguraNome(w))
  const iniciar = (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    const celula = e.currentTarget.parentElement
    const x0 = e.clientX, w0 = celula.getBoundingClientRect().width
    let w = w0
    setArrastando(true)
    document.body.style.cursor = 'col-resize'
    const mover = (ev) => { w = normalizarLarguraNome(w0 + ev.clientX - x0); ctx.setLarguraViva(w) }
    const soltar = () => {
      window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar)
      document.body.style.cursor = ''
      setArrastando(false); ctx.setLarguraViva(null)
      if (Math.abs(w - w0) >= 1) gravar(w)
    }
    window.addEventListener('pointermove', mover); window.addEventListener('pointerup', soltar)
  }
  const teclado = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const w = e.currentTarget.parentElement.getBoundingClientRect().width
    gravar(w + (e.key === 'ArrowRight' ? 20 : -20))
  }
  return (
    <span
      role="separator" aria-orientation="vertical" aria-label="Largura da coluna Nome (setas ← →; duplo clique volta ao automático)" tabIndex={0}
      title="Arraste para mudar a largura · duplo clique: automático"
      onPointerDown={iniciar} onKeyDown={teclado} onDoubleClick={() => ctx.onLarguraNome(null)} onClick={(e) => e.stopPropagation()}
      className={`absolute -right-1 top-0 bottom-0 z-[2] w-2 flex justify-center cursor-col-resize group/alca ${FOCO}`}
    >
      <span className={`w-0.5 h-full transition-colors ${arrastando ? 'bg-ln-accent' : 'bg-transparent group-hover/alca:bg-ln-accent/60 group-focus-visible/alca:bg-ln-accent'}`} />
    </span>
  )
}

/** "+" no fim do cabeçalho: ordem e visibilidade das colunas (rascunho da view, como a ordenação). */
function MaisColunas({ ctx }) {
  const ref = useRef(null)
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <button ref={ref} type="button" onClick={() => setAberto((x) => !x)} aria-expanded={aberto} className={`ln-iconbtn !w-6 !h-6 !rounded ${aberto ? 'bg-ln-ink/5 text-ln-t1' : 'text-ln-t4'} ${FOCO}`} title="Colunas: ordem e visibilidade" aria-label="Colunas: ordem e visibilidade"><Plus className="w-3.5 h-3.5" /></button>
      <Popover anchorRef={ref} open={aberto} onClose={() => setAberto(false)} width={260} align="right" alturaMax={460}>
        <div className="p-1.5">
          <p className="px-2 pt-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ln-t4">Colunas</p>
          <EditorColunas valor={ctx.colunas} onChange={ctx.onColunas} />
        </div>
      </Popover>
    </>
  )
}

function TituloColuna({ k, label, ctx, ordenavel = true }) {
  if (!ctx.onOrdenar || !ordenavel || !ORDENAVEIS.has(k)) return <span className="truncate" aria-hidden="true">{label}</span>
  const ativo = ctx.ordenar?.campo === k
  const proximo = !ativo ? { campo: k, dir: 1 } : ctx.ordenar.dir === 1 ? { campo: k, dir: -1 } : null
  return (
    <button type="button" onClick={() => ctx.onOrdenar(proximo)} title={!ativo ? `Ordenar por ${label}` : ctx.ordenar.dir === 1 ? 'Inverter a ordem' : 'Tirar a ordenação'}
      className={`inline-flex items-center gap-1 min-w-0 rounded hover:text-ln-t2 ${ativo ? 'text-ln-t2 font-medium' : ''} ${FOCO}`}>
      <span className="truncate">{label}</span>{ativo && (ctx.ordenar.dir === 1 ? <ArrowUp className="w-3 h-3 shrink-0" /> : <ArrowDown className="w-3 h-3 shrink-0" />)}
    </button>
  )
}

// ── Grupo ─────────────────────────────────────────────────────────────────────

function Grupo({ grupo, ctx, filhosDe, mostrarConcluidas, denso, cols }) {
  const [aberto, setAberto] = useState(true)
  // com ctx.expandirTudo o conjunto guarda as RECOLHIDAS (tudo nasce aberto); sem ele, as abertas
  const [expandidos, setExpandidos] = useState(() => new Set())
  const [novaTarefa, setNovaTarefa] = useState(false)
  const { onCriar, listaPadraoId, agrupar } = ctx
  const ordenar = ctx.ordenar?.campo ? ctx.ordenar : null
  const ordenarLista = (lista) => (ordenar ? ordenarPorCampo(lista, ordenar, ctx) : ordenarItens(lista))
  const itens = ordenarLista(grupo.itens)
  const toggle = (id) => setExpandidos((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const idsDoGrupo = ctx.selecao ? itens.flatMap((i) => [i.id, ...(filhosDe.get(i.id) || []).map((f) => f.id)]) : []
  const nMarcadas = ctx.selecao ? idsDoGrupo.filter((id) => ctx.selecao.ids.has(id)).length : 0
  const corLabel = grupo.key === 'atrasado' ? 'text-ln-red' : grupo.key === 'hoje' ? 'text-ln-green' : grupo.key === 'amanha' ? 'text-ln-yellow' : 'text-ln-t1'
  return (
    <section className="mb-6" aria-label={grupo.label}>
      {/* Cabeçalho do grupo: ▾ Em atraso 47 ··· + */}
      {!ctx.simples && <div className="sticky left-0 w-fit flex items-center gap-2 h-9 px-3">
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
      </div>}
      {(aberto || ctx.simples) && (
        <div className="min-w-0">
          {/* Cabeçalho das colunas, repetido em cada grupo como no ClickUp */}
          <div className="group/linha grid items-center h-7 border-b border-ln-line/70 text-[11px] text-ln-t4" style={{ gridTemplateColumns: grid(cols, ctx.larguraNome) }}>
            <span className="sticky left-0 z-[1] bg-ln-panel h-full flex items-center gap-1 pl-2">
              {ctx.selecao && (
                <span className="inline-flex items-center justify-center w-5 shrink-0">
                  <Caixa
                    marcada={idsDoGrupo.length > 0 && nMarcadas === idsDoGrupo.length} parcial={nMarcadas > 0} visivel={ctx.selecao.ids.size > 0}
                    onChange={() => ctx.selecao.definir(idsDoGrupo, nMarcadas < idsDoGrupo.length)} label="Selecionar todas"
                  />
                </span>
              )}
              <span className="w-4 shrink-0" aria-hidden="true" />
              <TituloColuna k="nome" label="Nome" ctx={ctx} />
              {ctx.onLarguraNome && <AlcaNome ctx={ctx} />}
            </span>
            {cols.map((c) => <span key={c.k} className="px-2 min-w-0 flex"><TituloColuna k={c.k} label={c.label} ctx={ctx} ordenavel={!c.editavel || ORDENAVEIS.has(c.k)} /></span>)}
            <span className="inline-flex items-center justify-center text-ln-t4">{!ctx.simples && ctx.onColunas && <MaisColunas ctx={ctx} />}</span>
          </div>
          {itens.map((it) => {
            const todosFilhos = filhosDe.get(it.id) || []
            const filhos = ordenarLista(todosFilhos.filter((f) => mostrarConcluidas || f.status_tipo !== 'closed' || it.status_tipo === 'closed'))
            const exp = ctx.expandirTudo ? todosFilhos.length > 0 && !expandidos.has(it.id) : expandidos.has(it.id)
            return (
              <div key={it.id}>
                <Linha item={it} filhos={todosFilhos} expandido={exp} onToggle={() => toggle(it.id)} ctx={ctx} cols={cols} denso={denso} irmas={itens} />
                {exp && filhos.map((f) => <Linha key={f.id} item={f} sub ctx={ctx} cols={cols} denso={denso} irmas={filhos} />)}
                {exp && ctx.acoesHover !== false && (
                  <div className={`flex items-center h-8 ${recuo(ctx)} border-b border-ln-line/70`}>
                    <AdicionarInline placeholder="Adicionar subtarefa" onCriar={(t) => onCriar({ lista_id: it.lista_id, parent_id: it.id, titulo: t, status: agrupar === 'status' ? grupo.key : undefined })} />
                  </div>
                )}
              </div>
            )
          })}
          {listaPadraoId && (
            <div className={`flex items-center h-8 ${recuo(ctx)}`}>
              <AdicionarInline autoFocus={novaTarefa} placeholder="Adicionar tarefa" onCriar={(t) => { setNovaTarefa(false); onCriar({ lista_id: listaPadraoId, titulo: t, status: agrupar === 'status' ? grupo.key : undefined }) }} />
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default function ListaView({ grupos, filhosDe, ctx, mostrarConcluidas, denso = false, compacto = false, colunas = null, vazio = null }) {
  const cols = colunas || colunasDaLista(ctx.colunas, compacto)
  // largura mínima do grid (o Nome tem 420 px no mínimo); acompanha as colunas visíveis
  // largura do Nome enquanto a alça é arrastada (vale para todos os grupos); ao soltar vira ctx.larguraNome
  const [larguraViva, setLarguraViva] = useState(null)
  const larguraNome = colunas ? null : (larguraViva ?? ctx.larguraNome ?? null)
  const larguraMin = (larguraNome ?? NOME_MIN) + cols.reduce((a, c) => a + c.w, 0) + 40
  // mapas para a coluna Cliente (uma vez por render; listas/pastas/projetos mudam pouco)
  const ctxLista = {
    ...ctx,
    larguraNome, setLarguraViva,
    onLarguraNome: colunas ? undefined : ctx.onLarguraNome,
    listasMap: new Map((ctx.listas || []).map((l) => [l.id, l])),
    pastasMap: new Map((ctx.pastas || []).map((p) => [p.id, p])),
    projetosMap: new Map((ctx.projetos || []).map((p) => [p.id, p])),
  }
  // ordem de cada grupo como está na tela: as setas usam para congelar a ordenação por coluna
  if (ctx.ordenar?.campo) ctxLista.ordemVisivel = grupos.map((g) => ordenarPorCampo(g.itens, ctx.ordenar, ctxLista))
  if (!grupos.length && vazio) return vazio
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
    <div className="w-max min-w-full pb-24 pt-2 bg-ln-panel">
      {grupos.map((g) => (
        <div key={g.key} style={{ minWidth: larguraMin }}>
          <Grupo grupo={g} ctx={ctxLista} filhosDe={filhosDe} mostrarConcluidas={mostrarConcluidas} denso={denso} cols={cols} />
        </div>
      ))}
    </div>
  )
}
