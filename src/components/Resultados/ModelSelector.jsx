import { useI18n } from '../../i18n'

export default function ModelSelector({ onSelect }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-rl-text mb-2">{t('resultados.modelo.titulo')}</h2>
        <p className="text-rl-muted text-sm max-w-md mx-auto">
          {t('resultados.modelo.sub')}
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
            {t('resultados.modelo.b2bDesc')}
          </div>
          <ul className="space-y-1.5 text-xs text-rl-muted">
            <li className="flex items-center gap-1.5"><span className="text-rl-blue">✦</span> {t('resultados.modelo.b2bSemanal')}</li>
            <li className="flex items-center gap-1.5"><span className="text-rl-blue">✦</span> {t('resultados.modelo.b2bFunil')}</li>
            <li className="flex items-center gap-1.5"><span className="text-rl-blue">✦</span> {t('resultados.modelo.b2bCusto')}</li>
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
            {t('resultados.modelo.b2cDesc')}
          </div>
          <ul className="space-y-1.5 text-xs text-rl-muted">
            <li className="flex items-center gap-1.5"><span className="text-rl-green">✦</span> {t('resultados.modelo.b2cDiario')}</li>
            <li className="flex items-center gap-1.5"><span className="text-rl-green">✦</span> {t('resultados.modelo.b2cMetricas')}</li>
            <li className="flex items-center gap-1.5"><span className="text-rl-green">✦</span> {t('resultados.modelo.b2cCusto')}</li>
          </ul>
        </button>
      </div>
    </div>
  )
}
