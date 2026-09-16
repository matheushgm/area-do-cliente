// Visualização "Quadro" (kanban) igual à do ClickUp: uma coluna por grupo
// (status por padrão), cards com responsável, data, prioridade e arrastar
// entre colunas para mudar de status.
import { useState } from 'react'
import { Plus, CornerDownRight, ListChecks, MessageSquare, Paperclip } from 'lucide-react'
import { ordenarItens, progressoChecklists, PRIORIDADES } from '../../lib/tarefas'
import { Avatares, DataCampo, PrioridadeCampo, AdicionarInline, Chip } from './Campos'
import { TIPOS_TAREFA } from '../../lib/tarefas'

function Card({ item, filhos, ctx, arrastavel }) {
  const { membrosMap, onAbrir, onAtualizar, contagemComentarios } = ctx
  const check = progressoChecklists(item.checklists)
  const nComent = contagemComentarios?.[item.id] || 0
  const tipo = TIPOS_TAREFA.find((t) => t.key === item.tipo_tarefa)
  return (
    <div
      draggable={arrastavel}
      onDragStart={(e) => { e.dataTransfer.setData('text/tarefa', item.id); e.dataTransfer.effectAllowed = 'move' }}
      onClick={() => onAbrir(item.id)}
      className="group/card bg-rl-card border border-rl-border rounded-xl p-3 shadow-sm hover:shadow-md hover:border-rl-purple/40 cursor-pointer transition mb-2"
    >
      <p className={`text-[13px] leading-snug mb-2 ${item.status_tipo === 'closed' ? 'text-rl-muted line-through' : 'text-rl-text'}`}>{item.titulo}</p>
      {(item.tipo_tarefa || item.tags?.length > 0) && (
        <div className="flex flex-wrap gap-1 mb-2">
          {item.tipo_tarefa && <Chip texto={item.tipo_tarefa} cor={tipo?.cor} className="!h-5 !text-[11px]" />}
          {(item.tags || []).map((t) => <span key={t} className="inline-flex items-center h-5 px-1.5 rounded-md text-[11px] bg-rl-surface text-rl-subtle border border-rl-border">{t}</span>)}
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap text-[12px] text-rl-subtle">
        <Avatares item={item} membrosMap={membrosMap} size={22} max={2} />
        <DataCampo valor={item.data_vencimento} item={item} formato="curta" icone onChange={(v) => onAtualizar(item.id, { data_vencimento: v })} />
        <PrioridadeCampo valor={item.prioridade} comTexto={false} onChange={(v) => onAtualizar(item.id, { prioridade: v })} />
        <span className="flex items-center gap-2 ml-auto text-[11px] text-rl-muted">
          {filhos.length > 0 && <span className="inline-flex items-center gap-0.5" title="Subtarefas"><CornerDownRight className="w-3 h-3" />{filhos.length}</span>}
          {check.total > 0 && <span className="inline-flex items-center gap-0.5" title="Checklist"><ListChecks className="w-3 h-3" />{check.feitos}/{check.total}</span>}
          {nComent > 0 && <span className="inline-flex items-center gap-0.5" title="Comentários"><MessageSquare className="w-3 h-3" />{nComent}</span>}
          {(item.anexos || []).length > 0 && <span className="inline-flex items-center gap-0.5"><Paperclip className="w-3 h-3" />{item.anexos.length}</span>}
        </span>
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
      className={`flex flex-col w-[290px] shrink-0 rounded-2xl transition ${over ? 'bg-rl-purple/8 ring-2 ring-rl-purple/40' : 'bg-rl-surface/60'}`}
    >
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className="inline-flex items-center h-[22px] px-2 rounded-md text-[11px] font-bold uppercase tracking-wide text-white" style={{ backgroundColor: grupo.cor }}>{grupo.label}</span>
        <span className="text-xs text-rl-muted">{itens.length}</span>
        <div className="flex-1" />
        {listaPadraoId && (
          <button type="button" onClick={() => onCriar({ lista_id: listaPadraoId, titulo: 'Nova tarefa', status: agrupar === 'status' ? grupo.key : undefined })} className="p-1 rounded text-rl-muted hover:text-rl-text hover:bg-rl-border/60" title="Nova tarefa">
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="flex-1 min-h-[60px] px-2 pb-2 overflow-y-auto scroll-hide">
        {itens.map((it) => <Card key={it.id} item={it} filhos={filhosDe.get(it.id) || []} ctx={ctx} arrastavel={podeSoltar} />)}
        {listaPadraoId && (
          <div className="px-1 pt-1">
            <AdicionarInline compacto placeholder="Adicionar Tarefa" onCriar={(t) => onCriar({ lista_id: listaPadraoId, titulo: t, status: agrupar === 'status' ? grupo.key : undefined })} />
          </div>
        )}
      </div>
    </div>
  )
}

export default function QuadroView({ grupos, filhosDe, ctx }) {
  return (
    <div className="flex gap-3 px-4 pb-6 h-full overflow-x-auto items-start">
      {grupos.map((g) => <Coluna key={g.key} grupo={g} ctx={ctx} filhosDe={filhosDe} />)}
      {!grupos.length && <p className="text-sm text-rl-muted py-10 px-2">Nenhuma tarefa aqui ainda.</p>}
    </div>
  )
}
