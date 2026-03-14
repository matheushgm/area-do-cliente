export default function ModelSelector({ onSelect }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-rl-text mb-2">Módulo de Resultados</h2>
        <p className="text-rl-muted text-sm max-w-md mx-auto">
          Selecione o modelo de negócio deste cliente para configurar o acompanhamento correto
        </p>
      </div>
      <div className="grid grid-cols-2 gap-6 w-full max-w-xl">
        {/* B2B */}
        <button
          onClick={() => onSelect('b2b')}
          className="glass-card p-8 text-left hover:border-rl-blue/50 transition-all cursor-pointer group"
        >
          <div className="text-4xl mb-4">🏢</div>
          <div className="text-xl font-bold text-rl-text mb-2">B2B</div>
          <div className="text-sm text-rl-muted leading-relaxed mb-4">
            Ciclo de venda longo com qualificação de leads
          </div>
          <ul className="space-y-1.5 text-xs text-rl-muted">
            <li className="flex items-center gap-1.5"><span className="text-rl-blue">✦</span> Acompanhamento semanal</li>
            <li className="flex items-center gap-1.5"><span className="text-rl-blue">✦</span> Funil: Leads → MQL → SQL → Vendas</li>
            <li className="flex items-center gap-1.5"><span className="text-rl-blue">✦</span> Custo por etapa do funil</li>
          </ul>
        </button>

        {/* B2C */}
        <button
          onClick={() => onSelect('b2c')}
          className="glass-card p-8 text-left hover:border-rl-green/50 transition-all cursor-pointer group"
        >
          <div className="text-4xl mb-4">🛒</div>
          <div className="text-xl font-bold text-rl-text mb-2">B2C</div>
          <div className="text-sm text-rl-muted leading-relaxed mb-4">
            Ciclo de venda curto, decisão rápida de compra
          </div>
          <ul className="space-y-1.5 text-xs text-rl-muted">
            <li className="flex items-center gap-1.5"><span className="text-rl-green">✦</span> Acompanhamento diário</li>
            <li className="flex items-center gap-1.5"><span className="text-rl-green">✦</span> Leads, Vendas, ROAS</li>
            <li className="flex items-center gap-1.5"><span className="text-rl-green">✦</span> Custo por lead automático</li>
          </ul>
        </button>
      </div>
    </div>
  )
}
