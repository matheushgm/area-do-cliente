import { useState, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { getSignedUrl } from '../lib/supabase'
import {
  Camera, X, CheckCircle2, ClipboardList, BarChart3,
  Users, Zap, CalendarDays, ChevronRight, Building2,
  FileText, Globe, Phone, TrendingUp, Star, FileDown,
  Paperclip, Clapperboard, LayoutTemplate, Activity, FlaskConical, Search, Layers, ImagePlay, Map, Package,
  Pencil, Plus,
} from 'lucide-react'
import ROICalculator from '../components/ROICalculator'
import PersonaCreator from './PersonaCreator'
import OfertaMatadora from './OfertaMatadora'
import CampaignPlanner from '../components/CampaignPlanner'
import AnexosModule from '../components/AnexosModule'
import CriativosModule from '../components/CriativosModule'
import LandingPageModule from '../components/LandingPageModule'
import ResultadosModule from '../components/ResultadosModule'
import MetaLabModule from '../components/MetaLabModule'
import GoogleAdsModule from '../components/GoogleAdsModule'
import EstrategiaModule from '../components/EstrategiaModule'
import EstrategiaV2Module from '../components/EstrategiaV2Module'
import ProdutoServicoModule from '../components/ProdutoServicoModule'
import BancoMidiaModule from '../components/BancoMidiaModule'
import { SERVICES_CONFIG } from './NewOnboarding'
import { exportOnboardingPDF, exportClientProfilePDF } from '../utils/exportPDF'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtCurrency(n) {
  if (n == null || isNaN(n) || !isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

const BUSINESS_LABELS = {
  b2b: 'B2B',
  local: 'Negócio Local',
  ecommerce: 'E-commerce',
  infoproduto: 'Infoproduto',
}

// ─── Edit-form constants ───────────────────────────────────────────────────────
const EDIT_BUSINESS_TYPES = [
  { value: 'b2b',         label: 'B2B',          icon: '🏢' },
  { value: 'local',       label: 'Negócio Local', icon: '📍' },
  { value: 'ecommerce',   label: 'E-commerce',    icon: '🛒' },
  { value: 'infoproduto', label: 'Infoproduto',   icon: '🎓' },
]

const EDIT_MATURITY_OPTIONS = [
  { value: '1', label: 'Iniciante — nunca anunciou' },
  { value: '2', label: 'Básico — já testou anúncios' },
  { value: '3', label: 'Intermediário — tem histórico' },
  { value: '4', label: 'Avançado — processos definidos' },
  { value: '5', label: 'Expert — gestão data-driven' },
]

const EDIT_SEGMENTOS = [
  'Beleza e Estética', 'Saúde e Bem-estar', 'Alimentação / Gastronomia',
  'Clínica / Odontologia', 'Academia / Fitness', 'Moda e Vestuário',
  'E-commerce / Varejo', 'Imobiliário', 'Tecnologia / SaaS',
  'Educação / Cursos Online', 'Serviços Profissionais', 'Consultoria Empresarial',
  'Marketing Digital', 'Social Media', 'Turismo e Viagens',
  'Construção Civil', 'Automotivo', 'Farmácia / Drogaria', 'Pet Shop / Veterinária',
  'Advocacia / Jurídico', 'Financeiro / Seguros', 'Ótica',
  'Entretenimento / Eventos', 'Logística / Transporte', 'Indústria / Manufatura',
]

const MATURITY_LABELS = {
  '1': 'Iniciante — nunca anunciou online',
  '2': 'Básico — já testou anúncios',
  '3': 'Intermediário — tem histórico de campanhas',
  '4': 'Avançado — processos definidos',
  '5': 'Expert — gestão data-driven',
}

function initials(name = '') {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('')
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────
function Modal({ title, icon: Icon, iconColor = 'text-rl-purple', onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="min-h-screen flex items-start justify-center p-4 py-8">
        <div className="glass-card w-full max-w-4xl shadow-2xl">
          {/* Sticky header */}
          <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-rl-border bg-rl-bg/95 backdrop-blur z-10 rounded-t-2xl">
            <div className="flex items-center gap-2">
              {Icon && <Icon className={`w-5 h-5 ${iconColor}`} />}
              <h2 className="text-base font-bold text-rl-text">{title}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6">{children}</div>
        </div>
      </div>
    </div>
  )
}

// ─── Service detail labels (for display in OnboardingContent) ─────────────────
const SERVICE_DETAIL_LABELS = {
  imagemQty:    'Imagens',
  videoQty:     'Vídeos',
  estaticosQty: 'Estáticos',
  qty:          'Qtd.',
  nivel:        'Nível',
}

const CONTRACT_MODEL_LABELS = {
  aceleracao: '🚀 Programa de Aceleração',
  assessoria: '📅 Assessoria Mensal',
}

const CONTRACT_PAYMENT_LABELS = {
  unico:  'Valor Único',
  mensal: 'Parcelado (Mensal)',
}

// ─── Onboarding Edit Form ─────────────────────────────────────────────────────
function OnboardingEditForm({ project, onSave, onCancel }) {
  // Map stored service labels → IDs for the checkboxes
  const initialServiceIds = (project.services || [])
    .map((label) => SERVICES_CONFIG.find((s) => s.label === label)?.id)
    .filter(Boolean)

  const [form, setForm] = useState({
    businessType:        project.businessType        || '',
    companyName:         project.companyName         || '',
    segmento:            project.segmento            || '',
    cnpj:                project.cnpj                || '',
    responsibleName:     project.responsibleName     || '',
    responsibleRole:     project.responsibleRole     || '',
    services:            initialServiceIds,
    servicesData:        project.servicesData        || {},
    contractModel:       project.contractModel       || '',
    contractPaymentType: project.contractPaymentType || '',
    contractValue:       project.contractValue       ?? '',
    contractDate:        project.contractDate        || '',
    competitors:         project.competitors?.length ? [...project.competitors] : [''],
    hasSalesTeam:        project.hasSalesTeam        ?? null,
    digitalMaturity:     project.digitalMaturity     || '',
    otherPeople:         project.otherPeople?.length ? [...project.otherPeople] : [],
    upsellPotential:     project.upsellPotential     ?? null,
    upsellNotes:         project.upsellNotes         || '',
  })

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  function toggleService(id) {
    set('services', form.services.includes(id)
      ? form.services.filter((s) => s !== id)
      : [...form.services, id]
    )
  }

  function handleSave() {
    const serviceLabels = form.services.map((id) => SERVICES_CONFIG.find((s) => s.id === id)?.label || id)
    onSave({
      businessType:        form.businessType,
      companyName:         form.companyName,
      segmento:            form.segmento,
      cnpj:                form.cnpj,
      responsibleName:     form.responsibleName,
      responsibleRole:     form.responsibleRole,
      services:            serviceLabels,
      servicesData:        form.servicesData,
      contractModel:       form.contractModel,
      contractPaymentType: form.contractPaymentType,
      contractValue:       Number(form.contractValue) || null,
      contractDate:        form.contractDate,
      competitors:         form.competitors.filter(Boolean),
      hasSalesTeam:        form.hasSalesTeam,
      digitalMaturity:     form.digitalMaturity,
      otherPeople:         form.otherPeople.filter((p) => p.name),
      upsellPotential:     form.upsellPotential,
      upsellNotes:         form.upsellNotes,
    })
  }

  const yesNoBtn = (field, val) => (
    <button
      onClick={() => set(field, val)}
      className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${
        form[field] === val
          ? 'bg-rl-purple/10 border-rl-purple/40 text-rl-purple'
          : 'bg-rl-surface border-rl-border text-rl-muted hover:border-rl-purple/30'
      }`}
    >
      {val ? '✅ Sim' : '❌ Não'}
    </button>
  )

  return (
    <div className="space-y-8">

      {/* Top action bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-rl-muted">Edite os dados do onboarding abaixo</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-ghost text-sm">Cancelar</button>
          <button onClick={handleSave} className="btn-primary flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            Salvar Alterações
          </button>
        </div>
      </div>

      {/* 🏢 Empresa */}
      <div className="space-y-4">
        <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider">🏢 Empresa</p>

        {/* Business type */}
        <div>
          <label className="label-field">Tipo de Negócio</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {EDIT_BUSINESS_TYPES.map((bt) => (
              <button
                key={bt.value}
                onClick={() => set('businessType', bt.value)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
                  form.businessType === bt.value
                    ? 'bg-gradient-rl border-transparent text-white shadow-glow'
                    : 'bg-rl-surface border-rl-border text-rl-muted hover:border-rl-purple/40 hover:text-rl-text'
                }`}
              >
                <span className="text-xl">{bt.icon}</span>
                <span className="text-xs font-semibold">{bt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Company fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label-field">Nome da Empresa</label>
            <input value={form.companyName} onChange={(e) => set('companyName', e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="label-field">CNPJ</label>
            <input value={form.cnpj} onChange={(e) => set('cnpj', e.target.value)} placeholder="00.000.000/0000-00" className="input-field" />
          </div>
          <div>
            <label className="label-field">Responsável</label>
            <input value={form.responsibleName} onChange={(e) => set('responsibleName', e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="label-field">Cargo</label>
            <input value={form.responsibleRole} onChange={(e) => set('responsibleRole', e.target.value)} className="input-field" />
          </div>
        </div>

        {/* Segmento */}
        <div>
          <label className="label-field">Segmento</label>
          <input
            value={form.segmento}
            onChange={(e) => set('segmento', e.target.value)}
            placeholder="Ex: Beleza e Estética..."
            className="input-field mb-2"
          />
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
            {EDIT_SEGMENTOS.map((s) => (
              <button
                key={s}
                onClick={() => set('segmento', s)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap transition-all ${
                  form.segmento === s
                    ? 'bg-rl-purple/20 border-rl-purple/60 text-rl-purple'
                    : 'bg-rl-surface border-rl-border text-rl-muted hover:border-rl-purple/30 hover:text-rl-text'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ⚙️ Serviços */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider">⚙️ Serviços Contratados</p>
        <div className="flex flex-wrap gap-2">
          {SERVICES_CONFIG.map((svc) => (
            <button
              key={svc.id}
              onClick={() => toggleService(svc.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                form.services.includes(svc.id)
                  ? 'bg-rl-purple/10 border-rl-purple/40 text-rl-purple'
                  : 'bg-rl-surface border-rl-border text-rl-muted hover:border-rl-purple/30 hover:text-rl-text'
              }`}
            >
              <span>{svc.emoji}</span>
              {svc.label}
            </button>
          ))}
        </div>
      </div>

      {/* 📋 Contrato */}
      <div className="space-y-4">
        <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider">📋 Contrato</p>

        {/* Modelo */}
        <div>
          <label className="label-field">Modelo de Contratação</label>
          <div className="flex gap-3">
            {[
              { value: 'aceleracao', label: '🚀 Programa de Aceleração' },
              { value: 'assessoria', label: '📅 Assessoria Mensal' },
            ].map((m) => (
              <button
                key={m.value}
                onClick={() => set('contractModel', m.value)}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  form.contractModel === m.value
                    ? 'bg-rl-purple/10 border-rl-purple/40 text-rl-purple'
                    : 'bg-rl-surface border-rl-border text-rl-muted hover:border-rl-purple/30'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tipo pagamento (aceleração only) */}
        {form.contractModel === 'aceleracao' && (
          <div>
            <label className="label-field">Tipo de Pagamento</label>
            <div className="flex gap-3">
              {[
                { value: 'unico',  label: 'Valor Único' },
                { value: 'mensal', label: 'Parcelado (Mensal)' },
              ].map((pt) => (
                <button
                  key={pt.value}
                  onClick={() => set('contractPaymentType', pt.value)}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    form.contractPaymentType === pt.value
                      ? 'bg-rl-purple/10 border-rl-purple/40 text-rl-purple'
                      : 'bg-rl-surface border-rl-border text-rl-muted hover:border-rl-purple/30'
                  }`}
                >
                  {pt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Valor + Data */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label-field">
              {form.contractModel === 'aceleracao' ? 'Valor do Contrato (R$)' : 'Valor Mensal (R$)'}
            </label>
            <input
              type="number" min="0"
              value={form.contractValue}
              onChange={(e) => set('contractValue', e.target.value)}
              placeholder="0"
              className="input-field"
            />
          </div>
          <div>
            <label className="label-field">Data de Assinatura</label>
            <input
              type="date"
              value={form.contractDate}
              onChange={(e) => set('contractDate', e.target.value)}
              className="input-field"
            />
          </div>
        </div>
      </div>

      {/* ⚔️ Concorrentes */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider">⚔️ Concorrentes</p>
        <div className="space-y-2">
          {form.competitors.map((c, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={c}
                onChange={(e) => {
                  const n = [...form.competitors]; n[i] = e.target.value; set('competitors', n)
                }}
                placeholder="Nome do concorrente"
                className="input-field flex-1"
              />
              <button
                onClick={() => set('competitors', form.competitors.filter((_, idx) => idx !== i))}
                className="p-2.5 rounded-xl text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            onClick={() => set('competitors', [...form.competitors, ''])}
            className="flex items-center gap-2 text-sm text-rl-purple hover:text-rl-purple/80 transition-colors"
          >
            <Plus className="w-4 h-4" /> Adicionar concorrente
          </button>
        </div>
      </div>

      {/* 👥 Equipe & Potencial */}
      <div className="space-y-4">
        <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider">👥 Equipe & Potencial</p>

        {/* Time de vendas */}
        <div>
          <label className="label-field">Time de Vendas Interno</label>
          <div className="flex gap-3">{yesNoBtn('hasSalesTeam', true)}{yesNoBtn('hasSalesTeam', false)}</div>
        </div>

        {/* Maturidade digital */}
        <div>
          <label className="label-field">Maturidade Digital</label>
          <div className="flex flex-wrap gap-2">
            {EDIT_MATURITY_OPTIONS.map((m) => (
              <button
                key={m.value}
                onClick={() => set('digitalMaturity', m.value)}
                className={`px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                  form.digitalMaturity === m.value
                    ? 'bg-rl-purple/10 border-rl-purple/40 text-rl-purple'
                    : 'bg-rl-surface border-rl-border text-rl-muted hover:border-rl-purple/30'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Potencial de upsell */}
        <div>
          <label className="label-field">Potencial de Upsell</label>
          <div className="flex gap-3">{yesNoBtn('upsellPotential', true)}{yesNoBtn('upsellPotential', false)}</div>
        </div>

        {form.upsellPotential === true && (
          <div>
            <label className="label-field">Obs. sobre Upsell</label>
            <textarea
              value={form.upsellNotes}
              onChange={(e) => set('upsellNotes', e.target.value)}
              rows={2}
              className="input-field resize-none text-sm"
              placeholder="Descreva o potencial de upsell..."
            />
          </div>
        )}

        {/* Outras pessoas */}
        <div>
          <label className="label-field">Outras Pessoas Envolvidas</label>
          <div className="space-y-2">
            {form.otherPeople.map((person, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={person.name}
                  onChange={(e) => {
                    const n = [...form.otherPeople]; n[i] = { ...n[i], name: e.target.value }; set('otherPeople', n)
                  }}
                  placeholder="Nome"
                  className="input-field flex-1"
                />
                <input
                  value={person.role || ''}
                  onChange={(e) => {
                    const n = [...form.otherPeople]; n[i] = { ...n[i], role: e.target.value }; set('otherPeople', n)
                  }}
                  placeholder="Cargo"
                  className="input-field flex-1"
                />
                <button
                  onClick={() => set('otherPeople', form.otherPeople.filter((_, idx) => idx !== i))}
                  className="p-2.5 rounded-xl text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => set('otherPeople', [...form.otherPeople, { name: '', role: '' }])}
              className="flex items-center gap-2 text-sm text-rl-purple hover:text-rl-purple/80 transition-colors"
            >
              <Plus className="w-4 h-4" /> Adicionar pessoa
            </button>
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="flex justify-end gap-3 pt-4 border-t border-rl-border">
        <button onClick={onCancel} className="btn-ghost text-sm">Cancelar</button>
        <button onClick={handleSave} className="btn-primary flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Salvar Alterações
        </button>
      </div>
    </div>
  )
}

// ─── Onboarding modal content ─────────────────────────────────────────────────
function OnboardingContent({ project, onSave }) {
  const [isEditing, setIsEditing] = useState(false)

  if (isEditing) {
    return (
      <OnboardingEditForm
        project={project}
        onSave={(data) => { onSave(data); setIsEditing(false) }}
        onCancel={() => setIsEditing(false)}
      />
    )
  }

  function Field({ label, value }) {
    if (!value) return null
    return (
      <div className="rounded-xl bg-rl-surface p-3">
        <p className="text-[11px] text-rl-muted mb-0.5">{label}</p>
        <p className="text-sm text-rl-text font-medium">{value}</p>
      </div>
    )
  }

  const competitors = (project.competitors || []).filter(Boolean)
  const otherPeople = (project.otherPeople || []).filter((p) => p.name)

  // Build service detail strings
  const serviceDetailEntries = Object.entries(project.servicesData || {}).reduce((acc, [id, data]) => {
    if (!data || Object.keys(data).length === 0) return acc
    const parts = Object.entries(data)
      .filter(([, v]) => v)
      .map(([key, val]) => `${SERVICE_DETAIL_LABELS[key] || key}: ${val}`)
      .join(' · ')
    if (parts) acc.push({ id, detail: parts })
    return acc
  }, [])

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={() => setIsEditing(true)}
          className="btn-ghost flex items-center gap-2 text-sm"
        >
          <Pencil className="w-4 h-4" />
          Editar Dados
        </button>
        <button
          onClick={() => exportOnboardingPDF(project)}
          className="btn-secondary flex items-center gap-2 text-sm"
          title="Exportar PDF"
        >
          <FileDown className="w-4 h-4" />
          Exportar PDF
        </button>
      </div>

      {/* Empresa */}
      <div>
        <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider mb-3">🏢 Empresa</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Tipo de Negócio"  value={BUSINESS_LABELS[project.businessType] || project.businessType} />
          <Field label="Segmento"         value={project.segmento} />
          <Field label="CNPJ"             value={project.cnpj} />
          <Field label="Responsável"      value={project.responsibleName} />
          <Field label="Cargo"            value={project.responsibleRole} />
          <Field label="Data do Contrato" value={project.contractDate
            ? new Date(project.contractDate + 'T00:00:00').toLocaleDateString('pt-BR')
            : null} />
        </div>
      </div>

      {/* Modelo de Contrato */}
      {(project.contractModel || project.contractValue) && (
        <div>
          <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider mb-3">📋 Modelo de Contrato</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Modelo"           value={CONTRACT_MODEL_LABELS[project.contractModel]} />
            {project.contractModel === 'aceleracao' && (
              <Field label="Tipo de Pagamento" value={CONTRACT_PAYMENT_LABELS[project.contractPaymentType]} />
            )}
            <Field
              label={project.contractModel === 'aceleracao' ? 'Valor do Contrato' : 'Valor Mensal'}
              value={project.contractValue ? fmtCurrency(project.contractValue) : null}
            />
          </div>
        </div>
      )}

      {/* Produto (backward compat — only show if exists) */}
      {project.productDescription && (
        <div>
          <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider mb-3">🛍️ Produto / Serviço</p>
          <div className="rounded-xl bg-rl-surface p-4">
            <p className="text-sm text-rl-text leading-relaxed">{project.productDescription}</p>
          </div>
        </div>
      )}

      {/* Serviços contratados */}
      {project.services?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider mb-3">⚙️ Serviços Contratados</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {project.services.map((s) => (
              <span key={s} className="px-3 py-1.5 rounded-full text-xs font-medium bg-rl-purple/10 text-rl-purple border border-rl-purple/20">
                {s}
              </span>
            ))}
          </div>
          {serviceDetailEntries.length > 0 && (
            <div className="space-y-1.5">
              {serviceDetailEntries.map(({ id, detail }) => (
                <p key={id} className="text-xs text-rl-muted flex items-start gap-1.5">
                  <span className="text-rl-purple/50 shrink-0">↳</span>
                  <span>{detail}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Público-alvo (backward compat) */}
      {project.targetAudience && (
        <div>
          <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider mb-3">🎯 Público-Alvo</p>
          <div className="rounded-xl bg-rl-surface p-4">
            <p className="text-sm text-rl-text leading-relaxed">{project.targetAudience}</p>
          </div>
        </div>
      )}

      {/* Equipe */}
      <div>
        <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider mb-3">👥 Equipe & Maturidade</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Time de Vendas"      value={project.hasSalesTeam === true ? 'Sim' : project.hasSalesTeam === false ? 'Não' : null} />
          <Field label="Maturidade Digital"  value={MATURITY_LABELS[project.digitalMaturity]} />
          <Field label="Potencial de Upsell" value={project.upsellPotential === true ? 'Sim' : project.upsellPotential === false ? 'Não' : null} />
        </div>
        {project.upsellNotes && (
          <div className="mt-3 rounded-xl bg-rl-surface p-4">
            <p className="text-[11px] text-rl-muted mb-1">Obs. Upsell</p>
            <p className="text-sm text-rl-text">{project.upsellNotes}</p>
          </div>
        )}
      </div>

      {/* Outras pessoas */}
      {otherPeople.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider mb-3">👤 Outras Pessoas Envolvidas</p>
          <div className="flex flex-wrap gap-2">
            {otherPeople.map((p, i) => (
              <span key={i} className="px-3 py-1.5 rounded-full text-xs bg-rl-surface text-rl-text border border-rl-border">
                {p.name}{p.role ? ` · ${p.role}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Concorrentes */}
      {competitors.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider mb-3">⚔️ Concorrentes</p>
          <div className="flex flex-wrap gap-2">
            {competitors.map((c, i) => (
              <span key={i} className="px-3 py-1.5 rounded-full text-xs bg-rl-surface text-rl-muted border border-rl-border font-mono">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Arquivos */}
      <ProjectDocs project={project} />
    </div>
  )
}

// ─── Project Docs ─────────────────────────────────────────────────────────────
function ProjectDocs({ project }) {
  const [urls, setUrls] = useState({ raioX: null, sla: null })

  useEffect(() => {
    async function loadUrls() {
      const [raioX, sla] = await Promise.all([
        project.raioXFileName ? getSignedUrl('project-docs', project.raioXFileName) : null,
        project.slaFileName   ? getSignedUrl('project-docs', project.slaFileName)   : null,
      ])
      setUrls({ raioX, sla })
    }
    if (project.raioXFileName || project.slaFileName) loadUrls()
  }, [project.raioXFileName, project.slaFileName])

  if (!project.raioXFileName && !project.slaFileName) return null

  function DocChip({ label, path, url, color }) {
    const filename = path?.split('/').pop() ?? label
    return (
      <div className="flex items-center gap-2 bg-rl-surface border border-rl-border rounded-xl px-4 py-2.5">
        <FileText className={`w-4 h-4 ${color}`} />
        <div className="mr-2">
          <p className="text-[10px] text-rl-muted">{label}</p>
          <p className="text-xs text-rl-text">{filename}</p>
        </div>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-[10px] font-medium text-rl-purple hover:underline whitespace-nowrap"
          >
            Abrir
          </a>
        )}
      </div>
    )
  }

  return (
    <div>
      <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider mb-3">📁 Documentos</p>
      <div className="flex flex-wrap gap-3">
        {project.raioXFileName && (
          <DocChip label="Raio-X" path={project.raioXFileName} url={urls.raioX} color="text-rl-purple" />
        )}
        {project.slaFileName && (
          <DocChip label="SLA" path={project.slaFileName} url={urls.sla} color="text-rl-cyan" />
        )}
      </div>
    </div>
  )
}

// ─── Section Card ─────────────────────────────────────────────────────────────
function SectionCard({ icon: Icon, iconColor, iconBg, title, preview, badge, badgeColor, onClick }) {
  return (
    <button
      onClick={onClick}
      className="glass-card p-5 text-left w-full hover:border-rl-purple/40 hover:shadow-glow transition-all duration-200 group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <ChevronRight className="w-4 h-4 text-rl-muted group-hover:text-rl-text group-hover:translate-x-0.5 transition-all" />
      </div>
      <h3 className="text-sm font-bold text-rl-text mb-1">{title}</h3>
      {preview && <p className="text-xs text-rl-muted line-clamp-2 leading-relaxed">{preview}</p>}
      {badge && (
        <div className={`inline-flex items-center gap-1 mt-3 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${badgeColor}`}>
          <CheckCircle2 className="w-3 h-3" />
          {badge}
        </div>
      )}
    </button>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ClientProfile({ project: projectProp }) {
  const { updateProject, projects } = useApp()
  const logoInputRef = useRef(null)

  // Always use the latest project from context
  const project = projects.find((p) => p.id === projectProp.id) || projectProp

  // Modal state — which panel is open
  const [openModal, setOpenModal] = useState(null)

  function handleLogoUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => updateProject(project.id, { logoBase64: ev.target.result })
    reader.readAsDataURL(file)
  }

  function handleSaveOnboarding(data) {
    updateProject(project.id, data)
    // don't close modal — OnboardingContent handles the mode toggle
  }

  function handleSaveROI(calc, result) {
    updateProject(project.id, { roiCalc: calc, roiResult: result })
    setOpenModal(null)
  }

  function handleSavePersonas(personas) {
    updateProject(project.id, { personas })
    setOpenModal('produtos')
  }

  function handleSaveProdutos(produtos) {
    updateProject(project.id, { produtos })
    setOpenModal(null)
  }

  function handleSaveOferta(ofertaData) {
    updateProject(project.id, { ofertaData })
    setOpenModal(null)
  }

  function handleSaveCampaign(plan) {
    updateProject(project.id, { campaignPlan: plan })
    setOpenModal(null)
  }

  function handleSaveEstrategia(estrategiaData) {
    updateProject(project.id, { estrategia: estrategiaData })
  }

  function handleSaveEstrategiaV2(data) {
    updateProject(project.id, { estrategiaV2: data })
    setOpenModal(null)
  }

  const companyInitials = initials(project.companyName)
  const hasROI          = !!project.roiResult
  const hasPersonas     = project.personas?.length > 0
  const hasOferta       = !!(project.ofertaData?.nome || project.ofertaData?.resultadoSonho)
  const hasCampaignPlan = !!(project.campaignPlan?.totalBudget > 0 && project.campaignPlan?.channels?.length > 0)
  const hasProdutos     = (project.produtos || []).length > 0 && !!(project.produtos[0]?.nome || project.produtos[0]?.answers?.q1)
  const hasGoogleAds    = (project.googleAds || []).length > 0
  const hasEstrategia   = !!project.estrategia?.narrativa
  const hasEstrategiaV2 = !!(project.estrategiaV2?.problemas?.length || project.estrategiaV2?.swot?.forcas)
  const hasBancoMidia   = !!(project.brandKit?.logo || (project.brandKit?.cores || []).length > 0 || (project.brandFotos || []).length > 0 || (project.brandVideos || []).length > 0)
  const hasAnexos       = (project.attachments || []).length > 0
  const hasLandingPages = (project.landingPages || []).length > 0
  const hasResultados   = !!project.resultados?.modelo

  const campaignPreview = hasCampaignPlan
    ? `${fmtCurrency(project.campaignPlan.totalBudget)}/mês · ${project.campaignPlan.channels.length} canal${project.campaignPlan.channels.length !== 1 ? 'is' : ''} configurado${project.campaignPlan.channels.length !== 1 ? 's' : ''}`
    : 'Planejamento de campanhas ainda não configurado'

  // Preview snippets
  const roiPreview = hasROI
    ? `Investimento: ${fmtCurrency(project.roiResult.totalInvestimento)} · Faturamento alvo: ${fmtCurrency(project.roiResult.faturamento)}`
    : 'Calculadora de ROI ainda não preenchida'

  const icpPreview = hasPersonas
    ? `${project.personas.length} persona${project.personas.length > 1 ? 's' : ''} criada${project.personas.length > 1 ? 's' : ''}: ${project.personas.map((p) => p.name || 'Persona').join(', ')}`
    : 'Personas ainda não criadas'

  const ofertaPreview = hasOferta
    ? (project.ofertaData.nome ? `"${project.ofertaData.nome}"` : project.ofertaData.resultadoSonho?.slice(0, 80))
    : 'Oferta Matadora ainda não preenchida'

  return (
    <div className="space-y-0">

      {/* ── Profile Header ──────────────────────────────────────────────── */}
      <div className="glass-card overflow-hidden border border-rl-green/20">

        {/* Cover banner */}
        <div className="relative h-32 bg-gradient-to-br from-rl-purple/20 via-rl-blue/10 to-rl-cyan/5">
          {/* subtle grid pattern */}
          <div className="absolute inset-0 opacity-[0.12]"
            style={{ backgroundImage: 'radial-gradient(circle, #164496 1px, transparent 1px)', backgroundSize: '24px 24px' }}
          />
          {/* Completed badge */}
          <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-rl-green/20 border border-rl-green/30 px-3 py-1.5 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5 text-rl-green" />
            <span className="text-xs font-semibold text-rl-green">Onboarding Completo</span>
          </div>
        </div>

        {/* Avatar / Logo */}
        <div className="relative px-6 pb-6">
          <div className="absolute -top-12 left-6">
            <div className="relative group">
              <div className="w-24 h-24 rounded-2xl border-4 border-rl-bg bg-rl-surface overflow-hidden flex items-center justify-center shadow-xl">
                {project.logoBase64
                  ? <img src={project.logoBase64} alt="Logo" className="w-full h-full object-cover" />
                  : <span className="text-2xl font-black text-rl-purple">{companyInitials}</span>
                }
              </div>
              {/* Camera overlay */}
              <button
                onClick={() => logoInputRef.current?.click()}
                className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                title="Alterar logo"
              >
                <Camera className="w-6 h-6 text-white" />
              </button>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </div>
          </div>

          {/* Info — offset for avatar */}
          <div className="pt-14">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl font-black text-rl-text">{project.companyName}</h1>
                <p className="text-sm text-rl-muted mt-0.5">
                  {BUSINESS_LABELS[project.businessType] || project.businessType}
                  {project.responsibleName && ` · ${project.responsibleName}`}
                  {project.responsibleRole && ` · ${project.responsibleRole}`}
                </p>
                {project.contractDate && (
                  <p className="text-xs text-rl-muted mt-1 flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5" />
                    Contrato: {new Date(project.contractDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </p>
                )}
                {/* Services chips */}
                {project.services?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {project.services.map((s) => (
                      <span key={s} className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-rl-surface text-rl-muted border border-rl-border">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Stats + Actions (right column) */}
              <div className="flex flex-col items-end gap-3 shrink-0">
                {/* Stats chips */}
                <div className="flex flex-wrap gap-2 justify-end">
                  {hasROI && (
                    <div className="flex items-center gap-1.5 bg-rl-purple/10 border border-rl-purple/20 px-3 py-1.5 rounded-full">
                      <TrendingUp className="w-3.5 h-3.5 text-rl-purple" />
                      <span className="text-xs font-semibold text-rl-purple">{fmtCurrency(project.roiResult.totalInvestimento)}/mês</span>
                    </div>
                  )}
                  {hasPersonas && (
                    <div className="flex items-center gap-1.5 bg-rl-blue/10 border border-rl-blue/20 px-3 py-1.5 rounded-full">
                      <Users className="w-3.5 h-3.5 text-rl-blue" />
                      <span className="text-xs font-semibold text-rl-blue">{project.personas.length} persona{project.personas.length > 1 ? 's' : ''}</span>
                    </div>
                  )}
                  {hasOferta && project.ofertaData?.nome && (
                    <div className="flex items-center gap-1.5 bg-rl-gold/10 border border-rl-gold/20 px-3 py-1.5 rounded-full">
                      <Zap className="w-3.5 h-3.5 text-rl-gold" />
                      <span className="text-xs font-semibold text-rl-gold">{project.ofertaData.nome}</span>
                    </div>
                  )}
                </div>
                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setOpenModal('onboarding')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rl-border bg-rl-surface text-rl-muted hover:text-rl-text hover:border-rl-purple/40 transition-all text-xs font-medium"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    Ver Dados
                  </button>
                  <button
                    onClick={() => setOpenModal('onboarding-edit')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rl-border bg-rl-surface text-rl-muted hover:text-rl-text hover:border-rl-purple/40 transition-all text-xs font-medium"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Editar
                  </button>
                  <button
                    onClick={() => exportOnboardingPDF(project)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rl-purple/30 bg-rl-purple/10 text-rl-purple hover:bg-rl-purple/20 transition-all text-xs font-medium"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Exportar PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">

        {/* 1. ROI */}
        <SectionCard
          icon={BarChart3}
          iconColor="text-rl-purple"
          iconBg="bg-rl-purple/10"
          title="Calculadora de ROI"
          preview={roiPreview}
          badge={hasROI ? 'Preenchida' : null}
          badgeColor="text-rl-purple bg-rl-purple/10 border-rl-purple/20"
          onClick={() => setOpenModal('roi')}
        />

        {/* 3. ICP / Personas */}
        <SectionCard
          icon={Users}
          iconColor="text-rl-blue"
          iconBg="bg-rl-blue/10"
          title="Personas"
          preview={icpPreview}
          badge={hasPersonas ? `${project.personas.length} persona${project.personas.length > 1 ? 's' : ''}` : null}
          badgeColor="text-rl-blue bg-rl-blue/10 border-rl-blue/20"
          onClick={() => setOpenModal('icp')}
        />

        {/* 4. Produto / Serviço */}
        <SectionCard
          icon={Package}
          iconColor="text-rl-gold"
          iconBg="bg-rl-gold/10"
          title="Produto / Serviço"
          preview={
            hasProdutos
              ? `${project.produtos.length} produto${project.produtos.length !== 1 ? 's' : ''}: ${project.produtos.map((p) => p.nome || 'Sem nome').join(', ')}`
              : '17 perguntas para documentar o produto e embasar anúncios'
          }
          badge={hasProdutos ? `${project.produtos.length} produto${project.produtos.length !== 1 ? 's' : ''}` : null}
          badgeColor="text-rl-gold bg-rl-gold/10 border-rl-gold/20"
          onClick={() => setOpenModal('produtos')}
        />

        {/* 5. Oferta Matadora */}
        <SectionCard
          icon={Zap}
          iconColor="text-rl-gold"
          iconBg="bg-rl-gold/10"
          title="Oferta Matadora"
          preview={ofertaPreview}
          badge={hasOferta ? 'Criada' : null}
          badgeColor="text-rl-gold bg-rl-gold/10 border-rl-gold/20"
          onClick={() => setOpenModal('oferta')}
        />

        {/* 5. Planejamento de Campanhas */}
        <SectionCard
          icon={CalendarDays}
          iconColor="text-rl-green"
          iconBg="bg-rl-green/10"
          title="Planejamento de Campanhas"
          preview={campaignPreview}
          badge={hasCampaignPlan ? 'Configurado' : null}
          badgeColor="text-rl-green bg-rl-green/10 border-rl-green/20"
          onClick={() => setOpenModal('campaign')}
        />

        {/* 6. Anexos Importantes */}
        <SectionCard
          icon={Paperclip}
          iconColor="text-rl-gold"
          iconBg="bg-rl-gold/10"
          title="Anexos Importantes"
          preview={
            hasAnexos
              ? `${project.attachments.length} arquivo${project.attachments.length !== 1 ? 's' : ''} anexado${project.attachments.length !== 1 ? 's' : ''}`
              : 'Contratos, briefings, relatórios e documentos do cliente'
          }
          badge={hasAnexos ? `${project.attachments.length} arquivo${project.attachments.length !== 1 ? 's' : ''}` : null}
          badgeColor="text-rl-gold bg-rl-gold/10 border-rl-gold/20"
          onClick={() => setOpenModal('anexos')}
        />

        {/* 7. Criativos */}
        <SectionCard
          icon={Clapperboard}
          iconColor="text-rl-cyan"
          iconBg="bg-rl-cyan/10"
          title="Criativos com IA"
          preview="Gere anúncios estáticos e roteiros de vídeo com IA usando os dados do cliente"
          badge={null}
          badgeColor=""
          onClick={() => setOpenModal('criativos')}
        />

        {/* 8. Landing Page */}
        <SectionCard
          icon={LayoutTemplate}
          iconColor="text-rl-green"
          iconBg="bg-rl-green/10"
          title="Landing Page com IA"
          preview={
            hasLandingPages
              ? `${project.landingPages.length} copy${project.landingPages.length !== 1 ? 's' : ''} gerada${project.landingPages.length !== 1 ? 's' : ''} · 6 dobras persuasivas`
              : 'Gere copy completa com 6 dobras persuasivas usando os dados do cliente'
          }
          badge={hasLandingPages ? `${project.landingPages.length} copy${project.landingPages.length !== 1 ? 's' : ''}` : null}
          badgeColor="text-rl-green bg-rl-green/10 border-rl-green/20"
          onClick={() => setOpenModal('landingpage')}
        />

        {/* 9. Resultados */}
        <SectionCard
          icon={Activity}
          iconColor="text-rl-purple"
          iconBg="bg-rl-purple/10"
          title="Resultados"
          preview={
            hasResultados
              ? project.resultados.modelo === 'b2b'
                ? 'B2B · Acompanhamento semanal — Funil Leads → MQL → SQL → Vendas'
                : 'B2C · Acompanhamento diário — Investido, Leads, Vendas e ROAS'
              : 'Acompanhe resultados diários ou semanais e consolide o mês'
          }
          badge={hasResultados ? (project.resultados.modelo === 'b2b' ? '🏢 B2B' : '🛒 B2C') : null}
          badgeColor="text-rl-purple bg-rl-purple/10 border-rl-purple/20"
          onClick={() => setOpenModal('resultados')}
        />

        {/* 10. Laboratório Meta Ads */}
        <SectionCard
          icon={FlaskConical}
          iconColor="text-rl-purple"
          iconBg="bg-rl-purple/10"
          title="Laboratório Meta Ads"
          preview="Plano de 21 dias para testar criativos, públicos e ganchos com base no orçamento disponível"
          badge={project.metaLabBudget ? 'Configurado' : null}
          badgeColor="text-rl-purple bg-rl-purple/10 border-rl-purple/20"
          onClick={() => setOpenModal('metalab')}
        />

        {/* 11. Google Ads */}
        <SectionCard
          icon={Search}
          iconColor="text-rl-cyan"
          iconBg="bg-rl-cyan/10"
          title="Google Ads com IA"
          preview={
            hasGoogleAds
              ? `${project.googleAds.length} estrutura${project.googleAds.length !== 1 ? 's' : ''} gerada${project.googleAds.length !== 1 ? 's' : ''} · RSA, grupos e palavras-chave`
              : 'Gere estrutura completa de campanhas com grupos, RSAs e palavras-chave segmentadas'
          }
          badge={hasGoogleAds ? `${project.googleAds.length} estrutura${project.googleAds.length !== 1 ? 's' : ''}` : null}
          badgeColor="text-rl-cyan bg-rl-cyan/10 border-rl-cyan/20"
          onClick={() => setOpenModal('googleads')}
        />

        {/* 12. Banco de Imagens e Vídeos */}
        <SectionCard
          icon={ImagePlay}
          iconColor="text-rl-blue"
          iconBg="bg-rl-blue/10"
          title="Banco de Imagens e Vídeos"
          preview={
            hasBancoMidia
              ? [
                  (project.brandKit?.cores || []).length > 0 && `${project.brandKit.cores.length} cor${project.brandKit.cores.length !== 1 ? 'es' : ''}`,
                  (project.brandFotos || []).length > 0 && `${project.brandFotos.length} foto${project.brandFotos.length !== 1 ? 's' : ''}`,
                  (project.brandVideos || []).length > 0 && `${project.brandVideos.length} vídeo${project.brandVideos.length !== 1 ? 's' : ''}`,
                ].filter(Boolean).join(' · ')
              : 'Logo, paleta de cores, fontes, fotos e vídeos da marca'
          }
          badge={hasBancoMidia ? 'Preenchido' : null}
          badgeColor="text-rl-blue bg-rl-blue/10 border-rl-blue/20"
          onClick={() => setOpenModal('bancomídia')}
        />

        {/* 13. Estratégia Digital */}
        <SectionCard
          icon={Layers}
          iconColor="text-rl-purple"
          iconBg="bg-rl-purple/10"
          title="Estratégia Digital"
          preview={
            hasEstrategia
              ? 'Estratégia gerada · Diagnóstico, objetivos, mídia e próximos passos'
              : 'Síntese premium de todos os módulos para apresentar ao cliente'
          }
          badge={hasEstrategia ? 'Gerada' : null}
          badgeColor="text-rl-purple bg-rl-purple/10 border-rl-purple/20"
          onClick={() => setOpenModal('estrategia')}
        />

        {/* 14. Estratégia V2 */}
        <SectionCard
          icon={Map}
          iconColor="text-rl-blue"
          iconBg="bg-rl-blue/10"
          title="Análise Competitiva"
          preview={hasEstrategiaV2 ? 'SWOT · Benchmark · Riscos · Funis' : 'Preencha problemas, SWOT, benchmark e funis'}
          badge={hasEstrategiaV2 ? 'Preenchida' : null}
          badgeColor="text-rl-blue bg-rl-blue/10 border-rl-blue/20"
          onClick={() => setOpenModal('estrategiav2')}
        />
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}

      {openModal === 'onboarding' && (
        <Modal title="Dados do Cliente" icon={ClipboardList} iconColor="text-rl-cyan" onClose={() => setOpenModal(null)}>
          <OnboardingContent project={project} onSave={handleSaveOnboarding} />
        </Modal>
      )}

      {openModal === 'onboarding-edit' && (
        <Modal title="Editar Dados do Cliente" icon={Pencil} iconColor="text-rl-cyan" onClose={() => setOpenModal(null)}>
          <OnboardingEditForm
            project={project}
            onSave={(data) => { handleSaveOnboarding(data); setOpenModal(null) }}
            onCancel={() => setOpenModal(null)}
          />
        </Modal>
      )}

      {openModal === 'roi' && (
        <Modal title="Calculadora de ROI" icon={BarChart3} iconColor="text-rl-purple" onClose={() => setOpenModal(null)}>
          <ROICalculator project={project} onSave={handleSaveROI} />
        </Modal>
      )}

      {openModal === 'icp' && (
        <Modal title="Personas" icon={Users} iconColor="text-rl-blue" onClose={() => setOpenModal(null)}>
          <PersonaCreator project={project} onSave={handleSavePersonas} />
        </Modal>
      )}

      {openModal === 'produtos' && (
        <Modal title="Produto / Serviço" icon={Package} iconColor="text-rl-gold" onClose={() => setOpenModal(null)}>
          <ProdutoServicoModule project={project} onSave={handleSaveProdutos} />
        </Modal>
      )}

      {openModal === 'oferta' && (
        <Modal title="Oferta Matadora" icon={Zap} iconColor="text-rl-gold" onClose={() => setOpenModal(null)}>
          <OfertaMatadora project={project} onSave={handleSaveOferta} />
        </Modal>
      )}

      {openModal === 'campaign' && (
        <Modal title="Planejamento de Campanhas" icon={CalendarDays} iconColor="text-rl-green" onClose={() => setOpenModal(null)}>
          <CampaignPlanner project={project} onSave={handleSaveCampaign} />
        </Modal>
      )}

      {openModal === 'anexos' && (
        <Modal title="Anexos Importantes" icon={Paperclip} iconColor="text-rl-gold" onClose={() => setOpenModal(null)}>
          <AnexosModule project={project} />
        </Modal>
      )}

      {openModal === 'criativos' && (
        <Modal title="Criativos com IA" icon={Clapperboard} iconColor="text-rl-cyan" onClose={() => setOpenModal(null)}>
          <CriativosModule project={project} />
        </Modal>
      )}

      {openModal === 'landingpage' && (
        <Modal title="Landing Page com IA" icon={LayoutTemplate} iconColor="text-rl-green" onClose={() => setOpenModal(null)}>
          <LandingPageModule project={project} />
        </Modal>
      )}

      {openModal === 'resultados' && (
        <Modal title="Resultados" icon={Activity} iconColor="text-rl-purple" onClose={() => setOpenModal(null)}>
          <ResultadosModule project={project} />
        </Modal>
      )}

      {openModal === 'metalab' && (
        <Modal title="Laboratório Meta Ads" icon={FlaskConical} iconColor="text-rl-purple" onClose={() => setOpenModal(null)}>
          <MetaLabModule project={project} />
        </Modal>
      )}

      {openModal === 'googleads' && (
        <Modal title="Google Ads com IA" icon={Search} iconColor="text-rl-cyan" onClose={() => setOpenModal(null)}>
          <GoogleAdsModule project={project} />
        </Modal>
      )}

      {openModal === 'bancomídia' && (
        <Modal title="Banco de Imagens e Vídeos" icon={ImagePlay} iconColor="text-rl-blue" onClose={() => setOpenModal(null)}>
          <BancoMidiaModule project={project} />
        </Modal>
      )}

      {openModal === 'estrategia' && (
        <Modal title="Estratégia Digital" icon={Layers} iconColor="text-rl-purple" onClose={() => setOpenModal(null)}>
          <EstrategiaModule project={project} onSave={handleSaveEstrategia} />
        </Modal>
      )}

      {openModal === 'estrategiav2' && (
        <Modal title="Análise Competitiva" icon={Map} iconColor="text-rl-blue" onClose={() => setOpenModal(null)}>
          <EstrategiaV2Module project={project} onSave={handleSaveEstrategiaV2} />
        </Modal>
      )}
    </div>
  )
}
