export default function PctInput({ value, onChange, className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <input
        type="number"
        min={0}
        max={100}
        step="any"
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
        className="input-field pr-7 pl-2 text-right w-full text-sm tabular-nums"
      />
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-rl-muted text-[11px] font-semibold pointer-events-none">%</span>
    </div>
  )
}
