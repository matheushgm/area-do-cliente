import { useState, useRef, useEffect } from 'react'
import { supabase, getSignedUrl, deleteFile } from '../../lib/supabase'
import { CheckCircle2, X, Plus, FileText } from 'lucide-react'
import { SERVICES_CONFIG } from '../../pages/NewOnboarding'

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

export default function OnboardingEditForm({ project, onSave, onCancel }) {
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
