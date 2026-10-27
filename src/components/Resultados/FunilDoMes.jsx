// Faixa "Funil do mês" dos Resultados: uma etapa ao lado da outra, com a conversão
// da etapa anterior e de onde vem cada número. "API" = investimento e conversões das
// contas vinculadas (api/resultados-autofill.js); "Lançado" = o que o time ou o
// cliente (pelo link) preenche: MQL, SQL, vendas e receita.
import { Zap, PenLine, ArrowRight } from 'lucide-react'

export const FONTES = {
  api: { label: 'API', Icon: Zap, cls: 'text-rl-cyan bg-rl-cyan/10 border-rl-cyan/25', dot: 'bg-rl-cyan' },
  lancado: { label: 'Lançado', Icon: PenLine, cls: 'text-rl-purple bg-rl-purple/10 border-rl-purple/25', dot: 'bg-rl-purple' },
}

export function FonteTag({ fonte, children }) {
  const f = FONTES[fonte]
  if (!f) return null
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide border rounded-full px-1.5 py-0.5 ${f.cls}`}>
      <f.Icon size={10} /> {children || f.label}
    </span>
  )
}

// etapas: [{ key, label, valor (texto pronto), sub?, fonte, conversao? (texto: "36,2% dos leads") }]
export default function FunilDoMes({ titulo, atualizado, etapas }) {
  return (
    <div className="rounded-2xl border border-rl-border bg-rl-surface/40 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm font-semibold text-rl-text">{titulo}</p>
        <div className="flex items-center gap-3 text-xs text-rl-muted flex-wrap">
          <span className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${FONTES.api.dot}`} /> API{atualizado ? ` · atualizado ${atualizado}` : ''}</span>
          <span className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${FONTES.lancado.dot}`} /> Lançado pelo time ou pelo cliente</span>
        </div>
      </div>
      <div className={`grid gap-2 grid-cols-2 sm:grid-cols-3 ${etapas.length >= 6 ? 'xl:grid-cols-6' : 'xl:grid-cols-4'}`}>
        {etapas.map((e) => (
          <div key={e.key} className="relative rounded-xl border border-rl-border bg-rl-card px-3.5 py-3 min-w-0">
            <span className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full ${FONTES[e.fonte]?.dot || 'bg-rl-border'}`} />
            <p className="text-sm font-medium text-rl-subtle">{e.label}</p>
            <p className="text-2xl font-bold text-rl-text tabular-nums leading-tight mt-1 truncate">{e.valor}</p>
            <p className="text-[13px] text-rl-subtle mt-1 truncate">{e.sub || ' '}</p>
            {e.conversao && (
              <p className="text-[13px] text-rl-muted mt-0.5 flex items-center gap-1 truncate"><ArrowRight size={12} className="shrink-0" /> {e.conversao}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
