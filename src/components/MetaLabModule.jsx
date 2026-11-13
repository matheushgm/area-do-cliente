import { fmtCurrency } from '../lib/utils'
import { useState, useMemo } from 'react'
import {
  FlaskConical, DollarSign, Calendar, ChevronDown, ChevronUp,
  CheckCircle2, AlertCircle, Video, Users, Zap, Target,
  Play, TrendingUp, Info, FileDown, Loader2, Save,
} from 'lucide-react'
import { generateMetaLabPDF } from '../lib/metaLabPDF'
import { useApp } from '../context/AppContext'
import { useI18n } from '../i18n'

// ─── Constants ────────────────────────────────────────────────────────────────

const DAILY   = 35
const C_TOTAL = 11   // criativos a testar na Fase 01
const P_TOTAL = 5    // públicos  a testar na Fase 02
const G_TOTAL = 5    // ganchos   a testar na Fase 03

// Rótulos e textos em locales/{pt,en}/metaLab.js (publicos.<id>, fases.<key>). Os ids
// de público são gravados em projects_v2.meta_lab_audience_type e não mudam.
const AUDIENCE_TYPES = [
  { id: 'remarketing' },
  { id: 'lookalike' },
  { id: 'interesses' },
]

const PHASE_DEF = [
  { key: 'f1', num: '01', icon: Video, color: 'rl-purple', totalItems: C_TOTAL, keepMax: 3 },
  { key: 'f2', num: '02', icon: Users, color: 'rl-blue',   totalItems: P_TOTAL, keepMax: 3, tipos: ['t1', 't2', 't3', 't4', 't5'] },
  { key: 'f3', num: '03', icon: Zap,   color: 'rl-gold',   totalItems: G_TOTAL, keepMax: 2, tipos: ['t1', 't2', 't3', 't4', 't5'], bigBudget: true },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

  let labTipo, labColor, labBorder, labBg
  if      (f3 && f1.isStandard && f2.isStandard && f3.isStandard) {
    labTipo = 'completo';  labColor = 'text-rl-green';  labBg = 'bg-rl-green/10';  labBorder = 'border-rl-green/20'
  } else if (f2 && f1.isStandard && f2.isStandard) {
    labTipo = 'padrao';    labColor = 'text-rl-blue';   labBg = 'bg-rl-blue/10';   labBorder = 'border-rl-blue/20'
  } else if (f2) {
    labTipo = 'intermediario'; labColor = 'text-rl-purple'; labBg = 'bg-rl-purple/10'; labBorder = 'border-rl-purple/20'
  } else if (f1.conjuntos >= 5) {
    labTipo = 'reduzido';  labColor = 'text-rl-gold';   labBg = 'bg-rl-gold/10';   labBorder = 'border-rl-gold/20'
  } else {
    labTipo = 'minimo';    labColor = 'text-red-400';   labBg = 'bg-red-400/10';   labBorder = 'border-red-400/20'
  }

  return { f1, f2, f3, total, duration, phases, labTipo, labColor, labBg, labBorder }
}

// ─── Phase Card ───────────────────────────────────────────────────────────────

