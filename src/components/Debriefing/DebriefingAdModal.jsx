import { useMemo, useRef, useState } from 'react'
import { X, Check, Video, Image as ImageIcon, Layers, ExternalLink, AlertTriangle, Play, CheckCircle2, Clock, Upload, Paperclip, Loader2, Trash2, XCircle, Send, History, PlusCircle, Palette, FileText, ArrowUp, ArrowDown } from 'lucide-react'
import Modal from '../UI/Modal'
import MarkdownView from '../Editor/MarkdownView'
import { FUNNELS } from '../Kickoff/KickoffFunnelRecommendations'
import { STATUS_OPTIONS, RESULTADO_OPTIONS, DEFAULT_STATUS, APROVACAO_BY_ID, todayISO, fmtDateTimeBR, normalizarPasta } from './debriefingData'
import { uploadFile, deleteFile, getSignedUrl } from '../../lib/supabase'
import AnexoPreview from '../UI/AnexoPreview'
import {
  ATTACHMENT_BUCKET, FORMATOS, arquivosDoAd, espelhoLegado, caminhoArquivo, lerMedidas,
  formatoDoArquivo, useUrlsAssinadas,
} from './arquivosCriativo'
import { t as tSolto, useI18n } from '../../i18n'

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
// Títulos em centralAnuncio.copyTitulo.<status> (status gravado em copyAprovacao).
const COPY_TITULO = ['aprovado', 'reprovado', 'pendente', 'revisao', 'reprovado_interno']

