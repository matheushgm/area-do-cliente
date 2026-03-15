import { useState } from 'react'
import { Copy, CheckCheck } from 'lucide-react'
import CreativeCard from './CreativeCard'

export default function ResultBlock({ content }) {
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
      {chunks.map((chunk, i) => <CreativeCard key={i} content={chunk} index={i} />)}
    </div>
  )
}
