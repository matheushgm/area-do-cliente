import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import {
  ArrowLeft, ArrowRight, Check, Zap, Building2, FileText,
  Briefcase, DollarSign, Users, Calendar, Plus, X, Upload,
  Sparkles, Rocket, ChevronDown, ChevronUp,
} from 'lucide-react'

// ─── Business types ───────────────────────────────────────────────────────────
const BUSINESS_TYPES = [
  { value: 'b2b',         label: 'B2B',           desc: 'Vende para outras empresas',          icon: '🏢' },
  { value: 'local',       label: 'Negócio Local',  desc: 'Atende clientes na região física',    icon: '📍' },
  { value: 'ecommerce',   label: 'E-commerce',     desc: 'Vendas online / loja virtual',        icon: '🛒' },
  { value: 'infoproduto', label: 'Infoproduto',    desc: 'Cursos, mentorias, conteúdo digital', icon: '🎓' },
]

// ─── Segment suggestions ──────────────────────────────────────────────────────
const SEGMENTOS = [
  'Beleza e Estética', 'Saúde e Bem-estar', 'Alimentação / Gastronomia',
  'Clínica / Odontologia', 'Academia / Fitness', 'Moda e Vestuário',
  'E-commerce / Varejo', 'Imobiliário', 'Tecnologia / SaaS',
  'Educação / Cursos Online', 'Serviços Profissionais', 'Consultoria Empresarial',
  'Marketing Digital', 'Social Media', 'Turismo e Viagens',
  'Construção Civil', 'Automotivo', 'Farmácia / Drogaria', 'Pet Shop / Veterinária',
  'Advocacia / Jurídico', 'Financeiro / Seguros', 'Ótica',
  'Entretenimento / Eventos', 'Logística / Transporte', 'Indústria / Manufatura',
]

// ─── Services config ──────────────────────────────────────────────────────────
export const SERVICES_CONFIG = [
  { id: 'meta_ads',             label: 'Gestão de Meta Ads',                emoji: '📘' },
  { id: 'google_ads',           label: 'Gestão de Google Ads',              emoji: '🔍' },
  { id: 'tiktok_ads',           label: 'Gestão de TikTok Ads',              emoji: '🎵' },
  {
    id: 'criacao_roteiros',     label: 'Criação de Roteiros de Criativos',   emoji: '✏️',
    sub: [
      { key: 'imagemQty', label: 'Qtd. Imagens', placeholder: '0' },
      { key: 'videoQty',  label: 'Qtd. Vídeos',  placeholder: '0' },
    ],
  },
  {
    id: 'edicao_criativos',     label: 'Edição de Criativos',               emoji: '🎬',
    sub: [
      { key: 'estaticosQty', label: 'Qtd. Estáticos', placeholder: '0' },
      { key: 'videoQty',     label: 'Qtd. Vídeos',    placeholder: '0' },
    ],
  },
  {
    id: 'assessoria_comercial', label: 'Assessoria Comercial',               emoji: '💼',
    sub: [
      { key: 'nivel', label: 'Nível', type: 'select', options: ['Nível 1', 'Nível 2', 'Nível 3'] },
    ],
  },
  { id: 'consultoria',          label: 'Consultoria',                        emoji: '📊' },
  { id: 'mentoria',             label: 'Mentoria',                           emoji: '🎓' },
  { id: 'social_media',         label: 'Social Media',                       emoji: '📱' },
  { id: 'email_marketing',      label: 'E-mail Marketing',                   emoji: '📧' },
  { id: 'ai_whatsapp',          label: 'AI no WhatsApp',                     emoji: '🤖' },
  {
    id: 'landing_page',         label: 'Criação de Landing Page',            emoji: '🌐',
    sub: [
      { key: 'qty', label: 'Quantidade de Páginas', placeholder: '1' },
    ],
  },
]

// ─── Maturity options ─────────────────────────────────────────────────────────
const MATURITY_OPTIONS = [
  { value: '1', label: 'Nunca anunciou online',  desc: 'Primeiro contato com mídia paga' },
  { value: '2', label: 'Iniciante',               desc: 'Já anunciou, mas sem resultados consistentes' },
  { value: '3', label: 'Intermediário',            desc: 'Tem resultados, quer escalar' },
  { value: '4', label: 'Avançado',                desc: 'Anunciante experiente, busca otimização' },
  { value: '5', label: 'Expert',                  desc: 'Estrutura sólida, foco em performance máxima' },
]

