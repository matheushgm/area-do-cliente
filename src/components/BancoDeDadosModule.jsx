import { useState, useEffect, useMemo, useRef } from 'react'
import PropTypes from 'prop-types'
import Modal from './UI/Modal'
import Toast from './UI/Toast'
import { useToast } from '../hooks/useToast'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import {
  Database, Plus, Trash2, Copy, Check, Loader2, Search, Download,
  Table2, Columns3, Webhook, ChevronDown, Code2, X, Sparkles,
  Plug, Wand2, Send, AlertTriangle,
} from 'lucide-react'

const DEFAULT_CRM = {
  enabled: false, endpoint: '', method: 'POST', headers: [],
  bodyTemplate: '', docsUrl: '', docsText: '', notas: '',
}

/** POST autenticado (envia o JWT do Supabase) para os endpoints /api/crm-*. */
async function authFetch(url, body) {
  const { data } = (await supabase?.auth.getSession()) ?? {}
  const token = data?.session?.access_token
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  const payload = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, payload }
}

/** Valor de exemplo por tipo, para o "Testar envio" quando não há lead real. */
function exemploPorCampo(c) {
  switch (c.type) {
    case 'email':  return 'lead@exemplo.com'
    case 'phone':  return '(62) 99999-9999'
    case 'url':    return 'https://exemplo.com/lp'
    case 'number': return '100'
    case 'date':   return '2026-01-01'
    case 'select': return (c.options || [])[0] || 'Opção'
    default:       return `Exemplo ${c.label || c.key}`
  }
}

// ── Tipos de campo ────────────────────────────────────────────────────────────
const FIELD_TYPES = [
  { id: 'text',   label: 'Texto' },
  { id: 'email',  label: 'E-mail' },
  { id: 'phone',  label: 'Telefone' },
  { id: 'url',    label: 'URL' },
  { id: 'number', label: 'Número' },
  { id: 'date',   label: 'Data' },
  { id: 'select', label: 'Seleção (dropdown)' },
]

const TEMPLATES = {
  leads: {
    label: 'Captação de leads (com UTMs)',
    campos: [
      { key: 'nome',         label: 'Nome',     type: 'text' },
      { key: 'email',        label: 'E-mail',   type: 'email' },
      { key: 'whatsapp',     label: 'Whatsapp', type: 'phone' },
      { key: 'url',          label: 'URL',      type: 'url' },
      { key: 'utm_source',   label: 'Utm Source',   type: 'text' },
      { key: 'utm_medium',   label: 'Utm Medium',   type: 'text' },
      { key: 'utm_campaign', label: 'Utm Campaign', type: 'text' },
      { key: 'utm_content',  label: 'Utm Content',  type: 'text' },
      { key: 'utm_term',     label: 'Utm Term',     type: 'text' },
      { key: 'ip',           label: 'IP',       type: 'text' },
    ],
  },
  blank: { label: 'Em branco', campos: [] },
}

const slugify = (s) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'campo'

const fmtDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''

