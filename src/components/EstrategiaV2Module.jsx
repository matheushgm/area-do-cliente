import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  Plus, X, Trash2, AlertTriangle, Target, TrendingUp,
  Shield, Zap, Users, BarChart3, Save, FileDown,
  ChevronRight, Link, CheckSquare, Square, Calculator,
  DollarSign, ArrowRight,
} from 'lucide-react'
import { exportEstrategiaV2PDF } from '../utils/exportPDF'
import { AutoSaveIndicator } from '../hooks/useAutoSave.jsx'
import { useApp } from '../context/AppContext'

// ─── Constantes ────────────────────────────────────────────────────────────────
const MAX_PROBLEMAS = 10

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
  'Funil Win-Your-Money-Back',
]

const NIVEL_COLORS = {
  baixo: 'text-rl-green bg-rl-green/10 border-rl-green/30',
  medio: 'text-rl-gold  bg-rl-gold/10  border-rl-gold/30',
  alto:  'text-red-400  bg-red-400/10  border-red-400/30',
}

const SWOT_CONFIG = [
  { key: 'forcas',        label: 'Forças',        icon: TrendingUp,   border: 'border-rl-green/30', bg: 'bg-rl-green/5',  text: 'text-rl-green',  placeholder: 'Ex: Produto diferenciado, equipe experiente, base de clientes fiel...' },
  { key: 'fraquezas',     label: 'Fraquezas',     icon: AlertTriangle, border: 'border-red-400/30',  bg: 'bg-red-400/5',   text: 'text-red-400',   placeholder: 'Ex: Baixo orçamento, pouca presença digital, processo de vendas lento...' },
  { key: 'oportunidades', label: 'Oportunidades', icon: Target,        border: 'border-rl-blue/30',  bg: 'bg-rl-blue/5',   text: 'text-rl-blue',   placeholder: 'Ex: Mercado em crescimento, concorrência fraca, nova regulação favorável...' },
  { key: 'ameacas',       label: 'Ameaças',       icon: Shield,        border: 'border-rl-gold/30',  bg: 'bg-rl-gold/5',   text: 'text-rl-gold',   placeholder: 'Ex: Novos concorrentes, mudança de algoritmo, crise econômica...' },
]

function uid() { return Math.random().toString(36).slice(2, 9) }

