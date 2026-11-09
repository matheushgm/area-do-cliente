// Relatório de tarefas concluídas (módulo Atividades, visual do Linear).
// Recebe as tarefas já lidas do ClickUp (useConcluidas) e monta: KPIs do
// período, faixa por dia, ranking por colaborador e por cliente e o relatório
// de cada pessoa dividido por dia. Filtros de pessoa/cliente/dia vêm da página.
import { useMemo, useState } from 'react'
import { CheckCircle2, ChevronRight, CornerDownRight, ExternalLink, Loader2, RefreshCw, X, AlertTriangle } from 'lucide-react'
import { Tile } from './KpiStrip'
import { Avatar } from './IssueList'
import { fmtCurta, fmtHoras, fmtHora, fmtRelativo, primeiroNome, rotuloOrigem } from '../../lib/atividadesCarga'
import {
  SEM_RESPONSAVEL_KEY, agregarConcluidas, aplicarFiltros, diasDoIntervalo, diasEntre, enriquecerTarefas,
  filtrarPorPeriodo, nomeCliente, rotuloDia, rotuloDiaBase, rotuloIntervalo,
} from '../../lib/atividadesConcluidas'
import { useI18n, t as tr } from '../../i18n'
import { rotuloTipoTarefa } from '../../lib/tarefas'

const FOCO = 'outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ln-t2'
const ESTILO_ATIVO = { borderColor: 'rgb(var(--ln-t2) / 0.5)', backgroundColor: 'rgb(var(--ln-ink) / 0.03)' }

function textoPeriodo(periodo, intervalo) {
  if (periodo === 'hoje') return tr('atividadesConcluidas.texto.hoje')
  if (periodo === 'ontem') return tr('atividadesConcluidas.texto.ontem')
  if (periodo === '7dias') return tr('atividadesConcluidas.texto.seteDias')
  if (!intervalo) return tr('atividadesConcluidas.texto.noPeriodo')
  return intervalo.desde === intervalo.ate
    ? tr('atividadesConcluidas.texto.em', { data: fmtCurta(intervalo.desde) })
    : tr('atividadesConcluidas.texto.deAte', { desde: fmtCurta(intervalo.desde), ate: fmtCurta(intervalo.ate) })
}

// ─── Faixa por dia (só nos 7 dias) ───────────────────────────────────────────

