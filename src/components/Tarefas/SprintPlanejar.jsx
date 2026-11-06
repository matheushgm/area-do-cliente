// Planejamento da sprint de uma pessoa: objetivo e capacidade em cima, backlog à esquerda e
// o que ela assumiu à direita. A ordem da tela é a da conversa de sexta: objetivo antes das tarefas,
// transbordo antes do resto, e para quando a barra de carga chega na folga.
import { useMemo, useState } from 'react'
import { Plus, X, Check, ChevronRight, Search, Lock, LockOpen, History, Trash2, ListPlus } from 'lucide-react'
import { Avatar, FOCO } from './Campos'
import { BarraCarga, BotaoDelegar, CampoTexto, LinhaTarefa, TEXTO_CARGA, fmtPct } from './SprintComum'
import { pessoaDoPerfil } from '../../lib/tarefas'
import { FOLGA_RECOMENDADA, fmtMin, gruposDoBacklog, velocidadeDaPessoa } from '../../lib/sprints'

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
        <button type="button" onClick={() => onAddTodas(g.tarefas)} className={`text-[11px] text-ln-t3 hover:text-ln-accent inline-flex items-center gap-1 rounded px-1 ${FOCO}`} title="Adicionar todas deste grupo à sprint">
          <ListPlus className="w-3.5 h-3.5" /> Todas
        </button>
      </div>
      {aberto && (
        <>
          {vis.map((t) => (
            <LinhaTarefa
              key={t.id} tarefa={t} ctx={ctx}
              inicio={<button type="button" onClick={(e) => { e.stopPropagation(); onAdd(t) }} className="ln-iconbtn !w-6 !h-6 shrink-0 hover:!text-ln-accent" aria-label={`Adicionar ${t.titulo} à sprint`} title="Adicionar à sprint"><Plus className="w-4 h-4" /></button>}
            />
          ))}
          {g.tarefas.length > limite && <button type="button" onClick={() => setLimite((n) => n + LIMITE_GRUPO)} className={`w-full h-8 text-xs text-ln-accent hover:bg-ln-ink/[0.03] ${FOCO}`}>Mostrar mais ({g.tarefas.length - limite})</button>}
        </>
      )}
    </section>
  )
}

