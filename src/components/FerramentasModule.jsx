import { Presentation, FileSignature, Clock } from 'lucide-react'

// ─── Catálogo de Ferramentas ──────────────────────────────────────────────────
// Cada tool é um card no marketplace. Por enquanto, apenas previews ("Em breve").
// Quando uma ferramenta entrar em produção, troque `comingSoon: true` por
// `onClick` (ou rota) e o badge deixa de aparecer.
const TOOLS = [
  {
    id: 'webinar',
    title: 'Criação de webinar',
    description:
      'Monte a estrutura de um webinar de conversão do zero: roteiro, slides-chave, CTAs e fluxo de captação.',
    Icon: Presentation,
    color: 'rl-purple',
    comingSoon: true,
  },
  {
    id: 'proposta',
    title: 'Proposta comercial',
    description:
      'Gere uma proposta comercial completa com diagnóstico, escopo, investimento e gatilhos de fechamento.',
    Icon: FileSignature,
    color: 'rl-cyan',
    comingSoon: true,
  },
]

// ─── Card individual ──────────────────────────────────────────────────────────
function ToolCard({ tool }) {
  const { title, description, Icon, color, comingSoon } = tool
  return (
    <div
      className={`glass-card p-6 text-left transition-all duration-200 group relative ${
        comingSoon
          ? 'opacity-90 cursor-not-allowed'
          : `hover:border-${color}/50 hover:shadow-glow cursor-pointer`
      }`}
      aria-disabled={comingSoon}
    >
      {comingSoon && (
        <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rl-gold/10 text-rl-gold border border-rl-gold/30">
          <Clock className="w-3 h-3" /> Em breve
        </span>
      )}

      <div
        className={`w-12 h-12 rounded-2xl bg-${color}/10 flex items-center justify-center mb-4 ${
          comingSoon ? '' : 'group-hover:scale-110 transition-transform'
        }`}
      >
        <Icon className={`w-6 h-6 text-${color}`} />
      </div>

      <h3 className="text-base font-bold text-rl-text mb-1">{title}</h3>
      <p className="text-xs text-rl-muted leading-relaxed">{description}</p>
    </div>
  )
}

// ─── Módulo principal ─────────────────────────────────────────────────────────
export default function FerramentasModule() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-rl-text mb-1">Ferramentas</h2>
        <p className="text-sm text-rl-muted">
          Marketplace de ferramentas do dia a dia. Escolha uma para acelerar entregas internas e
          para o cliente.
        </p>
      </div>

      {/* Grid de ferramentas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TOOLS.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </div>
  )
}
