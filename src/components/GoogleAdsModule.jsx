import { useState, useCallback, useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { streamClaude } from '../lib/claude'
import { buildCachedPayload } from '../lib/buildContext'
import {
  Search, Sparkles, Loader2, AlertTriangle,
  RotateCcw, CheckCircle2, Plus, Trash2, ChevronDown, Save,
} from 'lucide-react'
import AdsHistory, { ResultBlock } from './GoogleAds/AdsHistory'

// ─── Campaign Types ────────────────────────────────────────────────────────────
const CAMPAIGN_TYPES = [
  { id: 'marca',        label: 'Marca / Brand',    emoji: '🏷️', desc: 'Protege sua marca e captura buscas diretas pelo nome' },
  { id: 'generico',     label: 'Genérico',          emoji: '🔍', desc: 'Termos genéricos do serviço — maior volume de buscas' },
  { id: 'concorrentes', label: 'Concorrentes',      emoji: '⚔️', desc: 'Nomes de concorrentes — captura quem busca alternativas' },
  { id: 'problema',     label: 'Problema / Dor',    emoji: '💊', desc: 'Termos de dor — topo de funil, intenção de resolver' },
]

const CONCORRENCIA_OPTIONS = ['Baixo', 'Médio', 'Alto']

const CONCORRENCIA_STYLE = {
  Baixo: 'text-rl-green  bg-rl-green/10  border-rl-green/30',
  Médio: 'text-rl-gold   bg-rl-gold/10   border-rl-gold/30',
  Alto:  'text-red-400   bg-red-400/10   border-red-400/30',
}

function newKeyword() {
  return { id: crypto.randomUUID(), keyword: '', buscas: '', concorrencia: 'Médio' }
}

function newGroup(index) {
  return { id: crypto.randomUUID(), name: `Grupo ${index + 1}`, keywords: [newKeyword()] }
}

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

// ─── Keyword Row ───────────────────────────────────────────────────────────────
function KeywordRow({ kw, onUpdate, onRemove, isOnly }) {
  return (
    <div className="grid grid-cols-[1fr_72px_32px] sm:grid-cols-[1fr_110px_130px_32px] gap-2 items-start sm:items-center">
      {/* Palavra-chave */}
      <input
        value={kw.keyword}
        onChange={(e) => onUpdate('keyword', e.target.value)}
        className="input-field text-sm h-8 px-2"
        placeholder="Ex: gestor de tráfego"
      />

      {/* Buscas/mês */}
      <input
        type="text"
        inputMode="numeric"
        value={kw.buscas}
        onChange={(e) => onUpdate('buscas', e.target.value.replace(/\D/g, ''))}
        className="input-field text-sm h-8 px-2 text-right"
        placeholder="Buscas"
        aria-label="Buscas/mês"
      />

      {/* Concorrência — no mobile vai pra próxima linha (col-span 2) */}
      <div className="relative col-span-2 sm:col-span-1 order-3 sm:order-none">
        <select
          value={kw.concorrencia}
          onChange={(e) => onUpdate('concorrencia', e.target.value)}
          className={`w-full h-8 pl-2 pr-6 text-xs font-semibold rounded-lg border appearance-none cursor-pointer ${CONCORRENCIA_STYLE[kw.concorrencia]}`}
          aria-label="Concorrência"
        >
          {CONCORRENCIA_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>Concorrência: {opt}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none opacity-60" />
      </div>

      {/* Remover */}
      <button
        onClick={onRemove}
        disabled={isOnly}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ─── Keyword Group Card ────────────────────────────────────────────────────────
function KeywordGroupCard({ group, index, onUpdateName, onAddKeyword, onRemoveKeyword, onUpdateKeyword, onRemoveGroup, canRemoveGroup }) {
  const filledCount = group.keywords.filter((k) => k.keyword.trim()).length

  return (
    <div className="bg-rl-surface border border-rl-border rounded-xl overflow-hidden">
      {/* Group Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-rl-card border-b border-rl-border">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs font-bold text-rl-muted shrink-0">#{index + 1}</span>
          <input
            value={group.name}
            onChange={(e) => onUpdateName(e.target.value)}
            className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-rl-text focus:outline-none placeholder:text-rl-muted/50"
            placeholder={`Grupo ${index + 1}`}
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {filledCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rl-cyan/10 text-rl-cyan border border-rl-cyan/20">
              {filledCount} palavra{filledCount !== 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={onRemoveGroup}
            disabled={!canRemoveGroup}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
            title="Remover grupo"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Table header — só visível em sm+ (no mobile cada row já tem placeholders/labels embutidos) */}
      <div className="hidden sm:grid grid-cols-[1fr_110px_130px_32px] gap-2 px-4 pt-3 pb-1.5">
        <span className="text-[10px] font-semibold text-rl-muted uppercase tracking-wide">Palavra-chave</span>
        <span className="text-[10px] font-semibold text-rl-muted uppercase tracking-wide text-right">Buscas/mês</span>
        <span className="text-[10px] font-semibold text-rl-muted uppercase tracking-wide">Concorrência</span>
        <span />
      </div>

      {/* Keywords */}
      <div className="px-4 pb-3 space-y-2">
        {group.keywords.map((kw) => (
          <KeywordRow
            key={kw.id}
            kw={kw}
            onUpdate={(field, value) => onUpdateKeyword(kw.id, field, value)}
            onRemove={() => onRemoveKeyword(kw.id)}
            isOnly={group.keywords.length === 1}
          />
        ))}

        {/* Add keyword */}
        <button
          onClick={onAddKeyword}
          className="flex items-center gap-1.5 text-xs text-rl-muted hover:text-rl-cyan transition-colors mt-2"
        >
          <Plus className="w-3.5 h-3.5" />
          Adicionar palavra-chave
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function GoogleAdsModule({ project }) {
  const { updateProject } = useApp()

  // ── Form state (restored from draft if it exists) ────────────────────────────
  const [keywordGroups, setKeywordGroups] = useState(() => {
    const draft = (project.googleAds || []).find((e) => e.isDraft)
    if (draft?.keywordGroups?.length > 0) return draft.keywordGroups
    const last = (project.googleAds || []).filter((e) => !e.isDraft).at(-1)
    if (last?.keywordGroups?.length > 0) return last.keywordGroups
    return [newGroup(0)]
  })
  const [campaignTypes, setCampaignTypes] = useState(() => {
    const draft = (project.googleAds || []).find((e) => e.isDraft)
    if (draft?.campaignTypes?.length > 0) return new Set(draft.campaignTypes)
    return new Set(['generico'])
  })
  const [customNote, setCustomNote] = useState(() => {
    const draft = (project.googleAds || []).find((e) => e.isDraft)
    return draft?.customNote || ''
  })

  // ── Generation state ─────────────────────────────────────────────────────────
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [result,    setResult]    = useState(null)
  const [saved,     setSaved]     = useState(false)
  const savedTimer                = useState(null)
  const draftTimer                = useRef(null)
  const isMounted                 = useRef(false)

  // ── Campaign type toggle ──────────────────────────────────────────────────────
  const toggleType = useCallback((id) => {
    setCampaignTypes((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  // ── Keyword Group helpers ─────────────────────────────────────────────────────
  function addGroup() {
    setKeywordGroups((prev) => [...prev, newGroup(prev.length)])
  }

  function removeGroup(groupId) {
    setKeywordGroups((prev) => prev.filter((g) => g.id !== groupId))
  }

  function updateGroupName(groupId, name) {
    setKeywordGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, name } : g))
  }

  function addKeyword(groupId) {
    setKeywordGroups((prev) => prev.map((g) =>
      g.id === groupId ? { ...g, keywords: [...g.keywords, newKeyword()] } : g
    ))
  }

  function removeKeyword(groupId, kwId) {
    setKeywordGroups((prev) => prev.map((g) =>
      g.id === groupId ? { ...g, keywords: g.keywords.filter((k) => k.id !== kwId) } : g
    ))
  }

  function updateKeyword(groupId, kwId, field, value) {
    setKeywordGroups((prev) => prev.map((g) =>
      g.id === groupId
        ? { ...g, keywords: g.keywords.map((k) => k.id === kwId ? { ...k, [field]: value } : k) }
        : g
    ))
  }

  // ── Auto-save draft ao alterar campos ────────────────────────────────────────
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return }
    clearTimeout(draftTimer.current)
    draftTimer.current = setTimeout(() => {
      const draft = {
        id:            crypto.randomUUID(),
        isDraft:       true,
        campaignTypes: [...campaignTypes],
        keywordGroups,
        customNote,
        createdAt:     new Date().toISOString(),
      }
      const nonDraft = (project.googleAds || []).filter((e) => !e.isDraft)
      updateProject(project.id, { googleAds: [...nonDraft, draft] })
      setSaved(true)
      clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setSaved(false), 2500)
    }, 1500)
    return () => clearTimeout(draftTimer.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keywordGroups, campaignTypes, customNote])

  // ── Save draft manual ─────────────────────────────────────────────────────────
  function handleSaveDraft() {
    clearTimeout(savedTimer.current)
    const draft = {
      id:            crypto.randomUUID(),
      isDraft:       true,
      campaignTypes: [...campaignTypes],
      keywordGroups,
      customNote,
      createdAt:     new Date().toISOString(),
    }
    const nonDraft = (project.googleAds || []).filter((e) => !e.isDraft)
    updateProject(project.id, { googleAds: [...nonDraft, draft] })
    setSaved(true)
    savedTimer.current = setTimeout(() => setSaved(false), 2500)
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const selectedTypes  = CAMPAIGN_TYPES.filter((t) => campaignTypes.has(t.id))
  const totalKeywords  = keywordGroups.reduce((acc, g) => acc + g.keywords.filter((k) => k.keyword.trim()).length, 0)
  const canGenerate    = campaignTypes.size > 0 && totalKeywords > 0

  // ── Build instruction for AI ──────────────────────────────────────────────────
  const buildInstruction = useCallback(() => {
    const typesStr = selectedTypes.map((t) => `${t.emoji} ${t.label}: ${t.desc}`).join('\n')
    const customSection = customNote.trim()
      ? `\n## INSTRUÇÕES ADICIONAIS\n${customNote.trim()}\n`
      : ''

    const groupsStr = keywordGroups
      .filter((g) => g.keywords.some((k) => k.keyword.trim()))
      .map((g) => {
        const header = `### Grupo: ${g.name || 'Sem nome'}\n| PALAVRA-CHAVE | BUSCAS/MÊS | CONCORRÊNCIA |\n|---|---|---|`
        const rows = g.keywords
          .filter((k) => k.keyword.trim())
          .map((k) => {
            const buscas = k.buscas ? Number(k.buscas).toLocaleString('pt-BR') : '—'
            return `| ${k.keyword} | ${buscas} | ${k.concorrencia} |`
          })
          .join('\n')
        return `${header}\n${rows}`
      })
      .join('\n\n')

    return `${customSection}## PALAVRAS-CHAVE COM VOLUME DE BUSCA E CONCORRÊNCIA

Use estes dados reais para criar clusters semânticos e estruturar as campanhas. Priorize palavras com maior volume e menor concorrência. Palavras com concorrência Alta exigem lances maiores — considere isso na estratégia de lance:

${groupsStr}

---

## CAMPANHAS A CRIAR

Crie a estrutura completa para as seguintes campanhas:
${typesStr}

Use as informações do CONTEXTO COMPLETO DO CLIENTE (empresa, produto, personas, oferta) em conjunto com os grupos de palavras-chave acima para criar anúncios altamente personalizados e relevantes. Aplique a metodologia Bolo de Cenoura Fofinho em todos os grupos de anúncios.`
  }, [keywordGroups, customNote, selectedTypes])

  // ── Generate ──────────────────────────────────────────────────────────────────
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
        max_tokens: 16000,
        system,
        messages,
        onChunk:    (text) => setResult(text),
      })

      const entry = {
        id:            crypto.randomUUID(),
        campaignTypes: [...campaignTypes],
        keywordGroups,
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
  }, [buildInstruction, campaignTypes, keywordGroups, project, updateProject])

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-rl-text mb-1">Google Ads — Estrutura de Campanhas</h2>
        <p className="text-sm text-rl-muted">
          Adicione os grupos de palavras-chave com volume e concorrência para gerar a estrutura completa de campanhas com RSAs e gatilhos emocionais.
        </p>
      </div>

      {/* Metodologia info */}
      <div className="bg-rl-cyan/5 border border-rl-cyan/20 rounded-xl px-4 py-3">
        <p className="text-xs font-semibold text-rl-cyan mb-1">🍰 Metodologia Bolo de Cenoura Fofinho</p>
        <p className="text-xs text-rl-muted">
          A palavra pesquisada pelo lead <span className="text-rl-text font-medium">aparece no título do anúncio</span> e espelha a <span className="text-rl-text font-medium">headline da landing page</span> — garantindo máxima relevância e Quality Score.
        </p>
      </div>

      {/* ── Keyword Groups ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="label-field mb-0">Grupos de Palavras-chave</label>
            {totalKeywords > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rl-green/10 text-rl-green border border-rl-green/20">
                {totalKeywords} palavra{totalKeywords !== 1 ? 's' : ''} · {keywordGroups.length} grupo{keywordGroups.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {keywordGroups.map((group, idx) => (
          <KeywordGroupCard
            key={group.id}
            group={group}
            index={idx}
            onUpdateName={(name) => updateGroupName(group.id, name)}
            onAddKeyword={() => addKeyword(group.id)}
            onRemoveKeyword={(kwId) => removeKeyword(group.id, kwId)}
            onUpdateKeyword={(kwId, field, value) => updateKeyword(group.id, kwId, field, value)}
            onRemoveGroup={() => removeGroup(group.id)}
            canRemoveGroup={keywordGroups.length > 1}
          />
        ))}

        <button
          onClick={addGroup}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-rl-border text-rl-muted hover:border-rl-cyan/40 hover:text-rl-cyan hover:bg-rl-cyan/5 transition-all text-sm w-full justify-center"
        >
          <Plus className="w-4 h-4" />
          Adicionar Grupo
        </button>
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

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Save + Generate Buttons */}
      {!result && (
        <div className="space-y-3">
          {/* Save draft */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveDraft}
              disabled={loading}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                saved
                  ? 'bg-rl-green/10 border-rl-green/40 text-rl-green'
                  : 'bg-rl-surface border-rl-border text-rl-muted hover:border-rl-cyan/40 hover:text-rl-cyan'
              }`}
            >
              {saved
                ? <><CheckCircle2 className="w-4 h-4" /> Configurações salvas!</>
                : <><Save className="w-4 h-4" /> Salvar configurações</>
              }
            </button>
            <span className="text-[10px] text-rl-muted">Salva grupos e tipos sem gerar</span>
          </div>

          {/* Generate */}
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
            {totalKeywords === 0 && !loading && (
              <p className="text-xs text-rl-muted">Adicione pelo menos uma palavra-chave para gerar</p>
            )}
            {!campaignTypes.size && totalKeywords > 0 && !loading && (
              <p className="text-xs text-rl-muted">Selecione pelo menos um tipo de campanha</p>
            )}
            {canGenerate && !loading && (
              <p className="text-xs text-rl-muted">
                {selectedTypes.map((t) => t.label).join(' · ')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Results */}
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

      {/* History */}
      <AdsHistory project={project} updateProject={updateProject} />
    </div>
  )
}
