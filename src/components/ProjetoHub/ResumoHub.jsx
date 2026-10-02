// Aba "Resumo" do hub do cliente: resultado dos últimos 7 dias, atividades
// realizadas na semana e as grandes alterações detectadas no gerenciador.
import { useMemo } from 'react'
import { Wallet, Target, Coins, Wrench, StickyNote, Kanban, ListChecks, Users, Sparkles, Megaphone, Search, Loader2, ExternalLink } from 'lucide-react'
import { kpis7d, alteracoesGerenciador } from '../../lib/resumoProjeto'
import { fmtBR, addDays } from '../../lib/dashboardData'
import { hojeISO } from '../../lib/atividadesCarga'

const fmtMoney = (n) => (n == null ? '—' : 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const fmtInt = (n) => Math.round(n ?? 0).toLocaleString('pt-BR')
const fmtData = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '')

function Variacao({ v, invertido = false }) {
  if (v == null) return <span className="text-[11px] text-rl-muted">sem base</span>
  const bom = invertido ? v <= 0 : v >= 0
  const cls = Math.abs(v) < 1 ? 'bg-rl-surface text-rl-muted' : bom ? 'bg-[var(--fx-pos-bg)] text-[var(--fx-pos-fg)]' : 'bg-[var(--fx-neg-bg)] text-[var(--fx-neg-fg)]'
  return <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{v >= 0 ? '+' : ''}{Math.round(v)}%</span>
}

function Kpi({ icon: Icon, label, valor, variacao, invertido, detalhe }) {
  return (
    <div className="glass-card p-4 flex flex-col gap-1.5 min-w-0">
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-full fx-soft flex items-center justify-center shrink-0"><Icon className="w-3.5 h-3.5" /></span>
        <span className="text-xs font-semibold text-rl-muted truncate">{label}</span>
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-2xl font-bold text-rl-text tabular-nums leading-tight">{valor}</span>
        <Variacao v={variacao} invertido={invertido} />
      </div>
      {detalhe && <p className="text-[11px] text-rl-muted truncate">{detalhe}</p>}
    </div>
  )
}

const KIND_ICON = { otimizacao: Wrench, anotacao: StickyNote, planejada: Kanban, tarefa: ListChecks, reuniao: Users }
const KIND_LABEL = { otimizacao: 'Otimização', anotacao: 'Anotação', planejada: 'Tarefa planejada', tarefa: 'Tarefa', reuniao: 'Reunião' }

