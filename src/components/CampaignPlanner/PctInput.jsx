export default function PctInput({ value, onChange, className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <input
        type="number"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
        className="input-field pr-8 text-right w-full"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-rl-muted text-sm pointer-events-none">%</span>
    </div>
  )
}
