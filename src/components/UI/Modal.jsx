import { useEffect } from 'react'

const MAX_WIDTH_MAP = {
  sm:  'max-w-sm',
  md:  'max-w-md',
  lg:  'max-w-lg',
  xl:  'max-w-xl',
  '2xl': 'max-w-2xl',
}

export default function Modal({ onClose, maxWidth = 'md', className = '', children }) {
  useEffect(() => {
    const handler = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className={`relative glass-card w-full p-6 border border-rl-border animate-slide-up shadow-2xl ${MAX_WIDTH_MAP[maxWidth]} ${className}`}>
        {children}
      </div>
    </div>
  )
}