// ─── Step definitions ─────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Empresa',    icon: Building2,  title: 'Dados da Empresa',        sub: 'Informações básicas e segmento do cliente' },
  { id: 2, label: 'Documentos', icon: FileText,   title: 'Documentos',              sub: 'Anexe os arquivos enviados pelo vendedor' },
  { id: 3, label: 'Serviços',   icon: Briefcase,  title: 'Serviços Contratados',    sub: 'Selecione os serviços e configure quantidades' },
  { id: 4, label: 'Contrato',   icon: Calendar,   title: 'Contrato & Concorrência', sub: 'Modelo de contratação, valores e data de assinatura' },
  { id: 5, label: 'Equipe',     icon: Users,      title: 'Equipe & Potencial',      sub: 'Estrutura interna e oportunidades futuras' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatCNPJ(v) {
  return v.replace(/\D/g, '').slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

function formatCurrency(v) {
  const n = v.replace(/\D/g, '')
  if (!n) return ''
  return (parseInt(n, 10) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function parseCurrencyToNumber(v) {
  if (!v || !v.trim()) return null
  return parseFloat(v.replace(/\D/g, '')) / 100 || null
}

// ─── Segmento Field ───────────────────────────────────────────────────────────
function SegmentoField({ value, onChange }) {
  return (
    <div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ex: Beleza e Estética, Saúde, E-commerce..."
        className="input-field mb-3"
      />
      <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
        {SEGMENTOS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap ${
              value === s
                ? 'bg-rl-purple/20 border-rl-purple/60 text-rl-purple'
                : 'bg-rl-surface border-rl-border text-rl-muted hover:border-rl-purple/30 hover:text-rl-text'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Service Card (with expandable sub-fields) ────────────────────────────────
function ServiceCard({ config, selected, data, onToggle, onDataChange }) {
  const hasSubfields = (config.sub || []).length > 0

  return (
    <div className={`rounded-xl border overflow-hidden transition-all duration-200 ${
      selected ? 'border-rl-purple/50' : 'border-rl-border'
    }`}>
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => onToggle(config.id)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${
          selected ? 'bg-rl-purple/10' : 'bg-rl-surface hover:bg-rl-surface/60'
        }`}
      >
        <span className="text-lg shrink-0 leading-none">{config.emoji}</span>
        <span className={`text-sm font-medium flex-1 leading-tight ${selected ? 'text-rl-purple' : 'text-rl-text'}`}>
          {config.label}
        </span>
        {selected && !hasSubfields && <Check className="w-4 h-4 text-rl-purple shrink-0" />}
        {hasSubfields && (
          selected
            ? <ChevronUp className="w-4 h-4 text-rl-purple shrink-0" />
            : <ChevronDown className="w-4 h-4 text-rl-muted shrink-0" />
        )}
      </button>

      {/* Sub-fields (only shown when selected and has sub-fields) */}
      {selected && hasSubfields && (
        <div className="px-4 pb-4 pt-3 border-t border-rl-border/40 bg-rl-bg/40 space-y-3">
          {config.sub.map((field) => (
            <div key={field.key}>
              <label className="text-xs font-semibold text-rl-muted mb-1.5 block">{field.label}</label>
              {field.type === 'select' ? (
                <div className="flex flex-wrap gap-2">
                  {field.options.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => onDataChange(config.id, field.key, opt)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        data[field.key] === opt
                          ? 'bg-rl-purple/20 border-rl-purple/50 text-rl-purple'
                          : 'bg-rl-surface border-rl-border text-rl-muted hover:border-rl-purple/30'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type="number"
                  min="0"
                  value={data[field.key] || ''}
                  onChange={(e) => onDataChange(config.id, field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="input-field text-sm py-2 w-32"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Dynamic List ─────────────────────────────────────────────────────────────
function DynamicList({ items, onChange, placeholder, withRole = false, roleLabel = 'Cargo' }) {
  function add()        { onChange([...items, withRole ? { name: '', role: '' } : '']) }
  function remove(i)    { onChange(items.filter((_, idx) => idx !== i)) }
  function update(i, v) { const n = [...items]; n[i] = v; onChange(n) }
  function updateField(i, field, v) { const n = [...items]; n[i] = { ...n[i], [field]: v }; onChange(n) }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className={`flex gap-2 ${withRole ? 'flex-col sm:flex-row' : ''}`}>
          {withRole ? (
            <>
              <input value={item.name} onChange={(e) => updateField(i, 'name', e.target.value)} placeholder="Nome" className="input-field flex-1" />
              <input value={item.role} onChange={(e) => updateField(i, 'role', e.target.value)} placeholder={roleLabel} className="input-field flex-1" />
            </>
          ) : (
            <input value={item} onChange={(e) => update(i, e.target.value)} placeholder={placeholder} className="input-field flex-1" />
          )}
          <button type="button" onClick={() => remove(i)} className="p-2.5 rounded-xl text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="flex items-center gap-2 text-sm text-rl-purple hover:text-rl-purple/80 transition-colors">
        <Plus className="w-4 h-4" />
        Adicionar {withRole ? 'pessoa' : 'item'}
      </button>
    </div>
  )
}

// ─── File Upload ──────────────────────────────────────────────────────────────
function FileUpload({ label, file, onChange, description }) {
  const ref = useRef()
  function handleDrop(e) { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onChange(f) }

  return (
    <div>
      <label className="label-field">{label}</label>
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => ref.current.click()}
        className={`relative border-2 border-dashed rounded-xl p-5 cursor-pointer transition-all duration-200 ${
          file ? 'border-rl-green/50 bg-rl-green/5' : 'border-rl-border hover:border-rl-purple/50 hover:bg-rl-purple/5'
        }`}
      >
        <input ref={ref} type="file" className="hidden" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
          onChange={(e) => e.target.files[0] && onChange(e.target.files[0])} />
        {file ? (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-rl-green/20 flex items-center justify-center">
              <Check className="w-4 h-4 text-rl-green" />
            </div>
            <div>
              <p className="text-sm font-medium text-rl-text">{file.name}</p>
              <p className="text-xs text-rl-muted">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button type="button" onClick={(e) => { e.stopPropagation(); onChange(null) }} className="ml-auto p-1 rounded text-rl-muted hover:text-red-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="w-10 h-10 rounded-xl bg-rl-purple/10 flex items-center justify-center">
              <Upload className="w-5 h-5 text-rl-purple/60" />
            </div>
            <p className="text-sm text-rl-muted">
              <span className="text-rl-purple font-medium">Clique para enviar</span> ou arraste o arquivo
            </p>
            <p className="text-xs text-rl-muted/60">{description}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Draft persistence ────────────────────────────────────────────────────────
const DRAFT_KEY = 'rl_new_onboarding_draft'

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveDraft(form, step, completedSteps) {
  // File objects não são serializáveis — excluir do rascunho
  const { raioXFile, slaFile, ...rest } = form
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ form: rest, step, completedSteps }))
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY)
}

// ─── Initial form state ───────────────────────────────────────────────────────
const initialForm = {
  // Step 1 — Empresa
  businessType:        '',
  companyName:         '',
  cnpj:                '',
  responsibleName:     '',
  responsibleRole:     '',
  segmento:            '',
  // Step 2 — Documentos
  raioXFile:           null,
  slaFile:             null,
  // Step 3 — Serviços
  services:            [],   // array of service IDs
  servicesData:        {},   // { [serviceId]: { [fieldKey]: value } }
  // Step 4 — Contrato
  contractModel:       '',   // 'aceleracao' | 'assessoria'
  contractPaymentType: '',   // 'unico' | 'mensal'  (only for aceleração)
  contractValue:       '',
  contractDate:        '',
  competitors:         [''],
  // Step 6 — Equipe
  hasSalesTeam:        null,
  digitalMaturity:     '',
  otherPeople:         [],
  upsellPotential:     null,
  upsellNotes:         '',
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function NewOnboarding() {
  const { addProject } = useApp()
  const navigate = useNavigate()

  const draft = loadDraft()
  const [step, setStep]                   = useState(draft?.step ?? 0)
  const [form, setForm]                   = useState(draft?.form ? { ...initialForm, ...draft.form } : initialForm)
  const [errors, setErrors]               = useState({})
  const [done, setDone]                   = useState(false)
  const [createdId, setCreatedId]         = useState(null)
  const [completedSteps, setCompletedSteps] = useState(draft?.completedSteps ?? [])
  const [hasDraft]                        = useState(!!draft?.form?.companyName)

  // Auto-save rascunho a cada mudança
  useEffect(() => {
    if (done) return
    saveDraft(form, step, completedSteps)
  }, [form, step, completedSteps, done])

  const set = useCallback((field, value) => {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => { const n = { ...e }; delete n[field]; return n })
  }, [])

  function toggleService(id) {
    set('services', form.services.includes(id)
      ? form.services.filter((s) => s !== id)
      : [...form.services, id]
    )
  }

  function updateServiceData(serviceId, fieldKey, value) {
    set('servicesData', {
      ...form.servicesData,
      [serviceId]: { ...(form.servicesData[serviceId] || {}), [fieldKey]: value },
    })
  }

  // ── Validation ──────────────────────────────────────────────────────────────
  function validate(s) {
    const e = {}
    if (s === 0) {
      if (!form.businessType)           e.businessType    = 'Selecione o tipo de negócio'
      if (!form.companyName.trim())     e.companyName     = 'Nome da empresa é obrigatório'
      if (!form.responsibleName.trim()) e.responsibleName = 'Nome do responsável é obrigatório'
    }
    if (s === 2) {
      if (form.services.length === 0) e.services = 'Selecione ao menos um serviço'
    }
    if (s === 3) {
      if (!form.contractModel) e.contractModel = 'Selecione o modelo de contratação'
      if (!form.contractDate)  e.contractDate  = 'Informe a data de assinatura'
    }
    if (s === 4) {
      if (form.hasSalesTeam === null)    e.hasSalesTeam    = 'Informe se tem equipe comercial'
      if (!form.digitalMaturity)         e.digitalMaturity = 'Selecione a maturidade digital'
      if (form.upsellPotential === null) e.upsellPotential = 'Informe o potencial de upsell'
    }
    return e
  }

  function next() {
    const e = validate(step)
    if (Object.keys(e).length > 0) { setErrors(e); return }

    setCompletedSteps((cs) => [...cs, step])

    if (step === STEPS.length - 1) {
      // Convert service IDs → labels for display
      const serviceLabels = form.services.map((id) => SERVICES_CONFIG.find((s) => s.id === id)?.label || id)

      const created = addProject({
        business_type:         form.businessType,
        company_name:          form.companyName,
        cnpj:                  form.cnpj,
        responsible_name:      form.responsibleName,
        responsible_role:      form.responsibleRole,
        segmento:              form.segmento,
        services:              serviceLabels,
        services_data:         form.servicesData,
        contract_model:        form.contractModel,
        contract_payment_type: form.contractPaymentType,
        contract_value:        parseCurrencyToNumber(form.contractValue),
        competitors:           form.competitors.filter(Boolean),
        contract_date:         form.contractDate,
        has_sales_team:        form.hasSalesTeam,
        digital_maturity:      form.digitalMaturity,
        other_people:          form.otherPeople.filter((p) => p.name),
        upsell_potential:      form.upsellPotential,
        upsell_notes:          form.upsellNotes,
        raio_x_file_url:       form.raioXFile?.name ?? null,
        sla_file_url:          form.slaFile?.name ?? null,
      })
      clearDraft()
      setCreatedId(created.id)
      setDone(true)
    } else {
      setStep(step + 1)
      setErrors({})
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  function prev() {
    if (step > 0) { setStep(step - 1); setErrors({}) }
    else navigate('/')
  }

  // ── Completion screen ────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center animate-slide-up">
          <div className="relative inline-flex mb-6">
            <div className="w-24 h-24 rounded-3xl bg-gradient-rl flex items-center justify-center shadow-glow animate-float">
              <Rocket className="w-12 h-12 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-rl-gold flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-rl-bg" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-rl-text mb-2">Onboarding criado!</h1>
          <p className="text-rl-muted mb-6">
            O projeto <span className="text-rl-text font-semibold">{form.companyName}</span> foi adicionado com sucesso.
          </p>

          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate('/')} className="btn-ghost flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Dashboard
            </button>
            {createdId && (
              <button
                onClick={() => navigate(`/project/${createdId}`)}
                className="btn-primary flex items-center gap-2"
              >
                Ver Projeto <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const currentStep = STEPS[step]
  const StepIcon = currentStep.icon

  return (
    <div className="min-h-screen bg-gradient-dark">

      {/* ── Sticky header ───────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 border-b border-rl-border bg-rl-bg/80 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-6">
          <div className="h-14 flex items-center justify-between gap-4">
            <button onClick={prev} className="flex items-center gap-2 text-rl-muted hover:text-rl-text transition-colors text-sm">
              <ArrowLeft className="w-4 h-4" />
              {step === 0 ? 'Cancelar' : 'Voltar'}
            </button>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-rl-purple" />
              <span className="text-sm font-semibold text-rl-text">Novo Onboarding</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-rl-muted text-sm">{step + 1}/{STEPS.length}</span>
            </div>
          </div>
          <div className="h-0.5 bg-rl-surface relative -mx-6">
            <div
              className="h-full bg-gradient-rl absolute left-0 top-0 progress-fill"
              style={{ width: `${((step + 0.5) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Draft banner ────────────────────────────────────────────────────── */}
      {hasDraft && (
        <div className="max-w-2xl mx-auto px-6 pt-4">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-rl-purple/10 border border-rl-purple/20">
            <p className="text-xs text-rl-purple font-medium">
              📋 Rascunho recuperado — continuando de onde você parou.
            </p>
            <button
              onClick={() => { clearDraft(); setForm(initialForm); setStep(0); setCompletedSteps([]) }}
              className="text-xs text-rl-muted hover:text-rl-text transition-colors whitespace-nowrap"
            >
              Limpar
            </button>
          </div>
        </div>
      )}

      {/* ── Step indicators ─────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-6 pt-6 pb-2">
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const isCompleted = completedSteps.includes(i)
            const isCurrent   = i === step
            return (
              <div key={s.id} className="flex items-center gap-1">
                <div className="flex flex-col items-center gap-1 min-w-[52px]">
                  <div className={`step-indicator
                    ${isCompleted ? 'bg-rl-green text-white' : ''}
                    ${isCurrent && !isCompleted ? 'bg-gradient-rl text-white shadow-glow scale-110' : ''}
                    ${!isCurrent && !isCompleted ? 'bg-rl-surface text-rl-muted border border-rl-border' : ''}
                  `}>
                    {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className={`text-[10px] font-medium whitespace-nowrap ${isCurrent ? 'text-rl-purple' : isCompleted ? 'text-rl-green' : 'text-rl-muted'}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 w-6 rounded-full mb-5 transition-all duration-500 ${isCompleted ? 'bg-rl-green' : 'bg-rl-border'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Form card ───────────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-6 pb-16">
        <div className="glass-card p-6 sm:p-8 animate-slide-in">

          {/* Step header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-rl flex items-center justify-center shadow-glow shrink-0">
              <StepIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-rl-text">{currentStep.title}</h2>
              <p className="text-rl-muted text-sm">{currentStep.sub}</p>
            </div>
          </div>

          {/* ─── STEP 1: Dados da Empresa ──────────────────────── */}
          {step === 0 && (
            <div className="space-y-6">

              {/* Tipo de Negócio */}
              <div>
                <label className="label-field">Tipo de Negócio <span className="text-rl-red">*</span></label>
                <div className="grid grid-cols-2 gap-3">
                  {BUSINESS_TYPES.map((bt) => (
                    <button
                      key={bt.value} type="button"
                      onClick={() => set('businessType', bt.value)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all duration-150 ${
                        form.businessType === bt.value
                          ? 'bg-gradient-rl border-transparent text-white shadow-glow scale-[1.02]'
                          : 'bg-rl-surface border-rl-border text-rl-muted hover:border-rl-purple/40 hover:text-rl-text'
                      }`}
                    >
                      <span className="text-2xl">{bt.icon}</span>
                      <span className="text-sm font-semibold">{bt.label}</span>
                      <span className="text-xs opacity-75 leading-tight">{bt.desc}</span>
                    </button>
                  ))}
                </div>
                {errors.businessType && <p className="text-rl-red text-xs mt-1">{errors.businessType}</p>}
              </div>

              {/* Nome da Empresa */}
              <div>
                <label className="label-field">Nome da Empresa <span className="text-rl-red">*</span></label>
                <input
                  value={form.companyName}
                  onChange={(e) => set('companyName', e.target.value)}
                  placeholder="Ex: Bio Cosméticos LTDA"
                  className={`input-field ${errors.companyName ? 'border-rl-red' : ''}`}
                />
                {errors.companyName && <p className="text-rl-red text-xs mt-1">{errors.companyName}</p>}
              </div>

              {/* CNPJ */}
              <div>
                <label className="label-field">CNPJ</label>
                <input
                  value={form.cnpj}
                  onChange={(e) => set('cnpj', formatCNPJ(e.target.value))}
                  placeholder="00.000.000/0001-00"
                  className="input-field"
                />
              </div>

              {/* Responsável + Cargo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-field">Nome do Responsável <span className="text-rl-red">*</span></label>
                  <input
                    value={form.responsibleName}
                    onChange={(e) => set('responsibleName', e.target.value)}
                    placeholder="Ex: João Silva"
                    className={`input-field ${errors.responsibleName ? 'border-rl-red' : ''}`}
                  />
                  {errors.responsibleName && <p className="text-rl-red text-xs mt-1">{errors.responsibleName}</p>}
                </div>
                <div>
                  <label className="label-field">Cargo do Responsável</label>
                  <input
                    value={form.responsibleRole}
                    onChange={(e) => set('responsibleRole', e.target.value)}
                    placeholder="Ex: Diretor de Marketing"
                    className="input-field"
                  />
                </div>
              </div>

              {/* Segmento */}
              <div>
                <label className="label-field">Segmento</label>
                <p className="text-xs text-rl-muted mb-2">Digite ou clique em uma sugestão.</p>
                <SegmentoField value={form.segmento} onChange={(v) => set('segmento', v)} />
              </div>
            </div>
          )}

          {/* ─── STEP 2: Documentos ────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="flex items-start gap-3 bg-rl-purple/5 border border-rl-purple/20 rounded-xl p-4">
                <FileText className="w-5 h-5 text-rl-purple mt-0.5 shrink-0" />
                <p className="text-sm text-rl-muted">
                  Anexe os documentos enviados pelo vendedor durante a passagem de bastão.
                  Formatos aceitos: PDF, DOC, DOCX, PNG, JPG.
                </p>
              </div>
              <FileUpload
                label="Raio-X do Cliente"
                file={form.raioXFile}
                onChange={(f) => set('raioXFile', f)}
                description="PDF ou DOCX · Diagnóstico inicial do cliente"
              />
              <FileUpload
                label="SLA — Passagem de Bastão"
                file={form.slaFile}
                onChange={(f) => set('slaFile', f)}
                description="PDF ou DOCX · Acordo de nível de serviço"
              />
            </div>
          )}

          {/* ─── STEP 3: Serviços Contratados ──────────────────── */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <label className="label-field">
                  Serviços Contratados <span className="text-rl-red">*</span>
                </label>
                {form.services.length > 0 && (
                  <span className="text-[11px] font-semibold text-rl-purple bg-rl-purple/10 border border-rl-purple/20 px-2.5 py-1 rounded-full">
                    {form.services.length} selecionado{form.services.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {SERVICES_CONFIG.map((config) => (
                <ServiceCard
                  key={config.id}
                  config={config}
                  selected={form.services.includes(config.id)}
                  data={form.servicesData[config.id] || {}}
                  onToggle={toggleService}
                  onDataChange={updateServiceData}
                />
              ))}

              {errors.services && <p className="text-rl-red text-xs mt-1">{errors.services}</p>}
            </div>
          )}

          {/* ─── STEP 4: Contrato & Concorrência ───────────────── */}
          {step === 3 && (
            <div className="space-y-6">

              {/* Modelo de Contratação */}
              <div>
                <label className="label-field">
                  Modelo de Contratação <span className="text-rl-red">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {[
                    { value: 'aceleracao', label: 'Programa de Aceleração', emoji: '🚀', desc: 'Contrato por período determinado' },
                    { value: 'assessoria', label: 'Assessoria Mensal',       emoji: '📅', desc: 'Contrato mensal recorrente'      },
                  ].map((opt) => (
                    <button
                      key={opt.value} type="button"
                      onClick={() => set('contractModel', opt.value)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all duration-150 ${
                        form.contractModel === opt.value
                          ? 'bg-gradient-rl border-transparent text-white shadow-glow scale-[1.02]'
                          : 'bg-rl-surface border-rl-border text-rl-muted hover:border-rl-purple/40 hover:text-rl-text'
                      }`}
                    >
                      <span className="text-2xl">{opt.emoji}</span>
                      <span className="text-sm font-semibold">{opt.label}</span>
                      <span className="text-xs opacity-75 leading-tight">{opt.desc}</span>
                    </button>
                  ))}
                </div>
                {errors.contractModel && <p className="text-rl-red text-xs mt-2">{errors.contractModel}</p>}

                {/* Programa de Aceleração — sub-fields */}
                {form.contractModel === 'aceleracao' && (
                  <div className="mt-4 p-4 rounded-xl bg-rl-surface border border-rl-border/60 space-y-4">
                    <div>
                      <label className="label-field mb-2">Tipo de Pagamento</label>
                      <div className="flex gap-3">
                        {[
                          { label: 'Valor Único',        value: 'unico'  },
                          { label: 'Parcelado (Mensal)', value: 'mensal' },
                        ].map((opt) => (
                          <button
                            key={opt.value} type="button"
                            onClick={() => set('contractPaymentType', opt.value)}
                            className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                              form.contractPaymentType === opt.value
                                ? 'bg-gradient-rl border-transparent text-white shadow-glow'
                                : 'bg-rl-bg border-rl-border text-rl-muted hover:border-rl-purple/40'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="label-field">
                        {form.contractPaymentType === 'mensal' ? 'Valor Mensal' : 'Valor do Contrato'}
                      </label>
                      <div className="relative mt-1">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rl-muted" />
                        <input
                          value={form.contractValue}
                          onChange={(e) => set('contractValue', formatCurrency(e.target.value))}
                          placeholder="R$ 0,00"
                          className="input-field pl-9"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Assessoria Mensal — sub-field */}
                {form.contractModel === 'assessoria' && (
                  <div className="mt-4 p-4 rounded-xl bg-rl-surface border border-rl-border/60">
                    <label className="label-field">Valor Mensal</label>
                    <div className="relative mt-1">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rl-muted" />
                      <input
                        value={form.contractValue}
                        onChange={(e) => set('contractValue', formatCurrency(e.target.value))}
                        placeholder="R$ 0,00"
                        className="input-field pl-9"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Data de Assinatura */}
              <div>
                <label className="label-field">
                  Data de Assinatura do Contrato <span className="text-rl-red">*</span>
                </label>
                <div className="relative mt-1">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rl-muted pointer-events-none" />
                  <input
                    type="date"
                    value={form.contractDate}
                    onChange={(e) => set('contractDate', e.target.value)}
                    className={`input-field pl-10 ${errors.contractDate ? 'border-rl-red' : ''}`}
                  />
                </div>
                {errors.contractDate && <p className="text-rl-red text-xs mt-1">{errors.contractDate}</p>}
              </div>

              {/* Concorrentes */}
              <div>
                <label className="label-field">Sites dos Concorrentes</label>
                <p className="text-xs text-rl-muted mb-3">Adicione as URLs dos principais concorrentes do cliente.</p>
                <DynamicList
                  items={form.competitors}
                  onChange={(v) => set('competitors', v)}
                  placeholder="https://concorrente.com.br"
                />
              </div>
            </div>
          )}

          {/* ─── STEP 5: Equipe & Potencial ────────────────────── */}
          {step === 4 && (
            <div className="space-y-6">

              {/* Equipe Comercial */}
              <div>
                <label className="label-field">Tem equipe comercial? <span className="text-rl-red">*</span></label>
                <div className="flex gap-3 mt-2">
                  {[{ label: 'Sim', value: true }, { label: 'Não', value: false }].map((opt) => (
                    <button
                      key={String(opt.value)} type="button"
                      onClick={() => set('hasSalesTeam', opt.value)}
                      className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${
                        form.hasSalesTeam === opt.value
                          ? 'bg-gradient-rl border-transparent text-white shadow-glow'
                          : 'bg-rl-surface border-rl-border text-rl-muted hover:border-rl-purple/40'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {errors.hasSalesTeam && <p className="text-rl-red text-xs mt-1">{errors.hasSalesTeam}</p>}
              </div>

              {/* Maturidade Digital */}
              <div>
                <label className="label-field">Maturidade Digital <span className="text-rl-red">*</span></label>
                <div className="space-y-2 mt-2">
                  {MATURITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value} type="button"
                      onClick={() => set('digitalMaturity', opt.value)}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                        form.digitalMaturity === opt.value
                          ? 'border-rl-purple bg-rl-purple/10'
                          : 'border-rl-border bg-rl-surface hover:border-rl-purple/30'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        form.digitalMaturity === opt.value ? 'border-rl-purple bg-rl-purple' : 'border-rl-border'
                      }`}>
                        {form.digitalMaturity === opt.value && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${form.digitalMaturity === opt.value ? 'text-rl-purple' : 'text-rl-text'}`}>
                          Nível {opt.value} — {opt.label}
                        </p>
                        <p className="text-xs text-rl-muted">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
                {errors.digitalMaturity && <p className="text-rl-red text-xs mt-1">{errors.digitalMaturity}</p>}
              </div>

              {/* Outras pessoas */}
              <div>
                <label className="label-field">Outras Pessoas Envolvidas no Projeto</label>
                <p className="text-xs text-rl-muted mb-3">Adicione outros stakeholders que participarão do projeto.</p>
                <DynamicList
                  items={form.otherPeople.length > 0 ? form.otherPeople : []}
                  onChange={(v) => set('otherPeople', v)}
                  withRole
                  placeholder="Nome"
                  roleLabel="Cargo / Função"
                />
              </div>

              {/* Upsell */}
              <div>
                <label className="label-field">Possibilidade de Upsell? <span className="text-rl-red">*</span></label>
                <div className="flex gap-3 mt-2 mb-3">
                  {[
                    { label: 'Sim, tem potencial', value: true  },
                    { label: 'Não por enquanto',   value: false },
                  ].map((opt) => (
                    <button
                      key={String(opt.value)} type="button"
                      onClick={() => set('upsellPotential', opt.value)}
                      className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${
                        form.upsellPotential === opt.value
                          ? opt.value
                            ? 'bg-gradient-rl border-transparent text-white shadow-glow'
                            : 'bg-rl-muted/10 border-rl-muted/40 text-rl-muted'
                          : 'bg-rl-surface border-rl-border text-rl-muted hover:border-rl-purple/40'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {errors.upsellPotential && <p className="text-rl-red text-xs mt-1">{errors.upsellPotential}</p>}

                {form.upsellPotential === true && (
                  <div>
                    <label className="label-field">Observações sobre o Upsell</label>
                    <textarea
                      value={form.upsellNotes}
                      onChange={(e) => set('upsellNotes', e.target.value)}
                      placeholder="Descreva quais serviços podem ser adicionados futuramente..."
                      rows={3}
                      className="input-field resize-none mt-1"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── Navigation ────────────────────────────────────── */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-rl-border">
            <button onClick={prev} className="btn-secondary flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              {step === 0 ? 'Cancelar' : 'Anterior'}
            </button>

            <div className="flex items-center gap-1">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`rounded-full transition-all duration-300 ${
                    i === step ? 'w-6 h-2 bg-rl-purple' : completedSteps.includes(i) ? 'w-2 h-2 bg-rl-green' : 'w-2 h-2 bg-rl-border'
                  }`}
                />
              ))}
            </div>

            <button onClick={next} className="btn-primary flex items-center gap-2">
              {step === STEPS.length - 1
                ? <><Rocket className="w-4 h-4" /> Criar Projeto</>
                : <>Próximo <ArrowRight className="w-4 h-4" /></>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
