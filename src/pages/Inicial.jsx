import { useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import {
  Menu, RefreshCw, TrendingUp, TrendingDown, Gauge, Bot, ArrowUpRight,
  ZapOff, Rocket, History, AlertTriangle, User, Palette, MousePointerClick, Loader2,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useI18n } from '../i18n'
import { useInicial } from '../hooks/useInicial'
import { useDashboardData } from '../hooks/useDashboardData'
import { useSugestoesGlobais } from '../hooks/useSugestoesGlobais'
import { cliente as pathCliente } from '../routes/paths'
import { fmtCurrency } from '../lib/utils'
import {
  somaDias, mapaDeContas, linhasValidas, fundoSemConversao, janelaCpl, cplPorProjeto,
  acimaDoCpl, escalaveis, MIN_CONV_ESCALA, orcamentoVigente, paceDosProjetos,
  abaixoDoPace, acimaDoPace, PACE_MIN, PACE_MAX, alteracoes,
  precisamDeCriativo, landingPagesAbaixo, TAXA_LP_MIN, MIN_VISITAS_LP,
} from '../lib/inicial'

// ─────────────────────────────────────────────────────────────────────────────
// Inicial: a página de entrada da operação. Seis blocos num bento escuro (visual
// da referência "cool-dashboard" do Banco de referências): fundo sem conversão,
// acima do CPL alvo, podem escalar, alterações nas contas e pace do orçamento
// (abaixo e acima). As regras estão em src/lib/inicial.js.
// ─────────────────────────────────────────────────────────────────────────────

const LOGO_CANAL = { meta: '/dash-teste/vendor/logos/meta.svg', google: '/dash-teste/vendor/logos/google-ads.svg' }
const NOME_CANAL = { meta: 'Meta Ads', google: 'Google Ads' }

function CanalLogo({ canal, className = 'w-4 h-4' }) {
  if (!LOGO_CANAL[canal]) return null
  return <img src={LOGO_CANAL[canal]} alt={NOME_CANAL[canal]} title={NOME_CANAL[canal]} className={`${className} shrink-0`} />
}

const pct = (r) => `${Math.round(r * 100)}%`

// ─── Peças do bento ─────────────────────────────────────────────────────────
// `tom`: 'ciano' | 'verde' | 'amarelo' | 'grafite'. Os cartões coloridos usam
// texto claro (ou escuro, no amarelo) e linhas translúcidas da mesma cor.
const TONS = {
  ciano: {
    card: 'bg-[#0E9FC4] text-white shadow-[0_20px_60px_-25px_rgba(14,159,196,0.7)]',
    chip: 'bg-white/15 border-white/25', eyebrow: 'text-cyan-50/85', sub: 'text-cyan-50/85',
    linha: 'bg-white/10 hover:bg-white/[.16] border-white/10', fraco: 'text-cyan-50/75',
    seg: 'bg-black/15 border-white/20', segOn: 'bg-white text-[#0B6F8A]', segOff: 'text-cyan-50/85 hover:text-white',
  },
  verde: {
    card: 'bg-[#1F8A5B] text-white shadow-[0_20px_60px_-25px_rgba(31,138,91,0.7)]',
    chip: 'bg-white/15 border-white/25', eyebrow: 'text-emerald-50/85', sub: 'text-emerald-50/85',
    linha: 'bg-white/10 hover:bg-white/[.16] border-white/10', fraco: 'text-emerald-50/75',
    seg: 'bg-black/15 border-white/20', segOn: 'bg-white text-[#16613F]', segOff: 'text-emerald-50/85 hover:text-white',
  },
  amarelo: {
    card: 'bg-[#F6C344] text-yellow-950 shadow-[0_20px_60px_-25px_rgba(246,195,68,0.6)]',
    chip: 'bg-yellow-950/10 border-yellow-950/15', eyebrow: 'text-yellow-950/70', sub: 'text-yellow-950/75',
    linha: 'bg-yellow-950/[.07] hover:bg-yellow-950/[.12] border-yellow-950/10', fraco: 'text-yellow-950/65',
    seg: 'bg-yellow-950/10 border-yellow-950/15', segOn: 'bg-yellow-950 text-yellow-50', segOff: 'text-yellow-950/70 hover:text-yellow-950',
  },
  violeta: {
    card: 'bg-[#5B4FD6] text-white shadow-[0_20px_60px_-25px_rgba(91,79,214,0.75)]',
    chip: 'bg-white/15 border-white/25', eyebrow: 'text-indigo-50/85', sub: 'text-indigo-50/85',
    linha: 'bg-white/10 hover:bg-white/[.16] border-white/10', fraco: 'text-indigo-50/75',
    seg: 'bg-black/15 border-white/20', segOn: 'bg-white text-[#3F35A8]', segOff: 'text-indigo-50/85 hover:text-white',
  },
  grafite: {
    card: 'bg-gradient-to-br from-white/[.09] to-white/[.03] text-neutral-100 border border-white/10 backdrop-blur',
    chip: 'bg-white/[.06] border-white/10', eyebrow: 'text-neutral-400', sub: 'text-neutral-400',
    linha: 'bg-white/[.04] hover:bg-white/[.08] border-white/[.06]', fraco: 'text-neutral-400',
    seg: 'bg-black/30 border-white/10', segOn: 'bg-neutral-100 text-neutral-900', segOff: 'text-neutral-400 hover:text-neutral-100',
  },
}

function Segmento({ tom, opcoes, valor, onChange }) {
  const c = TONS[tom]
  return (
    <div className={`inline-flex items-center rounded-full border p-0.5 text-[11px] font-medium ${c.seg}`}>
      {opcoes.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`px-2.5 py-1 rounded-full transition ${valor === o.v ? c.segOn : c.segOff}`}
        >
          {o.l}
        </button>
      ))}
    </div>
  )
}

