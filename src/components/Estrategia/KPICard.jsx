export default function KPICard({ label, value, sub, colorClass }) {
  return (
    <div className="bg-rl-bg rounded-2xl p-4 border border-rl-border">
      <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-black ${colorClass}`}>{value}</p>
      {sub && <p className="text-xs text-rl-muted mt-1">{sub}</p>}
    </div>
  )
}
