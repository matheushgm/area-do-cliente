import { useState } from 'react'
import { Copy, CheckCheck } from 'lucide-react'
import MarkdownBlock from './MarkdownBlock'

function parseDorTitle(content) {
  const match = content.match(/^#\s+DOR[:\s]+(.+)/im)
  if (!match) return ''
  // Remove o sufixo " | Emoji Tipo" se presente
  return match[1].split('|')[0].trim()
}

function stripDorHeader(content) {
  return content.replace(/^#\s+DOR[^\n]*\n?/im, '').trim()
}

function DorCard({ content, index }) {
  const title = parseDorTitle(content)
  const body  = stripDorHeader(content)
  const [copied, setCopied] = useState(false)

  function copyAll() {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-3 border-b border-rl-border/40 flex items-start justify-between gap-3 bg-rl-surface/40">
        <div className="flex-1">
          <div className="text-[10px] text-rl-muted font-semibold uppercase tracking-wide mb-0.5">
            Dor #{index + 1}
          </div>
          <p className="text-sm font-semibold text-rl-text leading-snug">
            {title || 'Dor sem título'}
          </p>
        </div>
        <button
          onClick={copyAll}
          className="shrink-0 flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all"
        >
          {copied
            ? <CheckCheck className="w-3 h-3 text-rl-green" />
            : <Copy className="w-3 h-3" />}
          {copied ? 'Copiado!' : 'Copiar tudo'}
        </button>
      </div>

      <div className="p-4">
        {body
          ? <MarkdownBlock content={body} />
          : <p className="text-sm text-rl-muted italic">Sem conteúdo</p>
        }
      </div>
    </div>
  )
}

export default function DoresResultBlock({ content }) {
  const [allCopied, setAllCopied] = useState(false)

  function copyAll() {
    navigator.clipboard.writeText(content)
    setAllCopied(true)
    setTimeout(() => setAllCopied(false), 2000)
  }

  const chunks = content
    .split(/\n---\n/)
    .map((c) => c.trim())
    .filter((c) => c && /^#\s+DOR/i.test(c))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-rl-muted">
          {chunks.length} dor{chunks.length !== 1 ? 'es' : ''} gerada{chunks.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={copyAll}
          className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all"
        >
          {allCopied ? <CheckCheck className="w-3.5 h-3.5 text-rl-green" /> : <Copy className="w-3.5 h-3.5" />}
          {allCopied ? 'Tudo copiado!' : 'Copiar tudo'}
        </button>
      </div>

      {chunks.length > 0
        ? chunks.map((chunk, i) => <DorCard key={i} content={chunk} index={i} />)
        : <div className="text-sm text-rl-text leading-relaxed whitespace-pre-wrap">{content}</div>
      }
    </div>
  )
}
