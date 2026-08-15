import { useMemo, useRef, useState } from 'react'
import { X, Check, Video, Image as ImageIcon, Layers, ExternalLink, AlertTriangle, Play, CheckCircle2, Clock, Upload, Paperclip, Loader2, Trash2, XCircle, Send, History, PlusCircle, Palette, FileText } from 'lucide-react'
import Modal from '../UI/Modal'
import { FUNNELS } from '../Kickoff/KickoffFunnelRecommendations'
import { STATUS_OPTIONS, RESULTADO_OPTIONS, DEFAULT_STATUS, APROVACAO_BY_ID, todayISO, fmtDateTimeBR } from './debriefingData'
import { uploadFile, deleteFile, getSignedUrl } from '../../lib/supabase'

const ATTACHMENT_BUCKET = 'attachments'

const STATUS_ICON = {
  rascunho: FileText,
  aprovado_edicao: Palette,
  para_subir: Clock,
  em_andamento: Play,
  finalizado: CheckCircle2,
}

// Bloco somente-leitura com a copy do anúncio (veio de Criativos com IA). É o
// briefe do designer, e quando o cliente já respondeu mostra também a decisão
// dele — inclusive o que ele pediu pra mudar, quando reprovou.
const COPY_TITULO = {
  aprovado:  'Copy aprovada pelo cliente',
  reprovado: 'Copy reprovada pelo cliente',
  pendente:  'Copy aguardando o cliente',
}

