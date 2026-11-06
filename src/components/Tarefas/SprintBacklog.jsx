// Lista de tarefas para escolher: usada no planejamento de uma pessoa e para explodir uma meta em
// atividades. Mostra primeiro o que importa para a conversa (transbordo, atrasadas, o que vence na
// semana) e, por padrão, só tarefas dos clientes deste squad: quem está nos dois squads não vê aqui
// o trabalho do outro, a menos que abra a aba "Todas".
import { useMemo, useState } from 'react'
import { Plus, X, ChevronRight, Search, ListPlus } from 'lucide-react'
import { FOCO } from './Campos'
import { LinhaTarefa } from './SprintComum'
import { gruposDoBacklog } from '../../lib/sprints'

const LIMITE_GRUPO = 40
const semAcento = (s) => String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

function GrupoBacklog({ g, ctx, onAdd, onAddTodas }) {
  const [aberto, setAberto] = useState(g.aberto)
  const [limite, setLimite] = useState(LIMITE_GRUPO)
  const vis = g.tarefas.slice(0, limite)
  return (
    <section>
      <div className="flex items-center gap-1 h-9 px-2 bg-ln-ink/[0.02] border-y border-ln-ink/[0.05] sticky top-0 z-[1] backdrop-blur">
        <button type="button" onClick={() => setAberto((v) => !v)} className={`flex items-center gap-1.5 flex-1 min-w-0 text-left text-xs font-semibold text-ln-t2 rounded ${FOCO}`} aria-expanded={aberto}>
          <ChevronRight className={`w-3.5 h-3.5 text-ln-t4 transition-transform duration-150 ${aberto ? 'rotate-90' : ''}`} />
          <span className="truncate">{g.titulo}</span>
          <span className="text-ln-t4 font-normal tabular">{g.tarefas.length}</span>
        </button>
        <button type="button" onClick={() => onAddTodas(g.tarefas)} className={`text-[11px] text-ln-t3 hover:text-ln-accent inline-flex items-center gap-1 rounded px-1 ${FOCO}`} title="Adicionar todas deste grupo">
          <ListPlus className="w-3.5 h-3.5" /> Todas
        </button>
      </div>
      {aberto && (
        <>
          {vis.map((t) => (
            <LinhaTarefa
              key={t.id} tarefa={t} ctx={ctx}
              inicio={<button type="button" onClick={(e) => { e.stopPropagation(); onAdd(t) }} className="ln-iconbtn !w-6 !h-6 shrink-0 hover:!text-ln-accent" aria-label={`Adicionar ${t.titulo}`} title="Adicionar"><Plus className="w-4 h-4" /></button>}
            />
          ))}
          {g.tarefas.length > limite && <button type="button" onClick={() => setLimite((n) => n + LIMITE_GRUPO)} className={`w-full h-8 text-xs text-ln-accent hover:bg-ln-ink/[0.03] ${FOCO}`}>Mostrar mais ({g.tarefas.length - limite})</button>}
        </>
      )}
    </section>
  )
}

export default function SprintBacklog({ sprint, squadId, pessoaId = null, nomePessoa = '', membrosIds = [], tarefasMap, idsNaSprint, idsTransbordo, ctx, cfg, clienteInicial = '', onAdd, onAddTodas, antes = null }) {
  const [escopo, setEscopo] = useState(pessoaId ? 'dela' : 'squad')
  const [busca, setBusca] = useState('')
  const [cliente, setCliente] = useState(clienteInicial)

  const todas = useMemo(() => Object.values(tarefasMap).filter((t) => t.status_tipo !== 'closed' && !t.arquivada), [tarefasMap])
  const { squadDe, clienteDe } = ctx
  const doEscopo = useMemo(() => {
    const membros = new Set(membrosIds)
    const doSquad = (t) => { const q = squadDe(t); return !q || q === squadId }
    return todas.filter((t) => {
      const resp = t.responsaveis || []
      if (escopo === 'dela') return idsTransbordo.has(t.id) || (resp.includes(pessoaId) && doSquad(t))
      if (escopo === 'squad') return idsTransbordo.has(t.id) || (resp.some((id) => membros.has(id)) && doSquad(t))
      if (escopo === 'sem') return !resp.length && doSquad(t) // só com ex-funcionário como responsável também está sem dono
      return true
    })
  }, [todas, escopo, pessoaId, membrosIds, idsTransbordo, squadDe, squadId])

  const clientes = useMemo(() => [...new Set([...doEscopo.map((t) => clienteDe(t)), clienteInicial].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [doEscopo, clienteDe, clienteInicial])
  const filtradas = useMemo(() => {
    const q = semAcento(busca.trim())
    return doEscopo.filter((t) => (!cliente || clienteDe(t) === cliente) && (!q || semAcento(`${t.titulo} ${clienteDe(t)}`).includes(q)))
  }, [doEscopo, busca, cliente, clienteDe])
  const grupos = useMemo(() => gruposDoBacklog(filtradas, { sprint, idsNaSprint, idsTransbordo, cfg }), [filtradas, sprint, idsNaSprint, idsTransbordo, cfg])
  const total = grupos.reduce((a, g) => a + g.tarefas.length, 0)
  const abas = [[pessoaId ? 'dela' : 'squad', pessoaId ? `De ${nomePessoa}` : 'Do squad'], ['sem', 'Sem responsável'], ['todas', 'Todas']]

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="shrink-0 flex items-center gap-1.5 px-3 h-11 flex-wrap border-b border-ln-ink/[0.06]">
        {abas.map(([k, r]) => <button key={k} type="button" onClick={() => setEscopo(k)} className={`ln-tab ${escopo === k ? 'ln-tab-active' : ''} ${FOCO}`}>{r}</button>)}
      </div>
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-ln-ink/[0.06]">
        <div className="ln-input !h-8 flex items-center gap-1.5 flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 text-ln-t4 shrink-0" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar tarefa ou cliente" aria-label="Buscar tarefa ou cliente" className="flex-1 min-w-0 bg-transparent outline-none text-xs text-ln-t1 placeholder:text-ln-t4" />
          {busca && <button type="button" onClick={() => setBusca('')} className="text-ln-t4 hover:text-ln-t2" aria-label="Limpar busca"><X className="w-3 h-3" /></button>}
        </div>
        <select value={cliente} onChange={(e) => setCliente(e.target.value)} className="ln-input !h-8 !w-[150px] text-xs" aria-label="Filtrar por cliente">
          <option value="">Todos os clientes</option>
          {clientes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="flex-1 min-h-[240px] overflow-y-auto">
        {antes}
        {grupos.map((g) => <GrupoBacklog key={`${escopo}:${g.key}`} g={g} ctx={ctx} onAdd={onAdd} onAddTodas={onAddTodas} />)}
        {!total && <p className="py-10 text-center text-[13px] text-ln-t4">{busca || cliente ? 'Nada encontrado com esse filtro.' : 'Nenhuma tarefa aberta aqui.'}</p>}
      </div>
    </div>
  )
}
