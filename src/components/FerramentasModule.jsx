import { useState } from 'react'
import {
  Presentation, FileSignature, Clock, Target, TrendingUp, ChevronLeft, Calculator, Sparkles,
  ShieldQuestion, LineChart,
} from 'lucide-react'
import PromessaModule from './PromessaModule'
import PlanejamentoAnualModule from './PlanejamentoAnualModule'
import PlanejamentoMarketingModule from './PlanejamentoMarketingModule'
import PrecificacaoModule from './Precificacao/PrecificacaoModule'
import MecanismoUnicoModule from './MecanismoUnico/MecanismoUnicoModule'
import MatrizObjecaoModule from './MatrizObjecao/MatrizObjecaoModule'
import WebinarModule from './Webinar/WebinarModule'
import PropostaComercialModule from './PropostaComercialModule'
import { useI18n } from '../i18n'

// ─── Catálogo de Ferramentas ──────────────────────────────────────────────────
// Nome e descrição de cada tool moram em locales/<idioma>/ferramentas.js (`tools.<id>`).
// `Component` é o módulo real renderizado quando a card é clicada. Tools com
// `comingSoon: true` aparecem com badge "Em breve" e não são clicáveis.
const TOOLS = [
  {
    id: 'promessa',
    Icon: Target,
    color: 'rl-purple',
    Component: PromessaModule,
  },
  {
    id: 'planejamento',
    Icon: TrendingUp,
    color: 'rl-green',
    Component: PlanejamentoAnualModule,
  },
  {
    id: 'planejamento_marketing',
    Icon: LineChart,
    color: 'rl-cyan',
    Component: PlanejamentoMarketingModule,
  },
  {
    id: 'precificacao',
    Icon: Calculator,
    color: 'rl-gold',
    Component: PrecificacaoModule,
  },
  {
    id: 'mecanismo_unico',
    Icon: Sparkles,
    color: 'rl-purple',
    Component: MecanismoUnicoModule,
  },
  {
    id: 'matriz_objecao',
    Icon: ShieldQuestion,
    color: 'rl-cyan',
    Component: MatrizObjecaoModule,
  },
  {
    id: 'webinar',
    Icon: Presentation,
    color: 'rl-purple',
    Component: WebinarModule,
  },
  {
    id: 'proposta',
    Icon: FileSignature,
    color: 'rl-cyan',
    Component: PropostaComercialModule,
  },
]

// ─── Card individual ──────────────────────────────────────────────────────────
function ToolCard({ tool, onOpen }) {
  const { t } = useI18n()
  const { id, Icon, color, comingSoon } = tool
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
          <Clock className="w-3 h-3" /> {t('ferramentas.emBreve')}
        </span>
      )}

      <div
        className={`w-12 h-12 rounded-2xl bg-${color}/10 flex items-center justify-center mb-4 ${
          clickable ? 'group-hover:scale-110 transition-transform' : ''
        }`}
      >
        <Icon className={`w-6 h-6 text-${color}`} />
      </div>

      <h3 className="text-base font-bold text-rl-text mb-1">{t(`ferramentas.tools.${id}.titulo`)}</h3>
      <p className="text-xs text-rl-muted leading-relaxed">{t(`ferramentas.tools.${id}.descricao`)}</p>
    </button>
  )
}

// ─── Módulo principal ─────────────────────────────────────────────────────────
//
// `initialToolId` permite deep-link de outras partes do app (ex: Jornada)
// pra abrir Ferramentas já no card de uma tool específica. Quando passado,
// inicia direto na tool em vez do grid.
export default function FerramentasModule({ project, initialToolId = null }) {
  const { t } = useI18n()
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
          {t('ferramentas.voltar')}
        </button>
        <Active project={project} />
      </div>
    )
  }

  // ── View: marketplace ──────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-rl-text mb-1">{t('ferramentas.titulo')}</h2>
        <p className="text-sm text-rl-muted">
          {t('ferramentas.subtitulo')}
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
