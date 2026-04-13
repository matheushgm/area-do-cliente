import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Library, Loader2, Film, Image, ChevronDown, Zap, Download, Maximize2 } from 'lucide-react'

const FUNILS = [
  'Funil de Webinar',
  'Funil de Aplicação',
  'Funil de Diagnóstico',
  'Funil de E-commerce (Venda Direta)',
  'Funil de Webinar Pago',
  'Funil de Isca Digital',
  'Funil de VSL',
  'Funil de Quiz',
  'Lançamento',
  'Funil de Desafio',
  'Funil Win-Your-Money-Back',
]

function AdCard({ ad }) {
  async function handleDownload() {
    try {
      const res  = await fetch(ad.url)
      const blob = await res.blob()
      const ext  = ad.url.split('.').pop().split('?')[0] || (ad.type === 'video' ? 'mp4' : 'jpg')
      const name = (ad.title || `anuncio-${ad.id.slice(0, 8)}`).replace(/\s+/g, '-') + '.' + ext
      const href = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = href; a.download = name
      a.click()
      URL.revokeObjectURL(href)
    } catch {
      window.open(ad.url, '_blank')
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col group relative">
      <div className="relative bg-gray-50 aspect-video flex items-center justify-center overflow-hidden">
        {ad.type === 'video' ? (
          <video
            src={ad.url}
            controls
            className="w-full h-full object-cover"
            preload="metadata"
          />
        ) : (
          <img
            src={ad.url}
            alt={ad.title || 'Anúncio'}
            className="w-full h-full object-cover"
          />
        )}

        {/* Action buttons */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <a
            href={ad.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Visualizar"
            className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-purple-600/80 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={handleDownload}
            title="Baixar arquivo"
            className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-blue-600/80 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-3 flex flex-col gap-1.5">
        <div className="flex flex-wrap gap-1.5">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            ad.type === 'video'
              ? 'bg-purple-100 text-purple-600'
              : 'bg-blue-100 text-blue-600'
          }`}>
            {ad.type === 'video' ? 'Vídeo' : 'Estático'}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 truncate max-w-[200px]">
            {ad.funil}
          </span>
        </div>
        {ad.title && (
          <p className="text-xs font-semibold text-gray-800 line-clamp-1">{ad.title}</p>
        )}
        {ad.notes && (
          <p className="text-[11px] text-gray-500 line-clamp-2">{ad.notes}</p>
        )}
      </div>
    </div>
  )
}

export default function BancoDeAnunciosPublico() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [ads,         setAds]         = useState([])
  const [loading,     setLoading]     = useState(true)
  const [filterType,  setFilterType]  = useState(searchParams.get('type')  || 'todos')
  const [filterFunil, setFilterFunil] = useState(searchParams.get('funil') || 'todos')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('ad_bank')
        .select('*')
        .order('created_at', { ascending: false })
      setAds(data || [])
      setLoading(false)
    }
    load()
  }, [])

  // Sync filters to URL
  useEffect(() => {
    const params = {}
    if (filterType  !== 'todos') params.type  = filterType
    if (filterFunil !== 'todos') params.funil = filterFunil
    setSearchParams(params, { replace: true })
  }, [filterType, filterFunil, setSearchParams])

  const filtered = ads.filter((ad) => {
    if (filterType  !== 'todos' && ad.type  !== filterType)  return false
    if (filterFunil !== 'todos' && ad.funil !== filterFunil) return false
    return true
  })

  const activeLabel = [
    filterType  !== 'todos' ? (filterType === 'video' ? 'Vídeo' : 'Estático') : null,
    filterFunil !== 'todos' ? filterFunil : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-none">Revenue Lab</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Banco de Anúncios</p>
            </div>
          </div>
          {activeLabel && (
            <span className="text-xs px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 font-medium">
              {activeLabel}
            </span>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Type pills */}
          <div className="flex gap-1 p-1 bg-white rounded-xl border border-gray-200 shadow-sm">
            {[
              { id: 'todos',    label: 'Todos',    Icon: Library },
              { id: 'video',    label: 'Vídeo',    Icon: Film },
              { id: 'estatico', label: 'Estático', Icon: Image },
            ].map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setFilterType(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filterType === id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Funil select */}
          <div className="relative">
            <select
              value={filterFunil}
              onChange={(e) => setFilterFunil(e.target.value)}
              className="text-xs border border-gray-200 rounded-xl bg-white px-3 py-2 pr-7 text-gray-700 appearance-none cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 min-w-[180px]"
            >
              <option value="todos">Todos os funis</option>
              {FUNILS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>

          <span className="text-xs text-gray-400 ml-auto">
            {loading ? '...' : `${filtered.length} anúncio${filtered.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Carregando...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
            <Library className="w-10 h-10 opacity-30" />
            <p className="text-sm">Nenhum anúncio encontrado com esses filtros</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((ad) => (
              <AdCard key={ad.id} ad={ad} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
