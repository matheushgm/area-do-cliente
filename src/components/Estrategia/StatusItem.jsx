export default function StatusItem({ icon: Icon, label, ok, detail, color }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-rl-border/40 last:border-0">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
        ok ? `bg-rl-green/10` : 'bg-rl-border/60'
      }`}>
        <Icon className={`w-3.5 h-3.5 ${ok ? 'text-rl-green' : 'text-rl-muted'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${ok ? 'text-rl-text' : 'text-rl-muted'}`}>{label}</p>
        {detail && <p className="text-xs text-rl-muted truncate">{detail}</p>}
      </div>
      <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
        ok
          ? 'text-rl-green bg-rl-green/10 border-rl-green/20'
          : 'text-rl-muted bg-rl-border/30 border-rl-border'
      }`}>
        {ok ? '✓ Preenchido' : '○ Pendente'}
      </div>
    </div>
  )
}
