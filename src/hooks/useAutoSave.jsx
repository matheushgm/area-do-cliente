import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Auto-save hook com debounce.
 * Usa ref para saveFn → sempre chama a versão mais recente da função,
 * evitando closures obsoletas que causavam navegação inesperada.
 *
 * @param {Function} saveFn  - função de salvamento (pode ser async)
 * @param {number}   delay   - ms de debounce (padrão 1500)
 * @returns {{ trigger: Function, status: 'idle'|'pending'|'saved' }}
 */
export function useAutoSave(saveFn, delay = 1500) {
  const [status, setStatus] = useState('idle')
  const timerRef    = useRef(null)
  const latestArgs  = useRef(null)
  const resetTimer  = useRef(null)
  const saveFnRef   = useRef(saveFn)

  // Mantém saveFnRef sempre atualizado sem recriar trigger
  useEffect(() => { saveFnRef.current = saveFn }, [saveFn])

  const trigger = useCallback(
    (...args) => {
      latestArgs.current = args
      setStatus('pending')

      if (timerRef.current)  clearTimeout(timerRef.current)
      if (resetTimer.current) clearTimeout(resetTimer.current)

      timerRef.current = setTimeout(async () => {
        try {
          await saveFnRef.current(...latestArgs.current)
          setStatus('saved')
          resetTimer.current = setTimeout(() => setStatus('idle'), 2500)
        } catch {
          setStatus('idle')
        }
      }, delay)
    },
    [delay],
  )

  return { trigger, status }
}

/** Indicador visual de status para usar nos módulos */
export function AutoSaveIndicator({ status }) {
  if (status === 'idle') return null
  return (
    <span
      className={`text-xs font-medium flex items-center gap-1.5 transition-all ${
        status === 'saved' ? 'text-rl-green' : 'text-rl-muted'
      }`}
    >
      {status === 'pending' ? (
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