export default function SprintPlanejar({ sprint, anterior, fase, linha, resumo, tarefasMap, itensAnterior, pessoasSprint, s, ctx, acoes, membrosMap, somenteLeitura }) {
  const [escopo, setEscopo] = useState('dela')
  const [busca, setBusca] = useState('')
  const [cliente, setCliente] = useState('')
  const [verRemovidas, setVerRemovidas] = useState(false)
  const membro = membrosMap.get(linha.pessoa_id)
  const nome = membro?.name?.split(' ')[0] || 'pessoa'
  const confirmada = !!linha.confirmada_em
  const podeReabrir = confirmada && fase === 'futura'
  const combinadoAnterior = anterior && s.pessoas.find((p) => p.sprint_id === anterior.id && p.pessoa_id === linha.pessoa_id)?.retro_mudanca
  const velocidade = useMemo(() => velocidadeDaPessoa(s.sprints, s.pessoas, linha.pessoa_id, sprint.inicio), [s.sprints, s.pessoas, linha.pessoa_id, sprint.inicio])

  const idsNaSprint = useMemo(() => new Set(resumo.lista.filter((c) => !c.removida).map((c) => c.item.tarefa_id)), [resumo.lista])
  // a sprint anterior ainda aberta (sexta antes de concluir): o que ela tem aberto é o transbordo
  const idsTransbordo = useMemo(() => new Set(itensAnterior.filter((i) => i.pessoa_id === linha.pessoa_id && !i.removida_em && (!i.resultado || i.resultado === 'transbordou')).map((i) => i.tarefa_id)), [itensAnterior, linha.pessoa_id])

  const todas = useMemo(() => Object.values(tarefasMap).filter((t) => t.status_tipo !== 'closed' && !t.arquivada), [tarefasMap])
  const doEscopo = useMemo(() => todas.filter((t) => {
    const resp = t.responsaveis || []
    if (escopo === 'dela') return resp.includes(linha.pessoa_id) || idsTransbordo.has(t.id)
    if (escopo === 'sem') return !resp.length // quem só tem ex-funcionário como responsável também está sem dono
    return resp.length > 0 && !resp.includes(linha.pessoa_id)
  }), [todas, escopo, linha.pessoa_id, idsTransbordo])

  const clientes = useMemo(() => [...new Set(doEscopo.map((t) => ctx.clienteDe(t)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [doEscopo, ctx])
  const filtradas = useMemo(() => {
    const q = semAcento(busca.trim())
    return doEscopo.filter((t) => (!cliente || ctx.clienteDe(t) === cliente) && (!q || semAcento(`${t.titulo} ${ctx.clienteDe(t)}`).includes(q)))
  }, [doEscopo, busca, cliente, ctx])
  const grupos = useMemo(() => gruposDoBacklog(filtradas, { sprint, idsNaSprint, idsTransbordo, cfg: s.config }), [filtradas, sprint, idsNaSprint, idsTransbordo, s.config])
  const totalBacklog = grupos.reduce((a, g) => a + g.tarefas.length, 0)

  const saude = resumo.saude
  const sobra = saude.limiteMin - resumo.planejadoMin
  const textoCarga = saude.nivel === 'passou'
    ? `Passou ${fmtMin(resumo.planejadoMin - resumo.capMin)} da capacidade. Tire tarefa ou passe para outra pessoa.`
    : saude.nivel === 'justa'
      ? `Cabe, mas sem espaço para o que entrar no meio da semana. A folga recomendada é de ${Math.round(FOLGA_RECOMENDADA * 100)}%.`
      : saude.nivel === 'vazia'
        ? `Dá para planejar até ${fmtMin(saude.limiteMin)} e ainda sobrar ${Math.round(FOLGA_RECOMENDADA * 100)}% para imprevisto.`
        : `Ainda cabem ${fmtMin(sobra)} antes de encostar na folga.`

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="shrink-0 p-3 flex flex-col gap-2 border-b border-ln-ink/[0.06]">
        {combinadoAnterior && (
          <p className="ln-card !border-ln-accent/30 px-3 py-2 text-[13px] text-ln-t2 flex items-start gap-2"><History className="w-4 h-4 text-ln-accent mt-0.5 shrink-0" /><span><strong className="font-semibold">Combinado na última retro:</strong> {combinadoAnterior}</span></p>
        )}
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
          <div className="ln-card p-3 flex flex-col gap-2 min-w-0">
            <div className="flex items-center gap-2">
              {membro && <Avatar pessoa={pessoaDoPerfil(membro)} size={24} />}
              <p className="text-[14px] font-semibold text-ln-t1 truncate">Sprint de {membro?.name || 'pessoa'}</p>
              {confirmada && <span className="ln-pill !h-5 !px-1.5 text-[11px] !text-ln-green inline-flex items-center gap-1"><Lock className="w-3 h-3" /> Confirmada</span>}
              {!somenteLeitura && !confirmada && !resumo.lista.length && (
                <button type="button" onClick={() => acoes.removerPessoa(linha)} className="ln-iconbtn !w-6 !h-6 ml-auto hover:!text-ln-red" title="Tirar da sprint" aria-label={`Tirar ${nome} desta sprint`}><Trash2 className="w-3.5 h-3.5" /></button>
              )}
            </div>
            <label className="flex flex-col gap-1 text-xs text-ln-t3">Objetivo da semana
              <CampoTexto valor={linha.objetivo} onSalvar={(v) => s.atualizarPessoa(linha.id, { objetivo: v })} placeholder="O que precisa estar entregue até o fim da sprint, e como saber que foi" somenteLeitura={somenteLeitura} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ln-t3">Cliente em risco ou bloqueio
              <CampoTexto valor={linha.riscos} onSalvar={(v) => s.atualizarPessoa(linha.id, { riscos: v })} placeholder="O que pode atrapalhar, e de quem depende destravar" somenteLeitura={somenteLeitura} />
            </label>
          </div>
          <div className="ln-card p-3 flex flex-col gap-2 min-w-0">
            <div className="flex items-end gap-3 flex-wrap">
              <label className="flex flex-col gap-1 text-xs text-ln-t3">Dias
                <input type="number" min="0" max="7" step="0.5" disabled={somenteLeitura} className="ln-input !h-7 !w-16 tabular" value={Number(linha.dias_disponiveis)} onChange={(e) => s.atualizarPessoa(linha.id, { dias_disponiveis: Math.max(0, Number(e.target.value) || 0) })} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-ln-t3">Horas por dia
                <input type="number" min="0" max="12" step="0.5" disabled={somenteLeitura} className="ln-input !h-7 !w-16 tabular" value={Number(linha.horas_dia)} onChange={(e) => s.atualizarPessoa(linha.id, { horas_dia: Math.max(0, Number(e.target.value) || 0) })} />
              </label>
              <p className="ml-auto text-right">
                <span className={`text-xl font-semibold tabular tracking-tight ${TEXTO_CARGA[saude.nivel]}`}>{fmtMin(resumo.planejadoMin)}</span>
                <span className="text-sm text-ln-t4 tabular"> de {fmtMin(resumo.capMin)}</span>
              </p>
            </div>
            <BarraCarga saude={saude} />
            <p className="text-xs text-ln-t3">{textoCarga}</p>
            {velocidade && <p className="text-xs text-ln-t4">Nas últimas {velocidade.sprints === 1 ? 'sprint' : `${velocidade.sprints} sprints`}: entregou em média {fmtMin(velocidade.mediaEntregueMin)}, {fmtPct(velocidade.sayDo)} do combinado.</p>}
            {!somenteLeitura && (
              <div className="flex items-center gap-2 mt-auto pt-1">
                {!confirmada && <button type="button" onClick={() => acoes.confirmarPessoa(linha, resumo)} disabled={!resumo.ativos.length} className="ln-primary disabled:opacity-50"><Check className="w-3.5 h-3.5" /> Confirmar sprint</button>}
                {podeReabrir && <button type="button" onClick={() => acoes.reabrirPessoa(linha)} className="ln-pill"><LockOpen className="w-3.5 h-3.5" /> Reabrir planejamento</button>}
                {confirmada && !podeReabrir && <p className="text-xs text-ln-t4">Compromisso travado em {fmtMin(resumo.compromissoMin)}. O que entrar agora conta como fora do plano.</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-2 xl:divide-x divide-ln-ink/[0.06] overflow-y-auto xl:overflow-hidden">
        {/* Backlog */}
        {!somenteLeitura && (
          <div className="flex flex-col min-h-0">
            <div className="shrink-0 flex items-center gap-1.5 px-3 h-11 flex-wrap border-b border-ln-ink/[0.06]">
              {[['dela', `De ${nome}`], ['sem', 'Sem responsável'], ['outros', 'De outras pessoas']].map(([k, r]) => (
                <button key={k} type="button" onClick={() => setEscopo(k)} className={`ln-tab ${escopo === k ? 'ln-tab-active' : ''} ${FOCO}`}>{r}</button>
              ))}
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
              {grupos.map((g) => <GrupoBacklog key={`${escopo}:${g.key}`} g={g} ctx={ctx} onAdd={(t) => acoes.adicionar(linha, [t])} onAddTodas={(ts) => acoes.adicionar(linha, ts)} />)}
              {!totalBacklog && <p className="py-10 text-center text-[13px] text-ln-t4">{busca || cliente ? 'Nada encontrado com esse filtro.' : 'Nenhuma tarefa aberta aqui.'}</p>}
            </div>
          </div>
        )}

        {/* O que a pessoa assumiu */}
        <div className={`flex flex-col min-h-0 ${somenteLeitura ? 'xl:col-span-2' : ''}`}>
          <div className="shrink-0 flex items-center justify-between gap-2 px-3 h-11 border-b border-ln-ink/[0.06]">
            <p className="text-[13px] font-semibold text-ln-t1">Na sprint <span className="text-ln-t4 font-normal tabular">{resumo.ativos.length} · {fmtMin(resumo.planejadoMin)}</span></p>
            {resumo.semEstimativa > 0 && <p className="text-[11px] text-ln-t4" title="Sem estimativa, a conta usa as horas do tipo de tarefa, como a Capacidade do time. Clique nas horas para estimar.">{resumo.semEstimativa} com horas pelo tipo (~)</p>}
          </div>
          <div className="flex-1 min-h-[240px] overflow-y-auto">
            {resumo.ativos.map((c) => (
              <LinhaTarefa
                key={c.item.id} tarefa={c.tarefa} titulo={c.titulo} ctx={ctx} editavel={!somenteLeitura}
                etiqueta={<>
                  {c.transbordo && <span className="ln-pill !h-5 !px-1.5 text-[10px] shrink-0" title="Veio aberta da sprint anterior">Transbordo</span>}
                  {c.fora && <span className="ln-pill !h-5 !px-1.5 text-[10px] !text-ln-orange shrink-0" title="Entrou depois de confirmar a sprint">Fora do plano</span>}
                </>}
                fim={!somenteLeitura && (
                  <span className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {c.tarefa && <BotaoDelegar pessoas={pessoasSprint.filter((p) => p.id !== linha.id)} membrosMap={membrosMap} onEscolher={(dest) => acoes.delegar(c, linha, dest)} />}
                    <button type="button" onClick={() => acoes.remover(c, linha)} className="ln-iconbtn !w-6 !h-6 hover:!text-ln-red" aria-label={`Tirar ${c.titulo} da sprint`} title="Tirar da sprint"><X className="w-3.5 h-3.5" /></button>
                  </span>
                )}
              />
            ))}
            {!resumo.ativos.length && <p className="py-10 px-6 text-center text-[13px] text-ln-t4">{somenteLeitura ? 'Nenhuma tarefa nesta sprint.' : 'Clique no + de uma tarefa para colocar na sprint. Comece pelo que sobrou da semana anterior.'}</p>}
            {resumo.lista.some((c) => c.antecipada) && (
              <div className="border-t border-ln-ink/[0.05]">
                <p className="px-3 pt-2 pb-1 text-[11px] text-ln-t4">Concluídas antes de a sprint começar: não entram na conta</p>
                {resumo.lista.filter((c) => c.antecipada).map((c) => <LinhaTarefa key={c.item.id} tarefa={c.tarefa} titulo={c.titulo} ctx={ctx} apagada />)}
              </div>
            )}
            {resumo.removidas.length > 0 && (
              <div className="border-t border-ln-ink/[0.05]">
                <button type="button" onClick={() => setVerRemovidas((v) => !v)} className={`w-full flex items-center gap-1.5 h-8 px-3 text-xs text-ln-t3 ${FOCO}`} aria-expanded={verRemovidas}><ChevronRight className={`w-3.5 h-3.5 transition-transform ${verRemovidas ? 'rotate-90' : ''}`} />Tiradas depois de confirmar ({resumo.removidas.length})</button>
                {verRemovidas && resumo.removidas.map((c) => (
                  <LinhaTarefa key={c.item.id} tarefa={c.tarefa} titulo={c.titulo} ctx={ctx} apagada
                    fim={!somenteLeitura && c.tarefa && <button type="button" onClick={(e) => { e.stopPropagation(); acoes.adicionar(linha, [c.tarefa]) }} className="ln-iconbtn !w-6 !h-6" title="Trazer de volta" aria-label={`Trazer ${c.titulo} de volta`}><Plus className="w-3.5 h-3.5" /></button>}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
