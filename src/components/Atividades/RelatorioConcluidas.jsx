// Relatório de tarefas concluídas (módulo Atividades, visual do Linear).
// Recebe as tarefas já lidas do ClickUp (useConcluidas) e monta: KPIs do
// período, faixa por dia, ranking por colaborador e por cliente e o relatório
// de cada pessoa dividido por dia. Filtros de pessoa/cliente/dia vêm da página.
import { useMemo, useState } from 'react'
import { CheckCircle2, ChevronRight, CornerDownRight, ExternalLink, Loader2, RefreshCw, X, AlertTriangle } from 'lucide-react'
import { Tile } from './KpiStrip'
import { Avatar } from './IssueList'
import { fmtHoras, fmtHora, fmtRelativo, primeiroNome } from '../../lib/atividadesCarga'
import {
  SEM_RESPONSAVEL_KEY, agregarConcluidas, aplicarFiltros, diasDoIntervalo, enriquecerTarefas,
  filtrarPorPeriodo, intervaloDoPeriodo, rotuloDia, rotuloIntervalo,
} from '../../lib/atividadesConcluidas'

const FOCO = 'outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ln-t2'
const ESTILO_ATIVO = { borderColor: 'rgb(var(--ln-t2) / 0.5)', backgroundColor: 'rgb(var(--ln-ink) / 0.03)' }

function plural(n, s, p) { return n === 1 ? s : p }

function textoPeriodo(periodo) {
  return periodo === 'hoje' ? 'hoje' : periodo === 'ontem' ? 'ontem' : 'nos últimos 7 dias'
}

// ─── Faixa por dia (só nos 7 dias) ───────────────────────────────────────────