function Bloco({ tom, Icon, rotulo, numero, unidade, descricao, controle, children, className = '' }) {
  const c = TONS[tom]
  return (
    <section className={`relative flex flex-col min-w-0 rounded-[28px] p-5 sm:p-6 min-h-0 ${c.card} ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span className={`grid place-items-center w-10 h-10 rounded-full border ${c.chip}`}>
          <Icon className="w-[18px] h-[18px]" />
        </span>
        {controle}
      </div>
      <p className={`mt-6 text-[11px] font-medium uppercase tracking-[0.14em] ${c.eyebrow}`}>{rotulo}</p>
      {numero != null && (
        <p className="mt-1 flex items-baseline gap-2">
          <span className="text-4xl font-semibold tracking-tight tabular-nums">{numero}</span>
          {unidade && <span className={`text-sm ${c.sub}`}>{unidade}</span>}
        </p>
      )}
      {descricao && <p className={`mt-1.5 text-xs leading-relaxed ${c.sub}`}>{descricao}</p>}
      <div className="mt-4 flex-1 min-h-0">{children}</div>
    </section>
  )
}

function Lista({ tom, vazio, itens, render, max = 'max-h-[340px]' }) {
  const c = TONS[tom]
  if (!itens.length) {
    return <p className={`rounded-2xl border border-dashed px-4 py-6 text-center text-xs ${c.fraco} ${tom === 'amarelo' ? 'border-yellow-950/20' : 'border-white/20'}`}>{vazio}</p>
  }
  return <ul className={`space-y-1.5 overflow-y-auto pr-1 -mr-1 ${max} inicial-scroll`}>{itens.map(render)}</ul>
}

function Esqueleto({ className = '' }) {
  return <div className={`rounded-[28px] bg-white/[.05] border border-white/[.06] animate-pulse ${className}`} />
}

// ─── Página ─────────────────────────────────────────────────────────────────
export default function Inicial() {
  const { openSidebar } = useOutletContext() || {}
  const navigate = useNavigate()
  const { projects } = useApp()
  const { t, locale } = useI18n()
  const { loading, error, dados, atualizadoEm, recarregar } = useInicial()

  const [diasFundo, setDiasFundo] = useState(3)
  const [janela, setJanela] = useState('7d')
  const [janelaLp, setJanelaLp] = useState('14d')
  const [quemAlt, setQuemAlt] = useState('agentes')
  const [periodoAlt, setPeriodoAlt] = useState(7)
  const [limiteAlt, setLimiteAlt] = useState(50)

  const dataCurta = (iso) => iso ? new Date(iso + 'T12:00:00').toLocaleDateString(locale, { day: '2-digit', month: '2-digit' }) : ''
  const brl = (v, casas = 0) => fmtCurrency(v, casas)

  // Projetos: nome e churn (projeto em churn não entra em nenhum quadrante).
  const projetos = useMemo(() => {
    const m = new Map()
    for (const p of dados?.projetosDev || projects || []) m.set(p.id, { nome: p.company_name || p.companyName, churn: p.momento === 'churn', logo: p.logo_url })
    return m
  }, [projects, dados])

  const base = useMemo(() => {
    if (!dados) return null
    const contas = mapaDeContas(dados.contas)
    const linhas = linhasValidas(dados.linhas, contas, projetos)
    const metas = new Map(dados.metas.filter((m) => Number(m.cpl_target) > 0).map((m) => [m.project_id, Number(m.cpl_target)]))
    const orcamentos = new Map()
    for (const [id, p] of projetos) {
      if (p.churn) continue
      const o = orcamentoVigente({ plano: dados.planoDe.get(id), roi: dados.roiDe.get(id), hoje: dados.hoje })
      if (o) orcamentos.set(id, o)
    }
    const pace = paceDosProjetos(linhas, { hoje: dados.hoje, contas, orcamentos })
    const primeiroDia = dados.linhas.reduce((m, r) => (!m || r.day < m ? r.day : m), null)
    return { contas, linhas, metas, pace, paceDe: new Map(pace.map((p) => [p.projectId, p])), primeiroDia }
  }, [dados, projetos])

  const fundo = useMemo(() => base ? fundoSemConversao(base.linhas, { dias: diasFundo, hoje: dados.hoje, contas: base.contas }) : [], [base, diasFundo, dados])
  const jan = useMemo(() => dados ? janelaCpl(janela, dados.hoje) : null, [janela, dados])
  const cpl = useMemo(() => base ? cplPorProjeto(base.linhas, { ...jan, contas: base.contas, metas: base.metas }) : [], [base, jan])
  const acima = useMemo(() => acimaDoCpl(cpl), [cpl])
  const escala = useMemo(() => escalaveis(cpl), [cpl])
  const janLp = useMemo(() => dados ? janelaCpl(janelaLp, dados.hoje) : null, [janelaLp, dados])
  const lps = useMemo(() => base ? landingPagesAbaixo(base.linhas, { ...janLp, contas: base.contas }) : [], [base, janLp])
  const churnSet = useMemo(() => new Set([...projetos].filter(([, p]) => p.churn).map(([id]) => id)), [projetos])
  const paceAbaixo = useMemo(() => base ? abaixoDoPace(base.pace) : [], [base])
  const paceAcima = useMemo(() => base ? acimaDoPace(base.pace) : [], [base])

  const alts = useMemo(() => {
    if (!dados) return []
    // Conta a partir da hora da leitura (não do relógio do render).
    const corte = (atualizadoEm?.getTime() ?? 0) - periodoAlt * 864e5
    const hojeInicio = new Date(dados.hoje + 'T00:00:00-03:00').getTime()
    return alteracoes(dados.sugestoes)
      .filter((a) => (quemAlt === 'agentes' ? a.agente : true))
      .filter((a) => {
        const ts = new Date(a.quando).getTime()
        return periodoAlt === 0 ? ts >= hojeInicio : ts >= corte
      })
  }, [dados, quemAlt, periodoAlt, atualizadoEm])

  const nomeProjeto = (id) => projetos.get(id)?.nome
  const abrirCliente = (id) => id && navigate(pathCliente(id))
  const abrirDash = (conta, canal) => navigate(`/dashboard?cliente=${encodeURIComponent(conta)}&canal=${canal}`)

  const comum = { t, nomeProjeto, abrirCliente, navigate }
  const ontem = dados ? somaDias(dados.hoje, -1) : null
  const deFundo = dados ? somaDias(dados.hoje, -diasFundo) : null

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-[#0A0A0B] text-neutral-100">
      {/* Top bar mobile */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-white/10 bg-[#0A0A0B]/90 backdrop-blur-xl">
        <button onClick={openSidebar} aria-label={t('inicial.abrirMenu')} className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-all">
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-semibold text-sm">{t('inicial.titulo')}</span>
      </div>

      <div
        className="relative flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8"
        style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '18px 18px' }}
      >
        <div className="mx-auto max-w-[1500px]">
          {/* Cabeçalho */}
          <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">{t('inicial.rotulo')}</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t('inicial.titulo')}</h1>
              {dados && (
                <p className="mt-1 text-xs text-neutral-400">
                  {t('inicial.dadosAte', { data: dataCurta(ontem) })}
                  {atualizadoEm && <> · {t('inicial.atualizadoAs', { hora: atualizadoEm.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })}</>}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={recarregar}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-neutral-800/80 px-3.5 py-2 text-xs font-medium text-neutral-100 hover:bg-neutral-700 hover:border-white/20 transition disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              {t('inicial.atualizar')}
            </button>
          </header>

          {error && (
            <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              <AlertTriangle className="w-4 h-4" />
              <span className="flex-1">{t('inicial.erro', { msg: error })}</span>
              <button onClick={recarregar} className="rounded-full bg-red-400/20 px-3 py-1 text-xs hover:bg-red-400/30">{t('inicial.tentarDeNovo')}</button>
            </div>
          )}

          {!dados ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <Esqueleto className="h-[420px]" /><Esqueleto className="h-[420px]" /><Esqueleto className="h-[420px]" />
              <Esqueleto className="h-[320px] lg:col-span-3" />
              <Esqueleto className="h-[360px] lg:col-span-1" /><Esqueleto className="h-[360px] lg:col-span-2" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* ── Linha 1: fundo sem conversão · acima do CPL · podem escalar ── */}
              <div className="grid gap-4 lg:grid-cols-3">
                <Bloco
                  tom="ciano"
                  Icon={ZapOff}
                  rotulo={t('inicial.fundo.rotulo')}
                  numero={fundo.length}
                  unidade={t('inicial.fundo.contas', { count: fundo.length })}
                  descricao={diasFundo === 1
                    ? t('inicial.fundo.descricao1', { ate: dataCurta(ontem) })
                    : t('inicial.fundo.descricao', { de: dataCurta(deFundo), ate: dataCurta(ontem) })}
                  controle={(
                    <Segmento
                      tom="ciano"
                      valor={diasFundo}
                      onChange={setDiasFundo}
                      opcoes={[{ v: 3, l: t('inicial.janelas.d3') }, { v: 2, l: t('inicial.janelas.d2') }, { v: 1, l: t('inicial.janelas.d1') }]}
                    />
                  )}
                >
                  <Lista
                    tom="ciano"
                    vazio={t('inicial.fundo.vazio')}
                    itens={fundo}
                    render={(f) => {
                      const nomeCli = nomeProjeto(f.projectId)
                      return (
                        <li key={f.chave}>
                          <button
                            type="button"
                            onClick={() => abrirDash(f.conta, f.canal)}
                            title={t('inicial.fundo.abrirDash')}
                            className={`w-full text-left flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition ${TONS.ciano.linha}`}
                          >
                            <span className="grid place-items-center w-7 h-7 rounded-full bg-white shrink-0"><CanalLogo canal={f.canal} className="w-3.5 h-3.5" /></span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium truncate">{nomeCli || f.conta}</span>
                              <span className="block text-[11px] text-cyan-50/75 truncate">
                                {nomeCli && nomeCli !== f.conta ? `${f.conta} · ` : ''}
                                {f.campanhas[0]?.nome}
                                {f.campanhas.length > 1 && ` ${t('inicial.fundo.maisCampanhas', { n: f.campanhas.length - 1 })}`}
                              </span>
                            </span>
                            <span className="text-right shrink-0 max-w-[42%]">
                              <span className="block text-sm font-semibold tabular-nums">{brl(f.gasto)}</span>
                              <span className="block text-[10px] text-cyan-50/75 truncate">
                                {f.ultimaConversao
                                  ? t('inicial.fundo.ultima', { data: dataCurta(f.ultimaConversao) })
                                  : t('inicial.fundo.nunca', { data: dataCurta(base.primeiroDia) })}
                              </span>
                            </span>
                          </button>
                        </li>
                      )
                    }}
                  />
                </Bloco>

                <Bloco
                  tom="grafite"
                  Icon={TrendingUp}
                  rotulo={t('inicial.cpl.rotuloAcima')}
                  numero={acima.length}
                  unidade={t('inicial.cpl.clientes', { count: acima.length })}
                  descricao={t('inicial.cpl.descAcima', { de: dataCurta(jan.de), ate: dataCurta(jan.ate) })}
                  controle={<SeletorJanela tom="grafite" valor={janela} onChange={setJanela} t={t} />}
                >
                  <Lista
                    tom="grafite"
                    vazio={t('inicial.cpl.vazioAcima')}
                    itens={acima}
                    render={(p) => (
                      <li key={p.projectId}>
                        <button type="button" onClick={() => abrirCliente(p.projectId)} className={`w-full text-left flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition ${TONS.grafite.linha}`}>
                          <Canais canais={p.canais} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium truncate">{nomeProjeto(p.projectId) || '-'}</span>
                            <span className="block text-[11px] text-neutral-400 truncate">
                              {p.cpl != null
                                ? `${t('inicial.cpl.linha', { cpl: brl(p.cpl, 2), alvo: brl(p.alvo, 2) })} · ${t('inicial.cpl.detalhe', { conv: Math.round(p.conv), gasto: brl(p.gasto) })}`
                                : t('inicial.cpl.semConv', { gasto: brl(p.gasto) })}
                            </span>
                          </span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${p.razao == null || p.razao >= 1.5 ? 'bg-rose-500/15 text-rose-300' : 'bg-amber-400/15 text-amber-300'}`}>
                            {p.razao == null ? '∞' : `+${Math.round((p.razao - 1) * 100)}%`}
                          </span>
                        </button>
                      </li>
                    )}
                  />
                </Bloco>

                <Bloco
                  tom="verde"
                  Icon={Rocket}
                  rotulo={t('inicial.cpl.rotuloEscala')}
                  numero={escala.length}
                  unidade={t('inicial.cpl.clientes', { count: escala.length })}
                  descricao={t('inicial.cpl.descEscala', { min: MIN_CONV_ESCALA })}
                  controle={<SeletorJanela tom="verde" valor={janela} onChange={setJanela} t={t} />}
                >
                  <Lista
                    tom="verde"
                    vazio={t('inicial.cpl.vazioEscala')}
                    itens={escala}
                    render={(p) => {
                      const pc = base.paceDe.get(p.projectId)
                      return (
                        <li key={p.projectId}>
                          <button type="button" onClick={() => abrirCliente(p.projectId)} className={`w-full text-left flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition ${TONS.verde.linha}`}>
                            <Canais canais={p.canais} claro />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium truncate">{nomeProjeto(p.projectId) || '-'}</span>
                              <span className="block text-[11px] text-emerald-50/75 truncate">
                                {t('inicial.cpl.linha', { cpl: brl(p.cpl, 2), alvo: brl(p.alvo, 2) })} · {t('inicial.cpl.detalhe', { conv: Math.round(p.conv), gasto: brl(p.gasto) })}
                              </span>
                            </span>
                            <span className="shrink-0 flex flex-col items-end gap-1">
                              <span className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-[#16613F] tabular-nums">
                                −{Math.round((1 - p.razao) * 100)}%
                              </span>
                              {pc && <span className="text-[10px] text-emerald-50/75 tabular-nums">{t('inicial.cpl.pace', { p: pct(pc.razao) })}</span>}
                            </span>
                          </button>
                        </li>
                      )
                    }}
                  />
                </Bloco>
              </div>

              {/* ── Linha 2: precisam de criativos · precisam de teste de LP ── */}
              <div className="grid gap-4 lg:grid-cols-2">
                {dados.criativosDev
                  ? <BlocoCriativos sugestoes={dados.criativosDev} loading={false} churn={churnSet} {...comum} />
                  : <CriativosAoVivo churn={churnSet} {...comum} />}
                <Bloco
                  tom="grafite"
                  Icon={MousePointerClick}
                  rotulo={t('inicial.lp.rotulo')}
                  numero={lps.length}
                  unidade={t('inicial.fundo.contas', { count: lps.length })}
                  descricao={t('inicial.lp.descricao', { p: TAXA_LP_MIN, min: MIN_VISITAS_LP, de: dataCurta(janLp.de), ate: dataCurta(janLp.ate) })}
                  controle={<SeletorJanela tom="grafite" valor={janelaLp} onChange={setJanelaLp} t={t} />}
                >
                  <Lista
                    tom="grafite"
                    vazio={t('inicial.lp.vazio')}
                    itens={lps}
                    render={(l) => {
                      const nomeCli = nomeProjeto(l.projectId)
                      const pior = l.piores[0]
                      return (
                        <li key={l.chave}>
                          <button type="button" onClick={() => abrirDash(l.conta, l.canal)} title={t('inicial.fundo.abrirDash')}
                            className={`w-full text-left flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition ${TONS.grafite.linha}`}>
                            <span className="grid place-items-center w-7 h-7 rounded-full bg-white shrink-0"><CanalLogo canal={l.canal} className="w-3.5 h-3.5" /></span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium truncate">{nomeCli || l.conta}</span>
                              <span className="block text-[11px] text-neutral-400 truncate">
                                {nomeCli && nomeCli !== l.conta ? `${l.conta} · ` : ''}
                                {t(l.canal === 'meta' ? 'inicial.lp.linhaMeta' : 'inicial.lp.linhaGoogle', { v: Math.round(l.visitas).toLocaleString(locale), c: Math.round(l.conv).toLocaleString(locale) })}
                                {pior && l.piores.length > 0 && ` · ${pior.nome}`}
                              </span>
                            </span>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${l.taxa < TAXA_LP_MIN / 2 ? 'bg-rose-500/15 text-rose-300' : 'bg-amber-400/15 text-amber-300'}`}>
                              {l.taxa.toLocaleString(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%
                            </span>
                          </button>
                        </li>
                      )
                    }}
                  />
                </Bloco>
              </div>

              {/* ── Linha 3: alterações nas contas ── */}
              <Bloco
                tom="grafite"
                Icon={History}
                rotulo={t('inicial.alteracoes.rotulo')}
                numero={alts.length}
                unidade={t('inicial.alteracoes.unidade', { count: alts.length })}
                controle={(
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {dados.criticas > 0 && (
                      <button
                        type="button"
                        onClick={() => navigate('/otimizacoes')}
                        className="inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-medium text-amber-200 hover:bg-amber-400/20 transition"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        {t('inicial.alteracoes.criticas', { count: dados.criticas })}
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    )}
                    <Segmento tom="grafite" valor={quemAlt} onChange={(v) => { setQuemAlt(v); setLimiteAlt(50) }}
                      opcoes={[{ v: 'agentes', l: t('inicial.alteracoes.agentes') }, { v: 'todos', l: t('inicial.alteracoes.todos') }]} />
                    <Segmento tom="grafite" valor={periodoAlt} onChange={(v) => { setPeriodoAlt(v); setLimiteAlt(50) }}
                      opcoes={[{ v: 0, l: t('inicial.alteracoes.hoje') }, { v: 7, l: t('inicial.alteracoes.d7') }, { v: 30, l: t('inicial.alteracoes.d30') }]} />
                  </div>
                )}
              >
                {alts.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-white/15 px-4 py-6 text-center text-xs text-neutral-400">{t('inicial.alteracoes.vazio')}</p>
                ) : (
                  <div className="overflow-auto -mx-1 max-h-[460px] inicial-scroll">
                    <table className="w-full min-w-[860px] text-left text-[13px]">
                      <thead className="sticky top-0 z-10 bg-[#161618]">
                        <tr className="text-[10px] uppercase tracking-[0.12em] text-neutral-500">
                          <th className="px-3 py-2 font-medium w-[110px]">{t('inicial.alteracoes.quando')}</th>
                          <th className="px-3 py-2 font-medium w-[190px]">{t('inicial.alteracoes.cliente')}</th>
                          <th className="px-3 py-2 font-medium w-[240px]">{t('inicial.alteracoes.onde')}</th>
                          <th className="px-3 py-2 font-medium">{t('inicial.alteracoes.feito')}</th>
                          <th className="px-3 py-2 font-medium w-[170px]">{t('inicial.alteracoes.quem')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[.06]">
                        {alts.slice(0, limiteAlt).map((a) => {
                          const quando = new Date(a.quando)
                          return (
                            <tr key={a.id} className="align-top hover:bg-white/[.03]">
                              <td className="px-3 py-2.5 text-neutral-400 tabular-nums whitespace-nowrap">
                                {quando.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })}
                                <span className="text-neutral-600"> · {quando.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</span>
                              </td>
                              <td className="px-3 py-2.5">
                                <button type="button" onClick={() => abrirCliente(a.projectId)} className="text-left font-medium text-neutral-100 hover:underline underline-offset-2 line-clamp-1">
                                  {nomeProjeto(a.projectId) || a.conta || '-'}
                                </button>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="flex items-start gap-2 min-w-0">
                                  <CanalLogo canal={a.canal} className="w-3.5 h-3.5 mt-0.5" />
                                  <span className="min-w-0">
                                    <span className="block text-neutral-300 truncate max-w-[210px]" title={a.campanha || ''}>{a.campanha || a.conta || '-'}</span>
                                    {a.alvo && a.alvo !== a.campanha && <span className="block text-[11px] text-neutral-500 truncate max-w-[210px]" title={a.alvo}>{a.alvo}</span>}
                                  </span>
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-neutral-200">
                                <ul className="space-y-0.5">
                                  {a.acoes.map((x, i) => <li key={i} className="leading-snug">{x}</li>)}
                                </ul>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] ${a.agente ? 'bg-sky-400/10 text-sky-200' : 'bg-white/[.06] text-neutral-300'}`}>
                                  {a.agente ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
                                  <span className="truncate max-w-[130px]">{a.quem.replace(/\s*\(agente\)\s*/i, '') || '-'}</span>
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {alts.length > limiteAlt && (
                      <div className="pt-3 text-center">
                        <button type="button" onClick={() => setLimiteAlt((l) => l + 100)} className="rounded-full border border-white/10 bg-neutral-800/80 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700">
                          {t('inicial.alteracoes.mostrarMais', { n: alts.length - limiteAlt })}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </Bloco>

              {/* ── Linha 4: pace abaixo · pace acima ── */}
              <div className="grid gap-4 lg:grid-cols-2">
                <Bloco
                  tom="amarelo"
                  Icon={TrendingDown}
                  rotulo={t('inicial.pace.rotuloAbaixo')}
                  numero={paceAbaixo.length}
                  unidade={t('inicial.cpl.clientes', { count: paceAbaixo.length })}
                  descricao={t('inicial.pace.descAbaixo', { p: pct(PACE_MIN) })}
                >
                  <Lista tom="amarelo" vazio={t('inicial.pace.vazioAbaixo')} itens={paceAbaixo}
                    render={(p) => <LinhaPace key={p.projectId} p={p} tom="amarelo" nome={nomeProjeto(p.projectId)} onClick={() => abrirCliente(p.projectId)} t={t} brl={brl} />} />
                </Bloco>
                <Bloco
                  tom="grafite"
                  Icon={Gauge}
                  rotulo={t('inicial.pace.rotuloAcima')}
                  numero={paceAcima.length}
                  unidade={t('inicial.cpl.clientes', { count: paceAcima.length })}
                  descricao={t('inicial.pace.descAcima', { p: pct(PACE_MAX) })}
                >
                  <Lista tom="grafite" vazio={t('inicial.pace.vazioAcima')} itens={paceAcima}
                    render={(p) => <LinhaPace key={p.projectId} p={p} tom="grafite" acima nome={nomeProjeto(p.projectId)} onClick={() => abrirCliente(p.projectId)} t={t} brl={brl} />} />
                </Bloco>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SeletorJanela({ tom, valor, onChange, t }) {
  return (
    <Segmento tom={tom} valor={valor} onChange={onChange}
      opcoes={[{ v: '7d', l: t('inicial.janelas.s7') }, { v: '14d', l: t('inicial.janelas.s14') }, { v: 'mes', l: t('inicial.janelas.mes') }]} />
  )
}

function Canais({ canais, claro = false }) {
  return (
    <span className="flex -space-x-1.5 shrink-0 w-10">
      {(canais.length ? canais : ['meta']).map((c) => (
        <span key={c} className={`grid place-items-center w-7 h-7 rounded-full ${claro ? 'bg-white' : 'bg-white ring-2 ring-[#151517]'}`}>
          <CanalLogo canal={c} className="w-3.5 h-3.5" />
        </span>
      ))}
    </span>
  )
}

// Linha de pace: barra do gasto sobre o orçamento, com a marca do esperado até ontem
// e o previsto de fechamento à direita.
function LinhaPace({ p, tom, nome, onClick, t, brl, acima = false }) {
  const c = TONS[tom]
  const amarelo = tom === 'amarelo'
  const cheio = Math.min(100, (p.gasto / p.orcamento) * 100)
  const marca = Math.min(100, (p.esperado / p.orcamento) * 100)
  return (
    <li>
      <button type="button" onClick={onClick} className={`w-full text-left rounded-2xl border px-3.5 py-3 transition ${c.linha}`}>
        <span className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium truncate">{nome || '-'}</span>
            <span className={`block text-[11px] truncate ${c.fraco}`}>
              {t('inicial.pace.gastoDe', { gasto: brl(p.gasto), orc: brl(p.orcamento) })}
              {' · '}
              {p.restantes <= 0
                ? t('inicial.pace.ritmoFim', { gasto: brl(p.gasto) })
                : !acima
                  ? t('inicial.pace.ritmo', { nec: brl(p.necessario), ritmo: brl(p.ritmo) })
                  : p.gasto >= p.orcamento
                    ? t('inicial.pace.estourado', { ritmo: brl(p.ritmo) })
                    : t('inicial.pace.cabe', { nec: brl(p.necessario), ritmo: brl(p.ritmo) })}
            </span>
          </span>
          <span className="text-right shrink-0">
            <span className={`block text-sm font-semibold tabular-nums ${amarelo ? '' : 'text-orange-300'}`}>{t('inicial.pace.previsto', { p: pct(p.razao) })}</span>
            <span className={`block text-[10px] ${c.fraco}`}>{p.fonte === 'plano' ? t('inicial.pace.fontePlano') : t('inicial.pace.fonteRoi')}</span>
          </span>
        </span>
        <span className={`relative mt-2.5 block h-1.5 rounded-full ${amarelo ? 'bg-yellow-950/15' : 'bg-white/10'}`} title={t('inicial.pace.esperado', { v: brl(p.esperado) })}>
          <span className={`absolute inset-y-0 left-0 rounded-full ${amarelo ? 'bg-yellow-950/80' : 'bg-orange-400'}`} style={{ width: `${cheio}%` }} />
          <span className={`absolute -top-1 h-3.5 w-0.5 rounded ${amarelo ? 'bg-yellow-950' : 'bg-white'}`} style={{ left: `calc(${marca}% - 1px)` }} />
        </span>
      </button>
    </li>
  )
}

// ─── Precisam de criativos ──────────────────────────────────────────────────
// Lê as sugestões pendentes do playbook pelo mesmo hook da Central de Otimizações
// (20 dias de dados por anúncio, no cache local compartilhado com o /otimizacoes).
// Fica num componente à parte para os outros blocos não esperarem essa leitura.
function CriativosAoVivo(props) {
  const dash = useDashboardData({ source: 'api', dias: 20, status: true })
  const sg = useSugestoesGlobais(dash)
  return <BlocoCriativos sugestoes={sg.pendentes} loading={sg.loading} erro={sg.erro} {...props} />
}

const ROTULO_MOTIVO = {
  ctr_baixo: 'inicial.criativos.motivos.ctr_baixo',
  saturacao: 'inicial.criativos.motivos.saturacao',
  poucos_criativos: 'inicial.criativos.motivos.poucos_criativos',
  topo_gancho: 'inicial.criativos.motivos.topo_gancho',
  ad_trocar: 'inicial.criativos.motivos.ad_trocar',
}

function BlocoCriativos({ sugestoes, loading, erro, churn, t, nomeProjeto, abrirCliente, navigate }) {
  const lista = useMemo(() => precisamDeCriativo(sugestoes || [], { churn }), [sugestoes, churn])
  const vazio = loading && !lista.length
  return (
    <Bloco
      tom="violeta"
      Icon={Palette}
      rotulo={t('inicial.criativos.rotulo')}
      numero={vazio ? null : lista.length}
      unidade={t('inicial.cpl.clientes', { count: lista.length })}
      descricao={t('inicial.criativos.descricao')}
      controle={(
        <button type="button" onClick={() => navigate('/otimizacoes')}
          className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] font-medium hover:bg-white/20 transition">
          {t('inicial.alteracoes.abrirCentral')}<ArrowUpRight className="w-3 h-3" />
        </button>
      )}
    >
      {vazio ? (
        <p className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 px-4 py-6 text-xs text-indigo-50/80">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />{t('inicial.criativos.carregando')}
        </p>
      ) : erro && !lista.length ? (
        <p className="rounded-2xl border border-dashed border-white/20 px-4 py-6 text-center text-xs text-indigo-50/80">{t('inicial.erro', { msg: erro })}</p>
      ) : (
        <Lista
          tom="violeta"
          vazio={t('inicial.criativos.vazio')}
          itens={lista}
          render={(g) => (
            <li key={g.projectId}>
              <button type="button" onClick={() => abrirCliente(g.projectId)}
                className={`w-full text-left flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition ${TONS.violeta.linha}`}>
                <Canais canais={g.canais} claro />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium truncate">{nomeProjeto(g.projectId) || g.contas[0] || '-'}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {g.motivos.map(([m, n]) => (
                      <span key={m} className="rounded-full bg-white/15 px-1.5 py-px text-[10px] text-indigo-50">
                        {ROTULO_MOTIVO[m] ? t(ROTULO_MOTIVO[m]) : m}{n > 1 ? ` ×${n}` : ''}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-semibold tabular-nums">{g.total}</span>
                  <span className="block text-[10px] text-indigo-50/75">{t('inicial.criativos.sugestoes', { count: g.total })}</span>
                </span>
              </button>
            </li>
          )}
        />
      )}
    </Bloco>
  )
}
