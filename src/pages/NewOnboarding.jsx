import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { cliente } from '../routes/paths'
import { supabase } from '../lib/supabase'
import {
  SERVICES_CONFIG, SEGMENTOS, SQUAD_COLORS, PLAN_TYPE_OPTIONS, BILLING_MODE_OPTIONS,
  rotuloSegmento, rotuloServico, rotuloSubServico, rotuloOpcaoServico, rotuloTipoPlano, rotuloCobranca,
} from '../lib/constants'
import { fmtCurrency, mrrValue } from '../lib/utils'
import { createClickUpClientFolder } from '../lib/clickup'
import { notifyNewClient } from '../lib/slack'
import { useI18n, localeAtual } from '../i18n'
import {
  ArrowLeft, ArrowRight, Check, Zap, Building2, FileText,
  Briefcase, DollarSign, Users, Calendar, Plus, X, Upload,
  Sparkles, Rocket, ChevronDown, ChevronUp,
} from 'lucide-react'

// Rótulos e descrições ficam em `onboarding.*` (src/i18n/locales/<idioma>/onboarding.js)
// e são traduzidos no render; `value` é o que vai para projects_v2.

// ─── Business types ───────────────────────────────────────────────────────────
const BUSINESS_TYPES = [
  { value: 'b2b',         icon: '🏢' },
  { value: 'local',       icon: '📍' },
  { value: 'ecommerce',   icon: '🛒' },
  { value: 'infoproduto', icon: '🎓' },
]

// ─── Maturity options ─────────────────────────────────────────────────────────
const MATURITY_OPTIONS = ['1', '2', '3', '4', '5'].map((value) => ({ value }))

// ─── Step definitions ─────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, chave: 'empresa',    icon: Building2 },
  { id: 2, chave: 'documentos', icon: FileText },
  { id: 3, chave: 'servicos',   icon: Briefcase },
  { id: 4, chave: 'contrato',   icon: Calendar },
  { id: 5, chave: 'equipe',     icon: Users },
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
  return (parseInt(n, 10) / 100).toLocaleString(localeAtual(), { style: 'currency', currency: 'BRL' })
}

function parseCurrencyToNumber(v) {
  if (!v || !v.trim()) return null
  return parseFloat(v.replace(/\D/g, '')) / 100 || null
}

// ─── Segmento Field ───────────────────────────────────────────────────────────
function SegmentoField({ value, onChange }) {
  const { t } = useI18n()
  return (
    <div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('onboarding.segmentoPlaceholder')}
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
            {rotuloSegmento(s)}
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
          {rotuloServico(config.id)}
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
              <label className="text-xs font-semibold text-rl-muted mb-1.5 block">{rotuloSubServico(field.key)}</label>
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
                      {rotuloOpcaoServico(opt)}
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
function DynamicList({ items, onChange, placeholder, withRole = false, roleLabel }) {
  const { t } = useI18n()
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
              <input value={item.name} onChange={(e) => updateField(i, 'name', e.target.value)} placeholder={t('onboarding.nome')} className="input-field flex-1" />
              <input value={item.role} onChange={(e) => updateField(i, 'role', e.target.value)} placeholder={roleLabel || t('onboarding.cargo')} className="input-field flex-1" />
            </>
          ) : (
            <input value={item} onChange={(e) => update(i, e.target.value)} placeholder={placeholder} className="input-field flex-1" />
          )}
          <button type="button" onClick={() => remove(i)} aria-label={t('comum.remover')} className="p-2.5 rounded-xl text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="flex items-center gap-2 text-sm text-rl-purple hover:text-rl-purple/80 transition-colors">
        <Plus className="w-4 h-4" />
        {withRole ? t('onboarding.adicionarPessoa') : t('onboarding.adicionarItem')}
      </button>
    </div>
  )
}