export default function BancoDeDadosModule({ project }) {
  const { user } = useApp()
  const { toast, showToast } = useToast()

  const [bancos, setBancos] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)

  const [registros, setRegistros] = useState([])
  const [loadingReg, setLoadingReg] = useState(false)

  const [tab, setTab] = useState('planilha') // planilha | campos | webhook
  const [busca, setBusca] = useState('')
  const [copied, setCopied] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoTemplate, setNovoTemplate] = useState('leads')

  const saveTimers = useRef({})

  const selected = useMemo(() => bancos.find((b) => b.id === selectedId) || null, [bancos, selectedId])
  const campos = useMemo(() => selected?.campos || [], [selected])

  // ── Carregar bancos DESTE cliente ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!supabase || !project?.id) { setLoading(false); return }
      setLoading(true)
      const { data, error } = await supabase
        .from('bancos_dados')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: true })
      if (cancelled) return
      if (error) { console.error('[BancoDeDados]', error.message); showToast('Erro ao carregar', 'error') }
      const list = data || []
      setBancos(list)
      setSelectedId((prev) => prev || list[0]?.id || null)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [project?.id, showToast])

  // ── Registros do banco selecionado + realtime ──────────────────────────────
  useEffect(() => {
    if (!selectedId || !supabase) { setRegistros([]); return }
    let cancelled = false
    setLoadingReg(true)
    supabase
      .from('bancos_dados_registros')
      .select('*')
      .eq('banco_id', selectedId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('[BancoDeDados] reg', error.message)
        setRegistros(data || [])
        setLoadingReg(false)
      })

    const ch = supabase
      .channel(`bd-${selectedId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bancos_dados_registros', filter: `banco_id=eq.${selectedId}` },
        (payload) => setRegistros((prev) => (prev.some((r) => r.id === payload.new.id) ? prev : [payload.new, ...prev])))
      .subscribe()

    return () => { cancelled = true; supabase.removeChannel(ch) }
  }, [selectedId])

  const criarBanco = async () => {
    const nome = novoNome.trim()
    if (!nome) return
    const { data, error } = await supabase
      .from('bancos_dados')
      .insert({ nome, campos: TEMPLATES[novoTemplate].campos, project_id: project.id, created_by: user?.id || null })
      .select('*')
      .single()
    if (error) { showToast('Erro ao criar banco', 'error'); return }
    setBancos((prev) => [...prev, data])
    setSelectedId(data.id)
    setShowCreate(false); setNovoNome(''); setNovoTemplate('leads')
    setTab('webhook')
    showToast('Banco criado!')
  }

  const excluirBanco = async (b) => {
    if (!window.confirm(`Excluir "${b.nome}" e todos os registros?`)) return
    const { error } = await supabase.from('bancos_dados').delete().eq('id', b.id)
    if (error) { showToast('Erro ao excluir', 'error'); return }
    setBancos((prev) => prev.filter((x) => x.id !== b.id))
    setSelectedId((prev) => (prev === b.id ? null : prev))
  }

  const salvarCampos = async (novosCampos) => {
    setBancos((prev) => prev.map((b) => (b.id === selectedId ? { ...b, campos: novosCampos } : b)))
    const { error } = await supabase
      .from('bancos_dados')
      .update({ campos: novosCampos, updated_at: new Date().toISOString() })
      .eq('id', selectedId)
    if (error) showToast('Erro ao salvar campos', 'error')
  }

  const salvarCrmConfig = async (cfg) => {
    setBancos((prev) => prev.map((b) => (b.id === selectedId ? { ...b, crm_config: cfg } : b)))
    const { error } = await supabase
      .from('bancos_dados')
      .update({ crm_config: cfg, updated_at: new Date().toISOString() })
      .eq('id', selectedId)
    if (error) showToast('Erro ao salvar integração', 'error')
    else showToast('Integração salva!')
  }

  // Lead de exemplo para o "Testar envio": usa o último lead real se houver.
  const amostra = useMemo(() => {
    const ultimo = registros[0]?.dados
    if (ultimo && Object.keys(ultimo).length) return ultimo
    const o = {}
    for (const c of campos) o[c.key] = exemploPorCampo(c)
    return o
  }, [registros, campos])

  const addLinha = async () => {
    const { data, error } = await supabase
      .from('bancos_dados_registros')
      .insert({ banco_id: selectedId, dados: {}, origem: 'manual' })
      .select('*')
      .single()
    if (error) { showToast('Erro ao adicionar linha', 'error'); return }
    setRegistros((prev) => [data, ...prev])
  }

  const editarCelula = (regId, key, value) => {
    setRegistros((prev) => prev.map((r) => {
      if (r.id !== regId) return r
      const dados = { ...r.dados, [key]: value }
      clearTimeout(saveTimers.current[regId])
      saveTimers.current[regId] = setTimeout(async () => {
        const { error } = await supabase.from('bancos_dados_registros').update({ dados }).eq('id', regId)
        if (error) showToast('Erro ao salvar', 'error')
      }, 550)
      return { ...r, dados }
    }))
  }

  const excluirLinha = async (regId) => {
    setRegistros((prev) => prev.filter((r) => r.id !== regId))
    await supabase.from('bancos_dados_registros').delete().eq('id', regId)
  }

  useEffect(() => {
    const timers = saveTimers.current
    return () => Object.values(timers).forEach(clearTimeout)
  }, [])

  const camposDetectados = useMemo(() => {
    const known = new Set(campos.map((c) => c.key))
    const found = new Set()
    for (const r of registros) {
      for (const k of Object.keys(r.dados || {})) if (!known.has(k)) found.add(k)
    }
    return [...found]
  }, [registros, campos])

  const registrosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return registros
    return registros.filter((r) =>
      Object.values(r.dados || {}).some((v) => String(v ?? '').toLowerCase().includes(q)))
  }, [registros, busca])

  const webhookUrl = selected
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://app.revenuelab.com.br'}/api/lead-capture?t=${selected.ingest_token}`
    : ''

  const copy = (txt, tag) => {
    navigator.clipboard?.writeText(txt)
    setCopied(tag); setTimeout(() => setCopied(''), 1500)
  }

  const exportCSV = () => {
    const cols = campos.length ? campos : [{ key: '_', label: 'dados' }]
    const head = [...cols.map((c) => c.label), 'origem', 'data'].join(',')
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = registrosFiltrados.map((r) =>
      [...cols.map((c) => esc(r.dados?.[c.key])), esc(r.origem), esc(fmtDateTime(r.created_at))].join(','))
    const blob = new Blob([[head, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${selected?.nome || 'banco'}.csv`
    a.click()
  }

  return (
    <div className="space-y-5">
      {/* Header do módulo */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-rl-text flex items-center gap-2.5">
            <Database className="w-5 h-5 text-rl-purple" /> Banco de dados
          </h2>
          <p className="text-sm text-rl-muted mt-1">
            Planilhas de captação com campos personalizados e webhook para as landing pages deste cliente.
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
          <Plus className="w-4 h-4" /> Novo banco
        </button>
      </div>

      {loading ? (
        <div className="glass-card p-10 flex items-center justify-center text-rl-muted">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando…
        </div>
      ) : bancos.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <Database className="w-10 h-10 text-rl-muted mx-auto mb-3 opacity-50" />
          <p className="text-rl-text font-medium">Nenhum banco ainda</p>
          <p className="text-sm text-rl-muted mt-1 mb-4">Crie o primeiro banco de captação de leads deste cliente.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-2 text-sm py-2 px-4">
            <Plus className="w-4 h-4" /> Criar banco
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-5">
          {/* Lista de bancos */}
          <div className="glass-card p-2 h-fit">
            {bancos.map((b) => (
              <button key={b.id} onClick={() => { setSelectedId(b.id); setTab('planilha') }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-all ${
                  b.id === selectedId ? 'bg-rl-purple/15 text-rl-purple' : 'text-rl-muted hover:bg-rl-surface hover:text-rl-text'
                }`}>
                <span className="truncate flex items-center gap-2"><Table2 className="w-3.5 h-3.5 shrink-0" />{b.nome}</span>
              </button>
            ))}
          </div>

          {/* Painel do banco */}
          {selected && (
            <div className="space-y-4 min-w-0">
              <div className="flex items-center gap-1 border-b border-rl-border">
                {[
                  { id: 'planilha', label: 'Planilha', Icon: Table2 },
                  { id: 'campos', label: 'Campos', Icon: Columns3 },
                  { id: 'webhook', label: 'Webhook', Icon: Webhook },
                  { id: 'crm', label: 'CRM', Icon: Plug },
                ].map(({ id, label, Icon }) => (
                  <button key={id} onClick={() => setTab(id)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-all ${
                      tab === id ? 'border-rl-purple text-rl-purple' : 'border-transparent text-rl-muted hover:text-rl-text'
                    }`}>
                    <Icon className="w-4 h-4" />{label}
                    {id === 'webhook' && camposDetectados.length > 0 && (
                      <span className="ml-1 text-[9px] font-bold bg-rl-gold/20 text-rl-gold rounded-full px-1.5">
                        {camposDetectados.length}
                      </span>
                    )}
                    {id === 'crm' && selected?.crm_config?.enabled && (
                      <span title="Encaminhamento ativo" className="ml-1 w-1.5 h-1.5 rounded-full bg-rl-green" />
                    )}
                  </button>
                ))}
                <div className="flex-1" />
                <button onClick={() => excluirBanco(selected)} title="Excluir banco"
                  className="p-2 text-rl-muted hover:text-red-400 transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {tab === 'planilha' && (
                <PlanilhaTab
                  campos={campos} registros={registrosFiltrados} loadingReg={loadingReg}
                  busca={busca} setBusca={setBusca} onAddLinha={addLinha}
                  onEdit={editarCelula} onDelete={excluirLinha} onExport={exportCSV}
                  onGoCampos={() => setTab('campos')}
                />
              )}
              {tab === 'campos' && <CamposTab campos={campos} onSave={salvarCampos} />}
              {tab === 'webhook' && (
                <WebhookTab
                  url={webhookUrl} campos={campos} copied={copied} onCopy={copy}
                  detectados={camposDetectados}
                  onAddDetectado={(k) => salvarCampos([...campos, { key: k, label: k, type: 'text' }])}
                  onAddCampo={(key) => {
                    const k = slugify(key)
                    if (!k || campos.some((c) => c.key === k)) { showToast('Chave inválida ou já existe', 'error'); return }
                    salvarCampos([...campos, { key: k, label: k, type: 'text' }])
                  }}
                  onRemoveCampo={(key) => salvarCampos(campos.filter((c) => c.key !== key))}
                />
              )}
              {tab === 'crm' && (
                <CrmTab
                  key={selected.id}
                  cfgInicial={selected.crm_config}
                  campos={campos}
                  amostra={amostra}
                  onSave={salvarCrmConfig}
                />
              )}
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <Modal onClose={() => setShowCreate(false)} maxWidth="md">
          <div className="p-5 space-y-4">
            <h3 className="text-lg font-bold text-rl-text">Novo banco</h3>
            <div>
              <label className="text-xs text-rl-muted">Nome</label>
              <input autoFocus value={novoNome} onChange={(e) => setNovoNome(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && criarBanco()}
                placeholder="Ex: Leads LP Aplicação Grátis"
                className="w-full mt-1 bg-rl-surface border border-rl-border rounded-lg px-3 py-2 text-sm text-rl-text outline-none focus:border-rl-purple" />
            </div>
            <div>
              <label className="text-xs text-rl-muted">Começar com</label>
              <div className="mt-1 space-y-2">
                {Object.entries(TEMPLATES).map(([id, t]) => (
                  <button key={id} onClick={() => setNovoTemplate(id)}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                      novoTemplate === id ? 'border-rl-purple bg-rl-purple/10 text-rl-text' : 'border-rl-border text-rl-muted hover:text-rl-text'
                    }`}>
                    {t.label} {t.campos.length > 0 && <span className="text-rl-muted">· {t.campos.length} campos</span>}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-rl-muted hover:text-rl-text">Cancelar</button>
              <button onClick={criarBanco} disabled={!novoNome.trim()} className="btn-primary text-sm py-2 px-4 disabled:opacity-40">Criar</button>
            </div>
          </div>
        </Modal>
      )}

      <Toast toast={toast} />
    </div>
  )
}

BancoDeDadosModule.propTypes = { project: PropTypes.object.isRequired }

// ── Aba Planilha ──────────────────────────────────────────────────────────────
function PlanilhaTab({ campos, registros, loadingReg, busca, setBusca, onAddLinha, onEdit, onDelete, onExport, onGoCampos }) {
  if (!campos.length) {
    return (
      <div className="glass-card p-8 text-center">
        <Columns3 className="w-8 h-8 text-rl-muted mx-auto mb-2 opacity-50" />
        <p className="text-rl-text font-medium">Sem colunas ainda</p>
        <p className="text-sm text-rl-muted mt-1 mb-3">Defina os campos que sua planilha vai ter.</p>
        <button onClick={onGoCampos} className="btn-primary inline-flex items-center gap-2 text-sm py-2 px-4">
          <Columns3 className="w-4 h-4" /> Configurar campos
        </button>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-rl-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…"
            className="w-full bg-rl-surface border border-rl-border rounded-lg pl-9 pr-3 py-2 text-sm text-rl-text outline-none focus:border-rl-purple" />
        </div>
        <button onClick={onExport} className="flex items-center gap-1.5 text-sm text-rl-muted hover:text-rl-text border border-rl-border rounded-lg px-3 py-2">
          <Download className="w-4 h-4" /> CSV
        </button>
        <button onClick={onAddLinha} className="btn-primary flex items-center gap-1.5 text-sm py-2 px-3">
          <Plus className="w-4 h-4" /> Linha
        </button>
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-rl-border">
              {campos.map((c) => (
                <th key={c.key} className="text-left font-semibold text-rl-muted px-3 py-2 whitespace-nowrap text-xs uppercase tracking-wide">
                  {c.label}
                </th>
              ))}
              <th className="text-left font-semibold text-rl-muted px-3 py-2 text-xs uppercase whitespace-nowrap">Origem</th>
              <th className="text-left font-semibold text-rl-muted px-3 py-2 text-xs uppercase whitespace-nowrap">Data</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {loadingReg ? (
              <tr><td colSpan={campos.length + 3} className="px-3 py-8 text-center text-rl-muted">
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Carregando…
              </td></tr>
            ) : registros.length === 0 ? (
              <tr><td colSpan={campos.length + 3} className="px-3 py-8 text-center text-rl-muted text-sm">
                Nenhum registro. Os leads das LPs aparecem aqui automaticamente.
              </td></tr>
            ) : registros.map((r) => (
              <tr key={r.id} className="border-b border-rl-border/50 hover:bg-rl-surface/40 group">
                {campos.map((c) => (
                  <td key={c.key} className="px-1.5 py-0.5 align-middle">
                    <CellEditor field={c} value={r.dados?.[c.key]} onChange={(v) => onEdit(r.id, c.key, v)} />
                  </td>
                ))}
                <td className="px-3 py-1.5 whitespace-nowrap">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                    r.origem === 'webhook' ? 'text-rl-green border-rl-green/30 bg-rl-green/10' : 'text-rl-muted border-rl-border'
                  }`}>{r.origem}</span>
                  {r.crm_status && (
                    <span title={r.crm_response || ''} className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full border ${
                      r.crm_status === 'ok' ? 'text-rl-green border-rl-green/30 bg-rl-green/10' : 'text-red-400 border-red-400/30 bg-red-400/10'
                    }`}>CRM {r.crm_status}</span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-rl-muted text-xs whitespace-nowrap">{fmtDateTime(r.created_at)}</td>
                <td className="px-1">
                  <button onClick={() => onDelete(r.id)} className="p-1 text-rl-muted/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-rl-muted text-center">{registros.length} registro(s)</p>
    </div>
  )
}

function CellEditor({ field, value, onChange }) {
  if (field.type === 'select') {
    return (
      <div className="relative">
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}
          className="appearance-none bg-transparent text-rl-text text-sm pr-6 pl-2 py-1.5 rounded-md hover:bg-rl-surface outline-none focus:bg-rl-surface w-full min-w-[110px]">
          <option value="">—</option>
          {(field.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-rl-muted absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    )
  }
  const type = field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : 'text'
  return (
    <input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)}
      className="bg-transparent text-rl-text text-sm px-2 py-1.5 rounded-md hover:bg-rl-surface outline-none focus:bg-rl-surface w-full min-w-[120px] placeholder:text-rl-muted/30" placeholder="—" />
  )
}

// ── Aba Campos ────────────────────────────────────────────────────────────────
function CamposTab({ campos, onSave }) {
  const [local, setLocal] = useState(campos)
  useEffect(() => { setLocal(campos) }, [campos])

  const dirty = JSON.stringify(local) !== JSON.stringify(campos)

  const update = (i, patch) => setLocal((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
  const remove = (i) => setLocal((prev) => prev.filter((_, idx) => idx !== i))
  const add = () => setLocal((prev) => [...prev, { key: `campo_${prev.length + 1}`, label: '', type: 'text', options: [] }])
  const move = (i, dir) => setLocal((prev) => {
    const j = i + dir
    if (j < 0 || j >= prev.length) return prev
    const cp = [...prev];[cp[i], cp[j]] = [cp[j], cp[i]]; return cp
  })

  return (
    <div className="glass-card p-4 space-y-3">
      <p className="text-sm text-rl-muted">A <strong className="text-rl-text">chave</strong> é o nome que o webhook espera no JSON. O <strong className="text-rl-text">rótulo</strong> é o que aparece na planilha.</p>

      <div className="space-y-2">
        {local.map((c, i) => (
          <div key={i} className="flex items-start gap-2 flex-wrap sm:flex-nowrap bg-rl-surface/50 rounded-lg p-2 border border-rl-border">
            <div className="flex flex-col pt-1.5">
              <button onClick={() => move(i, -1)} className="text-rl-muted hover:text-rl-text text-[10px] leading-none">▲</button>
              <button onClick={() => move(i, 1)} className="text-rl-muted hover:text-rl-text text-[10px] leading-none">▼</button>
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="text-[10px] text-rl-muted">Rótulo</label>
              <input value={c.label} onChange={(e) => {
                const label = e.target.value
                const auto = !c.key || c.key === slugify(c.label)
                update(i, auto ? { label, key: slugify(label) } : { label })
              }} placeholder="Nome do campo"
                className="w-full bg-rl-bg border border-rl-border rounded-md px-2 py-1.5 text-sm text-rl-text outline-none focus:border-rl-purple" />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="text-[10px] text-rl-muted">Chave (webhook)</label>
              <input value={c.key} onChange={(e) => update(i, { key: slugify(e.target.value) })} placeholder="chave_json"
                className="w-full bg-rl-bg border border-rl-border rounded-md px-2 py-1.5 text-sm text-rl-text font-mono outline-none focus:border-rl-purple" />
            </div>
            <div className="min-w-[130px]">
              <label className="text-[10px] text-rl-muted">Tipo</label>
              <select value={c.type} onChange={(e) => update(i, { type: e.target.value })}
                className="w-full bg-rl-bg border border-rl-border rounded-md px-2 py-1.5 text-sm text-rl-text outline-none focus:border-rl-purple">
                {FIELD_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <button onClick={() => remove(i)} className="p-1.5 mt-4 text-rl-muted hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
            {c.type === 'select' && (
              <div className="w-full">
                <label className="text-[10px] text-rl-muted">Opções do dropdown (uma por linha)</label>
                <textarea rows={3} value={(c.options || []).join('\n')}
                  onChange={(e) => update(i, { options: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
                  placeholder={'Novo\nEm contato\nGanho\nPerdido'}
                  className="w-full bg-rl-bg border border-rl-border rounded-md px-2 py-1.5 text-sm text-rl-text outline-none focus:border-rl-purple resize-y" />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1">
        <button onClick={add} className="flex items-center gap-1.5 text-sm text-rl-purple hover:underline">
          <Plus className="w-4 h-4" /> Adicionar campo
        </button>
        <button onClick={() => onSave(local)} disabled={!dirty}
          className="btn-primary text-sm py-2 px-4 disabled:opacity-40">Salvar campos</button>
      </div>
    </div>
  )
}

// ── Aba Webhook ───────────────────────────────────────────────────────────────
function WebhookTab({ url, campos, copied, onCopy, detectados, onAddDetectado, onAddCampo, onRemoveCampo }) {
  const [novoCampo, setNovoCampo] = useState('')
  const snippet = `<form id="rl-form">
${campos.map((c) => `  <input name="${c.key}" placeholder="${c.label}">`).join('\n')}
  <button type="submit">Enviar</button>
</form>

<script>
document.getElementById('rl-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const dados = Object.fromEntries(new FormData(e.target));
  // captura UTMs da URL automaticamente
  new URLSearchParams(location.search).forEach((v, k) => { if (!dados[k]) dados[k] = v; });
  await fetch(${JSON.stringify(url)}, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });
  window.location = '/obrigado'; // ajuste seu redirect / pixel aqui
});
</script>`

  // Prompt para IA (Lovable/v0/Bolt) que se reconstrói a partir dos campos atuais.
  const isAuto = (k) => k === 'url' || k === 'ip' || k.startsWith('utm_')
  const userFields = campos.filter((c) => !isAuto(c.key))
  const utmKeys = campos.filter((c) => c.key.startsWith('utm_')).map((c) => c.key)
  const hasUrl = campos.some((c) => c.key === 'url')
  const hasIp = campos.some((c) => c.key === 'ip')

  const userLines = userFields.length
    ? userFields.map((c) => `   - "${c.key}" -> campo "${c.label || c.key}"`).join('\n')
    : '   - (nenhum campo de preenchimento definido ainda)'
  const autoLines = []
  if (hasUrl) autoLines.push('   - "url": window.location.href (URL completa da página)')
  if (utmKeys.length) autoLines.push(`   - Parâmetros UTM da URL (window.location.search): ${utmKeys.map((k) => `"${k}"`).join(', ')} — se não existirem na URL, envie string vazia`)
  if (hasIp) autoLines.push('   - "ip": obtenha via fetch em "https://api.ipify.org?format=json" (campo .ip); se falhar, envie "" e siga o envio normalmente')

  const promptText = `Conecte o formulário desta landing page a um banco de dados externo via webhook, SEM alterar o design, layout, cores, espaçamentos ou textos. Adicione apenas a lógica de envio.

Ao enviar o formulário (onSubmit):
1. Faça e.preventDefault() e mantenha as validações de campos obrigatórios que já existem.
2. Enquanto envia, desabilite o botão de envio e mostre um estado de "enviando".
3. Monte um objeto JSON chamado "dados". O atributo name de cada input DEVE ser exatamente a chave indicada:
${userLines}${autoLines.length ? `
4. Adicione automaticamente ao objeto "dados":
${autoLines.join('\n')}` : ''}
${autoLines.length ? '5' : '4'}. Envie os dados com:
   fetch("${url}", {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify(dados)
   });
${autoLines.length ? '6' : '5'}. Se a resposta for ok: mostre uma mensagem de sucesso e limpe o formulário. Se der erro: mostre "Ocorreu um erro, tente novamente." e reabilite o botão.${hasIp ? `
${autoLines.length ? '7' : '6'}. Não deixe o fetch de IP travar o envio (use um timeout curto ou trate o erro).` : ''}

Regra final: não altere nada visual — apenas a lógica de envio (submit) do formulário.`

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 space-y-2">
        <label className="text-xs font-semibold text-rl-muted uppercase tracking-wide">URL do webhook</label>
        <div className="flex items-center gap-2">
          <code className="flex-1 min-w-0 truncate bg-rl-bg border border-rl-border rounded-lg px-3 py-2 text-xs text-rl-green font-mono">{url}</code>
          <button onClick={() => onCopy(url, 'url')} className="shrink-0 flex items-center gap-1.5 text-sm border border-rl-border rounded-lg px-3 py-2 text-rl-muted hover:text-rl-text">
            {copied === 'url' ? <Check className="w-4 h-4 text-rl-green" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs text-rl-muted">Faça um <strong className="text-rl-text">POST</strong> (JSON ou form) para essa URL. As chaves do JSON que baterem com os campos abaixo viram colunas.</p>
      </div>

      <div className="glass-card p-4">
        <label className="text-xs font-semibold text-rl-muted uppercase tracking-wide">Campos esperados</label>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {campos.length === 0 && <span className="text-sm text-rl-muted">Nenhum campo definido ainda.</span>}
          {campos.map((c) => (
            <span key={c.key} className="text-xs font-mono bg-rl-surface border border-rl-border rounded-md pl-2 pr-1 py-1 text-rl-text flex items-center gap-1">
              {c.key}
              <button onClick={() => onRemoveCampo(c.key)} title="Remover campo"
                className="text-rl-muted/50 hover:text-red-400 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); if (novoCampo.trim()) { onAddCampo(novoCampo); setNovoCampo('') } }}
          className="flex items-center gap-2 mt-3"
        >
          <input value={novoCampo} onChange={(e) => setNovoCampo(e.target.value)}
            placeholder="nova_chave (ex: cargo, cidade)"
            className="flex-1 min-w-0 bg-rl-bg border border-rl-border rounded-md px-2 py-1.5 text-sm text-rl-text font-mono outline-none focus:border-rl-purple" />
          <button type="submit" disabled={!novoCampo.trim()}
            className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1 disabled:opacity-40">
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </button>
        </form>
        <p className="text-[11px] text-rl-muted mt-1.5">
          Novo campo entra como texto e vira coluna na planilha. Para mudar o tipo (dropdown etc.), use a aba <strong className="text-rl-text">Campos</strong>. A <strong className="text-rl-text">chave</strong> precisa ser igual ao <code className="text-rl-text">name</code> que o formulário envia.
        </p>
      </div>

      {detectados.length > 0 && (
        <div className="glass-card p-4 border border-rl-gold/30">
          <label className="text-xs font-semibold text-rl-gold uppercase tracking-wide">Campos recebidos sem coluna</label>
          <p className="text-xs text-rl-muted mt-1 mb-2">Chegaram via webhook mas não têm coluna. Clique para adicionar.</p>
          <div className="flex flex-wrap gap-1.5">
            {detectados.map((k) => (
              <button key={k} onClick={() => onAddDetectado(k)}
                className="text-xs font-mono bg-rl-gold/10 border border-rl-gold/40 rounded-md px-2 py-1 text-rl-gold hover:bg-rl-gold/20 flex items-center gap-1">
                <Plus className="w-3 h-3" /> {k}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="glass-card p-4 space-y-2 border border-rl-purple/30">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-rl-purple uppercase tracking-wide flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Prompt para IA (Lovable, v0, Bolt…)</label>
          <button onClick={() => onCopy(promptText, 'prompt')} className="flex items-center gap-1.5 text-sm border border-rl-border rounded-lg px-3 py-1.5 text-rl-muted hover:text-rl-text">
            {copied === 'prompt' ? <Check className="w-4 h-4 text-rl-green" /> : <Copy className="w-4 h-4" />} Copiar
          </button>
        </div>
        <p className="text-xs text-rl-muted">Cole na página feita por IA para conectar o formulário a este banco. O prompt <strong className="text-rl-text">se atualiza sozinho</strong> conforme você adiciona ou remove campos acima.</p>
        <pre className="bg-rl-bg border border-rl-border rounded-lg p-3 text-[11px] text-rl-text/90 whitespace-pre-wrap overflow-x-auto">{promptText}</pre>
      </div>

      <div className="glass-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-rl-muted uppercase tracking-wide flex items-center gap-1.5"><Code2 className="w-3.5 h-3.5" /> Snippet HTML (alternativa sem IA)</label>
          <button onClick={() => onCopy(snippet, 'snippet')} className="flex items-center gap-1.5 text-sm border border-rl-border rounded-lg px-3 py-1.5 text-rl-muted hover:text-rl-text">
            {copied === 'snippet' ? <Check className="w-4 h-4 text-rl-green" /> : <Copy className="w-4 h-4" />} Copiar
          </button>
        </div>
        <pre className="bg-rl-bg border border-rl-border rounded-lg p-3 text-[11px] text-rl-text/90 font-mono overflow-x-auto">{snippet}</pre>
      </div>
    </div>
  )
}

// ── Aba CRM ───────────────────────────────────────────────────────────────────
// Configura o encaminhamento automático dos leads deste banco para o CRM do
// cliente. A IA lê a doc da API (texto e/ou link) e propõe endpoint + headers +
// mapeamento; o "Testar envio" bate no CRM de verdade antes de você ativar.
function CrmTab({ cfgInicial, campos, amostra, onSave }) {
  const [cfg, setCfg] = useState({ ...DEFAULT_CRM, ...(cfgInicial || {}) })
  const [loadingIa, setLoadingIa] = useState(false)
  const [iaAviso, setIaAviso] = useState(null)
  const [loadingTest, setLoadingTest] = useState(false)
  const [teste, setTeste] = useState(null)
  const [copiado, setCopiado] = useState('')

  const set = (patch) => setCfg((p) => ({ ...p, ...patch }))
  const setHeader = (i, patch) => setCfg((p) => ({ ...p, headers: p.headers.map((h, idx) => (idx === i ? { ...h, ...patch } : h)) }))
  const addHeader = () => setCfg((p) => ({ ...p, headers: [...(p.headers || []), { key: '', value: '' }] }))
  const rmHeader = (i) => setCfg((p) => ({ ...p, headers: p.headers.filter((_, idx) => idx !== i) }))

  const podeAtivar = !!cfg.endpoint?.trim() && !!cfg.bodyTemplate?.trim()

  const gerarComIa = async () => {
    setIaAviso(null); setLoadingIa(true); setTeste(null)
    const { ok, payload } = await authFetch('/api/crm-assist', {
      campos, endpoint: cfg.endpoint, docsText: cfg.docsText, docsUrl: cfg.docsUrl,
    })
    setLoadingIa(false)
    if (!ok) { setIaAviso(payload?.error || 'Falha ao gerar a configuração.'); return }
    const c = payload.config || {}
    set({
      endpoint: c.endpoint || cfg.endpoint,
      method: c.method || 'POST',
      headers: Array.isArray(c.headers) ? c.headers : [],
      bodyTemplate: c.bodyTemplate || '',
      notas: c.notas || '',
    })
    if (payload.docsAviso) setIaAviso(`Não consegui ler o link (${payload.docsAviso}). Usei apenas o texto colado.`)
  }

  const testar = async () => {
    setLoadingTest(true); setTeste(null)
    const { payload } = await authFetch('/api/crm-test', { config: cfg, dados: amostra })
    setLoadingTest(false)
    setTeste(payload)
  }

  const copiar = (txt, tag) => {
    navigator.clipboard?.writeText(txt)
    setCopiado(tag); setTimeout(() => setCopiado(''), 1200)
  }

  return (
    <div className="space-y-4">
      {/* Ativação */}
      <div className="glass-card p-4 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-[220px]">
          <h3 className="text-sm font-semibold text-rl-text flex items-center gap-2">
            <Plug className="w-4 h-4 text-rl-purple" /> Encaminhar leads para o CRM
          </h3>
          <p className="text-xs text-rl-muted mt-1">
            Todo lead que cair neste banco é enviado automaticamente para o CRM do cliente.
            Se o CRM falhar, o lead <strong className="text-rl-text">continua salvo aqui</strong> e o erro fica registrado na planilha.
          </p>
        </div>
        <label className={`flex items-center gap-2 text-sm shrink-0 ${podeAtivar ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
          <input type="checkbox" disabled={!podeAtivar} checked={!!cfg.enabled}
            onChange={(e) => set({ enabled: e.target.checked })}
            className="w-4 h-4 accent-current text-rl-purple" />
          <span className={cfg.enabled ? 'text-rl-green font-medium' : 'text-rl-muted'}>
            {cfg.enabled ? 'Ativo' : 'Desativado'}
          </span>
        </label>
        {!podeAtivar && (
          <p className="w-full text-[11px] text-rl-gold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Configure o endpoint e o mapeamento abaixo para poder ativar.
          </p>
        )}
      </div>

      {/* Configurar com IA */}
      <div className="glass-card p-4 space-y-3 border border-rl-purple/30">
        <label className="text-xs font-semibold text-rl-purple uppercase tracking-wide flex items-center gap-1.5">
          <Wand2 className="w-3.5 h-3.5" /> Configurar com IA
        </label>
        <p className="text-xs text-rl-muted">
          Cole o link e/ou o trecho da documentação da API do CRM. A IA lê, entende os campos e monta a integração pra você.
        </p>
        <input value={cfg.docsUrl} onChange={(e) => set({ docsUrl: e.target.value })}
          placeholder="https://docs.seucrm.com/api/criar-lead (opcional)"
          className="w-full bg-rl-bg border border-rl-border rounded-md px-3 py-2 text-sm text-rl-text outline-none focus:border-rl-purple" />
        <textarea rows={5} value={cfg.docsText} onChange={(e) => set({ docsText: e.target.value })}
          placeholder="Cole aqui o trecho da documentação (endpoint, campos do corpo, autenticação). Mais confiável que o link."
          className="w-full bg-rl-bg border border-rl-border rounded-md px-3 py-2 text-sm text-rl-text outline-none focus:border-rl-purple resize-y" />
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={gerarComIa} disabled={loadingIa || (!cfg.docsText.trim() && !cfg.docsUrl.trim())}
            className="btn-primary flex items-center gap-2 text-sm py-2 px-4 disabled:opacity-40">
            {loadingIa ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {loadingIa ? 'Lendo a documentação…' : 'Gerar configuração com IA'}
          </button>
          {iaAviso && <span className="text-xs text-rl-gold flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />{iaAviso}</span>}
        </div>
        {cfg.notas && (
          <div className="text-xs text-rl-text bg-rl-surface border border-rl-border rounded-md p-2.5">
            <strong className="text-rl-purple">Notas da IA:</strong> {cfg.notas}
          </div>
        )}
      </div>

      {/* Requisição */}
      <div className="glass-card p-4 space-y-3">
        <label className="text-xs font-semibold text-rl-muted uppercase tracking-wide">Requisição</label>
        <div className="flex gap-2">
          <select value={cfg.method} onChange={(e) => set({ method: e.target.value })}
            className="bg-rl-bg border border-rl-border rounded-md px-2 py-2 text-sm text-rl-text outline-none focus:border-rl-purple">
            <option>POST</option><option>PUT</option><option>PATCH</option>
          </select>
          <input value={cfg.endpoint} onChange={(e) => set({ endpoint: e.target.value })}
            placeholder="https://api.seucrm.com/v1/leads"
            className="flex-1 min-w-0 bg-rl-bg border border-rl-border rounded-md px-3 py-2 text-sm text-rl-text font-mono outline-none focus:border-rl-purple" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-rl-muted">Headers (autenticação)</span>
            <button onClick={addHeader} className="text-xs text-rl-purple hover:underline flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Header
            </button>
          </div>
          {(cfg.headers || []).length === 0 && <p className="text-xs text-rl-muted/70">Nenhum header. A maioria dos CRMs pede um <code className="text-rl-text">Authorization</code>.</p>}
          {(cfg.headers || []).map((h, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={h.key} onChange={(e) => setHeader(i, { key: e.target.value })} placeholder="Authorization"
                className="flex-1 min-w-0 bg-rl-bg border border-rl-border rounded-md px-2 py-1.5 text-sm text-rl-text font-mono outline-none focus:border-rl-purple" />
              <input value={h.value} onChange={(e) => setHeader(i, { value: e.target.value })} placeholder="Bearer sua_chave"
                className="flex-1 min-w-0 bg-rl-bg border border-rl-border rounded-md px-2 py-1.5 text-sm text-rl-text font-mono outline-none focus:border-rl-purple" />
              <button onClick={() => rmHeader(i)} className="p-1.5 text-rl-muted hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <p className="text-[11px] text-rl-muted flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rl-gold shrink-0" />
            A chave fica salva no banco e é visível para o time logado. Substitua os marcadores <code className="text-rl-text">&lt;SUA_API_KEY&gt;</code> pela chave real.
          </p>
        </div>
      </div>

      {/* Mapeamento */}
      <div className="glass-card p-4 space-y-2">
        <label className="text-xs font-semibold text-rl-muted uppercase tracking-wide">Mapeamento — corpo do POST</label>
        <p className="text-xs text-rl-muted">
          JSON que será enviado ao CRM. Use <code className="text-rl-text">{'{{chave}}'}</code> para injetar os dados do lead.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {campos.map((c) => (
            <button key={c.key} onClick={() => copiar(`{{${c.key}}}`, c.key)} title="Copiar placeholder"
              className="text-[11px] font-mono bg-rl-surface border border-rl-border rounded-md px-2 py-1 text-rl-text hover:border-rl-purple">
              {copiado === c.key ? <Check className="w-3 h-3 inline text-rl-green" /> : `{{${c.key}}}`}
            </button>
          ))}
        </div>
        <textarea rows={8} value={cfg.bodyTemplate} onChange={(e) => set({ bodyTemplate: e.target.value })}
          placeholder={'{\n  "name": "{{nome}}",\n  "email": "{{email}}",\n  "phone": "{{whatsapp}}"\n}'}
          className="w-full bg-rl-bg border border-rl-border rounded-md px-3 py-2 text-[12px] text-rl-text font-mono outline-none focus:border-rl-purple resize-y" />
      </div>

      {/* Testar */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <label className="text-xs font-semibold text-rl-muted uppercase tracking-wide">Testar envio</label>
            <p className="text-xs text-rl-muted mt-0.5">Manda um lead de exemplo para o CRM agora. Não grava nada.</p>
          </div>
          <button onClick={testar} disabled={loadingTest || !cfg.endpoint?.trim()}
            className="flex items-center gap-2 text-sm border border-rl-border rounded-lg px-3 py-2 text-rl-text hover:border-rl-purple disabled:opacity-40">
            {loadingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Testar envio
          </button>
        </div>

        {teste && (
          <div className="space-y-2">
            {teste.error ? (
              <p className="text-sm text-red-400 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" />{teste.error}</p>
            ) : (
              <span className={`inline-block text-xs px-2 py-1 rounded-full border ${
                teste.ok ? 'text-rl-green border-rl-green/30 bg-rl-green/10' : 'text-red-400 border-red-400/30 bg-red-400/10'
              }`}>
                {teste.ok ? 'Sucesso' : 'Falhou'} — HTTP {teste.status}
              </span>
            )}
            {teste.sent && (
              <div>
                <p className="text-[11px] text-rl-muted mb-1">Corpo enviado:</p>
                <pre className="bg-rl-bg border border-rl-border rounded-md p-2 text-[11px] text-rl-text/90 font-mono overflow-x-auto">{teste.sent}</pre>
              </div>
            )}
            {teste.response && (
              <div>
                <p className="text-[11px] text-rl-muted mb-1">Resposta do CRM:</p>
                <pre className="bg-rl-bg border border-rl-border rounded-md p-2 text-[11px] text-rl-text/90 font-mono overflow-x-auto whitespace-pre-wrap">{teste.response}</pre>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button onClick={() => onSave(cfg)} className="btn-primary text-sm py-2 px-5">Salvar integração</button>
      </div>
    </div>
  )
}
