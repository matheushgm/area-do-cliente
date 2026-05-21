import { useState } from 'react'
import {
  Presentation, FileSignature, Clock, Target, TrendingUp, ChevronLeft, Calculator, Sparkles,
  ShieldQuestion,
} from 'lucide-react'
import PromessaModule from './PromessaModule'
import PlanejamentoAnualModule from './PlanejamentoAnualModule'
import PrecificacaoModule from './Precificacao/PrecificacaoModule'
import MecanismoUnicoModule from './MecanismoUnico/MecanismoUnicoModule'
import MatrizObjecaoModule from './MatrizObjecao/MatrizObjecaoModule'
import WebinarModule from './Webinar/WebinarModule'

// ─── Catálogo de Ferramentas ──────────────────────────────────────────────────
// `Component` é o módulo real renderizado quando a card é clicada. Tools com
// `comingSoon: true` aparecem com badge "Em breve" e não são clicáveis.
const TOOLS = [
  {
    id: 'promessa',
    title: 'Criação de Promessa',
    description:
      'Estrutura uma promessa de valor matadora — específica, mensurável e crível — pro posicionamento do cliente.',
    Icon: Target,
    color: 'rl-purple',
    Component: PromessaModule,
  },
  {
    id: 'planejamento',
    title: 'Planejamento Anual',
    description:
      'Defina a meta anual, distribua mês a mês e acompanhe o realizado vs planejado durante o ano.',
    Icon: TrendingUp,
    color: 'rl-green',
    Component: PlanejamentoAnualModule,
  },
  {
    id: 'precificacao',
    title: 'Precificação',
    description:
      'Calcule o preço de venda correto de serviços e produtos considerando custo, imposto e a margem de lucro que o cliente quer ganhar.',
    Icon: Calculator,
    color: 'rl-gold',
    Component: PrecificacaoModule,
  },
  {
    id: 'mecanismo_unico',
    title: 'Mecanismo Único',
    description:
      'Playbook guiado pra construir o "por que ISSO vai funcionar pra mim" que diferencia o cliente dos concorrentes. 6 seções viram um pitch pronto.',
    Icon: Sparkles,
    color: 'rl-purple',
    Component: MecanismoUnicoModule,
  },
  {
    id: 'matriz_objecao',
    title: 'Matriz de Objeção',
    description:
      'Mapeie as objeções de venda: tipo, como antecipar, causa provável e a melhor resposta. Com link pro cliente preencher junto.',
    Icon: ShieldQuestion,
    color: 'rl-cyan',
    Component: MatrizObjecaoModule,
  },
  {
    id: 'webinar',
    title: 'Criação de webinar',
    description:
      'Monte webinars de conversão etapa por etapa: promessa, método, apresentação, conteúdo e ofertas. Crie quantos quiser.',
    Icon: Presentation,
    color: 'rl-purple',
    Component: WebinarModule,
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
function ToolCard({ tool, onOpen }) {
  const { title, description, Icon, color, comingSoon } = tool
  const clickable = !comingSoon
  return (
    <button
      type="button"
      onClick={clickable ? onOpen : undefined}
      disabled={!clickable}
      className={`glass-card p-6 text-left transition-all duration-200 group relative w-full ${
        clickable
          ? `hover:border-${color}/50 hover:shadow-glow cursor-pointer`
          : 'opacity-90 cursor-not-allowed'
      }`}
      aria-disabled={!clickable}
    >
      {comingSoon && (
        <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rl-gold/10 text-rl-gold border border-rl-gold/30">
          <Clock className="w-3 h-3" /> Em breve
        </span>
      )}

      <div
        className={`w-12 h-12 rounded-2xl bg-${color}/10 flex items-center justify-center mb-4 ${
          clickable ? 'group-hover:scale-110 transition-transform' : ''
        }`}
      >
        <Icon className={`w-6 h-6 text-${color}`} />
      </div>

      <h3 className="text-base font-bold text-rl-text mb-1">{title}</h3>
      <p className="text-xs text-rl-muted leading-relaxed">{description}</p>
    </button>
  )
}

// ─── Módulo principal ─────────────────────────────────────────────────────────
//
// `initialToolId` permite deep-link de outras partes do app (ex: Jornada)
// pra abrir Ferramentas já no card de uma tool específica. Quando passado,
// inicia direto na tool em vez do grid.
export default function FerramentasModule({ project, initialToolId = null }) {
  // null = grid de ferramentas; string = id da tool aberta
  const [activeToolId, setActiveToolId] = useState(initialToolId)

  const active = activeToolId ? TOOLS.find((t) => t.id === activeToolId) : null
  const Active = active?.Component

  // ── View: tool aberta ──────────────────────────────────────────────────────
  if (active && Active) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setActiveToolId(null)}
          className="inline-flex items-center gap-1.5 text-xs text-rl-muted hover:text-rl-text transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Voltar para Ferramentas
        </button>
        <Active project={project} />
      </div>
    )
  }

  // ── View: marketplace ──────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-rl-text mb-1">Ferramentas</h2>
        <p className="text-sm text-rl-muted">
          Marketplace de ferramentas do dia a dia. Escolha uma para acelerar entregas internas e
          para o cliente.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TOOLS.map((tool) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            onOpen={() => setActiveToolId(tool.id)}
          />
        ))}
      </div>
    </div>
  )
}
