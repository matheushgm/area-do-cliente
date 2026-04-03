import { useState } from 'react'
import { PlayCircle, ChevronDown, X } from 'lucide-react'

export default function VideoGuide({ videoId, label = 'Ver como preencher este módulo' }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`rounded-2xl border transition-all overflow-hidden ${
      open ? 'border-blue-700/50 bg-rl-surface/60' : 'border-blue-800/60 bg-rl-surface/30'
    }`}>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left group bg-blue-900/80 hover:bg-blue-800/90 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-700/50 group-hover:bg-blue-600/60 transition-all">
            <PlayCircle className="w-4 h-4 text-blue-200" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{label}</p>
            <p className="text-xs text-blue-300">{open ? 'Clique para fechar' : 'Assista ao vídeo explicativo antes de preencher'}</p>
          </div>
        </div>
        {open
          ? <X className="w-4 h-4 text-blue-300 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-blue-300 shrink-0 group-hover:text-white transition-colors" />
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
