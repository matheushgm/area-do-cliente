// Visualização "Lista" (tabela agrupada) igual à do ClickUp: seções por
// grupo, colunas fixas e edição inline em cada célula. Subtarefas aparecem
// indentadas abaixo do pai quando expandidas.
import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, CornerDownRight, MessageSquare, ListChecks, Plus } from 'lucide-react'
import { COLUNAS_LISTA, ordenarItens, fmtDataNumerica, progressoChecklists } from '../../lib/tarefas'
import {
  StatusCampo, ResponsavelCampo, DataCampo, PrioridadeCampo, TipoTarefaCampo, DificuldadeCampo, EstimativaCampo, AdicionarInline,
} from './Campos'

const LARG_NOME = 420

function Celula({ w, children, className = '' }) {
  return <div style={{ width: w, minWidth: w }} className={`flex items-center px-2 h-full overflow-hidden ${className}`}>{children}</div>
}

function Linha({ item, sub = false, filhos = [], expandido, onToggle, ctx }) {
  const { statuses, membros, membrosMap, onAbrir, onAtualizar, onMudarStatus, contagemComentarios } = ctx
  const check = progressoChecklists(item.checklists)
  const nComent = contagemComentarios?.[item.id] || 0
  const concluida = item.status_tipo === 'closed'
  return (
    <div
      role="row"
      onClick={() => onAbrir(item.id)}
      className="group/linha flex items-stretch h-[38px] border-b border-rl-border/60 hover:bg-rl-surface/70 cursor-pointer text-[13px]"
    >
      <div style={{ width: LARG_NOME, minWidth: LARG_NOME }} className={`flex items-center gap-1.5 pr-2 sticky left-0 bg-rl-bg group-hover/linha:bg-rl-surface z-[1] ${sub ? 'pl-9' : 'pl-3'}`}>
        {!sub && filhos.length > 0 ? (
          <button type="button" onClick={(e) => { e.stopPropagation(); onToggle() }} className="p-0.5 rounded text-rl-muted hover:text-rl-text hover:bg-rl-border/60 shrink-0" title={`${filhos.length} subtarefa(s)`}>
            {expandido ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <span className="w-[18px] shrink-0 flex items-center justify-center">{sub && <CornerDownRight className="w-3 h-3 text-rl-muted/70" />}</span>
        )}
        <StatusCampo item={item} statuses={statuses} onChange={(s) => onMudarStatus(item, s)} size="icon" className="shrink-0" />
        <span className={`flex-1 min-w-0 truncate ${concluida ? 'text-rl-muted line-through' : 'text-rl-text'}`} title={item.titulo}>{item.titulo}</span>
        <span className="flex items-center gap-2 text-[11px] text-rl-muted shrink-0">
          {!sub && filhos.length > 0 && <span className="inline-flex items-center gap-0.5" title="Subtarefas"><CornerDownRight className="w-3 h-3" />{filhos.length}</span>}
          {check.total > 0 && <span className="inline-flex items-center gap-0.5" title="Checklist"><ListChecks className="w-3 h-3" />{check.feitos}/{check.total}</span>}
          {nComent > 0 && <span className="inline-flex items-center gap-0.5" title="Comentários"><MessageSquare className="w-3 h-3" />{nComent}</span>}
        </span>
      </div>
      <Celula w={COLUNAS_LISTA[0].w}><StatusCampo item={item} statuses={statuses} onChange={(s) => onMudarStatus(item, s)} /></Celula>
      <Celula w={COLUNAS_LISTA[1].w}><ResponsavelCampo item={item} membros={membros} membrosMap={membrosMap} onChange={(ids, extra) => onAtualizar(item.id, extra ? { responsaveis: ids, responsaveis_extra: extra } : { responsaveis: ids })} /></Celula>
      <Celula w={COLUNAS_LISTA[2].w} className="text-rl-subtle">{fmtDataNumerica(item.created_at)}</Celula>
      <Celula w={COLUNAS_LISTA[3].w}><DataCampo valor={item.data_vencimento} item={item} onChange={(v) => onAtualizar(item.id, { data_vencimento: v })} /></Celula>
      <Celula w={COLUNAS_LISTA[4].w}><PrioridadeCampo valor={item.prioridade} onChange={(v) => onAtualizar(item.id, { prioridade: v })} /></Celula>
      <Celula w={COLUNAS_LISTA[5].w}><DificuldadeCampo valor={item.dificuldade} onChange={(v) => onAtualizar(item.id, { dificuldade: v })} /></Celula>
      <Celula w={COLUNAS_LISTA[6].w}><TipoTarefaCampo valor={item.tipo_tarefa} onChange={(v) => onAtualizar(item.id, { tipo_tarefa: v })} /></Celula>
      <Celula w={COLUNAS_LISTA[7].w}><EstimativaCampo valor={item.estimativa_min} onChange={(v) => onAtualizar(item.id, { estimativa_min: v })} /></Celula>
      <Celula w={COLUNAS_LISTA[8].w} className="text-rl-subtle">{item.data_conclusao ? fmtDataNumerica(item.data_conclusao) : <span className="text-rl-muted/70">–</span>}</Celula>
    </div>
  )
}

function Grupo({ grupo, ctx, filhosDe, mostrarConcluidas }) {
  const [aberto, setAberto] = useState(true)
  const [expandidos, setExpandidos] = useState(() => new Set())
  const { onCriar, listaPadraoId, agrupar } = ctx
  const itens = ordenarItens(grupo.itens)
  const toggle = (id) => setExpandidos((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  return (
    <section className="mb-5">
      <div className="flex items-center gap-2 h-9 sticky top-0 z-[2] bg-rl-bg">
        <button type="button" onClick={() => setAberto((v) => !v)} className="p-0.5 rounded text-rl-muted hover:text-rl-text" aria-label={aberto ? 'Recolher grupo' : 'Expandir grupo'}>
          {aberto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <span className="inline-flex items-center h-[22px] px-2 rounded-md text-[11px] font-bold uppercase tracking-wide text-white" style={{ backgroundColor: grupo.cor }}>
          {grupo.label}
        </span>
        <span className="text-xs text-rl-muted">{itens.length}</span>
        <div className="flex-1" />
        {listaPadraoId && (
          <button type="button" onClick={() => setAberto(true)} className="hidden" aria-hidden />
        )}
      </div>
      {aberto && (
        <div className="min-w-max">
          <div className="flex items-center h-7 text-[11px] font-medium text-rl-muted border-b border-rl-border/60">
            <div style={{ width: LARG_NOME, minWidth: LARG_NOME }} className="pl-[38px] sticky left-0 bg-rl-bg z-[1]">Nome</div>
            {COLUNAS_LISTA.map((c) => <div key={c.key} style={{ width: c.w, minWidth: c.w }} className="px-2">{c.label}</div>)}
          </div>
          {itens.map((it) => {
            const filhos = ordenarItens((filhosDe.get(it.id) || []).filter((f) => mostrarConcluidas || f.status_tipo !== 'closed' || it.status_tipo === 'closed'))
            const exp = expandidos.has(it.id)
            return (
              <div key={it.id}>
                <Linha item={it} filhos={filhosDe.get(it.id) || []} expandido={exp} onToggle={() => toggle(it.id)} ctx={ctx} />
                {exp && filhos.map((f) => <Linha key={f.id} item={f} sub ctx={ctx} />)}
                {exp && (
                  <div className="flex items-center h-8 pl-[52px] border-b border-rl-border/40 sticky left-0">
                    <AdicionarInline compacto placeholder="Adicionar subtarefa" onCriar={(t) => onCriar({ lista_id: it.lista_id, parent_id: it.id, titulo: t, status: grupo.key })} />
                  </div>
                )}
              </div>
            )
          })}
          {listaPadraoId && (
            <div className="flex items-center h-9 pl-[38px] sticky left-0">
              <AdicionarInline compacto placeholder="Adicionar Tarefa" onCriar={(t) => onCriar({ lista_id: listaPadraoId, titulo: t, status: agrupar === 'status' ? grupo.key : undefined })} />
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default function ListaView({ grupos, filhosDe, ctx, mostrarConcluidas }) {
  if (!grupos.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-rl-muted mb-3">Nenhuma tarefa aqui ainda.</p>
        {ctx.listaPadraoId && (
          <AdicionarInline placeholder="Adicionar Tarefa" className="text-rl-purple" onCriar={(t) => ctx.onCriar({ lista_id: ctx.listaPadraoId, titulo: t })} />
        )}
      </div>
    )
  }
  return (
    <div className="px-4 pb-16 overflow-x-auto">
      {grupos.map((g) => <Grupo key={g.key} grupo={g} ctx={ctx} filhosDe={filhosDe} mostrarConcluidas={mostrarConcluidas} />)}
    </div>
  )
}
