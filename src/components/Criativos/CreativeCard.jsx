import { useState } from 'react'
import { Copy, CheckCheck, FileDown } from 'lucide-react'
import { exportCreativoSinglePDF } from '../../lib/creativoPDF'

export default function CreativeCard({ content, index, type, companyName }) {
  const [copied,    setCopied]    = useState(false)
  const [exporting, setExporting] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleExport() {
    setExporting(true)
    try {
      exportCreativoSinglePDF({ content, type: type || 'estatico', index, companyName })
    } finally {
      setExporting(false)
    }
  }

  const lines = content.split('\n')
  const rendered = lines.map((line, i) => {
    if (/^##\s/.test(line))  return <h3 key={i} className="text-sm font-bold text-rl-text mt-4 mb-2 first:mt-0">{line.replace(/^##\s/, '')}</h3>
    if (/^###\s/.test(line)) return <h4 key={i} className="text-xs font-bold text-rl-purple mt-3 mb-1">{line.replace(/^###\s/, '')}</h4>
    if (/^\*\*.*\*\*/.test(line)) {
      const label = line.match(/^\*\*(.*?)\*\*/)?.[1] || ''
      const rest  = line.replace(/^\*\*(.*?)\*\*:?\s*/, '')
      return (
        <div key={i} className="mt-2">
          <span className="text-[10px] font-bold text-rl-muted uppercase tracking-wider">{label}</span>
          {rest && <p className="text-sm text-rl-text mt-0.5 leading-relaxed">{rest}</p>}
        </div>
      )
    }
    if (/^[🎬🎙️📝⏱🔥📣]/.test(line)) return <p key={i} className="text-sm text-rl-text mt-1 leading-relaxed">{line}</p>
    if (line.trim() === '')           return <div key={i} className="h-1" />
    return <p key={i} className="text-sm text-rl-text leading-relaxed">{line.replace(/\*\*(.*?)\*\*/g, '$1')}</p>
  })

  return (
    <div className="glass-card p-5 border border-rl-border/60">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold text-rl-muted uppercase tracking-wider">Criativo {index + 1}</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleExport}
            disabled={exporting}
            title="Exportar este anúncio em PDF"
            className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-rl-surface text-rl-muted hover:text-rl-purple transition-all disabled:opacity-50"
          >
            <FileDown className="w-3 h-3" />
            PDF
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-rl-surface text-rl-muted hover:text-rl-purple transition-all"
          >
            {copied ? <CheckCheck className="w-3 h-3 text-rl-green" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
      </div>
      <div className="space-y-0">{rendered}</div>
    </div>
  )
}
