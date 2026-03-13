import { useState, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { streamClaude } from '../lib/claude'
import { buildCachedPayload } from '../lib/buildContext'
import {
  Search, Sparkles, Loader2, AlertTriangle, Copy,
  CheckCheck, RotateCcw, History, ChevronDown, ChevronUp,
  Trash2, CheckCircle2,
} from 'lucide-react'

// ─── Campaign Types ────────────────────────────────────────────────────────────
const CAMPAIGN_TYPES = [
  { id: 'marca',        label: 'Marca / Brand',    emoji: '🏷️', desc: 'Protege sua marca e captura buscas diretas pelo nome' },
  { id: 'generico',     label: 'Genérico',          emoji: '🔍', desc: 'Termos genéricos do serviço — maior volume de buscas' },
  { id: 'concorrentes', label: 'Concorrentes',      emoji: '⚔️', desc: 'Nomes de concorrentes — captura quem busca alternativas' },
  { id: 'problema',     label: 'Problema / Dor',    emoji: '💊', desc: 'Termos de dor — topo de funil, intenção de resolver' },
]

// ─── System Prompt ─────────────────────────────────────────────────────────────
const GOOGLE_ADS_SYSTEM = `Você é um especialista em Google Ads com amplo conhecimento em campanhas de busca de alta conversão. Sua metodologia central é o "Bolo de Cenoura Fofinho": a palavra pesquisada pelo lead DEVE aparecer no título do anúncio E espelhar a headline da landing page.

## REGRAS ABSOLUTAS DE CARACTERES
- Títulos RSA: máximo **30 caracteres** (incluindo espaços) — NUNCA ultrapasse
- Descrições RSA: máximo **90 caracteres** (incluindo espaços) — NUNCA ultrapasse
- Após cada título, indique a contagem: T1: Texto Aqui (21 car.)
- Após cada descrição, indique a contagem: D1: Texto mais longo aqui (27 car.)
- Se um título ultrapassar 30 caracteres, reescreva antes de entregar

## METODOLOGIA DE CLUSTERS SEMÂNTICOS
Agrupe palavras por intenção semântica idêntica. Cada grupo = uma intenção específica.
- [palavra exata] — alta conversão, menor volume
- "frase exata" — variações próximas com controle
- +modificador +amplo — escala com controle

## GATILHOS EMOCIONAIS (use mínimo 3 por grupo de anúncios)
Clickbait | Sensação | Mito | Dilema | Prova | Contraste | Oportunidade | Apelo Emocional | Curiosidade | Ultra Segmentado | Problema e Solução | Certo vs. Errado | Comparação

## REGRAS DE OURO
1. 30 caracteres é o limite absoluto para títulos — conte sempre
2. 90 caracteres é o limite absoluto para descrições — conte sempre
3. A palavra pesquisada DEVE aparecer no título do anúncio (bolo de cenoura)
4. Inclua sempre 1 título com a cidade (para buscas locais)
5. Inclua sempre 1 título com CTA (Agende, Saiba Mais, Garanta, Clique)
6. Cada grupo deve ter 8–10 títulos e 2–3 descrições

## CHECKLIST DE COERÊNCIA (Bolo de Cenoura Fofinho)
- [ ] Palavra pesquisada → aparece no headline do anúncio
- [ ] Headline do anúncio → espelha o título da landing page
- [ ] CTA do anúncio → alinhado ao CTA da página
- [ ] Oferta mencionada no anúncio → visível acima da dobra na página

## ARQUITETURA DE CAMPANHAS

### Campanha Marca / Brand
- Grupo 1: Termos de marca pura
- Grupo 2: Marca + serviço

### Campanha Genérico
- Grupo 1: [Serviço] + cidade
- Grupo 2: [Serviço] + qualificador (melhor, top, profissional, especialista)
- Grupo 3: [Serviço] + urgência (rápido, agora, hoje, imediato)

### Campanha Concorrentes
- Grupo 1: Nomes dos concorrentes diretos

### Campanha Problema / Dor
- Grupo 1: O problema que o serviço resolve
- Grupo 2: Consequências do problema não resolvido

## FORMATO DE ENTREGA OBRIGATÓRIO
Use exatamente este formato — separe cada campanha com "---":

═══════════════════════════════════════════
CAMPANHA: [Nome da Campanha]
Objetivo: [Leads / Vendas / Tráfego]
Estratégia de Lance: [CPA alvo / Maximizar conversões]
═══════════════════════════════════════════

  GRUPO DE ANÚNCIOS: [Nome do Grupo]
  Palavras-chave:
    [palavra exata 1]
    "frase exata 2"
    +modificador +amplo +3

  ANÚNCIO RSA 1:
  Títulos:
    T1: [texto] (XX car.)
    T2: [texto] (XX car.)
    T3: [texto] (XX car.)
    T4: [texto] (XX car.)
    T5: [texto] (XX car.)
    T6: [texto] (XX car.)
    T7: [texto] (XX car.)
    T8: [texto] (XX car.)
    T9: [texto] (XX car.)
    T10: [texto] (XX car.)
  Descrições:
    D1: [texto] (XX car.)
    D2: [texto] (XX car.)
    D3: [texto] (XX car.)
  Gatilhos usados: [lista dos gatilhos aplicados]`

// ─── Result Card ───────────────────────────────────────────────────────────────
function ResultCard({ content, index }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const lines = content.split('\n')
  const rendered = lines.map((line, i) => {
    // Separator line of ═
    if (/^═+$/.test(line.trim())) {
      return <div key={i} className="border-t border-rl-border/50 my-3" />
    }
    // Campaign name
    if (/^CAMPANHA:/.test(line)) {
      return <p key={i} className="text-sm font-bold text-rl-cyan mt-1">{line}</p>
    }
    // Campaign meta (Objetivo, Estratégia)
    if (/^(Objetivo|Estratégia de Lance):/.test(line)) {
      return <p key={i} className="text-xs text-rl-muted">{line}</p>
    }
    // Ad group header
    if (/^GRUPO DE ANÚNCIOS:/.test(line)) {
      return <p key={i} className="text-xs font-bold text-rl-purple mt-4 mb-1 border-t border-rl-border/30 pt-3">{line}</p>
    }
    // Section labels
    if (/^(Palavras-chave|ANÚNCIO RSA \d+|Títulos|Descrições|Gatilhos usados):/.test(line.trim())) {
      return <p key={i} className="text-[10px] font-bold text-rl-muted uppercase tracking-wider mt-3 mb-1">{line}</p>
    }
    // Title lines T1:, T2: etc.
    if (/^\s{4}T\d+:/.test(line)) {
      const countMatch = line.match(/\((\d+)\s*car/)
      const count = countMatch ? parseInt(countMatch[1]) : 0
      const isOver = count > 30
      return (
        <p key={i} className={`text-xs font-mono pl-4 leading-5 ${isOver ? 'text-red-400' : 'text-rl-text'}`}>
          {line.trim()}
          {isOver && <span className="ml-1 text-red-400 font-bold">⚠️ EXCEDE 30</span>}
        </p>
      )
    }
    // Description lines D1:, D2: etc.
    if (/^\s{4}D\d+:/.test(line)) {
      const countMatch = line.match(/\((\d+)\s*car/)
      const count = countMatch ? parseInt(countMatch[1]) : 0
      const isOver = count > 90
      return (
        <p key={i} className={`text-xs font-mono pl-4 leading-5 ${isOver ? 'text-red-400' : 'text-rl-subtle'}`}>
          {line.trim()}
          {isOver && <span className="ml-1 text-red-400 font-bold">⚠️ EXCEDE 90</span>}
        </p>
      )
    }
    // Keywords (bracket, quote, plus)
    if (/^\s{4}[\["+]/.test(line)) {
      return <p key={i} className="text-xs font-mono pl-4 text-rl-green leading-5">{line.trim()}</p>
    }
    // Triggers line
    if (/Gatilhos usados:/.test(line)) {
      return <p key={i} className="text-xs text-rl-muted italic mt-1 pl-4">{line.trim()}</p>
    }
    // Empty
    if (line.trim() === '') return <div key={i} className="h-1" />
    // Default
    return <p key={i} className="text-xs text-rl-muted pl-2">{line}</p>
  })

  return (
    <div className="glass-card p-5 border border-rl-border/60">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold text-rl-muted uppercase tracking-wider flex items-center gap-1.5">
          <Search className="w-3 h-3" />
          Estrutura de Campanha {index + 1}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-rl-surface text-rl-muted hover:text-rl-purple transition-all"
        >
          {copied ? <CheckCheck className="w-3 h-3 text-rl-green" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copiado!' : 'Copiar'}
        </button>
      </div>
      <div className="space-y-0">{rendered}</div>
    </div>
  )
}

// ─── Result Block ──────────────────────────────────────────────────────────────
function ResultBlock({ content }) {
  const [allCopied, setAllCopied] = useState(false)
  function copyAll() {
    navigator.clipboard.writeText(content)
    setAllCopied(true)
    setTimeout(() => setAllCopied(false), 2000)
  }
  const chunks = content.split(/\n---\n/).map((c) => c.trim()).filter(Boolean)
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={copyAll} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all">
          {allCopied ? <CheckCheck className="w-3.5 h-3.5 text-rl-green" /> : <Copy className="w-3.5 h-3.5" />}
          {allCopied ? 'Tudo copiado!' : 'Copiar tudo'}
        </button>
      </div>
      {chunks.map((chunk, i) => <ResultCard key={i} content={chunk} index={i} />)}
    </div>
  )
}

// ─── History ───────────────────────────────────────────────────────────────────
function AdsHistory({ project, updateProject }) {
  const all = (project.googleAds || []).slice().reverse()
  const [expandedId, setExpandedId] = useState(null)
  const [showAll, setShowAll] = useState(false)

  if (!all.length) return null

  const visible = showAll ? all : all.slice(0, 5)

  function handleDelete(id) {
    updateProject(project.id, { googleAds: (project.googleAds || []).filter((g) => g.id !== id) })
  }

  function fmtDate(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="w-4 h-4 text-rl-muted" />
        <h3 className="text-sm font-semibold text-rl-text">Histórico de Estruturas</h3>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rl-surface text-rl-muted border border-rl-border">
          {all.length}
        </span>
      </div>

      <div className="glass-card overflow-hidden">
        {visible.map((entry) => (
          <div key={entry.id}>
            <div className="px-4 py-3 border-b border-rl-border/40 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="text-[10px] text-rl-muted shrink-0">{fmtDate(entry.createdAt)}</span>
                <div className="flex flex-wrap gap-1 min-w-0">
                  {(entry.campaignTypes || []).map((t) => {
                    const ct = CAMPAIGN_TYPES.find((c) => c.id === t)
                    return ct ? (
                      <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-rl-surface border border-rl-border text-rl-muted">
                        {ct.emoji} {ct.label}
                      </span>
                    ) : null
                  })}
                </div>
                {entry.keywords && (
                  <span className="text-[10px] text-rl-muted truncate hidden sm:block">· {entry.keywords.split('\n')[0].slice(0, 40)}</span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all"
                  title="Ver conteúdo"
                >
                  {expandedId === entry.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="p-1.5 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
                  title="Excluir"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {expandedId === entry.id && (
              <div className="px-4 py-5 bg-rl-surface/20 border-b border-rl-border/40">
                <ResultBlock content={entry.content} />
              </div>
            )}
          </div>
        ))}

        {all.length > 5 && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="w-full px-4 py-3 text-xs text-rl-muted hover:text-rl-text transition-colors text-center"
          >
            {showAll ? '▲ Mostrar menos' : `▼ Ver mais ${all.length - 5} entradas`}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function GoogleAdsModule({ project }) {
  const { updateProject } = useApp()

  // ── Form state ───────────────────────────────────────────────────────────────
  const [keywords,      setKeywords]      = useState('')
  const [landingPage,   setLandingPage]   = useState('')
  const [mainOffer,     setMainOffer]     = useState('')
  const [city,          setCity]          = useState(() => project.city || '')
  const [objections,    setObjections]    = useState('')
  const [campaignTypes, setCampaignTypes] = useState(new Set(['generico']))
  const [customNote,    setCustomNote]    = useState('')

  // ── Generation state ─────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [result,  setResult]  = useState(null)

  const toggleType = useCallback((id) => {
    setCampaignTypes((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const selectedTypes = CAMPAIGN_TYPES.filter((t) => campaignTypes.has(t.id))

  const buildInstruction = useCallback(() => {
    const typesStr = selectedTypes.map((t) => `${t.emoji} ${t.label}: ${t.desc}`).join('\n')
    const customSection = customNote.trim()
      ? `\n## INSTRUÇÕES ADICIONAIS\n${customNote.trim()}\n`
      : ''

    return `${customSection}
## DADOS ESPECÍFICOS PARA ESTA CAMPANHA

**Palavras-chave semente:**
${keywords || '(use os dados do produto/serviço do contexto do cliente)'}

**Landing Page / Página de destino:**
${landingPage || '(use os dados do produto/serviço do contexto do cliente)'}

**Diferencial / Oferta principal:**
${mainOffer || '(use a Oferta Matadora do contexto do cliente)'}

**Cidade / Região de atuação:**
${city || '(use o contexto do cliente)'}

**Objeções comuns dos clientes:**
${objections || '(use as objeções das personas no contexto do cliente)'}

---

## CAMPANHAS A CRIAR

Crie a estrutura completa para as seguintes campanhas:
${typesStr}

Use as informações do CONTEXTO COMPLETO DO CLIENTE (empresa, produto, personas, oferta) em conjunto com os dados específicos acima para criar anúncios altamente personalizados e relevantes. Aplique a metodologia Bolo de Cenoura Fofinho em todos os grupos de anúncios.`
  }, [keywords, landingPage, mainOffer, city, objections, customNote, selectedTypes])

  // ── Generate ─────────────────────────────────────────────────────────────────
  const generate = useCallback(async () => {
    if (!campaignTypes.size) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const { system, messages } = buildCachedPayload({
        systemPrompt: GOOGLE_ADS_SYSTEM,
        project,
        instruction:  buildInstruction(),
      })
      const fullText = await streamClaude({
        model:      'claude-sonnet-4-5',
        max_tokens: 8000,
        system,
        messages,
        onChunk:    (text) => setResult(text),
      })

      // Save to project history
      const entry = {
        id:            Date.now(),
        campaignTypes: [...campaignTypes],
        keywords:      keywords.trim(),
        city:          city.trim(),
        content:       fullText,
        createdAt:     new Date().toISOString(),
      }
      updateProject(project.id, {
        googleAds: [...(project.googleAds || []), entry],
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [buildInstruction, campaignTypes, city, keywords, project, updateProject])

  const canGenerate = campaignTypes.size > 0 && keywords.trim().length > 0

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-rl-text mb-1">Google Ads — Estrutura de Campanhas</h2>
        <p className="text-sm text-rl-muted">
          Preencha os dados abaixo para gerar a estrutura completa de campanhas com grupos de anúncios, palavras-chave, RSAs e gatilhos emocionais.
        </p>
      </div>

      {/* ── Metodologia Info ── */}
      <div className="bg-rl-cyan/5 border border-rl-cyan/20 rounded-xl px-4 py-3">
        <p className="text-xs font-semibold text-rl-cyan mb-1">🍰 Metodologia Bolo de Cenoura Fofinho</p>
        <p className="text-xs text-rl-muted">
          A palavra pesquisada pelo lead <span className="text-rl-text font-medium">aparece no título do anúncio</span> e espelha a <span className="text-rl-text font-medium">headline da landing page</span> — garantindo máxima relevância e Quality Score.
        </p>
      </div>

      {/* ── Form ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Keywords — full width, obrigatório */}
        <div className="sm:col-span-2">
          <label className="label-field">
            Palavras-chave semente
            <span className="ml-1 text-red-400 font-normal">*</span>
            <span className="ml-1 text-[10px] text-rl-muted font-normal normal-case">(obrigatório — uma por linha ou separadas por vírgula)</span>
          </label>
          <textarea
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            rows={3}
            className="input-field w-full text-sm resize-none"
            placeholder={'Ex: gestor de tráfego\ngestão de tráfego pago\ngerente de anúncios\nagência de tráfego'}
          />
          {keywords.trim() && (
            <p className="text-xs text-rl-green mt-1.5 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> {keywords.trim().split(/[\n,]/).filter((k) => k.trim()).length} palavra{keywords.trim().split(/[\n,]/).filter((k) => k.trim()).length !== 1 ? 's' : ''} semente adicionada{keywords.trim().split(/[\n,]/).filter((k) => k.trim()).length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Landing Page */}
        <div>
          <label className="label-field">URL ou descrição da Landing Page</label>
          <input
            value={landingPage}
            onChange={(e) => setLandingPage(e.target.value)}
            className="input-field w-full text-sm"
            placeholder="https://seusite.com.br/lp ou descreva: título, oferta, CTA..."
          />
        </div>

        {/* City */}
        <div>
          <label className="label-field">Cidade / Região de atuação</label>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="input-field w-full text-sm"
            placeholder="Ex: São Paulo, Belo Horizonte, Todo o Brasil..."
          />
        </div>

        {/* Main Offer */}
        <div>
          <label className="label-field">Diferencial / Oferta principal</label>
          <textarea
            value={mainOffer}
            onChange={(e) => setMainOffer(e.target.value)}
            rows={2}
            className="input-field w-full text-sm resize-none"
            placeholder="Ex: primeira consulta grátis, resultado em 30 dias, 10 anos de experiência..."
          />
        </div>

        {/* Objections */}
        <div>
          <label className="label-field">Objeções comuns dos clientes</label>
          <textarea
            value={objections}
            onChange={(e) => setObjections(e.target.value)}
            rows={2}
            className="input-field w-full text-sm resize-none"
            placeholder="Ex: é caro, não tenho tempo, já tentei e não funcionou..."
          />
        </div>
      </div>

      {/* ── Campaign Types ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="label-field mb-0">
            Campanhas a criar
            {campaignTypes.size > 0 && (
              <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rl-purple/20 text-rl-purple border border-rl-purple/30">
                {campaignTypes.size} selecionada{campaignTypes.size !== 1 ? 's' : ''}
              </span>
            )}
          </label>
          <div className="flex gap-2 text-xs text-rl-muted">
            <button
              onClick={() => setCampaignTypes(new Set(CAMPAIGN_TYPES.map((t) => t.id)))}
              className="hover:text-rl-purple transition-colors"
            >
              Todas
            </button>
            <span>·</span>
            <button onClick={() => setCampaignTypes(new Set())} className="hover:text-rl-purple transition-colors">
              Limpar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CAMPAIGN_TYPES.map((type) => {
            const selected = campaignTypes.has(type.id)
            return (
              <button
                key={type.id}
                onClick={() => toggleType(type.id)}
                className={`rounded-xl p-3 text-left transition-all border relative ${
                  selected
                    ? 'bg-rl-purple/10 border-rl-purple/50'
                    : 'bg-rl-surface border-rl-border text-rl-muted hover:border-rl-purple/30 hover:text-rl-text'
                }`}
              >
                {selected && (
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-rl-purple flex items-center justify-center">
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  </div>
                )}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{type.emoji}</span>
                  <span className={`text-xs font-bold pr-4 ${selected ? 'text-rl-purple' : 'text-rl-text'}`}>{type.label}</span>
                </div>
                <p className="text-[10px] text-rl-muted leading-snug line-clamp-2">{type.desc}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Custom Note ── */}
      <div>
        <label className="label-field mb-2">
          Instruções adicionais
          <span className="ml-2 text-[10px] text-rl-muted font-normal normal-case">(opcional)</span>
        </label>
        <textarea
          value={customNote}
          onChange={(e) => setCustomNote(e.target.value)}
          rows={2}
          className="input-field w-full text-sm resize-none"
          placeholder="Ex: não criar campanha de marca pois a empresa é nova, focar em buscas de alta intenção, incluir termos de urgência em todos os grupos..."
        />
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Generate Button ── */}
      {!result && (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={generate}
            disabled={!canGenerate || loading}
            className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando estrutura...</>
              : <><Sparkles className="w-4 h-4" /> Gerar Estrutura Google Ads</>
            }
          </button>
          {!keywords.trim() && !loading && (
            <p className="text-xs text-rl-muted">Preencha as palavras-chave semente para gerar</p>
          )}
          {!campaignTypes.size && keywords.trim() && !loading && (
            <p className="text-xs text-rl-muted">Selecione pelo menos um tipo de campanha</p>
          )}
          {canGenerate && !loading && (
            <p className="text-xs text-rl-muted">
              {selectedTypes.map((t) => t.label).join(' · ')}
            </p>
          )}
        </div>
      )}

      {/* ── Results ── */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-rl-cyan" />
              <span className="text-sm font-semibold text-rl-text">
                {selectedTypes.map((t) => `${t.emoji} ${t.label}`).join(' · ')}
              </span>
            </div>
            <button
              onClick={() => { setResult(null); generate() }}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Regerar
            </button>
          </div>

          <ResultBlock content={result} />

          <button
            onClick={() => setResult(null)}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            Alterar configurações
          </button>
        </div>
      )}

      {/* ── History ── */}
      <AdsHistory project={project} updateProject={updateProject} />
    </div>
  )
}
