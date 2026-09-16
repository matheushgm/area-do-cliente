import { useMemo } from 'react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import { Link } from 'react-router-dom'
import { CheckCircle2, ExternalLink } from 'lucide-react'
import { prepararMarkdown } from '../../lib/chat'

// Renderiza o conteúdo de uma mensagem: markdown (o mesmo que vem do ClickUp),
// menções destacadas e links de tarefa como chip.
export default function ChatMarkdown({ texto, membros, meuId, className = '' }) {
  const md = useMemo(() => prepararMarkdown(texto, membros), [texto, membros])
  return (
    <div className={`prose-chat text-[14px] leading-[21px] text-ln-t1 break-words ${className}`}>
      <ReactMarkdown
        urlTransform={(url) => (url.startsWith('mention:') || url.startsWith('/') ? url : defaultUrlTransform(url))}
        components={{
          a: ({ href = '', children }) => {
            if (href.startsWith('mention:')) {
              const id = href.slice(8)
              const eu = id === meuId
              return <span className={`mention ${eu ? 'mention-me' : ''}`}>{children}</span>
            }
            if (href.startsWith('/tarefas')) {
              return (
                <Link to={href} className="task-chip" title="Abrir tarefa">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{children}</span>
                </Link>
              )
            }
            if (href.startsWith('/')) return <Link to={href}>{children}</Link>
            return (
              <a href={href} target="_blank" rel="noreferrer noopener">
                {children}<ExternalLink className="inline w-3 h-3 ml-0.5 -mt-0.5 opacity-60" />
              </a>
            )
          },
          img: ({ src, alt }) => <a href={src} target="_blank" rel="noreferrer noopener">{alt || src}</a>,
        }}
      >
        {md}
      </ReactMarkdown>
    </div>
  )
}
