import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'

const mdComponents = {
  h2({ children }) {
    const text = String(children)
    const match = text.match(/^(\d+)\.\s*(.+)/)
    if (match) {
      return (
        <div className="flex items-start gap-3 mb-3">
          <div className="w-8 h-8 rounded-xl bg-rl-purple flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-xs font-black text-white">{match[1]}</span>
          </div>
          <h3 className="text-base font-bold text-rl-text pt-1">{match[2]}</h3>
        </div>
      )
    }
    return <h3 className="text-base font-bold text-rl-text mt-3 mb-2">{children}</h3>
  },
  p({ children }) {
    return <p className="text-sm text-rl-subtle leading-relaxed">{children}</p>
  },
  li({ children }) {
    return (
      <div className="flex items-start gap-2 mt-1">
        <div className="w-1.5 h-1.5 rounded-full bg-rl-purple mt-2 shrink-0" />
        <p className="text-sm text-rl-subtle leading-relaxed flex-1">{children}</p>
      </div>
    )
  },
  ul({ children }) {
    return <div className="space-y-0.5">{children}</div>
  },
  strong({ children }) {
    return <strong className="font-semibold text-rl-text">{children}</strong>
  },
}

export default function NarrativaRenderer({ content }) {
  const sections = content.split(/\n---\n/).map((s) => s.trim()).filter(Boolean)

  return (
    <div className="space-y-6">
      {sections.map((section, idx) => (
        <div key={idx} className="glass-card p-5 border border-rl-border/70">
          <ReactMarkdown rehypePlugins={[rehypeSanitize]} components={mdComponents}>
            {section}
          </ReactMarkdown>
        </div>
      ))}
    </div>
  )
}
