import { fmtCurrency, fmtNum } from '../lib/utils'
import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  Plus, X, Trash2, AlertTriangle, Target, TrendingUp,
  Shield, Zap, Users, BarChart3, Save, FileDown,
  ChevronRight, Link, CheckSquare, Square, Calculator,
  DollarSign, ArrowRight, Globe, Instagram, Trophy, Flag,
  Eye, EyeOff,
} from 'lucide-react'
import { exportEstrategiaV2PDF } from '../utils/exportPDF'
import { AutoSaveIndicator } from '../hooks/useAutoSave.jsx'
import { useApp } from '../context/AppContext'
import { useI18n } from '../i18n'
import { rotuloFunil } from '../lib/constants'

// ─── Constantes ────────────────────────────────────────────────────────────────
const MAX_PROBLEMAS = 10

// Valores gravados em estrategiaV2.funis (e lidos pelo PDF): ficam em português; a tela
// mostra o rótulo traduzido via rotuloFunil.
const FUNIL_OPTIONS = [
  'Funil de Webinar',
  'Funil de Aplicação',
  'Funil de Diagnóstico',
  'Funil de E-commerce (Venda Direta)',
  'Funil de Webinar Pago',
  'Funil de Isca Digital',
  'Funil de VSL',
  'Funil de Quiz',
  'Lançamento',
  'Funil de Desafio',
  'Funil de Mensagem no WhatsApp',
  'Funil Win-Your-Money-Back',
]

const NIVEL_COLORS = {
  baixo: 'text-rl-green bg-rl-green/10 border-rl-green/30',
  medio: 'text-rl-gold  bg-rl-gold/10  border-rl-gold/30',
  alto:  'text-red-400  bg-red-400/10  border-red-400/30',
}

// Rótulo e placeholder de cada quadrante: estrategia.swot.<key>.{label,placeholder}
const SWOT_CONFIG = [
  { key: 'forcas',        icon: TrendingUp,   border: 'border-rl-green/30', bg: 'bg-rl-green/5',  text: 'text-rl-green' },
  { key: 'fraquezas',     icon: AlertTriangle, border: 'border-red-400/30',  bg: 'bg-red-400/5',   text: 'text-red-400' },
  { key: 'oportunidades', icon: Target,        border: 'border-rl-blue/30',  bg: 'bg-rl-blue/5',   text: 'text-rl-blue' },
  { key: 'ameacas',       icon: Shield,        border: 'border-rl-gold/30',  bg: 'bg-rl-gold/5',   text: 'text-rl-gold' },
]

const fmtBRL = (n) => (n ? fmtCurrency(n) : '—')

/** Recalcula o resultado do ROI a partir dos inputs salvos */
function computeROI(c) {
  if (!c) return null
  const { mediaOrcamento, custoMarketing, ticketMedio, qtdCompras,
          margemBruta, roiDesejado, taxaLead2MQL, taxaMQL2SQL, taxaSQL2Venda } = c
  const totalInvestimento = (mediaOrcamento || 0) + (custoMarketing || 0)
  const lucroPorVenda     = (ticketMedio || 0) * (qtdCompras || 1) * ((margemBruta || 0) / 100)
  if (!lucroPorVenda) return null
  const retornoAlvo        = totalInvestimento * (1 + (roiDesejado || 0) / 100)
  // Sempre arredonda para cima — não existem frações de vendas/leads/pessoas
  const vendasNecessarias  = Math.ceil(retornoAlvo / lucroPorVenda)
  const sqlsNecessarios  = taxaSQL2Venda  ? Math.ceil(vendasNecessarias / (taxaSQL2Venda  / 100)) : Infinity
  const mqlsNecessarios  = taxaMQL2SQL    ? Math.ceil(sqlsNecessarios   / (taxaMQL2SQL    / 100)) : Infinity
  const leadsNecessarios = taxaLead2MQL   ? Math.ceil(mqlsNecessarios   / (taxaLead2MQL   / 100)) : Infinity
  const faturamento  = vendasNecessarias * (ticketMedio || 0) * (qtdCompras || 1)
  const lucroBruto   = faturamento * ((margemBruta || 0) / 100)
  const lucroLiquido = lucroBruto - totalInvestimento
  const cac              = vendasNecessarias ? (mediaOrcamento || 0) / vendasNecessarias : Infinity
  const vendasBreakeven  = Math.ceil(totalInvestimento / lucroPorVenda)
  // Custo por Lead/MQL/SQL usa apenas o Custo de Marketing (gestão/operação)
  const custoPorLead  = leadsNecessarios  ? (custoMarketing || 0) / leadsNecessarios  : Infinity
  const custoPorMQL   = mqlsNecessarios   ? (custoMarketing || 0) / mqlsNecessarios   : Infinity
  const custoPorSQL   = sqlsNecessarios   ? (custoMarketing || 0) / sqlsNecessarios   : Infinity
  return { totalInvestimento, lucroPorVenda, vendasNecessarias, sqlsNecessarios,
           mqlsNecessarios, leadsNecessarios, faturamento, lucroBruto, lucroLiquido,
           cac, vendasBreakeven, custoPorLead, custoPorMQL, custoPorSQL }
}

