import { useState, useEffect, useRef, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Plus, Pencil, Trash2, Check, X, Calculator, ChevronLeft, Menu, Loader2 } from 'lucide-react'
import ROICalculator from '../components/ROICalculator'
import Toast from '../components/UI/Toast'
import { useToast } from '../hooks/useToast'
import { supabase } from '../lib/supabase'

// Ferramentas > Calculadora de ROI. Calculadoras avulsas, sem vínculo com cliente:
// cada uma nasce em branco (valores padrão), tem nome próprio e fica salva em
// public.roi_calculadoras (compartilhada pelo time).
export default function CalculadoraROI() {
  const { openSidebar } = useOutletContext()
  const { toast, showToast } = useToast()
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState(null)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const timers = useRef({})

  useEffect(() => {
    let cancelled = false
    supabase.from('roi_calculadoras').select('*').order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) showToast('Erro ao carregar as calculadoras.')
        else setLista(data || [])
        setLoading(false)
      })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), [])

  const active = lista.find((c) => c.id === activeId) || null

  const gravar = useCallback(async (id, patch) => {
    const { error } = await supabase.from('roi_calculadoras')
      .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) showToast('Não foi possível salvar. Tente de novo.')
  }, [showToast])

  async function criar() {
    const { data, error } = await supabase.from('roi_calculadoras')
      .insert({ nome: `Calculadora ${lista.length + 1}` }).select().single()
    if (error) { showToast('Não foi possível criar a calculadora.'); return }
    setLista((l) => [data, ...l])
    setActiveId(data.id)
    setRenaming(true)
    setRenameValue(data.nome)
  }

  async function excluir(id) {
    if (!window.confirm('Excluir esta calculadora de ROI? Essa ação não pode ser desfeita.')) return
    const { error } = await supabase.from('roi_calculadoras').delete().eq('id', id)
    if (error) { showToast('Não foi possível excluir.'); return }
    setLista((l) => l.filter((c) => c.id !== id))
    if (activeId === id) setActiveId(null)
  }

  function renomear() {
    const nome = renameValue.trim()
    if (nome && active) {
      setLista((l) => l.map((c) => (c.id === active.id ? { ...c, nome } : c)))
      gravar(active.id, { nome })
    }
    setRenaming(false)
  }

  // Chamado a cada edição; grava com debounce de 800 ms.
  function handlePersist(calc, result) {
    const id = activeId
    setLista((l) => l.map((c) => (c.id === id ? { ...c, calc, result } : c)))
    clearTimeout(timers.current[id])
    timers.current[id] = setTimeout(() => gravar(id, { calc, result }), 800)
  }

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-rl-border bg-rl-bg/90 backdrop-blur-xl">
        <button onClick={openSidebar} aria-label="Abrir menu de navegação"
          className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all">
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-bold text-rl-text text-sm">Calculadora de ROI</span>
      </div>

      <main className="flex-1 px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {active ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => { setActiveId(null); setRenaming(false) }}
                  className="inline-flex items-center gap-1.5 text-xs text-rl-muted hover:text-rl-text transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Todas as calculadoras
                </button>
                {renaming ? (
                  <div className="flex items-center gap-1 bg-rl-surface border border-rl-purple/40 rounded-xl px-2 py-1">
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') renomear()
                        if (e.key === 'Escape') setRenaming(false)
                      }}
                      className="bg-transparent text-sm text-rl-text outline-none w-56"
                    />
                    <button onClick={renomear} className="p-0.5 text-rl-green hover:bg-rl-green/10 rounded"><Check className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setRenaming(false)} className="p-0.5 text-rl-muted hover:bg-rl-surface rounded"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-rl-text">{active.nome}</h3>
                    <button
                      onClick={() => { setRenaming(true); setRenameValue(active.nome) }}
                      className="p-1 rounded text-rl-muted hover:text-rl-text hover:bg-rl-surface"
                      title="Renomear"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Projeto "stub": sem dados de cliente (defaults da calculadora); o nome vai no cabeçalho dos PDFs */}
              <ROICalculator
                key={active.id}
                project={{ id: null, companyName: active.nome }}
                overrideCalc={active.calc || undefined}
                onPersist={handlePersist}
              />
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3 flex-wrap">
                <div className="w-11 h-11 rounded-xl bg-rl-green/10 flex items-center justify-center shrink-0">
                  <Calculator className="w-5 h-5 text-rl-green" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-black text-rl-text leading-tight">Calculadora de ROI</h2>
                  <p className="text-sm text-rl-subtle mt-0.5">
                    Crie calculadoras avulsas a qualquer momento, em branco e com nome próprio (um prospect, um produto, uma simulação).
                    Não dependem dos dados de nenhum cliente.
                  </p>
                </div>
                <button onClick={criar} className="btn-primary flex items-center gap-2 text-sm">
                  <Plus className="w-4 h-4" /> Nova calculadora
                </button>
              </div>

              {loading ? (
                <div className="flex justify-center py-16 text-rl-muted"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : lista.length === 0 ? (
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
                          Atualizada em {new Date(c.updated_at).toLocaleDateString('pt-BR')}
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
            </>
          )}
        </div>
      </main>
      <Toast toast={toast} />
    </div>
  )
}
