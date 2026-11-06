// Carga de uma pessoa na sprint do squad: capacidade e risco em cima, backlog à esquerda e o que ela
// assumiu à direita, com a meta de cada tarefa. As metas em si são planejadas em SprintMetas.
import { useMemo, useState } from 'react'
import { Plus, X, Check, ChevronRight, Lock, LockOpen, History, Trash2, Users } from 'lucide-react'
import { Avatar, FOCO } from './Campos'
import { BarraCarga, BotaoDelegar, CampoTexto, LinhaTarefa, TEXTO_CARGA, fmtPct } from './SprintComum'
import SprintBacklog from './SprintBacklog'
import { pessoaDoPerfil } from '../../lib/tarefas'
import { FOLGA_RECOMENDADA, fmtMin, velocidadeDaPessoa } from '../../lib/sprints'

export default function SprintPlanejar({ sprint, anterior, fase, linha, resumo, tarefasMap, idsNaSprint, idsTransbordo, outros, pessoasSprint, metas, sprintsDoSquad, squadId, s, ctx, acoes, membrosMap, somenteLeitura }) {
  const [verRemovidas, setVerRemovidas] = useState(false)
  const membro = membrosMap.get(linha.pessoa_id)
  const nome = membro?.name?.split(' ')[0] || 'pessoa'
  const confirmada = !!linha.confirmada_em
  const podeReabrir = confirmada && fase === 'futura'
  const combinadoAnterior = anterior && s.pessoas.find((p) => p.sprint_id === anterior.id && p.pessoa_id === linha.pessoa_id)?.retro_mudanca
  const velocidade = useMemo(() => velocidadeDaPessoa(sprintsDoSquad, s.pessoas, linha.pessoa_id, sprint.inicio), [sprintsDoSquad, s.pessoas, linha.pessoa_id, sprint.inicio])

  const saude = resumo.saude
  const sobra = saude.limiteMin - resumo.totalMin
  const folga = Math.round(FOLGA_RECOMENDADA * 100)
  const textoCarga = saude.nivel === 'passou'
    ? `Passou ${fmtMin(resumo.totalMin - resumo.capMin)} da capacidade. Tire tarefa ou passe para outra pessoa.`
    : saude.nivel === 'justa'
      ? `Cabe, mas sem espaço para o que entrar no meio da semana. A folga recomendada é de ${folga}%.`
      : saude.nivel === 'vazia'
        ? `Dá para planejar até ${fmtMin(saude.limiteMin)} e ainda sobrar ${folga}% para imprevisto.`
        : `Ainda cabem ${fmtMin(sobra)} antes de encostar na folga.`

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="shrink-0 p-3 flex flex-col gap-2 border-b border-ln-ink/[0.06]">
        {combinadoAnterior && (
          <p className="ln-card !border-ln-accent/30 px-3 py-2 text-[13px] text-ln-t2 flex items-start gap-2"><History className="w-4 h-4 text-ln-accent mt-0.5 shrink-0" /><span><strong className="font-semibold">Combinado na última retro:</strong> {combinadoAnterior}</span></p>
        )}
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,1fr)]">
          <div className="ln-card p-3 flex flex-col gap-2 min-w-0">
            <div className="flex items-center gap-2">
              {membro && <Avatar pessoa={pessoaDoPerfil(membro)} size={24} />}
              <p className="text-[14px] font-semibold text-ln-t1 truncate">{membro?.name || 'pessoa'} nesta sprint</p>
              {confirmada && <span className="ln-pill !h-5 !px-1.5 text-[11px] !text-ln-green inline-flex items-center gap-1"><Lock className="w-3 h-3" /> Confirmada</span>}
              {!somenteLeitura && !confirmada && !resumo.lista.length && (
                <button type="button" onClick={() => acoes.removerPessoa(linha)} className="ln-iconbtn !w-6 !h-6 ml-auto hover:!text-ln-red" title="Tirar do squad nesta sprint" aria-label={`Tirar ${nome} do squad nesta sprint`}><Trash2 className="w-3.5 h-3.5" /></button>
              )}
            </div>
            <label className="flex flex-col gap-1 text-xs text-ln-t3">Cliente em risco ou bloqueio
              <CampoTexto valor={linha.riscos} onSalvar={(v) => s.atualizarPessoa(linha.id, { riscos: v })} placeholder="O que pode atrapalhar, e de quem depende destravar" somenteLeitura={somenteLeitura} />
            </label>
            {outros?.nomes.length > 0 && (
              <p className="text-xs text-ln-t3 flex items-start gap-1.5"><Users className="w-3.5 h-3.5 mt-px shrink-0 text-ln-accent" />Também está no {outros.nomes.join(' e ')} nesta semana, com {fmtMin(outros.min)} assumidas. A capacidade é uma só e a barra soma os dois.</p>
            )}
          </div>
          <div className="ln-card p-3 flex flex-col gap-2 min-w-0">
            <div className="flex items-end gap-3 flex-wrap">
              <label className="flex flex-col gap-1 text-xs text-ln-t3">Dias
                <input type="number" min="0" max="7" step="0.5" disabled={somenteLeitura} className="ln-input !h-7 !w-16 tabular" value={Number(linha.dias_disponiveis)} onChange={(e) => acoes.capacidade(linha, { dias_disponiveis: Math.max(0, Number(e.target.value) || 0) })} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-ln-t3">Horas por dia
                <input type="number" min="0" max="12" step="0.5" disabled={somenteLeitura} className="ln-input !h-7 !w-16 tabular" value={Number(linha.horas_dia)} onChange={(e) => acoes.capacidade(linha, { horas_dia: Math.max(0, Number(e.target.value) || 0) })} />
              </label>
              <p className="ml-auto text-right">
                <span className={`text-xl font-semibold tabular tracking-tight ${TEXTO_CARGA[saude.nivel]}`}>{fmtMin(resumo.totalMin)}</span>
                <span className="text-sm text-ln-t4 tabular"> de {fmtMin(resumo.capMin)}</span>
              </p>
            </div>
            <BarraCarga saude={saude} />
            <p className="text-xs text-ln-t3">{textoCarga}</p>
            {velocidade && <p className="text-xs text-ln-t4">Nas últimas {velocidade.sprints === 1 ? 'sprint' : `${velocidade.sprints} sprints`} deste squad: entregou em média {fmtMin(velocidade.mediaEntregueMin)}, {fmtPct(velocidade.sayDo)} do combinado.</p>}
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
        {!somenteLeitura && (
          <div className="min-h-0">
            <SprintBacklog
              sprint={sprint} squadId={squadId} pessoaId={linha.pessoa_id} nomePessoa={nome} tarefasMap={tarefasMap}
              idsNaSprint={idsNaSprint} idsTransbordo={idsTransbordo} ctx={ctx} cfg={s.config}
              onAdd={(t) => acoes.adicionar(linha, [t])} onAddTodas={(ts) => acoes.adicionar(linha, ts)}
            />
          </div>
        )}

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
                  {!somenteLeitura && metas.length > 0 && (
                    <select value={c.item.meta_id || ''} onClick={(e) => e.stopPropagation()} onChange={(e) => s.vincularMeta(c.item, e.target.value || null)} aria-label={`Meta de ${c.titulo}`} className={`ln-input !h-6 !w-[110px] !px-1 text-[11px] shrink-0 ${c.item.meta_id ? '' : '!text-ln-t4'}`}>
                      <option value="">Sem meta</option>
                      {metas.map((m) => <option key={m.id} value={m.id}>{m.titulo}</option>)}
                    </select>
                  )}
                </>}
                fim={!somenteLeitura && (
                  <span className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {c.tarefa && <BotaoDelegar pessoas={pessoasSprint.filter((p) => p.id !== linha.id)} membrosMap={membrosMap} onEscolher={(dest) => acoes.delegar(c, linha, dest)} />}
                    <button type="button" onClick={() => acoes.remover(c, linha)} className="ln-iconbtn !w-6 !h-6 hover:!text-ln-red" aria-label={`Tirar ${c.titulo} da sprint`} title="Tirar da sprint"><X className="w-3.5 h-3.5" /></button>
                  </span>
                )}
              />
            ))}
            {!resumo.ativos.length && <p className="py-10 px-6 text-center text-[13px] text-ln-t4">{somenteLeitura ? 'Nenhuma tarefa nesta sprint.' : 'As atividades escolhidas nas metas aparecem aqui. Também dá para puxar pelo + ao lado.'}</p>}
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
