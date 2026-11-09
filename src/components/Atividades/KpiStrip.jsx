// Faixa de 6 KPIs do time (módulo Atividades, visual do Linear).
// Recebe as pessoas já enriquecidas (enriquecerPessoa) e resume com kpisDoTime.
import { useMemo } from 'react'
import { NIVEIS, ORDEM_NIVEIS, kpisDoTime, calorDoTime, fmtHoras, fmtPct, fmtDiaCurto, rotuloNivel } from '../../lib/atividadesCarga'
import { useI18n } from '../../i18n'

const TOM_VALOR = {
  padrao: 'text-ln-t1',
  vermelho: 'text-ln-red',
  ambar: 'text-ln-yellow',
  laranja: 'text-ln-orange',
}
// `.ln-card` é declarado depois das utilities no index.css, então borda e fundo
// do estado ativo vão inline (tokens do tema, nunca cor fixa).
const ESTILO_ATIVO = { borderColor: 'rgb(var(--ln-t2) / 0.5)', backgroundColor: 'rgb(var(--ln-ink) / 0.03)' }
const FOCO = 'outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ln-t2'
const TILE = 'ln-card min-h-[64px] min-w-0 px-3 py-2.5 flex flex-col justify-between gap-0.5 text-left'
const IDS_SKELETON = ['ocupacao', 'vermelho', 'atrasadas', 'fora', 'alem', 'critico']

function tomPorPct(pct) {
  if (pct >= 100) return 'vermelho'
  if (pct >= 90) return 'ambar'
  return 'padrao'
}

export function Tile({ label, valor, sub, tom = 'padrao', title, ariaLabel, onClick, ativo = false, children }) {
  const corValor = TOM_VALOR[tom] || TOM_VALOR.padrao
  const conteudo = (
    <>
      <p className="text-[11px] leading-[14px] text-ln-t4 truncate">{label}</p>
      <div className={`text-[20px] leading-[22px] font-semibold tabular truncate ${corValor}`}>{valor}</div>
      {sub ? <p className="text-xs leading-[14px] text-ln-t3 truncate">{sub}</p> : null}
      {children}
    </>
  )
  if (!onClick) {
    return (
      <div className={TILE} title={title}>
        {conteudo}
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel || label}
      aria-pressed={ativo}
      style={ativo ? ESTILO_ATIVO : undefined}
      className={`${TILE} ${FOCO} cursor-pointer transition-colors duration-150 hover:bg-ln-ink/[0.03]`}
    >
      {conteudo}
    </button>
  )
}

export function TileSkeleton() {
  return (
    <div className={`${TILE} justify-center`} aria-hidden="true">
      <div className="ln-shimmer h-2.5 w-20 rounded" />
      <div className="ln-shimmer h-5 w-14 rounded mt-1" />
      <div className="ln-shimmer h-2.5 w-24 rounded mt-1" />
    </div>
  )
}

/** Mini barra segmentada (4px) com a quantidade de pessoas em cada nível de saúde. */
export function BarraNiveis({ porNivel = {}, total = 0 }) {
  const { t } = useI18n()
  if (!total) return <div className="h-1 mt-1 rounded-full bg-ln-ink/[0.06]" aria-hidden="true" />
  const resumo = ORDEM_NIVEIS.filter((n) => porNivel[n]).map((n) => `${rotuloNivel(n)}: ${porNivel[n]}`).join(', ')
  return (
    <div className="flex h-1 mt-1 gap-px rounded-full overflow-hidden bg-ln-ink/[0.06]" role="img" aria-label={t('atividades.kpi.pessoasPorNivel', { resumo })}>
      {ORDEM_NIVEIS.map((n) => {
        const q = porNivel[n] || 0
        if (!q) return null
        return <span key={n} className={`h-full ${NIVEIS[n].dot}`} style={{ width: `${(q / total) * 100}%` }} title={`${rotuloNivel(n)}: ${q}`} />
      })}
    </div>
  )
}

