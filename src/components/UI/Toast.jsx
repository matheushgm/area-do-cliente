import { CheckCircle2, AlertTriangle } from 'lucide-react'

export default function Toast({ toast }) {
  if (!toast) return null
  const isError = toast.type === 'error'
  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-2xl text-sm font-medium animate-slide-up ${
      isError
        ? 'bg-red-500/10 border-red-500/30 text-red-400'
        : 'bg-rl-card border-rl-green/30 text-rl-text'
    }`}>
      {isError
        ? <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
        : <CheckCircle2 className="w-4 h-4 shrink-0 text-rl-green" />
      }
      {toast.message}
    </div>
  )
}
