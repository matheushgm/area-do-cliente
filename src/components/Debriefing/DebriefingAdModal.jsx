import { useMemo, useState } from 'react'
import { X, Check, Video, Image as ImageIcon, Layers, ExternalLink, AlertTriangle } from 'lucide-react'
import Modal from '../UI/Modal'
import { FUNNELS } from '../Kickoff/KickoffFunnelRecommendations'

// Tipos de anúncio com ícone + código curto (pro auto-suggest de nomenclatura)
export const TIPOS_ANUNCIO = [
  { id: 'video',     label: 'Vídeo',     code: 'VID', Icon: Video },
  { id: 'imagem',    label: 'Imagem',    code: 'IMG', Icon: ImageIcon },
  { id: 'carrossel', label: 'Carrossel', code: 'CAR', Icon: Layers },
]

const STAGE_CODE = { topo: 'TOPO', meio: 'MEIO', fundo: 'FUNDO' }
const STAGE_LABEL = { topo: 'Topo', meio: 'Meio', fundo: 'Fundo' }

// Flatten as campanhas do projeto.campaignPlan pra usar num select.
export function flattenCampaigns(campaignPlan) {
  const out = []
  for (const account of (campaignPlan?.accounts || [])) {
    for (const channel of (account.channels || [])) {
      for (const stageKey of ['topo', 'meio', 'fundo']) {
        for (const camp of (channel.stages?.[stageKey]?.campaigns || [])) {
          if (camp?.name?.trim()) {
            out.push({
              id:      camp.id,
              name:    camp.name.trim(),
              channel: channel.name || '',
              stage:   stageKey,
              stageLabel: STAGE_LABEL[stageKey] || stageKey,
              stageCode:  STAGE_CODE[stageKey]  || stageKey.toUpperCase(),
            })
          }
        }
      }
    }
  }
  return out
}

