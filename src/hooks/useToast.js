import { useState, useRef, useCallback } from 'react'

export function useToast() {
  const [toast, setToast] = useState(null) // { message, type } | null
  const timerRef = useRef(null)

  const showToast = useCallback((message, type = 'success', duration = 2800) => {
    clearTimeout(timerRef.current)
    setToast({ message, type })
    timerRef.current = setTimeout(() => setToast(null), duration)
  }, [])

  return { toast, showToast }
}
