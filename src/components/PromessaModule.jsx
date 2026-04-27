import { useState, useCallback, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { streamClaude } from '../lib/claude'
import {
  Target, Sparkles, Loader2, Plus, X, Users, Package,
  CheckCircle2, Copy, CheckCheck, ChevronRight, AlertCircle,
  FileText, Pencil, Check, Trash2, RefreshCw,
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

function HeadlineCard({ block, index, editedData, onSaveEdit, onDelete, onRegenerate }) {
  const [copied,          setCopied]          = useState(false)
  const [isEditing,       setIsEditing]       = useState(false)
  const [confirmDelete,   setConfirmDelete]   = useState(false)
  const [isRegenerating,  setIsRegenerating]  = useState(false)
  const [streamText,      setStreamText]      = useState('')
  const [regenError,      setRegenError]      = useState(null)
  const [editHeadline,    setEditHeadline]    = useState('')
  const [editSub,         setEditSub]         = useState('')

  // Parse original markdown
  const headlineMatch = block.match(/\*\*Headline:\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/m)
  const subMatch      = block.match(/\*\*Subheadline:\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/m)
  const dorMatch      = block.match(/\*\*Dor\/Resultado trabalhado:\*\*\s*(.*)/m)
  const objMatch      = block.match(/\*\*Objeções removidas:\*\*\s*(.*)/m)
  const titleMatch    = block.match(/^##\s+HEADLINE\s+\d+\s*[—-]\s*(.+)/im)

  const parsedHeadline = headlineMatch?.[1]?.trim() || ''
  const parsedSub      = subMatch?.[1]?.trim()      || ''
  const dor            = dorMatch?.[1]?.trim()       || ''
  const obj            = objMatch?.[1]?.trim()       || ''
  const angle          = titleMatch?.[1]?.trim()     || ''

  // Apply saved edits on top of parsed values
  const displayHeadline = editedData?.headline !== undefined ? editedData.headline : parsedHeadline
  const displaySub      = editedData?.sub      !== undefined ? editedData.sub      : parsedSub
  const wasEdited       = editedData?.headline !== undefined || editedData?.sub !== undefined

  function handleCopy() {
    navigator.clipboard.writeText(`${displayHeadline}\n\n${displaySub}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function startEdit() {
    setEditHeadline(displayHeadline)
    setEditSub(displaySub)
    setIsEditing(true)
  }

  function saveEdit() {
    onSaveEdit(index, { headline: editHeadline, sub: editSub })
    setIsEditing(false)
  }

  function cancelEdit() {
    setIsEditing(false)
  }

  function handleDelete() {
    if (confirmDelete) {
      onDelete(index)
    } else {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
    }
  }

  async function handleRegenerate() {
    setIsRegenerating(true)
    setStreamText('')
    setRegenError(null)
    setIsEditing(false)
    try {
      await onRegenerate(index, angle, (chunk) => setStreamText(chunk.replace(/—/g, '-')))
    } catch (e) {
      setRegenError(e.message || 'Erro ao regenerar.')
    } finally {
      setIsRegenerating(false)
      setStreamText('')
    }
  }

  if (!parsedHeadline && !parsedSub) {
    return (
      <div className="glass-card p-4 text-xs text-rl-muted whitespace-pre-wrap leading-relaxed">{block}</div>
    )
  }

  const busy = isEditing || isRegenerating

  return (
    <div className={`glass-card p-5 border transition-all ${
      isRegenerating ? 'border-rl-purple/60 shadow-lg shadow-rl-purple/10'
      : isEditing     ? 'border-rl-purple/50 shadow-md'
      : 'border-rl-border/60'
    }`}>
      {/* ── Header row ── */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-rl-muted uppercase tracking-wider">
            Headline {index + 1}
          </span>
          {angle && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rl-purple/10 border border-rl-purple/20 text-rl-purple font-semibold">
              {angle}
            </span>
          )}
          {wasEdited && !isEditing && !isRegenerating && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rl-gold/10 border border-rl-gold/20 text-rl-gold font-semibold">
              Editada
            </span>
          )}
          {isRegenerating && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rl-purple/10 border border-rl-purple/20 text-rl-purple font-semibold flex items-center gap-1">
              <Loader2 className="w-2.5 h-2.5 animate-spin" /> Gerando...
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isEditing ? (
            <>
              <button
                onClick={saveEdit}
                className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg bg-rl-purple text-white font-semibold hover:bg-rl-purple/90 transition-all"
              >
                <Check className="w-3 h-3" /> Salvar
              </button>
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all"
              >
                <X className="w-3 h-3" /> Cancelar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleRegenerate}
                disabled={busy}
                title="Gerar nova versão com IA"
                className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-rl-purple/10 border border-rl-purple/20 text-rl-purple hover:bg-rl-purple/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <RefreshCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                {isRegenerating ? 'Gerando...' : 'Refazer com IA'}
              </button>
              <button
                onClick={startEdit}
                disabled={busy}
                className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-rl-surface text-rl-muted hover:text-rl-purple hover:bg-rl-purple/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <Pencil className="w-3 h-3" /> Editar
              </button>
              <button
                onClick={handleCopy}
                disabled={busy}
                className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-rl-surface text-rl-muted hover:text-rl-text disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {copied ? <CheckCheck className="w-3 h-3 text-rl-green" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
              <button
                onClick={handleDelete}
                disabled={busy}
                className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  confirmDelete
                    ? 'bg-red-500 text-white font-semibold hover:bg-red-600'
                    : 'bg-rl-surface text-rl-muted hover:text-red-400 hover:bg-red-50/10'
                }`}
              >
                <Trash2 className="w-3 h-3" />
                {confirmDelete ? 'Confirmar?' : 'Excluir'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Regenerating: streaming preview ── */}
      {isRegenerating && (
        <div className="space-y-3 mb-2">
          <div className="px-4 py-3.5 rounded-xl border border-rl-purple/20 bg-rl-purple/5 min-h-[80px]">
            {streamText ? (
              <p className="text-xs text-rl-muted whitespace-pre-wrap leading-relaxed font-mono">{streamText}</p>
            ) : (
              <div className="flex items-center gap-2 text-xs text-rl-muted/60 h-full">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-rl-purple" />
                Conectando à IA...
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Headline field (hidden during regen) ── */}
      {!isRegenerating && (
        <div className="mb-3">
          <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wider mb-1.5">Headline</p>
          {isEditing ? (
            <textarea
              value={editHeadline}
              onChange={(e) => setEditHeadline(e.target.value)}
              rows={3}
              autoFocus
              className="w-full px-3 py-2.5 rounded-xl border border-rl-purple/40 bg-rl-surface/60 text-sm font-semibold text-rl-text outline-none resize-none focus:border-rl-purple focus:ring-1 focus:ring-rl-purple/20 transition-colors leading-relaxed"
            />
          ) : (
            <p className="text-sm font-semibold text-rl-text leading-relaxed">{displayHeadline}</p>
          )}
        </div>
      )}

      {/* ── Subheadline field (hidden during regen) ── */}
      {!isRegenerating && (parsedSub || isEditing) && (
        <div className="mb-3">
          <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wider mb-1.5">Subheadline</p>
          {isEditing ? (
            <textarea
              value={editSub}
              onChange={(e) => setEditSub(e.target.value)}
              rows={4}
              className="w-full px-3 py-2.5 rounded-xl border border-rl-purple/40 bg-rl-surface/60 text-sm text-rl-text outline-none resize-none focus:border-rl-purple focus:ring-1 focus:ring-rl-purple/20 transition-colors leading-relaxed"
            />
          ) : (
            <p className="text-sm text-rl-text leading-relaxed">{displaySub}</p>
          )}
        </div>
      )}

      {/* ── Metadata (view mode only) ── */}
      {!isEditing && !isRegenerating && (dor || obj) && (
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

      {/* ── Regen error ── */}
      {regenError && (
        <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-400/10 border border-red-400/20">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <p className="text-xs text-red-400">{regenError}</p>
        </div>
      )}
    </div>
  )
}

function ResultBlock({ content, editedBlocks, onSaveEdit, deletedBlocks, onDelete, onRegenerate }) {
  const [allCopied, setAllCopied] = useState(false)

  function copyAll() {
    navigator.clipboard.writeText(content)
    setAllCopied(true)
    setTimeout(() => setAllCopied(false), 2000)
  }

  // Split by '---' separators, filter blocks that have ## HEADLINE
  const rawBlocks      = content.split(/\n---\n/).map(b => b.trim()).filter(Boolean)
  const headlineBlocks = rawBlocks.filter(b => /^##\s+HEADLINE/im.test(b))
  const otherBlocks    = rawBlocks.filter(b => !/^##\s+HEADLINE/im.test(b))

  const activeCount  = headlineBlocks.filter((_, i) => !deletedBlocks?.has(i)).length
  const editedCount  = Object.keys(editedBlocks || {}).filter(i => !deletedBlocks?.has(Number(i))).length
  const deletedCount = deletedBlocks?.size || 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-rl-muted">
            {activeCount} headline{activeCount !== 1 ? 's' : ''} ativa{activeCount !== 1 ? 's' : ''}
          </span>
          {editedCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rl-gold/10 border border-rl-gold/20 text-rl-gold font-semibold">
              {editedCount} editada{editedCount !== 1 ? 's' : ''}
            </span>
          )}
          {deletedCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-400/10 border border-red-400/20 text-red-400 font-semibold">
              {deletedCount} excluída{deletedCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          onClick={copyAll}
          className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all"
        >
          {allCopied ? <CheckCheck className="w-3.5 h-3.5 text-rl-green" /> : <Copy className="w-3.5 h-3.5" />}
          {allCopied ? 'Tudo copiado!' : 'Copiar tudo'}
        </button>
      </div>

      {activeCount === 0 && (
        <div className="glass-card p-8 text-center">
          <Trash2 className="w-8 h-8 text-rl-muted/40 mx-auto mb-2" />
          <p className="text-sm text-rl-muted">Todas as headlines foram excluídas.</p>
          <p className="text-xs text-rl-muted/60 mt-1">Clique em "Gerar Headlines" para criar novas.</p>
        </div>
      )}

      {headlineBlocks.map((block, i) => {
        if (deletedBlocks?.has(i)) return null
        return (
          <HeadlineCard
            key={i}
            block={block}
            index={i}
            editedData={editedBlocks?.[i]}
            onSaveEdit={onSaveEdit}
            onDelete={onDelete}
            onRegenerate={onRegenerate}
          />
        )
      })}

      {/* Tabela final / blocos extras */}
      {otherBlocks.length > 0 && activeCount > 0 && (
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
  const [objetivo,            setObjetivo]           = useState(() => project.promessa?.objetivo || '')
  const [editedBlocks,        setEditedBlocks]        = useState(() => project.promessa?.editedBlocks || {})
  const [deletedBlocks,       setDeletedBlocks]       = useState(() => new Set(project.promessa?.deletedBlocks || []))
  const objetivoTimer = useRef(null)

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

  function handleObjetivoChange(val) {
    setObjetivo(val)
    clearTimeout(objetivoTimer.current)
    objetivoTimer.current = setTimeout(() => {
      updateProject(project.id, {
        promessa: { ...(project.promessa || {}), objetivo: val },
      })
    }, 800)
  }

  function handleSaveEdit(index, data) {
    const updated = { ...editedBlocks, [index]: data }
    setEditedBlocks(updated)
    updateProject(project.id, {
      promessa: { ...(project.promessa || {}), editedBlocks: updated },
    })
  }

  function handleDeleteBlock(index) {
    const updated = new Set([...deletedBlocks, index])
    setDeletedBlocks(updated)
    updateProject(project.id, {
      promessa: { ...(project.promessa || {}), deletedBlocks: [...updated] },
    })
  }

  const handleRegenerate = useCallback(async (index, angle, onChunk) => {
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

OBJETIVO DA PROMESSA:
${objetivo.trim() || 'Não informado'}

SINAIS DO PROBLEMA que o cliente percebe:
${sinais.map((s, i) => `${i + 1}. ${s}`).join('\n') || 'Não informado'}

RESULTADO PERCEBIDO que o cliente espera alcançar:
${resultados.map((r, i) => `${i + 1}. ${r}`).join('\n') || 'Não informado'}

Crie APENAS 1 nova headline para o ângulo "${angle || 'Dor Percebida'}". Gere uma versão criativa e diferente da anterior, mantendo o mesmo ângulo.

Use exatamente este formato:

## HEADLINE 1 — ${angle || 'Dor Percebida'}

**Headline:**
[texto]

**Subheadline:**
[texto]

**Dor/Resultado trabalhado:** [resumo em uma linha]
**Objeções removidas:** [lista em uma linha]`

    const fullText = await streamClaude({
      model:      'claude-sonnet-4-5',
      max_tokens: 1200,
      system:     HEADLINE_SYSTEM,
      messages:   [{ role: 'user', content: instruction }],
      onChunk,
    })

    const clean            = fullText.replace(/—/g, '-')
    const newHeadlineMatch = clean.match(/\*\*Headline:\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/m)
    const newSubMatch      = clean.match(/\*\*Subheadline:\*\*\s*\n([\s\S]*?)(?=\n\*\*|$)/m)
    const newHeadline      = newHeadlineMatch?.[1]?.trim() || ''
    const newSub           = newSubMatch?.[1]?.trim()      || ''

    if (newHeadline || newSub) {
      setEditedBlocks(prev => {
        const updated = { ...prev, [index]: { headline: newHeadline, sub: newSub } }
        updateProject(project.id, {
          promessa: { ...(project.promessa || {}), editedBlocks: updated },
        })
        return updated
      })
    }
  }, [selectedProdutos, activePersona, project, sinais, resultados, objetivo, updateProject])

  // ── Generate ────────────────────────────────────────────────────────────────

  const generate = useCallback(async () => {
    if (!canGenerate) return
    setLoading(true)
    setError(null)
    setResult(null)
    setEditedBlocks({})
    setDeletedBlocks(new Set())

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

OBJETIVO DA PROMESSA (contexto estratégico para as headlines):
${objetivo.trim() || 'Não informado'}

SINAIS DO PROBLEMA que o cliente percebe (o que faz ele buscar solução):
${sinais.map((s, i) => `${i + 1}. ${s}`).join('\n') || 'Não informado'}

RESULTADO PERCEBIDO que o cliente espera alcançar:
${resultados.map((r, i) => `${i + 1}. ${r}`).join('\n') || 'Não informado'}

Com base nessas informações, crie 10 headlines e subheadlines seguindo todas as instruções do sistema. Use o OBJETIVO DA PROMESSA como diretriz estratégica central — as headlines devem refletir e reforçar esse objetivo.`

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
        promessa: { result: cleanText, objetivo: objetivo.trim(), editedBlocks: {}, deletedBlocks: [], savedAt: new Date().toISOString() },
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [canGenerate, selectedProdutos, activePersona, project, sinais, resultados, objetivo])

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

      {/* ── Objetivo da Promessa ──────────────────────────────────────────── */}
      <div className="glass-card p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-7 h-7 rounded-lg bg-rl-purple/10 flex items-center justify-center shrink-0 mt-0.5">
            <FileText className="w-3.5 h-3.5 text-rl-purple" />
          </div>
          <div>
            <p className="text-xs font-bold text-rl-text">Objetivo da Promessa</p>
            <p className="text-[10px] text-rl-muted mt-0.5">
              Descreva o contexto estratégico e o objetivo central das headlines que serão geradas
            </p>
          </div>
        </div>
        <textarea
          value={objetivo}
          onChange={(e) => handleObjetivoChange(e.target.value)}
          placeholder={`Ex: Capturar leads qualificados para uma masterclass gratuita sobre como empresas de serviços B2B geram reuniões de vendas todos os dias sem depender de indicação. Público-alvo são donos de agências e consultorias com ticket acima de R$5k.`}
          rows={5}
          className="w-full px-4 py-3.5 rounded-xl border border-rl-border bg-rl-surface/60 text-sm text-rl-text placeholder:text-rl-muted/50 outline-none resize-none focus:border-rl-purple/50 focus:ring-1 focus:ring-rl-purple/20 transition-colors leading-relaxed"
        />
        <p className="text-[10px] text-rl-muted mt-2">
          Salvo automaticamente · Usado como diretriz central na geração das headlines
        </p>
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
            { ok: !!selectedPersonaId,           label: 'Persona selecionada',                                required: true },
            { ok: selectedProdutoIds.size > 0,   label: 'Produto / serviço selecionado',                     required: true },
            { ok: sinais.length > 0,             label: `Sinais do problema (${sinais.length} cadastrado${sinais.length !== 1 ? 's' : ''})`, required: true },
            { ok: resultados.length > 0,         label: `Resultados percebidos (${resultados.length} cadastrado${resultados.length !== 1 ? 's' : ''})`, required: true },
            { ok: objetivo.trim().length > 0,    label: 'Objetivo da promessa (melhora a qualidade da geração)', required: false },
          ].map(({ ok, label, required }) => (
            <div key={label} className="flex items-center gap-2">
              <CheckCircle2 className={`w-4 h-4 shrink-0 transition-colors ${ok ? 'text-rl-green' : required ? 'text-rl-border' : 'text-rl-border/50'}`} />
              <span className={`text-xs transition-colors ${ok ? 'text-rl-text' : required ? 'text-rl-muted' : 'text-rl-muted/60'}`}>
                {label}
                {!required && <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded bg-rl-purple/10 text-rl-purple font-semibold">opcional</span>}
              </span>
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
            : <ResultBlock content={result} editedBlocks={editedBlocks} onSaveEdit={handleSaveEdit} deletedBlocks={deletedBlocks} onDelete={handleDeleteBlock} onRegenerate={handleRegenerate} />
          }
        </div>
      )}
    </div>
  )
}
