import { useState, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { streamClaude } from '../lib/claude'
import { buildCachedPayload } from '../lib/buildContext'
import {
  Image, Video, Sparkles, Loader2, AlertTriangle,
  ChevronLeft, RotateCcw, Hash, CheckCircle2,
} from 'lucide-react'
import CreativeCard from './Criativos/CreativeCard'
import ResultBlock from './Criativos/ResultBlock'
import ContextPreview from './Criativos/ContextPreview'
import CreativeHistory from './Criativos/CreativeHistory'
import VideoGuide from './VideoGuide'

// ─── Ad Types ─────────────────────────────────────────────────────────────────
const AD_TYPES = [
  { id: 'clickbait',        label: 'Clickbait',         emoji: '🎣', desc: 'Título altamente intrigante relacionado ao público-alvo' },
  { id: 'sensacao',         label: 'Sensação',           emoji: '⚡', desc: 'Criação de sensações fortes para envolver o público' },
  { id: 'mito',             label: 'Mito',               emoji: '🏛️', desc: 'Anúncio em torno de um mito ou história cativante' },
  { id: 'dilema',           label: 'Dilema',             emoji: '⚖️', desc: 'Destaca um dilema que ressoa com o público' },
  { id: 'prova',            label: 'Prova',              emoji: '✅', desc: 'Evidências sólidas, resultados ou testemunhos' },
  { id: 'contraste',        label: 'Contraste',          emoji: '🔄', desc: 'Situação contrastante para gerar impacto visual' },
  { id: 'visual',           label: 'Visual',             emoji: '👁️', desc: 'Orientado por elementos visuais impactantes' },
  { id: 'oportunidade',     label: 'Oportunidade',       emoji: '🚀', desc: 'A oportunidade como ponto focal da mensagem' },
  { id: 'historia',         label: 'História',           emoji: '📖', desc: 'Narrativa envolvente que conecta ao produto' },
  { id: 'certo_errado',     label: 'Certo vs. Errado',   emoji: '🎯', desc: 'Comparação entre práticas certas e erradas' },
  { id: 'demonstracao',     label: 'Demonstração',       emoji: '🎬', desc: 'Demonstração direta do produto ou serviço' },
  { id: 'ultra_segmentado', label: 'Ultra Segmentado',   emoji: '🔍', desc: 'Altamente segmentado para um público específico' },
  { id: 'apelo_emocional',  label: 'Apelo Emocional',    emoji: '❤️', desc: 'Explora o apelo emocional do público-alvo' },
  { id: 'curiosidade',      label: 'Curiosidade',        emoji: '🤔', desc: 'Desperta a curiosidade irresistível do público' },
  { id: 'reflexao',         label: 'Reflexão',           emoji: '💭', desc: 'Provoca reflexão profunda no público' },
  { id: 'comparacao',       label: 'Comparação',         emoji: '📊', desc: 'Comparação relevante entre alternativas' },
  { id: 'problema_solucao', label: 'Problema e Solução', emoji: '🔧', desc: 'Apresenta um problema e revela a solução' },
  { id: 'explicacao',       label: 'Explicação',         emoji: '📋', desc: 'Explicação detalhada, educativa do produto/serviço' },
]

const QUANTITIES = [1, 2, 3, 5, 10]

// ─── System Prompts ───────────────────────────────────────────────────────────
const STATIC_SYSTEM = `Você é um especialista em copywriting para anúncios estáticos (imagens) em português brasileiro, usando a metodologia Revenue Lab / Laboratório de Anúncios.

O ponto mais importante no anúncio estático é a headline. Ela é responsável pelo CTR — uma headline fraca desperdiça todo o resto. Por isso, para cada anúncio gerado você deve entregar OBRIGATORIAMENTE 3 opções de headline + subheadline para teste.

A headline deve seguir a metodologia ADIG e tentar conter:
- Anunciar o público-alvo
- Dar um objetivo / resultado
- Indicar um intervalo de tempo (quando houver)
- Garantia ou palavra forte

Se não for possível encaixar todos os elementos na headline, priorize os mais importantes e coloque os demais na subheadline.

Use as informações de público-alvo, personas e oferta já fornecidas no contexto do cliente. Não gere análise de público — vá direto aos criativos.

Cada anúncio deve também contemplar os 4 elementos da fórmula de valor de Alex Hormozi: resultado do sonho, percepção de alcance desse resultado, tempo para alcançar e esforço/sacrifício envolvido.

Estrutura obrigatória de cada anúncio:

## ANÚNCIO [N]: [Tipo] | [Etapa do Funil]

**OPÇÃO 1 DE HEADLINE:** [headline — máx. 10 palavras]
**SUBHEADLINE 1:** [complementa, máx. 15 palavras]

**OPÇÃO 2 DE HEADLINE:** [variação com angulação diferente]
**SUBHEADLINE 2:** [complementa, máx. 15 palavras]

**OPÇÃO 3 DE HEADLINE:** [variação com angulação diferente]
**SUBHEADLINE 3:** [complementa, máx. 15 palavras]

**COPY COMPLEMENTAR:** (2-3 frases: benefício central, prova, urgência — use a Opção 1 como referência)
**CALL-TO-ACTION:** (ação direta e clara)
**ELEMENTOS VISUAIS SUGERIDOS:**
- Imagem: [descrição da imagem principal]
- Paleta de cores: [2-3 cores]
- Layout: [composição sugerida]

---

Tipos de mensagem por etapa do funil:
- TOPO DE FUNIL (Inconsciente do Problema): História/Depoimento, Quebra de Paradigma, Desejo/Visão Futura, Medo
- MEIO DE FUNIL (Consciente do Problema): O segredo X para Y, Problema/Solução
- FUNDO DE FUNIL (Consciente do Problema e da Solução): Promessa, Oferta

Diretrizes obrigatórias:
- Português brasileiro coloquial e persuasivo — evite palavras que a IA usa muito e que o ser humano não usa no dia a dia
- Fale diretamente com o público (use "você")
- Seja específico ao negócio, nunca genérico
- Anúncios estáticos não podem ter muito texto — mantenha o copy complementar enxuto
- Não use travessões (—) em nenhuma parte do output
- Separe cada anúncio com "---"`

const VIDEO_SYSTEM = `Você é um especialista em roteiros de vídeos de anúncios online de alta conversão, usando a estrutura do Laboratório de Anúncios (Revenue Lab).

Os vídeos têm duração entre 30 e 60 segundos e são criados para Meta Ads e YouTube Ads.

Use as informações de público-alvo, personas e oferta já fornecidas no contexto do cliente para personalizar cada roteiro. Não gere análise de público — vá direto aos roteiros.

Crie cada roteiro seguindo a ESTRUTURA DO LABORATÓRIO DE ANÚNCIOS (4 etapas):

## ROTEIRO [N]: Gancho: [Tipo] | [Etapa do Funil]

**GANCHO (0s – 3s):** [Tipo de gancho]
Fala/Texto: [frase exata: disruptiva, contra-intuitiva, que para o scroll]

**MENSAGEM (3s – 45s):** [Tipo: StoryTelling/Proclamação/Segredos/Problema-Solução/Promessa/Oferta]
Fala: [narração mostrando transformação do Ponto A → Ponto B, com quebra de objeção integrada naturalmente]

**CTA FINAL (45s – 60s)**
Fala: [reforça promessa + gatilho de escassez/urgência + ação clara]

**📝 LEGENDA DO POST:** [legenda com emojis]

---

Tipos de mensagem por funil:
- TOPO DE FUNIL (Inconsciente do Problema): StoryTelling, Proclamação
- MEIO DE FUNIL (Consciente do Problema): Segredos que ninguém te conta, Problema-Solução
- FUNDO DE FUNIL (Consciente do Problema e da Solução): Promessa, Oferta

Regras críticas:
- O GANCHO deve quebrar o padrão nos PRIMEIROS 3 SEGUNDOS. Seja contra-intuitivo
- A quebra de objeções deve estar INTEGRADA à mensagem (nunca separada)
- CTA com gatilho de escassez ou urgência específico
- Português brasileiro conversacional e energético
- Não use travessões (—) em nenhuma parte do output
- Não inclua sugestões de cena ou visual em nenhuma parte do roteiro
- Não use emojis no roteiro — use emojis apenas na LEGENDA DO POST
- Separe cada roteiro com "---"`

// ─── Main Component ────────────────────────────────────────────────────────────
export default function CriativosModule({ project }) {
  const { updateProject } = useApp()

  const [view,       setView]       = useState('select')   // 'select' | 'estaticos' | 'video'
  const [adTypes,    setAdTypes]    = useState(new Set())
  const [quantity,   setQuantity]   = useState(3)
  const [customNote, setCustomNote] = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)
  const [result,     setResult]     = useState(null)

  const isVideo      = view === 'video'
  const selectedList = AD_TYPES.filter((t) => adTypes.has(t.id))

  const toggleType = useCallback((id) => {
    setAdTypes((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const selectAll = () => setAdTypes(new Set(AD_TYPES.map((t) => t.id)))
  const clearAll  = () => setAdTypes(new Set())

  const buildInstruction = useCallback(() => {
    const typesStr = selectedList.map((t) => `${t.emoji} ${t.label}: ${t.desc}`).join('\n')
    const qtyLabel = `${quantity} ${isVideo ? 'roteiro' : 'anúncio'}${quantity !== 1 ? 's' : ''}`

    const customSection = customNote.trim()
      ? `\n## PERSONALIZAÇÃO / DIREÇÃO CRIATIVA\n${customNote.trim()}\n(Esta direção deve orientar e influenciar TODA a geração dos criativos acima.)\n`
      : ''

    if (isVideo) {
      return `${customSection}
---

## SOLICITAÇÃO

Crie exatamente **${qtyLabel}** de vídeo (30-60 segundos cada) para Meta Ads / YouTube Ads.

**Tipos de gancho a usar (distribua entre os roteiros):**
${typesStr}

Distribua os tipos de gancho entre os roteiros de forma equilibrada. Se houver mais roteiros do que tipos, repita os tipos com variações diferentes.

Use todas as informações do cliente acima para personalizar os roteiros ao máximo. Gere APENAS os roteiros — sem tabelas, sem resumos, sem insights ao final.`
    } else {
      return `${customSection}
---

## SOLICITAÇÃO

Crie exatamente **${qtyLabel}** estático${quantity !== 1 ? 's' : ''} para Meta Ads / Google Ads.

**Tipos de anúncio a usar (distribua entre os criativos):**
${typesStr}

Distribua os tipos entre os anúncios de forma equilibrada, cobrindo diferentes etapas do funil quando possível. Se houver mais anúncios do que tipos, crie variações do mesmo tipo.

Use todas as informações do cliente acima para personalizar ao máximo.`
    }
  }, [customNote, isVideo, quantity, selectedList])

  // ── Generate ────────────────────────────────────────────────────────────────
  const generate = useCallback(async () => {
    if (!adTypes.size) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const { system, messages } = buildCachedPayload({
        systemPrompt: isVideo ? VIDEO_SYSTEM : STATIC_SYSTEM,
        project,
        instruction: buildInstruction(),
      })
      const fullText = await streamClaude({
        model:      'claude-sonnet-4-5',
        max_tokens: 16000,
        system,
        messages,
        onChunk:    (text) => setResult(text),
      })

      // ── Save to project history ────────────────────────────────────────────
      const newCreative = {
        id:           crypto.randomUUID(),
        type:         isVideo ? 'video' : 'estatico',
        adTypes:      [...adTypes],
        adTypeLabels: selectedList.map((t) => t.label),
        quantity,
        customNote:   customNote.trim(),
        content:      fullText,
        rating:       null,
        createdAt:    new Date().toISOString(),
      }
      updateProject(project.id, {
        creatives: [...(project.creatives || []), newCreative],
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [adTypes, buildInstruction, customNote, isVideo, project, quantity, selectedList, updateProject])

  // ── View: Select format ────────────────────────────────────────────────────
  if (view === 'select') {
    return (
      <div className="space-y-6">
        <VideoGuide videoId="ZinesF_j2xU" label="Como usar o módulo de Criativos com IA" />

        <div>
          <h2 className="text-xl font-bold text-rl-text mb-1">Gerador de Criativos com IA</h2>
          <p className="text-sm text-rl-muted">Selecione o formato para gerar criativos usando os dados do cliente.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              key: 'estaticos',
              Icon: Image,
              color: 'rl-blue',
              title: 'Criativos Estáticos',
              desc: 'Headlines, copies e sugestões visuais para anúncios em imagem. Metodologia ADIG para Meta Ads e Google Ads.',
              tags: ['ADIG', 'Meta Ads', 'Google Ads', 'Headlines', 'Copy'],
            },
            {
              key: 'video',
              Icon: Video,
              color: 'rl-purple',
              title: 'Criativos de Vídeo',
              desc: 'Roteiros de 30-60s com Gancho, Mensagem, Quebra de Objeção e CTA. Laboratório de Anúncios.',
              tags: ['Reels', 'YouTube', 'Gancho', 'Roteiro', 'CTA'],
            },
          ].map(({ key, Icon, color, title, desc, tags }) => (
            <button
              key={key}
              onClick={() => { setView(key); setResult(null); setAdTypes(new Set()); setError(null) }}
              className={`glass-card p-6 text-left hover:border-${color}/50 hover:shadow-glow transition-all duration-200 group`}
            >
              <div className={`w-12 h-12 rounded-2xl bg-${color}/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <Icon className={`w-6 h-6 text-${color}`} />
              </div>
              <h3 className="text-base font-bold text-rl-text mb-1">{title}</h3>
              <p className="text-xs text-rl-muted leading-relaxed mb-4">{desc}</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span key={t} className={`text-[10px] px-2 py-0.5 rounded-full bg-${color}/10 text-${color} border border-${color}/20 font-medium`}>{t}</span>
                ))}
              </div>
            </button>
          ))}
        </div>

        <ContextPreview project={project} />

        {/* History visible in home view */}
        <CreativeHistory project={project} updateProject={updateProject} />
      </div>
    )
  }

  // ── View: Generator ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => { setView('select'); setResult(null); setAdTypes(new Set()); setError(null) }}
          aria-label="Voltar à seleção de formato"
          className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all mt-0.5"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            {isVideo ? <Video className="w-5 h-5 text-rl-purple" /> : <Image className="w-5 h-5 text-rl-blue" />}
            <h2 className="text-xl font-bold text-rl-text">{isVideo ? 'Criativos de Vídeo' : 'Criativos Estáticos'}</h2>
          </div>
          <p className="text-sm text-rl-muted mt-0.5 ml-7">
            Selecione um ou mais tipos e personalize a geração
          </p>
        </div>
      </div>

      {/* Quantity */}
      <div>
        <label className="label-field mb-3">Quantidade de criativos</label>
        <div className="flex gap-2 flex-wrap">
          {QUANTITIES.map((q) => (
            <button
              key={q}
              onClick={() => setQuantity(q)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all border ${
                quantity === q
                  ? 'bg-gradient-rl text-white border-transparent shadow-glow'
                  : 'bg-rl-surface text-rl-muted border-rl-border hover:text-rl-text hover:border-rl-purple/30'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Ad Type MULTI-select */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="label-field">
            Tipos de anúncio
            {adTypes.size > 0 && (
              <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rl-purple/20 text-rl-purple border border-rl-purple/30">
                {adTypes.size} selecionado{adTypes.size !== 1 ? 's' : ''}
              </span>
            )}
          </label>
          <div className="flex gap-2 text-xs text-rl-muted">
            <button onClick={selectAll} className="hover:text-rl-purple transition-colors">Selecionar todos</button>
            <span>·</span>
            <button onClick={clearAll}  className="hover:text-rl-purple transition-colors">Limpar</button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {AD_TYPES.map((type) => {
            const selected = adTypes.has(type.id)
            return (
              <button
                key={type.id}
                onClick={() => toggleType(type.id)}
                className={`rounded-xl p-3 text-left transition-all border relative ${
                  selected
                    ? 'bg-rl-purple/10 border-rl-purple/50 text-rl-purple'
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

      {/* Custom note */}
      <div>
        <label className="label-field mb-2">
          Personalização / Direção criativa
          <span className="ml-2 text-[10px] text-rl-muted font-normal normal-case">(opcional — influencia toda a geração)</span>
        </label>
        <textarea
          value={customNote}
          onChange={(e) => setCustomNote(e.target.value)}
          placeholder={isVideo
            ? 'Ex: "Foco no público feminino 30-45 anos. Tom mais emocional e acolhedor. Mencionar que o produto é importado. Evitar comparações com concorrentes..."'
            : 'Ex: "Campanha de lançamento — destacar desconto de 30% apenas essa semana. Público masculino jovem. Tom mais descontraído e direto..."'}
          rows={3}
          className="input-field w-full text-sm resize-none"
        />
        {customNote.trim() && (
          <p className="text-xs text-rl-green mt-1.5 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Direção criativa ativa — será aplicada na geração
          </p>
        )}
      </div>

      {/* Context preview */}
      <ContextPreview project={project} collapsed />

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Generate */}
      {!result && (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={generate}
            disabled={adTypes.size === 0 || loading}
            className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
              : <><Sparkles className="w-4 h-4" /> Gerar {quantity} {isVideo ? 'Roteiro' : 'Anúncio'}{quantity !== 1 ? 's' : ''}</>
            }
          </button>
          {adTypes.size === 0 && (
            <p className="text-xs text-rl-muted">Selecione pelo menos um tipo de anúncio</p>
          )}
          {adTypes.size > 0 && !loading && (
            <p className="text-xs text-rl-muted">
              {adTypes.size} tipo{adTypes.size > 1 ? 's' : ''} · {quantity} criativo{quantity !== 1 ? 's' : ''}
              {customNote.trim() ? ' · com direção personalizada' : ''}
            </p>
          )}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-rl-green" />
              <span className="text-sm font-semibold text-rl-text">
                {quantity} {isVideo ? 'roteiro' : 'criativo'}{quantity !== 1 ? 's' : ''} · {selectedList.map((t) => t.label).join(', ')}
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
            onClick={() => { setResult(null) }}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            Alterar configurações
          </button>
        </div>
      )}
    </div>
  )
}