function Secao({ icon: Icon, titulo, sub, children }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-7 h-7 rounded-full fx-soft flex items-center justify-center shrink-0"><Icon className="w-3.5 h-3.5" /></span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-rl-text">{titulo}</p>
          {sub && <p className="text-[11px] text-rl-muted">{sub}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

export default function ResumoHub({ dash, timeline, sugestoesPendentes, onAbrirSugestoes, onAbrirTab }) {
  const rawDash = dash.raw
  const raw = useMemo(() => rawDash || { meta: [], google: [] }, [rawDash])
  const kpis = useMemo(() => kpis7d(raw), [raw])
  const alteracoes = useMemo(() => alteracoesGerenciador(raw), [raw])
  const temDados = (raw.meta?.length || 0) + (raw.google?.length || 0) > 0

  // Atividades dos últimos 7 dias (calendário, a partir de hoje)
  const hoje = hojeISO()
  const desde = addDays(hoje, -6)
  const semana = useMemo(() => timeline.filter((it) => {
    if (!it.data || it.data < desde || it.data > hoje) return false
    if (it.kind === 'tarefa') return it.fechada // tarefa do ClickUp conta quando foi concluída na semana
    return true
  }), [timeline, desde, hoje])
  const contagem = useMemo(() => semana.reduce((acc, it) => { acc[it.kind] = (acc[it.kind] || 0) + 1; return acc }, {}), [semana])
  const frases = [
    contagem.otimizacao && `${contagem.otimizacao} otimização${contagem.otimizacao > 1 ? 'ões' : ''} na conta`,
    contagem.tarefa && `${contagem.tarefa} tarefa${contagem.tarefa > 1 ? 's' : ''} concluída${contagem.tarefa > 1 ? 's' : ''}`,
    contagem.planejada && `${contagem.planejada} tarefa${contagem.planejada > 1 ? 's' : ''} planejada${contagem.planejada > 1 ? 's' : ''}`,
    contagem.reuniao && `${contagem.reuniao} reunião${contagem.reuniao > 1 ? 'ões' : ''}`,
    contagem.anotacao && `${contagem.anotacao} anotação${contagem.anotacao > 1 ? 'ões' : ''}`,
  ].filter(Boolean)

  const periodoKpi = kpis.inicio ? `${fmtBR(kpis.inicio)} a ${fmtBR(kpis.fim)}` : 'sem dados'
  const canais = ['meta', 'google'].filter((c) => kpis[c])
  const detalhe = (campo, fmt) => canais.length > 1 ? canais.map((c) => `${c === 'meta' ? 'Meta' : 'Google'} ${fmt(kpis[c][campo])}`).join(' · ') : null

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div>
        <div className="flex items-center justify-between px-1 mb-2">
          <p className="text-sm font-semibold text-rl-text">Resultado dos últimos 7 dias</p>
          <span className="text-[11px] text-rl-muted">{dash.loading && !temDados ? 'carregando…' : periodoKpi} · vs. 7 dias anteriores</span>
        </div>
        {dash.loading && !temDados ? (
          <div className="flex items-center gap-2 text-sm text-rl-muted py-6 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Lendo o dashboard de tráfego…</div>
        ) : !temDados ? (
          <div className="glass-card p-4 text-sm text-rl-subtle">Nenhuma conta de anúncio vinculada a este projeto no dashboard.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Kpi icon={Wallet} label="Valor gasto" valor={fmtMoney(kpis.total.spend)} variacao={kpis.total.varSpend} detalhe={detalhe('spend', fmtMoney)} />
            <Kpi icon={Target} label="Conversões" valor={fmtInt(kpis.total.conv)} variacao={kpis.total.varConv} detalhe={detalhe('conv', fmtInt)} />
            <Kpi icon={Coins} label="Custo por conversão" valor={fmtMoney(kpis.total.cpl)} variacao={kpis.total.varCpl} invertido detalhe={detalhe('cpl', fmtMoney)} />
          </div>
        )}
      </div>

      {sugestoesPendentes > 0 && (
        <button onClick={onAbrirSugestoes} className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rl-purple/5 border border-rl-purple/20 text-sm text-rl-text hover:bg-rl-purple/10 text-left">
          <Sparkles className="w-4 h-4 text-rl-purple" />
          <span className="flex-1">{sugestoesPendentes} sugestão{sugestoesPendentes > 1 ? 'ões' : ''} de otimização do playbook aguardando decisão</span>
        </button>
      )}

      {/* Atividades da semana */}
      <Secao icon={ListChecks} titulo="Atividades dos últimos 7 dias" sub={`${fmtBR(desde)} a ${fmtBR(hoje)}`}>
        {semana.length === 0 ? (
          <p className="text-sm text-rl-subtle">Nenhuma atividade registrada nesta semana. Use o botão Novo pra registrar otimizações, anotações e tarefas.</p>
        ) : (
          <>
            <p className="text-sm text-rl-subtle mb-3">Na semana o time fez {frases.join(', ')} neste projeto.</p>
            <ul className="space-y-1.5">
              {semana.map((it) => {
                const Icon = KIND_ICON[it.kind]
                return (
                  <li key={it.id} className="flex items-start gap-2 text-sm">
                    <Icon className="w-3.5 h-3.5 text-rl-muted mt-1 shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="text-rl-text">{it.titulo}</span>
                      <span className="text-[11px] text-rl-muted"> · {KIND_LABEL[it.kind]} · {fmtData(it.data)}{it.registro?.autor_nome ? ` · ${it.registro.autor_nome}` : ''}</span>
                    </span>
                    {it.url && <a href={it.url} target="_blank" rel="noreferrer" className="text-rl-muted hover:text-rl-purple shrink-0" title="Abrir no ClickUp"><ExternalLink className="w-3.5 h-3.5" /></a>}
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </Secao>

      {/* Alterações no gerenciador */}
      <Secao icon={Megaphone} titulo="Grandes alterações no gerenciador de anúncios" sub={temDados ? `${periodoKpi}, comparado com a semana anterior` : null}>
        {!temDados ? (
          <p className="text-sm text-rl-subtle">Sem dados de mídia pra comparar.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[['meta', 'Meta Ads', Megaphone], ['google', 'Google Ads', Search]].map(([ch, label, Icon]) => (
              <div key={ch}>
                <p className="text-xs font-semibold text-rl-muted flex items-center gap-1.5 mb-1.5"><Icon className="w-3.5 h-3.5" /> {label}</p>
                {!kpis[ch] ? (
                  <p className="text-sm text-rl-muted">Sem conta {label} vinculada.</p>
                ) : alteracoes[ch].length === 0 ? (
                  <p className="text-sm text-rl-subtle">Nenhuma alteração relevante: mesmas campanhas e anúncios, verba estável.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {alteracoes[ch].map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-rl-text">
                        <span className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${a.tipo === 'nova' ? 'bg-[var(--fx-pos-fg)]' : a.tipo === 'parou' ? 'bg-[var(--fx-neg-fg)]' : 'bg-rl-purple'}`} />
                        <span>{a.texto}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-rl-muted mt-3">Detectado a partir do dashboard: campanhas e anúncios que entraram, pararam ou pausaram, e verba com variação de 30% ou mais. Pra ver campanha a campanha, use a aba <button onClick={() => onAbrirTab('resultados')} className="text-rl-purple hover:underline">Resultados</button>.</p>
      </Secao>
    </div>
  )
}