/**
 * @param {object}   p
 * @param {Array}    p.pessoas          pessoas enriquecidas (enriquecerPessoa)
 * @param {string}   p.hoje             yyyy-mm-dd
 * @param {string}   [p.diaSelecionado] dia destacado na linha de calor
 * @param {string}   [p.filtroNivel]    nível filtrado na tabela ('sobrecarregado' etc.)
 * @param {Function} [p.onFiltrarNivel] (nivel|null)
 * @param {Function} [p.onSelecionarDia] (iso|null)
 * @param {boolean}  [p.loading]
 * @param {object}   [p.progresso]      { lidas, total } da leitura do ClickUp
 * @param {number}   [p.diasAtrasoMaximo] limite (dias) a partir do qual a atrasada vira zumbi; default 14
 */
const GRID = {
  6: 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2',
  3: 'grid grid-cols-2 md:grid-cols-3 gap-2',
}

export default function KpiStrip({ pessoas = [], hoje, diaSelecionado = null, filtroNivel = null, onFiltrarNivel, onSelecionarDia, loading = false, progresso = null, diasAtrasoMaximo = 14, colunas = 6 }) {
  const { t } = useI18n()
  const gridCls = GRID[colunas] || GRID[6]
  const k = useMemo(() => kpisDoTime(pessoas || []), [pessoas])
  const dias = useMemo(() => calorDoTime(pessoas || []).length || 10, [pessoas])

  const lidas = progresso?.lidas ?? k.lidas
  const total = progresso?.total ?? k.total
  const semDados = k.lidas === 0

  if (loading && lidas === 0) {
    return (
      <div className={gridCls} aria-busy="true" aria-label={t('atividades.kpi.lendoTime')}>
        {IDS_SKELETON.map((id) => <TileSkeleton key={id} />)}
      </div>
    )
  }

  // 1. Ocupação do time
  const labelOcupacao = loading ? t('atividades.kpi.ocupacaoLendo', { lidas, total }) : t('atividades.kpi.ocupacao')
  const subOcupacao = semDados ? t('atividades.kpi.ninguemLido') : `${t('atividades.hDeH', { a: fmtHoras(k.horas), b: fmtHoras(k.capacidade) })} · ${t('atividades.diasUteis', { count: dias })}`

  // 2. No vermelho
  const vermelhos = k.sobrecarregados || []
  const filtroAtivo = filtroNivel === 'sobrecarregado'
  const nomesVermelhos = vermelhos.map((p) => p.nome).join(', ')
  const subVermelho = filtroAtivo
    ? t('atividades.kpi.filtroAtivo')
    : vermelhos.length > 0 ? t('atividades.kpi.cliqueFiltrar') : t('atividades.kpi.ninguemSobrecarregado')

  // 3. Atrasadas contadas
  const atrasadas = k.atrasadas || 0

  // 4. Fora do cálculo
  const zumbis = k.zumbis || 0
  const semData = k.semData || 0

  // 5. Além do horizonte
  const alem = k.alemDoHorizonte || 0
  const sobra = k.sobraFinal || 0
  const subAlem = sobra > 0 ? t('atividades.kpi.alemSobra', { horas: fmtHoras(sobra) }) : t('atividades.kpi.alemNaoCabem', { dias })

  // 6. Dia mais crítico
  const critico = k.critico || null
  const criticoSelecionado = !!critico && diaSelecionado === critico.data
  const estouram = critico?.estouram || []
  const subCritico = !critico
    ? ''
    : `${critico.data === hoje ? `${t('atividades.calor.hojeMinusc')} · ` : ''}${estouram.length > 0 ? t('atividades.pessoasEstouram', { count: estouram.length }) : t('atividades.kpi.ninguemEstoura')}`
  const titleCritico = !critico
    ? t('atividades.kpi.semLeituraTime')
    : `${fmtDiaCurto(critico.data)} · ${t('atividades.calor.pctDoTime', { pct: Math.round(Number(critico.pct) || 0), carga: fmtHoras(critico.carga), cap: fmtHoras(critico.capacidade) })}${estouram.length ? `\n${t('atividades.estouram', { nomes: estouram.join(', ') })}` : ''}\n${criticoSelecionado ? t('atividades.cliqueLimparSelecao') : t('atividades.cliqueDestacarDia')}`

  return (
    <div className={gridCls} aria-busy={loading || undefined}>
      <Tile
        label={labelOcupacao}
        valor={semDados ? <span className="text-ln-t4">·</span> : fmtPct(k.ocupacao)}
        sub={subOcupacao}
        tom={semDados ? 'padrao' : tomPorPct(k.ocupacao)}
        title={`${t('atividades.kpi.ocupacao')}: ${fmtPct(k.ocupacao)} · ${subOcupacao}`}
      >
        <BarraNiveis porNivel={k.porNivel} total={k.total} />
      </Tile>

      <Tile
        label={t('atividades.kpi.noVermelho')}
        valor={t('atividades.nDeTotal', { n: vermelhos.length, total: k.total })}
        sub={subVermelho}
        tom={vermelhos.length > 0 ? 'vermelho' : 'padrao'}
        title={vermelhos.length > 0 ? t('atividades.kpi.sobrecarregados', { nomes: nomesVermelhos }) : t('atividades.kpi.ninguemSobrecarregadoAgora')}
        ariaLabel={`${t('atividades.kpi.noVermelho')}: ${t('atividades.nDeTotal', { n: vermelhos.length, total: k.total })}. ${filtroAtivo ? t('atividades.kpi.limparFiltro') : t('atividades.kpi.filtrarSobrecarregados')}`}
        ativo={filtroAtivo}
        onClick={() => onFiltrarNivel?.(filtroAtivo ? null : 'sobrecarregado')}
      />

      <Tile
        label={t('atividades.kpi.atrasadasContadas')}
        valor={`${atrasadas} · ${fmtHoras(k.horasAtrasadas)}`}
        sub={t('atividades.caemEmHojeCalculo')}
        tom={atrasadas > 0 ? 'ambar' : 'padrao'}
        title={t('atividades.kpi.atrasadasTitle', { count: atrasadas, horas: fmtHoras(k.horasAtrasadas) })}
      />

      <Tile
        label={t('atividades.foraDoCalculo')}
        valor={zumbis + semData}
        sub={t('atividades.kpi.foraSub', { zumbis, dias: diasAtrasoMaximo, semData })}
        tom={zumbis > 0 ? 'laranja' : 'padrao'}
        title={t('atividades.kpi.foraTitle', { zumbis, dias: diasAtrasoMaximo, semData })}
      />

      <Tile
        label={t('atividades.kpi.alemHorizonte')}
        valor={fmtHoras(alem)}
        sub={subAlem}
        tom={sobra > 0 ? 'vermelho' : alem > 0 ? 'ambar' : 'padrao'}
        title={sobra > 0 ? t('atividades.kpi.alemTitleSobra', { alem: fmtHoras(alem), dias, sobra: fmtHoras(sobra) }) : t('atividades.kpi.alemTitle', { alem: fmtHoras(alem), dias })}
      />

      <Tile
        label={t('atividades.kpi.diaCritico')}
        valor={critico ? (
          <span className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-sm font-medium text-ln-t2 truncate">{fmtDiaCurto(critico.data)}</span>
            <span className="text-ln-t4 font-normal">·</span>
            <span>{fmtPct(critico.pct)}</span>
          </span>
        ) : <span className="text-sm font-medium text-ln-t4">{t('atividades.kpi.semDados')}</span>}
        sub={subCritico}
        tom={critico ? tomPorPct(critico.pct) : 'padrao'}
        title={titleCritico}
        ariaLabel={critico ? `${t('atividades.kpi.diaCritico')}: ${fmtDiaCurto(critico.data)}, ${fmtPct(critico.pct)}. ${criticoSelecionado ? t('atividades.kpi.limparSelecao') : t('atividades.kpi.destacarDia')}` : `${t('atividades.kpi.diaCritico')}: ${t('atividades.kpi.semDados')}`}
        ativo={criticoSelecionado}
        onClick={critico ? () => onSelecionarDia?.(criticoSelecionado ? null : critico.data) : undefined}
      />
    </div>
  )
}
