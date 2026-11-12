// Peças visuais compartilhadas pelas telas de Contratação (tokens rl-*).
import { useOutletContext, Link } from 'react-router-dom'
import { Menu, ChevronRight } from 'lucide-react'
import { NIVEL_ROTULO, NIVEL_COR, STATUS_CANDIDATO } from '../../lib/contratacao'

// Classes literais (o Tailwind não enxerga classe montada por template).
export const COR = {
  red: { txt: 'text-rl-red', bg: 'bg-rl-red/10', borda: 'border-rl-red/40', solido: 'bg-rl-red' },
  gold: { txt: 'text-rl-gold', bg: 'bg-rl-gold/10', borda: 'border-rl-gold/40', solido: 'bg-rl-gold' },
  cyan: { txt: 'text-rl-cyan', bg: 'bg-rl-cyan/10', borda: 'border-rl-cyan/40', solido: 'bg-rl-cyan' },
  green: { txt: 'text-rl-green', bg: 'bg-rl-green/10', borda: 'border-rl-green/40', solido: 'bg-rl-green' },
  purple: { txt: 'text-rl-purple', bg: 'bg-rl-purple/10', borda: 'border-rl-purple/40', solido: 'bg-rl-purple' },
  muted: { txt: 'text-rl-muted', bg: 'bg-rl-surface', borda: 'border-rl-border', solido: 'bg-rl-muted' },
}

export function Pill({ cor = 'muted', children, className = '' }) {
  const c = COR[cor] || COR.muted
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${c.txt} ${c.bg} ${c.borda} ${className}`}>
      {children}
    </span>
  )
}

export function NivelBadge({ nivel, className = '' }) {
  if (!nivel) return <Pill className={className}>Sem nível</Pill>
  return <Pill cor={NIVEL_COR[nivel]} className={className}>{NIVEL_ROTULO[nivel]}</Pill>
}

export function StatusBadge({ status }) {
  const s = STATUS_CANDIDATO.find((x) => x.id === status) || STATUS_CANDIDATO[0]
  return <Pill cor={s.cor}>{s.rotulo}</Pill>
}

export function DisponivelBadge({ empregado }) {
  return empregado
    ? <Pill cor="red">Empregado</Pill>
    : <Pill cor="green">Disponível</Pill>
}

/** Moldura da página: barra mobile + migalhas + conteúdo centralizado. */
export function Pagina({ migalhas = [], titulo, acoes, largura = 'max-w-6xl', children }) {
  const ctx = useOutletContext() || {}
  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-rl-border bg-rl-bg/90 backdrop-blur-xl">
        <button onClick={ctx.openSidebar} aria-label="Abrir menu de navegação"
          className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all">
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-bold text-rl-text text-sm truncate">{titulo || 'Contratação'}</span>
      </div>
      <main className="flex-1 px-4 sm:px-6 py-6 sm:py-8">
        <div className={`${largura} mx-auto space-y-6`}>
          {migalhas.length > 0 && (
            <nav className="flex items-center gap-1 text-xs text-rl-muted flex-wrap">
              {migalhas.map((m, i) => (
                <span key={i} className="inline-flex items-center gap-1">
                  {i > 0 && <ChevronRight className="w-3 h-3" />}
                  {m.to ? <Link to={m.to} className="hover:text-rl-text transition-colors">{m.rotulo}</Link> : <span className="text-rl-subtle">{m.rotulo}</span>}
                </span>
              ))}
            </nav>
          )}
          {(titulo || acoes) && (
            <div className="flex items-start gap-3 flex-wrap">
              {titulo && <h2 className="text-xl font-black text-rl-text leading-tight flex-1 min-w-0">{titulo}</h2>}
              {acoes}
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  )
}

/** Barra de pontuação 0-100 com as marcas dos níveis. */
export function MedidorNivel({ pontuacao, regua, nivel, compacto = false }) {
  const marcas = [
    { v: regua.junior, r: 'Jr' },
    { v: regua.pleno, r: 'Pl' },
    { v: regua.senior, r: 'Sr' },
  ]
  const cor = COR[{ abaixo: 'red', junior: 'gold', pleno: 'cyan', senior: 'green' }[nivel] || 'muted']
  return (
    <div className={compacto ? '' : 'pt-4'}>
      <div className="relative h-2.5 rounded-full bg-rl-surface border border-rl-border overflow-visible">
        <div className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${cor.solido}`} style={{ width: `${Math.max(2, pontuacao)}%` }} />
        {marcas.map((m) => (
          <div key={m.r} className="absolute -top-1 -bottom-1 w-px bg-rl-text/30" style={{ left: `${m.v}%` }}>
            {!compacto && <span className="absolute -top-4 -translate-x-1/2 text-[10px] font-semibold text-rl-muted">{m.r}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

export const fmtData = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '-')
