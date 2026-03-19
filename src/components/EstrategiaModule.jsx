import PropTypes from 'prop-types'
import { useState, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { streamClaude } from '../lib/claude'
import { buildCachedPayload } from '../lib/buildContext'
import { exportEstrategiaPDF } from '../utils/exportPDF'
import {
  CheckCircle2, Circle, Sparkles, Loader2, AlertTriangle,
  Copy, CheckCheck, RotateCcw, FileDown, TrendingUp, Users,
  Zap, BarChart3, Target, ChevronDown, ChevronUp,
} from 'lucide-react'
import StatusItem from './Estrategia/StatusItem'
import KPICard from './Estrategia/KPICard'
import FunnelViz from './Estrategia/FunnelViz'
import NarrativaRenderer from './Estrategia/NarrativaRenderer'

// ─── Formatters ────────────────────────────────────────────────────────────────
function fmtCurrency(n) {
  if (!n || isNaN(n) || !isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}
function fmtNum(n) {
  if (!n || isNaN(n)) return '—'
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

// ─── System Prompt ─────────────────────────────────────────────────────────────
const ESTRATEGIA_SYSTEM = `Você é um estrategista sênior de marketing digital da Revenue Lab. Sua missão é criar uma ESTRATÉGIA DIGITAL PROFISSIONAL completa para o cliente — um documento executivo que demonstra domínio total do negócio e gera confiança imediata.

O documento será entregue diretamente ao cliente, então deve ter linguagem impecável, profissional e baseada em dados reais.

## DIRETRIZES DE ESCRITA
- Use "você" ao se referir ao cliente (informal mas respeitoso)
- Use "nossa equipe", "iremos", "identificamos" para ações da agência
- Tom: executivo, estratégico, confiante — nunca genérico
- Cite os números reais do ROI e do plano de mídia sempre que disponíveis
- Mostre que você entende profundamente o negócio do cliente
- Seja específico: mencione o nicho, a oferta, as personas pelo nome
- Evite floreios vazios — cada frase deve ter substância

## ESTRUTURA OBRIGATÓRIA
Escreva cada seção separada por "---":

## 1. DIAGNÓSTICO DE SITUAÇÃO
Análise do momento atual: nicho, maturidade digital, posicionamento atual, principais desafios e oportunidades identificadas. Seja específico ao negócio do cliente.

## 2. OBJETIVO ESTRATÉGICO
A meta financeira clara, o investimento necessário e o ROI projetado. Mostre os números reais do funil de conversão projetado. Conecte o investimento ao retorno esperado de forma precisa.

## 3. PÚBLICO-ALVO PRIORITÁRIO
Quem são as personas prioritárias, onde estão, o que desejam profundamente e as principais objeções que precisamos superar. Use os dados das personas criadas no projeto.

## 4. PROPOSTA DE VALOR E OFERTA
A oferta central e por que ela é irresistível para este público. Destaque os diferenciais competitivos, a velocidade de resultado e a garantia.

## 5. ESTRATÉGIA DE MÍDIA
Os canais escolhidos, a lógica de alocação de verba entre eles, e a expectativa de resultado por canal. Justifique cada escolha estrategicamente.

## 6. PROJEÇÃO DO FUNIL
Apresente a projeção completa: leads mensais necessários → MQL → SQL → vendas. Use os números reais calculados. Mostre as taxas de conversão em cada etapa.

## 7. PRÓXIMOS 30 DIAS — PLANO DE AÇÃO
Um plano de ação concreto e prático para o primeiro mês de trabalho. Liste ações específicas, responsáveis e resultados esperados.

Use markdown rico: ## para títulos de seção, **negrito** para termos-chave e números, - para listas de ação.`

// ─── Main Component ────────────────────────────────────────────────────────────
export default function EstrategiaModule({ project }) {
  const { updateProject } = useApp()

  // Load saved narrative
  const [narrativa,   setNarrativa]   = useState(() => project.estrategia?.narrativa || '')
  const [streaming,   setStreaming]    = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)
  const [copied,      setCopied]      = useState(false)
  const [showStatus,  setShowStatus]  = useState(true)

  // ── Derive data from project ────────────────────────────────────────────────
  const roi      = project.roiResult
  const personas = project.personas || []
  const oferta   = project.ofertaData
  const plan     = project.campaignPlan
  const ob       = project  // onboarding data lives directly on project

  const hasOnboarding = !!ob.companyName
  const hasROI        = !!roi?.totalInvestimento
  const hasPersonas   = personas.length > 0
  const hasOferta     = !!(oferta?.nome || oferta?.resultadoSonho)
  const hasCampaign   = !!(plan?.channels?.length > 0)

  const filledCount = [hasOnboarding, hasROI, hasPersonas, hasOferta, hasCampaign].filter(Boolean).length
  const pctComplete = (filledCount / 5) * 100

  // ── Build instruction for Claude ─────────────────────────────────────────────
  const buildInstruction = useCallback(() => {
    const sections = []

    if (roi) {
      sections.push(`**DADOS DE ROI E FINANCEIRO:**
- Investimento total: ${fmtCurrency(roi.totalInvestimento)}/mês (mídia: ${fmtCurrency(roi.mediaOrcamento)}, assessoria: ${fmtCurrency(roi.assessoriaOrcamento)})
- Meta de faturamento: ${fmtCurrency(roi.faturamento)}/mês
- ROI desejado: ${roi.roiDesejado}%
- Ticket médio: ${fmtCurrency(roi.ticketMedio)}
- Vendas necessárias/mês: ${roi.vendasNecessarias}
- Leads necessários/mês: ${roi.leadsNecessarios}
- Taxas do funil: Lead→MQL ${roi.taxaLeadMql}% / MQL→SQL ${roi.taxaMqlSql}% / SQL→Venda ${roi.taxaSqlVenda}%`)
    }

    if (plan?.channels?.length) {
      const totalBudget = plan.orcamentoTotal || plan.totalBudget || 0
      sections.push(`**PLANO DE MÍDIA:**
- Orçamento total do mês: ${fmtCurrency(totalBudget)}
- Canais: ${plan.channels.map((c) => `${c.name} ${c.percentage}% (${fmtCurrency(c.monthly)})`).join(' | ')}`)
    }

    return `Com base em TODOS os dados do contexto do cliente acima${sections.length ? ` e nos dados específicos abaixo:\n\n${sections.join('\n\n')}` : ''}, crie a estratégia digital profissional completa seguindo a estrutura obrigatória.

Seja específico, cite números reais, mencione as personas pelo nome, a oferta pelo nome, o nicho do cliente. Este documento será enviado ao cliente — deve impressionar pela profundidade e personalização.`
  }, [roi, plan])

  // ── Generate narrative ────────────────────────────────────────────────────────
  const generate = useCallback(async () => {
    setLoading(true)
    setError(null)
    setStreaming('')
    setNarrativa('')
    try {
      const { system, messages } = buildCachedPayload({
        systemPrompt: ESTRATEGIA_SYSTEM,
        project,
        instruction:  buildInstruction(),
      })
      const fullText = await streamClaude({
        model:      'claude-sonnet-4-5',
        max_tokens: 16000,
        system,
        messages,
        onChunk:    (text) => setStreaming(text),
      })
      setNarrativa(fullText)
      setStreaming(null)
      updateProject(project.id, {
        estrategia: { ...(project.estrategia || {}), narrativa: fullText, updatedAt: new Date().toISOString() },
      })
    } catch (e) {
      setError(e.message)
      setStreaming(null)
    } finally {
      setLoading(false)
    }
  }, [buildInstruction, project, updateProject])

  const handleCopy = () => {
    navigator.clipboard.writeText(narrativa)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExport = () => {
    exportEstrategiaPDF(project, narrativa)
  }

  const displayContent = streaming ?? narrativa
  const hasNarrativa = !!narrativa

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-rl-text mb-1">Estratégia Digital</h2>
          <p className="text-sm text-rl-muted">Síntese de todos os módulos em um documento executivo para o cliente.</p>
        </div>
        {hasNarrativa && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-rl-bg border border-rl-border text-rl-muted hover:text-rl-text transition-all"
            >
              {copied ? <CheckCheck className="w-3.5 h-3.5 text-rl-green" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado!' : 'Copiar texto'}
            </button>
            <button
              onClick={handleExport}
              className="btn-primary flex items-center gap-2 text-sm py-2"
            >
              <FileDown className="w-4 h-4" />
              Exportar PDF
            </button>
          </div>
        )}
      </div>

      {/* ── Completeness bar ── */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setShowStatus((v) => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-rl-text hover:text-rl-purple transition-colors"
          >
            <span>📋 Status dos dados</span>
            {showStatus ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <span className={`text-sm font-bold ${filledCount === 5 ? 'text-rl-green' : 'text-rl-muted'}`}>
            {filledCount}/5 módulos
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-rl-border rounded-full overflow-hidden mb-3">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              filledCount === 5 ? 'bg-rl-green' : 'bg-gradient-rl'
            }`}
            style={{ width: `${pctComplete}%` }}
          />
        </div>

        {showStatus && (
          <div className="divide-y divide-rl-border/40">
            <StatusItem icon={CheckCircle2} label="Onboarding" ok={hasOnboarding}
              detail={hasOnboarding ? `${ob.companyName} · ${ob.businessType}` : 'Preencha os dados da empresa'} />
            <StatusItem icon={BarChart3} label="Calculadora de ROI" ok={hasROI}
              detail={hasROI ? `Inv. ${fmtCurrency(roi.totalInvestimento)}/mês · Meta ${fmtCurrency(roi.faturamento)}` : 'Defina metas de faturamento e ROI'} />
            <StatusItem icon={Users} label="ICP / Personas" ok={hasPersonas}
              detail={hasPersonas ? `${personas.length} persona${personas.length > 1 ? 's' : ''}: ${personas.map((p) => p.name || 'Sem nome').join(', ')}` : 'Crie as personas do cliente'} />
            <StatusItem icon={Zap} label="Oferta Matadora" ok={hasOferta}
              detail={hasOferta ? (oferta?.nome || oferta?.resultadoSonho?.slice(0, 60)) : 'Configure a oferta principal'} />
            <StatusItem icon={Target} label="Planejamento de Campanhas" ok={hasCampaign}
              detail={hasCampaign ? `${plan.channels.length} canal${plan.channels.length > 1 ? 'is' : ''}: ${plan.channels.map((c) => c.name).join(', ')}` : 'Defina canais e verba'} />
          </div>
        )}
      </div>

      {/* ── Data synthesis ── */}
      {(hasROI || hasPersonas || hasOferta || hasCampaign) && (
        <div className="space-y-4">

          {/* ROI KPIs */}
          {hasROI && (
            <div>
              <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wider mb-3">Métricas de Negócio</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KPICard label="Investimento/mês" value={fmtCurrency(roi.totalInvestimento)} sub={`Mídia: ${fmtCurrency(roi.mediaOrcamento)}`} colorClass="text-rl-purple" />
                <KPICard label="Meta de Faturamento" value={fmtCurrency(roi.faturamento)} sub="por mês" colorClass="text-rl-green" />
                <KPICard label="ROI Desejado" value={`${roi.roiDesejado || 0}%`} sub="retorno sobre investimento" colorClass="text-rl-blue" />
                <KPICard label="Vendas Necessárias" value={fmtNum(roi.vendasNecessarias)} sub={`Ticket médio ${fmtCurrency(roi.ticketMedio)}`} colorClass="text-rl-gold" />
              </div>
            </div>
          )}

          {/* Funnel + ICP + Oferta row */}
          <div className={`grid gap-4 ${hasROI && (hasPersonas || hasOferta) ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>

            {/* Funnel */}
            {hasROI && (
              <div className="glass-card p-5 border border-rl-border/70">
                <FunnelViz roi={roi} />
              </div>
            )}

            {/* ICP */}
            {hasPersonas && (
              <div className="glass-card p-5 border border-rl-border/70">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-rl-blue" />
                  <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wider">Público-Alvo</p>
                </div>
                <div className="space-y-3">
                  {personas.slice(0, 3).map((p, i) => {
                    const objecoes = (p.answers?.objecoes || []).filter(Boolean).slice(0, 2)
                    const sonhos   = (p.answers?.sonhos   || []).filter(Boolean).slice(0, 2)
                    return (
                      <div key={i} className="pb-3 border-b border-rl-border/40 last:border-0 last:pb-0">
                        <p className="text-sm font-bold text-rl-text mb-1.5">{p.name || `Persona ${i + 1}`}</p>
                        {sonhos.length > 0 && (
                          <div className="mb-1.5">
                            <p className="text-[9px] font-bold text-rl-green uppercase tracking-wider mb-0.5">Sonha com</p>
                            {sonhos.map((s, j) => (
                              <p key={j} className="text-[11px] text-rl-subtle leading-snug">· {s}</p>
                            ))}
                          </div>
                        )}
                        {objecoes.length > 0 && (
                          <div>
                            <p className="text-[9px] font-bold text-rl-gold uppercase tracking-wider mb-0.5">Objeções</p>
                            {objecoes.map((o, j) => (
                              <p key={j} className="text-[11px] text-rl-subtle leading-snug">· {o}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Oferta */}
            {hasOferta && (
              <div className="glass-card p-5 border border-rl-border/70">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-rl-gold" />
                  <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wider">Oferta Matadora</p>
                </div>
                {oferta.nome && (
                  <p className="text-base font-black text-rl-text mb-2">"{oferta.nome}"</p>
                )}
                <div className="space-y-2.5">
                  {oferta.resultadoSonho && (
                    <div>
                      <p className="text-[9px] font-bold text-rl-green uppercase tracking-wider mb-0.5">Resultado do Sonho</p>
                      <p className="text-xs text-rl-subtle leading-snug">{oferta.resultadoSonho}</p>
                    </div>
                  )}
                  {oferta.velocidade && (
                    <div>
                      <p className="text-[9px] font-bold text-rl-blue uppercase tracking-wider mb-0.5">Prazo / Velocidade</p>
                      <p className="text-xs text-rl-subtle leading-snug">{oferta.velocidade}</p>
                    </div>
                  )}
                  {oferta.garantia && (
                    <div>
                      <p className="text-[9px] font-bold text-rl-purple uppercase tracking-wider mb-0.5">Garantia</p>
                      <p className="text-xs text-rl-subtle leading-snug">{oferta.garantia}</p>
                    </div>
                  )}
                  {oferta.escassez && (
                    <div>
                      <p className="text-[9px] font-bold text-rl-gold uppercase tracking-wider mb-0.5">Escassez / Urgência</p>
                      <p className="text-xs text-rl-subtle leading-snug">{oferta.escassez}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Channels */}
          {hasCampaign && (
            <div className="glass-card p-5 border border-rl-border/70">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-rl-green" />
                <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wider">Plano de Mídia</p>
                <span className="ml-auto text-sm font-bold text-rl-text">
                  {fmtCurrency(plan.orcamentoTotal || plan.totalBudget)}/mês
                </span>
              </div>
              <div className="space-y-3">
                {plan.channels.map((ch) => (
                  <div key={ch.id} className="flex items-center gap-3">
                    <span className="text-sm text-rl-text w-28 shrink-0">{ch.name}</span>
                    <div className="flex-1 h-2 bg-rl-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-rl"
                        style={{ width: `${ch.percentage}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-rl-text w-8 text-right">{ch.percentage}%</span>
                    <span className="text-xs text-rl-muted w-20 text-right">{fmtCurrency(ch.monthly)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── AI Narrative section ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-bold text-rl-text">Narrativa Estratégica com IA</p>
            <p className="text-xs text-rl-muted">Documento executivo gerado automaticamente com todos os dados do cliente</p>
          </div>
          <div className="flex items-center gap-2">
            {hasNarrativa && !loading && (
              <button
                onClick={generate}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-rl-bg border border-rl-border text-rl-muted hover:text-rl-text transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Regenerar
              </button>
            )}
            {!hasNarrativa && (
              <button
                onClick={generate}
                disabled={loading || filledCount === 0}
                className="btn-primary flex items-center gap-2 text-sm py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
                  : <><Sparkles className="w-4 h-4" /> Gerar Narrativa</>
                }
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-500 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Streaming / Result */}
        {displayContent ? (
          <div className="space-y-3">
            {loading && (
              <div className="flex items-center gap-2 text-xs text-rl-muted px-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-rl-purple" />
                <span>Gerando narrativa estratégica...</span>
              </div>
            )}
            <NarrativaRenderer content={displayContent} />
            {hasNarrativa && !loading && (
              <div className="flex items-center gap-2 pt-2 flex-wrap">
                <button onClick={handleExport} className="btn-primary flex items-center gap-2 text-sm py-2.5">
                  <FileDown className="w-4 h-4" />
                  Exportar PDF para o Cliente
                </button>
                <button onClick={handleCopy} className="btn-secondary flex items-center gap-2 text-sm py-2.5">
                  {copied ? <CheckCheck className="w-4 h-4 text-rl-green" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copiado!' : 'Copiar texto'}
                </button>
                <button
                  onClick={generate}
                  disabled={loading}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-rl-bg border border-rl-border text-rl-muted hover:text-rl-text transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Regenerar
                </button>
              </div>
            )}
          </div>
        ) : !loading && (
          <div className="glass-card border border-dashed border-rl-border/70 p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rl-purple/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-7 h-7 text-rl-purple" />
            </div>
            <p className="text-sm font-semibold text-rl-text mb-1">Narrativa ainda não gerada</p>
            <p className="text-xs text-rl-muted mb-6 max-w-sm mx-auto">
              {filledCount < 3
                ? `Preencha pelo menos 3 módulos antes de gerar. (${filledCount}/5 preenchidos)`
                : 'Clique em "Gerar Narrativa" para criar o documento executivo personalizado.'
              }
            </p>
            <button
              onClick={generate}
              disabled={loading || filledCount === 0}
              className="btn-primary flex items-center gap-2 mx-auto disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-4 h-4" />
              Gerar Narrativa Estratégica
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

EstrategiaModule.propTypes = {
  project: PropTypes.shape({
    id:              PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    companyName:     PropTypes.string,
    businessType:    PropTypes.string,
    responsibleName: PropTypes.string,
    personas:        PropTypes.array,
    ofertaData:      PropTypes.object,
    attachments:     PropTypes.array,
    estrategia:      PropTypes.shape({
      narrativa:     PropTypes.string,
      generated_at:  PropTypes.string,
    }),
    completedSteps:  PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
}