function FaixaDias({ porDia, hoje, diaSelecionado, onSelecionarDia }) {
  const { t } = useI18n()
  const max = Math.max(1, ...porDia.map((d) => d.total))
  return (
    <div className="ln-card px-3 py-2.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] text-ln-t4">{t('atividadesConcluidas.porDia')}</p>
        {diaSelecionado && (
          <button onClick={() => onSelecionarDia(null)} className="ln-pill !h-6 !px-2 !text-[11px]">{t('atividadesConcluidas.so', { dia: rotuloDia(diaSelecionado, hoje) })} <X className="w-3 h-3" /></button>
        )}
      </div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${porDia.length}, minmax(0, 1fr))` }}>
        {porDia.slice().reverse().map((d) => {
          const ativo = diaSelecionado === d.dia
          const h = Math.round((d.total / max) * 40)
          return (
            <button
              key={d.dia}
              type="button"
              onClick={() => onSelecionarDia(ativo ? null : d.dia)}
              aria-pressed={ativo}
              title={`${rotuloDia(d.dia, hoje)}: ${t('atividades.nTarefas', { count: d.total })} · ${fmtHoras(d.horas)}`}
              className={`group flex flex-col items-center gap-1 rounded-lg px-1 pt-1 pb-1.5 transition-colors duration-150 hover:bg-ln-ink/[0.03] ${FOCO} ${ativo ? 'bg-ln-ink/[0.05]' : ''}`}
            >
              <span className={`text-xs font-semibold tabular ${d.total ? 'text-ln-t1' : 'text-ln-t4'}`}>{d.total}</span>
              <span className="w-full h-10 flex items-end">
                <span className={`w-full rounded-sm ${d.total ? (ativo ? 'bg-ln-accent' : 'bg-ln-accent/60 group-hover:bg-ln-accent/80') : 'bg-ln-ink/[0.06]'}`} style={{ height: `${Math.max(2, h)}px` }} />
              </span>
              <span className={`text-[11px] leading-[14px] truncate max-w-full ${d.dia === hoje ? 'text-ln-t2 font-medium' : 'text-ln-t4'}`}>{rotuloDiaBase(d.dia)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Ranking (colaborador / cliente) ─────────────────────────────────────────

function Ranking({ titulo, subtitulo, itens, ativoKey, onEscolher, tipo, limite = 8 }) {
  const { t } = useI18n()
  const [tudo, setTudo] = useState(false)
  const max = Math.max(1, ...itens.map((i) => i.total))
  const visiveis = tudo ? itens : itens.slice(0, limite)
  return (
    <div className="ln-card px-3 py-2.5 min-w-0">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <p className="text-xs font-medium text-ln-t1">{titulo}</p>
        <p className="text-[11px] text-ln-t4 truncate">{subtitulo}</p>
      </div>
      {itens.length === 0 ? (
        <p className="text-xs text-ln-t4 py-3 text-center">{t('atividadesConcluidas.nadaPorAqui')}</p>
      ) : (
        <ul className="space-y-0.5">
          {visiveis.map((it) => {
            const key = tipo === 'pessoa' ? it.key : it.nome
            const ativo = ativoKey === key
            const nome = tipo === 'pessoa' ? (it.nome || t('atividades.semResponsavel')) : nomeCliente(it.nome)
            const detalhe = tipo === 'pessoa'
              ? (it.clientes.length ? `${t('atividadesConcluidas.nClientes', { count: it.clientes.length })} · ${it.clientes.slice(0, 2).map((c) => `${nomeCliente(c.nome)} (${c.tarefas})`).join(', ')}` : '')
              : (it.pessoas.length ? it.pessoas.slice(0, 3).map((p) => `${p.nome ? primeiroNome(p.nome) : t('atividadesConcluidas.semResp')} (${p.tarefas})`).join(', ') + (it.pessoas.length > 3 ? ` +${it.pessoas.length - 3}` : '') : '')
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => onEscolher(ativo ? null : key)}
                  aria-pressed={ativo}
                  style={ativo ? ESTILO_ATIVO : undefined}
                  className={`ln-row-hover w-full grid items-center gap-x-2.5 px-2 py-1.5 text-left border border-transparent ${FOCO}`}
                  title={`${nome}: ${t('atividades.nTarefas', { count: it.total })} · ${fmtHoras(it.horas)} · ${t('atividadesConcluidas.pctPeriodo', { pct: it.pct })}`}
                  // avatar | nome+barra | tarefas | horas | %
                  // (grid inline: Tailwind não vê template dinâmico)
                >
                  <span className="grid items-center gap-x-2.5" style={{ gridTemplateColumns: '20px minmax(0,1fr) 40px 48px 36px' }}>
                    {tipo === 'pessoa'
                      ? <Avatar nome={it.nome} tamanho={20} className={it.key === SEM_RESPONSAVEL_KEY ? '' : ''} />
                      : <span className="w-5 h-5 rounded-md bg-ln-ink/5 text-ln-t3 text-[10px] font-semibold inline-flex items-center justify-center">{String(nome).slice(0, 1).toUpperCase()}</span>}
                    <span className="min-w-0">
                      <span className="flex items-baseline gap-2 min-w-0">
                        <span className={`text-[13px] truncate shrink-0 max-w-[60%] ${it.key === SEM_RESPONSAVEL_KEY ? 'text-ln-t3 italic' : 'text-ln-t1'}`}>{nome}</span>
                        {detalhe && <span className="text-[11px] text-ln-t4 truncate min-w-0 hidden sm:inline">{detalhe}</span>}
                      </span>
                      <span className="block h-1 mt-1 rounded-full bg-ln-ink/[0.06] overflow-hidden">
                        <span className={`block h-full rounded-full ${tipo === 'pessoa' ? 'bg-ln-accent' : 'bg-ln-teal'}`} style={{ width: `${Math.round((it.total / max) * 100)}%` }} />
                      </span>
                    </span>
                    <span className="text-xs font-semibold text-ln-t1 tabular text-right">{it.total}</span>
                    <span className="text-[11px] text-ln-t3 tabular text-right">{fmtHoras(it.horas)}</span>
                    <span className="text-[11px] text-ln-t4 tabular text-right">{it.pct}%</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {itens.length > limite && (
        <button onClick={() => setTudo((v) => !v)} className="mt-1.5 text-[11px] text-ln-t3 hover:text-ln-t1 px-2">
          {tudo ? t('atividadesConcluidas.mostrarMenos') : t('atividadesConcluidas.verTodos', { n: itens.length })}
        </button>
      )}
    </div>
  )
}

// ─── Relatório de uma pessoa (dividido por dia) ──────────────────────────────

function LinhaTarefa({ t: tf, mostrarPessoa = false }) {
  const { t } = useI18n()
  return (
    <li className="ln-row-hover grid items-center gap-x-2.5 px-2 h-9" style={{ gridTemplateColumns: '40px 16px minmax(0,1fr) minmax(0,max-content) 44px 16px' }}>
      <span className="text-[11px] text-ln-t4 tabular">{fmtHora(tf.concluidaEm)}</span>
      {tf.subtarefa
        ? <CornerDownRight className="w-3.5 h-3.5 text-ln-t4" aria-label={t('atividadesConcluidas.subtarefa')} />
        : <CheckCircle2 className="w-3.5 h-3.5 text-ln-green" aria-hidden="true" />}
      <span className="min-w-0 flex items-baseline gap-2">
        <a href={tf.url} target="_blank" rel="noreferrer" className="text-[13px] text-ln-t1 truncate hover:underline" title={tf.nome}>{tf.nome}</a>
        {tf.lista && <span className="text-[11px] text-ln-t4 truncate hidden md:inline">{tf.lista}</span>}
        {mostrarPessoa && tf.pessoas?.length > 0 && <span className="text-[11px] text-ln-t3 truncate hidden sm:inline">{tf.pessoas.map((p) => p.nome ? primeiroNome(p.nome) : t('atividadesConcluidas.semResp')).join(', ')}</span>}
      </span>
      <span className="text-[11px] text-ln-t3 truncate max-w-[180px] px-1.5 h-5 inline-flex items-center rounded-full bg-ln-ink/[0.04] ring-1 ring-inset ring-ln-ink/5" title={`${t('atividadesConcluidas.clienteX', { nome: nomeCliente(tf.cliente) })}${tf.tipoTarefa ? ` · ${rotuloTipoTarefa(tf.tipoTarefa)}` : ''}`}>{nomeCliente(tf.cliente)}</span>
      <span className="text-[11px] text-ln-t3 tabular text-right" title={`${tf.origem === 'estimativa' ? t('atividadesConcluidas.horasNaTarefa') : t('atividadesConcluidas.horasPor', { origem: rotuloOrigem(tf.origem) })}${tf.tempoRegistrado ? ` · ${t('atividadesConcluidas.registradas', { horas: fmtHoras(tf.tempoRegistrado) })}` : ''}`}>
        {fmtHoras(tf.horas)}{tf.origem !== 'estimativa' ? <span className="text-ln-t4">*</span> : ''}
      </span>
      <a href={tf.url} target="_blank" rel="noreferrer" className="ln-iconbtn !w-6 !h-6 opacity-0 group-hover/dia:opacity-100 focus:opacity-100" aria-label={t('atividadesPlanejador.abrirClickup')} title={t('atividadesPlanejador.abrirClickup')}><ExternalLink className="w-3 h-3" /></a>
    </li>
  )
}

function SecaoPessoa({ p, hoje, abertoInicial = true, mostrarPessoa = false, onFiltrarCliente }) {
  const { t } = useI18n()
  const [aberto, setAberto] = useState(abertoInicial)
  const semResp = p.key === SEM_RESPONSAVEL_KEY
  const nome = p.nome || t('atividades.semResponsavel')
  return (
    <section className="ln-card overflow-hidden" aria-label={t('atividadesConcluidas.relatorioDe', { nome })}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className={`w-full flex items-center gap-2.5 px-3 h-11 text-left transition-colors duration-150 hover:bg-ln-ink/[0.03] ${FOCO}`}
      >
        <ChevronRight className={`w-3.5 h-3.5 text-ln-t4 shrink-0 transition-transform ${aberto ? 'rotate-90' : ''}`} />
        <Avatar nome={p.nome} tamanho={24} />
        <span className="min-w-0 flex-1 flex items-baseline gap-2 flex-wrap">
          <span className={`text-[13px] font-medium truncate ${semResp ? 'text-ln-t3 italic' : 'text-ln-t1'}`}>{nome}</span>
          <span className="text-[11px] text-ln-t4 truncate">
            {t('atividades.nTarefas', { count: p.total })} · {fmtHoras(p.horas)}
            {p.tempoRegistrado ? ` (${t('atividadesConcluidas.registradas', { horas: fmtHoras(p.tempoRegistrado) })})` : ''}
            {' · '}{t('atividadesConcluidas.nClientes', { count: p.clientes.length })}
            {p.dias.length > 1 ? ` · ${t('comum.dias', { count: p.dias.length })}` : ''}
            {semResp ? ` · ${t('atividadesConcluidas.fechadasSemResp')}` : ''}
          </span>
        </span>
        <span className="hidden md:flex items-center gap-1 shrink-0">
          {p.clientes.slice(0, 4).map((c) => (
            <span key={c.nome} role="button" tabIndex={-1} onClick={(e) => { e.stopPropagation(); onFiltrarCliente?.(c.nome) }} className="text-[11px] text-ln-t3 px-1.5 h-5 inline-flex items-center rounded-full bg-ln-ink/[0.04] ring-1 ring-inset ring-ln-ink/5 hover:bg-ln-ink/[0.08] cursor-pointer" title={t('atividadesConcluidas.filtrarPor', { nome: nomeCliente(c.nome) })}>
              {nomeCliente(c.nome)} <span className="text-ln-t4 ml-1 tabular">{c.tarefas}</span>
            </span>
          ))}
          {p.clientes.length > 4 && <span className="text-[11px] text-ln-t4 tabular">+{p.clientes.length - 4}</span>}
        </span>
      </button>
      {aberto && (
        <div className="border-t border-ln-ink/5">
          {p.dias.map((d) => (
            <div key={d.dia} className="group/dia">
              <div className="flex items-center gap-2 h-8 px-3 bg-ln-ink/[0.02] border-b border-ln-ink/5">
                <span className="text-[11px] font-medium text-ln-t2">{rotuloDia(d.dia, hoje)}</span>
                <span className="text-[11px] text-ln-t4 tabular">{t('atividades.nTarefas', { count: d.tarefas.length })} · {fmtHoras(d.horas)}</span>
              </div>
              <ul className="py-1">
                {d.tarefas.map((t) => <LinhaTarefa key={`${t.id}:${d.dia}`} t={t} mostrarPessoa={mostrarPessoa} />)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ─── Skeleton / estados ──────────────────────────────────────────────────────

function Skeleton() {
  const { t } = useI18n()
  return (
    <div className="space-y-2" aria-busy="true" aria-label={t('atividadesConcluidas.lendo')}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => <div key={i} className="ln-card h-[64px] ln-shimmer" />)}
      </div>
      <div className="grid lg:grid-cols-2 gap-2">
        <div className="ln-card h-64 ln-shimmer" />
        <div className="ln-card h-64 ln-shimmer" />
      </div>
      <div className="ln-card h-40 ln-shimmer" />
    </div>
  )
}

// ─── Componente ──────────────────────────────────────────────────────────────

/**
 * @param {object} p
 * @param {ReturnType<import('../../hooks/useConcluidas').useConcluidas>} p.rel
 * @param {'hoje'|'ontem'|'7dias'} p.periodo
 * @param {{pessoa: string|null, cliente: string|null, dia: string|null}} p.filtros
 * @param {(f) => void} p.setFiltros
 */
export default function RelatorioConcluidas({ rel, periodo, intervalo, filtros, setFiltros, membros, projects }) {
  const { t, locale } = useI18n()
  const hoje = rel.hoje
  const projetosPorPasta = useMemo(() => new Map((projects || []).filter((p) => p.clickupFolderId).map((p) => [String(p.clickupFolderId), p.companyName || p.company_name])), [projects])
  const membrosPorClickup = useMemo(() => new Map((membros || []).filter((m) => m.clickupId).map((m) => [m.clickupId, m])), [membros])

  const todas = useMemo(() => enriquecerTarefas(rel.tarefas, { projetosPorPasta, membrosPorClickup }), [rel.tarefas, projetosPorPasta, membrosPorClickup])
  const doPeriodo = useMemo(() => filtrarPorPeriodo(todas, periodo, hoje, intervalo), [todas, periodo, hoje, intervalo])
  const base = useMemo(() => agregarConcluidas(doPeriodo, { dias: diasDoIntervalo(intervalo) }), [doPeriodo, intervalo])
  const filtradas = useMemo(() => {
    let out = aplicarFiltros(doPeriodo, { pessoa: filtros.pessoa, cliente: filtros.cliente })
    if (filtros.dia) out = out.filter((t) => t.dia === filtros.dia)
    return out
  }, [doPeriodo, filtros])
  const ag = useMemo(() => agregarConcluidas(filtradas, { dias: diasDoIntervalo(intervalo) }), [filtradas, intervalo])
  const temFiltro = !!(filtros.pessoa || filtros.cliente || filtros.dia)

  const setPessoa = (pessoa) => setFiltros({ ...filtros, pessoa })
  const setCliente = (cliente) => setFiltros({ ...filtros, cliente })
  const setDia = (dia) => setFiltros({ ...filtros, dia })

  const nomeFiltroPessoa = filtros.pessoa ? (base.porPessoa.find((p) => p.key === filtros.pessoa)?.nome || (filtros.pessoa === SEM_RESPONSAVEL_KEY ? t('atividades.semResponsavel') : filtros.pessoa)) : null

  return (
    <section className="px-3 pt-3 pb-24 space-y-2" aria-label={t('atividadesConcluidas.titulo')}>
      {/* cabeçalho */}
      <div className="flex items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="text-[13px] font-medium text-ln-t1 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-ln-green" /> {t('atividadesConcluidas.tituloPeriodo', { periodo: textoPeriodo(periodo, intervalo) })}
            <span className="text-ln-t4 font-normal tabular">{rotuloIntervalo(intervalo)}</span>
          </h2>
          <p className="text-[11px] text-ln-t4 mt-0.5">
            {t('atividadesConcluidas.descricao')}
            {rel.geradoEm ? ` ${t('atividadesConcluidas.lido', { quando: fmtRelativo(rel.geradoEm) })}` : ''}
            {rel.truncado ? ` ${t('atividadesConcluidas.cortada', { n: (2000).toLocaleString(locale) })}` : ''}
            {ag.totais.semEstimativa > 0 ? ` ${t('atividadesConcluidas.notaEstimadas')}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {temFiltro && (
            <button onClick={() => setFiltros({ pessoa: null, cliente: null, dia: null })} className="ln-pill">{t('atividadesConcluidas.limparFiltros')} <X className="w-3 h-3" /></button>
          )}
          <button onClick={() => rel.refresh()} disabled={rel.loading} className="ln-iconbtn" aria-label={t('atividades.relerClickup')} title={t('atividades.relerClickup')}>
            {rel.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {rel.erro && (
        <div className="ln-card px-3 py-2.5 flex items-center gap-2 text-xs text-ln-red">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> <span className="min-w-0 truncate">{rel.erro}</span>
          <button onClick={() => rel.refresh()} className="ln-pill ml-auto">{t('atividadesConcluidas.tentarDeNovo')}</button>
        </div>
      )}

      {rel.loading && rel.tarefas.length === 0 && !rel.erro ? <Skeleton /> : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <Tile label={t('atividadesConcluidas.kpi.concluidas')} valor={ag.totais.tarefas} sub={temFiltro ? t('atividadesConcluidas.kpi.deNoPeriodo', { n: base.totais.tarefas }) : `${textoPeriodo(periodo, intervalo)}`} />
            <Tile label={t('atividadesConcluidas.kpi.horas')} valor={fmtHoras(ag.totais.horas)} sub={ag.totais.tarefas ? t('atividadesConcluidas.kpi.porTarefa', { horas: fmtHoras(ag.totais.horas / ag.totais.tarefas) }) : ''} title={t('atividadesConcluidas.kpi.horasTitle')} />
            <Tile label={t('atividadesConcluidas.kpi.pessoas')} valor={ag.totais.pessoas} sub={ag.totais.semResponsavel ? t('atividadesConcluidas.kpi.semResponsavel', { n: ag.totais.semResponsavel }) : t('atividadesConcluidas.kpi.todasComResponsavel')} tom={ag.totais.semResponsavel ? 'ambar' : 'padrao'} />
            <Tile label={t('atividadesConcluidas.kpi.clientes')} valor={ag.totais.clientes} sub={ag.porCliente[0] ? t('atividadesConcluidas.kpi.lidera', { nome: nomeCliente(ag.porCliente[0].nome), pct: ag.porCliente[0].pct }) : ''} />
          </div>

          {(periodo === '7dias' || (periodo === 'custom' && diasEntre(intervalo.desde, intervalo.ate) > 1 && diasEntre(intervalo.desde, intervalo.ate) <= 31)) && (
            <FaixaDias porDia={base.porDia} hoje={hoje} diaSelecionado={filtros.dia} onSelecionarDia={setDia} />
          )}

          {base.totais.tarefas === 0 ? (
            <div className="ln-card px-3 py-8 text-center">
              <CheckCircle2 className="w-5 h-5 text-ln-t4 mx-auto mb-2" />
              <p className="text-[13px] text-ln-t2">{t('atividadesConcluidas.nenhuma', { periodo: textoPeriodo(periodo, intervalo) })}</p>
              <p className="text-[11px] text-ln-t4 mt-1">{t('atividadesConcluidas.conta')}</p>
            </div>
          ) : (
            <>
              {/* rankings */}
              <div className="grid lg:grid-cols-2 gap-2">
                <Ranking
                  titulo={t('atividadesConcluidas.porColaborador')}
                  subtitulo={nomeFiltroPessoa ? t('atividadesConcluidas.filtrado', { nome: nomeFiltroPessoa }) : t('atividadesConcluidas.quemEntregou')}
                  itens={ag.porPessoa}
                  ativoKey={filtros.pessoa}
                  onEscolher={setPessoa}
                  tipo="pessoa"
                />
                <Ranking
                  titulo={t('atividadesConcluidas.porCliente')}
                  subtitulo={filtros.cliente ? t('atividadesConcluidas.filtrado', { nome: nomeCliente(filtros.cliente) }) : t('atividadesConcluidas.quemConsome')}
                  itens={ag.porCliente}
                  ativoKey={filtros.cliente}
                  onEscolher={setCliente}
                  tipo="cliente"
                />
              </div>

              {/* relatório por colaborador */}
              <div className="flex items-baseline justify-between px-1 pt-2">
                <h3 className="text-xs font-medium text-ln-t1">{t('atividadesConcluidas.relatorio')}</h3>
                <p className="text-[11px] text-ln-t4">{t('atividadesConcluidas.secoes', { count: ag.porPessoa.length })} · {t('atividadesConcluidas.divididoPorDia')}</p>
              </div>
              {ag.porPessoa.length === 0 ? (
                <div className="ln-card px-3 py-6 text-center text-xs text-ln-t4">{t('atividadesConcluidas.nenhumaFiltros')}</div>
              ) : ag.porPessoa.map((p, i) => (
                <SecaoPessoa
                  key={p.key}
                  p={p}
                  hoje={hoje}
                  abertoInicial={p.key !== SEM_RESPONSAVEL_KEY && (i < 6 || !!filtros.pessoa)}
                  onFiltrarCliente={setCliente}
                />
              ))}
            </>
          )}
        </>
      )}
    </section>
  )
}
