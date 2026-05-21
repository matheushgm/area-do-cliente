import { useMemo, useState } from 'react'
import { ShieldQuestion, Plus, Trash2, Link2, Check } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../hooks/useToast'
import Toast from '../UI/Toast'

// Colunas da matriz — usado tanto no header da tabela quanto no parser do form.
export const COLUMNS = [
  { id: 'tipo',      label: 'Tipo de objeção',         placeholder: 'Ex: "Está caro"',                       hint: 'A objeção como o cliente fala' },
  { id: 'antecipar', label: 'Como antecipar a objeção', placeholder: 'Ex: mostrar ROI antes do preço',        hint: 'O que fazer antes dela surgir' },
  { id: 'causa',     label: 'Causa provável',          placeholder: 'Ex: não enxergou o valor entregue',      hint: 'Por que o cliente pensa isso' },
  { id: 'resposta',  label: 'Resposta para a objeção',  placeholder: 'Ex: "Quanto custa NÃO resolver isso?"',  hint: 'O contorno na hora' },
]

const EMPTY = { rows: [] }

export default function MatrizObjecaoModule({ project }) {
  const { updateProject } = useApp()
  const { toast, showToast } = useToast()

  const persisted = project.matrizObjecao || EMPTY
  const [rows, setRows] = useState(() => (Array.isArray(persisted.rows) ? persisted.rows : []))
  const [copied, setCopied] = useState(false)

  function persist(next) {
    setRows(next)
    updateProject(project.id, { matrizObjecao: { rows: next } })
  }

  function addRow() {
    persist([...rows, { id: crypto.randomUUID(), tipo: '', antecipar: '', causa: '', resposta: '' }])
  }

  function updateCell(id, col, value) {
    persist(rows.map((r) => (r.id === id ? { ...r, [col]: value } : r)))
  }

  function removeRow(id) {
    persist(rows.filter((r) => r.id !== id))
  }

  // Token de compartilhamento — mesmo client_share_token usado por CRM/B2C/B2B
  function getOrCreateShareToken() {
    if (project.clientShareToken) return project.clientShareToken
    const token = crypto.randomUUID()
    updateProject(project.id, { clientShareToken: token })
    return token
  }

  function handleShare() {
    const token = getOrCreateShareToken()
    if (!token) return
    const url = `${window.location.origin}/objecoes/${token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
      showToast('Link copiado pro clipboard!')
    }).catch(() => showToast('Link: ' + url))
  }

  const filledCount = useMemo(
    () => rows.filter((r) => r.tipo || r.antecipar || r.causa || r.resposta).length,
    [rows]
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <div className="w-11 h-11 rounded-xl bg-rl-purple/10 flex items-center justify-center shrink-0">
          <ShieldQuestion className="w-5 h-5 text-rl-purple" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-black text-rl-text leading-tight">Matriz de Objeção</h2>
          <p className="text-sm text-rl-subtle mt-0.5 max-w-2xl">
            Mapeie as objeções de venda do cliente: como antecipar, a causa provável e a melhor
            resposta. Você pode compartilhar um link pro próprio cliente preencher junto.
          </p>
        </div>
        <button
          onClick={handleShare}
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-all shrink-0 ${
            copied
              ? 'bg-rl-green/10 border-rl-green/30 text-rl-green'
              : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-purple hover:border-rl-purple/30'
          }`}
          title="Cria/copia o link pro cliente preencher a matriz"
        >
          {copied
            ? <><Check className="w-4 h-4" /> Link copiado!</>
            : <><Link2 className="w-4 h-4" /> Compartilhar com cliente</>
          }
        </button>
      </div>

      {/* Tabela */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-rl-surface/60 border-b border-rl-border">
                {COLUMNS.map((c) => (
                  <th key={c.id} className="text-left px-3 py-2.5 align-top min-w-[200px]">
                    <span className="text-[11px] font-black uppercase tracking-wider text-rl-text">{c.label}</span>
                    <span className="block text-[10px] text-rl-muted font-normal normal-case mt-0.5">{c.hint}</span>
                  </th>
                ))}
                <th className="w-10 px-2" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="px-4 py-10 text-center text-sm text-rl-muted">
                    Nenhuma objeção cadastrada ainda. Clique em <strong>&ldquo;Adicionar objeção&rdquo;</strong> abaixo.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-rl-border/40 align-top group">
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
                ))
              )}
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

      {rows.length > 0 && (
        <p className="text-[11px] text-rl-muted text-center">
          {filledCount} objeç{filledCount === 1 ? 'ão' : 'ões'} cadastrada{filledCount === 1 ? '' : 's'} · salvas automaticamente
        </p>
      )}

      <Toast toast={toast} />
    </div>
  )
}