function PhaseCard({ def, plan, audienceType, isFirst }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(isFirst)
  const tf = (k) => t(`metaLab.fases.${def.key}.${k}`)
  const nome = tf('nome')
  const Icon = def.icon
  const colorMap = {
    'rl-purple': { text: 'text-rl-purple', bg: 'bg-rl-purple/10', border: 'border-rl-purple/20', badge: 'bg-rl-purple text-white' },
    'rl-blue':   { text: 'text-rl-blue',   bg: 'bg-rl-blue/10',   border: 'border-rl-blue/20',   badge: 'bg-rl-blue text-white' },
    'rl-gold':   { text: 'text-rl-gold',   bg: 'bg-rl-gold/10',   border: 'border-rl-gold/20',   badge: 'bg-rl-gold text-rl-bg' },
  }
  const c = colorMap[def.color]

  const audienceLabel = AUDIENCE_TYPES.some((a) => a.id === audienceType)
    ? t(`metaLab.publicos.${audienceType}.descricao`)
    : t('metaLab.publicoADefinir')

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
              <span className={`text-[10px] font-bold ${c.text} uppercase tracking-wider`}>{t('metaLab.card.fase', { num: def.num })}</span>
              {!plan.isStandard && (
                <span className="text-[10px] font-medium text-rl-gold bg-rl-gold/10 border border-rl-gold/20 px-1.5 py-0.5 rounded-full">{t('metaLab.card.adaptado')}</span>
              )}
            </div>
            <p className="text-sm font-semibold text-rl-text">{nome}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-rl-muted">{tf('dias')}</p>
            <p className="text-sm font-bold text-rl-text">{fmtCurrency(plan.totalCost)}</p>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-rl-muted" /> : <ChevronDown className="w-4 h-4 text-rl-muted" />}
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="p-5 space-y-5">
          <p className="text-xs text-rl-muted leading-relaxed">{tf('descricao')}</p>

          {/* Structure */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Dia 1 */}
            <div className="rounded-xl bg-rl-surface border border-rl-border p-4 space-y-2">
              <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wider flex items-center gap-1.5">
                <Play className="w-3 h-3" /> {t('metaLab.card.dia1')}
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-rl-subtle">{t('metaLab.card.conjuntos')}</span>
                  <span className={`text-sm font-bold ${c.text}`}>{plan.conjuntos}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-rl-subtle">{t('metaLab.card.porConjunto', { itens: tf('itens') })}</span>
                  <span className="text-sm font-semibold text-rl-text">{plan.itemsPerConjunto}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-rl-subtle">{t('metaLab.card.verbaConjunto')}</span>
                  <span className="text-sm font-semibold text-rl-text">{t('metaLab.card.porDia', { valor: fmtCurrency(DAILY) })}</span>
                </div>
                <div className="flex items-center justify-between border-t border-rl-border/60 pt-1.5 mt-1.5">
                  <span className="text-xs font-medium text-rl-text">{t('metaLab.card.gastoDia1')}</span>
                  <span className={`text-sm font-bold ${c.text}`}>{fmtCurrency(plan.dia1Cost)}</span>
                </div>
              </div>
            </div>

            {/* Dias 2–7 */}
            <div className="rounded-xl bg-rl-surface border border-rl-border p-4 space-y-2">
              <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3" /> {t('metaLab.card.dias2a7')}
              </p>
              <div className="space-y-1.5">
                <p className="text-[10px] text-rl-muted mb-2">{t('metaLab.card.pauseOsPiores')}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-rl-subtle">{t('metaLab.card.conjuntosMantidos')}</span>
                  <span className={`text-sm font-bold ${c.text}`}>{t('metaLab.card.nMelhores', { count: plan.keepAfterDay1 })}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-rl-subtle">{t('metaLab.card.gastoDiario')}</span>
                  <span className="text-sm font-semibold text-rl-text">{t('metaLab.card.porDia', { valor: fmtCurrency(plan.keepAfterDay1 * DAILY) })}</span>
                </div>
                <div className="flex items-center justify-between border-t border-rl-border/60 pt-1.5 mt-1.5">
                  <span className="text-xs font-medium text-rl-text">{t('metaLab.card.totalDias2a7')}</span>
                  <span className={`text-sm font-bold ${c.text}`}>{fmtCurrency(plan.dias2a7Cost)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Critérios de seleção */}
          <div className="rounded-xl bg-rl-surface border border-rl-border p-4">
            <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Target className="w-3 h-3" /> {t('metaLab.card.criterio')}
            </p>
            <ul className="space-y-1">
              {['c1', 'c2'].map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-rl-subtle">
                  <span className={`mt-0.5 text-[9px] font-bold ${c.text} bg-rl-surface border ${c.border} px-1.5 py-0.5 rounded-full shrink-0`}>
                    {i === 0 ? t('metaLab.card.ordinal1') : t('metaLab.card.ordinal2')}
                  </span>
                  {tf(`criterios.${s}`)}
                </li>
              ))}
            </ul>
          </div>

          {/* Configuração da campanha */}
          <div className={`rounded-xl border ${c.border} ${c.bg} p-4 space-y-3`}>
            <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{color: 'var(--tw-prose-body)'}}>
              <Info className={`w-3 h-3 ${c.text}`} />
              <span className={c.text}>{t('metaLab.card.comoConfigurar')}</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <ConfigItem label={t('metaLab.card.objetivo')} value={tf('objetivo')} />
              <ConfigItem label={t('metaLab.card.orcamento')} value={t('metaLab.card.orcamentoValor')} />
              <ConfigItem label={t('metaLab.card.verbaDia')} value={fmtCurrency(DAILY, 2)} />
              <ConfigItem label={t('metaLab.card.nConjuntosDia1')} value={t('metaLab.card.nConjuntos', { count: plan.conjuntos })} />
              {def.key === 'f1' && (
                <ConfigItem label={t('metaLab.card.publicoF1')} value={audienceLabel} className="sm:col-span-2" />
              )}
              {def.key === 'f2' && (
                <>
                  <ConfigItem label={t('metaLab.card.criativoConjuntos')} value={t('metaLab.card.criativoCampeao')} className="sm:col-span-2" />
                  <div className="sm:col-span-2">
                    <p className="text-rl-muted mb-1">{t('metaLab.card.sugestaoPublicos')}</p>
                    <div className="flex flex-wrap gap-1">
                      {def.tipos.map((p) => (
                        <span key={p} className={`text-[10px] px-2 py-0.5 rounded-full border ${c.border} ${c.bg} ${c.text} font-medium`}>{tf(`tipos.${p}`)}</span>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {def.key === 'f3' && (
                <>
                  <ConfigItem label={t('metaLab.card.base')} value={t('metaLab.card.baseValor')} className="sm:col-span-2" />
                  <ConfigItem label={t('metaLab.card.publico')} value={t('metaLab.card.publicoCampeao')} className="sm:col-span-2" />
                  <div className="sm:col-span-2">
                    <p className="text-rl-muted mb-1">{t('metaLab.card.tiposGancho')}</p>
                    <div className="flex flex-wrap gap-1">
                      {def.tipos.map((g) => (
                        <span key={g} className={`text-[10px] px-2 py-0.5 rounded-full border ${c.border} ${c.bg} ${c.text} font-medium`}>{tf(`tipos.${g}`)}</span>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            {/* Naming suggestion */}
            <div className="mt-2 pt-3 border-t border-current/10">
              <p className="text-[10px] text-rl-muted mb-1.5">{t('metaLab.card.nomenclatura')}</p>
              <div className="space-y-1">
                <p className="text-[10px] font-mono bg-rl-bg/60 px-2 py-1 rounded-lg text-rl-subtle">
                  {t('metaLab.card.campanha')} <span className={c.text}>{t('metaLab.card.nomeCampanha', { num: def.num, nome })}</span>
                </p>
                <p className="text-[10px] font-mono bg-rl-bg/60 px-2 py-1 rounded-lg text-rl-subtle">
                  {t('metaLab.card.conjunto')} <span className={c.text}>{t('metaLab.card.cliente')} – F{def.num} – CA01 / CA02 …</span>
                </p>
                <p className="text-[10px] font-mono bg-rl-bg/60 px-2 py-1 rounded-lg text-rl-subtle">
                  {t('metaLab.card.anuncio')} <span className={c.text}>{t('metaLab.card.cliente')} – F{def.num} – CA01 – AD01 …</span>
                </p>
              </div>
            </div>
          </div>

          {/* Dias 2-7 note */}
          <div className="flex items-start gap-2 text-xs text-rl-muted bg-rl-surface rounded-xl p-3 border border-rl-border">
            <TrendingUp className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rl-purple" />
            <p>{tf('dias2a7')}</p>
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
  const { updateProject }           = useApp()
  const { t }                       = useI18n()
  const [budget, setBudget]         = useState(project.metaLabBudget || 0)
  const [audienceType, setAudience] = useState(project.metaLabAudienceType || 'lookalike')
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [exporting, setExporting]   = useState(false)

  const lab = useMemo(() => (budget >= DAILY * 7 ? calcLab(budget) : null), [budget])

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateProject(project.id, {
        metaLabBudget:       budget,
        metaLabAudienceType: audienceType,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  const handleExportPDF = async () => {
    if (!lab) return
    setExporting(true)
    try {
      generateMetaLabPDF({
        lab,
        audienceType,
        companyName: project.companyName || project.company_name || t('metaLab.pdf.cliente'),
        budget,
      })
    } finally {
      setExporting(false)
    }
  }

  const PRESETS = [800, 1200, 1925, 2520]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-rl-text flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-rl-purple" />
            {t('metaLab.titulo')}
          </h2>
          <p className="text-sm text-rl-muted mt-0.5">
            {t('metaLab.subtitulo')}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saved && (
            <span className="flex items-center gap-1.5 text-xs text-rl-green">
              <CheckCircle2 className="w-3.5 h-3.5" /> {t('comum.salvo')}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all
              bg-rl-surface border border-rl-border text-rl-text hover:border-rl-purple/40 hover:text-rl-purple
              disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" />{t('comum.salvando')}</>
              : <><Save className="w-4 h-4" />{t('comum.salvar')}</>
            }
          </button>
          {lab && (
            <button
              onClick={handleExportPDF}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all
                bg-rl-purple text-white shadow-glow hover:bg-rl-purple/90 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {exporting
                ? <><Loader2 className="w-4 h-4 animate-spin" />{t('metaLab.gerando')}</>
                : <><FileDown className="w-4 h-4" />{t('metaLab.exportarPdf')}</>
              }
            </button>
          )}
        </div>
      </div>

      {/* Budget + audience */}
      <div className="glass-card p-5 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Budget */}
          <div>
            <label className="label-field">{t('metaLab.orcamentoLabel')}</label>
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
                  {fmtCurrency(p)}
                </button>
              ))}
            </div>
          </div>

          {/* Audience selector */}
          <div>
            <label className="label-field">{t('metaLab.publicoLabel')}</label>
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
                    <p className="text-xs font-semibold text-rl-text">{t(`metaLab.publicos.${a.id}.label`)}</p>
                    <p className="text-[10px] text-rl-muted mt-0.5">{t(`metaLab.publicos.${a.id}.hint`)}</p>
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
          <p className="text-rl-muted text-sm">{t('metaLab.orcamentoInsuficiente')}</p>
          <p className="text-rl-muted/60 text-xs mt-1">{t('metaLab.minimoRecomendado', { valor: fmtCurrency(DAILY * 7) })}</p>
        </div>
      )}

      {!lab && budget === 0 && (
        <div className="glass-card p-8 text-center">
          <FlaskConical className="w-8 h-8 text-rl-muted/30 mx-auto mb-2" />
          <p className="text-rl-muted text-sm">{t('metaLab.informeOrcamento')}</p>
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
                    {t('metaLab.laboratorioTipo', { tipo: t(`metaLab.tipos.${lab.labTipo}`) })}
                  </span>
                  {lab.f3 && (
                    <span className="text-[10px] font-medium text-rl-gold bg-rl-gold/10 border border-rl-gold/20 px-2 py-0.5 rounded-full">
                      {t('metaLab.tresFases')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-rl-muted">
                  {t('metaLab.resumoLinha', { fases: t('metaLab.nFases', { count: lab.phases }), dias: lab.duration, conjuntos: lab.f1.conjuntos })}
                </p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-[10px] text-rl-muted">{t('metaLab.investimentoTotal')}</p>
                  <p className={`text-xl font-bold ${lab.labColor}`}>{fmtCurrency(lab.total)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-rl-muted">{t('metaLab.duracao')}</p>
                  <p className="text-xl font-bold text-rl-text">{t('metaLab.nDias', { count: lab.duration })}</p>
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
                  <span className="text-[10px] text-rl-muted">{t('metaLab.faseCusto', { num: `0${i+1}`, valor: fmtCurrency(f.totalCost) })}</span>
                </div>
              ))}
            </div>

            {/* Alert if budget doesn't cover full lab */}
            {(!lab.f2 || !lab.f3) && (
              <div className="mt-3 flex items-start gap-2 bg-rl-gold/5 border border-rl-gold/20 rounded-xl px-3 py-2.5">
                <AlertCircle className="w-3.5 h-3.5 text-rl-gold shrink-0 mt-0.5" />
                <p className="text-xs text-rl-gold">
                  {!lab.f2
                    ? t('metaLab.incluaFase2', { falta: fmtCurrency(1925 - budget), minimo: fmtCurrency(1925) })
                    : t('metaLab.incluaFase3', { falta: fmtCurrency(2520 - budget), minimo: fmtCurrency(2520) })
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
              {t('metaLab.resumoInvestimento')}
            </p>
            <div className="space-y-2">
              {[
                { label: t('metaLab.resumoFase.f1'), plan: lab.f1, color: 'text-rl-purple' },
                { label: t('metaLab.resumoFase.f2'), plan: lab.f2, color: 'text-rl-blue' },
                { label: t('metaLab.resumoFase.f3'), plan: lab.f3, color: 'text-rl-gold' },
              ].map(({ label, plan, color }) => (
                <div key={label} className={`flex items-center justify-between rounded-lg px-3 py-2 ${plan ? 'bg-rl-surface' : 'bg-rl-surface/40 opacity-40'}`}>
                  <div className="flex items-center gap-2">
                    {plan
                      ? <CheckCircle2 className={`w-3.5 h-3.5 ${color}`} />
                      : <AlertCircle className="w-3.5 h-3.5 text-rl-muted" />
                    }
                    <span className="text-xs text-rl-subtle">{label}</span>
                    {plan && !plan.isStandard && (
                      <span className="text-[10px] text-rl-gold border border-rl-gold/30 px-1.5 rounded-full">{t('metaLab.adaptadoMin')}</span>
                    )}
                  </div>
                  <span className={`text-sm font-bold ${plan ? color : 'text-rl-muted'}`}>
                    {plan ? fmtCurrency(plan.totalCost) : t('metaLab.naoIncluida')}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-xl bg-rl-surface border border-rl-border px-3 py-3 mt-1">
                <span className="text-sm font-semibold text-rl-text">{t('metaLab.totalLab')}</span>
                <span className={`text-lg font-bold ${lab.labColor}`}>{fmtCurrency(lab.total)}</span>
              </div>
              {lab.total < budget && (
                <div className="flex items-center justify-between rounded-lg bg-rl-green/5 border border-rl-green/20 px-3 py-2">
                  <span className="text-xs text-rl-green">{t('metaLab.saldoRestante')}</span>
                  <span className="text-sm font-bold text-rl-green">{fmtCurrency(budget - lab.total)}</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
