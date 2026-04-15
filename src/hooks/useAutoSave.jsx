import { useApp } from '../context/AppContext'

/**
 * Indicador visual de auto-save — lê saveStatus diretamente do AppContext.
 * Não precisa de props; reflete o estado global de escrita no Supabase.
 */
export function AutoSaveIndicator() {
  const { saveStatus } = useApp()
  if (saveStatus === 'idle') return null
  return (
    <span
      className={`text-xs font-medium flex items-center gap-1.5 transition-all ${
        saveStatus === 'saved' ? 'text-rl-green' : 'text-rl-muted'
      }`}
    >
      {saveStatus === 'saving' ? (
        <>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-rl-muted animate-pulse" />
          Salvando…
        </>
      ) : (
        <>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-rl-green" />
          Salvo
        </>
      )}
    </span>
  )
}
