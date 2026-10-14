// Leitura rica de Markdown — a mesma tipografia do editor (classes .md-*), sem
// carregar o Lexical. Pra tela que só mostra o texto (Central de anúncios,
// portal, link público antes de editar).
//
// remark-gfm: tabela, tachado, checklist. remark-breaks: quebra de linha simples
// vira <br>, igual ao editor, que preserva as quebras do texto (o rótulo
// "**GANCHO:**" numa linha e o texto na seguinte continuam em linhas separadas).
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeSanitize from 'rehype-sanitize'

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

export default function MarkdownView({ content, className = '' }) {
  if (!content) return null
  return (
    <div className={`md-prose ${className}`}>
      <ReactMarkdown remarkPlugins={REMARK} rehypePlugins={REHYPE} components={components}>
        {String(content)}
      </ReactMarkdown>
    </div>
  )
}
