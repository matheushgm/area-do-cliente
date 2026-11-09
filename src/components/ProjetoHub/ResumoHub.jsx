// Aba "Resumo" do hub do cliente: resultado dos últimos 7 dias, atividades
// realizadas na semana e as grandes alterações detectadas no gerenciador.
import { useMemo } from 'react'
import { Wallet, Target, Coins, Wrench, StickyNote, Kanban, ListChecks, Users, Sparkles, Megaphone, Search, Loader2, ExternalLink } from 'lucide-react'
import { kpis7d, alteracoesGerenciador } from '../../lib/resumoProjeto'
import { addDays } from '../../lib/dashboardData'
// dd/mm em pt, mm/dd em en (o fmtBR do dashboardData é fixo em pt e é copiado para o viewer).
import { fmtDiaMes as fmtBR } from '../../lib/vertatask'
import { hojeISO } from '../../lib/atividadesCarga'
import { useI18n, localeAtual } from '../../i18n'

const fmtMoney = (n) => (n == null ? '—' : 'R$ ' + n.toLocaleString(localeAtual(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const fmtInt = (n) => Math.round(n ?? 0).toLocaleString(localeAtual())
const fmtData = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '')

function Variacao({ v, invertido = false }) {
  const { t } = useI18n()
  if (v == null) return <span className="text-[11px] text-rl-muted">{t('hub.resumo.semBase')}</span>
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
  const { t, lang } = useI18n()
  const rawDash = dash.raw
  const raw = useMemo(() => rawDash || { meta: [], google: [] }, [rawDash])
  const kpis = useMemo(() => kpis7d(raw), [raw])
  // `lang`: os textos das alterações saem no idioma atual
  const alteracoes = useMemo(() => alteracoesGerenciador(raw), [raw, lang]) // eslint-disable-line react-hooks/exhaustive-deps
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
    contagem.otimizacao && t('hub.resumo.fraseOtimizacoes', { count: contagem.otimizacao }),
    contagem.tarefa && t('hub.resumo.fraseConcluidas', { count: contagem.tarefa }),
    contagem.planejada && t('hub.resumo.frasePlanejadas', { count: contagem.planejada }),
    contagem.reuniao && t('hub.resumo.fraseReunioes', { count: contagem.reuniao }),
    contagem.anotacao && t('hub.resumo.fraseAnotacoes', { count: contagem.anotacao }),
  ].filter(Boolean)

  const periodoKpi = kpis.inicio ? t('hub.periodo', { de: fmtBR(kpis.inicio), ate: fmtBR(kpis.fim) }) : t('hub.resumo.semDados')
  const canais = ['meta', 'google'].filter((c) => kpis[c])
  const detalhe = (campo, fmt) => canais.length > 1 ? canais.map((c) => `${c === 'meta' ? 'Meta' : 'Google'} ${fmt(kpis[c][campo])}`).join(' · ') : null

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div>
        <div className="flex items-center justify-between px-1 mb-2">
          <p className="text-sm font-semibold text-rl-text">{t('hub.resumo.resultado7d')}</p>
          <span className="text-[11px] text-rl-muted">{dash.loading && !temDados ? t('hub.resumo.carregando') : periodoKpi} · {t('hub.resumo.vs7d')}</span>
        </div>
        {dash.loading && !temDados ? (
          <div className="flex items-center gap-2 text-sm text-rl-muted py-6 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> {t('hub.lendoDashboard')}</div>
        ) : !temDados ? (
          <div className="glass-card p-4 text-sm text-rl-subtle">{t('hub.semConta')}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Kpi icon={Wallet} label={t('hub.resumo.valorGasto')} valor={fmtMoney(kpis.total.spend)} variacao={kpis.total.varSpend} detalhe={detalhe('spend', fmtMoney)} />
            <Kpi icon={Target} label={t('hub.resumo.conversoes')} valor={fmtInt(kpis.total.conv)} variacao={kpis.total.varConv} detalhe={detalhe('conv', fmtInt)} />
            <Kpi icon={Coins} label={t('hub.resumo.custoConversao')} valor={fmtMoney(kpis.total.cpl)} variacao={kpis.total.varCpl} invertido detalhe={detalhe('cpl', fmtMoney)} />
          </div>
        )}
      </div>

      {sugestoesPendentes > 0 && (
        <button onClick={onAbrirSugestoes} className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rl-purple/5 border border-rl-purple/20 text-sm text-rl-text hover:bg-rl-purple/10 text-left">
          <Sparkles className="w-4 h-4 text-rl-purple" />
          <span className="flex-1">{t('hub.resumo.sugestoesAguardando', { count: sugestoesPendentes })}</span>
        </button>
      )}

      {/* Atividades da semana */}
      <Secao icon={ListChecks} titulo={t('hub.resumo.atividades7d')} sub={t('hub.periodo', { de: fmtBR(desde), ate: fmtBR(hoje) })}>
        {semana.length === 0 ? (
          <p className="text-sm text-rl-subtle">{t('hub.resumo.semAtividades')}</p>
        ) : (
          <>
            <p className="text-sm text-rl-subtle mb-3">{t('hub.resumo.naSemana', { frases: frases.join(', ') })}</p>
            <ul className="space-y-1.5">
              {semana.map((it) => {
                const Icon = KIND_ICON[it.kind]
                return (
                  <li key={it.id} className="flex items-start gap-2 text-sm">
                    <Icon className="w-3.5 h-3.5 text-rl-muted mt-1 shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="text-rl-text">{it.titulo}</span>
                      <span className="text-[11px] text-rl-muted"> · {t(`hub.tipos.${it.kind}`)} · {fmtData(it.data)}{it.registro?.autor_nome ? ` · ${it.registro.autor_nome}` : ''}</span>
                    </span>
                    {it.url && <a href={it.url} target="_blank" rel="noreferrer" className="text-rl-muted hover:text-rl-purple shrink-0" title={t('hub.abrirClickup')}><ExternalLink className="w-3.5 h-3.5" /></a>}
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </Secao>

      {/* Alterações no gerenciador */}
      <Secao icon={Megaphone} titulo={t('hub.resumo.alteracoesTitulo')} sub={temDados ? t('hub.resumo.alteracoesSub', { periodo: periodoKpi }) : null}>
        {!temDados ? (
          <p className="text-sm text-rl-subtle">{t('hub.resumo.semMidia')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[['meta', 'Meta Ads', Megaphone], ['google', 'Google Ads', Search]].map(([ch, label, Icon]) => (
              <div key={ch}>
                <p className="text-xs font-semibold text-rl-muted flex items-center gap-1.5 mb-1.5"><Icon className="w-3.5 h-3.5" /> {label}</p>
                {!kpis[ch] ? (
                  <p className="text-sm text-rl-muted">{t('hub.resumo.semContaCanal', { canal: label })}</p>
                ) : alteracoes[ch].length === 0 ? (
                  <p className="text-sm text-rl-subtle">{t('hub.resumo.semAlteracoes')}</p>
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
        <p className="text-[11px] text-rl-muted mt-3">{t('hub.resumo.detectado')} <button onClick={() => onAbrirTab('resultados')} className="text-rl-purple hover:underline">{t('hub.resumo.linkTrafego')}</button>.</p>
      </Secao>
    </div>
  )
}
