import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Calculator, Plus, Briefcase, Package, Cloud, Loader2, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import PrecificacaoCard from '../components/Precificacao/PrecificacaoCard'
import PrecificacaoItemModal from '../components/Precificacao/PrecificacaoItemModal'

const EMPTY = { servicos: [], produtos: [], saas: [] }

// Rótulo no singular por aba — usado nos botões, contadores e estados vazios.
const SINGULAR = { servicos: 'serviço', produtos: 'produto', saas: 'SaaS' }
const singular = (tab) => SINGULAR[tab] || 'item'

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

export default function PrecificacaoPublic() {
  const { token } = useParams()
  const [loading, setLoading]       = useState(true)
  const [error,   setError]         = useState(null)
  const [company, setCompany]       = useState('')
  const [data,    setData]          = useState(EMPTY)   // { servicos, produtos }
  const [tab,     setTab]           = useState('servicos')
  const [editingItem, setEditingItem] = useState(null)  // item | {} (novo) | null (fechado)
  const [saveStatus, setSaveStatus] = useState('idle')
  const debounceRef = useRef(null)

  const items = data[tab] || []

  // ── Load ───────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`/api/precificacao-form?token=${encodeURIComponent(token)}`)
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || 'Erro ao carregar.')
        setCompany(body.companyName || '')
        setData({
          servicos: Array.isArray(body.precificacao?.servicos) ? body.precificacao.servicos : [],
          produtos: Array.isArray(body.precificacao?.produtos) ? body.precificacao.produtos : [],
          saas:     Array.isArray(body.precificacao?.saas)     ? body.precificacao.saas     : [],
        })
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  // ── Debounced save ─────────────────────────────────────────────────────
  const scheduleSave = useCallback((next) => {
    clearTimeout(debounceRef.current)
    setSaveStatus('saving')
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/precificacao-form', {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ token, precificacao: next }),
        })
        if (!res.ok) throw new Error()
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2500)
      } catch {
        setSaveStatus('idle')
      }
    }, 1000)
  }, [token])

  function persist(next) {
    setData(next)
    scheduleSave(next)
  }

  function handleSaveItem(item) {
    const list = data[tab] || []
    const exists = list.some((x) => x.id === item.id)
    const nextList = exists
      ? list.map((x) => (x.id === item.id ? item : x))
      : [...list, item]
    persist({ ...data, [tab]: nextList })
    setEditingItem(null)
  }

  function handleDeleteItem(id) {
    const list = data[tab] || []
    persist({ ...data, [tab]: list.filter((x) => x.id !== id) })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-rl-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-rl-gold animate-spin" />
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
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rl-gold/10 flex items-center justify-center shrink-0">
              <Calculator className="w-5 h-5 text-rl-gold" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-rl-muted font-bold">Precificação</p>
              <h1 className="text-base font-black text-rl-text leading-tight truncate">{company}</h1>
            </div>
          </div>
          <SaveBadge status={saveStatus} />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Instrução */}
        <div className="glass-card p-5 border-l-4 border-rl-gold/50">
          <p className="text-sm text-rl-text font-semibold mb-1">Como preencher</p>
          <p className="text-sm text-rl-muted leading-relaxed">
            Cadastre cada produto ou serviço com seus custos, impostos e a margem de lucro que você
            quer ganhar de fato. A ferramenta calcula o preço de venda ideal na hora. Os dados são
            salvos automaticamente conforme você preenche.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-rl-surface border border-rl-border w-fit">
          <TabButton
            active={tab === 'servicos'}
            onClick={() => setTab('servicos')}
            icon={Briefcase}
            label="Serviços"
            count={data.servicos?.length || 0}
          />
          <TabButton
            active={tab === 'produtos'}
            onClick={() => setTab('produtos')}
            icon={Package}
            label="Produtos"
            count={data.produtos?.length || 0}
          />
          <TabButton
            active={tab === 'saas'}
            onClick={() => setTab('saas')}
            icon={Cloud}
            label="SaaS"
            count={data.saas?.length || 0}
          />
        </div>

        {/* Botão novo item */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-rl-muted">
            {items.length} {singular(tab)}{items.length !== 1 ? 's' : ''} precificado{items.length !== 1 ? 's' : ''}
          </p>
          <button
            onClick={() => setEditingItem({})}
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-rl-purple text-white shadow-glow hover:bg-rl-purple/90 transition-all"
          >
            <Plus className="w-4 h-4" /> Novo {singular(tab)}
          </button>
        </div>

        {/* Lista */}
        {items.length === 0 ? (
          <EmptyState mode={tab} onCreate={() => setEditingItem({})} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {items.map((item) => (
              <PrecificacaoCard
                key={item.id}
                item={item}
                mode={tab}
                onEdit={() => setEditingItem(item)}
                onDelete={() => handleDeleteItem(item.id)}
              />
            ))}
          </div>
        )}

        {/* Rodapé */}
        <div className="pt-2 pb-8 text-center">
          <p className="text-xs text-rl-muted">Os dados são salvos automaticamente conforme você preenche.</p>
          <p className="text-xs text-rl-muted/60 mt-1">Revenue Lab © {new Date().getFullYear()}</p>
        </div>
      </div>

      {/* Modal */}
      {editingItem !== null && (
        <PrecificacaoItemModal
          mode={tab}
          initial={editingItem.id ? editingItem : null}
          onSave={handleSaveItem}
          onClose={() => setEditingItem(null)}
        />
      )}
    </div>
  )
}

// ─── Subcomponentes ──────────────────────────────────────────────────────────
function TabButton({ active, onClick, icon: Icon, label, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
        active
          ? 'bg-rl-gold text-white shadow-sm'
          : 'text-rl-muted hover:text-rl-text'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
      {count > 0 && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
          active ? 'bg-white/20 text-white' : 'bg-rl-surface border border-rl-border text-rl-muted'
        }`}>
          {count}
        </span>
      )}
    </button>
  )
}

function EmptyState({ mode, onCreate }) {
  const Icon = mode === 'servicos' ? Briefcase : mode === 'saas' ? Cloud : Package
  const label = singular(mode)
  return (
    <div className="rounded-xl border border-dashed border-rl-border bg-rl-surface/30 py-10 px-6 text-center space-y-3">
      <Icon className="w-8 h-8 text-rl-muted/40 mx-auto" />
      <div>
        <p className="text-sm font-semibold text-rl-text">
          Nenhum {label} precificado ainda.
        </p>
        <p className="text-xs text-rl-muted mt-1 max-w-md mx-auto">
          {mode === 'saas'
            ? 'Cadastre o primeiro plano pra calcular mensalidade, implantação e LTV considerando custos, impostos e a margem desejada.'
            : 'Adicione o primeiro item pra ver o preço de venda recomendado considerando custos, impostos e a margem desejada.'}
        </p>
      </div>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-rl-purple text-white shadow-glow hover:bg-rl-purple/90 transition-all"
      >
        <Plus className="w-4 h-4" /> Adicionar primeiro {label}
      </button>
    </div>
  )
}
