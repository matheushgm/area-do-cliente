import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  ShieldQuestion, Plus, Trash2, Loader2, AlertTriangle, CheckCircle2,
} from 'lucide-react'

const COLUMNS = [
  { id: 'tipo',      label: 'Tipo de objeção',          placeholder: 'Ex: "Está caro"' },
  { id: 'antecipar', label: 'Como antecipar a objeção',  placeholder: 'Ex: mostrar ROI antes do preço' },
  { id: 'causa',     label: 'Causa provável',           placeholder: 'Ex: não enxergou o valor' },
  { id: 'resposta',  label: 'Resposta para a objeção',   placeholder: 'Ex: "Quanto custa NÃO resolver?"' },
]

function SaveBadge({ status }) {
  if (status === 'saving') return (
    <span className="flex items-center gap-1.5 text-xs text-rl-muted">
      <Loader2 className="w-3 h-3 animate-spin" /> Salvando...
    </span>
  )
  if (status === 'saved') return (
    <span className="flex items-center gap-1.5 text-xs text-rl-green">
      <CheckCircle2 className="w-3 h-3" /> Salvo
    </span>
  )
  return null
}

export default function MatrizObjecaoPublic() {
  const { token } = useParams()
  const [loading, setLoading]     = useState(true)
  const [error,   setError]       = useState(null)
  const [company, setCompany]     = useState('')
  const [rows,    setRows]        = useState([])
  const [saveStatus, setSaveStatus] = useState('idle')
  const debounceRef = useRef(null)

  // ── Load ───────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`/api/matriz-objecao?token=${encodeURIComponent(token)}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao carregar.')
        setCompany(data.companyName || '')
        const loaded = Array.isArray(data.matriz?.rows) ? data.matriz.rows : []
        setRows(loaded.length ? loaded : [blankRow()])
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  function blankRow() {
    return { id: crypto.randomUUID(), tipo: '', antecipar: '', causa: '', resposta: '' }
  }

  // ── Debounced save ─────────────────────────────────────────────────────
  const scheduleSave = useCallback((next) => {
    clearTimeout(debounceRef.current)
    setSaveStatus('saving')
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/matriz-objecao', {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ token, matriz: { rows: next } }),
        })
        if (!res.ok) throw new Error()
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2500)
      } catch {
        setSaveStatus('idle')
      }
    }, 1200)
  }, [token])

  function update(next) {
    setRows(next)
    scheduleSave(next)
  }
  function addRow()              { update([...rows, blankRow()]) }
  function updateCell(id, c, v)  { update(rows.map((r) => (r.id === id ? { ...r, [c]: v } : r))) }
  function removeRow(id)         { update(rows.filter((r) => r.id !== id)) }

  if (loading) {
    return (
      <div className="min-h-screen bg-rl-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-rl-purple animate-spin" />
          <p className="text-rl-muted text-sm">Carregando...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-rl-bg flex items-center justify-center p-6">
        <div className="glass-card p-8 max-w-md w-full text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
          <h2 className="text-lg font-bold text-rl-text">Link inválido</h2>
          <p className="text-sm text-rl-muted">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-rl-bg">
      {/* Header */}
      <div className="border-b border-rl-border bg-white/85 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rl-purple/10 flex items-center justify-center shrink-0">
              <ShieldQuestion className="w-5 h-5 text-rl-purple" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-rl-muted font-bold">Matriz de objeção</p>
              <h1 className="text-base font-black text-rl-text leading-tight truncate">{company}</h1>
            </div>
          </div>
          <SaveBadge status={saveStatus} />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Instrução */}
        <div className="glass-card p-5 border-l-4 border-rl-purple/50">
          <p className="text-sm text-rl-text font-semibold mb-1">Como preencher</p>
          <p className="text-sm text-rl-muted leading-relaxed">
            Liste as principais objeções que aparecem nas suas vendas. Pra cada uma, descreva como
            antecipá-la, a causa provável e a melhor resposta. Os dados são salvos automaticamente.
          </p>
        </div>

        {/* Tabela */}
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-rl-surface/60 border-b border-rl-border">
                  {COLUMNS.map((c) => (
                    <th key={c.id} className="text-left px-3 py-2.5 min-w-[200px]">
                      <span className="text-[11px] font-black uppercase tracking-wider text-rl-text">{c.label}</span>
                    </th>
                  ))}
                  <th className="w-10 px-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-rl-border/40 align-top">
                    {COLUMNS.map((c) => (
                      <td key={c.id} className="px-2 py-2">
                        <textarea
                          value={row[c.id] || ''}
                          onChange={(e) => updateCell(row.id, c.id, e.target.value)}
                          rows={2}
                          placeholder={c.placeholder}
                          className="input-field w-full resize-y text-sm min-h-[48px]"
                        />
                      </td>
                    ))}
                    <td className="px-1 py-2 text-center">
                      <button
                        onClick={() => removeRow(row.id)}
                        className="p-1.5 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
                        title="Remover linha"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-rl-border">
            <button
              onClick={addRow}
              className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold px-3 py-2.5 rounded-xl border border-dashed border-rl-border text-rl-muted hover:text-rl-purple hover:border-rl-purple/40 transition-all"
            >
              <Plus className="w-4 h-4" /> Adicionar objeção
            </button>
          </div>
        </div>

        {/* Rodapé */}
        <div className="pt-2 pb-8 text-center">
          <p className="text-xs text-rl-muted">Os dados são salvos automaticamente conforme você preenche.</p>
          <p className="text-xs text-rl-muted/60 mt-1">Revenue Lab © {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  )
}