// ─── File Upload ──────────────────────────────────────────────────────────────
function FileUpload({ label, file, onChange, description }) {
  const ref = useRef()
  const { t, locale } = useI18n()
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
              <p className="text-xs text-rl-muted">{t('onboarding.kb', { n: (file.size / 1024).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })}</p>
            </div>
            <button type="button" onClick={(e) => { e.stopPropagation(); onChange(null) }} aria-label={t('onboarding.removerArquivo')} className="ml-auto p-1 rounded text-rl-muted hover:text-red-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="w-10 h-10 rounded-xl bg-rl-purple/10 flex items-center justify-center">
              <Upload className="w-5 h-5 text-rl-purple/60" />
            </div>
            <p className="text-sm text-rl-muted">
              <span className="text-rl-purple font-medium">{t('onboarding.cliqueEnviar')}</span> {t('onboarding.ouArraste')}
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
  contractDurationMonths: '', // duração em meses (só aceleração; vazio = fallback 3)
  contractDate:        '',
  planType:            '',   // 'programa' | 'plano'
  billingMode:         '',   // 'pre_pago' | 'pos_pago'
  competitors:         [''],
  // Step 5 — Equipe
  squad:               null,
  hasSalesTeam:        null,
  digitalMaturity:     '',
  otherPeople:         [],
  upsellPotential:     null,
  upsellNotes:         '',
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function NewOnboarding() {
  const { user, addProject, updateProject, squads, projects, teamMembers } = useApp()
  const navigate = useNavigate()
  const { t } = useI18n()

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

  // ── Recomendação de squad ─────────────────────────────────────────────────
  // Calcula o squad com menor MRR sob gestão (em produção, ignora is_test).
  // Auto-preenche form.squad ao chegar no step 4 se ainda não houver seleção,
  // garantindo que mesmo um usuário que apenas avança o formulário tenha
  // um squad atribuído (resolve casos onde o cadastro era salvo com squad=null).
  const recommendedSquadId = useMemo(() => {
    const productionSquads = squads.filter((sq) => !sq.isTest)
    if (productionSquads.length === 0) return null
    const stats = productionSquads.map((sq) => {
      const sqProjects = projects.filter(
        (p) => String(p.squad) === String(sq.id) && p.momento !== 'churn'
      )
      const totalMRR = sqProjects.reduce((acc, p) => acc + mrrValue(p), 0)
      return { id: sq.id, totalMRR, count: sqProjects.length }
    })
    stats.sort((a, b) => (a.totalMRR !== b.totalMRR ? a.totalMRR - b.totalMRR : a.count - b.count))
    return stats[0]?.id ?? null
  }, [squads, projects])

  useEffect(() => {
    if (step !== 4) return
    if (form.squad) return
    if (!recommendedSquadId) return
    setForm((f) => ({ ...f, squad: recommendedSquadId }))
  }, [step, form.squad, recommendedSquadId])

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
      if (!form.businessType)               e.businessType    = t('onboarding.erros.businessType')
      if (!form.companyName.trim())         e.companyName     = t('onboarding.erros.companyName')
      if (!form.cnpj.trim())                e.cnpj            = t('onboarding.erros.cnpj')
      if (!form.responsibleName.trim())     e.responsibleName = t('onboarding.erros.responsibleName')
      if (!form.responsibleRole.trim())     e.responsibleRole = t('onboarding.erros.responsibleRole')
      if (!form.segmento.trim())            e.segmento        = t('onboarding.erros.segmento')
    }
    if (s === 1) {
      // Documentos são opcionais: nada a validar.
    }
    if (s === 2) {
      if (form.services.length === 0) e.services = t('onboarding.erros.services')
    }
    if (s === 3) {
      if (!form.contractModel)  e.contractModel = t('onboarding.erros.contractModel')
      if (!form.contractDate)   e.contractDate  = t('onboarding.erros.contractDate')
      if (!form.contractValue.trim()) e.contractValue = t('onboarding.erros.contractValue')
      if (form.contractModel === 'aceleracao' && !form.contractPaymentType)
        e.contractPaymentType = t('onboarding.erros.contractPaymentType')
      if (!form.planType)    e.planType    = t('onboarding.erros.planType')
      if (!form.billingMode) e.billingMode = t('onboarding.erros.billingMode')
    }
    if (s === 4) {
      if (squads.length > 0 && !form.squad) e.squad           = t('onboarding.erros.squad')
      if (form.hasSalesTeam === null)        e.hasSalesTeam    = t('onboarding.erros.hasSalesTeam')
      if (!form.digitalMaturity)             e.digitalMaturity = t('onboarding.erros.digitalMaturity')
      if (form.upsellPotential === null)     e.upsellPotential = t('onboarding.erros.upsellPotential')
      if (form.upsellPotential === true && !form.upsellNotes.trim())
        e.upsellNotes = t('onboarding.erros.upsellNotes')
    }
    return e
  }

  async function next() {
    const e = validate(step)
    if (Object.keys(e).length > 0) { setErrors(e); return }

    setCompletedSteps((cs) => [...cs, step])

    if (step === STEPS.length - 1) {
      // Convert service IDs → labels for display
      const serviceLabels = form.services.map((id) => SERVICES_CONFIG.find((s) => s.id === id)?.label || id)

      // Gera o ID antecipadamente para usar no path do Storage
      const projectId = crypto.randomUUID()

      // Upload dos arquivos para o Storage (bucket privado project-docs)
      async function uploadDoc(file, prefix) {
        if (!file || !supabase) return null
        const ext = file.name.split('.').pop()
        const path = `${projectId}/${prefix}.${ext}`
        const { error } = await supabase.storage.from('project-docs').upload(path, file, { upsert: true })
        if (error) { console.error('[Storage] upload:', error.message); return null }
        return path
      }

      const [raioXPath, slaPath] = await Promise.all([
        uploadDoc(form.raioXFile, 'raio-x'),
        uploadDoc(form.slaFile, 'sla'),
      ])

      const created = addProject({
        id:                    projectId,
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
        contract_duration_months: form.contractDurationMonths ? Number(form.contractDurationMonths) : null,
        plan_type:             form.planType,
        billing_mode:          form.billingMode,
        competitors:           form.competitors.filter(Boolean),
        contract_date:         form.contractDate,
        has_sales_team:        form.hasSalesTeam,
        digital_maturity:      form.digitalMaturity,
        other_people:          form.otherPeople.filter((p) => p.name),
        upsell_potential:      form.upsellPotential,
        upsell_notes:          form.upsellNotes,
        raio_x_file_url:       raioXPath,
        sla_file_url:          slaPath,
        squad:                 form.squad || null,
      })
      clearDraft()
      setCreatedId(created.id)
      setDone(true)

      // Integração ClickUp — fail-soft: erro não bloqueia conclusão.
      // Inicia em background; quando termina, atualiza projects_v2 com os IDs.
      // 1) Coleta ClickUp user IDs dos membros do squad → fallback genérico
      const chosenSquad   = squads.find((s) => s.id === form.squad)
      const squadProfiles = (chosenSquad?.members || [])
        .map((m) => teamMembers.find((t) => t.id === m.profile_id))
        .filter(Boolean)
      const assigneeIds   = squadProfiles
        .map((p) => Number(p.clickupUserId ?? p.clickup_user_id))
        .filter((n) => Number.isFinite(n) && n > 0)
      // 2) Monta o mapa Departamento → ClickUp user ID a partir do
      //    departmentAssignments do squad (profile_id) + clickupUserId do profile
      const depAssignments = chosenSquad?.departmentAssignments || chosenSquad?.department_assignments || {}
      const departmentToClickupId = {}
      for (const [depName, profileId] of Object.entries(depAssignments)) {
        const profile = teamMembers.find((t) => t.id === profileId)
        const cuId    = Number(profile?.clickupUserId ?? profile?.clickup_user_id)
        if (Number.isFinite(cuId) && cuId > 0) {
          departmentToClickupId[depName] = cuId
        }
      }

      const clickupPromise = createClickUpClientFolder({
        companyName: form.companyName,
        startDateISO: form.contractDate || null,
        assigneeIds,
        departmentToClickupId,
      })
        .then((res) => {
          if (res.ok) {
            updateProject(created.id, {
              clickup_folder_id: res.folderId,
              clickup_list_id:   res.listId,
              clickup_list_url:  res.listUrl,
              clickup_chat_channel_id: res.chatChannelId,
            })
            return res
          } else {
            console.warn('[ClickUp] integração falhou:', res.error)
            return null
          }
        })
        .catch((e) => { console.warn('[ClickUp] erro inesperado:', e); return null })

      // Notificação Slack — fail-soft. Espera o ClickUp pra incluir o link
      // direto da lista na mensagem (quando der certo).
      clickupPromise.then((clickupRes) => {
        const projectUrl = `${window.location.origin}/project/${created.id}`
        notifyNewClient({
          companyName:     form.companyName,
          responsibleName: form.responsibleName,
          responsibleRole: form.responsibleRole,
          contractValue:   parseCurrencyToNumber(form.contractValue),
          contractModel:   form.contractModel,
          contractDate:    form.contractDate,
          squadName:       chosenSquad?.name || null,
          createdByName:   user?.name || null,
          projectUrl,
          clickupUrl:      clickupRes?.listUrl || null,
        }).then((res) => {
          if (!res.ok) console.warn('[Slack] notificação falhou:', res.error)
        }).catch((e) => console.warn('[Slack] erro inesperado:', e))
      })
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

          <h1 className="text-3xl font-bold text-rl-text mb-2">{t('onboarding.cadastrado')}</h1>
          <p className="text-rl-muted mb-6">
            {t('onboarding.cadastradoAntes')}<span className="text-rl-text font-semibold">{form.companyName}</span>{t('onboarding.cadastradoDepois')}
          </p>

          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate('/')} className="btn-ghost flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> {t('onboarding.dashboard')}
            </button>
            {createdId && (
              <button
                onClick={() => navigate(cliente(createdId))}
                className="btn-primary flex items-center gap-2"
              >
                {t('onboarding.verProjeto')} <ArrowRight className="w-4 h-4" />
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
              {step === 0 ? t('comum.cancelar') : t('comum.voltar')}
            </button>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-rl-purple" />
              <span className="text-sm font-semibold text-rl-text">{t('onboarding.novoCliente')}</span>
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
              {t('onboarding.rascunho')}
            </p>
            <button
              onClick={() => { clearDraft(); setForm(initialForm); setStep(0); setCompletedSteps([]) }}
              className="text-xs text-rl-muted hover:text-rl-text transition-colors whitespace-nowrap"
            >
              {t('comum.limpar')}
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
                    {t(`onboarding.passos.${s.chave}.label`)}
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
              <h2 className="text-xl font-bold text-rl-text">{t(`onboarding.passos.${currentStep.chave}.titulo`)}</h2>
              <p className="text-rl-muted text-sm">{t(`onboarding.passos.${currentStep.chave}.sub`)}</p>
            </div>
          </div>

          {/* ─── STEP 1: Dados da Empresa ──────────────────────── */}
          {step === 0 && (
            <div className="space-y-6">

              {/* Tipo de Negócio */}
              <div>
                <label className="label-field">{t('onboarding.tipoNegocio')} <span className="text-rl-red">*</span></label>
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
                      <span className="text-sm font-semibold">{t(`onboarding.negocio.${bt.value}.label`)}</span>
                      <span className="text-xs opacity-75 leading-tight">{t(`onboarding.negocio.${bt.value}.desc`)}</span>
                    </button>
                  ))}
                </div>
                {errors.businessType && <p className="text-rl-red text-xs mt-1">{errors.businessType}</p>}
              </div>

              {/* Nome da Empresa */}
              <div>
                <label className="label-field">{t('onboarding.nomeEmpresa')} <span className="text-rl-red">*</span></label>
                <input
                  value={form.companyName}
                  onChange={(e) => set('companyName', e.target.value)}
                  placeholder={t('onboarding.nomeEmpresaPlaceholder')}
                  className={`input-field ${errors.companyName ? 'border-rl-red' : ''}`}
                />
                {errors.companyName && <p className="text-rl-red text-xs mt-1">{errors.companyName}</p>}
              </div>

              {/* CNPJ */}
              <div>
                <label className="label-field">{t('onboarding.cnpj')} <span className="text-rl-red">*</span></label>
                <input
                  value={form.cnpj}
                  onChange={(e) => set('cnpj', formatCNPJ(e.target.value))}
                  placeholder={t('onboarding.cnpjPlaceholder')}
                  className={`input-field ${errors.cnpj ? 'border-rl-red' : ''}`}
                />
                {errors.cnpj && <p className="text-rl-red text-xs mt-1">{errors.cnpj}</p>}
              </div>

              {/* Responsável + Cargo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-field">{t('onboarding.nomeResponsavel')} <span className="text-rl-red">*</span></label>
                  <input
                    value={form.responsibleName}
                    onChange={(e) => set('responsibleName', e.target.value)}
                    placeholder={t('onboarding.nomeResponsavelPlaceholder')}
                    className={`input-field ${errors.responsibleName ? 'border-rl-red' : ''}`}
                  />
                  {errors.responsibleName && <p className="text-rl-red text-xs mt-1">{errors.responsibleName}</p>}
                </div>
                <div>
                  <label className="label-field">{t('onboarding.cargoResponsavel')} <span className="text-rl-red">*</span></label>
                  <input
                    value={form.responsibleRole}
                    onChange={(e) => set('responsibleRole', e.target.value)}
                    placeholder={t('onboarding.cargoResponsavelPlaceholder')}
                    className={`input-field ${errors.responsibleRole ? 'border-rl-red' : ''}`}
                  />
                  {errors.responsibleRole && <p className="text-rl-red text-xs mt-1">{errors.responsibleRole}</p>}
                </div>
              </div>

              {/* Segmento */}
              <div>
                <label className="label-field">{t('onboarding.segmento')} <span className="text-rl-red">*</span></label>
                <p className="text-xs text-rl-muted mb-2">{t('onboarding.segmentoDica')}</p>
                <SegmentoField value={form.segmento} onChange={(v) => set('segmento', v)} />
                {errors.segmento && <p className="text-rl-red text-xs mt-1">{errors.segmento}</p>}
              </div>
            </div>
          )}

          {/* ─── STEP 2: Documentos ────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="flex items-start gap-3 bg-rl-purple/5 border border-rl-purple/20 rounded-xl p-4">
                <FileText className="w-5 h-5 text-rl-purple mt-0.5 shrink-0" />
                <p className="text-sm text-rl-muted">
                  {t('onboarding.documentosAviso')}
                </p>
              </div>
              <div>
                <FileUpload
                  label={t('onboarding.raioX')}
                  file={form.raioXFile}
                  onChange={(f) => set('raioXFile', f)}
                  description={t('onboarding.raioXDesc')}
                />
              </div>
              <div>
                <FileUpload
                  label={t('onboarding.sla')}
                  file={form.slaFile}
                  onChange={(f) => set('slaFile', f)}
                  description={t('onboarding.slaDesc')}
                />
              </div>
            </div>
          )}

          {/* ─── STEP 3: Serviços Contratados ──────────────────── */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <label className="label-field">
                  {t('onboarding.servicosContratados')} <span className="text-rl-red">*</span>
                </label>
                {form.services.length > 0 && (
                  <span className="text-[11px] font-semibold text-rl-purple bg-rl-purple/10 border border-rl-purple/20 px-2.5 py-1 rounded-full">
                    {t('onboarding.selecionados', { count: form.services.length })}
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
                  {t('onboarding.modeloContratacao')} <span className="text-rl-red">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {[
                    { value: 'aceleracao', emoji: '🚀' },
                    { value: 'assessoria', emoji: '📅' },
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
                      <span className="text-sm font-semibold">{t(`onboarding.modelo.${opt.value}.label`)}</span>
                      <span className="text-xs opacity-75 leading-tight">{t(`onboarding.modelo.${opt.value}.desc`)}</span>
                    </button>
                  ))}
                </div>
                {errors.contractModel && <p className="text-rl-red text-xs mt-2">{errors.contractModel}</p>}

                {/* Programa de Aceleração — sub-fields */}
                {form.contractModel === 'aceleracao' && (
                  <div className="mt-4 p-4 rounded-xl bg-rl-surface border border-rl-border/60 space-y-4">
                    <div>
                      <label className="label-field">{t('onboarding.duracao')}</label>
                      <input
                        type="number" min="1" step="1"
                        value={form.contractDurationMonths}
                        onChange={(e) => set('contractDurationMonths', e.target.value)}
                        placeholder="3"
                        className="input-field mt-1"
                      />
                      <p className="text-xs text-rl-muted mt-1">{t('onboarding.duracaoDica')}</p>
                    </div>
                    <div>
                      <label className="label-field mb-2">{t('onboarding.tipoPagamento')} <span className="text-rl-red">*</span></label>
                      <div className="flex gap-3">
                        {[
                          { value: 'unico'  },
                          { value: 'mensal' },
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
                            {t(`onboarding.pagamento.${opt.value}`)}
                          </button>
                        ))}
                      </div>
                      {errors.contractPaymentType && <p className="text-rl-red text-xs mt-1">{errors.contractPaymentType}</p>}
                    </div>
                    <div>
                      <label className="label-field">
                        {form.contractPaymentType === 'mensal' ? t('onboarding.valorMensal') : t('onboarding.valorContrato')} <span className="text-rl-red">*</span>
                      </label>
                      <div className="relative mt-1">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rl-muted" />
                        <input
                          value={form.contractValue}
                          onChange={(e) => set('contractValue', formatCurrency(e.target.value))}
                          placeholder={t('onboarding.valorPlaceholder')}
                          className={`input-field pl-9 ${errors.contractValue ? 'border-rl-red' : ''}`}
                        />
                      </div>
                      {errors.contractValue && <p className="text-rl-red text-xs mt-1">{errors.contractValue}</p>}
                    </div>
                  </div>
                )}

                {/* Assessoria Mensal — sub-field */}
                {form.contractModel === 'assessoria' && (
                  <div className="mt-4 p-4 rounded-xl bg-rl-surface border border-rl-border/60">
                    <label className="label-field">{t('onboarding.valorMensal')} <span className="text-rl-red">*</span></label>
                    <div className="relative mt-1">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rl-muted" />
                      <input
                        value={form.contractValue}
                        onChange={(e) => set('contractValue', formatCurrency(e.target.value))}
                        placeholder={t('onboarding.valorPlaceholder')}
                        className={`input-field pl-9 ${errors.contractValue ? 'border-rl-red' : ''}`}
                      />
                    </div>
                    {errors.contractValue && <p className="text-rl-red text-xs mt-1">{errors.contractValue}</p>}
                  </div>
                )}
              </div>

              {/* Programa ou plano · Pré-pago ou pós-pago */}
              {[
                { key: 'planType',    label: t('onboarding.perguntaPlano'),    options: PLAN_TYPE_OPTIONS,    rotulo: rotuloTipoPlano },
                { key: 'billingMode', label: t('onboarding.perguntaCobranca'), options: BILLING_MODE_OPTIONS, rotulo: rotuloCobranca  },
              ].map((q) => (
                <div key={q.key}>
                  <label className="label-field">
                    {q.label} <span className="text-rl-red">*</span>
                  </label>
                  <div className="flex gap-3 mt-2">
                    {q.options.map((opt) => (
                      <button
                        key={opt.value} type="button"
                        onClick={() => set(q.key, opt.value)}
                        className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                          form[q.key] === opt.value
                            ? 'bg-gradient-rl border-transparent text-white shadow-glow'
                            : 'bg-rl-surface border-rl-border text-rl-muted hover:border-rl-purple/40 hover:text-rl-text'
                        }`}
                      >
                        {q.rotulo(opt.value)}
                      </button>
                    ))}
                  </div>
                  {errors[q.key] && <p className="text-rl-red text-xs mt-1">{errors[q.key]}</p>}
                </div>
              ))}

              {/* Data de Assinatura */}
              <div>
                <label className="label-field">
                  {t('onboarding.dataAssinatura')} <span className="text-rl-red">*</span>
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
            </div>
          )}

          {/* ─── STEP 5: Equipe & Potencial ────────────────────── */}
          {step === 4 && (
            <div className="space-y-6">

              {/* Squad responsável */}
              {squads.length > 0 && (() => {
                // Métricas por squad: clientes ativos + MRR sob gestão
                // Ignora squads em teste (is_test) — não fazem parte da operação real
                const productionSquads = squads.filter((sq) => !sq.isTest)
                const squadMetrics = productionSquads.map((sq) => {
                  const sqProjects = projects.filter(
                    (p) => String(p.squad) === String(sq.id) && p.momento !== 'churn'
                  )
                  const totalMRR = sqProjects.reduce((acc, p) => acc + mrrValue(p), 0)
                  const memberNames = (sq.members || [])
                    .map((m) => teamMembers.find((t) => t.id === m.profile_id)?.name)
                    .filter(Boolean)
                  return {
                    squad: sq,
                    clientsCount: sqProjects.length,
                    totalMRR,
                    memberNames,
                  }
                })

                // Recomendação: squad com MENOR MRR sob gestão (mais espaço pra absorver
                // novo cliente). Empate vai para quem tem menos clientes.
                let recommendedId = null
                if (squadMetrics.length > 0) {
                  const sorted = [...squadMetrics].sort((a, b) => {
                    if (a.totalMRR !== b.totalMRR) return a.totalMRR - b.totalMRR
                    return a.clientsCount - b.clientsCount
                  })
                  recommendedId = sorted[0].squad.id
                }

                return (
                  <div>
                    <label className="label-field">{t('onboarding.squadResponsavel')} <span className="text-rl-red">*</span></label>
                    <p className="text-xs text-rl-muted mb-3">
                      {t('onboarding.squadDica')}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {squadMetrics.map(({ squad: sq, clientsCount, totalMRR, memberNames }) => {
                        const idx        = squads.findIndex((s) => s.id === sq.id)
                        const c          = SQUAD_COLORS[idx % SQUAD_COLORS.length]
                        const selected   = form.squad === sq.id
                        const recommended = sq.id === recommendedId
                        return (
                          <button
                            key={sq.id}
                            type="button"
                            onClick={() => set('squad', sq.id)}
                            className={`relative flex flex-col gap-3 px-4 py-3.5 rounded-xl border text-left transition-all ${
                              selected
                                ? `${c.activeBg} ${c.activeBorder} ring-1 ${c.activeBorder}`
                                : `${c.bg} ${c.border} hover:${c.activeBorder}`
                            }`}
                          >
                            {/* Badge de recomendação no canto — fica visível mesmo selecionado */}
                            {recommended && (
                              <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rl-green text-white shadow-sm">
                                {t('onboarding.recomendado')}
                              </span>
                            )}

                            {/* Linha 1: emoji + nome + check */}
                            <div className="flex items-center gap-2">
                              <span className="text-lg leading-none">{sq.emoji || '👥'}</span>
                              <span className={`text-sm font-bold flex-1 ${selected ? c.text : 'text-rl-text'}`}>
                                {sq.name}
                              </span>
                              {selected && <Check className={`w-4 h-4 shrink-0 ${c.text}`} />}
                            </div>

                            {/* Linha 2: membros */}
                            {memberNames.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {memberNames.map((name, i) => (
                                  <span
                                    key={i}
                                    className="text-[10px] px-2 py-0.5 rounded-full bg-rl-bg/60 border border-rl-border text-rl-muted"
                                  >
                                    {name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] text-rl-muted italic">{t('onboarding.semMembros')}</span>
                            )}

                            {/* Linha 3: métricas em duas colunas */}
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-rl-border/60">
                              <div>
                                <p className="text-[9px] uppercase tracking-wider text-rl-muted font-semibold">{t('onboarding.clientes')}</p>
                                <p className={`text-base font-bold tabular-nums ${selected ? c.text : 'text-rl-text'}`}>
                                  {clientsCount}
                                </p>
                              </div>
                              <div>
                                <p className="text-[9px] uppercase tracking-wider text-rl-muted font-semibold">{t('onboarding.mrrGerenciado')}</p>
                                <p className={`text-base font-bold tabular-nums ${selected ? c.text : 'text-rl-text'}`}>
                                  {fmtCurrency(totalMRR)}
                                </p>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                    {errors.squad && <p className="text-rl-red text-xs mt-1">{errors.squad}</p>}
                  </div>
                )
              })()}

              {/* Equipe Comercial */}
              <div>
                <label className="label-field">{t('onboarding.equipeComercial')} <span className="text-rl-red">*</span></label>
                <div className="flex gap-3 mt-2">
                  {[{ label: t('comum.sim'), value: true }, { label: t('comum.nao'), value: false }].map((opt) => (
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
                <label className="label-field">{t('onboarding.maturidadeDigital')} <span className="text-rl-red">*</span></label>
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
                          {t('onboarding.maturidade.nivel', { n: opt.value, label: t(`onboarding.maturidade.${opt.value}.label`) })}
                        </p>
                        <p className="text-xs text-rl-muted">{t(`onboarding.maturidade.${opt.value}.desc`)}</p>
                      </div>
                    </button>
                  ))}
                </div>
                {errors.digitalMaturity && <p className="text-rl-red text-xs mt-1">{errors.digitalMaturity}</p>}
              </div>

              {/* Outras pessoas */}
              <div>
                <label className="label-field">{t('onboarding.outrasPessoas')}</label>
                <p className="text-xs text-rl-muted mb-3">{t('onboarding.outrasPessoasDica')}</p>
                <DynamicList
                  items={form.otherPeople.length > 0 ? form.otherPeople : []}
                  onChange={(v) => set('otherPeople', v)}
                  withRole
                  placeholder={t('onboarding.nome')}
                  roleLabel={t('onboarding.cargoFuncao')}
                />
              </div>

              {/* Upsell */}
              <div>
                <label className="label-field">{t('onboarding.upsell')} <span className="text-rl-red">*</span></label>
                <div className="flex gap-3 mt-2 mb-3">
                  {[
                    { label: t('onboarding.upsellSim'), value: true  },
                    { label: t('onboarding.upsellNao'), value: false },
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
                    <label className="label-field">{t('onboarding.upsellObs')}</label>
                    <textarea
                      value={form.upsellNotes}
                      onChange={(e) => set('upsellNotes', e.target.value)}
                      placeholder={t('onboarding.upsellObsPlaceholder')}
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
              {step === 0 ? t('comum.cancelar') : t('onboarding.anterior')}
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
                ? <><Rocket className="w-4 h-4" /> {t('onboarding.criarProjeto')}</>
                : <>{t('onboarding.proximo')} <ArrowRight className="w-4 h-4" /></>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
