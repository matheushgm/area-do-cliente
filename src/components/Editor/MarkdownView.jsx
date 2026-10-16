// Leitura rica de Markdown — a mesma tipografia do editor (classes .md-*), sem
// carregar o Lexical. Pra tela que só mostra o texto (Central de anúncios,
// portal, link público antes de editar).
//
// remark-gfm: tabela, tachado, checklist. remark-breaks: quebra de linha simples
// vira <br>, igual ao editor, que preserva as quebras do texto (o rótulo
// "**GANCHO:**" numa linha e o texto na seguinte continuam em linhas separadas).
//
// O ícone <> no canto alterna entre o formatado e o Markdown cru (`codigo={false}`
// esconde). `className` vai no invólucro: cor/tamanho (`md-prose--xs`,
// `md-prose--13`, `text-ln-t2`) valem pros dois modos.
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeSanitize from 'rehype-sanitize'
import { Code2, Eye } from 'lucide-react'

const REMARK = [remarkGfm, remarkBreaks]
const REHYPE = [rehypeSanitize]

const components = {
  a({ href, children }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    )
  },
}

export default function MarkdownView({ content, className = '', codigo = true }) {
  const [cru, setCru] = useState(false)
  if (!content) return null
  const texto = String(content)
  return (
    <div className={`md-view ${className}`}>
      {codigo && (
        <button
          type="button"
          className="md-toggle"
          onClick={() => setCru((v) => !v)}
          aria-pressed={cru}
          title={cru ? 'Ver formatado' : 'Ver o Markdown'}
          aria-label={cru ? 'Ver formatado' : 'Ver o Markdown'}
        >
          {cru ? <Eye /> : <Code2 />}
        </button>
      )}
      {cru ? (
        <pre className="md-raw">{texto}</pre>
      ) : (
        <div className="md-prose">
          <ReactMarkdown remarkPlugins={REMARK} rehypePlugins={REHYPE} components={components}>
            {texto}
          </ReactMarkdown>
        </div>
      )}
    </div>
  )
}
