import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import AppSidebar from '../components/AppSidebar'
import {
  FAIXAS, REGRAS, BENCHMARKS, NOMENCLATURA, VISUALIZACOES, LINKS,
} from '../lib/adsRoadmap'
import {
  Menu, Zap, Waypoints, ExternalLink, ChevronDown, Table2, GitFork, ShieldCheck,
  Gauge, Tag, Columns3, Info,
} from 'lucide-react'

// ─── Árvore campanha → conjunto → anúncios ───────────────────────────────────
// Desenho em HTML puro: cada linha é uma campanha; os conectores são bordas.
// Tracejado = opcional (só entra se o cliente tiver a condição na nota).

const SEG = { b2c: 'B2C', b2b: 'B2B' }

function Caixa({ titulo, sub, opcional, destaque, tag }) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 min-w-[150px] ${
        opcional ? 'border-dashed border-rl-muted/60' : 'border-rl-border'
      } ${destaque ? 'bg-rl-purple/10' : 'bg-rl-surface'}`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`text-[13px] leading-tight ${destaque ? 'font-bold text-rl-text' : 'font-semibold text-rl-text'}`}>{titulo}</span>
        {tag && (
          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-rl-cyan/15 text-rl-cyan border border-rl-cyan/30">
            {tag}
          </span>
        )}
      </div>
      {sub && <div className="text-[11px] text-rl-muted leading-tight mt-0.5">{sub}</div>}
    </div>
  )
}

function Ad({ label, opcional }) {
  if (label === '…') return <div className="text-rl-muted text-sm leading-none px-3">···</div>
  return (
    <div className={`rounded-md border px-2.5 py-1 text-[12px] text-rl-text bg-rl-card whitespace-nowrap ${
      opcional ? 'border-dashed border-rl-muted/60' : 'border-rl-border'
    }`}>
      {label}
    </div>
  )
}

// Conector vertical + ramos horizontais, feito com bordas. O traço vertical
// vai só do centro do primeiro ramo ao centro do último.
function Ramo({ children, opcional }) {
  const b = opcional ? 'border-dashed border-rl-muted/60' : 'border-rl-border'
  const n = children.length
  return (
    <div className="flex flex-col gap-2">
      {children.map((child, i) => (
        <div key={i} className="flex items-stretch">
          <div className="w-4 shrink-0 flex flex-col">
            <div className={`flex-1 ${i === 0 ? '' : `border-l ${b}`}`} />
            <div className={`flex-1 ${i === n - 1 ? '' : `border-l ${b}`}`} />
          </div>
          <div className="flex items-center">
            <div className={`w-4 border-t ${b}`} />
            {child}
          </div>
        </div>
      ))}
    </div>
  )
}

function Conjunto({ c, opcional }) {
  const opc = opcional || c.opcional
  return (
    <div className="flex items-center">
      <Caixa titulo={c.nome} sub={c.sub} opcional={opc} />
      <div className="flex flex-col py-1">
        <Ramo opcional={opc}>
          {c.ads.map((a, i) => <Ad key={i} label={a} opcional={opc} />)}
        </Ramo>
        {c.nota && (
          <div className="text-[11px] text-rl-muted leading-snug pl-8 pt-1 italic max-w-[360px]">{c.nota}</div>
        )}
      </div>
    </div>
  )
}

function Campanha({ camp }) {
  const opc = camp.opcional
  return (
    <div className="flex items-center">
      <Caixa
        titulo={camp.nome}
        sub={[camp.sub, camp.verba].filter(Boolean).join(' · ')}
        opcional={opc}
        destaque
        tag={camp.tipo || null}
      />
      <Ramo opcional={opc}>
        {camp.conjuntos.map((c, i) => <Conjunto key={i} c={c} opcional={opc} />)}
      </Ramo>
    </div>
  )
}

function Estrutura({ campanhas, notas, titulo, vazio }) {
  return (
    <div className="glass-card p-5 space-y-4 overflow-x-auto">
      <div className="flex items-center gap-2">
        <GitFork className="w-4 h-4 text-rl-cyan" />
        <h3 className="text-sm font-bold text-rl-text">{titulo}</h3>
      </div>
      {campanhas ? (
        <div className="space-y-5 min-w-max">
          {campanhas.map((camp, i) => <Campanha key={i} camp={camp} />)}
        </div>
      ) : (
        <p className="text-sm text-rl-muted">{vazio}</p>
      )}
      {notas?.length > 0 && (
        <ul className="text-[12px] text-rl-subtle space-y-1 pt-2 border-t border-rl-border/60">
          {notas.map((n, i) => <li key={i}>• {n}</li>)}
        </ul>
      )}
    </div>
  )
}

// ─── Tabela explicativa ──────────────────────────────────────────────────────
function Tabela({ rows, seg }) {
  const cols = seg === 'ambos' ? ['b2c', 'b2b'] : [seg]
  return (
    <div className="glass-card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-rl-border">
        <Table2 className="w-4 h-4 text-rl-cyan" />
        <h3 className="text-sm font-bold text-rl-text">Tabela explicativa</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-rl-surface text-left">
              <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-rl-muted w-48">Parâmetro</th>
              {cols.map((c) => (
                <th key={c} className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-rl-muted">{SEG[c]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([param, b2c, b2b], i) => {
              const val = { b2c, b2b }
              return (
                <tr key={i} className="border-t border-rl-border/60 align-top">
                  <td className="px-4 py-3 font-semibold text-rl-text text-[13px]">{param}</td>
                  {cols.map((c) => (
                    <td key={c} className={`px-4 py-3 text-[13px] whitespace-pre-line leading-relaxed ${
                      val[c] === 'Não faz' ? 'text-rl-muted italic' : 'text-rl-subtle'
                    }`}>
                      {val[c] || <span className="text-rl-muted">–</span>}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Regras universais (acordeão) ────────────────────────────────────────────
function Acordeao({ Icon, titulo, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-5 py-3.5 text-left hover:bg-rl-surface/60 transition-colors"
        aria-expanded={open}
      >
        <Icon className="w-4 h-4 text-rl-cyan shrink-0" />
        <span className="text-sm font-bold text-rl-text flex-1">{titulo}</span>
        <ChevronDown className={`w-4 h-4 text-rl-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-5 pb-5 pt-1 border-t border-rl-border/60">{children}</div>}
    </div>
  )
}

