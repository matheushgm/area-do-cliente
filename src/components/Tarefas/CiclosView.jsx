// Cabeçalho da aba Cycles: seletor de ciclo, criação, resumo e burndown.
// A lista/quadro das tarefas do ciclo é a própria view do módulo, abaixo.
import { useMemo, useState } from 'react'
import { Plus, Trash2, Check, X, Pencil, ArrowRightLeft } from 'lucide-react'
import { calcularBurndown, faseDoCiclo, fmtDiaMes, fmtHoras, sugerirCiclo, ROTULO_FASE, hojeISO, diasEntre, somarDias } from '../../lib/vertatask'
import { FOCO } from './Campos'

function Burndown({ bd, unidade, ciclo }) {
  const W = 860, H = 210, L = 36, B = 24, T = 10, R = 24
  const x = (i) => L + (bd.dias > 1 ? (i * (W - L - R)) / (bd.dias - 1) : 0)
  const y = (v) => T + (H - T - B) * (1 - (bd.total ? v / bd.total : 0))
  const pl = (a) => a.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const grade = [0, 1, 2, 3, 4].map((k) => (bd.total * k) / 4)
  const rotulo = (v) => (unidade === 'horas' ? `${Math.round(v)}h` : String(Math.round(v)))
  const ultimo = bd.real.length - 1
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Burndown de ${ciclo.nome}`}>
      {grade.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="rgb(var(--ln-ink) / 0.08)" />
          <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="rgb(var(--ln-ink) / 0.45)">{rotulo(v)}</text>
        </g>
      ))}
      {Array.from({ length: bd.dias }, (_, i) => i).filter((i) => i % 2 === 0 || i === bd.dias - 1).map((i) => (
        <text key={i} x={x(i)} y={H - 7} textAnchor="middle" fontSize="10" fill="rgb(var(--ln-ink) / 0.45)">{fmtDiaMes(somarDias(ciclo.inicio, i))}</text>
      ))}
      <polyline points={pl(bd.ideal)} fill="none" stroke="rgb(var(--ln-ink) / 0.25)" strokeWidth="2" strokeDasharray="5 4" />
      {bd.real.length > 0 && (
        <>
          <polyline points={pl(bd.real)} fill="none" stroke="rgb(var(--ln-accent))" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(ultimo)} cy={y(bd.real[ultimo])} r="4" fill="rgb(var(--ln-accent))" />
        </>
      )}
    </svg>
  )
}

function Tile({ k, v, sub, alerta }) {
  return (
    <div className="ln-card px-3 py-2.5 min-w-0">
      <p className="text-[11px] uppercase tracking-wider text-ln-t4 font-medium">{k}</p>
      <p className={`text-xl font-semibold tabular tracking-tight ${alerta ? 'text-ln-red' : 'text-ln-t1'}`}>{v}{sub && <span className="text-sm font-normal text-ln-t4"> {sub}</span>}</p>
    </div>
  )
}

export default function CiclosView({ ciclos, ciclo, itens, onSel, vt, onToast, unidade, onUnidade, membros = [], onMoverPendentes }) {
  const [novo, setNovo] = useState(null)
  const [edit, setEdit] = useState(null)
  const [destino, setDestino] = useState('')
  const hoje = hojeISO()
  const topo = useMemo(() => itens.filter((i) => i.ciclo_id === ciclo?.id && !i.parent_id), [itens, ciclo?.id])
  const bd = useMemo(() => (ciclo ? calcularBurndown(ciclo, topo, unidade) : null), [ciclo, topo, unidade])
  const atrasadas = topo.filter((i) => i.status_tipo !== 'closed' && i.data_vencimento && i.data_vencimento.slice(0, 10) < hoje).length
  const fmt = (n) => (unidade === 'horas' ? fmtHoras(n) : String(Math.round(n)))
  const pct = bd?.total ? Math.round((bd.feito / bd.total) * 100) : 0
  const diaAtual = ciclo ? Math.max(0, Math.min(diasEntre(ciclo.inicio, ciclo.fim) + 1, diasEntre(ciclo.inicio, hoje) + 1)) : 0

  const pendentes = topo.filter((i) => i.status_tipo !== 'closed')
  const outros = ciclos.filter((c) => c.id !== ciclo?.id && c.fim >= hoje)
  async function salvarEdicao(e) {
    e.preventDefault()
    if (!edit.nome.trim() || edit.fim < edit.inicio) { onToast('Confira o nome e as datas do cycle', 'error'); return }
    const r = await vt.atualizarCiclo(ciclo.id, { nome: edit.nome.trim(), inicio: edit.inicio, fim: edit.fim, descricao: edit.descricao?.trim() || null, responsavel_id: edit.responsavel_id || null })
    if (r.error) onToast(r.error, 'error'); else { setEdit(null); onToast('Cycle atualizado') }
  }

  async function criar(e) {
    e.preventDefault()
    if (!novo.nome.trim() || novo.fim < novo.inicio) { onToast('Confira o nome e as datas do cycle', 'error'); return }
    const r = await vt.criarCiclo(novo)
    if (r.error) { onToast(r.error, 'error'); return }
    setNovo(null)
    onSel(r.data.id)
  }

  return (
    <div className="p-3 flex flex-col gap-3 border-b border-ln-ink/5">
      <div className="flex items-center gap-1.5 flex-wrap">
        {ciclos.map((c) => (
          <button key={c.id} type="button" onClick={() => onSel(c.id)} className={`ln-tab ${c.id === ciclo?.id ? 'ln-tab-active' : ''} ${FOCO}`}>
            {c.nome} <span className="text-ln-t4 font-normal">{fmtDiaMes(c.inicio)} a {fmtDiaMes(c.fim)}</span>
            <span className="text-[10px] uppercase tracking-wider text-ln-t4">{ROTULO_FASE[faseDoCiclo(c)]}</span>
          </button>
        ))}
        {!novo && <button type="button" onClick={() => setNovo(sugerirCiclo(ciclos))} className="ln-pill"><Plus className="w-3.5 h-3.5" /> Novo cycle</button>}
      </div>

      {novo && (
        <form onSubmit={criar} className="ln-card p-3 flex items-end gap-2 flex-wrap">
          <label className="flex flex-col gap-1 text-xs text-ln-t3">Nome<input className="ln-input !h-8 !w-[180px]" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} autoFocus /></label>
          <label className="flex flex-col gap-1 text-xs text-ln-t3">Início<input type="date" className="ln-input !h-8" value={novo.inicio} onChange={(e) => setNovo({ ...novo, inicio: e.target.value })} /></label>
          <label className="flex flex-col gap-1 text-xs text-ln-t3">Fim<input type="date" className="ln-input !h-8" value={novo.fim} onChange={(e) => setNovo({ ...novo, fim: e.target.value })} /></label>
          <button type="submit" className="ln-primary"><Check className="w-3.5 h-3.5" /> Criar</button>
          <button type="button" onClick={() => setNovo(null)} className="ln-pill"><X className="w-3.5 h-3.5" /> Cancelar</button>
        </form>
      )}

      {!ciclo && !novo && (
        <div className="ln-card p-6 text-[13px] text-ln-t3 max-w-xl">
          Nenhum cycle criado ainda. Um cycle é um período fixo (a sugestão é de 14 dias) em que o time se compromete com um conjunto de tarefas.
        </div>
      )}

      {ciclo && bd && (
        <>
          <div className="flex items-center justify-between gap-2 max-w-4xl">
            <div className="flex items-center gap-1" role="group" aria-label="Unidade do burndown">
              <button type="button" onClick={() => onUnidade('tarefas')} className={`ln-pill ${unidade === 'tarefas' ? '!bg-ln-ink/[0.08] !text-ln-t1' : ''}`}>Tarefas</button>
              <button type="button" onClick={() => onUnidade('horas')} className={`ln-pill ${unidade === 'horas' ? '!bg-ln-ink/[0.08] !text-ln-t1' : ''}`}>Horas estimadas</button>
            </div>
            <div className="flex items-center gap-1">
            <button type="button" onClick={() => setEdit({ nome: ciclo.nome, inicio: ciclo.inicio, fim: ciclo.fim, descricao: ciclo.descricao || '', responsavel_id: ciclo.responsavel_id || '' })} className="ln-iconbtn" aria-label="Editar cycle" title="Editar cycle"><Pencil className="w-3.5 h-3.5" /></button>
            <button
              type="button"
              onClick={async () => { if (window.confirm(`Excluir o ${ciclo.nome}? As tarefas continuam, só saem do cycle.`)) { const r = await vt.excluirCiclo(ciclo.id); if (r.error) onToast(r.error, 'error'); else onToast('Cycle excluído') } }}
              className="ln-iconbtn hover:!text-ln-red" aria-label="Excluir cycle" title="Excluir cycle"
            ><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          {edit && (
            <form onSubmit={salvarEdicao} className="ln-card p-3 grid gap-2 md:grid-cols-4 max-w-4xl items-end">
              <label className="flex flex-col gap-1 text-xs text-ln-t3 md:col-span-2">Nome<input className="ln-input !h-8" value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} autoFocus /></label>
              <label className="flex flex-col gap-1 text-xs text-ln-t3">Início<input type="date" className="ln-input !h-8" value={edit.inicio} onChange={(e) => setEdit({ ...edit, inicio: e.target.value })} /></label>
              <label className="flex flex-col gap-1 text-xs text-ln-t3">Fim<input type="date" className="ln-input !h-8" value={edit.fim} onChange={(e) => setEdit({ ...edit, fim: e.target.value })} /></label>
              <label className="flex flex-col gap-1 text-xs text-ln-t3 md:col-span-2">Responsável<select className="ln-input !h-8" value={edit.responsavel_id} onChange={(e) => setEdit({ ...edit, responsavel_id: e.target.value })}><option value="">Sem responsável</option>{membros.filter((m) => !m.disabled).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
              <label className="flex flex-col gap-1 text-xs text-ln-t3 md:col-span-2">Objetivo do cycle<input className="ln-input !h-8" value={edit.descricao} onChange={(e) => setEdit({ ...edit, descricao: e.target.value })} placeholder="O que o time quer fechar nestas duas semanas" /></label>
              <div className="flex gap-2 md:col-span-4"><button type="submit" className="ln-primary"><Check className="w-3.5 h-3.5" /> Salvar</button><button type="button" onClick={() => setEdit(null)} className="ln-pill"><X className="w-3.5 h-3.5" /> Cancelar</button></div>
            </form>
          )}
          {(ciclo.descricao || ciclo.responsavel_id) && !edit && (
            <p className="text-[13px] text-ln-t3 max-w-4xl">{ciclo.descricao}{ciclo.responsavel_id && membros.find((m) => m.id === ciclo.responsavel_id) ? <span className="text-ln-t4">{ciclo.descricao ? ' · ' : ''}Responsável: {membros.find((m) => m.id === ciclo.responsavel_id).name}</span> : null}</p>
          )}
          {pendentes.length > 0 && outros.length > 0 && onMoverPendentes && (
            <div className="ln-card px-3 py-2 max-w-4xl flex items-center gap-2 flex-wrap text-[13px] text-ln-t2">
              <ArrowRightLeft className="w-4 h-4 text-ln-accent shrink-0" />
              <span>{pendentes.length} tarefa(s) ainda abertas. Passar para</span>
              <select className="ln-input !h-8 !w-[200px]" value={destino} onChange={(e) => setDestino(e.target.value)} aria-label="Cycle de destino"><option value="">Escolha o cycle</option>{outros.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
              <button type="button" disabled={!destino} onClick={async () => { await onMoverPendentes(ciclo.id, destino); setDestino('') }} className="ln-pill disabled:opacity-50">Mover pendentes</button>
            </div>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 max-w-4xl">
            <Tile k="Progresso" v={`${pct}%`} />
            <Tile k={unidade === 'horas' ? 'Horas feitas' : 'Tarefas feitas'} v={fmt(bd.feito)} sub={`/ ${fmt(bd.total)}`} />
            <Tile k="Dia do cycle" v={String(diaAtual)} sub={`/ ${bd.dias}`} />
            <Tile k="Atrasadas" v={String(atrasadas)} alerta={atrasadas > 0} />
          </div>
          <div className="ln-card p-3 max-w-4xl">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[13px] font-medium text-ln-t2">Burndown</p>
              <div className="flex items-center gap-3 text-[11px] text-ln-t4">
                <span className="inline-flex items-center gap-1.5"><i className="w-3 h-0.5 bg-ln-ink/25" />Ritmo ideal</span>
                <span className="inline-flex items-center gap-1.5"><i className="w-3 h-0.5 bg-ln-accent" />Restante</span>
              </div>
            </div>
            {bd.total > 0
              ? <Burndown bd={bd} unidade={unidade} ciclo={ciclo} />
              : <p className="py-8 text-center text-[13px] text-ln-t4">{unidade === 'horas' ? 'Nenhuma tarefa deste cycle tem estimativa. Troque para "Tarefas" ou estime as tarefas.' : 'Sem tarefas neste cycle. Abra uma tarefa e escolha o Cycle, ou crie uma aqui embaixo.'}</p>}
            {unidade === 'horas' && bd.semEstimativa > 0 && bd.total > 0 && <p className="text-[11px] text-ln-t4 mt-1">{bd.semEstimativa} tarefa(s) sem estimativa não entram na conta.</p>}
          </div>
        </>
      )}
    </div>
  )
}