function CopyAprovadaBlock({ copy, origem, aprovacao }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const st = aprovacao?.status || null
  // Aprovado com alterações: o texto exibido já é o do cliente; o original
  // (o que o time enviou) fica numa dobra pra comparação.
  const editado = st === 'aprovado' && aprovacao?.editado
  const copyOriginal = editado ? aprovacao?.copyOriginal : null
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
            {editado ? t('centralAnuncio.copyEditada') : (COPY_TITULO.includes(st) ? t(`centralAnuncio.copyTitulo.${st}`) : t('centralAnuncio.copyDoAnuncio'))}
          </p>
          {leva && (
            <p className="text-[11px] text-rl-muted truncate">
              {t('centralAnuncio.leva', { nome: leva })}
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
          {copied ? t('centralAnuncio.copiada') : t('centralAnuncio.copiarTexto')}
        </button>
      </div>
      <div className="px-4 py-3 max-h-64 overflow-y-auto">
        <MarkdownView content={copy} className="md-prose--xs" />
      </div>
      {editado && (
        <div className="px-4 pb-4 space-y-2">
          <p className="text-[11px] text-rl-muted">
            {t('centralAnuncio.clienteEditou')}
          </p>
          {copyOriginal && (
            <details className="group">
              <summary className="text-[10px] font-semibold text-rl-muted cursor-pointer hover:text-rl-text">
                {t('centralAnuncio.verOriginal')}
              </summary>
              <div className="mt-2 rounded-lg bg-rl-surface/60 border border-rl-border px-3 py-2 max-h-64 overflow-y-auto">
                <MarkdownView content={copyOriginal} className="md-prose--xs" />
              </div>
            </details>
          )}
        </div>
      )}
      {st === 'reprovado' && (
        <div className="px-4 pb-4 space-y-2">
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider font-bold text-red-500">
              {t('centralAnuncio.motivoReprovacao')}
            </p>
            <p className="text-xs text-rl-text mt-1 whitespace-pre-wrap">{aprovacao.motivo || '—'}</p>
          </div>
          <div className="rounded-lg bg-rl-surface/60 border border-rl-border px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider font-bold text-rl-muted">
              {t('centralAnuncio.comoDeveria')}
            </p>
            <p className="text-xs text-rl-text mt-1 whitespace-pre-wrap">{aprovacao.sugestao || '—'}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// Tipos de anúncio com ícone + código curto (pro auto-suggest de nomenclatura).
// `label` sai no idioma atual; id e code são gravados (tipo / nome do anúncio).
export const TIPOS_ANUNCIO = [
  { id: 'video',     get label() { return tSolto('centralAnuncio.tipos.video') },     code: 'VID', Icon: Video },
  { id: 'imagem',    get label() { return tSolto('centralAnuncio.tipos.imagem') },    code: 'IMG', Icon: ImageIcon },
  { id: 'carrossel', get label() { return tSolto('centralAnuncio.tipos.carrossel') }, code: 'CAR', Icon: Layers },
]

// O código vai no nome do anúncio (gravado): não traduz.
const STAGE_CODE = { topo: 'TOPO', meio: 'MEIO', fundo: 'FUNDO' }
const STAGE_LABEL = { topo: 'topo', meio: 'meio', fundo: 'fundo' }

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
              // rótulo no idioma de quem lê (a lista é memorizada por campaignPlan)
              get stageLabel() { return STAGE_LABEL[stageKey] ? tSolto(`centralAnuncio.etapas.${STAGE_LABEL[stageKey]}`) : stageKey },
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
  pastas = [],
  onSave,
  onClose,
}) {
  const campaigns = useMemo(() => flattenCampaigns(campaignPlan), [campaignPlan])
  const fileInputRef = useRef(null)
  const { t } = useI18n()

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
    arquivos:        arquivosDoAd(initial),
  }))
  const [uploading, setUploading] = useState(false)
  const [verArquivo, setVerArquivo] = useState(null) // { anexos, indice } na pré-visualização
  const urlsArquivos = useUrlsAssinadas(values.arquivos.map((a) => a.path))
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

  // ── Arquivos do criativo (feed, story, cards) ─────────────────────────────
  // Arquivo guardado numa versão antiga continua no Storage: o cliente compara.
  function guardadoNoHistorico(path) {
    return (values.versionHistory || []).some((v) => v.attachmentPath === path
      || (v.arquivos || []).some((a) => a.path === path))
  }

  async function handleFilesSelect(e) {
    const files = [...(e.target.files || [])]
    if (!files.length) return
    if (!projectId) {
      setUploadError(t('centralAnuncio.semId'))
      return
    }
    setUploadError('')
    setUploading(true)
    try {
      const novos = []
      for (const file of files) {
        const med = await lerMedidas(file)
        const formato = values.tipo === 'carrossel' ? 'card' : formatoDoArquivo({ name: file.name, ...med })
        const path = caminhoArquivo(projectId, stableId, formato, file.name)
        const url = await uploadFile(ATTACHMENT_BUCKET, path, file)
        if (!url) {
          setUploadError(t('centralAnuncio.falhaUpload', { nome: file.name }))
          continue
        }
        novos.push({ path, name: file.name, formato, midia: med.midia, largura: med.largura, altura: med.altura })
      }
      // Mesmo caminho (mesmo nome e formato) substitui o arquivo da lista.
      setValues((prev) => ({
        ...prev,
        arquivos: [...prev.arquivos.filter((a) => !novos.some((n) => n.path === a.path)), ...novos],
      }))
    } catch (err) {
      console.error('[Debriefing upload]', err)
      setUploadError(err?.message || t('centralAnuncio.erroUpload'))
    } finally {
      setUploading(false)
      // Limpa o input pra permitir re-upload do mesmo arquivo
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleRemoveArquivo(path) {
    if (!guardadoNoHistorico(path)) deleteFile(ATTACHMENT_BUCKET, path).catch(() => {})
    setValues((prev) => ({ ...prev, arquivos: prev.arquivos.filter((a) => a.path !== path) }))
  }

  function setFormatoArquivo(path, formato) {
    setValues((prev) => ({ ...prev, arquivos: prev.arquivos.map((a) => (a.path === path ? { ...a, formato } : a)) }))
  }

  function moverArquivo(i, delta) {
    setValues((prev) => {
      const j = i + delta
      if (j < 0 || j >= prev.arquivos.length) return prev
      const arquivos = [...prev.arquivos]
      ;[arquivos[i], arquivos[j]] = [arquivos[j], arquivos[i]]
      return { ...prev, arquivos }
    })
  }

  // ── Nova versão (v2, v3...) ──────────────────────────────────────────────
  // Ao reprovar, o cliente já deixou o motivo + como deveria estar. Em vez de
  // sobrescrever a mídia (o que apagaria o que ele reprovou), arquivamos a
  // versão atual no histórico e liberamos os campos de URL/anexo pra receber
  // a mídia nova. O cliente passa a ver as duas versões lado a lado.
  function handleCreateNewVersion() {
    const currentVersion = values.version || 1
    if (!window.confirm(
      t('centralAnuncio.confirmarVersao', { atual: currentVersion, proxima: currentVersion + 1 })
    )) return
    setValues((prev) => {
      const snapshot = {
        version:        prev.version || 1,
        url:            prev.url || null,
        attachmentPath: prev.attachmentPath || null,
        attachmentName: prev.attachmentName || null,
        arquivos:       prev.arquivos || [],
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
    if (entry.arquivos?.length) { setVerArquivo({ anexos: entry.arquivos, indice: 0 }); return }
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
  const temArquivo = values.arquivos.length > 0
  const baseValid =
    (emEdicao || temArquivo || !!(values.url || '').trim()) && !!(values.nome || '').trim() && !!values.tipo
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
      ...espelhoLegado(values.arquivos),
      pasta: normalizarPasta(values.pasta) || null,
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
            {initial ? t('centralAnuncio.editando') : t('centralAnuncio.novo')}
          </p>
          <h3 className="text-lg font-black text-rl-text leading-tight flex items-center gap-2">
            {t('centralAnuncio.titulo')}
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
          <Field label={t('centralAnuncio.dataCriacao')} required>
            <input
              type="date"
              value={values.createdAt || ''}
              onChange={(e) => set('createdAt', e.target.value)}
              className="input-field w-full"
            />
          </Field>
          <Field label={t('centralAnuncio.tipoAnuncio')} required>
            <div className="grid grid-cols-3 gap-2">
              {TIPOS_ANUNCIO.map((tp) => {
                const Icon = tp.Icon
                const active = values.tipo === tp.id
                return (
                  <button
                    key={tp.id}
                    type="button"
                    onClick={() => set('tipo', tp.id)}
                    className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl border text-xs font-semibold transition-all ${
                      active
                        ? 'bg-rl-purple/10 border-rl-purple/50 text-rl-purple'
                        : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-text hover:border-rl-purple/30'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" /> {tp.label}
                  </button>
                )
              })}
            </div>
          </Field>
        </div>

        {/* URL */}
        <Field
          label={t('centralAnuncio.linkAnuncio')}
          required={!emEdicao && !temArquivo}
          hint={emEdicao
            ? t('centralAnuncio.linkDicaEdicao')
            : temArquivo ? t('centralAnuncio.linkDicaComArquivo') : t('centralAnuncio.linkDicaSemArquivo')}
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
                title={t('centralAnuncio.abrirNovaAba')}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </Field>

        {/* Arquivos do criativo */}
        <Field
          label={t('centralAnuncio.arquivos')}
          hint={values.tipo === 'carrossel'
            ? t('centralAnuncio.arquivosDicaCarrossel')
            : t('centralAnuncio.arquivosDica')}
        >
          {values.arquivos.length > 0 && (
            <div className="space-y-1.5 mb-2">
              {values.arquivos.map((a, i) => (
                <div key={a.path} className="flex items-center gap-2 p-2 rounded-xl border border-rl-purple/30 bg-rl-purple/5">
                  <button
                    type="button"
                    onClick={() => setVerArquivo({ anexos: values.arquivos, indice: i })}
                    className="w-10 h-12 rounded-md overflow-hidden border border-rl-border bg-rl-surface shrink-0 flex items-center justify-center"
                    title={t('centralAnuncio.verArquivo')}
                  >
                    {a.midia === 'image' && urlsArquivos[a.path]
                      ? <img src={urlsArquivos[a.path]} alt={a.name} className="w-full h-full object-cover" />
                      : a.midia === 'video' ? <Video className="w-4 h-4 text-rl-muted" /> : <Paperclip className="w-4 h-4 text-rl-muted" />}
                  </button>
                  <select
                    value={a.formato}
                    onChange={(e) => setFormatoArquivo(a.path, e.target.value)}
                    className="input-field text-xs py-1 pl-2 pr-7 w-auto"
                    title={t('centralAnuncio.formatoArquivo')}
                  >
                    {Object.values(FORMATOS).map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                  <span className="text-sm text-rl-text font-medium truncate flex-1" title={a.name}>
                    {a.name}
                    {a.largura ? <span className="ml-1.5 text-[10px] text-rl-muted font-normal">{a.largura}×{a.altura}</span> : null}
                  </span>
                  {values.tipo === 'carrossel' && (
                    <>
                      <button type="button" onClick={() => moverArquivo(i, -1)} disabled={i === 0} className="p-1 rounded text-rl-muted hover:text-rl-purple disabled:opacity-30" title={t('centralAnuncio.subirOrdem')}>
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => moverArquivo(i, 1)} disabled={i === values.arquivos.length - 1} className="p-1 rounded text-rl-muted hover:text-rl-purple disabled:opacity-30" title={t('centralAnuncio.descerOrdem')}>
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveArquivo(a.path)}
                    className="p-1.5 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
                    title={t('centralAnuncio.removerArquivo')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-rl-border text-rl-muted hover:border-rl-purple/40 hover:text-rl-purple transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('centralAnuncio.subindo')}</>
              : <><Upload className="w-4 h-4" /> {values.arquivos.length ? t('centralAnuncio.adicionarMais') : t('centralAnuncio.selecionarArquivos')}</>
            }
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,application/pdf"
            onChange={handleFilesSelect}
            className="hidden"
          />
          {uploadError && (
            <p className="text-[11px] text-red-400 mt-1.5">{uploadError}</p>
          )}
        </Field>

        {/* Campanha */}
        <Field
          label={t('centralAnuncio.campanha')}
          hint={campaigns.length === 0
            ? t('centralAnuncio.campanhaSemCadastro')
            : t('centralAnuncio.campanhaDica')}
        >
          <select
            value={values.campanhaId || ''}
            onChange={(e) => set('campanhaId', e.target.value)}
            disabled={campaigns.length === 0}
            className="input-field w-full"
          >
            <option value="">{t('centralAnuncio.semCampanha')}</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                [{c.stageLabel}] {c.name}{c.channel ? ` · ${c.channel}` : ''}
              </option>
            ))}
          </select>
        </Field>

        {/* Nome */}
        <Field
          label={t('centralAnuncio.nome')}
          required
          hint={t('centralAnuncio.nomeDica')}
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
              title={t('centralAnuncio.sugerirDica')}
            >
              {t('centralAnuncio.sugerir')}
            </button>
          </div>
        </Field>

        {/* Pasta */}
        <Field
          label={t('centralAnuncio.pasta')}
          hint={t('centralAnuncio.pastaDica')}
        >
          <input
            type="text"
            list="modal-pastas"
            value={values.pasta || ''}
            onChange={(e) => set('pasta', e.target.value)}
            placeholder={t('centralAnuncio.pastaPlaceholder')}
            className="input-field w-full"
            maxLength={60}
          />
          <datalist id="modal-pastas">
            {pastas.map((p) => <option key={p} value={p} />)}
          </datalist>
        </Field>

        {/* Funil */}
        <Field
          label={t('centralAnuncio.funil')}
          hint={t('centralAnuncio.funilDica')}
        >
          <select
            value={values.funilId || ''}
            onChange={(e) => set('funilId', e.target.value)}
            className="input-field w-full"
          >
            <option value="">{t('centralAnuncio.escolhaFunil')}</option>
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
        <Field label={t('centralAnuncio.observacao')}>
          <textarea
            value={values.observacao || ''}
            onChange={(e) => set('observacao', e.target.value)}
            rows={3}
            placeholder={t('centralAnuncio.observacaoPlaceholder')}
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
                  {t('centralAnuncio.enviarAprovacao')}
                </span>
                <span className="text-[11px] text-rl-muted">
                  {t('centralAnuncio.enviarAprovacaoTexto')}
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
          <Field label={t('centralAnuncio.statusAnuncio')} required>
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
              <Field label={t('centralAnuncio.inicioTeste')} hint={t('centralAnuncio.inicioDica')}>
                <input
                  type="date"
                  value={values.startedAt || ''}
                  onChange={(e) => set('startedAt', e.target.value)}
                  className="input-field w-full"
                />
              </Field>
              {values.status === 'finalizado' && (
                <Field label={t('centralAnuncio.finalizadoEm')} hint={t('centralAnuncio.finalizadoDica')}>
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
              <Field label={t('centralAnuncio.performou')} required>
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
                label={t('centralAnuncio.justificativa')}
                required
                hint={t('centralAnuncio.justificativaDica')}
              >
                <textarea
                  value={values.justificativa || ''}
                  onChange={(e) => set('justificativa', e.target.value)}
                  rows={3}
                  placeholder={t('centralAnuncio.justificativaPlaceholder')}
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
              {t('centralAnuncio.urlInvalida')}
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
          {t('comum.cancelar')}
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl bg-rl-purple text-white font-semibold hover:bg-rl-purple/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Check className="w-3.5 h-3.5" /> {initial ? t('centralAnuncio.salvarAlteracoes') : t('centralAnuncio.salvarAnuncio')}
        </button>
      </div>

      {verArquivo && (
        <AnexoPreview
          anexos={verArquivo.anexos}
          indice={verArquivo.indice}
          bucket={ATTACHMENT_BUCKET}
          onFechar={() => setVerArquivo(null)}
        />
      )}
    </Modal>
  )
}

// Status da aprovação do cliente ao EDITAR um anúncio: mostra a decisão (com o
// feedback do cliente quando reprovado), permite (re)enviar pra aprovação e,
// quando reprovado, arquivar essa versão e abrir uma nova (v2, v3...) sem
// perder o histórico, pro cliente comparar.
function AprovacaoStatus({ aprovacao, version = 1, versionHistory = [], onEnviar, onNovaVersao, onOpenHistoryMedia }) {
  const { t } = useI18n()
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
      title={t('centralAnuncio.novaVersaoDica')}
    >
      <PlusCircle className="w-3.5 h-3.5" /> {t('centralAnuncio.criarVersao', { n: version + 1 })}
    </button>
  )

  if (!info) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-rl-text uppercase tracking-wide">{t('centralAnuncio.aprovacaoCliente')}</p>
            <p className="text-[11px] text-rl-muted">
              {hasHistory
                ? t('centralAnuncio.versaoNaoEnviada', { n: version })
                : t('centralAnuncio.naoEnviado')}
            </p>
          </div>
          {enviarBtn(t('centralAnuncio.enviarParaAprovacao'))}
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
          <p className="text-xs font-bold text-rl-text uppercase tracking-wide">{t('centralAnuncio.aprovacaoCliente')}</p>
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
            {enviarBtn(t('centralAnuncio.reenviar'))}
            {novaVersaoBtn}
          </div>
        )}
      </div>

      {/* Registro dos marcos: quando foi pra aprovação e quando o cliente decidiu */}
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-rl-muted">
        {aprovacao.enviadoEm && (
          <span>{t('centralAnuncio.enviadoEm')}<span className="font-semibold text-rl-subtle">{fmtDateTimeBR(aprovacao.enviadoEm)}</span></span>
        )}
        {aprovacao.decididoEm && (
          <span>
            {aprovacao.status === 'aprovado' ? t('centralAnuncio.aprovadoEm') : t('centralAnuncio.reprovadoEm')}
            <span className="font-semibold text-rl-subtle">{fmtDateTimeBR(aprovacao.decididoEm)}</span>
          </span>
        )}
      </div>

      {aprovacao.status === 'reprovado' && (
        <>
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider font-bold text-red-500">{t('centralAnuncio.motivoReprovacao')}</p>
            <p className="text-sm text-rl-text mt-1 whitespace-pre-wrap">{aprovacao.motivo || '—'}</p>
          </div>
          <div className="rounded-xl bg-rl-surface/60 border border-rl-border px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider font-bold text-rl-muted">{t('centralAnuncio.comoClienteQuer')}</p>
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
  const { t } = useI18n()
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
          <History className="w-3.5 h-3.5" /> {t('centralAnuncio.historico', { count: sorted.length })}
        </span>
        <span className="text-[10px] text-rl-muted">{open ? t('centralAnuncio.ocultar') : t('centralAnuncio.ver')}</span>
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
                  {(v.arquivos?.length || v.attachmentPath || v.url) && (
                    <button
                      type="button"
                      onClick={() => onOpenMedia?.(v)}
                      className="text-[10px] font-semibold text-rl-purple hover:underline inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" /> {t('centralAnuncio.verMidia')}
                    </button>
                  )}
                </div>
                {v.aprovacao?.status === 'reprovado' && (
                  <p className="text-[11px] text-rl-muted mt-1 whitespace-pre-wrap">
                    <span className="font-semibold text-rl-subtle">{t('centralAnuncio.motivo')}</span> {v.aprovacao.motivo || '—'}
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

export function Field({ label, hint, required, children }) {
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
