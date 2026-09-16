// Visualização "Lista" no visual do Linear: grupos recolhíveis com cabeçalho
// sticky, linhas de 40px em grid e edição inline em cada célula. Subtarefas
// aparecem indentadas abaixo do pai quando expandidas.
import { useState } from 'react'
import { ChevronRight, CornerDownRight, MessageSquare, ListChecks } from 'lucide-react'
import { ordenarItens, fmtDataNumerica, progressoChecklists } from '../../lib/tarefas'
import {
  StatusCampo, ResponsavelCampo, DataCampo, PrioridadeCampo, TipoTarefaCampo, DificuldadeCampo, EstimativaCampo, AdicionarInline, FOCO,
} from './Campos'

// expandir | status | prioridade | título | tipo | dificuldade | estimativa | criada | vencimento | responsável | conclusão
// Com o painel lateral aberto (compacto), somem tipo, dificuldade, criada e conclusão.
const COLUNAS = {
  cheia: '16px 16px 16px minmax(280px, 1fr) minmax(0, max-content) minmax(0, max-content) 72px 60px 76px 44px 60px',
  compacta: '16px 16px 16px minmax(200px, 1fr) 72px 76px 44px',
}
const CABECALHOS = {
  cheia: ['', '', '', 'Nome', 'Tipo de tarefa', 'Dificuldade', 'Estimativa', 'Criada', 'Vencimento', 'Resp.', 'Concluída'],
  compacta: ['', '', '', 'Nome', 'Estimativa', 'Vencimento', 'Resp.'],
}

function Linha({ item, sub = false, filhos = [], expandido, onToggle, ctx, denso, compacto }) {
  const { statuses, membros, membrosMap, onAbrir, onAtualizar, onMudarStatus, contagemComentarios, selecionadaId } = ctx
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
      className={`ln-row-hover grid items-center gap-x-2.5 ${denso ? 'h-8' : 'h-10'} px-2 cursor-pointer overflow-hidden ${FOCO} ${selecionada ? 'bg-ln-ink/[0.04]' : ''}`}
      style={{ gridTemplateColumns: compacto ? COLUNAS.compacta : COLUNAS.cheia }}
    >
      <span className="inline-flex items-center justify-center w-4 h-4">
        {!sub && filhos.length > 0 ? (
          <button type="button" onClick={(e) => { e.stopPropagation(); onToggle() }} className="ln-iconbtn !w-5 !h-5 !rounded" title={`${filhos.length} subtarefa(s)`} aria-label={expandido ? 'Recolher subtarefas' : 'Expandir subtarefas'}>
            <ChevronRight className={`w-3 h-3 transition-transform duration-150 ${expandido ? 'rotate-90' : ''}`} />
          </button>
        ) : sub ? <CornerDownRight className="w-3 h-3 text-ln-t4" /> : null}
      </span>

      <StatusCampo item={item} statuses={statuses} modo="icon" onChange={(s) => onMudarStatus(item, s)} />

      <PrioridadeCampo valor={item.prioridade} comTexto={false} onChange={(v) => onAtualizar(item.id, { prioridade: v })} />

      <span className="flex items-center gap-2 min-w-0">
        <span className={`text-[13px] font-medium truncate min-w-0 ${concluida ? 'text-ln-t4 line-through' : 'text-ln-t2'}`} title={item.titulo}>{item.titulo}</span>
        <span className="flex items-center gap-2 text-[11px] text-ln-t4 shrink-0 tabular">
          {!sub && filhos.length > 0 && <span className="inline-flex items-center gap-0.5" title="Subtarefas"><CornerDownRight className="w-3 h-3" />{filhos.filter((f) => f.status_tipo === 'closed').length}/{filhos.length}</span>}
          {check.total > 0 && <span className="inline-flex items-center gap-0.5" title="Checklist"><ListChecks className="w-3 h-3" />{check.feitos}/{check.total}</span>}
          {nComent > 0 && <span className="inline-flex items-center gap-0.5" title="Comentários"><MessageSquare className="w-3 h-3" />{nComent}</span>}
        </span>
      </span>

      {!compacto && <span className="min-w-0 overflow-hidden"><TipoTarefaCampo valor={item.tipo_tarefa} placeholder="" onChange={(v) => onAtualizar(item.id, { tipo_tarefa: v })} /></span>}
      {!compacto && <span className="min-w-0 overflow-hidden"><DificuldadeCampo valor={item.dificuldade} placeholder="" onChange={(v) => onAtualizar(item.id, { dificuldade: v })} /></span>}
      <EstimativaCampo valor={item.estimativa_min} vazio="" onChange={(v) => onAtualizar(item.id, { estimativa_min: v })} />
      {!compacto && <span className="text-xs text-ln-t4 tabular whitespace-nowrap">{fmtDataNumerica(item.created_at)}</span>}
      <DataCampo valor={item.data_vencimento} item={item} placeholder="" onChange={(v) => onAtualizar(item.id, { data_vencimento: v })} />
      <ResponsavelCampo item={item} membros={membros} membrosMap={membrosMap} size={16} max={2} onChange={(ids, extra) => onAtualizar(item.id, extra ? { responsaveis: ids, responsaveis_extra: extra } : { responsaveis: ids })} />
      {!compacto && <span className="text-xs text-ln-t4 tabular whitespace-nowrap">{item.data_conclusao ? fmtDataNumerica(item.data_conclusao) : ''}</span>}
    </div>
  )
}

