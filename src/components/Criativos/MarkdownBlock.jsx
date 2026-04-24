import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'

const components = {
  h1({ children }) {
    return <h2 className="text-sm font-bold text-rl-text mb-2">{children}</h2>
  },
  h2({ children }) {
    return (
      <h3 className="text-[10px] font-bold text-rl-purple uppercase tracking-wide mt-4 mb-2 first:mt-0">
        {children}
      </h3>
    )
  },
  h3({ children }) {
    return <h4 className="text-xs font-bold text-rl-muted mt-3 mb-1">{children}</h4>
  },
  p({ children }) {
    return <p className="text-sm text-rl-text leading-relaxed mt-1">{children}</p>
  },
  ul({ children }) {
    return <div className="space-y-1.5 mt-1">{children}</div>
  },
  ol({ children }) {
    return <div className="space-y-1.5 mt-1">{children}</div>
  },
  li({ children }) {
    return (
      <div className="flex items-start gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-rl-purple/60 mt-[0.45rem] shrink-0" />
        <span className="text-sm text-rl-text leading-snug flex-1">{children}</span>
      </div>
    )
  },
  strong({ children }) {
    return (
      <span className="text-[10px] font-bold text-rl-muted uppercase tracking-wider">
        {children}
      </span>
    )
  },
  em({ children }) {
    return <em className="italic text-rl-text/80">{children}</em>
  },
  hr() {
    return <hr className="border-rl-border/40 my-3" />
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-l-2 border-rl-purple/40 pl-3 text-sm text-rl-muted italic">
        {children}
      </blockquote>
    )
  },
}

export default function MarkdownBlock({ content }) {
  return (
    <ReactMarkdown rehypePlugins={[rehypeSanitize]} components={components}>
      {content}
    </ReactMarkdown>
  )
}
