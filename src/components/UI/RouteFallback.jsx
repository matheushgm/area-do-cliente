import { Loader2 } from 'lucide-react'

// Fallback do <Suspense> enquanto o chunk da rota baixa. Mesmo visual do
// loading que ProjectDetail já usava enquanto os projetos carregavam.
export default function RouteFallback({ label = 'Carregando...' }) {
  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-rl-muted">
        <Loader2 className="w-8 h-8 animate-spin text-rl-purple" />
        <p className="text-sm">{label}</p>
      </div>
    </div>
  )
}