function Grupo({ grupo, ctx, filhosDe, mostrarConcluidas, denso, compacto }) {
  const [aberto, setAberto] = useState(true)
  const [expandidos, setExpandidos] = useState(() => new Set())
  const { onCriar, listaPadraoId, agrupar } = ctx
  const itens = ordenarItens(grupo.itens)
  const toggle = (id) => setExpandidos((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  return (
    <div className="px-2">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className={`sticky top-7 z-10 w-full flex items-center gap-1.5 h-9 px-2 rounded-lg bg-ln-panel text-left transition-colors duration-150 hover:bg-ln-ink/[0.03] ${FOCO}`}
      >
        <ChevronRight className={`w-3.5 h-3.5 text-ln-t4 transition-transform duration-150 ${aberto ? 'rotate-90' : ''}`} />
        <i className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: grupo.cor }} />
        <span className="text-[13px] font-medium text-ln-t2 truncate">{grupo.label}</span>
        <span className="text-[13px] text-ln-t3 tabular">{itens.length}</span>
      </button>
      {aberto && (
        <>
          {itens.map((it) => {
            const todosFilhos = filhosDe.get(it.id) || []
            const filhos = ordenarItens(todosFilhos.filter((f) => mostrarConcluidas || f.status_tipo !== 'closed' || it.status_tipo === 'closed'))
            const exp = expandidos.has(it.id)
            return (
              <div key={it.id}>
                <Linha item={it} filhos={todosFilhos} expandido={exp} onToggle={() => toggle(it.id)} ctx={ctx} denso={denso} compacto={compacto} />
                {exp && filhos.map((f) => <Linha key={f.id} item={f} sub ctx={ctx} denso={denso} compacto={compacto} />)}
                {exp && (
                  <div className="flex items-center h-8 pl-[34px]">
                    <AdicionarInline placeholder="Adicionar subtarefa" onCriar={(t) => onCriar({ lista_id: it.lista_id, parent_id: it.id, titulo: t, status: grupo.key })} />
                  </div>
                )}
              </div>
            )
          })}
          {listaPadraoId && (
            <div className="flex items-center h-9 pl-[34px]">
              <AdicionarInline placeholder="Adicionar tarefa" onCriar={(t) => onCriar({ lista_id: listaPadraoId, titulo: t, status: agrupar === 'status' ? grupo.key : undefined })} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function ListaView({ grupos, filhosDe, ctx, mostrarConcluidas, denso = false, compacto = false }) {
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
    <div className={`${compacto ? 'min-w-[520px]' : 'min-w-[900px]'} pb-24`}>
      <div className="sticky top-0 z-20 grid items-center gap-x-2.5 h-7 px-4 bg-ln-panel border-b border-ln-ink/5 text-[11px] text-ln-t4" style={{ gridTemplateColumns: compacto ? COLUNAS.compacta : COLUNAS.cheia }} aria-hidden="true">
        {(compacto ? CABECALHOS.compacta : CABECALHOS.cheia).map((c, i) => <span key={i} className="truncate">{c}</span>)}
      </div>
      <div className="py-1">
        {grupos.map((g) => <Grupo key={g.key} grupo={g} ctx={ctx} filhosDe={filhosDe} mostrarConcluidas={mostrarConcluidas} denso={denso} compacto={compacto} />)}
      </div>
    </div>
  )
}
