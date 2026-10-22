import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Check, X, Calculator, ChevronLeft } from 'lucide-react'
import { useApp } from '../context/AppContext'
import ROICalculator from './ROICalculator'

// Calculadoras de ROI avulsas (Ferramentas): não puxam nem gravam nada do perfil
// do cliente. Cada uma nasce com os valores padrão da calculadora, tem nome próprio
// (ex.: o prospect ou o produto) e fica salva em project.roiLivres.
// Shape: [{ id, nome, calc, result, createdAt, updatedAt }].
export default function ROILivresModule({ project }) {
  const { updateProject } = useApp()
  const [lista, setLista] = useState(() => (Array.isArray(project.roiLivres) ? project.roiLivres : []))
  const [activeId, setActiveId] = useState(null)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')

  const active = useMemo(() => lista.find((c) => c.id === activeId) || null, [lista, activeId])

  function persist(next) {
    setLista(next)
    updateProject(project.id, { roiLivres: next })
  }

  function criar() {
    const now = new Date().toISOString()
    const nova = {
      id: crypto.randomUUID(),
      nome: `Calculadora ${lista.length + 1}`,
      calc: null,
      result: null,
      createdAt: now,
      updatedAt: now,
    }
    persist([...lista, nova])
    setActiveId(nova.id)
    setRenamingId(nova.id)
    setRenameValue(nova.nome)
  }

  function excluir(id) {
    if (!window.confirm('Excluir esta calculadora de ROI? Essa ação não pode ser desfeita.')) return
    persist(lista.filter((c) => c.id !== id))
    if (activeId === id) setActiveId(null)
  }

  function renomear(id) {
    const nome = renameValue.trim()
    if (nome) {
      persist(lista.map((c) => (c.id === id ? { ...c, nome, updatedAt: new Date().toISOString() } : c)))
    }
    setRenamingId(null)
    setRenameValue('')
  }

  function handlePersistActive(calc, result) {
    persist(lista.map((c) => (
      c.id === activeId ? { ...c, calc, result, updatedAt: new Date().toISOString() } : c
    )))
  }

  // ── View: calculadora aberta ───────────────────────────────────────────────
  if (active) {
    // Projeto "stub": sem orçamento/ticket do cliente (defaults da calculadora) e
    // com o nome da calculadora no cabeçalho dos PDFs.
    const stub = { id: project.id, companyName: active.nome }
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => { setActiveId(null); setRenamingId(null) }}
            className="inline-flex items-center gap-1.5 text-xs text-rl-muted hover:text-rl-text transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Todas as calculadoras
          </button>
          {renamingId === active.id ? (
            <div className="flex items-center gap-1 bg-rl-surface border border-rl-purple/40 rounded-xl px-2 py-1">
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') renomear(active.id)
                  if (e.key === 'Escape') { setRenamingId(null); setRenameValue('') }
                }}
                className="bg-transparent text-sm text-rl-text outline-none w-56"
              />
              <button onClick={() => renomear(active.id)} className="p-0.5 text-rl-green hover:bg-rl-green/10 rounded">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => { setRenamingId(null); setRenameValue('') }} className="p-0.5 text-rl-muted hover:bg-rl-surface rounded">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-rl-text">{active.nome}</h3>
              <button
                onClick={() => { setRenamingId(active.id); setRenameValue(active.nome) }}
                className="p-1 rounded text-rl-muted hover:text-rl-text hover:bg-rl-surface"
                title="Renomear"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <ROICalculator
          key={active.id}
          project={stub}
          overrideCalc={active.calc || undefined}
          onPersist={handlePersistActive}
        />
      </div>
    )
  }

  // ── View: lista ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="w-11 h-11 rounded-xl bg-rl-green/10 flex items-center justify-center shrink-0">
          <Calculator className="w-5 h-5 text-rl-green" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-black text-rl-text leading-tight">Calculadora de ROI</h2>
          <p className="text-sm text-rl-subtle mt-0.5">
            Crie calculadoras avulsas a qualquer momento, em branco e com nome próprio (um prospect, um produto, uma simulação).
            Elas não usam nem alteram os dados do perfil do cliente.
          </p>
        </div>
        <button onClick={criar} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Nova calculadora
        </button>
      </div>

      {lista.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <p className="text-sm text-rl-muted mb-4">Nenhuma calculadora criada ainda.</p>
          <button onClick={criar} className="btn-primary inline-flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Criar a primeira
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lista.map((c) => (
            <div key={c.id} className="glass-card p-5 group relative hover:border-rl-green/50 transition-all">
              <button type="button" onClick={() => setActiveId(c.id)} className="text-left w-full">
                <h3 className="text-base font-bold text-rl-text mb-1 pr-6">{c.nome}</h3>
                <p className="text-xs text-rl-muted">
                  {c.result
                    ? `${c.result.vendasNecessarias} vendas · ${c.result.leadsNecessarios} leads necessários`
                    : 'Ainda sem cálculo'}
                </p>
                <p className="text-[11px] text-rl-muted/70 mt-2">
                  Atualizada em {new Date(c.updatedAt).toLocaleDateString('pt-BR')}
                </p>
              </button>
              <button
                onClick={() => excluir(c.id)}
                className="absolute top-3 right-3 p-1 rounded text-rl-muted opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-400/10 transition-all"
                title="Excluir"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
