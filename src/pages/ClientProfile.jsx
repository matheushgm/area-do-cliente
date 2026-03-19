import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../context/AppContext'
import { supabase, getSignedUrl, deleteFile } from '../lib/supabase'
import {
  Camera, X, CheckCircle2, ClipboardList, BarChart3,
  Users, Zap, CalendarDays, Building2,
  FileText, Globe, Phone, TrendingUp, Star, FileDown,
  Paperclip, Clapperboard, LayoutTemplate, Activity, FlaskConical, Search, Layers, ImagePlay, Map, Package,
  Pencil, Plus, Link2, PanelLeftClose, PanelLeftOpen, ChevronDown, Users2,
  LayoutDashboard, Check, Instagram, HardDrive,
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
import LinksModule from '../components/LinksModule'
import { SERVICES_CONFIG } from './NewOnboarding'
import { exportOnboardingPDF, exportClientProfilePDF, exportProdutoServicoPDF } from '../utils/exportPDF'

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

// ─── Squads ────────────────────────────────────────────────────────────────────

const SQUAD_COLORS = [
  { bg: 'bg-rl-gold/10',   border: 'border-rl-gold/30',   text: 'text-rl-gold'   },
  { bg: 'bg-rl-cyan/10',   border: 'border-rl-cyan/30',   text: 'text-rl-cyan'   },
  { bg: 'bg-rl-purple/10', border: 'border-rl-purple/30', text: 'text-rl-purple' },
  { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400' },
]

// ─── Service detail labels (for display in OnboardingContent) ─────────────────

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

  // ── File state ──────────────────────────────────────────────────────────────
  const raioXInputRef = useRef(null)
  const slaInputRef   = useRef(null)
  const [raioXNewFile,   setRaioXNewFile]   = useState(null)   // File para upload
  const [slaNewFile,     setSlaNewFile]     = useState(null)
  const [raioXRemoved,   setRaioXRemoved]   = useState(false)  // remover existente
  const [slaRemoved,     setSlaRemoved]     = useState(false)
  const [savingFiles,    setSavingFiles]    = useState(false)
  const [signedUrls,     setSignedUrls]     = useState({ raioX: null, sla: null })

  useEffect(() => {
    async function loadUrls() {
      const [raioX, sla] = await Promise.all([
        project.raioXFileName ? getSignedUrl('project-docs', project.raioXFileName) : null,
        project.slaFileName   ? getSignedUrl('project-docs', project.slaFileName)   : null,
      ])
      setSignedUrls({ raioX, sla })
    }
    if (project.raioXFileName || project.slaFileName) loadUrls()
  }, [project.raioXFileName, project.slaFileName])

  const currentRaioX = raioXRemoved ? null : (raioXNewFile ? raioXNewFile.name : project.raioXFileName?.split('/').pop())
  const currentSla   = slaRemoved   ? null : (slaNewFile   ? slaNewFile.name   : project.slaFileName?.split('/').pop())

  function toggleService(id) {
    set('services', form.services.includes(id)
      ? form.services.filter((s) => s !== id)
      : [...form.services, id]
    )
  }

  async function handleSave() {
    setSavingFiles(true)
    const serviceLabels = form.services.map((id) => SERVICES_CONFIG.find((s) => s.id === id)?.label || id)

    async function uploadDoc(file, prefix) {
      if (!file || !supabase) return null
      const ext  = file.name.split('.').pop()
      const path = `${project.id}/${prefix}.${ext}`
      const { error } = await supabase.storage.from('project-docs').upload(path, file, { upsert: true })
      if (error) { console.error('[Storage] upload:', error.message); return null }
      return path
    }

    // Raio-X
    let raioXPath = project.raioXFileName ?? null
    if (raioXRemoved) {
      if (project.raioXFileName) await deleteFile('project-docs', project.raioXFileName)
      raioXPath = null
    } else if (raioXNewFile) {
      if (project.raioXFileName) await deleteFile('project-docs', project.raioXFileName)
      raioXPath = await uploadDoc(raioXNewFile, 'raio-x')
    }

    // SLA
    let slaPath = project.slaFileName ?? null
    if (slaRemoved) {
      if (project.slaFileName) await deleteFile('project-docs', project.slaFileName)
      slaPath = null
    } else if (slaNewFile) {
      if (project.slaFileName) await deleteFile('project-docs', project.slaFileName)
      slaPath = await uploadDoc(slaNewFile, 'sla')
    }

    setSavingFiles(false)
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
      raio_x_file_url:     raioXPath,
      sla_file_url:        slaPath,
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

      {/* 📁 Documentos */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider">📁 Documentos</p>

        {/* Raio-X */}
        <div className="flex items-center gap-3 bg-rl-surface border border-rl-border rounded-xl px-4 py-3">
          <FileText className="w-4 h-4 text-rl-purple shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-rl-muted">Raio-X do Cliente</p>
            <p className={`text-xs truncate ${currentRaioX ? 'text-rl-text' : 'text-rl-muted italic'}`}>
              {currentRaioX || 'Nenhum arquivo'}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {signedUrls.raioX && !raioXRemoved && !raioXNewFile && (
              <a href={signedUrls.raioX} target="_blank" rel="noopener noreferrer"
                className="text-[11px] font-medium text-rl-purple hover:underline">
                Abrir
              </a>
            )}
            <button
              type="button"
              onClick={() => raioXInputRef.current?.click()}
              className="text-[11px] font-medium text-rl-purple hover:text-rl-purple/80 transition-colors"
            >
              {currentRaioX ? 'Alterar' : 'Anexar'}
            </button>
            {currentRaioX && (
              <button
                type="button"
                onClick={() => { setRaioXRemoved(true); setRaioXNewFile(null) }}
                className="text-[11px] font-medium text-red-400 hover:text-red-300 transition-colors"
              >
                Remover
              </button>
            )}
          </div>
          <input
            ref={raioXInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(e) => { const f = e.target.files[0]; if (f) { setRaioXNewFile(f); setRaioXRemoved(false) } }}
          />
        </div>

        {/* SLA */}
        <div className="flex items-center gap-3 bg-rl-surface border border-rl-border rounded-xl px-4 py-3">
          <FileText className="w-4 h-4 text-rl-cyan shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-rl-muted">SLA — Passagem de Bastão</p>
            <p className={`text-xs truncate ${currentSla ? 'text-rl-text' : 'text-rl-muted italic'}`}>
              {currentSla || 'Nenhum arquivo'}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {signedUrls.sla && !slaRemoved && !slaNewFile && (
              <a href={signedUrls.sla} target="_blank" rel="noopener noreferrer"
                className="text-[11px] font-medium text-rl-cyan hover:underline">
                Abrir
              </a>
            )}
            <button
              type="button"
              onClick={() => slaInputRef.current?.click()}
              className="text-[11px] font-medium text-rl-cyan hover:text-rl-cyan/80 transition-colors"
            >
              {currentSla ? 'Alterar' : 'Anexar'}
            </button>
            {currentSla && (
              <button
                type="button"
                onClick={() => { setSlaRemoved(true); setSlaNewFile(null) }}
                className="text-[11px] font-medium text-red-400 hover:text-red-300 transition-colors"
              >
                Remover
              </button>
            )}
          </div>
          <input
            ref={slaInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(e) => { const f = e.target.files[0]; if (f) { setSlaNewFile(f); setSlaRemoved(false) } }}
          />
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="flex justify-end gap-3 pt-4 border-t border-rl-border">
        <button onClick={onCancel} className="btn-ghost text-sm" disabled={savingFiles}>Cancelar</button>
        <button onClick={handleSave} className="btn-primary flex items-center gap-2" disabled={savingFiles}>
          <CheckCircle2 className="w-4 h-4" />
          {savingFiles ? 'Salvando...' : 'Salvar Alterações'}
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

          {/* Service chips */}
          <div className="flex flex-wrap gap-2 mb-4">
            {project.services.map((s) => (
              <span key={s} className="px-3 py-1.5 rounded-full text-xs font-medium bg-rl-purple/10 text-rl-purple border border-rl-purple/20">
                {s}
              </span>
            ))}
          </div>

          {/* Deliverable cards — per service with sub-fields */}
          {(() => {
            const DELIVERABLE_META = {
              imagemQty:    { label: 'Imagens',   icon: '📸', color: 'text-rl-gold   bg-rl-gold/10   border-rl-gold/20' },
              videoQty:     { label: 'Vídeos',    icon: '🎬', color: 'text-rl-purple bg-rl-purple/10 border-rl-purple/20' },
              estaticosQty: { label: 'Estáticos', icon: '🖼️', color: 'text-rl-blue  bg-rl-blue/10   border-rl-blue/20' },
              qty:          { label: 'Páginas',   icon: '📄', color: 'text-rl-cyan  bg-rl-cyan/10   border-rl-cyan/20' },
              nivel:        { label: 'Nível',     icon: '⭐', color: 'text-rl-gold   bg-rl-gold/10   border-rl-gold/20' },
            }

            const serviceRows = Object.entries(project.servicesData || {}).reduce((acc, [svcId, data]) => {
              if (!data) return acc
              const svcConfig = SERVICES_CONFIG.find((s) => s.id === svcId)
              if (!svcConfig?.sub) return acc
              const items = svcConfig.sub
                .map(({ key }) => ({ key, value: data[key] }))
                .filter(({ value }) => value !== '' && value != null && value !== '0' && value !== 0)
              if (items.length) acc.push({ svcConfig, items })
              return acc
            }, [])

            if (!serviceRows.length) return null

            return (
              <div className="mt-1 space-y-3">
                <p className="text-[10px] font-semibold text-rl-muted uppercase tracking-wider">📦 Entregáveis por Serviço</p>
                {serviceRows.map(({ svcConfig, items }) => (
                  <div key={svcConfig.id} className="rounded-xl border border-rl-border bg-rl-surface/50 px-3 py-3">
                    <p className="text-xs font-semibold text-rl-text mb-2">
                      {svcConfig.emoji} {svcConfig.label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {items.map(({ key, value }) => {
                        const meta = DELIVERABLE_META[key]
                        if (!meta) return null
                        const isText = isNaN(Number(value))
                        return (
                          <div
                            key={key}
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${meta.color}`}
                          >
                            <span className="text-base leading-none">{meta.icon}</span>
                            <div className="leading-tight">
                              {isText ? (
                                <p className="text-xs font-bold">{value}</p>
                              ) : (
                                <p className="text-xl font-extrabold leading-none">{value}</p>
                              )}
                              <p className="text-[10px] opacity-60">{meta.label}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ClientProfile({ project: projectProp }) {
  const { updateProject, projects, squads, teamMembers } = useApp()
  const logoInputRef = useRef(null)

  const project = projects.find((p) => p.id === projectProp.id) || projectProp

  const [activeSection, setActiveSection] = useState('dados')
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [logoSignedUrl, setLogoSignedUrl] = useState(null)
  const [squadOpen, setSquadOpen] = useState(false)
  const squadRef = useRef(null)
  const [linkStep,         setLinkStep]         = useState('idle') // 'idle' | 'dropdown' | 'input'
  const [linkPickedType,   setLinkPickedType]   = useState(null)
  const [linkInput,        setLinkInput]        = useState('')
  const [linkLabel,        setLinkLabel]        = useState('')
  const linkRef = useRef(null)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const overflowRef = useRef(null)
  const [squadTooltipPos, setSquadTooltipPos] = useState(null)
  const squadBadgeRef = useRef(null)
  const [toast, setToast] = useState({ show: false, message: '' })
  const toastTimer = useRef(null)

  function showToast(message = 'Salvo com sucesso!') {
    clearTimeout(toastTimer.current)
    setToast({ show: true, message })
    toastTimer.current = setTimeout(() => setToast({ show: false, message: '' }), 2800)
  }

  useEffect(() => {
    if (!project.logoUrl) { setLogoSignedUrl(null); return }
    getSignedUrl('brand-logos', project.logoUrl).then(setLogoSignedUrl)
  }, [project.logoUrl])

  useEffect(() => {
    if (!squadOpen) return
    function handleClickOutside(e) {
      if (squadRef.current && !squadRef.current.contains(e.target)) setSquadOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [squadOpen])

  useEffect(() => {
    if (linkStep === 'idle') return
    function handleClickOutside(e) {
      if (linkRef.current && !linkRef.current.contains(e.target)) {
        setLinkStep('idle'); setLinkPickedType(null); setLinkInput(''); setLinkLabel('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [linkStep])

  useEffect(() => {
    if (!overflowOpen) return
    function handleClickOutside(e) {
      if (overflowRef.current && !overflowRef.current.contains(e.target)) setOverflowOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [overflowOpen])

  async function handleLogoUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const path = `${project.id}/logo`
    const { error } = await supabase.storage.from('brand-logos').upload(path, file, { upsert: true })
    if (error) { console.error('[Logo] upload:', error.message); return }
    updateProject(project.id, { logoUrl: path })
  }

  function handleSaveOnboarding(data) { updateProject(project.id, data); showToast('Dados do cliente salvos!') }
  function handleSaveROI(calc, result) { updateProject(project.id, { roiCalc: calc, roiResult: result }); showToast('ROI salvo!') }
  function handleSavePersonas(personas) { updateProject(project.id, { personas }); setActiveSection('produtos'); showToast('Personas salvas!') }
  function handleSaveProdutos(produtos) { updateProject(project.id, { produtos }); showToast('Produtos salvos!') }
  function handleSaveOferta(ofertaData) { updateProject(project.id, { ofertaData }); showToast('Oferta salva!') }
  function handleSaveCampaign(plan) { updateProject(project.id, { campaignPlan: plan }); showToast('Planejamento salvo!') }
  function handleSaveEstrategia(estrategiaData) { updateProject(project.id, { estrategia: estrategiaData }); showToast('Estratégia salva!') }
  function handleSaveEstrategiaV2(data) { updateProject(project.id, { estrategiaV2: data }); showToast('Análise salva!') }
  function handleSaveLinks(links) { updateProject(project.id, { links }); showToast('Links salvos!') }


  function resetLinkState() {
    setLinkStep('idle'); setLinkPickedType(null); setLinkInput(''); setLinkLabel('')
  }

  function handleSaveLink() {
    const raw = linkInput.trim()
    if (!raw) return
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    if (linkPickedType === 'dashboard') {
      updateProject(project.id, { dashboardUrl: url })
    } else if (linkPickedType === 'outro') {
      updateProject(project.id, { links: { ...lnk, outros: [...(lnk.outros || []), { label: linkLabel || 'Link', url }] } })
    } else {
      updateProject(project.id, { links: { ...lnk, [linkPickedType]: url } })
    }
    resetLinkState()
  }

  const companyInitials = initials(project.companyName)
  const hasROI          = !!project.roiResult
  const hasPersonas     = project.personas?.length > 0
  const hasOferta       = !!(project.ofertaData?.nome || project.ofertaData?.resultadoSonho)
  const hasCampaignPlan = !!(project.campaignPlan?.totalBudget > 0 && project.campaignPlan?.channels?.length > 0)
  const hasProdutos     = (project.produtos || []).length > 0 && !!(project.produtos[0]?.nome || project.produtos[0]?.answers?.q1)
  const hasGoogleAds    = (project.googleAds || []).length > 0
  const lnk             = project.links || {}
  const hasLinks        = !!(lnk.instagram || lnk.website || lnk.googleDrive || (lnk.outros || []).length > 0)
  const hasEstrategia   = !!project.estrategia?.narrativa
  const hasEstrategiaV2 = !!(project.estrategiaV2?.problemas?.length || project.estrategiaV2?.swot?.forcas)
  const hasBancoMidia   = !!(project.brandKit?.logo || (project.brandKit?.cores || []).length > 0 || (project.brandFotos || []).length > 0 || (project.brandVideos || []).length > 0)
  const hasAnexos       = (project.attachments || []).length > 0
  const hasLandingPages = (project.landingPages || []).length > 0
  const hasResultados   = !!project.resultados?.modelo

  const NAV_ITEMS = [
    { id: 'dados',        label: 'Dados do Cliente',        icon: ClipboardList,  color: 'text-rl-cyan',   filled: true },
    { id: 'roi',          label: 'Calculadora de ROI',       icon: BarChart3,      color: 'text-rl-purple', filled: hasROI },
    { id: 'icp',          label: 'Personas',                 icon: Users,          color: 'text-rl-blue',   filled: hasPersonas },
    { id: 'produtos',     label: 'Produto / Serviço',        icon: Package,        color: 'text-rl-gold',   filled: hasProdutos },
    { id: 'oferta',       label: 'Oferta Matadora',          icon: Zap,            color: 'text-rl-gold',   filled: hasOferta },
    { id: 'campaign',     label: 'Campanhas',                icon: CalendarDays,   color: 'text-rl-green',  filled: hasCampaignPlan },
    { id: 'anexos',       label: 'Anexos',                   icon: Paperclip,      color: 'text-rl-gold',   filled: hasAnexos },
    { id: 'criativos',    label: 'Criativos com IA',         icon: Clapperboard,   color: 'text-rl-cyan',   filled: false },
    { id: 'landingpage',  label: 'Landing Page com IA',      icon: LayoutTemplate, color: 'text-rl-green',  filled: hasLandingPages },
    { id: 'resultados',   label: 'Resultados',               icon: Activity,       color: 'text-rl-purple', filled: hasResultados },
    { id: 'metalab',      label: 'Lab. Meta Ads',            icon: FlaskConical,   color: 'text-rl-purple', filled: !!project.metaLabBudget },
    { id: 'googleads',    label: 'Google Ads com IA',        icon: Search,         color: 'text-rl-cyan',   filled: hasGoogleAds },
    { id: 'bancomídia',   label: 'Banco de Mídia',           icon: ImagePlay,      color: 'text-rl-blue',   filled: hasBancoMidia },
    { id: 'estrategia',   label: 'Estratégia Digital',       icon: Layers,         color: 'text-rl-purple', filled: hasEstrategia },
    { id: 'estrategiav2', label: 'Análise Competitiva',      icon: Map,            color: 'text-rl-blue',   filled: hasEstrategiaV2 },
    { id: 'links',        label: 'Links Importantes',        icon: Link2,          color: 'text-rl-cyan',   filled: hasLinks },
  ]

  function renderContent() {
    switch (activeSection) {
      case 'dados':        return <OnboardingContent project={project} onSave={handleSaveOnboarding} />
      case 'roi':          return <ROICalculator project={project} onSave={handleSaveROI} />
      case 'icp':          return <PersonaCreator project={project} onSave={handleSavePersonas} />
      case 'produtos':     return (
        <div className="space-y-4">
          {hasProdutos && (
            <div className="flex justify-end">
              <button
                onClick={() => exportProdutoServicoPDF(project)}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <FileDown className="w-4 h-4" />
                Exportar PDF
              </button>
            </div>
          )}
          <ProdutoServicoModule project={project} onSave={handleSaveProdutos} />
        </div>
      )
      case 'oferta':       return <OfertaMatadora project={project} onSave={handleSaveOferta} />
      case 'campaign':     return <CampaignPlanner project={project} onSave={handleSaveCampaign} />
      case 'anexos':       return <AnexosModule project={project} />
      case 'criativos':    return <CriativosModule project={project} />
      case 'landingpage':  return <LandingPageModule project={project} />
      case 'resultados':   return <ResultadosModule project={project} />
      case 'metalab':      return <MetaLabModule project={project} />
      case 'googleads':    return <GoogleAdsModule project={project} />
      case 'bancomídia':   return <BancoMidiaModule project={project} />
      case 'estrategia':   return <EstrategiaModule project={project} onSave={handleSaveEstrategia} />
      case 'estrategiav2': return <EstrategiaV2Module project={project} onSave={handleSaveEstrategiaV2} />
      case 'links':        return <LinksModule project={project} onSave={handleSaveLinks} />
      default:             return null
    }
  }

  return (
    <div className="space-y-0">

      {/* ── Profile Header ──────────────────────────────────────────────── */}
      <div className="glass-card border border-rl-green/20">
        <div className="relative h-32 bg-gradient-to-br from-rl-purple/20 via-rl-blue/10 to-rl-cyan/5 overflow-hidden rounded-t-xl">
          <div className="absolute inset-0 opacity-[0.12]"
            style={{ backgroundImage: 'radial-gradient(circle, #164496 1px, transparent 1px)', backgroundSize: '24px 24px' }}
          />
          <div className="absolute top-4 left-4">
            <button
              onClick={() => setSidebarVisible((v) => !v)}
              title={sidebarVisible ? 'Ocultar sidebar' : 'Exibir sidebar'}
              className={`p-2 rounded-lg border transition-all duration-150 ${
                sidebarVisible
                  ? 'bg-rl-purple/20 border-rl-purple/40 text-rl-purple'
                  : 'bg-rl-surface/60 border-rl-border text-rl-muted hover:border-rl-purple/30 hover:text-rl-purple'
              }`}
            >
              {sidebarVisible ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>
          </div>
          <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-rl-green/20 border border-rl-green/30 px-3 py-1.5 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5 text-rl-green" />
            <span className="text-xs font-semibold text-rl-green">Onboarding Completo</span>
          </div>
        </div>

        <div className="relative px-6 pb-6">
          <div className="absolute -top-12 left-6">
            <div className="relative group">
              <div className="w-24 h-24 rounded-2xl border-4 border-rl-bg bg-rl-surface overflow-hidden flex items-center justify-center shadow-xl">
                {logoSignedUrl
                  ? <img src={logoSignedUrl} alt="Logo" className="w-full h-full object-cover" />
                  : <span className="text-2xl font-black text-rl-purple">{companyInitials}</span>
                }
              </div>
              <button
                onClick={() => logoInputRef.current?.click()}
                className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                title="Alterar logo"
              >
                <Camera className="w-6 h-6 text-white" />
              </button>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>
          </div>

          <div className="pt-14">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl font-black text-rl-text">{project.companyName}</h1>
                <p className="text-sm text-rl-muted mt-0.5">
                  {BUSINESS_LABELS[project.businessType] || project.businessType}
                  {project.responsibleName && ` · ${project.responsibleName}`}
                  {project.responsibleRole && ` · ${project.responsibleRole}`}
                </p>
                {(project.contractDate || project.contractModel || project.contractValue) && (
                  <p className="text-xs text-rl-muted mt-1 flex items-center gap-1.5 flex-wrap">
                    <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                    {project.contractDate && (
                      <span>{new Date(project.contractDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                    )}
                    {project.contractModel && (
                      <>
                        {project.contractDate && <span className="opacity-40">·</span>}
                        <span>{CONTRACT_MODEL_LABELS[project.contractModel] || project.contractModel}</span>
                      </>
                    )}
                    {project.contractValue && (
                      <>
                        <span className="opacity-40">·</span>
                        <span className="font-semibold text-rl-subtle">{fmtCurrency(project.contractValue)}{project.contractModel === 'assessoria' ? '/mês' : ''}</span>
                      </>
                    )}
                  </p>
                )}
                {/* ── Squad Assignment ──────────────────────────────────── */}
                {(() => {
                  const currentSquadIdx = squads.findIndex((s) => s.id === project.squad)
                  const currentSquad    = currentSquadIdx >= 0 ? squads[currentSquadIdx] : null
                  const currentColors   = currentSquad ? SQUAD_COLORS[currentSquadIdx % SQUAD_COLORS.length] : null

                  const resolveMembers = (sq) =>
                    (sq.members || []).map((m) => {
                      const profile = teamMembers.find((t) => t.id === m.profile_id)
                      return { name: profile?.name || m.profile_id, role: m.role }
                    })

                  return (
                    <div className="mt-3 relative inline-block" ref={squadRef}>
                      {currentSquad ? (
                        <div className="flex items-center gap-3">
                          {/* Squad badge — click to change, hover to preview members */}
                          <button
                            ref={squadBadgeRef}
                            onClick={() => setSquadOpen((v) => !v)}
                            onMouseEnter={() => {
                              if (!squadBadgeRef.current) return
                              const rect = squadBadgeRef.current.getBoundingClientRect()
                              setSquadTooltipPos({ x: rect.left, y: rect.top })
                            }}
                            onMouseLeave={() => setSquadTooltipPos(null)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-semibold text-xs transition-all shrink-0 ${currentColors.bg} ${currentColors.border} ${currentColors.text}`}
                          >
                            <Users2 className="w-3.5 h-3.5" />
                            {currentSquad.emoji} {currentSquad.name}
                            <ChevronDown className="w-3 h-3 opacity-60" />
                          </button>
                          {squadTooltipPos && resolveMembers(currentSquad).length > 0 && createPortal(
                            <div
                              style={{ position: 'fixed', left: squadTooltipPos.x, top: squadTooltipPos.y - 8, transform: 'translateY(-100%)' }}
                              className="z-[9999] pointer-events-none"
                            >
                              <div className="glass-card border border-rl-border shadow-xl py-2 px-3 rounded-xl min-w-[180px]">
                                <p className="text-[10px] font-semibold text-rl-muted uppercase tracking-wider mb-1.5">{currentSquad.name}</p>
                                {resolveMembers(currentSquad).map((m, i) => (
                                  <div key={i} className="flex items-center justify-between gap-4 py-0.5">
                                    <span className="text-xs text-rl-text whitespace-nowrap">{m.name}</span>
                                    <span className="text-[10px] text-rl-muted whitespace-nowrap">{m.role}</span>
                                  </div>
                                ))}
                              </div>
                            </div>,
                            document.body
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => setSquadOpen((v) => !v)}
                          className="flex items-center gap-1.5 text-xs text-rl-muted border border-dashed border-rl-border px-3 py-1.5 rounded-full hover:border-rl-purple/40 hover:text-rl-purple transition-all"
                        >
                          <Users2 className="w-3.5 h-3.5" />
                          Designar Squad
                        </button>
                      )}

                      {/* Dropdown */}
                      {squadOpen && (
                        <div className="absolute left-0 top-full mt-1.5 z-50 min-w-[220px] glass-card border border-rl-border shadow-2xl p-1.5 space-y-0.5">
                          {squads.length === 0 && (
                            <p className="px-3 py-2 text-xs text-rl-muted">Nenhum squad cadastrado.</p>
                          )}
                          {squads.map((sq, idx) => {
                            const colors = SQUAD_COLORS[idx % SQUAD_COLORS.length]
                            const members = resolveMembers(sq)
                            return (
                              <button
                                key={sq.id}
                                onClick={() => { updateProject(project.id, { squad: sq.id }); setSquadOpen(false) }}
                                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                                  project.squad === sq.id
                                    ? `${colors.bg} ${colors.text} border ${colors.border}`
                                    : 'hover:bg-rl-surface text-rl-text'
                                }`}
                              >
                                <span className="text-base">{sq.emoji || '👥'}</span>
                                <div>
                                  <p className="font-bold leading-tight">{sq.name}</p>
                                  {members.length > 0 && (
                                    <p className="text-[10px] opacity-60 leading-tight">{members.map((m) => m.name).join(' · ')}</p>
                                  )}
                                </div>
                                {project.squad === sq.id && <CheckCircle2 className="w-3.5 h-3.5 ml-auto shrink-0" />}
                              </button>
                            )
                          })}
                          {project.squad && (
                            <button
                              onClick={() => { updateProject(project.id, { squad: null }); setSquadOpen(false) }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-rl-muted hover:bg-rl-surface transition-all"
                            >
                              <X className="w-3.5 h-3.5" />
                              Remover Squad
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>

              <div className="flex flex-col items-end gap-3 shrink-0">

                {/* ── Links + Dashboard ── */}
                {(() => {
                  const MAX_VISIBLE = 3
                  const allLinks = [
                    project.dashboardUrl && {
                      key: 'dashboard', label: 'Dashboard', href: project.dashboardUrl,
                      Icon: LayoutDashboard, pill: 'bg-rl-cyan/10 border-rl-cyan/30 text-rl-cyan',
                      onRemove: () => updateProject(project.id, { dashboardUrl: null }),
                    },
                    lnk.instagram && {
                      key: 'instagram', label: 'Instagram', href: lnk.instagram.startsWith('http') ? lnk.instagram : `https://${lnk.instagram}`,
                      Icon: Instagram, pill: 'bg-pink-500/10 border-pink-500/30 text-pink-400',
                      onRemove: () => updateProject(project.id, { links: { ...lnk, instagram: '' } }),
                    },
                    lnk.website && {
                      key: 'website', label: 'Website', href: lnk.website.startsWith('http') ? lnk.website : `https://${lnk.website}`,
                      Icon: Globe, pill: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
                      onRemove: () => updateProject(project.id, { links: { ...lnk, website: '' } }),
                    },
                    lnk.googleDrive && {
                      key: 'googleDrive', label: 'Google Drive', href: lnk.googleDrive.startsWith('http') ? lnk.googleDrive : `https://${lnk.googleDrive}`,
                      Icon: HardDrive, pill: 'bg-green-500/10 border-green-500/30 text-green-400',
                      onRemove: () => updateProject(project.id, { links: { ...lnk, googleDrive: '' } }),
                    },
                    ...(lnk.outros || []).filter(o => o.url).map((outro, i) => ({
                      key: `outro-${i}`, label: outro.label || 'Link', href: outro.url.startsWith('http') ? outro.url : `https://${outro.url}`,
                      Icon: Link2, pill: 'bg-rl-purple/10 border-rl-purple/30 text-rl-purple',
                      onRemove: () => updateProject(project.id, { links: { ...lnk, outros: (lnk.outros || []).filter((_, idx) => idx !== i) } }),
                    })),
                  ].filter(Boolean)

                  const visible  = allLinks.slice(0, MAX_VISIBLE)
                  const overflow = allLinks.slice(MAX_VISIBLE)

                  return (
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {visible.map(({ key, label, href, Icon, pill, onRemove }) => (
                        <div key={key} className={`group relative flex items-center px-4 py-2 rounded-xl border text-sm font-semibold ${pill}`}>
                          <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:opacity-80 transition-opacity pr-4">
                            <Icon className="w-4 h-4" />{label}
                          </a>
                          <button onClick={onRemove} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 bg-white text-gray-500 opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all" title="Remover"><X className="w-4 h-4" /></button>
                        </div>
                      ))}

                      {/* Botão overflow "Mais N" */}
                      {overflow.length > 0 && (
                        <div className="relative" ref={overflowRef}>
                          <button
                            onClick={() => setOverflowOpen(o => !o)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rl-surface border border-rl-border text-rl-muted text-sm font-medium hover:border-rl-purple/40 hover:text-rl-purple transition-all"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />Mais {overflow.length}
                          </button>
                          {overflowOpen && (
                            <div className="absolute right-0 top-full mt-1 z-50 glass-card p-1 min-w-[180px] shadow-lg border border-rl-border">
                              {overflow.map(({ key, label, href, Icon, pill, onRemove }) => (
                                <div key={key} className="group relative flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-rl-surface transition-all">
                                  <a href={href} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 text-sm font-medium flex-1 min-w-0 hover:opacity-80 transition-opacity ${pill.split(' ').find(c => c.startsWith('text-'))}`}>
                                    <Icon className="w-4 h-4 shrink-0" />
                                    <span className="truncate">{label}</span>
                                  </a>
                                  <button onClick={() => { onRemove(); if (overflow.length === 1) setOverflowOpen(false) }} className="shrink-0 rounded p-0.5 text-rl-muted/50 hover:text-red-400 transition-colors" title="Remover"><X className="w-3.5 h-3.5" /></button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Botão + Link com dropdown e popover */}
                      <div className="relative" ref={linkRef}>
                        <button
                          onClick={() => setLinkStep(s => s === 'idle' ? 'dropdown' : 'idle')}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-rl-border text-rl-muted text-sm hover:border-rl-purple/40 hover:text-rl-purple transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />Link
                        </button>

                        {/* Dropdown de tipos */}
                        {linkStep === 'dropdown' && (
                          <div className="absolute right-0 top-full mt-1 z-50 glass-card p-1 min-w-[180px] shadow-lg border border-rl-border">
                            {[
                              { id: 'instagram',   label: 'Instagram',    Icon: Instagram,       color: 'text-pink-400',  hide: !!lnk.instagram        },
                              { id: 'website',     label: 'Website',      Icon: Globe,           color: 'text-blue-400',  hide: !!lnk.website          },
                              { id: 'googleDrive', label: 'Google Drive', Icon: HardDrive,       color: 'text-green-400', hide: !!lnk.googleDrive      },
                              { id: 'dashboard',   label: 'Dashboard',    Icon: LayoutDashboard, color: 'text-rl-cyan',   hide: !!project.dashboardUrl },
                              { id: 'outro',       label: 'Personalizado', Icon: Link2,          color: 'text-rl-purple', hide: false                  },
                            ].filter(o => !o.hide).map(({ id, label, Icon, color }) => (
                              <button
                                key={id}
                                onClick={() => { setLinkPickedType(id); setLinkInput(''); setLinkLabel(''); setLinkStep('input') }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-rl-text hover:bg-rl-surface transition-all"
                              >
                                <Icon className={`w-4 h-4 ${color} shrink-0`} />{label}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Popover de input */}
                        {linkStep === 'input' && (() => {
                          const opts = [
                            { id: 'instagram',   label: 'Instagram',    Icon: Instagram,       color: 'text-pink-400',  placeholder: 'https://instagram.com/...' },
                            { id: 'website',     label: 'Website',      Icon: Globe,           color: 'text-blue-400',  placeholder: 'https://www.empresa.com.br' },
                            { id: 'googleDrive', label: 'Google Drive', Icon: HardDrive,       color: 'text-green-400', placeholder: 'https://drive.google.com/...' },
                            { id: 'dashboard',   label: 'Dashboard',    Icon: LayoutDashboard, color: 'text-rl-cyan',   placeholder: 'https://lookerstudio.google.com/...' },
                            { id: 'outro',       label: 'Personalizado', Icon: Link2,          color: 'text-rl-purple', placeholder: 'https://...' },
                          ]
                          const opt = opts.find(o => o.id === linkPickedType) || opts[0]
                          return (
                            <div className="absolute right-0 top-full mt-2 z-50 glass-card p-4 shadow-glow w-96 space-y-3 border border-rl-border">
                              <p className={`text-sm font-semibold flex items-center gap-1.5 ${opt.color}`}>
                                <opt.Icon className="w-4 h-4" />{opt.label}
                              </p>
                              {linkPickedType === 'outro' && (
                                <input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Nome da plataforma..." className="input-field w-full" />
                              )}
                              <div className="flex gap-2 items-center">
                                <input
                                  autoFocus
                                  value={linkInput}
                                  onChange={(e) => setLinkInput(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveLink(); if (e.key === 'Escape') resetLinkState() }}
                                  placeholder={opt.placeholder}
                                  className="input-field flex-1"
                                />
                                <button onClick={handleSaveLink} className="w-9 h-9 flex items-center justify-center rounded-lg bg-rl-green/10 border border-rl-green/30 text-rl-green hover:bg-rl-green/20 transition-all"><Check className="w-4 h-4" /></button>
                                <button onClick={resetLinkState} className="w-9 h-9 flex items-center justify-center rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all"><X className="w-4 h-4" /></button>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Two-panel layout ─────────────────────────────────────────────── */}
      <div className="flex gap-4 pt-4 items-stretch">

        {/* Sidebar nav */}
        {sidebarVisible && <div className="w-64 shrink-0">
          <div className="glass-card p-2 sticky top-20">
            {NAV_ITEMS.map(({ id, label, icon: Icon, color, filled }) => {
              const isActive = activeSection === id
              return (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-rl-purple text-white shadow-sm'
                      : 'text-rl-subtle hover:bg-rl-bg hover:text-rl-text'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : color}`} />
                  <span className="truncate flex-1 text-left">{label}</span>
                  {filled && !isActive && (
                    <CheckCircle2 className="w-3 h-3 shrink-0 text-rl-green opacity-80" />
                  )}
                </button>
              )
            })}
          </div>
        </div>}

        {/* Content panel */}
        <div className="flex-1 min-w-0">
          <div className="glass-card p-6">
            {renderContent()}
          </div>
        </div>

      </div>

      {/* ── Toast notification ───────────────────────────────────────────── */}
      <div
        className={`fixed bottom-6 right-6 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl border transition-all duration-300 ${
          toast.show
            ? 'opacity-100 translate-y-0 bg-rl-card border-rl-green/30'
            : 'opacity-0 translate-y-3 pointer-events-none bg-rl-card border-rl-green/30'
        }`}
      >
        <CheckCircle2 className="w-4 h-4 text-rl-green shrink-0" />
        <span className="text-sm font-medium text-rl-text">{toast.message}</span>
      </div>
    </div>
  )
}