function CopyAprovadaBlock({ copy, origem, aprovacao }) {
  const [copied, setCopied] = useState(false)
  const st = aprovacao?.status || null
  const leva = aprovacao?.levaNome || origem?.levaNome
  const quando = aprovacao?.decididoEm || aprovacao?.enviadoEm || origem?.aprovadoEm

  function copiar() {
    navigator.clipboard?.writeText(copy || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="rounded-xl border border-rl-blue/30 bg-rl-blue/5 overflow-hidden">
      <div className="px-4 py-2.5 flex items-center justify-between gap-2 border-b border-rl-blue/20">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-rl-blue">
            {COPY_TITULO[st] || 'Copy do anúncio'}
          </p>
          {leva && (
            <p className="text-[11px] text-rl-muted truncate">
              Leva: {leva}
              {quando ? ` · ${fmtDateTimeBR(quando)}` : ''}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={copiar}
          className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-rl-blue/10 border border-rl-blue/30 text-rl-blue hover:bg-rl-blue/20 transition-all"
        >
          {copied ? <Check className="w-3 h-3" /> : <Paperclip className="w-3 h-3" />}
          {copied ? 'Copiada!' : 'Copiar texto'}
        </button>
      </div>
      <pre className="px-4 py-3 text-[12px] leading-relaxed text-rl-text whitespace-pre-wrap font-sans max-h-64 overflow-y-auto">
        {copy}
      </pre>
      {st === 'reprovado' && (
        <div className="px-4 pb-4 space-y-2">
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider font-bold text-red-500">
              Motivo da reprovação
            </p>
            <p className="text-xs text-rl-text mt-1 whitespace-pre-wrap">{aprovacao.motivo || '—'}</p>
          </div>
          <div className="rounded-lg bg-rl-surface/60 border border-rl-border px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider font-bold text-rl-muted">
              Como deveria estar
            </p>
            <p className="text-xs text-rl-text mt-1 whitespace-pre-wrap">{aprovacao.sugestao || '—'}</p>
          </div>
        </div>
      )}
    </div>
  )
}

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
  projectId,
  existingAdsCount = 0,
  onSave,
  onClose,
}) {
  const campaigns = useMemo(() => flattenCampaigns(campaignPlan), [campaignPlan])
  const fileInputRef = useRef(null)

  // ID estável pro caminho do anexo no Storage. Pra novos itens, geramos já
  // aqui pra que o upload tenha um caminho determinístico.
  const stableId = useMemo(() => initial?.id || crypto.randomUUID(), [initial?.id])

  const [values, setValues] = useState(() => ({
    createdAt:       TODAY(),
    url:             '',
    tipo:            'video',
    campanhaId:      '',
    nome:            '',
    funilId:         '',
    observacao:      '',
    status:          DEFAULT_STATUS,
    startedAt:       null,
    finishedAt:      null,
    resultado:       null,
    justificativa:   '',
    attachmentPath:  null,
    attachmentName:  null,
    attachmentUrl:   null,
    aprovacao:       null,
    version:         1,
    versionHistory:  [],
    ...(initial || {}),
  }))
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  // Novos anúncios vão pra aprovação do cliente por padrão — o fluxo é: subir
  // o criativo → cliente aprova/reprova no link público → aí decide campanha.
  const [enviarAprovacao, setEnviarAprovacao] = useState(!initial)

  function set(field, val) {
    setValues((prev) => ({ ...prev, [field]: val }))
  }

  // Auto-preenche datas ao trocar de status — só seta se ainda não tinha valor.
  // Não limpa datas quando "regredimos" o status: o histórico fica preservado
  // e o usuário pode editar manualmente os campos de data se quiser.
  function setStatus(newStatus) {
    setValues((prev) => {
      const next = { ...prev, status: newStatus }
      const today = todayISO()
      if (newStatus === 'em_andamento' && !prev.startedAt) {
        next.startedAt = today
      }
      if (newStatus === 'finalizado') {
        if (!prev.startedAt)  next.startedAt = today
        if (!prev.finishedAt) next.finishedAt = today
      }
      return next
    })
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

  // ── Upload de anexo ──────────────────────────────────────────────────────
  async function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!projectId) {
      setUploadError('Projeto sem ID — recarregue a página antes de anexar.')
      return
    }
    setUploadError('')
    setUploading(true)
    try {
      // Sanitiza filename pra evitar problemas no path
      const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, '_')
      const path = `${projectId}/debriefing/${stableId}-${safeName}`
      const url = await uploadFile(ATTACHMENT_BUCKET, path, file)
      if (!url) {
        setUploadError('Falha ao subir o arquivo. Tente de novo.')
        return
      }
      // Remove o anexo anterior (se houver) pra não deixar lixo, exceto quando
      // ele ainda está guardado no histórico de versões (o cliente precisa
      // continuar vendo a versão antiga pra comparar).
      const keptInHistory = (values.versionHistory || []).some((v) => v.attachmentPath === values.attachmentPath)
      if (values.attachmentPath && values.attachmentPath !== path && !keptInHistory) {
        deleteFile(ATTACHMENT_BUCKET, values.attachmentPath).catch(() => {})
      }
      setValues((prev) => ({
        ...prev,
        attachmentPath: path,
        attachmentName: file.name,
        attachmentUrl:  url,
      }))
    } catch (err) {
      console.error('[Debriefing upload]', err)
      setUploadError(err?.message || 'Erro inesperado ao subir o arquivo.')
    } finally {
      setUploading(false)
      // Limpa o input pra permitir re-upload do mesmo arquivo
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleRemoveAttachment() {
    const keptInHistory = (values.versionHistory || []).some((v) => v.attachmentPath === values.attachmentPath)
    if (values.attachmentPath && !keptInHistory) {
      deleteFile(ATTACHMENT_BUCKET, values.attachmentPath).catch(() => {})
    }
    setValues((prev) => ({
      ...prev,
      attachmentPath: null,
      attachmentName: null,
      attachmentUrl:  null,
    }))
  }

  // ── Nova versão (v2, v3...) ──────────────────────────────────────────────
  // Ao reprovar, o cliente já deixou o motivo + como deveria estar. Em vez de
  // sobrescrever a mídia (o que apagaria o que ele reprovou), arquivamos a
  // versão atual no histórico e liberamos os campos de URL/anexo pra receber
  // a mídia nova. O cliente passa a ver as duas versões lado a lado.
  function handleCreateNewVersion() {
    const currentVersion = values.version || 1
    if (!window.confirm(
      `Isso guarda a v${currentVersion} no histórico (o cliente continua vendo o que foi reprovado) e libera os campos pra você subir a mídia da v${currentVersion + 1}. Continuar?`
    )) return
    setValues((prev) => {
      const snapshot = {
        version:        prev.version || 1,
        url:            prev.url || null,
        attachmentPath: prev.attachmentPath || null,
        attachmentName: prev.attachmentName || null,
        aprovacao:      prev.aprovacao || null,
        archivedAt:     new Date().toISOString(),
      }
      return {
        ...prev,
        version:        (prev.version || 1) + 1,
        versionHistory: [...(prev.versionHistory || []), snapshot],
        aprovacao:      null,
      }
    })
  }

  // Abre a mídia de uma versão antiga do histórico numa nova aba (anexo
  // privado → precisa de URL assinada; link do Drive abre direto).
  async function handleOpenHistoryMedia(entry) {
    if (entry.attachmentPath) {
      const signed = await getSignedUrl(ATTACHMENT_BUCKET, entry.attachmentPath)
      if (signed) { window.open(signed, '_blank', 'noopener'); return }
    }
    if (entry.url) window.open(entry.url, '_blank', 'noopener')
  }

  // Validação extra pra status "Finalizado": precisa de resultado + justificativa.
  // Rascunho e fila do designer ("Aprovado para Edição") ainda não têm peça
  // pronta — só a copy. O link vira obrigatório quando o anúncio avança de
  // status, que é justamente quando a peça já existe.
  const emEdicao = values.status === 'rascunho' || values.status === 'aprovado_edicao'
  const baseValid =
    (emEdicao || !!(values.url || '').trim()) && !!(values.nome || '').trim() && !!values.tipo
  const finalizadoValid = values.status !== 'finalizado'
    || (!!values.resultado && !!(values.justificativa || '').trim())
  const canSave = baseValid && finalizadoValid

  function handleSave() {
    if (!canSave) return
    const now = new Date().toISOString()
    const aprovacao = !initial && enviarAprovacao && !values.aprovacao
      ? { status: 'pendente', enviadoEm: now }
      : values.aprovacao
    onSave({
      ...values,
      aprovacao,
      id: stableId,
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
          <h3 className="text-lg font-black text-rl-text leading-tight flex items-center gap-2">
            Cadastro de criativo
            {(values.version || 1) > 1 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rl-purple/10 text-rl-purple border border-rl-purple/30">
                v{values.version}
              </span>
            )}
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
        <Field
          label="Link do anúncio (Google Drive ou plataforma)"
          required={!emEdicao}
          hint={emEdicao ? 'Preencha quando a peça estiver pronta e o anúncio sair da fila do designer.' : undefined}
        >
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

        {/* Anexo do criativo */}
        <Field
          label="Anexar criativo (opcional)"
          hint="Faça upload do arquivo do anúncio (imagem, vídeo ou PDF). Fica salvo junto do projeto."
        >
          {values.attachmentPath ? (
            <div className="flex items-center gap-2 p-3 rounded-xl border border-rl-purple/30 bg-rl-purple/5">
              <Paperclip className="w-4 h-4 text-rl-purple shrink-0" />
              <span className="text-sm text-rl-text font-medium truncate flex-1">
                {values.attachmentName || 'arquivo anexado'}
              </span>
              {values.attachmentUrl && (
                <a
                  href={values.attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg text-rl-muted hover:text-rl-purple hover:bg-rl-purple/10 transition-all"
                  title="Baixar/visualizar"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all"
                title="Substituir"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleRemoveAttachment}
                className="p-1.5 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
                title="Remover anexo"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-rl-border text-rl-muted hover:border-rl-purple/40 hover:text-rl-purple transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Subindo...</>
                : <><Upload className="w-4 h-4" /> Selecionar arquivo</>
              }
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
          {uploadError && (
            <p className="text-[11px] text-red-400 mt-1.5">{uploadError}</p>
          )}
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

        {/* Copy aprovada pelo cliente (veio de uma leva de Criativos com IA) */}
        {values.copy && (
          <CopyAprovadaBlock
            copy={values.copy}
            origem={values.copyOrigem}
            aprovacao={values.copyAprovacao}
          />
        )}

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

        {/* ── Aprovação do cliente ───────────────────────────────────────── */}
        <div className="pt-3 border-t border-rl-border">
          {!initial ? (
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enviarAprovacao}
                onChange={(e) => setEnviarAprovacao(e.target.checked)}
                className="mt-0.5 accent-[#7C3AED]"
              />
              <span>
                <span className="text-xs font-bold text-rl-text uppercase tracking-wide block">
                  Enviar pra aprovação do cliente
                </span>
                <span className="text-[11px] text-rl-muted">
                  O criativo aparece no link de aprovação e o cliente aprova ou reprova antes de ir pro ar.
                </span>
              </span>
            </label>
          ) : (
            <AprovacaoStatus
              aprovacao={values.aprovacao}
              version={values.version || 1}
              versionHistory={values.versionHistory || []}
              onEnviar={() => set('aprovacao', { status: 'pendente', enviadoEm: new Date().toISOString() })}
              onNovaVersao={handleCreateNewVersion}
              onOpenHistoryMedia={handleOpenHistoryMedia}
            />
          )}
        </div>

        {/* ── Status + datas + resultado ─────────────────────────────────── */}
        <div className="pt-3 border-t border-rl-border">
          <Field label="Status do anúncio" required>
            <div className="grid grid-cols-3 gap-2">
              {STATUS_OPTIONS.map((s) => {
                const Icon = STATUS_ICON[s.id] || Clock
                const active = values.status === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStatus(s.id)}
                    className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl border text-xs font-semibold transition-all"
                    style={{
                      background: active ? s.bgColor : undefined,
                      borderColor: active ? s.borderColor : undefined,
                      color: active ? s.color : undefined,
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" /> {s.label}
                  </button>
                )
              })}
            </div>
          </Field>

          {/* Datas de início/fim — visíveis conforme o status */}
          {(values.status === 'em_andamento' || values.status === 'finalizado') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <Field label="Início do teste" hint="Setada automaticamente ao mudar pra Em Andamento.">
                <input
                  type="date"
                  value={values.startedAt || ''}
                  onChange={(e) => set('startedAt', e.target.value)}
                  className="input-field w-full"
                />
              </Field>
              {values.status === 'finalizado' && (
                <Field label="Finalizado em" hint="Setada automaticamente ao mudar pra Finalizado.">
                  <input
                    type="date"
                    value={values.finishedAt || ''}
                    onChange={(e) => set('finishedAt', e.target.value)}
                    className="input-field w-full"
                  />
                </Field>
              )}
            </div>
          )}

          {/* Resultado + justificativa — só pra finalizado */}
          {values.status === 'finalizado' && (
            <div className="mt-4 space-y-3">
              <Field label="Como esse anúncio performou?" required>
                <div className="grid grid-cols-3 gap-2">
                  {RESULTADO_OPTIONS.map((r) => {
                    const active = values.resultado === r.id
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => set('resultado', r.id)}
                        className="flex flex-col items-center gap-1 px-3 py-3 rounded-xl border-2 text-xs font-bold transition-all"
                        style={{
                          background: active ? r.bgColor : undefined,
                          borderColor: active ? r.borderColor : '#E2E8F0',
                          color: active ? r.color : '#64748B',
                        }}
                      >
                        <span className="text-2xl">{r.emoji}</span>
                        <span>{r.label}</span>
                      </button>
                    )
                  })}
                </div>
              </Field>

              <Field
                label="Justificativa"
                required
                hint="Por que esse anúncio teve esse desempenho? O que aprendemos pra próxima rodada?"
              >
                <textarea
                  value={values.justificativa || ''}
                  onChange={(e) => set('justificativa', e.target.value)}
                  rows={3}
                  placeholder="Ex: headline genérica + público amplo. CPL ficou em R$22 (meta era R$12). Próxima rodada testar dor específica + público lookalike de compradores..."
                  className="input-field w-full resize-none"
                />
              </Field>
            </div>
          )}
        </div>

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

// Status da aprovação do cliente ao EDITAR um anúncio: mostra a decisão (com o
// feedback do cliente quando reprovado), permite (re)enviar pra aprovação e,
// quando reprovado, arquivar essa versão e abrir uma nova (v2, v3...) sem
// perder o histórico, pro cliente comparar.
function AprovacaoStatus({ aprovacao, version = 1, versionHistory = [], onEnviar, onNovaVersao, onOpenHistoryMedia }) {
  const info = aprovacao ? APROVACAO_BY_ID[aprovacao.status] : null
  const hasHistory = versionHistory.length > 0

  const enviarBtn = (label) => (
    <button
      type="button"
      onClick={onEnviar}
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-rl-purple/40 text-rl-purple hover:bg-rl-purple/10 transition-all"
    >
      <Send className="w-3.5 h-3.5" /> {label}
    </button>
  )

  const novaVersaoBtn = onNovaVersao && (
    <button
      type="button"
      onClick={onNovaVersao}
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-rl-gold/40 text-rl-gold hover:bg-rl-gold/10 transition-all"
      title="Guarda essa versão no histórico e libera os campos pra subir uma mídia nova"
    >
      <PlusCircle className="w-3.5 h-3.5" /> Criar v{version + 1}
    </button>
  )

  if (!info) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-rl-text uppercase tracking-wide">Aprovação do cliente</p>
            <p className="text-[11px] text-rl-muted">
              {hasHistory
                ? `Versão ${version} ainda não foi enviada pro cliente avaliar.`
                : 'Esse criativo ainda não foi enviado pro cliente avaliar.'}
            </p>
          </div>
          {enviarBtn('Enviar pra aprovação')}
        </div>
        {hasHistory && (
          <VersionHistory versionHistory={versionHistory} onOpenMedia={onOpenHistoryMedia} />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold text-rl-text uppercase tracking-wide">Aprovação do cliente</p>
          {version > 1 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rl-purple/10 text-rl-purple border border-rl-purple/30">
              v{version}
            </span>
          )}
          <span
            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border"
            style={{ color: info.color, background: info.bgColor, borderColor: info.borderColor }}
          >
            {aprovacao.status === 'aprovado' && <CheckCircle2 className="w-3 h-3" />}
            {aprovacao.status === 'reprovado' && <XCircle className="w-3 h-3" />}
            {aprovacao.status === 'pendente' && <Clock className="w-3 h-3" />}
            {info.label}
          </span>
        </div>
        {aprovacao.status === 'reprovado' && (
          <div className="flex items-center gap-2">
            {enviarBtn('Reenviar mesma versão')}
            {novaVersaoBtn}
          </div>
        )}
      </div>

      {/* Registro dos marcos: quando foi pra aprovação e quando o cliente decidiu */}
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-rl-muted">
        {aprovacao.enviadoEm && (
          <span>Enviado pra aprovação em <span className="font-semibold text-rl-subtle">{fmtDateTimeBR(aprovacao.enviadoEm)}</span></span>
        )}
        {aprovacao.decididoEm && (
          <span>
            {aprovacao.status === 'aprovado' ? 'Aprovado' : 'Reprovado'} pelo cliente em{' '}
            <span className="font-semibold text-rl-subtle">{fmtDateTimeBR(aprovacao.decididoEm)}</span>
          </span>
        )}
      </div>

      {aprovacao.status === 'reprovado' && (
        <>
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider font-bold text-red-500">Motivo da reprovação</p>
            <p className="text-sm text-rl-text mt-1 whitespace-pre-wrap">{aprovacao.motivo || '—'}</p>
          </div>
          <div className="rounded-xl bg-rl-surface/60 border border-rl-border px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider font-bold text-rl-muted">Como o cliente quer o anúncio</p>
            <p className="text-sm text-rl-text mt-1 whitespace-pre-wrap">{aprovacao.sugestao || '—'}</p>
          </div>
        </>
      )}

      {hasHistory && (
        <VersionHistory versionHistory={versionHistory} onOpenMedia={onOpenHistoryMedia} />
      )}
    </div>
  )
}

// Lista as versões anteriores arquivadas (mídia + decisão do cliente na época),
// pra o time conferir o que já foi mostrado antes de mandar a próxima rodada.
function VersionHistory({ versionHistory, onOpenMedia }) {
  const [open, setOpen] = useState(false)
  const sorted = versionHistory.slice().sort((a, b) => (b.version || 0) - (a.version || 0))

  return (
    <div className="rounded-xl border border-rl-border bg-rl-surface/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-rl-subtle hover:text-rl-text transition-all"
      >
        <span className="flex items-center gap-1.5">
          <History className="w-3.5 h-3.5" /> Histórico de versões ({sorted.length})
        </span>
        <span className="text-[10px] text-rl-muted">{open ? 'ocultar' : 'ver'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          {sorted.map((v) => {
            const vInfo = v.aprovacao ? APROVACAO_BY_ID[v.aprovacao.status] : null
            return (
              <div key={v.version} className="rounded-lg border border-rl-border/70 bg-rl-card/60 px-3 py-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-rl-text">v{v.version}</span>
                  {vInfo && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border"
                      style={{ color: vInfo.color, background: vInfo.bgColor, borderColor: vInfo.borderColor }}
                    >
                      {vInfo.label}
                    </span>
                  )}
                  {(v.attachmentPath || v.url) && (
                    <button
                      type="button"
                      onClick={() => onOpenMedia?.(v)}
                      className="text-[10px] font-semibold text-rl-purple hover:underline inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" /> Ver mídia
                    </button>
                  )}
                </div>
                {v.aprovacao?.status === 'reprovado' && (
                  <p className="text-[11px] text-rl-muted mt-1 whitespace-pre-wrap">
                    <span className="font-semibold text-rl-subtle">Motivo:</span> {v.aprovacao.motivo || '—'}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
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
