import { fmtBRL } from './campaignHelpers'

export default function ValueCell({ label, value }) {
  return (
    <div className="text-right">
      <p className="text-xs text-rl-muted leading-tight">{label}</p>
      <p className="text-sm font-bold text-rl-text">{fmtBRL(value)}</p>
    </div>
  )
}