// ─── Subcomponentes ────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, subtitle, color = 'text-rl-purple' }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-rl-surface border border-rl-border`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div>
        <h3 className="font-semibold text-rl-text text-sm">{title}</h3>
        {subtitle && <p className="text-xs text-rl-muted mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function EstrategiaV2Module({ project, onSave }) {
  const { updateProject } = useApp()
  const { t } = useI18n()
  const saved = project.estrategiaV2 || {}

  const [mesesPlano,     setMesesPlano]     = useState(() => {
    const s = saved.mesesPlano
    if (Array.isArray(s) && s.length === 3) return s
    return [{ vitorias: '', metas: '' }, { vitorias: '', metas: '' }, { vitorias: '', metas: '' }]
  })
  const [problemas,      setProblemas]      = useState(() => saved.problemas    || [])
  const [swot,           setSwot]           = useState(() => saved.swot         || { forcas: '', fraquezas: '', oportunidades: '', ameacas: '', oculto: false })
  const [concorrentes,   setConcorrentes]   = useState(() => saved.concorrentes || [])
  const [riscos,         setRiscos]         = useState(() => saved.riscos       || [])
  const [funis,          setFunis]          = useState(() => saved.funis        || [])
  const [activeTab,      setActiveTab]      = useState(0)
  const [problemaInput,  setProblemaInput]  = useState('')

  const swotOculto = !!swot.oculto

  const isMounted = useRef(false)

  const personas     = project.personas     || []
  const campaignPlan = project.campaignPlan || null
  const roiCalc      = project.roiCalc      || null
  // Sempre recalcula a partir do roiCalc (valores atuais) — roiResult salvo pode estar desatualizado
  const roiResult    = useMemo(
    () => computeROI(roiCalc) || project.roiResult,
    [project.roiResult, roiCalc]
  )

  // ── Meses do Plano ─────────────────────────────────────────────────────────
  const updateMes = useCallback((idx, field, value) => {
    setMesesPlano(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m))
  }, [])

  // ── Problemas ──────────────────────────────────────────────────────────────
  const addProblema = useCallback(() => {
    const trimmed = problemaInput.trim()
    if (!trimmed || problemas.length >= MAX_PROBLEMAS) return
    setProblemas(prev => [...prev, trimmed])
    setProblemaInput('')
  }, [problemaInput, problemas.length])

  const removeProblema = useCallback((idx) => {
    setProblemas(prev => prev.filter((_, i) => i !== idx))
  }, [])

  // ── Concorrentes ──────────────────────────────────────────────────────────
  const addConcorrente = useCallback(() => {
    const novo = { id: crypto.randomUUID(), nome: '', linkSite: '', linkInstagram: '', metaAds: false, googleAds: false, linkBiblioteca: '', grandePromessa: '', comunicacao: '' }
    setConcorrentes(prev => { setActiveTab(prev.length); return [...prev, novo] })
  }, [])

  const updateConcorrente = useCallback((id, patch) => {
    setConcorrentes(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }, [])

  const removeConcorrente = useCallback((id) => {
    setConcorrentes(prev => {
      const next = prev.filter(c => c.id !== id)
      setActiveTab(tab => Math.min(tab, Math.max(0, next.length - 1)))
      return next
    })
  }, [])

  // ── Riscos ──────────────────────────────────────────────────────────────
  const addRisco = useCallback(() => {
    setRiscos(prev => [...prev, { id: crypto.randomUUID(), problema: '', riscoGerado: '', impacto: '', nivel: 'medio' }])
  }, [])

  const updateRisco = useCallback((id, patch) => {
    setRiscos(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  }, [])

  const removeRisco = useCallback((id) => {
    setRiscos(prev => prev.filter(r => r.id !== id))
  }, [])

  // ── Funis ──────────────────────────────────────────────────────────────
  const toggleFunil = useCallback((funil) => {
    setFunis(prev => prev.includes(funil) ? prev.filter(f => f !== funil) : [...prev, funil])
  }, [])

  // Auto-save: chama updateProject diretamente ao alterar qualquer campo
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return }
    updateProject(project.id, {
      estrategiaV2: { mesesPlano, problemas, swot, concorrentes, riscos, funis, updatedAt: new Date().toISOString() }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesesPlano, problemas, swot, concorrentes, riscos, funis])

  // ── Save / Export ──────────────────────────────────────────────────────
  function handleSave() {
    onSave({ mesesPlano, problemas, swot, concorrentes, riscos, funis, updatedAt: new Date().toISOString() })
  }

  function handleExport() {
    exportEstrategiaV2PDF(project, { mesesPlano, problemas, swot, concorrentes, riscos, funis, roiResult, roiCalc })
  }

  // ── Budget helpers ─────────────────────────────────────────────────────
  const totalBudget = campaignPlan?.orcamentoTotal || campaignPlan?.totalBudget || 0


  return (
    <div className="space-y-8 pb-6">

      {/* ═══ SEÇÃO 0: VITÓRIAS & METAS POR MÊS ════════════════════════════ */}
      <div className="glass-card p-5">
        <SectionHeader
          icon={Trophy}
          title={t('estrategia.meses.titulo')}
          subtitle={t('estrategia.meses.subtitulo')}
          color="text-rl-gold"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {mesesPlano.map((mes, idx) => (
            <div key={idx} className="flex flex-col gap-3 p-4 rounded-xl border border-rl-border bg-rl-surface/50">
              {/* Mês badge */}
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-rl-gold/15 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-rl-gold">{idx + 1}</span>
                </div>
                <span className="text-sm font-semibold text-rl-text">{t('estrategia.meses.mes', { n: idx + 1 })}</span>
              </div>

              {/* Vitórias */}
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-rl-green mb-1.5">
                  <Trophy className="w-3 h-3" />
                  {t('estrategia.meses.vitorias')}
                </label>
                <textarea
                  value={mes.vitorias}
                  onChange={e => updateMes(idx, 'vitorias', e.target.value)}
                  placeholder={t('estrategia.meses.vitoriasPh')}
                  rows={4}
                  className="w-full rounded-lg border border-rl-green/30 bg-rl-green/5 px-3 py-2 text-xs text-rl-text placeholder:text-rl-muted/60 resize-none focus:outline-none focus:border-rl-green/60 focus:ring-1 focus:ring-rl-green/20 transition-colors"
                />
              </div>

              {/* Metas */}
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-rl-purple mb-1.5">
                  <Flag className="w-3 h-3" />
                  {t('estrategia.meses.metas')}
                </label>
                <textarea
                  value={mes.metas}
                  onChange={e => updateMes(idx, 'metas', e.target.value)}
                  placeholder={t('estrategia.meses.metasPh')}
                  rows={4}
                  className="w-full rounded-lg border border-rl-purple/30 bg-rl-purple/5 px-3 py-2 text-xs text-rl-text placeholder:text-rl-muted/60 resize-none focus:outline-none focus:border-rl-purple/60 focus:ring-1 focus:ring-rl-purple/20 transition-colors"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ SEÇÃO 1: PROBLEMAS ════════════════════════════════════════════ */}
      <div className="glass-card p-5">
        <SectionHeader
          icon={AlertTriangle}
          title={t('estrategia.problemas.titulo')}
          subtitle={t('estrategia.problemas.subtitulo', { n: problemas.length, max: MAX_PROBLEMAS })}
          color="text-rl-gold"
        />

        {/* Input */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={problemaInput}
            onChange={e => setProblemaInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addProblema()}
            placeholder={t('estrategia.problemas.ph')}
            disabled={problemas.length >= MAX_PROBLEMAS}
            className="input-field flex-1 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          />
          <button
            onClick={addProblema}
            disabled={!problemaInput.trim() || problemas.length >= MAX_PROBLEMAS}
            className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            {t('comum.adicionar')}
          </button>
        </div>

        {/* Chips */}
        {problemas.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {problemas.map((p, i) => (
              <div key={i} className="flex items-center gap-2 bg-rl-gold/10 border border-rl-gold/25 text-rl-gold rounded-lg px-3 py-1.5 text-sm">
                <span className="text-rl-gold/60 text-xs font-bold">{i + 1}.</span>
                <span>{p}</span>
                <button onClick={() => removeProblema(i)} className="text-rl-gold/50 hover:text-rl-gold ml-1 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-rl-muted italic">{t('estrategia.problemas.vazio')}</p>
        )}
      </div>

      {/* ═══ SEÇÃO 2: SWOT ════════════════════════════════════════════════ */}
      <div className={`glass-card p-5 transition-opacity ${swotOculto ? 'opacity-60' : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <SectionHeader
            icon={BarChart3}
            title={t('estrategia.swot.titulo')}
            subtitle={swotOculto
              ? t('estrategia.swot.subtituloOculta')
              : t('estrategia.swot.subtitulo')}
            color="text-rl-blue"
          />
          <button
            onClick={() => setSwot(prev => ({ ...prev, oculto: !prev.oculto }))}
            title={swotOculto ? t('estrategia.swot.exibirDica') : t('estrategia.swot.ocultarDica')}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              swotOculto
                ? 'border-rl-border text-rl-muted hover:text-rl-text hover:border-rl-blue/40'
                : 'border-rl-blue/30 bg-rl-blue/10 text-rl-blue hover:bg-rl-blue/15'
            }`}
          >
            {swotOculto ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {swotOculto ? t('estrategia.swot.oculta') : t('estrategia.swot.incluirPdf')}
          </button>
        </div>

        {swotOculto ? (
          <p className="text-sm text-rl-muted italic">
            {t('estrategia.swot.desativada')}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SWOT_CONFIG.map(({ key, icon: Icon, border, bg, text }) => (
              <div key={key} className={`rounded-xl border ${border} ${bg} p-4`}>
                <div className={`flex items-center gap-2 mb-2 ${text}`}>
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-semibold">{t(`estrategia.swot.${key}.label`)}</span>
                </div>
                <textarea
                  value={swot[key]}
                  onChange={e => setSwot(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={t(`estrategia.swot.${key}.placeholder`)}
                  rows={5}
                  className="w-full bg-transparent text-sm text-rl-text placeholder-rl-muted/50 resize-none outline-none leading-relaxed"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ SEÇÃO 3: BENCHMARK ═══════════════════════════════════════════ */}
      <div className="glass-card p-5">
        <SectionHeader
          icon={Target}
          title={t('estrategia.benchmark.titulo')}
          subtitle={t('estrategia.benchmark.subtitulo')}
          color="text-rl-purple"
        />

        {/* Abas de concorrentes */}
        {concorrentes.length > 0 && (
          <div className="flex items-center gap-1 mb-4 flex-wrap">
            {concorrentes.map((c, i) => (
              <button
                key={c.id}
                onClick={() => setActiveTab(i)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                  activeTab === i
                    ? 'bg-rl-purple/15 text-rl-purple border-rl-purple/30'
                    : 'text-rl-muted hover:text-rl-text border-transparent hover:border-rl-border'
                }`}
              >
                {c.nome || t('estrategia.benchmark.concorrenteN', { n: i + 1 })}
              </button>
            ))}
          </div>
        )}

        {/* Formulário do concorrente ativo */}
        {concorrentes.length > 0 && concorrentes[activeTab] && (() => {
          const c = concorrentes[activeTab]
          return (
            <div className="space-y-4">
              {/* Nome */}
              <div>
                <label className="text-xs font-semibold text-rl-muted uppercase tracking-wider block mb-1.5">{t('estrategia.benchmark.nome')}</label>
                <input
                  type="text"
                  value={c.nome}
                  onChange={e => updateConcorrente(c.id, { nome: e.target.value })}
                  placeholder={t('estrategia.benchmark.nomePh')}
                  className="input-field w-full text-sm"
                />
              </div>

              {/* Links do concorrente */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-rl-muted uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                    <Globe className="w-3 h-3" /> {t('estrategia.benchmark.site')}
                  </label>
                  <input
                    type="url"
                    value={c.linkSite || ''}
                    onChange={e => updateConcorrente(c.id, { linkSite: e.target.value })}
                    placeholder="https://www.exemplo.com.br"
                    className="input-field w-full text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-rl-muted uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                    <Instagram className="w-3 h-3" /> Instagram
                  </label>
                  <input
                    type="url"
                    value={c.linkInstagram || ''}
                    onChange={e => updateConcorrente(c.id, { linkInstagram: e.target.value })}
                    placeholder="https://www.instagram.com/perfil"
                    className="input-field w-full text-sm"
                  />
                </div>
              </div>

              {/* Plataformas */}
              <div className="flex flex-wrap gap-4">
                {[
                  { field: 'metaAds',   label: t('estrategia.benchmark.fazMeta'),   color: 'text-rl-blue' },
                  { field: 'googleAds', label: t('estrategia.benchmark.fazGoogle'), color: 'text-rl-green' },
                ].map(({ field, label, color }) => (
                  <label key={field} className="flex items-center gap-2.5 cursor-pointer group">
                    <div
                      onClick={() => updateConcorrente(c.id, { [field]: !c[field] })}
                      className={`w-10 h-5 rounded-full transition-all relative shrink-0 ${c[field] ? 'bg-rl-purple' : 'bg-rl-border'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${c[field] ? 'left-5' : 'left-0.5'}`} />
                    </div>
                    <span className={`text-sm font-medium ${c[field] ? color : 'text-rl-muted'}`}>{label}</span>
                  </label>
                ))}
              </div>

              {/* Link biblioteca (só se metaAds) */}
              {c.metaAds && (
                <div>
                  <label className="text-xs font-semibold text-rl-muted uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                    <Link className="w-3 h-3" /> {t('estrategia.benchmark.biblioteca')}
                  </label>
                  <input
                    type="url"
                    value={c.linkBiblioteca}
                    onChange={e => updateConcorrente(c.id, { linkBiblioteca: e.target.value })}
                    placeholder="https://www.facebook.com/ads/library/..."
                    className="input-field w-full text-sm"
                  />
                </div>
              )}

              {/* Grande promessa */}
              <div>
                <label className="text-xs font-semibold text-rl-muted uppercase tracking-wider block mb-1.5">{t('estrategia.benchmark.promessa')}</label>
                <textarea
                  value={c.grandePromessa}
                  onChange={e => updateConcorrente(c.id, { grandePromessa: e.target.value })}
                  placeholder={t('estrategia.benchmark.promessaPh')}
                  rows={3}
                  className="input-field w-full text-sm resize-none"
                />
              </div>

              {/* Comunicação */}
              <div>
                <label className="text-xs font-semibold text-rl-muted uppercase tracking-wider block mb-1.5">{t('estrategia.benchmark.comunicacao')}</label>
                <textarea
                  value={c.comunicacao}
                  onChange={e => updateConcorrente(c.id, { comunicacao: e.target.value })}
                  placeholder={t('estrategia.benchmark.comunicacaoPh')}
                  rows={3}
                  className="input-field w-full text-sm resize-none"
                />
              </div>

              {/* Remover concorrente */}
              <button
                onClick={() => removeConcorrente(c.id)}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t('estrategia.benchmark.remover')}
              </button>
            </div>
          )
        })()}

        {/* Botão adicionar */}
        <button
          onClick={addConcorrente}
          className="mt-4 btn-secondary flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          {t('estrategia.benchmark.adicionar')}
        </button>
      </div>

      {/* ═══ SEÇÃO 4: RISCOS ══════════════════════════════════════════════ */}
      <div className="glass-card p-5">
        <SectionHeader
          icon={Shield}
          title={t('estrategia.riscos.titulo')}
          subtitle={t('estrategia.riscos.subtitulo')}
          color="text-red-400"
        />

        {riscos.length > 0 && (
          <div className="space-y-3 mb-4">
            {/* Header da tabela */}
            <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_110px_36px] gap-2 px-3">
              {[t('estrategia.riscos.problema'), t('estrategia.riscos.risco'), t('estrategia.riscos.impacto'), t('estrategia.riscos.nivel'), ''].map((h, i) => (
                <span key={i} className="text-[10px] font-bold text-rl-muted uppercase tracking-wider">{h}</span>
              ))}
            </div>

            {riscos.map((r) => (
              <div key={r.id} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_110px_36px] gap-2 items-start bg-rl-surface rounded-xl p-3 border border-rl-border">
                <input
                  value={r.problema}
                  onChange={e => updateRisco(r.id, { problema: e.target.value })}
                  placeholder={t('estrategia.riscos.problemaPh')}
                  className="input-field text-sm py-1.5"
                />
                <input
                  value={r.riscoGerado}
                  onChange={e => updateRisco(r.id, { riscoGerado: e.target.value })}
                  placeholder={t('estrategia.riscos.riscoPh')}
                  className="input-field text-sm py-1.5"
                />
                <input
                  value={r.impacto}
                  onChange={e => updateRisco(r.id, { impacto: e.target.value })}
                  placeholder={t('estrategia.riscos.impactoPh')}
                  className="input-field text-sm py-1.5"
                />
                <select
                  value={r.nivel}
                  onChange={e => updateRisco(r.id, { nivel: e.target.value })}
                  className={`input-field text-sm py-1.5 font-semibold border rounded-xl ${NIVEL_COLORS[r.nivel]}`}
                >
                  <option value="baixo">{t('estrategia.riscos.baixo')}</option>
                  <option value="medio">{t('estrategia.riscos.medio')}</option>
                  <option value="alto">{t('estrategia.riscos.alto')}</option>
                </select>
                <button
                  onClick={() => removeRisco(r.id)}
                  className="p-2 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <button onClick={addRisco} className="btn-secondary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" />
          {t('estrategia.riscos.adicionar')}
        </button>
      </div>

      {/* ═══ SEÇÃO 5: ICPs (read-only) ════════════════════════════════════ */}
      <div className="glass-card p-5">
        <SectionHeader
          icon={Users}
          title={t('estrategia.icps.titulo')}
          subtitle={t('estrategia.icps.subtitulo')}
          color="text-rl-cyan"
        />

        {personas.length === 0 ? (
          <div className="text-center py-6 text-rl-muted text-sm">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>{t('estrategia.icps.vazio')}</p>
            <p className="text-xs mt-1">{t('estrategia.icps.vazioDica')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {personas.map((p, i) => {
              const a = p.answers || {}
              const chips = (key) => (a[key] || []).filter(Boolean).slice(0, 2)
              return (
                <div key={p.id || i} className="bg-rl-surface rounded-xl border border-rl-border p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-rl-cyan/15 flex items-center justify-center text-sm font-bold text-rl-cyan">
                      {(p.name || 'P')[0].toUpperCase()}
                    </div>
                    <h4 className="font-semibold text-rl-text text-sm truncate">{p.name || t('estrategia.icps.personaN', { n: i + 1 })}</h4>
                  </div>

                  {/* Chips de atributos */}
                  <div className="space-y-2">
                    {[
                      { key: 'resultado', label: t('estrategia.icps.deseja'), color: 'bg-rl-green/10 text-rl-green' },
                      { key: 'objecoes',  label: t('estrategia.icps.objecao'), color: 'bg-red-400/10 text-red-400' },
                      { key: 'medos',     label: t('estrategia.icps.medo'),    color: 'bg-rl-gold/10 text-rl-gold' },
                      { key: 'sonhos',    label: t('estrategia.icps.sonha'),   color: 'bg-rl-purple/10 text-rl-purple' },
                    ].map(({ key, label, color }) => {
                      const items = chips(key)
                      if (!items.length) return null
                      return (
                        <div key={key} className="flex flex-wrap gap-1.5 items-center">
                          <span className="text-[10px] text-rl-muted font-semibold uppercase w-12 shrink-0">{label}</span>
                          {items.map((item, j) => (
                            <span key={j} className={`text-[11px] px-2 py-0.5 rounded-full ${color}`}>{item}</span>
                          ))}
                        </div>
                      )
                    })}
                  </div>

                  {/* Trecho do perfil gerado */}
                  {p.generatedProfile && (
                    <p className="text-xs text-rl-muted mt-3 leading-relaxed line-clamp-3">
                      {p.generatedProfile.slice(0, 200)}{p.generatedProfile.length > 200 ? '…' : ''}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ═══ SEÇÃO 6: FUNIS ═══════════════════════════════════════════════ */}
      <div className="glass-card p-5">
        <SectionHeader
          icon={Zap}
          title={t('estrategia.funis.titulo')}
          subtitle={t('estrategia.funis.subtitulo')}
          color="text-rl-purple"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {FUNIL_OPTIONS.map((funil) => {
            const selected = funis.includes(funil)
            return (
              <button
                key={funil}
                onClick={() => toggleFunil(funil)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left ${
                  selected
                    ? 'bg-rl-purple/15 border-rl-purple/35 text-rl-purple'
                    : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-text hover:border-rl-border/80'
                }`}
              >
                {selected
                  ? <CheckSquare className="w-4 h-4 shrink-0 text-rl-purple" />
                  : <Square      className="w-4 h-4 shrink-0 opacity-40" />
                }
                {rotuloFunil(funil)}
              </button>
            )
          })}
        </div>

        {funis.length > 0 && (
          <p className="text-xs text-rl-purple mt-3">
            {t('estrategia.funis.selecionados', { count: funis.length })}
          </p>
        )}
      </div>

      {/* ═══ SEÇÃO 7: METAS DO FUNIL (ROI — read-only) ═══════════════════ */}
      <div className="glass-card p-5">
        <SectionHeader
          icon={Calculator}
          title={t('estrategia.metas.titulo')}
          subtitle={t('estrategia.metas.subtitulo')}
          color="text-rl-purple"
        />

        {!roiResult ? (
          <div className="text-center py-6 text-rl-muted text-sm">
            <Calculator className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>{t('estrategia.metas.vazio')}</p>
            <p className="text-xs mt-1">{t('estrategia.metas.vazioDica')}</p>
          </div>
        ) : (
          <div className="space-y-5">

            {/* ROI alvo + investimento */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: t('estrategia.metas.roiDesejado'), value: roiCalc?.roiDesejado != null ? `${roiCalc.roiDesejado}%` : '—', color: 'text-rl-purple', bg: 'bg-rl-purple/10 border-rl-purple/20' },
                { label: t('estrategia.metas.totalInvestido'), value: fmtBRL(roiResult.totalInvestimento),   color: 'text-rl-text',   bg: 'bg-rl-surface border-rl-border' },
                { label: t('estrategia.metas.faturamentoAlvo'), value: fmtBRL(roiResult.faturamento),          color: 'text-rl-blue',   bg: 'bg-rl-blue/10 border-rl-blue/20' },
                { label: t('estrategia.metas.lucroLiquido'), value: fmtBRL(roiResult.lucroLiquido),
                  color: roiResult.lucroLiquido >= 0 ? 'text-rl-green' : 'text-red-400',
                  bg:    roiResult.lucroLiquido >= 0 ? 'bg-rl-green/10 border-rl-green/20' : 'bg-red-400/10 border-red-400/20' },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className={`rounded-xl border px-4 py-3 ${bg}`}>
                  <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wider mb-1">{label}</p>
                  <p className={`text-base font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Funil step-by-step */}
            <div>
              <p className="text-xs font-bold text-rl-muted uppercase tracking-wider mb-3">
                {t('estrategia.metas.porEtapa')}
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1">
                {[
                  { label: 'Leads',  value: roiResult.leadsNecessarios,  cost: roiResult.custoPorLead, costLabel: t('estrategia.metas.cplMidia'),  color: 'text-rl-purple', bg: 'bg-rl-purple/10 border-rl-purple/25', rate: null },
                  { label: 'MQLs',   value: roiResult.mqlsNecessarios,   cost: roiResult.custoPorMQL,  costLabel: 'C. MQL',      color: 'text-rl-blue',   bg: 'bg-rl-blue/10 border-rl-blue/25',     rate: roiCalc?.taxaLead2MQL },
                  { label: 'SQLs',   value: roiResult.sqlsNecessarios,   cost: roiResult.custoPorSQL,  costLabel: 'C. SQL',      color: 'text-rl-cyan',   bg: 'bg-rl-cyan/10 border-rl-cyan/25',     rate: roiCalc?.taxaMQL2SQL },
                  { label: t('estrategia.metas.vendas'), value: roiResult.vendasNecessarias, cost: roiResult.cac,          costLabel: t('estrategia.metas.cacMidia'), color: 'text-rl-green',  bg: 'bg-rl-green/10 border-rl-green/25',   rate: roiCalc?.taxaSQL2Venda },
                ].map((step, i, arr) => (
                  <div key={i} className="flex sm:flex-col items-center gap-1 flex-1">
                    <div className={`w-full rounded-xl border px-3 py-3 ${step.bg} flex sm:flex-col gap-3 sm:gap-1 items-center sm:items-start`}>
                      <div className="sm:w-full">
                        <p className={`text-xl font-black ${step.color}`}>{fmtNum(step.value)}</p>
                        <p className="text-xs font-bold text-rl-muted">{step.label}</p>
                      </div>
                      <div className="ml-auto sm:ml-0 sm:mt-2 text-right sm:text-left">
                        <p className="text-xs font-semibold text-rl-text">{fmtBRL(step.cost)}</p>
                        <p className="text-[10px] text-rl-muted">{step.costLabel}</p>
                        {step.rate != null && (
                          <span className="text-[10px] text-rl-muted bg-rl-surface/80 px-1.5 py-0.5 rounded-md inline-block mt-0.5">
                            {t('estrategia.metas.conv', { taxa: step.rate })}
                          </span>
                        )}
                      </div>
                    </div>
                    {i < arr.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-rl-border shrink-0 sm:rotate-90 hidden sm:block" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Linha financeira + breakeven */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1 border-t border-rl-border">
              {[
                { label: t('estrategia.metas.lucroBruto'),  value: fmtBRL(roiResult.lucroBruto),    color: 'text-rl-cyan' },
                { label: t('estrategia.metas.cacMidia'),    value: fmtBRL(roiResult.cac),           color: 'text-rl-gold' },
                { label: t('estrategia.metas.breakeven'),   value: fmtNum(roiResult.vendasBreakeven), color: 'text-rl-text' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-rl-surface rounded-xl px-4 py-3 border border-rl-border">
                  <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wider mb-1">{label}</p>
                  <p className={`text-base font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Ticket + margem resumo */}
            {roiCalc && (
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  { label: t('estrategia.metas.ticketMedio'), value: fmtBRL(roiCalc.ticketMedio) },
                  { label: t('estrategia.metas.margemBruta'), value: `${roiCalc.margemBruta}%` },
                  { label: t('estrategia.metas.lucroVenda'),  value: fmtBRL(roiResult.lucroPorVenda) },
                  { label: t('estrategia.metas.orcamentoMidia'), value: fmtBRL(roiCalc.mediaOrcamento) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center gap-2 bg-rl-surface border border-rl-border rounded-lg px-3 py-1.5">
                    <span className="text-[10px] font-bold text-rl-muted uppercase tracking-wider">{label}</span>
                    <span className="text-xs font-semibold text-rl-text">{value}</span>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}
      </div>

      {/* ═══ SEÇÃO 9: CAMPANHAS (read-only) ═══════════════════════════════ */}
      <div className="glass-card p-5">
        <SectionHeader
          icon={BarChart3}
          title={t('estrategia.campanhas.titulo')}
          subtitle={t('estrategia.campanhas.subtitulo')}
          color="text-rl-green"
        />

        {!campaignPlan || !campaignPlan.channels?.length ? (
          <div className="text-center py-6 text-rl-muted text-sm">
            <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>{t('estrategia.campanhas.vazio')}</p>
            <p className="text-xs mt-1">{t('estrategia.campanhas.vazioDica')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Orçamento total */}
            <div className="flex items-center gap-3 bg-rl-green/5 border border-rl-green/20 rounded-xl px-4 py-3">
              <span className="text-xs font-bold text-rl-muted uppercase tracking-wider">{t('estrategia.campanhas.orcamentoTotal')}</span>
              <span className="text-lg font-bold text-rl-green">{fmtBRL(totalBudget)}<span className="text-xs font-normal text-rl-muted">{t('estrategia.campanhas.porMes')}</span></span>
            </div>

            {/* Canais */}
            <div className="space-y-2">
              {campaignPlan.channels.map((ch) => {
                const chBudget = totalBudget * (ch.percentage / 100)
                const stages   = ch.stages || {}
                return (
                  <div key={ch.id || ch.name} className="bg-rl-surface border border-rl-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <ChevronRight className="w-4 h-4 text-rl-green" />
                        <span className="font-semibold text-rl-text text-sm">{ch.name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-rl-muted">{ch.percentage}%</span>
                        <span className="font-semibold text-rl-text">{fmtBRL(chBudget)}{t('estrategia.campanhas.porMes')}</span>
                      </div>
                    </div>

                    {/* Etapas e campanhas */}
                    {['topo', 'meio', 'fundo'].map(key => {
                      const stage = stages[key]
                      if (!stage || !stage.campaigns?.length) return null
                      const stageBudget = chBudget * (stage.percentage / 100)
                      return (
                        <div key={key} className="ml-6 mt-2">
                          <span className="text-[11px] font-bold text-rl-muted uppercase tracking-wider">
                            {t(`estrategia.campanhas.${key}`)} — {fmtBRL(stageBudget)}{t('estrategia.campanhas.porMes')}
                          </span>
                          {stage.campaigns.map(camp => (
                            <div key={camp.id} className="flex justify-between items-center py-0.5 ml-2">
                              <span className="text-xs text-rl-muted">{camp.name || '—'}</span>
                              <span className="text-xs text-rl-text">{fmtBRL(stageBudget * (camp.percentage / 100))}{t('estrategia.campanhas.porMes')}</span>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ═══ AÇÕES ═══════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-rl-border">
        <button
          onClick={handleExport}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <FileDown className="w-4 h-4" />
          {t('estrategia.exportarPdf')}
        </button>
        <div className="flex items-center gap-3">
          <AutoSaveIndicator />
          <button
            onClick={handleSave}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Save className="w-4 h-4" />
            {t('estrategia.salvar')}
          </button>
        </div>
      </div>
    </div>
  )
}