function fmtBRL(n) {
  if (!n || isNaN(n) || !isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function fmtNum(n) {
  if (n == null || isNaN(n)) return '—'
  if (!isFinite(n)) return '∞'
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

/** Recalcula o resultado do ROI a partir dos inputs salvos */
function computeROI(c) {
  if (!c) return null
  const { mediaOrcamento, custoMarketing, ticketMedio, qtdCompras,
          margemBruta, roiDesejado, taxaLead2MQL, taxaMQL2SQL, taxaSQL2Venda } = c
  const totalInvestimento = (mediaOrcamento || 0) + (custoMarketing || 0)
  const lucroPorVenda     = (ticketMedio || 0) * (qtdCompras || 1) * ((margemBruta || 0) / 100)
  if (!lucroPorVenda) return null
  const retornoAlvo        = totalInvestimento * (1 + (roiDesejado || 0) / 100)
  const vendasNecessarias  = retornoAlvo / lucroPorVenda
  const sqlsNecessarios  = taxaSQL2Venda  ? vendasNecessarias / (taxaSQL2Venda  / 100) : Infinity
  const mqlsNecessarios  = taxaMQL2SQL    ? sqlsNecessarios   / (taxaMQL2SQL    / 100) : Infinity
  const leadsNecessarios = taxaLead2MQL   ? mqlsNecessarios   / (taxaLead2MQL   / 100) : Infinity
  const faturamento  = vendasNecessarias * (ticketMedio || 0) * (qtdCompras || 1)
  const lucroBruto   = faturamento * ((margemBruta || 0) / 100)
  const lucroLiquido = lucroBruto - totalInvestimento
  const cac              = vendasNecessarias ? (mediaOrcamento || 0) / vendasNecessarias : Infinity
  const vendasBreakeven  = totalInvestimento / lucroPorVenda
  const custoPorLead  = leadsNecessarios  ? (mediaOrcamento || 0) / leadsNecessarios  : Infinity
  const custoPorMQL   = mqlsNecessarios   ? (mediaOrcamento || 0) / mqlsNecessarios   : Infinity
  const custoPorSQL   = sqlsNecessarios   ? (mediaOrcamento || 0) / sqlsNecessarios   : Infinity
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
  const saved = project.estrategiaV2 || {}

  const [problemas,      setProblemas]      = useState(() => saved.problemas    || [])
  const [swot,           setSwot]           = useState(() => saved.swot         || { forcas: '', fraquezas: '', oportunidades: '', ameacas: '' })
  const [concorrentes,   setConcorrentes]   = useState(() => saved.concorrentes || [])
  const [riscos,         setRiscos]         = useState(() => saved.riscos       || [])
  const [funis,          setFunis]          = useState(() => saved.funis        || [])
  const [activeTab,      setActiveTab]      = useState(0)
  const [problemaInput,  setProblemaInput]  = useState('')

  const isMounted = useRef(false)

  const personas     = project.personas     || []
  const campaignPlan = project.campaignPlan || null
  const roiCalc      = project.roiCalc      || null
  // Usa roiResult salvo ou recalcula se só tiver roiCalc
  const roiResult    = useMemo(
    () => project.roiResult || computeROI(roiCalc),
    [project.roiResult, roiCalc]
  )

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
    const novo = { id: uid(), nome: '', metaAds: false, googleAds: false, linkBiblioteca: '', grandePromessa: '', comunicacao: '' }
    setConcorrentes(prev => { setActiveTab(prev.length); return [...prev, novo] })
  }, [])

  const updateConcorrente = useCallback((id, patch) => {
    setConcorrentes(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }, [])

  const removeConcorrente = useCallback((id) => {
    setConcorrentes(prev => {
      const next = prev.filter(c => c.id !== id)
      setActiveTab(t => Math.min(t, Math.max(0, next.length - 1)))
      return next
    })
  }, [])

  // ── Riscos ──────────────────────────────────────────────────────────────
  const addRisco = useCallback(() => {
    setRiscos(prev => [...prev, { id: uid(), problema: '', riscoGerado: '', impacto: '', nivel: 'medio' }])
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
      estrategiaV2: { problemas, swot, concorrentes, riscos, funis, updatedAt: new Date().toISOString() }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemas, swot, concorrentes, riscos, funis])

  // ── Save / Export ──────────────────────────────────────────────────────
  function handleSave() {
    onSave({ problemas, swot, concorrentes, riscos, funis, updatedAt: new Date().toISOString() })
  }

  function handleExport() {
    exportEstrategiaV2PDF(project, { problemas, swot, concorrentes, riscos, funis, roiResult, roiCalc })
  }

  // ── Budget helpers ─────────────────────────────────────────────────────
  const totalBudget = campaignPlan?.orcamentoTotal || campaignPlan?.totalBudget || 0

  return (
    <div className="space-y-8 pb-6">

      {/* ═══ SEÇÃO 1: PROBLEMAS ════════════════════════════════════════════ */}
      <div className="glass-card p-5">
        <SectionHeader
          icon={AlertTriangle}
          title="Problemas Identificados no Kickoff"
          subtitle={`Registre os principais problemas identificados. ${problemas.length}/${MAX_PROBLEMAS}`}
          color="text-rl-gold"
        />

        {/* Input */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={problemaInput}
            onChange={e => setProblemaInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addProblema()}
            placeholder="Descreva o problema identificado..."
            disabled={problemas.length >= MAX_PROBLEMAS}
            className="input-field flex-1 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          />
          <button
            onClick={addProblema}
            disabled={!problemaInput.trim() || problemas.length >= MAX_PROBLEMAS}
            className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Adicionar
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
          <p className="text-sm text-rl-muted italic">Nenhum problema adicionado ainda.</p>
        )}
      </div>

      {/* ═══ SEÇÃO 2: SWOT ════════════════════════════════════════════════ */}
      <div className="glass-card p-5">
        <SectionHeader
          icon={BarChart3}
          title="Análise SWOT"
          subtitle="Avalie forças, fraquezas, oportunidades e ameaças do negócio"
          color="text-rl-blue"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SWOT_CONFIG.map(({ key, label, icon: Icon, border, bg, text, placeholder }) => (
            <div key={key} className={`rounded-xl border ${border} ${bg} p-4`}>
              <div className={`flex items-center gap-2 mb-2 ${text}`}>
                <Icon className="w-4 h-4" />
                <span className="text-sm font-semibold">{label}</span>
              </div>
              <textarea
                value={swot[key]}
                onChange={e => setSwot(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                rows={5}
                className="w-full bg-transparent text-sm text-rl-text placeholder-rl-muted/50 resize-none outline-none leading-relaxed"
              />
            </div>
          ))}
        </div>
      </div>

      {/* ═══ SEÇÃO 3: BENCHMARK ═══════════════════════════════════════════ */}
      <div className="glass-card p-5">
        <SectionHeader
          icon={Target}
          title="Benchmark de Concorrentes"
          subtitle="Analise a comunicação e presença digital dos concorrentes"
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
                {c.nome || `Concorrente ${i + 1}`}
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
                <label className="text-xs font-semibold text-rl-muted uppercase tracking-wider block mb-1.5">Nome do Concorrente</label>
                <input
                  type="text"
                  value={c.nome}
                  onChange={e => updateConcorrente(c.id, { nome: e.target.value })}
                  placeholder="Ex: Empresa XYZ"
                  className="input-field w-full text-sm"
                />
              </div>

              {/* Plataformas */}
              <div className="flex flex-wrap gap-4">
                {[
                  { field: 'metaAds',   label: 'Faz Meta Ads?',   color: 'text-rl-blue' },
                  { field: 'googleAds', label: 'Faz Google Ads?', color: 'text-rl-green' },
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
                    <Link className="w-3 h-3" /> Link da Biblioteca de Anúncios (Meta)
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
                <label className="text-xs font-semibold text-rl-muted uppercase tracking-wider block mb-1.5">Grande Promessa</label>
                <textarea
                  value={c.grandePromessa}
                  onChange={e => updateConcorrente(c.id, { grandePromessa: e.target.value })}
                  placeholder="Qual é a principal promessa que eles fazem para o cliente?"
                  rows={3}
                  className="input-field w-full text-sm resize-none"
                />
              </div>

              {/* Comunicação */}
              <div>
                <label className="text-xs font-semibold text-rl-muted uppercase tracking-wider block mb-1.5">Comunicação Usada</label>
                <textarea
                  value={c.comunicacao}
                  onChange={e => updateConcorrente(c.id, { comunicacao: e.target.value })}
                  placeholder="Como eles se comunicam? Linguagem, tom, ângulos de copy, formatos de anúncios..."
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
                Remover este concorrente
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
          Adicionar Concorrente
        </button>
      </div>

      {/* ═══ SEÇÃO 4: RISCOS ══════════════════════════════════════════════ */}
      <div className="glass-card p-5">
        <SectionHeader
          icon={Shield}
          title="Riscos do Projeto"
          subtitle="Mapeie os problemas críticos e seus impactos no projeto"
          color="text-red-400"
        />

        {riscos.length > 0 && (
          <div className="space-y-3 mb-4">
            {/* Header da tabela */}
            <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_110px_36px] gap-2 px-3">
              {['Problema / Causa', 'Risco Gerado', 'Impacto', 'Nível', ''].map(h => (
                <span key={h} className="text-[10px] font-bold text-rl-muted uppercase tracking-wider">{h}</span>
              ))}
            </div>

            {riscos.map((r) => (
              <div key={r.id} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_110px_36px] gap-2 items-start bg-rl-surface rounded-xl p-3 border border-rl-border">
                <input
                  value={r.problema}
                  onChange={e => updateRisco(r.id, { problema: e.target.value })}
                  placeholder="Descreva o problema..."
                  className="input-field text-sm py-1.5"
                />
                <input
                  value={r.riscoGerado}
                  onChange={e => updateRisco(r.id, { riscoGerado: e.target.value })}
                  placeholder="Qual risco isso gera?"
                  className="input-field text-sm py-1.5"
                />
                <input
                  value={r.impacto}
                  onChange={e => updateRisco(r.id, { impacto: e.target.value })}
                  placeholder="Qual é o impacto?"
                  className="input-field text-sm py-1.5"
                />
                <select
                  value={r.nivel}
                  onChange={e => updateRisco(r.id, { nivel: e.target.value })}
                  className={`input-field text-sm py-1.5 font-semibold border rounded-xl ${NIVEL_COLORS[r.nivel]}`}
                >
                  <option value="baixo">Baixo</option>
                  <option value="medio">Médio</option>
                  <option value="alto">Alto</option>
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
          Adicionar Risco
        </button>
      </div>

      {/* ═══ SEÇÃO 5: ICPs (read-only) ════════════════════════════════════ */}
      <div className="glass-card p-5">
        <SectionHeader
          icon={Users}
          title="Resumo dos ICPs"
          subtitle="Lido automaticamente do módulo de Personas"
          color="text-rl-cyan"
        />

        {personas.length === 0 ? (
          <div className="text-center py-6 text-rl-muted text-sm">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Nenhum ICP cadastrado.</p>
            <p className="text-xs mt-1">Preencha o módulo de Personas primeiro.</p>
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
                    <h4 className="font-semibold text-rl-text text-sm truncate">{p.name || `Persona ${i + 1}`}</h4>
                  </div>

                  {/* Chips de atributos */}
                  <div className="space-y-2">
                    {[
                      { key: 'resultado', label: 'Deseja', color: 'bg-rl-green/10 text-rl-green' },
                      { key: 'objecoes',  label: 'Objeção', color: 'bg-red-400/10 text-red-400' },
                      { key: 'medos',     label: 'Medo',    color: 'bg-rl-gold/10 text-rl-gold' },
                      { key: 'sonhos',    label: 'Sonha',   color: 'bg-rl-purple/10 text-rl-purple' },
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
          title="Tipos de Funis"
          subtitle="Selecione os funis que serão utilizados nesta estratégia"
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
                {funil}
              </button>
            )
          })}
        </div>

        {funis.length > 0 && (
          <p className="text-xs text-rl-purple mt-3">
            {funis.length} funil{funis.length > 1 ? 'is' : ''} selecionado{funis.length > 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* ═══ SEÇÃO 7: METAS DO FUNIL (ROI — read-only) ═══════════════════ */}
      <div className="glass-card p-5">
        <SectionHeader
          icon={Calculator}
          title="Metas do Funil"
          subtitle="Resultados necessários para atingir o ROI definido na Calculadora — lido automaticamente"
          color="text-rl-purple"
        />

        {!roiResult ? (
          <div className="text-center py-6 text-rl-muted text-sm">
            <Calculator className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Calculadora de ROI não preenchida ainda.</p>
            <p className="text-xs mt-1">Preencha o módulo de ROI para ver as metas do funil.</p>
          </div>
        ) : (
          <div className="space-y-5">

            {/* ROI alvo + investimento */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'ROI Desejado',    value: roiCalc?.roiDesejado != null ? `${roiCalc.roiDesejado}%` : '—', color: 'text-rl-purple', bg: 'bg-rl-purple/10 border-rl-purple/20' },
                { label: 'Total Investido', value: fmtBRL(roiResult.totalInvestimento),   color: 'text-rl-text',   bg: 'bg-rl-surface border-rl-border' },
                { label: 'Faturamento Alvo',value: fmtBRL(roiResult.faturamento),          color: 'text-rl-blue',   bg: 'bg-rl-blue/10 border-rl-blue/20' },
                { label: 'Lucro Líquido',   value: fmtBRL(roiResult.lucroLiquido),
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
                Metas por etapa do funil — por mês
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1">
                {[
                  { label: 'Leads',  value: roiResult.leadsNecessarios,  cost: roiResult.custoPorLead, costLabel: 'CPL (mídia)',  color: 'text-rl-purple', bg: 'bg-rl-purple/10 border-rl-purple/25', rate: null },
                  { label: 'MQLs',   value: roiResult.mqlsNecessarios,   cost: roiResult.custoPorMQL,  costLabel: 'C. MQL',      color: 'text-rl-blue',   bg: 'bg-rl-blue/10 border-rl-blue/25',     rate: roiCalc?.taxaLead2MQL },
                  { label: 'SQLs',   value: roiResult.sqlsNecessarios,   cost: roiResult.custoPorSQL,  costLabel: 'C. SQL',      color: 'text-rl-cyan',   bg: 'bg-rl-cyan/10 border-rl-cyan/25',     rate: roiCalc?.taxaMQL2SQL },
                  { label: 'Vendas', value: roiResult.vendasNecessarias, cost: roiResult.cac,          costLabel: 'CAC (mídia)', color: 'text-rl-green',  bg: 'bg-rl-green/10 border-rl-green/25',   rate: roiCalc?.taxaSQL2Venda },
                ].map((step, i, arr) => (
                  <div key={step.label} className="flex sm:flex-col items-center gap-1 flex-1">
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
                            {step.rate}% conv.
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
                { label: 'Lucro Bruto',         value: fmtBRL(roiResult.lucroBruto),    color: 'text-rl-cyan' },
                { label: 'CAC (mídia)',          value: fmtBRL(roiResult.cac),           color: 'text-rl-gold' },
                { label: 'Breakeven (vendas)',   value: fmtNum(roiResult.vendasBreakeven), color: 'text-rl-text' },
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
                  { label: 'Ticket Médio', value: fmtBRL(roiCalc.ticketMedio) },
                  { label: 'Margem Bruta', value: `${roiCalc.margemBruta}%` },
                  { label: 'Lucro/Venda',  value: fmtBRL(roiResult.lucroPorVenda) },
                  { label: 'Orçamento Mídia', value: fmtBRL(roiCalc.mediaOrcamento) },
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
          title="Planejamento de Campanhas"
          subtitle="Resumo por canais — lido do módulo de Planejamento de Campanhas"
          color="text-rl-green"
        />

        {!campaignPlan || !campaignPlan.channels?.length ? (
          <div className="text-center py-6 text-rl-muted text-sm">
            <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Planejamento de campanhas não preenchido ainda.</p>
            <p className="text-xs mt-1">Preencha o módulo de Planejamento de Campanhas primeiro.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Orçamento total */}
            <div className="flex items-center gap-3 bg-rl-green/5 border border-rl-green/20 rounded-xl px-4 py-3">
              <span className="text-xs font-bold text-rl-muted uppercase tracking-wider">Orçamento Total</span>
              <span className="text-lg font-bold text-rl-green">{fmtBRL(totalBudget)}<span className="text-xs font-normal text-rl-muted">/mês</span></span>
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
                        <span className="font-semibold text-rl-text">{fmtBRL(chBudget)}/mês</span>
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
                            {key === 'topo' ? 'Topo' : key === 'meio' ? 'Meio' : 'Fundo'} — {fmtBRL(stageBudget)}/mês
                          </span>
                          {stage.campaigns.map(camp => (
                            <div key={camp.id} className="flex justify-between items-center py-0.5 ml-2">
                              <span className="text-xs text-rl-muted">{camp.name || '—'}</span>
                              <span className="text-xs text-rl-text">{fmtBRL(stageBudget * (camp.percentage / 100))}/mês</span>
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
          Exportar PDF
        </button>
        <div className="flex items-center gap-3">
          <AutoSaveIndicator />
          <button
            onClick={handleSave}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Save className="w-4 h-4" />
            Salvar Estratégia
          </button>
        </div>
      </div>
    </div>
  )
}
