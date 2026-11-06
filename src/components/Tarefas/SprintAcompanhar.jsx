// Acompanhamento da sprint de uma pessoa durante a semana: combinado, entregue, o que falta,
// o que entrou fora do plano e o burndown. Status e estimativa editam a própria tarefa.
import { useMemo } from 'react'
import { AlertTriangle, Target } from 'lucide-react'
import { Avatar } from './Campos'
import { CartaoBurndown, LinhaTarefa, Tile, fmtPct } from './SprintComum'
import { pessoaDoPerfil } from '../../lib/tarefas'
import { calcularBurndownSprint, fmtMin, nTarefas } from '../../lib/sprints'

function Grupo({ titulo, itens, ctx, editavel, etiqueta }) {
  if (!itens.length) return null
  return (
    <section className="ln-card !p-0 overflow-hidden">
      <p className="px-3 h-9 flex items-center text-xs font-semibold text-ln-t2 border-b border-ln-ink/[0.05]">{titulo} <span className="ml-1.5 text-ln-t4 font-normal tabular">{itens.length}</span></p>
      {itens.map((c) => <LinhaTarefa key={c.item.id} tarefa={c.tarefa} titulo={c.titulo} ctx={ctx} editavel={editavel} etiqueta={etiqueta?.(c)} />)}
    </section>
  )
}

export default function SprintAcompanhar({ sprint, fase, linha, resumo, ctx, membrosMap, config }) {
  const membro = membrosMap.get(linha.pessoa_id)
  const bd = useMemo(() => calcularBurndownSprint(sprint, resumo.lista, config, undefined, resumo.confirmada), [sprint, resumo.lista, resumo.confirmada, config])
  const editavel = fase !== 'concluida'
  const planejadas = resumo.abertas.filter((c) => !c.fora)
  const foraAbertas = resumo.abertas.filter((c) => c.fora)
  return (
    <div className="h-full overflow-y-auto p-3 flex flex-col gap-3">
      <div className="ln-card px-3 py-2.5 flex items-start gap-2.5">
        {membro && <Avatar pessoa={pessoaDoPerfil(membro)} size={24} />}
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-ln-t1">Sprint de {membro?.name}</p>
          <p className={`text-[13px] flex items-start gap-1.5 mt-0.5 ${linha.objetivo ? 'text-ln-t2' : 'text-ln-t4'}`}><Target className="w-3.5 h-3.5 mt-[3px] shrink-0" />{linha.objetivo || 'Sem objetivo definido'}</p>
          {linha.riscos && <p className="text-[13px] text-ln-t2 flex items-start gap-1.5 mt-0.5"><AlertTriangle className="w-3.5 h-3.5 text-ln-yellow mt-[3px] shrink-0" />{linha.riscos}</p>}
          {!resumo.confirmada && resumo.ativos.length > 0 && <p className="text-xs text-ln-yellow mt-1">Esta sprint ainda não foi confirmada: o compromisso muda junto com as tarefas.</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        <Tile k="Combinado" v={fmtMin(resumo.compromissoMin)} sub={nTarefas(resumo.compromissoTarefas)} dica="Horas travadas ao confirmar a sprint" />
        <Tile k="Entregue" v={fmtMin(resumo.feitoMin)} sub={nTarefas(resumo.feitoTarefas)} tom={resumo.feitoTarefas ? 'green' : undefined} />
        <Tile k="Falta" v={fmtMin(resumo.restanteMin)} sub={nTarefas(resumo.abertas.length)} />
        <Tile k="Fora do plano" v={fmtMin(resumo.foraMin)} sub={nTarefas(resumo.foras.length)} tom={resumo.foras.length ? 'yellow' : undefined} dica="Entrou depois de confirmar a sprint" />
        <Tile k="Do combinado, saiu" v={fmtPct(resumo.sayDo)} dica="Horas entregues do que foi confirmado, dividido pelas horas confirmadas" />
      </div>
      <CartaoBurndown bd={bd} nome={`${sprint.nome}, ${membro?.name || ''}`} />
      <Grupo titulo="Falta entregar" itens={planejadas} ctx={ctx} editavel={editavel} etiqueta={(c) => c.transbordo ? <span className="ln-pill !h-5 !px-1.5 text-[10px] shrink-0">Transbordo</span> : null} />
      <Grupo titulo="Entrou fora do plano" itens={foraAbertas} ctx={ctx} editavel={editavel} />
      <Grupo titulo="Entregue" itens={resumo.feitos} ctx={ctx} editavel={editavel} etiqueta={(c) => c.fora ? <span className="ln-pill !h-5 !px-1.5 text-[10px] !text-ln-orange shrink-0">Fora do plano</span> : null} />
      <Grupo titulo="Tiradas depois de confirmar" itens={resumo.removidas} ctx={ctx} />
      {!resumo.lista.length && <p className="py-10 text-center text-[13px] text-ln-t4">Nenhuma tarefa nesta sprint.</p>}
    </div>
  )
}
