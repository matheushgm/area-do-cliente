import { useState, useMemo } from 'react'
import {
  FlaskConical, DollarSign, Calendar, ChevronDown, ChevronUp,
  CheckCircle2, AlertCircle, Video, Users, Zap, Target,
  Play, TrendingUp, Info,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const DAILY   = 35
const C_TOTAL = 11   // criativos a testar na Fase 01
const P_TOTAL = 5    // públicos  a testar na Fase 02
const G_TOTAL = 5    // ganchos   a testar na Fase 03

const AUDIENCE_TYPES = [
  { id: 'remarketing', label: 'Remarketing',      hint: 'Cliente tem público de engajamento grande (recomendado)' },
  { id: 'lookalike',   label: 'Lookalike',         hint: 'Cliente tem lista de clientes para criar público semelhante' },
  { id: 'interesses',  label: 'Interesses Gerais', hint: 'Início do zero, sem histórico de público' },
]

const PHASE_DEF = [
  {
    key: 'f1', num: '01', name: 'Teste de Criativos',
    icon: Video, color: 'rl-purple',
    days: 'Dias 1–7',    totalItems: C_TOTAL, keepMax: 3,
    itemLabel: 'criativo', itemsLabel: 'criativos',
    description: 'Identificar os 3 criativos com maior potencial de conversão em 7 dias.',
    selectionDay2: ['Priorize menor CPL (se houve conversões)', 'Use CTR no link como critério (se não houve conversões)'],
    dias2a7: 'Continue com os top criativos ajustando verba por desempenho diário. Substitua criativos de baixa performance se necessário.',
    objective: 'Conversão ou Tráfego',
  },
  {
    key: 'f2', num: '02', name: 'Teste de Públicos',
    icon: Users, color: 'rl-blue',
    days: 'Dias 8–14',   totalItems: P_TOTAL, keepMax: 3,
    itemLabel: 'público', itemsLabel: 'públicos',
    description: 'Com o criativo campeão da Fase 01, descobrir os públicos com maior probabilidade de conversão.',
    selectionDay2: ['Menor CPL (se houve conversões)', 'CTR no link + Custo por clique (se não houve conversões)'],
    dias2a7: 'Mantenha os top públicos, avalie CPL/ROAS diariamente. Se um público cair, substitua por outro da lista inicial ou um novo baseado no aprendizado.',
    publicosTipos: ['Lookalikes', 'Interesses', 'Públicos Quentes', 'Regionais', 'Demográficos'],
    objective: 'Conversão ou Tráfego',
  },
  {
    key: 'f3', num: '03', name: 'Teste de Ganchos',
    icon: Zap, color: 'rl-gold',
    days: 'Dias 15–21', totalItems: G_TOTAL, keepMax: 2,
    itemLabel: 'gancho', itemsLabel: 'ganchos',
    description: 'Com criativo campeão + público campeão, testar variações de abertura de vídeo para aumentar retenção e reduzir CPL.',
    selectionDay2: ['Menor CPL (se houve conversões)', 'Retenção nos 3 primeiros segundos + CTR (se não houve conversões)'],
    dias2a7: 'Os 2 ganchos vencedores continuam rodando. Monitore CPL, CTR e engajamento. Se um despontar, pode duplicar e escalar.',
    ganchosTipos: ['Novo começo de vídeo', 'Fala ou abordagem diferente', 'Pergunta chamativa', 'Expressão visual impactante', 'Dado ou estatística de impacto'],
    objective: 'Conversão (criativo e público já validados)',
    bigBudget: true,
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(n) {
  if (n == null || !isFinite(n) || isNaN(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function calcPhase(budget, totalItems, keepMax) {
  for (let n = totalItems; n >= 1; n--) {
    const keepN = Math.min(keepMax, n)
    const cost  = n * DAILY + keepN * DAILY * 6
    if (cost <= budget) {
      return {
        conjuntos: n,
        itemsPerConjunto: Math.ceil(totalItems / n),
        keepAfterDay1: keepN,
        dia1Cost: n * DAILY,
        dias2a7Cost: keepN * DAILY * 6,
        totalCost: cost,
        isStandard: n === totalItems,
      }
    }
  }
  return null
}

function calcLab(budget) {
  const f1 = calcPhase(budget, C_TOTAL, 3)
  if (!f1) return null

  const rem1 = budget - f1.totalCost

  // Phase 2 — precisa de pelo menos 2 conjuntos no Dia 1
  let f2 = null
  const f2c = calcPhase(rem1, P_TOTAL, 3)
  if (f2c && f2c.conjuntos >= 2) f2 = f2c

  const rem2 = f2 ? rem1 - f2.totalCost : rem1

  // Phase 3 — precisa de pelo menos 2 conjuntos + manter 2
  let f3 = null
  if (f2) {
    const f3c = calcPhase(rem2, G_TOTAL, 2)
    if (f3c && f3c.conjuntos >= 2) f3 = f3c
  }

  const total = f1.totalCost + (f2?.totalCost || 0) + (f3?.totalCost || 0)
  const phases = [f1, f2, f3].filter(Boolean).length
  const duration = phases * 7

  let labType, labColor, labBorder, labBg
  if      (f3 && f1.isStandard && f2.isStandard && f3.isStandard) {
    labType = 'Completo';  labColor = 'text-rl-green';  labBg = 'bg-rl-green/10';  labBorder = 'border-rl-green/20'
  } else if (f2 && f1.isStandard && f2.isStandard) {
    labType = 'Padrão';    labColor = 'text-rl-blue';   labBg = 'bg-rl-blue/10';   labBorder = 'border-rl-blue/20'
  } else if (f2) {
    labType = 'Intermediário'; labColor = 'text-rl-purple'; labBg = 'bg-rl-purple/10'; labBorder = 'border-rl-purple/20'
  } else if (f1.conjuntos >= 5) {
    labType = 'Reduzido';  labColor = 'text-rl-gold';   labBg = 'bg-rl-gold/10';   labBorder = 'border-rl-gold/20'
  } else {
    labType = 'Mínimo';    labColor = 'text-red-400';   labBg = 'bg-red-400/10';   labBorder = 'border-red-400/20'
  }

  return { f1, f2, f3, total, duration, phases, labType, labColor, labBg, labBorder }
}

// ─── Phase Card ───────────────────────────────────────────────────────────────

function PhaseCard({ def, plan, audienceType, isFirst }) {
  const [open, setOpen] = useState(isFirst)
  const Icon = def.icon
  const colorMap = {
    'rl-purple': { text: 'text-rl-purple', bg: 'bg-rl-purple/10', border: 'border-rl-purple/20', badge: 'bg-rl-purple text-white' },
    'rl-blue':   { text: 'text-rl-blue',   bg: 'bg-rl-blue/10',   border: 'border-rl-blue/20',   badge: 'bg-rl-blue text-white' },
    'rl-gold':   { text: 'text-rl-gold',   bg: 'bg-rl-gold/10',   border: 'border-rl-gold/20',   badge: 'bg-rl-gold text-rl-bg' },
  }
  const c = colorMap[def.color]

  const audienceLabel = {
    remarketing: 'Remarketing (público de engajamento)',
    lookalike:   'Lookalike (público semelhante à base de clientes)',
    interesses:  'Interesses gerais mistos',
  }[audienceType] || 'A definir conforme o cliente'

  return (
    <div className={`glass-card overflow-hidden border ${c.border}`}>
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-5 py-4 ${c.bg} text-left`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center shrink-0`}>
            <Icon className={`w-4 h-4 ${c.text}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold ${c.text} uppercase tracking-wider`}>Fase {def.num}</span>
              {!plan.isStandard && (
                <span className="text-[10px] font-medium text-rl-gold bg-rl-gold/10 border border-rl-gold/20 px-1.5 py-0.5 rounded-full">Adaptado</span>
              )}
            </div>
            <p className="text-sm font-semibold text-rl-text">{def.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-rl-muted">{def.days}</p>
            <p className="text-sm font-bold text-rl-text">{fmtBRL(plan.totalCost)}</p>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-rl-muted" /> : <ChevronDown className="w-4 h-4 text-rl-muted" />}
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="p-5 space-y-5">
          <p className="text-xs text-rl-muted leading-relaxed">{def.description}</p>

          {/* Structure */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Dia 1 */}
            <div className="rounded-xl bg-rl-surface border border-rl-border p-4 space-y-2">
              <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wider flex items-center gap-1.5">
                <Play className="w-3 h-3" /> Dia 1 — Lançamento
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-rl-subtle">Conjuntos de anúncio</span>
                  <span className={`text-sm font-bold ${c.text}`}>{plan.conjuntos}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-rl-subtle">{def.itemsLabel} por conjunto</span>
                  <span className="text-sm font-semibold text-rl-text">{plan.itemsPerConjunto}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-rl-subtle">Verba por conjunto</span>
                  <span className="text-sm font-semibold text-rl-text">{fmtBRL(DAILY)}/dia</span>
                </div>
                <div className="flex items-center justify-between border-t border-rl-border/60 pt-1.5 mt-1.5">
                  <span className="text-xs font-medium text-rl-text">Gasto no Dia 1</span>
                  <span className={`text-sm font-bold ${c.text}`}>{fmtBRL(plan.dia1Cost)}</span>
                </div>
              </div>
            </div>

            {/* Dias 2–7 */}
            <div className="rounded-xl bg-rl-surface border border-rl-border p-4 space-y-2">
              <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3" /> Dias 2–7 — Otimização
              </p>
              <div className="space-y-1.5">
                <p className="text-[10px] text-rl-muted mb-2">No Dia 2, pause os piores e mantenha:</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-rl-subtle">Conjuntos mantidos</span>
                  <span className={`text-sm font-bold ${c.text}`}>{plan.keepAfterDay1} melhores</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-rl-subtle">Gasto diário (dias 2–7)</span>
                  <span className="text-sm font-semibold text-rl-text">{fmtBRL(plan.keepAfterDay1 * DAILY)}/dia</span>
                </div>
                <div className="flex items-center justify-between border-t border-rl-border/60 pt-1.5 mt-1.5">
                  <span className="text-xs font-medium text-rl-text">Total dias 2–7</span>
                  <span className={`text-sm font-bold ${c.text}`}>{fmtBRL(plan.dias2a7Cost)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Critérios de seleção */}
          <div className="rounded-xl bg-rl-surface border border-rl-border p-4">
            <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Target className="w-3 h-3" /> Critério de Seleção no Dia 2
            </p>
            <ul className="space-y-1">
              {def.selectionDay2.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-rl-subtle">
                  <span className={`mt-0.5 text-[9px] font-bold ${c.text} bg-rl-surface border ${c.border} px-1.5 py-0.5 rounded-full shrink-0`}>
                    {i === 0 ? '1º' : '2º'}
                  </span>
                  {s}
                </li>
              ))}
            </ul>
          </div>

          {/* Configuração da campanha */}
          <div className={`rounded-xl border ${c.border} ${c.bg} p-4 space-y-3`}>
            <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{color: 'var(--tw-prose-body)'}}>
              <Info className={`w-3 h-3 ${c.text}`} />
              <span className={c.text}>Como configurar no Meta Ads</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <ConfigItem label="Objetivo da campanha" value={def.objective} />
              <ConfigItem label="Orçamento" value="Por conjunto de anúncios (ABO)" />
              <ConfigItem label="Verba por conjunto/dia" value={`R$${DAILY},00`} />
              <ConfigItem label="Nº de conjuntos (Dia 1)" value={`${plan.conjuntos} conjuntos`} />
              {def.key === 'f1' && (
                <ConfigItem label="Público (Fase 01)" value={audienceLabel} className="sm:col-span-2" />
              )}
              {def.key === 'f2' && (
                <>
                  <ConfigItem label="Criativo nos conjuntos" value="Criativo campeão da Fase 01" className="sm:col-span-2" />
                  <div className="sm:col-span-2">
                    <p className="text-rl-muted mb-1">Sugestão de públicos a testar:</p>
                    <div className="flex flex-wrap gap-1">
                      {def.publicosTipos.map((p) => (
                        <span key={p} className={`text-[10px] px-2 py-0.5 rounded-full border ${c.border} ${c.bg} ${c.text} font-medium`}>{p}</span>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {def.key === 'f3' && (
                <>
                  <ConfigItem label="Base" value="Vídeo campeão da Fase 01 (só muda o início)" className="sm:col-span-2" />
                  <ConfigItem label="Público" value="Público campeão da Fase 02" className="sm:col-span-2" />
                  <div className="sm:col-span-2">
                    <p className="text-rl-muted mb-1">Tipos de gancho a solicitar ao cliente:</p>
                    <div className="flex flex-wrap gap-1">
                      {def.ganchosTipos.map((g) => (
                        <span key={g} className={`text-[10px] px-2 py-0.5 rounded-full border ${c.border} ${c.bg} ${c.text} font-medium`}>{g}</span>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            {/* Naming suggestion */}
            <div className="mt-2 pt-3 border-t border-current/10">
              <p className="text-[10px] text-rl-muted mb-1.5">Sugestão de nomenclatura:</p>
              <div className="space-y-1">
                <p className="text-[10px] font-mono bg-rl-bg/60 px-2 py-1 rounded-lg text-rl-subtle">
                  Campanha: <span className={c.text}>[Cliente] – LAB – Fase {def.num} – {def.name}</span>
                </p>
                <p className="text-[10px] font-mono bg-rl-bg/60 px-2 py-1 rounded-lg text-rl-subtle">
                  Conjunto: <span className={c.text}>[Cliente] – F{def.num} – CA01 / CA02 …</span>
                </p>
                <p className="text-[10px] font-mono bg-rl-bg/60 px-2 py-1 rounded-lg text-rl-subtle">
                  Anúncio: <span className={c.text}>[Cliente] – F{def.num} – CA01 – AD01 …</span>
                </p>
              </div>
            </div>
          </div>

          {/* Dias 2-7 note */}
          <div className="flex items-start gap-2 text-xs text-rl-muted bg-rl-surface rounded-xl p-3 border border-rl-border">
            <TrendingUp className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rl-purple" />
            <p>{def.dias2a7}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function ConfigItem({ label, value, className = '' }) {
  return (
    <div className={className}>
      <p className="text-rl-muted text-[10px]">{label}</p>
      <p className="text-rl-text font-medium text-xs mt-0.5">{value}</p>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MetaLabModule({ project }) {
  const [budget, setBudget]         = useState(project.metaLabBudget || 0)
  const [audienceType, setAudience] = useState('lookalike')

  const lab = useMemo(() => (budget >= DAILY * 7 ? calcLab(budget) : null), [budget])

  const PRESETS = [800, 1200, 1925, 2520]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-rl-text flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-rl-purple" />
          Laboratório Meta Ads
        </h2>
        <p className="text-sm text-rl-muted mt-0.5">
          Metodologia de 21 dias para testar e validar criativos, públicos e ganchos no Meta Ads
        </p>
      </div>

      {/* Budget + audience */}
      <div className="glass-card p-5 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Budget */}
          <div>
            <label className="label-field">Orçamento disponível para o laboratório</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rl-muted text-sm pointer-events-none">R$</span>
              <input
                type="number"
                min={0}
                value={budget}
                onChange={(e) => setBudget(parseFloat(e.target.value) || 0)}
                className="input-field pl-10 w-full"
                placeholder="0"
              />
            </div>
            {/* Quick presets */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setBudget(p)}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${
                    budget === p
                      ? 'bg-rl-purple text-white border-rl-purple'
                      : 'bg-rl-surface text-rl-muted border-rl-border hover:border-rl-purple/40 hover:text-rl-text'
                  }`}
                >
                  R${p.toLocaleString('pt-BR')}
                </button>
              ))}
            </div>
          </div>

          {/* Audience selector */}
          <div>
            <label className="label-field">Tipo de público disponível (Fase 01)</label>
            <div className="space-y-2">
              {AUDIENCE_TYPES.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAudience(a.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all flex items-start gap-3 ${
                    audienceType === a.id
                      ? 'bg-rl-purple/10 border-rl-purple/30'
                      : 'bg-rl-surface border-rl-border hover:border-rl-muted/40'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                    audienceType === a.id ? 'border-rl-purple' : 'border-rl-border'
                  }`}>
                    {audienceType === a.id && <div className="w-2 h-2 rounded-full bg-rl-purple" />}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-rl-text">{a.label}</p>
                    <p className="text-[10px] text-rl-muted mt-0.5">{a.hint}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {!lab && budget > 0 && (
        <div className="glass-card p-8 text-center">
          <AlertCircle className="w-8 h-8 text-rl-gold/60 mx-auto mb-2" />
          <p className="text-rl-muted text-sm">Orçamento insuficiente para o laboratório</p>
          <p className="text-rl-muted/60 text-xs mt-1">Mínimo recomendado: {fmtBRL(DAILY * 7)} (1 conjunto por 7 dias)</p>
        </div>
      )}

      {!lab && budget === 0 && (
        <div className="glass-card p-8 text-center">
          <FlaskConical className="w-8 h-8 text-rl-muted/30 mx-auto mb-2" />
          <p className="text-rl-muted text-sm">Informe o orçamento disponível para gerar o plano do laboratório</p>
        </div>
      )}

      {/* Plan */}
      {lab && (
        <>
          {/* Overview */}
          <div className="glass-card p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full border ${lab.labBg} ${lab.labColor} ${lab.labBorder}`}>
                    Laboratório {lab.labType}
                  </span>
                  {lab.f3 && (
                    <span className="text-[10px] font-medium text-rl-gold bg-rl-gold/10 border border-rl-gold/20 px-2 py-0.5 rounded-full">
                      ⭐ 3 fases
                    </span>
                  )}
                </div>
                <p className="text-xs text-rl-muted">
                  {lab.phases} fase{lab.phases > 1 ? 's' : ''} · {lab.duration} dias · {lab.f1.conjuntos} conjuntos na Fase 01
                </p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-[10px] text-rl-muted">Investimento total</p>
                  <p className={`text-xl font-bold ${lab.labColor}`}>{fmtBRL(lab.total)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-rl-muted">Duração</p>
                  <p className="text-xl font-bold text-rl-text">{lab.duration} dias</p>
                </div>
              </div>
            </div>

            {/* Timeline bar */}
            <div className="mt-4 flex gap-1">
              {[
                { label: 'Fase 01', show: !!lab.f1, color: 'bg-rl-purple' },
                { label: 'Fase 02', show: !!lab.f2, color: 'bg-rl-blue' },
                { label: 'Fase 03', show: !!lab.f3, color: 'bg-rl-gold' },
              ].map((item) => item.show && (
                <div key={item.label} className={`flex-1 h-1.5 rounded-full ${item.color}`} />
              ))}
              {!lab.f2 && <div className="flex-2 h-1.5 rounded-full bg-rl-surface" style={{flex: 2}} />}
              {!lab.f3 && (lab.f2 ? <div className="flex-1 h-1.5 rounded-full bg-rl-surface" /> : null)}
            </div>
            <div className="flex gap-1 mt-1">
              {[lab.f1, lab.f2, lab.f3].map((f, i) => f && (
                <div key={i} className="flex-1 flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${['bg-rl-purple','bg-rl-blue','bg-rl-gold'][i]}`} />
                  <span className="text-[10px] text-rl-muted">Fase 0{i+1} — {fmtBRL(f.totalCost)}</span>
                </div>
              ))}
            </div>

            {/* Alert if budget doesn't cover full lab */}
            {(!lab.f2 || !lab.f3) && (
              <div className="mt-3 flex items-start gap-2 bg-rl-gold/5 border border-rl-gold/20 rounded-xl px-3 py-2.5">
                <AlertCircle className="w-3.5 h-3.5 text-rl-gold shrink-0 mt-0.5" />
                <p className="text-xs text-rl-gold">
                  {!lab.f2
                    ? `Com mais R${(1925 - budget).toLocaleString('pt-BR')} você inclui a Fase 02 (teste de públicos). Orçamento mínimo: ${fmtBRL(1925)}.`
                    : `Com mais R${(2520 - budget).toLocaleString('pt-BR')} você inclui a Fase 03 (teste de ganchos). Orçamento mínimo: ${fmtBRL(2520)}.`
                  }
                </p>
              </div>
            )}
          </div>

          {/* Phase cards */}
          <div className="space-y-3">
            {PHASE_DEF.map((def, i) => {
              const plan = [lab.f1, lab.f2, lab.f3][i]
              if (!plan) return null
              return (
                <PhaseCard
                  key={def.key}
                  def={def}
                  plan={plan}
                  audienceType={audienceType}
                  isFirst={i === 0}
                />
              )
            })}
          </div>

          {/* Investment table */}
          <div className="glass-card p-5">
            <p className="text-sm font-semibold text-rl-text mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-rl-green" />
              Resumo do Investimento
            </p>
            <div className="space-y-2">
              {[
                { label: 'Fase 01 — Criativos', plan: lab.f1, color: 'text-rl-purple' },
                { label: 'Fase 02 — Públicos',  plan: lab.f2, color: 'text-rl-blue' },
                { label: 'Fase 03 — Ganchos',   plan: lab.f3, color: 'text-rl-gold' },
              ].map(({ label, plan, color }) => (
                <div key={label} className={`flex items-center justify-between rounded-lg px-3 py-2 ${plan ? 'bg-rl-surface' : 'bg-rl-surface/40 opacity-40'}`}>
                  <div className="flex items-center gap-2">
                    {plan
                      ? <CheckCircle2 className={`w-3.5 h-3.5 ${color}`} />
                      : <AlertCircle className="w-3.5 h-3.5 text-rl-muted" />
                    }
                    <span className="text-xs text-rl-subtle">{label}</span>
                    {plan && !plan.isStandard && (
                      <span className="text-[10px] text-rl-gold border border-rl-gold/30 px-1.5 rounded-full">adaptado</span>
                    )}
                  </div>
                  <span className={`text-sm font-bold ${plan ? color : 'text-rl-muted'}`}>
                    {plan ? fmtBRL(plan.totalCost) : 'não incluída'}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-xl bg-rl-surface border border-rl-border px-3 py-3 mt-1">
                <span className="text-sm font-semibold text-rl-text">Total do Laboratório</span>
                <span className={`text-lg font-bold ${lab.labColor}`}>{fmtBRL(lab.total)}</span>
              </div>
              {lab.total < budget && (
                <div className="flex items-center justify-between rounded-lg bg-rl-green/5 border border-rl-green/20 px-3 py-2">
                  <span className="text-xs text-rl-green">Saldo restante (após o lab)</span>
                  <span className="text-sm font-bold text-rl-green">{fmtBRL(budget - lab.total)}</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
