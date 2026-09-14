// Gráfico de carga por dia útil de uma pessoa (10 dias), em divs + Tailwind.
// Usado no painel da pessoa e no planejador (com a alocação da tarefa nova).
import { DIAS, fmtCurta, fmtHoras } from '../../lib/atividadesCarga'

/**
 * @param {object} p
 * @param {Array}  p.resumo        dias do resumo (data, diaSemana, capacidade, carga, excedente, tarefas, alocadoNovaTarefa)
 * @param {number} p.capacidade    horas/dia
 * @param {string} p.hoje          yyyy-mm-dd
 * @param {object} [p.sugestao]    { entrega, alocacao } da tarefa nova
 * @param {object} [p.forcada]     avaliação da data forçada { cabe, horasExcedentes, alocacao }
 * @param {string} [p.dataEscolhida]
 * @param {string} [p.diaSelecionado]  dia destacado (linha de calor do time)
 * @param {number} [p.altura]      px do gráfico (default 120)
 * @param {boolean} [p.legenda]    mostra a legenda (default true)
 * @param {Function} [p.onSelecionarDia]  (iso|null) => void; quando existe, as barras viram botões (clique de novo limpa)
 */
export default function CargaDiaria({ resumo = [], capacidade, hoje, sugestao = null, forcada = null, dataEscolhida = null, diaSelecionado = null, altura = 120, legenda = true, onSelecionarDia = null }) {
  const cap = Number(capacidade) || 6
  const forcando = !!(forcada && dataEscolhida)
  const maxBar = Math.max(cap * 1.5, ...resumo.map((d) => d.carga + (d.alocadoNovaTarefa || 0) + (d.excedente || 0)))
  const temNova = !!(sugestao || forcada)
  const colunas = resumo.map((d) => {
    const forcadoAqui = forcando ? forcada?.alocacao?.find((a) => a.data === d.data)?.horas || 0 : 0
    const novo = forcando ? forcadoAqui : (d.alocadoNovaTarefa || 0)
    const excForcado = forcando && d.data === dataEscolhida && forcada && !forcada.cabe ? forcada.horasExcedentes : 0
    const excedente = (d.excedente || 0) + excForcado
    const total = d.carga + novo + excedente
    const hTotal = Math.min(100, (total / maxBar) * 100)
    const part = (v) => (total > 0 ? `${(v / total) * 100}%` : '0%')
    return {
      data: d.data, diaSemana: d.diaSemana, carga: d.carga, novo, excedente, hTotal, part,
      hojeCol: d.data === hoje,
      entregaCol: d.data === (forcando ? dataEscolhida : sugestao?.entrega),
      selCol: d.data === diaSelecionado,
      title: `${DIAS[d.diaSemana]} ${fmtCurta(d.data)}: ${fmtHoras(d.carga)} na agenda${novo ? ` + ${fmtHoras(novo)} desta atividade` : ''}${excedente ? ` + ${fmtHoras(excedente)} de estouro` : ''} · ${d.tarefas} tarefa(s)`,
    }
  })
  return (
    <div>
      {legenda && (
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] text-ln-t4">Carga por dia útil · capacidade {fmtHoras(cap)}/dia</p>
          <div className="flex items-center gap-3 text-[11px] text-ln-t4">
            <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-sm bg-ln-brand/70 inline-block" /> na agenda</span>
            {temNova && <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-sm bg-ln-accent inline-block" /> esta atividade</span>}
            <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-sm bg-ln-red/80 inline-block" /> estouro</span>
          </div>
        </div>
      )}
      {/* Área das barras: a linha da capacidade e as barras compartilham a mesma
          base, sem os rótulos no meio (senão a barra sobe a altura do texto). */}
      <div className="relative flex items-end gap-1.5" style={{ height: altura }}>
        <div className="absolute left-0 right-0 border-t border-dashed border-ln-t4/50 pointer-events-none" style={{ bottom: `${(cap / maxBar) * 100}%` }}>
          <span className="absolute right-0 -top-4 text-[10px] text-ln-t4 tabular">{fmtHoras(cap)}</span>
        </div>
        {colunas.map((c) => {
          const Col = onSelecionarDia ? 'button' : 'div'
          const apagada = !!diaSelecionado && !c.selCol
          return (
            <Col
              key={c.data}
              type={onSelecionarDia ? 'button' : undefined}
              onClick={onSelecionarDia ? () => onSelecionarDia(c.selCol ? null : c.data) : undefined}
              aria-pressed={onSelecionarDia ? c.selCol : undefined}
              className={`flex-1 flex flex-col justify-end h-full min-w-0 rounded-t transition-opacity duration-150 ${onSelecionarDia ? 'cursor-pointer hover:bg-ln-ink/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ln-t2' : ''} ${apagada ? 'opacity-45' : ''}`}
              title={onSelecionarDia ? `${c.title}. ${c.selCol ? 'Clique para limpar o filtro' : 'Clique para ver as tarefas deste dia'}` : c.title}
            >
              <div className={`w-full flex flex-col-reverse rounded-t overflow-hidden ${c.selCol ? 'ring-2 ring-ln-t1' : ''}`} style={{ height: `${c.hTotal}%` }}>
                {c.carga > 0 && <div className="w-full bg-ln-brand/70" style={{ flexBasis: c.part(c.carga) }} />}
                {c.novo > 0 && <div className="w-full bg-ln-accent" style={{ flexBasis: c.part(c.novo) }} />}
                {c.excedente > 0 && <div className="w-full bg-ln-red/80" style={{ flexBasis: c.part(c.excedente) }} />}
              </div>
            </Col>
          )
        })}
      </div>
      {/* Rótulos dos dias, em linha própria, alinhados às colunas */}
      <div className="flex gap-1.5 mt-1.5">
        {colunas.map((c) => (
          <p key={c.data} className={`flex-1 min-w-0 text-[10px] leading-tight text-center tabular ${c.selCol ? 'text-ln-t1 font-semibold' : c.entregaCol ? 'text-ln-accent font-semibold' : c.hojeCol ? 'text-ln-t1 font-medium' : 'text-ln-t4'}`}>
            {DIAS[c.diaSemana]}<br />{fmtCurta(c.data)}
          </p>
        ))}
      </div>
    </div>
  )
}
