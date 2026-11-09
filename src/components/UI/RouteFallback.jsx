import { Loader2 } from 'lucide-react'
import { useI18n } from '../../i18n'

// Fallback do <Suspense> enquanto o chunk da rota baixa. Mesmo visual do
// loading que ProjectDetail já usava enquanto os projetos carregavam.
export default function RouteFallback({ label }) {
  const { t } = useI18n()
  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-rl-muted">
        <Loader2 className="w-8 h-8 animate-spin text-rl-purple" />
        <p className="text-sm">{label ?? t('comum.carregando')}</p>
      </div>
    </div>
  )
}
