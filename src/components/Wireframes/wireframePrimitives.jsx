import { createContext, useContext } from 'react'
import { Image as ImageIcon, Play, User } from 'lucide-react'

// ─── Primitivos compartilhados dos wireframes ─────────────────────────────────
// Slots de texto (com modo de EDIÇÃO inline), caixas de mídia, etiquetas de seção
// e botões — usados por todos os wireframes (VSL, Webinar, …). Mantém o visual
// "rascunho" em P&B e centraliza o comportamento de edição.

// Contexto de edição: quando `editable` é true, os slots viram editáveis e cada
// alteração chama `onEdit(path, novoValor)`. `path` aponta o campo no
// wireframeContent (ex.: 'headline', 'cards.0.title', 'heroBullets.2').
const EditContext = createContext({ editable: false, onEdit: null })
export function WireframeEditProvider({ editable, onEdit, children }) {
  return <EditContext.Provider value={{ editable: !!editable, onEdit }}>{children}</EditContext.Provider>
}
export const useEdit = () => useContext(EditContext)

// Estilo do placeholder no modo edição (injetado uma vez).
if (typeof document !== 'undefined' && !document.getElementById('wf-edit-style')) {
  const s = document.createElement('style')
  s.id = 'wf-edit-style'
  s.textContent = `[data-wf-edit]:empty:before{content:attr(data-ph);color:#94a3b8;font-style:italic;pointer-events:none}[data-wf-edit]:focus{outline:2px solid #3b82f6;outline-offset:2px;border-radius:3px;background:#eff6ff}[data-wf-edit]:hover:not(:focus){background:#f1f5f9;border-radius:3px}`
  document.head.appendChild(s)
}

// Converte **trecho** em destaque (sublinhado em P&B). Só no modo leitura.
export function renderEmphasis(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) =>
    /^\*\*[^*]+\*\*$/.test(p)
      ? <span key={i} className="underline decoration-2 underline-offset-4 decoration-slate-400">{p.replace(/\*\*/g, '')}</span>
      : <span key={i}>{p}</span>
  )
}

// Slot de texto. No modo leitura mostra o valor (ou o placeholder-guia em cinza).
// No modo edição vira contentEditable; persiste no blur. `path` é obrigatório p/
// edição. `multiline` permite Enter (senão Enter confirma/sai).
export function Slot({ value, placeholder = '', path, as: Tag = 'span', className = '', multiline = false }) {
  const { editable, onEdit } = useEdit()
  const has = typeof value === 'string' && value.trim().length > 0

  if (editable && path && onEdit) {
    return (
      <Tag
        data-wf-edit
        data-ph={placeholder}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        className={`${className} ${has ? '' : ''} cursor-text`}
        onKeyDown={(e) => {
          if (!multiline && e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
          if (e.key === 'Escape') e.currentTarget.blur()
        }}
        onBlur={(e) => {
          const next = e.currentTarget.innerText.replace(/\n+$/,'')
          if (next !== (value || '')) onEdit(path, next)
        }}
      >
        {value || ''}
      </Tag>
    )
  }

  return (
    <Tag className={`${className} ${has ? '' : 'text-slate-400 italic font-normal'}`}>
      {has ? renderEmphasis(value) : placeholder}
    </Tag>
  )
}

// Caixa-placeholder de mídia (imagem / vídeo / avatar).
export function MediaBox({ icon = 'image', label, className = '' }) {
  const Icon = icon === 'play' ? Play : icon === 'user' ? User : ImageIcon
  return (
    <div className={`flex flex-col items-center justify-center gap-1.5 bg-slate-100 border-2 border-dashed border-slate-300 text-slate-400 ${className}`}>
      <Icon className="w-6 h-6" strokeWidth={1.5} />
      {label && <span className="text-[9px] font-bold uppercase tracking-widest">{label}</span>}
    </div>
  )
}

// Etiqueta de seção (orienta o designer).
export function SectionTag({ children, onDark = false }) {
  return (
    <span className={`inline-block text-[8px] font-bold uppercase tracking-[0.2em] px-2 py-0.5 rounded-full mb-3 ${
      onDark ? 'text-slate-500 bg-slate-800' : 'text-slate-400 bg-slate-100'
    }`}>
      {children}
    </span>
  )
}

// Botão (CTA) em estilo wireframe, com texto editável. `onDark` inverte (claro
// sobre escuro) para garantir contraste em fundos escuros.
export function CtaButton({ value, placeholder, path, onDark = false }) {
  return (
    <span
      className={`inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-xs font-bold ${
        onDark ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'
      }`}
    >
      <Slot value={value} placeholder={placeholder} path={path} className="outline-none" />
    </span>
  )
}

// Atualiza imutavelmente um valor no objeto pelo caminho 'a.0.b'.
export function setByPath(obj, path, value) {
  const keys = String(path).split('.')
  const root = Array.isArray(obj) ? [...obj] : { ...(obj || {}) }
  let cur = root
  for (let i = 0; i < keys.length - 1; i++) {
    const k = /^\d+$/.test(keys[i]) ? Number(keys[i]) : keys[i]
    const child = cur[k]
    cur[k] = Array.isArray(child) ? [...child] : { ...(child || {}) }
    cur = cur[k]
  }
  const last = keys[keys.length - 1]
  cur[/^\d+$/.test(last) ? Number(last) : last] = value
  return root
}