function Regras() {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {REGRAS.map((r) => (
        <div key={r.id} className="glass-card p-5">
          <h4 className="text-sm font-bold text-rl-text mb-2">{r.titulo}</h4>
          <ul className="space-y-1.5">
            {r.itens.map((it, i) => (
              <li key={i} className="text-[13px] text-rl-subtle leading-relaxed flex gap-2">
                <span className="text-rl-cyan shrink-0">•</span>
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function Benchmarks() {
  return (
    <div className="grid md:grid-cols-3 gap-4">
      {BENCHMARKS.map((b) => (
        <div key={b.etapa} className="glass-card p-5 space-y-3">
          <div>
            <h4 className="text-sm font-bold text-rl-text">{b.etapa}</h4>
            <p className="text-[12px] text-rl-muted">{b.objetivo}</p>
          </div>
          <table className="w-full text-[12px]">
            <tbody>
              {b.metricas.map(([m, v]) => (
                <tr key={m} className="border-t border-rl-border/60">
                  <td className="py-1.5 pr-2 text-rl-subtle">{m}</td>
                  <td className="py-1.5 text-rl-text font-semibold text-right whitespace-nowrap">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[12px] text-rl-muted italic leading-snug">{b.otimizacao}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Página ──────────────────────────────────────────────────────────────────
export default function AdsRoadmap() {
  const navigate = useNavigate()
  const { squads, teamMembers } = useApp()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const emptyCounts = { all: 0, churn: 0, squads: {}, risks: {}, momentos: {} }
  const activeAccounts = teamMembers.filter((m) => !m.disabled)

  const [faixaId, setFaixaId] = useState('3k')
  const [seg, setSeg] = useState('b2c') // 'b2c' | 'b2b' | 'ambos'
  const faixa = useMemo(() => FAIXAS.find((f) => f.id === faixaId) || FAIXAS[0], [faixaId])
  const est = faixa.estrutura

  const segBtn = (id, label) => (
    <button
      key={id}
      onClick={() => setSeg(id)}
      className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
        seg === id ? 'bg-rl-purple text-white' : 'text-rl-subtle hover:text-rl-text hover:bg-rl-surface'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="min-h-screen flex bg-gradient-dark">
      <AppSidebar
        filter="all"
        setFilter={() => navigate('/')}
        counts={emptyCounts}
        activeAccounts={activeAccounts}
        squads={squads}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-rl-border bg-rl-bg/90 backdrop-blur-xl">
          <button onClick={() => setSidebarOpen(true)} aria-label="Abrir menu de navegação" className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-rl flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-rl-text text-sm">ADS Roadmap</span>
          </div>
        </div>

        <main className="flex-1 px-6 py-8">
          <div className="max-w-7xl mx-auto space-y-8">

            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rl-cyan/10 flex items-center justify-center">
                  <Waypoints className="w-5 h-5 text-rl-cyan" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-rl-text">ADS Roadmap</h1>
                  <p className="text-sm text-rl-muted">O que dá pra montar de campanha com a verba que o cliente trouxe</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a href={LINKS.roadmapClickUp} target="_blank" rel="noopener noreferrer" className="btn-secondary !px-4 !py-2 text-xs flex items-center gap-1.5">
                  Roadmap no ClickUp <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Seletor de verba */}
            <div className="glass-card p-4 space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rl-muted mr-1">Verba mensal</span>
                  {FAIXAS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFaixaId(f.id)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                        f.id === faixaId
                          ? 'bg-gradient-rl text-white border-transparent shadow-card'
                          : 'bg-rl-surface text-rl-subtle border-rl-border hover:text-rl-text hover:border-rl-purple/40'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1 p-1 rounded-xl bg-rl-surface border border-rl-border">
                  {segBtn('b2c', 'B2C')}
                  {segBtn('b2b', 'B2B')}
                  {segBtn('ambos', 'Lado a lado')}
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm text-rl-subtle">
                <Info className="w-4 h-4 text-rl-cyan shrink-0 mt-0.5" />
                <p>
                  <strong className="text-rl-text">{faixa.label}</strong> · R$ {faixa.verbaDia}/dia. {faixa.resumo}
                </p>
              </div>
            </div>

            {/* Estruturas */}
            <section className="space-y-4">
              <h2 className="text-base font-bold text-rl-text">Estrutura de campanhas</h2>
              <div className={`grid gap-4 ${seg === 'ambos' ? 'xl:grid-cols-2' : ''}`}>
                {(seg === 'b2c' || seg === 'ambos') && (
                  <Estrutura
                    titulo={`Meta B2C · R$ ${faixa.verbaDia}/dia`}
                    campanhas={est.b2c}
                    notas={est.notas?.b2c}
                    vazio="B2C não faz nessa faixa."
                  />
                )}
                {(seg === 'b2b' || seg === 'ambos') && (
                  <Estrutura
                    titulo={`Meta B2B · R$ ${faixa.verbaDia}/dia`}
                    campanhas={est.b2b}
                    notas={est.notas?.b2b}
                    vazio="B2B não faz nessa faixa: o CPL de B2B não fecha com essa verba diária."
                  />
                )}
              </div>
              {est.google && (
                <Estrutura
                  titulo={est.google.titulo}
                  campanhas={est.google.campanhas}
                  notas={[est.google.nota]}
                />
              )}
            </section>

            {/* Tabela */}
            <section className="space-y-4">
              <Tabela rows={faixa.rows} seg={seg} />
            </section>

            {/* Regras universais */}
            <section className="space-y-4">
              <h2 className="text-base font-bold text-rl-text">Regras que valem em toda faixa</h2>
              <Acordeao Icon={ShieldCheck} titulo="Otimizar, desligar, escalar, verba mínima, canais e Laboratório" defaultOpen>
                <div className="pt-3"><Regras /></div>
              </Acordeao>
              <Acordeao Icon={Gauge} titulo="Benchmarks por etapa do funil (Protocolo)">
                <div className="pt-3"><Benchmarks /></div>
              </Acordeao>
              <Acordeao Icon={Tag} titulo="Nomenclatura de campanha, conjunto e anúncio">
                <table className="w-full text-sm mt-3">
                  <thead>
                    <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-rl-muted">
                      <th className="py-2 pr-4">Nível</th><th className="py-2 pr-4">Padrão</th><th className="py-2">Exemplo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {NOMENCLATURA.map(([n, p, e]) => (
                      <tr key={n} className="border-t border-rl-border/60">
                        <td className="py-2 pr-4 font-semibold text-rl-text">{n}</td>
                        <td className="py-2 pr-4 text-rl-subtle">{p}</td>
                        <td className="py-2 font-mono text-[12px] text-rl-cyan">{e}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Acordeao>
              <Acordeao Icon={Columns3} titulo="Visualizações de coluna no Gerenciador (criar uma vez por conta)">
                <div className="space-y-3 mt-3">
                  {VISUALIZACOES.map((v) => (
                    <div key={v.nome}>
                      <div className="text-[13px] font-semibold text-rl-text">{v.nome}</div>
                      <div className="text-[12px] text-rl-subtle leading-relaxed">{v.colunas}</div>
                    </div>
                  ))}
                </div>
              </Acordeao>
              <p className="text-[12px] text-rl-muted">
                Fonte: página Roadmap Ads do Playbook Operacional e o Protocolo de Gestão de Tráfego. Mudou lá, atualize <code className="text-rl-cyan">src/lib/adsRoadmap.js</code>.
                {' '}<a href={LINKS.labClickUp} target="_blank" rel="noopener noreferrer" className="text-rl-cyan hover:underline">Laboratório REV</a>
              </p>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
