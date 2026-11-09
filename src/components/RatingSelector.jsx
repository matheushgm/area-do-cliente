import { useI18n } from '../i18n'

// Shared rating selector: Bom / Médio / Ruim
// Clicking the same option again deselects (sets to null)

const OPTS = [
  {
    id:     'bom',
    label:  'ui.avaliacao.bom',
    active: 'text-rl-green bg-rl-green/15 border-rl-green/40',
  },
  {
    id:     'medio',
    label:  'ui.avaliacao.medio',
    active: 'text-rl-gold bg-rl-gold/15 border-rl-gold/40',
  },
  {
    id:     'ruim',
    label:  'ui.avaliacao.ruim',
    active: 'text-red-400 bg-red-400/15 border-red-400/40',
  },
]

export default function RatingSelector({ value, onChange }) {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {OPTS.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id === value ? null : o.id)}
          title={t(o.label)}
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${
            value === o.id
              ? o.active
              : 'text-rl-muted bg-rl-surface border-rl-border hover:border-rl-muted/60 hover:text-rl-text'
          }`}
        >
          {t(o.label)}
        </button>
      ))}
    </div>
  )
}
