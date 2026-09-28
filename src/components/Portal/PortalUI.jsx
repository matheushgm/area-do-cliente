// Primitivas visuais compartilhadas pelos renderizadores do portal (somente leitura).
import { Inbox } from 'lucide-react'
import MarkdownBlock from '../Criativos/MarkdownBlock'

export function Section({ title, subtitle, right, children, className = '' }) {
  return (
    <div className={`glass-card p-5 ${className}`}>
      {(title || right) && (
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            {title && <h3 className="text-sm font-semibold text-rl-text">{title}</h3>}
            {subtitle && <p className="text-xs text-rl-muted mt-0.5">{subtitle}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  )
}

export function Field({ label, value }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="rounded-xl bg-rl-surface p-3">
      <p className="text-[11px] text-rl-muted mb-0.5">{label}</p>
      <div className="text-sm text-rl-text font-medium break-words">{value}</div>
    </div>
  )
}

export function Empty({ text = 'Nada publicado ainda.', hint }) {
  return (
    <div className="rounded-xl border border-dashed border-rl-border bg-rl-surface/30 py-12 px-6 text-center space-y-2">
      <Inbox className="w-8 h-8 text-rl-muted/40 mx-auto" />
      <p className="text-sm font-semibold text-rl-text">{text}</p>
      {hint && <p className="text-xs text-rl-muted">{hint}</p>}
    </div>
  )
}

export function Pill({ children, color, bg, border, className = '' }) {
  const style = color || bg ? { color, backgroundColor: bg, borderColor: border || bg } : undefined
  return (
    <span style={style} className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${style ? '' : 'text-rl-cyan bg-rl-cyan/10 border-rl-cyan/30'} ${className}`}>
      {children}
    </span>
  )
}

export function Chips({ items }) {
  const list = (items || []).filter(Boolean)
  if (!list.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((it, i) => (
        <span key={i} className="text-xs px-2.5 py-1 rounded-lg bg-rl-surface border border-rl-border text-rl-text">{it}</span>
      ))}
    </div>
  )
}

export function Md({ content }) {
  if (!content) return null
  return <div className="prose-portal"><MarkdownBlock content={String(content)} /></div>
}

export function PreText({ text }) {
  if (!text) return null
  return <div className="text-sm text-rl-text leading-relaxed whitespace-pre-wrap">{String(text)}</div>
}

export function Details({ title, meta, defaultOpen = false, children }) {
  return (
    <details open={defaultOpen} className="group rounded-xl border border-rl-border bg-rl-surface/40">
      <summary className="cursor-pointer select-none list-none px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-rl-text truncate">{title}</p>
          {meta && <p className="text-[11px] text-rl-muted mt-0.5">{meta}</p>}
        </div>
        <span className="text-rl-muted text-xs group-open:rotate-180 transition-transform">▾</span>
      </summary>
      <div className="px-4 pb-4 pt-1 border-t border-rl-border/60">{children}</div>
    </details>
  )
}

export function ExtLink({ href, children, className = '' }) {
  if (!href) return null
  const url = /^https?:\/\//i.test(href) ? href : `https://${href}`
  return (
    <a href={url} target="_blank" rel="noreferrer" className={`text-rl-cyan hover:underline break-all ${className}`}>
      {children || href}
    </a>
  )
}

export function fmtDate(iso) {
  if (!iso) return ''
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + 'T00:00:00') : new Date(iso)
  if (isNaN(d)) return String(iso)
  return d.toLocaleDateString('pt-BR')
}

export function fmtDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return String(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function fmtBytes(n) {
  if (!n && n !== 0) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
