import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BANCO_FUNIS as FUNILS } from '../lib/constants'
import { WIREFRAMES } from '../components/Wireframes'
import { Layout, Loader2, ChevronDown, Zap, ExternalLink, LayoutTemplate, X } from 'lucide-react'

const READY_WIREFRAMES = Object.values(WIREFRAMES).filter((w) => w.ready)

function prettyDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

function TemplatePreview({ wireframe, onClose }) {
  const Component = wireframe.Component
  return (
    <div className="fixed inset-0 z-50 bg-black/80 overflow-y-auto" onClick={onClose}>
      <div className="min-h-full py-8 px-4 flex justify-center">
        <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-white">{wireframe.label}</h3>
              <p className="text-xs text-white/60 mt-0.5">Modelo padrão · estrutura de referência</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <Component content={wireframe.emptyContent || {}} />
        </div>
      </div>
    </div>
  )
}

function LpCard({ lp }) {
  return (
    <a
      href={lp.url || undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col group relative"
    >
      <div className="relative bg-gray-50 aspect-[4/3] flex items-center justify-center overflow-hidden">
        {lp.image_url ? (
          <img
            src={lp.image_url}
            alt={lp.title || 'Landing page'}
            className="w-full h-full object-cover object-top"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-400 p-4 text-center">
            <Layout className="w-8 h-8 opacity-40" />
            <span className="text-[11px] break-all">{lp.url ? prettyDomain(lp.url) : 'Sem preview'}</span>
          </div>
        )}
        {lp.url && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="p-1.5 rounded-lg bg-black/60 text-white block">
              <ExternalLink className="w-3.5 h-3.5" />
            </span>
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col gap-1.5">
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 truncate max-w-full w-fit">
          {lp.funil}
        </span>
        {lp.title && (
          <p className="text-xs font-semibold text-gray-800 line-clamp-1">{lp.title}</p>
        )}
        {lp.notes && (
          <p className="text-[11px] text-gray-500 line-clamp-2">{lp.notes}</p>
        )}
        {lp.url && (
          <span className="text-[10px] text-indigo-500 truncate">🔗 {prettyDomain(lp.url)}</span>
        )}
      </div>
    </a>
  )
}

export default function BancoDeLPsPublico() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [lps,         setLps]         = useState([])
  const [loading,     setLoading]     = useState(true)
  const [filterFunil, setFilterFunil] = useState(searchParams.get('funil') || 'todos')
  const [templateOpen, setTemplateOpen] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('lp_bank')
        .select('*')
        .order('created_at', { ascending: false })
      setLps(data || [])
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    const params = {}
    if (filterFunil !== 'todos') params.funil = filterFunil
    setSearchParams(params, { replace: true })
  }, [filterFunil, setSearchParams])

  const filtered = lps.filter((lp) => {
    if (filterFunil !== 'todos' && lp.funil !== filterFunil) return false
    return true
  })

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
              <p className="text-[10px] text-gray-400 mt-0.5">Banco de LP</p>
            </div>
          </div>
          {filterFunil !== 'todos' && (
            <span className="text-xs px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 font-medium">
              {filterFunil}
            </span>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* Modelos padrão */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-4 h-4 text-purple-500" />
            <h2 className="text-sm font-bold text-gray-800">Modelos padrão</h2>
            <span className="text-xs text-gray-400">estruturas de referência de landing page</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {READY_WIREFRAMES.map((wf) => (
              <button
                key={wf.id}
                onClick={() => setTemplateOpen(wf)}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-left flex flex-col gap-2 hover:border-purple-300 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                    <LayoutTemplate className="w-4 h-4 text-purple-500" />
                  </div>
                  <span className="text-sm font-bold text-gray-800">{wf.name}</span>
                </div>
                <p className="text-[11px] text-gray-500 line-clamp-2 leading-snug">{wf.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
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
            {loading ? '...' : `${filtered.length} LP${filtered.length !== 1 ? 's' : ''}`}
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
            <Layout className="w-10 h-10 opacity-30" />
            <p className="text-sm">Nenhuma landing page encontrada com esses filtros</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((lp) => (
              <LpCard key={lp.id} lp={lp} />
            ))}
          </div>
        )}
      </div>

      {templateOpen && (
        <TemplatePreview wireframe={templateOpen} onClose={() => setTemplateOpen(null)} />
      )}
    </div>
  )
}
