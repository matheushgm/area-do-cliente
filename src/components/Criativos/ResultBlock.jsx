import { useState } from 'react'
import { Copy, CheckCheck, ChevronDown, ChevronUp, Brain } from 'lucide-react'
import CreativeCard from './CreativeCard'

// Divide o texto em blocos de anúncio pelos cabeçalhos ## ROTEIRO N / ## ANÚNCIO N.
// Tudo que precede o primeiro cabeçalho, ou que é tabela/insight final, vai para análise.
const AD_HEADER = /^##\s+(?:ROTEIRO|AN[ÚU]NCIO)\s+\d+/im

// Chunks que NÃO são anúncios (tabelas, insights, análises finais)
function isNonAdTrailing(chunk) {
  return (
    /TABELA\s+DO\s+LABORAT/i.test(chunk)    ||  // tabela do laboratório
    /INSIGHTS?\s+ESTRAT[ÉE]G/i.test(chunk)  ||  // insights estratégicos
    /COMBINAÇÕES?\s+DE\s+ALTA/i.test(chunk)  ||  // combinações de alta conversão
    /PRÓXIMOS?\s+GANCHOS/i.test(chunk)       ||  // próximos ganchos para testar
    /^\|\s*Tipo\s+de\s+Gancho/im.test(chunk)    // linha de tabela markdown
  )
}

function splitContent(content) {
  // Divide mantendo o delimitador (lookahead) para cada cabeçalho de anúncio
  const parts = content.split(/(?=^##\s+(?:ROTEIRO|AN[ÚU]NCIO)\s+\d+)/im)

  const ads      = []
  const analysis = []

  parts.forEach((part) => {
    const trimmed = part.trim()
    if (!trimmed) return
    if (AD_HEADER.test(trimmed) && !isNonAdTrailing(trimmed)) ads.push(trimmed)
    else analysis.push(trimmed)
  })

  // Se não encontrou cabeçalhos explícitos, tenta fallback por ---
  if (ads.length === 0) {
    const chunks = content.split(/\n---\n/).map((c) => c.trim()).filter(Boolean)
    chunks.forEach((c) => {
      const hasAd =
        /HEADLINE\s+PRINCIPAL/i.test(c)  ||
        /CALL.TO.ACTION/i.test(c)         ||
        /⏱.*GANCHO/i.test(c)             ||
        /📣.*CTA/i.test(c)
      if (hasAd && !isNonAdTrailing(c)) ads.push(c)
      else analysis.push(c)
    })
  }

  return { ads, analysis }
}

// Substitui o chunk de anúncio no índice `adIndex` dentro da string `content` completa.
// Exportado para uso em CreativeHistory e CriativosModule ao persistir edições.
export function replaceAdInContent(content, adIndex, newAdContent) {
  // Tentativa primária: split por cabeçalhos ## ANÚNCIO / ## ROTEIRO
  const parts = content.split(/(?=^##\s+(?:ROTEIRO|AN[ÚU]NCIO)\s+\d+)/im)
  let adCount  = 0
  let foundAny = false

  const newParts = parts.map((part) => {
    const trimmed = part.trim()
    if (!trimmed) return part
    if (AD_HEADER.test(trimmed) && !isNonAdTrailing(trimmed)) {
      foundAny = true
      const result = adCount === adIndex ? newAdContent : part
      adCount++
      return result
    }
    return part
  })

  if (foundAny) return newParts.join('')

  // Fallback: split por ---
  const chunks = content.split(/\n---\n/)
  let fallbackCount = 0
  const newChunks = chunks.map((c) => {
    const trimmed = c.trim()
    const hasAd =
      /HEADLINE\s+PRINCIPAL/i.test(trimmed) ||
      /CALL.TO.ACTION/i.test(trimmed)        ||
      /⏱.*GANCHO/i.test(trimmed)            ||
      /📣.*CTA/i.test(trimmed)
    if (hasAd && !isNonAdTrailing(trimmed)) {
      const result = fallbackCount === adIndex ? newAdContent : c
      fallbackCount++
      return result
    }
    return c
  })
  return newChunks.join('\n---\n')
}

export default function ResultBlock({ content, type, companyName, onChunkChange, createdAt }) {
  const [allCopied,     setAllCopied]     = useState(false)
  const [analysisOpen,  setAnalysisOpen]  = useState(false)

  function copyAll() {
    navigator.clipboard.writeText(content)
    setAllCopied(true)
    setTimeout(() => setAllCopied(false), 2000)
  }

  const { ads: adChunks, analysis } = splitContent(content)

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-rl-muted">
          {adChunks.length} anúncio{adChunks.length !== 1 ? 's' : ''} gerado{adChunks.length !== 1 ? 's' : ''}
        </span>
        <button onClick={copyAll} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all">
          {allCopied ? <CheckCheck className="w-3.5 h-3.5 text-rl-green" /> : <Copy className="w-3.5 h-3.5" />}
          {allCopied ? 'Tudo copiado!' : 'Copiar tudo'}
        </button>
      </div>

      {/* Análise de contexto (colapsável, quando presente) */}
      {analysis.length > 0 && (
        <div className="rounded-xl border border-rl-border/60 overflow-hidden">
          <button
            onClick={() => setAnalysisOpen((v) => !v)}
            className="w-full flex items-center gap-2.5 px-4 py-3 bg-rl-surface/60 hover:bg-rl-surface transition-colors text-left"
          >
            <Brain className="w-3.5 h-3.5 text-rl-purple shrink-0" />
            <span className="text-xs font-semibold text-rl-muted flex-1">Análise de Público (contexto usado pela IA)</span>
            {analysisOpen
              ? <ChevronUp   className="w-3.5 h-3.5 text-rl-muted shrink-0" />
              : <ChevronDown className="w-3.5 h-3.5 text-rl-muted shrink-0" />
            }
          </button>
          {analysisOpen && (
            <div className="px-4 py-4 bg-rl-surface/20 space-y-3">
              {analysis.map((chunk, i) => (
                <div key={i} className="text-xs text-rl-muted leading-relaxed whitespace-pre-wrap">
                  {chunk}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Anúncios reais */}
      {adChunks.map((chunk, i) => (
        <CreativeCard
          key={i}
          content={chunk}
          index={i}
          type={type}
          companyName={companyName}
          createdAt={createdAt}
          onChange={onChunkChange ? (newContent) => onChunkChange(i, newContent) : undefined}
        />
      ))}
    </div>
  )
}
