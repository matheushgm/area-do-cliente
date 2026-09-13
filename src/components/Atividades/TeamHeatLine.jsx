// Linha de calor do time: ocupação agregada por dia útil (10 células), visual do Linear.
// Cada célula mostra "seg 14" + "88%" na cor de tomOcupacao e quem estoura no dia.
import { useMemo } from 'react'
import { DIAS, calorDoTime, tomOcupacao, fmtDiaCurto, fmtHoras, weekday } from '../../lib/atividadesCarga'

const TOTAL_CELULAS = 10
const FOCO = 'outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ln-t2'
const CELULA = 'h-7 min-w-0 rounded-md px-1.5 flex items-center justify-between gap-1 transition-colors duration-150'
const IDS_VAZIAS = Array.from({ length: TOTAL_CELULAS }, (_, i) => `vazia-${i}`)

/** '2026-09-14' → 'seg 14' */
export function rotuloDia(iso) {
  if (!iso) return ''
  return `${DIAS[weekday(iso)].toLowerCase()} ${Number(String(iso).slice(8, 10))}`
}

export function CelulaCalor({ dia, hoje, selecionado = false, onSelecionar }) {
  const pct = Number(dia.pct) || 0
  const tom = tomOcupacao(pct)
  const ehHoje = !!hoje && dia.data === hoje
  const estouram = dia.estouram || []
  const anel = selecionado ? 'ring-1 ring-ln-t2' : ehHoje ? 'ring-1 ring-ln-accent' : 'hover:ring-1 hover:ring-ln-ink/10'

  const linhasTitle = [`${fmtDiaCurto(dia.data)} · ${pct}% do time (${fmtHoras(dia.carga)} de ${fmtHoras(dia.capacidade)})`]
  if (estouram.length) linhasTitle.push(`Estouram: ${estouram.join(', ')}`)
  if (ehHoje) linhasTitle.push('Hoje')
  linhasTitle.push(selecionado ? 'Clique para limpar a seleção' : 'Clique para destacar este dia')

  const ariaLabel = `${fmtDiaCurto(dia.data)}, ${pct}% de ocupação do time${estouram.length ? `, ${estouram.length} ${estouram.length === 1 ? 'pessoa estoura' : 'pessoas estouram'}` : ''}${ehHoje ? ', hoje' : ''}`

  return (
    <button
      type="button"
      onClick={() => onSelecionar?.(selecionado ? null : dia.data)}
      title={linhasTitle.join('\n')}
      aria-label={ariaLabel}
      aria-pressed={selecionado}
      className={`${CELULA} ${tom.bg} ${anel} ${FOCO}`}
    >
      <span className={`text-[11px] leading-none truncate ${ehHoje ? 'text-ln-t2 font-medium' : 'text-ln-t4'}`}>{rotuloDia(dia.data)}</span>
      <span className="flex items-center gap-1 shrink-0">
        {estouram.length > 0 && (
          <span className="text-[10px] leading-4 px-1 rounded bg-ln-red/20 text-ln-red font-semibold tabular" title={`Estouram: ${estouram.join(', ')}`}>
            {estouram.length}▲
          </span>
        )}
        <span className={`text-xs leading-none font-medium tabular ${tom.text}`}>{pct}%</span>
      </span>
    </button>
  )
}

/**
 * @param {object}   p
 * @param {Array}    p.pessoas           pessoas enriquecidas (enriquecerPessoa)
 * @param {string}   p.hoje              yyyy-mm-dd
 * @param {string}   [p.diaSelecionado]  dia destacado (iso) ou null
 * @param {Function} [p.onSelecionarDia] (iso|null)
 */
export default function TeamHeatLine({ pessoas = [], hoje, diaSelecionado = null, onSelecionarDia }) {
  const calor = useMemo(() => calorDoTime(pessoas || []).slice(0, TOTAL_CELULAS), [pessoas])
  const vazias = IDS_VAZIAS.slice(0, Math.max(0, TOTAL_CELULAS - calor.length))

  return (
    <div
      className="grid grid-cols-10 gap-1"
      role="group"
      aria-label="Ocupação do time por dia útil"
      title={calor.length ? undefined : 'Sem leitura do time ainda'}
    >
      {calor.map((dia) => (
        <CelulaCalor
          key={dia.data || dia.i}
          dia={dia}
          hoje={hoje}
          selecionado={!!diaSelecionado && dia.data === diaSelecionado}
          onSelecionar={onSelecionarDia}
        />
      ))}
      {vazias.map((id) => (
        <div key={id} className={`${CELULA} bg-ln-ink/[0.03] justify-center`} aria-hidden="true">
          <span className="text-[11px] leading-none text-ln-t4">·</span>
        </div>
      ))}
    </div>
  )
}