function FaixaDias({ porDia, hoje, diaSelecionado, onSelecionarDia }) {
  const max = Math.max(1, ...porDia.map((d) => d.total))
  return (
    <div className="ln-card px-3 py-2.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] text-ln-t4">Concluídas por dia</p>
        {diaSelecionado && (
          <button onClick={() => onSelecionarDia(null)} className="ln-pill !h-6 !px-2 !text-[11px]">só {rotuloDia(diaSelecionado, hoje)} <X className="w-3 h-3" /></button>
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
              title={`${rotuloDia(d.dia, hoje)}: ${d.total} ${plural(d.total, 'tarefa', 'tarefas')} · ${fmtHoras(d.horas)}`}
              className={`group flex flex-col items-center gap-1 rounded-lg px-1 pt-1 pb-1.5 transition-colors duration-150 hover:bg-ln-ink/[0.03] ${FOCO} ${ativo ? 'bg-ln-ink/[0.05]' : ''}`}
            >
              <span className={`text-xs font-semibold tabular ${d.total ? 'text-ln-t1' : 'text-ln-t4'}`}>{d.total}</span>
              <span className="w-full h-10 flex items-end">
                <span className={`w-full rounded-sm ${d.total ? (ativo ? 'bg-ln-accent' : 'bg-ln-accent/60 group-hover:bg-ln-accent/80') : 'bg-ln-ink/[0.06]'}`} style={{ height: `${Math.max(2, h)}px` }} />
              </span>
              <span className={`text-[11px] leading-[14px] truncate max-w-full ${d.dia === hoje ? 'text-ln-t2 font-medium' : 'text-ln-t4'}`}>{rotuloDia(d.dia, hoje).replace(/^(Hoje|Ontem) · /, '')}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Ranking (colaborador / cliente) ─────────────────────────────────────────

function Ranking({ titulo, subtitulo, itens, ativoKey, onEscolher, tipo, limite = 8 }) {
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
        <p className="text-xs text-ln-t4 py-3 text-center">Nada por aqui.</p>
      ) : (
        <ul className="space-y-0.5">
          {visiveis.map((it) => {
            const key = tipo === 'pessoa' ? it.key : it.nome
            const ativo = ativoKey === key
            const nome = tipo === 'pessoa' ? (it.nome || 'Sem responsável') : it.nome
            const detalhe = tipo === 'pessoa'
              ? (it.clientes.length ? `${it.clientes.length} ${plural(it.clientes.length, 'cliente', 'clientes')} · ${it.clientes.slice(0, 2).map((c) => `${c.nome} (${c.tarefas})`).join(', ')}` : '')
              : (it.pessoas.length ? it.pessoas.slice(0, 3).map((p) => `${p.nome ? primeiroNome(p.nome) : 'sem resp.'} (${p.tarefas})`).join(', ') + (it.pessoas.length > 3 ? ` +${it.pessoas.length - 3}` : '') : '')
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => onEscolher(ativo ? null : key)}
                  aria-pressed={ativo}
                  style={ativo ? ESTILO_ATIVO : undefined}
                  className={`ln-row-hover w-full grid items-center gap-x-2.5 px-2 py-1.5 text-left border border-transparent ${FOCO}`}
                  title={`${nome}: ${it.total} ${plural(it.total, 'tarefa', 'tarefas')} · ${fmtHoras(it.horas)} · ${it.pct}% do período`}
                  // avatar | nome+barra | tarefas | horas | %
                  // (grid inline: Tailwind não vê template dinâmico)
                >
                  <span className="grid items-center gap-x-2.5" style={{ gridTemplateColumns: '20px minmax(0,1fr) 40px 48px 36px' }}>
                    {tipo === 'pessoa'
                      ? <Avatar nome={it.nome} tamanho={20} className={it.key === SEM_RESPONSAVEL_KEY ? '' : ''} />
                      : <span className="w-5 h-5 rounded-md bg-ln-ink/5 text-ln-t3 text-[10px] font-semibold inline-flex items-center justify-center">{String(it.nome).slice(0, 1).toUpperCase()}</span>}
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
          {tudo ? 'mostrar menos' : `ver todos (${itens.length})`}
        </button>
      )}
    </div>
  )
}

// ─── Relatório de uma pessoa (dividido por dia) ──────────────────────────────

function LinhaTarefa({ t, mostrarPessoa = false, denso }) {
  return (
    <li className={`ln-row-hover grid items-center gap-x-2.5 px-2 ${denso ? 'h-7' : 'h-9'}`} style={{ gridTemplateColumns: '40px 16px minmax(0,1fr) minmax(0,max-content) 44px 16px' }}>
      <span className="text-[11px] text-ln-t4 tabular">{fmtHora(t.concluidaEm)}</span>
      {t.subtarefa
        ? <CornerDownRight className="w-3.5 h-3.5 text-ln-t4" aria-label="Subtarefa" />
        : <CheckCircle2 className="w-3.5 h-3.5 text-ln-green" aria-hidden="true" />}
      <span className="min-w-0 flex items-baseline gap-2">
        <a href={t.url} target="_blank" rel="noreferrer" className="text-[13px] text-ln-t1 truncate hover:underline" title={t.nome}>{t.nome}</a>
        {t.lista && !denso && <span className="text-[11px] text-ln-t4 truncate hidden md:inline">{t.lista}</span>}
        {mostrarPessoa && t.pessoas?.length > 0 && <span className="text-[11px] text-ln-t3 truncate hidden sm:inline">{t.pessoas.map((p) => p.nome ? primeiroNome(p.nome) : 'sem resp.').join(', ')}</span>}
      </span>
      <span className="text-[11px] text-ln-t3 truncate max-w-[180px] px-1.5 h-5 inline-flex items-center rounded-full bg-ln-ink/[0.04] ring-1 ring-inset ring-ln-ink/5" title={`Cliente: ${t.cliente}${t.tipoTarefa ? ` · ${t.tipoTarefa}` : ''}`}>{t.cliente}</span>
      <span className="text-[11px] text-ln-t3 tabular text-right" title={`Horas ${t.origem === 'estimativa' ? 'estimadas na tarefa' : `por ${t.origem}`}${t.tempoRegistrado ? ` · ${fmtHoras(t.tempoRegistrado)} registradas` : ''}`}>
        {fmtHoras(t.horas)}{t.origem !== 'estimativa' ? <span className="text-ln-t4">*</span> : ''}
      </span>
      <a href={t.url} target="_blank" rel="noreferrer" className="ln-iconbtn !w-6 !h-6 opacity-0 group-hover/dia:opacity-100 focus:opacity-100" aria-label="Abrir no ClickUp" title="Abrir no ClickUp"><ExternalLink className="w-3 h-3" /></a>
    </li>
  )
}

function SecaoPessoa({ p, hoje, denso, abertoInicial = true, mostrarPessoa = false, onFiltrarCliente }) {
  const [aberto, setAberto] = useState(abertoInicial)
  const semResp = p.key === SEM_RESPONSAVEL_KEY
  const nome = p.nome || 'Sem responsável'
  return (
    <section className="ln-card overflow-hidden" aria-label={`Relatório de ${nome}`}>
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
            {p.total} {plural(p.total, 'tarefa', 'tarefas')} · {fmtHoras(p.horas)}
            {p.tempoRegistrado ? ` (${fmtHoras(p.tempoRegistrado)} registradas)` : ''}
            {' · '}{p.clientes.length} {plural(p.clientes.length, 'cliente', 'clientes')}
            {p.dias.length > 1 ? ` · ${p.dias.length} dias` : ''}
            {semResp ? ' · fechadas sem responsável no ClickUp' : ''}
          </span>
        </span>
        <span className="hidden md:flex items-center gap-1 shrink-0">
          {p.clientes.slice(0, 4).map((c) => (
            <span key={c.nome} role="button" tabIndex={-1} onClick={(e) => { e.stopPropagation(); onFiltrarCliente?.(c.nome) }} className="text-[11px] text-ln-t3 px-1.5 h-5 inline-flex items-center rounded-full bg-ln-ink/[0.04] ring-1 ring-inset ring-ln-ink/5 hover:bg-ln-ink/[0.08] cursor-pointer" title={`Filtrar por ${c.nome}`}>
              {c.nome} <span className="text-ln-t4 ml-1 tabular">{c.tarefas}</span>
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
                <span className="text-[11px] text-ln-t4 tabular">{d.tarefas.length} {plural(d.tarefas.length, 'tarefa', 'tarefas')} · {fmtHoras(d.horas)}</span>
              </div>
              <ul className="py-1">
                {d.tarefas.map((t) => <LinhaTarefa key={`${t.id}:${d.dia}`} t={t} denso={denso} mostrarPessoa={mostrarPessoa} />)}
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
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Lendo o ClickUp">
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
export default function RelatorioConcluidas({ rel, periodo, filtros, setFiltros, membros, projects, denso }) {
  const hoje = rel.hoje
  const projetosPorPasta = useMemo(() => new Map((projects || []).filter((p) => p.clickupFolderId).map((p) => [String(p.clickupFolderId), p.companyName || p.company_name])), [projects])
  const membrosPorClickup = useMemo(() => new Map((membros || []).filter((m) => m.clickupId).map((m) => [m.clickupId, m])), [membros])

  const todas = useMemo(() => enriquecerTarefas(rel.tarefas, { projetosPorPasta, membrosPorClickup }), [rel.tarefas, projetosPorPasta, membrosPorClickup])
  const intervalo = useMemo(() => intervaloDoPeriodo(periodo, hoje), [periodo, hoje])
  const doPeriodo = useMemo(() => filtrarPorPeriodo(todas, periodo, hoje), [todas, periodo, hoje])
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

  const nomeFiltroPessoa = filtros.pessoa ? (base.porPessoa.find((p) => p.key === filtros.pessoa)?.nome || (filtros.pessoa === SEM_RESPONSAVEL_KEY ? 'Sem responsável' : filtros.pessoa)) : null

  return (
    <section className="px-3 pt-3 pb-24 space-y-2" aria-label="Tarefas concluídas">
      {/* cabeçalho */}
      <div className="flex items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="text-[13px] font-medium text-ln-t1 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-ln-green" /> Tarefas concluídas {textoPeriodo(periodo)}
            <span className="text-ln-t4 font-normal tabular">{rotuloIntervalo(intervalo)}</span>
          </h2>
          <p className="text-[11px] text-ln-t4 mt-0.5">
            Tudo que fechou no ClickUp no período, por colaborador e por cliente.
            {rel.geradoEm ? ` Lido ${fmtRelativo(rel.geradoEm)}.` : ''}
            {rel.truncado ? ' Lista cortada em 2.000 tarefas.' : ''}
            {ag.totais.semEstimativa > 0 ? ' * horas por tipo/dificuldade, sem estimativa na tarefa.' : ''}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {temFiltro && (
            <button onClick={() => setFiltros({ pessoa: null, cliente: null, dia: null })} className="ln-pill">limpar filtros <X className="w-3 h-3" /></button>
          )}
          <button onClick={() => rel.refresh()} disabled={rel.loading} className="ln-iconbtn" aria-label="Reler o ClickUp" title="Reler o ClickUp">
            {rel.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {rel.erro && (
        <div className="ln-card px-3 py-2.5 flex items-center gap-2 text-xs text-ln-red">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> <span className="min-w-0 truncate">{rel.erro}</span>
          <button onClick={() => rel.refresh()} className="ln-pill ml-auto">tentar de novo</button>
        </div>
      )}

      {rel.loading && rel.tarefas.length === 0 && !rel.erro ? <Skeleton /> : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <Tile label="Concluídas" valor={ag.totais.tarefas} sub={temFiltro ? `de ${base.totais.tarefas} no período` : `${textoPeriodo(periodo)}`} />
            <Tile label="Horas entregues" valor={fmtHoras(ag.totais.horas)} sub={ag.totais.tarefas ? `${fmtHoras(ag.totais.horas / ag.totais.tarefas)} por tarefa` : ''} title="Soma das horas de cada tarefa (estimativa, tipo ou dificuldade)" />
            <Tile label="Pessoas que entregaram" valor={ag.totais.pessoas} sub={ag.totais.semResponsavel ? `${ag.totais.semResponsavel} sem responsável` : 'todas com responsável'} tom={ag.totais.semResponsavel ? 'ambar' : 'padrao'} />
            <Tile label="Clientes atendidos" valor={ag.totais.clientes} sub={ag.porCliente[0] ? `${ag.porCliente[0].nome} lidera (${ag.porCliente[0].pct}%)` : ''} />
          </div>

          {periodo === '7dias' && (
            <FaixaDias porDia={base.porDia} hoje={hoje} diaSelecionado={filtros.dia} onSelecionarDia={setDia} />
          )}

          {base.totais.tarefas === 0 ? (
            <div className="ln-card px-3 py-8 text-center">
              <CheckCircle2 className="w-5 h-5 text-ln-t4 mx-auto mb-2" />
              <p className="text-[13px] text-ln-t2">Nenhuma tarefa concluída {textoPeriodo(periodo)}.</p>
              <p className="text-[11px] text-ln-t4 mt-1">Conta o que foi movido para um status de conclusão no ClickUp.</p>
            </div>
          ) : (
            <>
              {/* rankings */}
              <div className="grid lg:grid-cols-2 gap-2">
                <Ranking
                  titulo="Por colaborador"
                  subtitulo={nomeFiltroPessoa ? `filtrado: ${nomeFiltroPessoa}` : 'quem entregou mais'}
                  itens={ag.porPessoa}
                  ativoKey={filtros.pessoa}
                  onEscolher={setPessoa}
                  tipo="pessoa"
                />
                <Ranking
                  titulo="Por cliente"
                  subtitulo={filtros.cliente ? `filtrado: ${filtros.cliente}` : 'quem está consumindo mais demandas'}
                  itens={ag.porCliente}
                  ativoKey={filtros.cliente}
                  onEscolher={setCliente}
                  tipo="cliente"
                />
              </div>

              {/* relatório por colaborador */}
              <div className="flex items-baseline justify-between px-1 pt-2">
                <h3 className="text-xs font-medium text-ln-t1">Relatório por colaborador</h3>
                <p className="text-[11px] text-ln-t4">{ag.porPessoa.length} {plural(ag.porPessoa.length, 'seção', 'seções')} · dividido por dia · clique no nome para recolher</p>
              </div>
              {ag.porPessoa.length === 0 ? (
                <div className="ln-card px-3 py-6 text-center text-xs text-ln-t4">Nenhuma tarefa com esses filtros.</div>
              ) : ag.porPessoa.map((p, i) => (
                <SecaoPessoa
                  key={p.key}
                  p={p}
                  hoje={hoje}
                  denso={denso}
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
