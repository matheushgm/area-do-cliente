// Visualização "Quadro" (kanban) no visual do Linear: uma coluna por grupo,
// cards ln-card e arrastar entre colunas para mudar status ou prioridade.
import { useState } from 'react'
import { Plus, CornerDownRight, ListChecks, MessageSquare, Paperclip } from 'lucide-react'
import { ordenarItens, progressoChecklists, PRIORIDADES, TIPOS_TAREFA } from '../../lib/tarefas'
import { Avatares, DataCampo, PrioridadeCampo, AdicionarInline, Chip, StatusIcon, FOCO } from './Campos'

function Card({ item, filhos, ctx, arrastavel }) {
  const { membrosMap, onAbrir, onAtualizar, contagemComentarios, statuses, selecionadaId } = ctx
  const check = progressoChecklists(item.checklists)
  const nComent = contagemComentarios?.[item.id] || 0
  const tipo = TIPOS_TAREFA.find((t) => t.key === item.tipo_tarefa)
  const selecionada = selecionadaId === item.id
  return (
    <div
      role="button"
      tabIndex={0}
      draggable={arrastavel}
      onDragStart={(e) => { e.dataTransfer.setData('text/tarefa', item.id); e.dataTransfer.effectAllowed = 'move' }}
      onClick={() => onAbrir(item.id)}
      onKeyDown={(e) => { if (e.key === 'Enter') onAbrir(item.id) }}
      aria-current={selecionada ? 'true' : undefined}
      className={`ln-card p-3 cursor-pointer transition-colors duration-150 hover:bg-ln-ink/[0.02] ${selecionada ? '!border-ln-accent/50' : ''} ${FOCO}`}
    >
      <div className="flex items-start gap-2">
        <StatusIcon status={item.status} statuses={statuses} size={14} className="mt-0.5" />
        <p className={`text-[13px] font-medium leading-snug min-w-0 flex-1 ${item.status_tipo === 'closed' ? 'text-ln-t4 line-through' : 'text-ln-t2'}`}>{item.titulo}</p>
      </div>
      {(item.tipo_tarefa || item.tags?.length > 0) && (
        <div className="flex flex-wrap gap-1 mt-2">
          {item.tipo_tarefa && <Chip texto={item.tipo_tarefa} cor={tipo?.cor} />}
          {(item.tags || []).map((t) => <span key={t} className="inline-flex items-center h-6 px-2 rounded-full ring-1 ring-inset ring-ln-line text-xs text-ln-t3">{t}</span>)}
        </div>
      )}
      <div className="flex items-center gap-2.5 mt-2.5 min-w-0">
        <PrioridadeCampo valor={item.prioridade} comTexto={false} onChange={(v) => onAtualizar(item.id, { prioridade: v })} />
        <DataCampo valor={item.data_vencimento} item={item} formato="curta" onChange={(v) => onAtualizar(item.id, { data_vencimento: v })} />
        <span className="flex items-center gap-2 ml-auto text-[11px] text-ln-t4 tabular">
          {filhos.length > 0 && <span className="inline-flex items-center gap-0.5" title="Subtarefas"><CornerDownRight className="w-3 h-3" />{filhos.length}</span>}
          {check.total > 0 && <span className="inline-flex items-center gap-0.5" title="Checklist"><ListChecks className="w-3 h-3" />{check.feitos}/{check.total}</span>}
          {nComent > 0 && <span className="inline-flex items-center gap-0.5" title="Comentários"><MessageSquare className="w-3 h-3" />{nComent}</span>}
          {(item.anexos || []).length > 0 && <span className="inline-flex items-center gap-0.5"><Paperclip className="w-3 h-3" />{item.anexos.length}</span>}
        </span>
        <Avatares item={item} membrosMap={membrosMap} size={18} max={2} />
      </div>
    </div>
  )
}

function Coluna({ grupo, ctx, filhosDe }) {
  const [over, setOver] = useState(false)
  const { onCriar, listaPadraoId, agrupar, statuses, onMudarStatus, itensMap, onAtualizar } = ctx
  const itens = ordenarItens(grupo.itens)
  const podeSoltar = agrupar === 'status' || agrupar === 'prioridade'

  function soltar(e) {
    e.preventDefault()
    setOver(false)
    const id = e.dataTransfer.getData('text/tarefa')
    const item = itensMap[id]
    if (!item) return
    if (agrupar === 'status') {
      const s = statuses.find((x) => x.key === grupo.key)
      if (s && s.key !== item.status) onMudarStatus(item, s)
    } else if (agrupar === 'prioridade') {
      const p = PRIORIDADES.find((x) => x.key === grupo.key)
      onAtualizar(id, { prioridade: p ? p.key : null })
    }
  }

  return (
    <div
      onDragOver={(e) => { if (podeSoltar) { e.preventDefault(); setOver(true) } }}
      onDragLeave={() => setOver(false)}
      onDrop={soltar}
      className={`flex flex-col w-[300px] shrink-0 max-h-full rounded-lg transition-colors duration-150 ${over ? 'bg-ln-accent/10 ring-1 ring-ln-accent/40' : 'bg-ln-ink/[0.02]'}`}
    >
      <div className="flex items-center gap-1.5 h-9 px-3 shrink-0">
        <i className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: grupo.cor }} />
        <span className="text-[13px] font-medium text-ln-t2 truncate">{grupo.label}</span>
        <span className="text-[13px] text-ln-t3 tabular">{itens.length}</span>
        <div className="flex-1" />
        {listaPadraoId && (
          <button type="button" onClick={() => onCriar({ lista_id: listaPadraoId, titulo: 'Nova tarefa', status: agrupar === 'status' ? grupo.key : undefined })} className="ln-iconbtn !w-6 !h-6" title="Nova tarefa" aria-label="Nova tarefa">
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="flex-1 min-h-[48px] overflow-y-auto px-2 pb-2 flex flex-col gap-2">
        {itens.map((it) => <Card key={it.id} item={it} filhos={filhosDe.get(it.id) || []} ctx={ctx} arrastavel={podeSoltar} />)}
        {listaPadraoId && (
          <AdicionarInline placeholder="Adicionar tarefa" onCriar={(t) => onCriar({ lista_id: listaPadraoId, titulo: t, status: agrupar === 'status' ? grupo.key : undefined })} />
        )}
      </div>
    </div>
  )
}

export default function QuadroView({ grupos, filhosDe, ctx }) {
  return (
    <div className="flex gap-3 p-3 h-full overflow-x-auto items-start">
      {grupos.map((g) => <Coluna key={g.key} grupo={g} ctx={ctx} filhosDe={filhosDe} />)}
      {!grupos.length && <p className="text-[13px] text-ln-t4 py-10 px-2">Nenhuma tarefa aqui ainda</p>}
    </div>
  )
}
