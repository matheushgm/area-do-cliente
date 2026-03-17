import { useState, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { supabase, getSignedUrl, deleteFile } from '../lib/supabase'
import {
  Camera, X, CheckCircle2, ClipboardList, BarChart3,
  Users, Zap, CalendarDays, Building2,
  FileText, Globe, Phone, TrendingUp, Star, FileDown,
  Paperclip, Clapperboard, LayoutTemplate, Activity, FlaskConical, Search, Layers, ImagePlay, Map, Package,
  Pencil, Plus, Link2, PanelLeftClose, PanelLeftOpen,
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
  const { updateProject, projects } = useApp()
  const logoInputRef = useRef(null)

  const project = projects.find((p) => p.id === projectProp.id) || projectProp

  const [activeSection, setActiveSection] = useState('dados')
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [logoSignedUrl, setLogoSignedUrl] = useState(null)

  useEffect(() => {
    if (!project.logoUrl) { setLogoSignedUrl(null); return }
    getSignedUrl('brand-logos', project.logoUrl).then(setLogoSignedUrl)
  }, [project.logoUrl])

  async function handleLogoUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const path = `${project.id}/logo`
    const { error } = await supabase.storage.from('brand-logos').upload(path, file, { upsert: true })
    if (error) { console.error('[Logo] upload:', error.message); return }
    updateProject(project.id, { logoUrl: path })
  }

  function handleSaveOnboarding(data) { updateProject(project.id, data) }
  function handleSaveROI(calc, result) { updateProject(project.id, { roiCalc: calc, roiResult: result }) }
  function handleSavePersonas(personas) { updateProject(project.id, { personas }); setActiveSection('produtos') }
  function handleSaveProdutos(produtos) { updateProject(project.id, { produtos }) }
  function handleSaveOferta(ofertaData) { updateProject(project.id, { ofertaData }) }
  function handleSaveCampaign(plan) { updateProject(project.id, { campaignPlan: plan }) }
  function handleSaveEstrategia(estrategiaData) { updateProject(project.id, { estrategia: estrategiaData }) }
  function handleSaveEstrategiaV2(data) { updateProject(project.id, { estrategiaV2: data }) }

  function handleSaveLinks(links) {
    updateProject(project.id, { links })
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
      case 'produtos':     return <ProdutoServicoModule project={project} onSave={handleSaveProdutos} />
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
      <div className="glass-card overflow-hidden border border-rl-green/20">
        <div className="relative h-32 bg-gradient-to-br from-rl-purple/20 via-rl-blue/10 to-rl-cyan/5">
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
                {project.contractDate && (
                  <p className="text-xs text-rl-muted mt-1 flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5" />
                    Contrato: {new Date(project.contractDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </p>
                )}
                {project.services?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {project.services.map((s) => (
                      <span key={s} className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-rl-surface text-rl-muted border border-rl-border">{s}</span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end gap-3 shrink-0">
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
    </div>
  )
}
