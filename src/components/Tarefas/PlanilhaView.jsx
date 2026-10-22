// Visualização "Planilha": uma linha por tarefa, todas as propriedades em colunas,
// com edição direta e ordenação pelo cabeçalho.
import { useMemo, useState } from 'react'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { PRIORIDADES } from '../../lib/tarefas'
import { fmtDiaMes } from '../../lib/vertatask'
import { StatusCampo, PrioridadeCampo, ResponsavelCampo, DataCampo, EstimativaCampo, FOCO } from './Campos'
import RelacaoCampo from './RelacaoCampo'
import { EtiquetaChip } from './TarefaExtras'

const ORDEM_PRIO = Object.fromEntries(PRIORIDADES.map((p, i) => [p.key, i]))

const COLUNAS = [
  { k: 'titulo', rot: 'Nome', w: 'minmax(260px, 1.6fr)' },
  { k: 'status', rot: 'Status', w: '150px' },
  { k: 'prioridade', rot: 'Prioridade', w: '120px' },
  { k: 'resp', rot: 'Responsáveis', w: '120px' },
  { k: 'inicio', rot: 'Início', w: '84px' },
  { k: 'venc', rot: 'Vencimento', w: '96px' },
  { k: 'estimativa', rot: 'Estimativa', w: '92px' },
  { k: 'ciclo', rot: 'Cycle', w: '140px' },
  { k: 'etiquetas', rot: 'Etiquetas', w: 'minmax(140px, 1fr)' },
]
const GRID = COLUNAS.map((c) => c.w).join(' ')

export default function PlanilhaView({ itens, ctx, ciclos, etiquetasMap }) {
  const [ordem, setOrdem] = useState({ k: 'venc', dir: 1 })
  const { statuses, membros, membrosMap, onAbrir, onAtualizar, onMudarStatus, selecionadaId } = ctx

  const linhas = useMemo(() => {
    const v = (it) => {
      switch (ordem.k) {
        case 'titulo': return (it.titulo || '').toLowerCase()
        case 'status': return it.status || ''
        case 'prioridade': return ORDEM_PRIO[it.prioridade] ?? 99
        case 'inicio': return it.data_inicio || '9'
        case 'venc': return it.data_vencimento || '9'
        case 'estimativa': return it.estimativa_min ?? 1e9
        case 'ciclo': return ciclos.find((c) => c.id === it.ciclo_id)?.nome || '~'
        default: return 0
      }
    }
    return [...itens].sort((a, b) => (v(a) < v(b) ? -1 : v(a) > v(b) ? 1 : 0) * ordem.dir)
  }, [itens, ordem, ciclos])

  const ordenavel = new Set(['titulo', 'status', 'prioridade', 'inicio', 'venc', 'estimativa', 'ciclo'])
  if (!itens.length) return <p className="text-[13px] text-ln-t4 py-10 px-5">Nenhuma tarefa aqui ainda</p>

  return (
    <div className="p-3 overflow-x-auto">
      <div className="ln-card min-w-[1320px] overflow-hidden">
        <div className="grid items-center gap-x-3 h-9 px-3 border-b border-ln-ink/[0.08] bg-ln-ink/[0.02] text-[11px] uppercase tracking-wider font-bold text-ln-t4" style={{ gridTemplateColumns: GRID }} role="row">
          {COLUNAS.map((c) => (
            ordenavel.has(c.k) ? (
              <button key={c.k} type="button" onClick={() => setOrdem((o) => (o.k === c.k ? { k: c.k, dir: -o.dir } : { k: c.k, dir: 1 }))} className={`inline-flex items-center gap-1 text-left uppercase tracking-wider font-bold hover:text-ln-t2 rounded ${FOCO}`}>
                {c.rot}{ordem.k === c.k && (ordem.dir === 1 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
              </button>
            ) : <span key={c.k}>{c.rot}</span>
          ))}
        </div>
        {linhas.map((it) => (
          <div
            key={it.id}
            role="row"
            tabIndex={0}
            onClick={() => onAbrir(it.id)}
            onKeyDown={(e) => { if (e.key === 'Enter') onAbrir(it.id) }}
            className={`grid items-center gap-x-3 min-h-[40px] px-3 border-b border-ln-ink/5 last:border-0 cursor-pointer hover:bg-ln-ink/[0.03] ${selecionadaId === it.id ? 'bg-ln-ink/[0.04]' : ''} ${FOCO}`}
            style={{ gridTemplateColumns: GRID }}
          >
            <span className={`truncate text-[13px] font-medium ${it.status_tipo === 'closed' ? 'text-ln-t4 line-through' : 'text-ln-t1'}`}>{it.titulo}</span>
            <span onClick={(e) => e.stopPropagation()}><StatusCampo item={it} statuses={statuses} onChange={(s) => onMudarStatus(it, s)} /></span>
            <span onClick={(e) => e.stopPropagation()}><PrioridadeCampo valor={it.prioridade} onChange={(v) => onAtualizar(it.id, { prioridade: v })} /></span>
            <span onClick={(e) => e.stopPropagation()}><ResponsavelCampo item={it} membros={membros} membrosMap={membrosMap} size={18} max={3} onChange={(ids, extra) => onAtualizar(it.id, extra ? { responsaveis: ids, responsaveis_extra: extra } : { responsaveis: ids })} /></span>
            <span onClick={(e) => e.stopPropagation()}><DataCampo valor={it.data_inicio} formato="curta" placeholder="" onChange={(v) => onAtualizar(it.id, { data_inicio: v })} /></span>
            <span onClick={(e) => e.stopPropagation()}><DataCampo valor={it.data_vencimento} item={it} formato="curta" placeholder="" onChange={(v) => onAtualizar(it.id, { data_vencimento: v })} /></span>
            <span onClick={(e) => e.stopPropagation()}><EstimativaCampo valor={it.estimativa_min} vazio="" onChange={(v) => onAtualizar(it.id, { estimativa_min: v })} /></span>
            <span onClick={(e) => e.stopPropagation()} className="min-w-0"><RelacaoCampo valor={it.ciclo_id} cor="#2A25F0" vazio="" opcoes={ciclos.map((c) => ({ id: c.id, rotulo: c.nome, sub: `${fmtDiaMes(c.inicio)} a ${fmtDiaMes(c.fim)}` }))} onChange={(v) => onAtualizar(it.id, { ciclo_id: v })} /></span>
            <span className="flex flex-wrap gap-1 min-w-0">{(it.etiquetas || []).map((id) => <EtiquetaChip key={id} etiqueta={etiquetasMap.get(id)} />)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