// Sugere nomenclatura padrão tipo MEIO_VID_AD002_DUDU_07.04
function suggestNome({ tipo, campanha, dateStr, num, responsavel = 'AD' }) {
  const stageCode = campanha?.stageCode || 'MEIO'
  const typeCode  = TIPOS_ANUNCIO.find((t) => t.id === tipo)?.code || 'AD'
  const adNum     = String(num || 1).padStart(3, '0')
  const d = dateStr ? new Date(dateStr) : new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${stageCode}_${typeCode}_AD${adNum}_${responsavel.toUpperCase()}_${dd}.${mm}`
}

const TODAY = () => new Date().toISOString().slice(0, 10) // yyyy-mm-dd

export default function DebriefingAdModal({
  initial,
  campaignPlan,
  existingAdsCount = 0,
  onSave,
  onClose,
}) {
  const campaigns = useMemo(() => flattenCampaigns(campaignPlan), [campaignPlan])

  const [values, setValues] = useState(() => ({
    createdAt:  TODAY(),
    url:        '',
    tipo:       'video',
    campanhaId: '',
    nome:       '',
    funilId:    '',
    observacao: '',
    ...(initial || {}),
  }))

  function set(field, val) {
    setValues((prev) => ({ ...prev, [field]: val }))
  }

  const selectedCampaign = campaigns.find((c) => c.id === values.campanhaId) || null
  const selectedFunil    = FUNNELS.find((f) => f.id === values.funilId) || null

  function autoSuggestNome() {
    const nome = suggestNome({
      tipo: values.tipo,
      campanha: selectedCampaign,
      dateStr: values.createdAt,
      num: (existingAdsCount + 1),
    })
    set('nome', nome)
  }

  const canSave = !!(values.url || '').trim() && !!(values.nome || '').trim() && !!values.tipo

  function handleSave() {
    if (!canSave) return
    const now = new Date().toISOString()
    onSave({
      ...values,
      id: initial?.id || crypto.randomUUID(),
      addedAt: initial?.addedAt || now,
      updatedAt: now,
    })
  }

  const isValidUrl = /^https?:\/\//i.test(values.url || '')

  return (
    <Modal onClose={onClose} maxWidth="2xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4 pb-4 border-b border-rl-border">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-rl-muted font-bold mb-1">
            {initial ? 'Editando anúncio' : 'Novo anúncio'}
          </p>
          <h3 className="text-lg font-black text-rl-text leading-tight">
            Cadastro de criativo
          </h3>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Form */}
      <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-4">
        {/* Data + Tipo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Data de criação" required>
            <input
              type="date"
              value={values.createdAt || ''}
              onChange={(e) => set('createdAt', e.target.value)}
              className="input-field w-full"
            />
          </Field>
          <Field label="Tipo de anúncio" required>
            <div className="grid grid-cols-3 gap-2">
              {TIPOS_ANUNCIO.map((t) => {
                const Icon = t.Icon
                const active = values.tipo === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => set('tipo', t.id)}
                    className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl border text-xs font-semibold transition-all ${
                      active
                        ? 'bg-rl-purple/10 border-rl-purple/50 text-rl-purple'
                        : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-text hover:border-rl-purple/30'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" /> {t.label}
                  </button>
                )
              })}
            </div>
          </Field>
        </div>

        {/* URL */}
        <Field label="Link do anúncio (Google Drive ou plataforma)" required>
          <div className="relative">
            <input
              type="text"
              value={values.url || ''}
              onChange={(e) => set('url', e.target.value)}
              placeholder="https://drive.google.com/file/..."
              className="input-field w-full pr-9"
            />
            {isValidUrl && (
              <a
                href={values.url}
                target="_blank"
                rel="noreferrer"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-rl-muted hover:text-rl-purple transition-all"
                title="Abrir em nova aba"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </Field>

        {/* Campanha */}
        <Field
          label="Campanha"
          hint={campaigns.length === 0
            ? 'Sem campanhas cadastradas. Adicione campanhas no módulo "Campanhas" pra vincular aqui.'
            : 'Selecione a campanha onde o anúncio vai rodar.'}
        >
          <select
            value={values.campanhaId || ''}
            onChange={(e) => set('campanhaId', e.target.value)}
            disabled={campaigns.length === 0}
            className="input-field w-full"
          >
            <option value="">— sem campanha vinculada —</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                [{c.stageLabel}] {c.name}{c.channel ? ` · ${c.channel}` : ''}
              </option>
            ))}
          </select>
        </Field>

        {/* Nome */}
        <Field
          label="Nome do anúncio"
          required
          hint="Padrão: POSIÇÃO_TIPO_AD###_RESPONSÁVEL_DD.MM. Ex: MEIO_VID_AD002_DUDU_07.04"
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={values.nome || ''}
              onChange={(e) => set('nome', e.target.value)}
              placeholder="MEIO_VID_AD001_DUDU_17.05"
              className="input-field flex-1 font-mono text-sm"
              maxLength={80}
            />
            <button
              type="button"
              onClick={autoSuggestNome}
              className="text-xs font-semibold px-3 py-2 rounded-xl bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-purple hover:border-rl-purple/30 transition-all whitespace-nowrap"
              title="Gerar sugestão automática"
            >
              Sugerir nome
            </button>
          </div>
        </Field>

        {/* Funil */}
        <Field
          label="Funil em que o anúncio vai rodar"
          hint="Usa os mesmos funis da metodologia (Webinar, Diagnóstico, VSL, etc)."
        >
          <select
            value={values.funilId || ''}
            onChange={(e) => set('funilId', e.target.value)}
            className="input-field w-full"
          >
            <option value="">— escolha um funil —</option>
            {FUNNELS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.icon}  {f.label}
              </option>
            ))}
          </select>
          {selectedFunil && (
            <p className="text-[11px] text-rl-muted mt-1.5 leading-snug">{selectedFunil.desc}</p>
          )}
        </Field>

        {/* Observação */}
        <Field label="Observação (opcional)">
          <textarea
            value={values.observacao || ''}
            onChange={(e) => set('observacao', e.target.value)}
            rows={3}
            placeholder="Ex: rodar com público quente, testar headline alternativa..."
            className="input-field w-full resize-none"
          />
        </Field>

        {/* Aviso URL inválida */}
        {values.url && !isValidUrl && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-rl-gold/5 border border-rl-gold/30">
            <AlertTriangle className="w-4 h-4 text-rl-gold mt-0.5 shrink-0" />
            <p className="text-xs text-rl-text">
              O link parece não começar com http(s)://. Confira antes de salvar.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-rl-border flex items-center justify-end gap-2">
        <button
          onClick={onClose}
          className="text-xs px-4 py-2 rounded-xl bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl bg-rl-purple text-white font-semibold hover:bg-rl-purple/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Check className="w-3.5 h-3.5" /> {initial ? 'Salvar alterações' : 'Salvar anúncio'}
        </button>
      </div>
    </Modal>
  )
}

function Field({ label, hint, required, children }) {
  return (
    <div>
      <label className="text-xs font-bold text-rl-text uppercase tracking-wide mb-1 block">
        {label} {required && <span className="text-rl-red">*</span>}
      </label>
      {hint && <p className="text-[11px] text-rl-muted mb-1.5">{hint}</p>}
      {children}
    </div>
  )
}
