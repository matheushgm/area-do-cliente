import { useState } from 'react'
import { PlayCircle, ChevronDown, X } from 'lucide-react'

export default function VideoGuide({ videoId, label = 'Ver como preencher este módulo' }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`rounded-2xl border transition-all overflow-hidden ${
      open ? 'border-rl-purple/30 bg-rl-surface/60' : 'border-rl-border bg-rl-surface/30'
    }`}>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left group"
      >
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${
            open ? 'bg-rl-purple/20' : 'bg-rl-purple/10 group-hover:bg-rl-purple/20'
          }`}>
            <PlayCircle className="w-4 h-4 text-rl-purple" />
          </div>
          <div>
            <p className="text-sm font-semibold text-rl-text">{label}</p>
            <p className="text-xs text-rl-muted">{open ? 'Clique para fechar' : 'Assista ao vídeo explicativo antes de preencher'}</p>
          </div>
        </div>
        {open
          ? <X className="w-4 h-4 text-rl-muted shrink-0" />
          : <ChevronDown className="w-4 h-4 text-rl-muted shrink-0 group-hover:text-rl-text transition-colors" />
        }
      </button>

      {/* Video embed */}
      {open && (
        <div className="px-5 pb-5">
          <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ paddingTop: '56.25%' }}>
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
              title={label}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full border-0"
            />
          </div>
        </div>
      )}
    </div>
  )
}
