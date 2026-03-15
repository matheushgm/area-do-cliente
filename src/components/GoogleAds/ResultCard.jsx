import { useState } from 'react'
import { Search, Copy, CheckCheck } from 'lucide-react'

export default function ResultCard({ content, index }) {
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
    if (/^\s{4}[["+]/.test(line)) {
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
