import { useState } from 'react'
import { Calculator, Plus, Briefcase, Package, Cloud, Link2, Check } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../hooks/useToast'
import Toast from '../UI/Toast'
import PrecificacaoCard from './PrecificacaoCard'
import PrecificacaoItemModal from './PrecificacaoItemModal'

const EMPTY = { servicos: [], produtos: [], saas: [] }

// Rótulo no singular por aba — usado nos botões, contadores e estados vazios.
const SINGULAR = { servicos: 'serviço', produtos: 'produto', saas: 'SaaS' }
const singular = (tab) => SINGULAR[tab] || 'item'

export default function PrecificacaoModule({ project }) {
  const { updateProject } = useApp()
  const { toast, showToast } = useToast()

  const persisted = project.precificacao || EMPTY
  const [tab, setTab] = useState('servicos')          // 'servicos' | 'produtos'
  const [editingItem, setEditingItem] = useState(null) // item ou {} (novo) ou null (fechado)
  const [copied, setCopied] = useState(false)

  const items = persisted[tab] || []

  function persist(next) {
    updateProject(project.id, { precificacao: next })
  }

  // Token de compartilhamento — mesmo client_share_token usado por CRM/B2C/B2B/Matriz
  function getOrCreateShareToken() {
    if (project.clientShareToken) return project.clientShareToken
    const token = crypto.randomUUID()
    updateProject(project.id, { clientShareToken: token })
    return token
  }

  function handleShare() {
    const token = getOrCreateShareToken()
    if (!token) return
    const url = `${window.location.origin}/precificacao/${token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
      showToast('Link copiado pro clipboard!')
    }).catch(() => showToast('Link: ' + url))
  }

  function handleSaveItem(item) {
    const list = persisted[tab] || []
    const exists = list.some((x) => x.id === item.id)
    const nextList = exists
      ? list.map((x) => (x.id === item.id ? item : x))
      : [...list, item]
    persist({ ...persisted, [tab]: nextList })
    setEditingItem(null)
    showToast(exists ? 'Item atualizado!' : 'Item salvo!')
  }

  function handleDeleteItem(id) {
    const list = persisted[tab] || []
    const nextList = list.filter((x) => x.id !== id)
    persist({ ...persisted, [tab]: nextList })
    showToast('Item removido.')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <div className="w-11 h-11 rounded-xl bg-rl-gold/10 flex items-center justify-center shrink-0">
          <Calculator className="w-5 h-5 text-rl-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-black text-rl-text leading-tight">Precificação</h2>
          <p className="text-sm text-rl-subtle mt-0.5">
            Calcule o preço de venda correto de cada produto, serviço ou plano de SaaS considerando custos, impostos e a margem que o cliente quer ganhar de fato. Você pode compartilhar um link pro próprio cliente preencher.
          </p>
        </div>
        <button
          onClick={handleShare}
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-all shrink-0 ${
            copied
              ? 'bg-rl-green/10 border-rl-green/30 text-rl-green'
              : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-gold hover:border-rl-gold/30'
          }`}
          title="Cria/copia o link pro cliente preencher a precificação"
        >
          {copied
            ? <><Check className="w-4 h-4" /> Link copiado!</>
            : <><Link2 className="w-4 h-4" /> Compartilhar com cliente</>
          }
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-rl-surface border border-rl-border w-fit">
        <TabButton
          active={tab === 'servicos'}
          onClick={() => setTab('servicos')}
          icon={Briefcase}
          label="Serviços"
          count={persisted.servicos?.length || 0}
        />
        <TabButton
          active={tab === 'produtos'}
          onClick={() => setTab('produtos')}
          icon={Package}
          label="Produtos"
          count={persisted.produtos?.length || 0}
        />
        <TabButton
          active={tab === 'saas'}
          onClick={() => setTab('saas')}
          icon={Cloud}
          label="SaaS"
          count={persisted.saas?.length || 0}
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

      {/* Modal */}
      {editingItem !== null && (
        <PrecificacaoItemModal
          mode={tab}
          initial={editingItem.id ? editingItem : null}
          onSave={handleSaveItem}
          onClose={() => setEditingItem(null)}
        />
      )}

      <Toast toast={toast} />
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
