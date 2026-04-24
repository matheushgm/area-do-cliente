import { useState, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { streamClaude } from '../lib/claude'
import {
  Target, Sparkles, Loader2, Plus, X, Users, Package,
  CheckCircle2, Copy, CheckCheck, ChevronRight, AlertCircle,
} from 'lucide-react'

// ─── Skill: Criador de Headlines e Subheadlines ───────────────────────────────

const HEADLINE_SYSTEM = `Você é um especialista em copywriting de resposta direta com domínio completo da metodologia de Alex Hormozi ($100M Offers) aplicada à criação de headlines e subheadlines para páginas de captura, eventos, webinars e landing pages no mercado brasileiro B2B e B2C.

## FUNDAMENTO CENTRAL

Uma headline não vende o produto. Ela vende uma transformação específica para uma pessoa específica em um prazo específico.

Se for genérica, o lead não se reconhece. Se for vaga no resultado, ele não sente urgência. Se não tiver prazo ou prova, ele não acredita.

## A EQUAÇÃO DE VALOR (Hormozi)

Valor = (Sonho Desejado x Probabilidade Percebida) / (Tempo x Esforço)

Para MAXIMIZAR o valor percebido na headline:
- Sonho: Resultado específico e vívido. Ex: "reuniões qualificadas todos os dias" > "mais leads"
- Probabilidade: Prova social, número de casos, método nomeado. Ex: "validado em 40 empresas de SaaS B2B"
- Tempo: Prazo concreto e curto. Ex: "em até 60 dias"
- Esforço: Removedores de objeção específicos do avatar. Ex: "sem contratar mais vendedor"

Regra de ouro: Se você zerar o tempo e o esforço percebido, o valor se torna infinito.

## OS 3 ÂNGULOS DE HEADLINE

### Ângulo 1 - Dor Percebida
A pessoa já sente e sabe nomear o problema. A headline espelha exatamente o que ela fala na vida real.
Indicado para: topo de funil, anúncio frio, lead que ainda não conhece a solução.

### Ângulo 2 - Sonho Desejado
A pessoa sabe o que quer mas não sabe como chegar lá. A headline entrega o destino de forma vívida e específica.
Indicado para: lead que já reconhece o problema e está buscando solução.

### Ângulo 3 - Curiosidade + Mecanismo Único
A pessoa não sabe que existe um método diferente do que ela tentou. A headline sugere que há algo novo.
Indicado para: lead que já tentou outras soluções e não teve resultado.

## ESTRUTURA DAS 4 CAMADAS DA HEADLINE

[Verbo de abertura] + [Avatar + Situação atual] + [Resultado + Prazo] + [Removedores de objeção]

- Camada 1 - Verbo de abertura: Saiba como / Descubra / Veja como / Como / Aprenda / Pare de
- Camada 2 - Avatar + Situação atual: segmento específico, tamanho de empresa, situação atual
- Camada 3 - Resultado desejado + Prazo: resultado mensurável + prazo concreto
- Camada 4 - Removedores de objeção: antecipe os 3 maiores medos e remova-os explicitamente

## ESTRUTURA DA SUBHEADLINE

A subheadline não repete a headline. Ela sustenta a crença respondendo 3 perguntas:
1. Como eu sei que funciona? (Prova social, número de casos, metodologia nomeada)
2. Como funciona na prática? (Passo a passo, sistema, método com nome)
3. Funciona pra mim especificamente? (Espelha o contexto exato do avatar)

Fórmula: [Prova social com número] + [Como funciona / mecanismo] + [Especificidade do avatar] + [Prazo]

## FLUXO DE EXECUÇÃO

Gere exatamente 10 headlines distribuídas pelos 3 ângulos:
- 4 headlines com Ângulo de Dor Percebida
- 3 headlines com Ângulo de Sonho Desejado
- 3 headlines com Ângulo de Curiosidade + Mecanismo Único

Para cada headline aplique obrigatoriamente as 4 camadas e crie uma subheadline complementar.

Ao final apresente uma tabela mostrando qual dor/resultado cada opção trabalha, qual ângulo foi usado e quais objeções foram removidas.

## REGRAS DE ESCRITA

- Nunca use travessão. Substitua por vírgula ou ponto e vírgula
- Linguagem direta, sem adjetivos vazios como "incrível", "revolucionário", "transformador"
- Números específicos batem números redondos: "43 empresas" > "dezenas de empresas"
- Prazos sempre em "até X dias". Nunca "rapidamente" ou "em pouco tempo"
- Removedores de objeção sempre começam com "sem": "sem contratar", "sem aumentar", "sem depender"
- Escreva como o avatar fala, não como um copywriter escreve

## FORMATO DO OUTPUT

Para cada headline use exatamente este formato:

## HEADLINE [N] — [ÂNGULO]

**Headline:**
[texto]

**Subheadline:**
[texto]

**Dor/Resultado trabalhado:** [resumo]
**Objeções removidas:** [lista]

---`

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Tag({ text, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-rl-purple/10 border border-rl-purple/20 text-rl-purple font-medium">
      {text}
      {onRemove && (
        <button onClick={onRemove} className="ml-0.5 text-rl-purple/60 hover:text-rl-purple transition-colors">
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  )
}

function AddItemRow({ value, onChange, onAdd, placeholder }) {
  return (
    <div className="flex gap-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onAdd()}
        placeholder={placeholder}
        className="flex-1 rounded-lg border border-rl-border bg-rl-surface/60 px-3 py-2 text-xs text-rl-text placeholder:text-rl-muted/60 focus:outline-none focus:border-rl-purple/50 focus:ring-1 focus:ring-rl-purple/20 transition-colors"
      />
      <button
        onClick={onAdd}
        disabled={!value.trim()}
        className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-rl-purple/10 border border-rl-purple/25 text-rl-purple hover:bg-rl-purple/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        <Plus className="w-3.5 h-3.5" />
        Adicionar
      </button>
    </div>
  )
}

// ─── Result renderer ──────────────────────────────────────────────────────────

function HeadlineCard({ block, index }) {
  const [copied, setCopied] = useState(false)

  // Parse headline and subheadline from block
  const headlineMatch  = block.match(/\*\*Headline:\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/m)
  const subMatch       = block.match(/\*\*Subheadline:\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/m)
  const dorMatch       = block.match(/\*\*Dor\/Resultado trabalhado:\*\*\s*(.*)/m)
  const objMatch       = block.match(/\*\*Objeções removidas:\*\*\s*(.*)/m)
  const titleMatch     = block.match(/^##\s+HEADLINE\s+\d+\s*[—-]\s*(.+)/im)

  const headline  = headlineMatch?.[1]?.trim() || ''
  const sub       = subMatch?.[1]?.trim()       || ''
  const dor       = dorMatch?.[1]?.trim()        || ''
  const obj       = objMatch?.[1]?.trim()        || ''
  const angle     = titleMatch?.[1]?.trim()      || ''

  function handleCopy() {
    const text = `${headline}\n\n${sub}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!headline && !sub) {
    // Fallback: show raw block
    return (
      <div className="glass-card p-4 text-xs text-rl-muted whitespace-pre-wrap leading-relaxed">{block}</div>
    )
  }

  return (
    <div className="glass-card p-5 border border-rl-border/60">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-rl-muted uppercase tracking-wider">Headline {index + 1}</span>
          {angle && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rl-purple/10 border border-rl-purple/20 text-rl-purple font-semibold">
              {angle}
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-rl-surface text-rl-muted hover:text-rl-purple transition-all shrink-0"
        >
          {copied ? <CheckCheck className="w-3 h-3 text-rl-green" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copiado!' : 'Copiar'}
        </button>
      </div>

      {headline && (
        <div className="mb-3">
          <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wider mb-1">Headline</p>
          <p className="text-sm font-semibold text-rl-text leading-relaxed">{headline}</p>
        </div>
      )}

      {sub && (
        <div className="mb-3">
          <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wider mb-1">Subheadline</p>
          <p className="text-sm text-rl-text leading-relaxed">{sub}</p>
        </div>
      )}

      {(dor || obj) && (
        <div className="mt-3 pt-3 border-t border-rl-border/40 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {dor && (
            <div>
              <p className="text-[9px] font-bold text-rl-muted uppercase tracking-wider mb-0.5">Dor/Resultado</p>
              <p className="text-[11px] text-rl-muted">{dor}</p>
            </div>
          )}
          {obj && (
            <div>
              <p className="text-[9px] font-bold text-rl-muted uppercase tracking-wider mb-0.5">Objeções removidas</p>
              <p className="text-[11px] text-rl-muted">{obj}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ResultBlock({ content }) {
  const [allCopied, setAllCopied] = useState(false)

  function copyAll() {
    navigator.clipboard.writeText(content)
    setAllCopied(true)
    setTimeout(() => setAllCopied(false), 2000)
  }

  // Split by '---' separators, filter blocks that have ## HEADLINE
  const rawBlocks = content.split(/\n---\n/).map(b => b.trim()).filter(Boolean)
  const headlineBlocks = rawBlocks.filter(b => /^##\s+HEADLINE/im.test(b))
  const otherBlocks    = rawBlocks.filter(b => !/^##\s+HEADLINE/im.test(b))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-rl-muted">
          {headlineBlocks.length} headline{headlineBlocks.length !== 1 ? 's' : ''} gerada{headlineBlocks.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={copyAll}
          className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all"
        >
          {allCopied ? <CheckCheck className="w-3.5 h-3.5 text-rl-green" /> : <Copy className="w-3.5 h-3.5" />}
          {allCopied ? 'Tudo copiado!' : 'Copiar tudo'}
        </button>
      </div>

      {headlineBlocks.map((block, i) => (
        <HeadlineCard key={i} block={block} index={i} />
      ))}

      {/* Tabela final / blocos extras */}
      {otherBlocks.length > 0 && (
        <div className="glass-card p-4">
          <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wider mb-3">Mapa de Cobertura</p>
          <div className="text-xs text-rl-muted whitespace-pre-wrap leading-relaxed">
            {otherBlocks.join('\n\n')}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PromessaModule({ project }) {
  const { updateProject } = useApp()

  const personas = project.personas || []
  const produtos  = project.produtos  || []

  const [selectedPersonaId,  setSelectedPersonaId]  = useState(personas[0]?.id || null)
  const [selectedProdutoIds, setSelectedProdutoIds] = useState(new Set(produtos.slice(0, 1).map(p => p.id)))
  const [newSinal,            setNewSinal]           = useState('')
  const [newResultado,        setNewResultado]       = useState('')
  const [loading,             setLoading]            = useState(false)
  const [result,              setResult]             = useState(() => project.promessa?.result || null)
  const [error,               setError]              = useState(null)

  const activePersona    = personas.find(p => p.id === selectedPersonaId)
  const sinais           = (activePersona?.answers?.sinais    || []).filter(Boolean)
  const resultados       = (activePersona?.answers?.resultado || []).filter(Boolean)
  const selectedProdutos = produtos.filter(p => selectedProdutoIds.has(p.id))

  const canGenerate = !!selectedPersonaId
    && (sinais.length > 0 || resultados.length > 0)
    && selectedProdutoIds.size > 0

  // ── Sync helpers ────────────────────────────────────────────────────────────

  const patchPersona = useCallback((personaId, field, newArr) => {
    const updated = personas.map(p =>
      p.id === personaId
        ? { ...p, answers: { ...p.answers, [field]: newArr } }
        : p
    )
    updateProject(project.id, { personas: updated })
  }, [personas, project.id, updateProject])

  function addSinal() {
    const trimmed = newSinal.trim()
    if (!trimmed || !activePersona) return
    patchPersona(selectedPersonaId, 'sinais', [...sinais, trimmed])
    setNewSinal('')
  }

  function removeSinal(idx) {
    patchPersona(selectedPersonaId, 'sinais', sinais.filter((_, i) => i !== idx))
  }

  function addResultado() {
    const trimmed = newResultado.trim()
    if (!trimmed || !activePersona) return
    patchPersona(selectedPersonaId, 'resultado', [...resultados, trimmed])
    setNewResultado('')
  }

  function removeResultado(idx) {
    patchPersona(selectedPersonaId, 'resultado', resultados.filter((_, i) => i !== idx))
  }

  function toggleProduto(id) {
    setSelectedProdutoIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Generate ────────────────────────────────────────────────────────────────

  const generate = useCallback(async () => {
    if (!canGenerate) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const produtoInfo = selectedProdutos.map(p => {
        const lines = Object.entries(p.answers || {})
          .filter(([, v]) => v?.trim())
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n')
        return `Produto/Serviço: ${p.nome || 'Sem nome'} (${p.tipo === 'servico' ? 'Serviço' : 'Produto'})\n${lines}`
      }).join('\n\n')

      const instruction = `Empresa: ${project.companyName || ''}
Segmento: ${project.businessType || ''}
Persona: ${activePersona?.name || 'Persona principal'}

PRODUTO / SERVIÇO:
${produtoInfo || 'Não informado'}

SINAIS DO PROBLEMA que o cliente percebe (o que faz ele buscar solução):
${sinais.map((s, i) => `${i + 1}. ${s}`).join('\n') || 'Não informado'}

RESULTADO PERCEBIDO que o cliente espera alcançar:
${resultados.map((r, i) => `${i + 1}. ${r}`).join('\n') || 'Não informado'}

Com base nessas informações, crie 10 headlines e subheadlines seguindo todas as instruções do sistema.`

      const fullText = await streamClaude({
        model:      'claude-sonnet-4-5',
        max_tokens: 8000,
        system:     HEADLINE_SYSTEM,
        messages:   [{ role: 'user', content: instruction }],
        onChunk:    (text) => setResult(text.replace(/—/g, '-')),
      })

      const cleanText = fullText.replace(/—/g, '-')
      setResult(cleanText)
      updateProject(project.id, {
        promessa: { result: cleanText, savedAt: new Date().toISOString() },
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [canGenerate, selectedProdutos, activePersona, project, sinais, resultados])

  // ── Render ───────────────────────────────────────────────────────────────────

  if (!personas.length) {
    return (
      <div className="glass-card p-8 text-center">
        <Users className="w-10 h-10 text-rl-muted mx-auto mb-3" />
        <p className="text-sm font-semibold text-rl-text mb-1">Nenhuma persona cadastrada</p>
        <p className="text-xs text-rl-muted">Cadastre pelo menos uma persona na seção "Personas" antes de criar sua promessa.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-rl-text flex items-center gap-2">
          <Target className="w-5 h-5 text-rl-purple" />
          Criação de Promessa
        </h2>
        <p className="text-sm text-rl-muted mt-0.5">
          Gere headlines e subheadlines de alta conversão baseadas nos sinais do problema e no resultado percebido da sua persona
        </p>
      </div>

      {/* ── Step 1: Persona + Produtos ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Persona */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-rl-blue/10 flex items-center justify-center shrink-0">
              <Users className="w-3.5 h-3.5 text-rl-blue" />
            </div>
            <div>
              <p className="text-xs font-bold text-rl-text">Persona</p>
              <p className="text-[10px] text-rl-muted">Selecione qual persona será usada como base</p>
            </div>
          </div>
          <div className="space-y-1.5">
            {personas.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPersonaId(p.id)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                  selectedPersonaId === p.id
                    ? 'bg-rl-blue/10 border-rl-blue/35 text-rl-blue'
                    : 'bg-rl-surface border-rl-border text-rl-muted hover:border-rl-blue/25 hover:text-rl-text'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                  selectedPersonaId === p.id ? 'border-rl-blue' : 'border-rl-border'
                }`}>
                  {selectedPersonaId === p.id && <div className="w-2.5 h-2.5 rounded-full bg-rl-blue" />}
                </div>
                {p.name || `Persona ${personas.indexOf(p) + 1}`}
              </button>
            ))}
          </div>
        </div>

        {/* Produtos */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-rl-gold/10 flex items-center justify-center shrink-0">
              <Package className="w-3.5 h-3.5 text-rl-gold" />
            </div>
            <div>
              <p className="text-xs font-bold text-rl-text">Produto / Serviço</p>
              <p className="text-[10px] text-rl-muted">Selecione os produtos a serem usados como contexto</p>
            </div>
          </div>
          {produtos.length === 0 ? (
            <p className="text-xs text-rl-muted/70 italic">Nenhum produto cadastrado. Adicione em "Produto / Serviço".</p>
          ) : (
            <div className="space-y-1.5">
              {produtos.map(p => (
                <button
                  key={p.id}
                  onClick={() => toggleProduto(p.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                    selectedProdutoIds.has(p.id)
                      ? 'bg-rl-gold/10 border-rl-gold/35 text-rl-gold'
                      : 'bg-rl-surface border-rl-border text-rl-muted hover:border-rl-gold/25 hover:text-rl-text'
                  }`}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                    selectedProdutoIds.has(p.id) ? 'border-rl-gold bg-rl-gold' : 'border-rl-border'
                  }`}>
                    {selectedProdutoIds.has(p.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                  <span className="flex-1 truncate">{p.nome || `Produto ${produtos.indexOf(p) + 1}`}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-rl-surface border border-rl-border text-rl-muted">
                    {p.tipo === 'servico' ? 'Serviço' : 'Produto'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Step 2: Sinais do Problema ─────────────────────────────────────── */}
      <div className="glass-card p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-7 h-7 rounded-lg bg-rl-gold/10 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-sm">🔍</span>
          </div>
          <div>
            <p className="text-xs font-bold text-rl-text">Sinais do Problema</p>
            <p className="text-[10px] text-rl-muted mt-0.5">
              O que seu cliente percebe e o faz buscar uma solução
              {activePersona && <span className="text-rl-blue ml-1">· da persona "{activePersona.name}"</span>}
            </p>
          </div>
        </div>

        {!activePersona ? (
          <p className="text-xs text-rl-muted/70 italic">Selecione uma persona acima para ver os sinais.</p>
        ) : (
          <>
            {sinais.length === 0 && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-rl-gold/5 border border-rl-gold/20">
                <AlertCircle className="w-3.5 h-3.5 text-rl-gold shrink-0" />
                <p className="text-[11px] text-rl-gold">Nenhum sinal cadastrado ainda. Adicione abaixo ou preencha na seção "Personas".</p>
              </div>
            )}

            {sinais.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {sinais.map((s, i) => (
                  <Tag key={i} text={s} onRemove={() => removeSinal(i)} />
                ))}
              </div>
            )}

            <AddItemRow
              value={newSinal}
              onChange={setNewSinal}
              onAdd={addSinal}
              placeholder="Ex: Gasto muito em anúncio e não vejo retorno..."
            />
            <p className="text-[10px] text-rl-muted mt-1.5">
              Ao adicionar, o sinal é salvo automaticamente na persona selecionada.
            </p>
          </>
        )}
      </div>

      {/* ── Step 3: Resultado Percebido ────────────────────────────────────── */}
      <div className="glass-card p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-7 h-7 rounded-lg bg-rl-green/10 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-sm">🎯</span>
          </div>
          <div>
            <p className="text-xs font-bold text-rl-text">Resultado Percebido</p>
            <p className="text-[10px] text-rl-muted mt-0.5">
              O que seu cliente espera alcançar após usar seu produto ou serviço
              {activePersona && <span className="text-rl-blue ml-1">· da persona "{activePersona.name}"</span>}
            </p>
          </div>
        </div>

        {!activePersona ? (
          <p className="text-xs text-rl-muted/70 italic">Selecione uma persona acima para ver os resultados.</p>
        ) : (
          <>
            {resultados.length === 0 && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-rl-gold/5 border border-rl-gold/20">
                <AlertCircle className="w-3.5 h-3.5 text-rl-gold shrink-0" />
                <p className="text-[11px] text-rl-gold">Nenhum resultado cadastrado ainda. Adicione abaixo ou preencha na seção "Personas".</p>
              </div>
            )}

            {resultados.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {resultados.map((r, i) => (
                  <Tag key={i} text={r} onRemove={() => removeResultado(i)} color="green" />
                ))}
              </div>
            )}

            <AddItemRow
              value={newResultado}
              onChange={setNewResultado}
              onAdd={addResultado}
              placeholder="Ex: Ter previsibilidade de leads sem depender de indicação..."
            />
            <p className="text-[10px] text-rl-muted mt-1.5">
              Ao adicionar, o resultado é salvo automaticamente na persona selecionada.
            </p>
          </>
        )}
      </div>

      {/* ── Checklist de prontidão ─────────────────────────────────────────── */}
      <div className="glass-card p-4">
        <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wider mb-3">Pronto para gerar</p>
        <div className="space-y-1.5">
          {[
            { ok: !!selectedPersonaId,           label: 'Persona selecionada' },
            { ok: selectedProdutoIds.size > 0,   label: 'Produto / serviço selecionado' },
            { ok: sinais.length > 0,             label: `Sinais do problema (${sinais.length} cadastrado${sinais.length !== 1 ? 's' : ''})` },
            { ok: resultados.length > 0,         label: `Resultados percebidos (${resultados.length} cadastrado${resultados.length !== 1 ? 's' : ''})` },
          ].map(({ ok, label }) => (
            <div key={label} className="flex items-center gap-2">
              <CheckCircle2 className={`w-4 h-4 shrink-0 transition-colors ${ok ? 'text-rl-green' : 'text-rl-border'}`} />
              <span className={`text-xs transition-colors ${ok ? 'text-rl-text' : 'text-rl-muted'}`}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Generate Button ────────────────────────────────────────────────── */}
      <button
        onClick={generate}
        disabled={!canGenerate || loading}
        className={`w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-sm font-bold transition-all border ${
          canGenerate && !loading
            ? 'bg-rl-purple hover:bg-rl-purple/90 border-rl-purple/30 text-white shadow-md hover:shadow-lg'
            : 'bg-rl-surface border-rl-border text-rl-muted cursor-not-allowed'
        }`}
      >
        {loading
          ? <><Loader2 className="w-4 h-4 animate-spin" />Gerando headlines...</>
          : <><Sparkles className="w-4 h-4" />Gerar Headlines e Subheadlines</>
        }
      </button>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-400/10 border border-red-400/25">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* ── Result ────────────────────────────────────────────────────────── */}
      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-rl-purple" />
            <h3 className="text-sm font-bold text-rl-text">Headlines Geradas</h3>
          </div>
          {loading
            ? (
              <div className="glass-card p-5 text-xs text-rl-muted whitespace-pre-wrap leading-relaxed">
                {result}
              </div>
            )
            : <ResultBlock content={result} />
          }
        </div>
      )}
    </div>
  )
}
