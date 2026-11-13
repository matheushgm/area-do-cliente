import { useMemo, useState } from 'react'
import {
  Presentation, Plus, Trash2, Pencil, ChevronLeft, ChevronRight,
  AlertTriangle, Download, Link2,
} from 'lucide-react'
import { exportWebinarPDF } from '../../utils/exportPDF'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../hooks/useToast'
import Toast from '../UI/Toast'
import { blankWebinar, aberturaProgress, webinarNoIdioma } from './webinarData'
import { Check, X } from 'lucide-react'
import { useI18n } from '../../i18n'

// Texto com um trecho em negrito: o dicionário marca o lugar com {destaque}.
function ComDestaque({ texto, destaque }) {
  const [antes, depois = ''] = texto.split('{destaque}')
  return <>{antes}<strong>{destaque}</strong>{depois}</>
}

// `webinars` + `onPersist` permitem usar o mesmo editor fora do app logado
// (link público pro cliente preencher) — ver src/pages/WebinarPublico.jsx.
// Sem eles, o módulo lê/grava direto no projeto via AppContext.
export default function WebinarModule({ project, webinars: webinarsProp, onPersist, publicMode = false }) {
  const { updateProject } = useApp()
  const { toast, showToast } = useToast()
  const { t, lang } = useI18n()
  const { ETAPAS } = webinarNoIdioma(lang)

  const webinars = useMemo(() => {
    const list = webinarsProp ?? project.webinars
    return Array.isArray(list) ? list : []
  }, [webinarsProp, project.webinars])
  const [editingId, setEditingId] = useState(null)
  const [activeEtapa, setActiveEtapa] = useState('abertura')
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [copied, setCopied] = useState(false)

  const editing = webinars.find((w) => w.id === editingId) || null

  function persist(next) {
    if (onPersist) onPersist(next)
    else updateProject(project.id, { webinars: next })
  }

  // Token de compartilhamento — mesmo client_share_token usado por CRM/Matriz/Precificação
  function getOrCreateShareToken() {
    if (project.clientShareToken) return project.clientShareToken
    const token = crypto.randomUUID()
    updateProject(project.id, { clientShareToken: token })
    return token
  }

  function handleShare() {
    const token = getOrCreateShareToken()
    if (!token) return
    const url = `${window.location.origin}/webinar/${token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
      showToast(t('webinar.linkCopiado'))
    }).catch(() => showToast(t('webinar.linkToast', { url })))
  }

  function createWebinar() {
    const wb = blankWebinar(`Webinar ${webinars.length + 1}`)
    persist([...webinars, wb])
    setEditingId(wb.id)
    setActiveEtapa('abertura')
    showToast(t('webinar.criado'))
  }

  function deleteWebinar(id) {
    if (!window.confirm(t('webinar.confirmarExcluir'))) return
    persist(webinars.filter((w) => w.id !== id))
    if (editingId === id) setEditingId(null)
    showToast(t('webinar.excluido'))
  }

  function commitRename(id) {
    const nome = renameValue.trim()
    if (nome) {
      persist(webinars.map((w) => (w.id === id ? { ...w, nome, updatedAt: new Date().toISOString() } : w)))
    }
    setRenamingId(null)
    setRenameValue('')
  }

  function updateField(etapaId, field, value) {
    persist(webinars.map((w) => {
      if (w.id !== editingId) return w
      const etapas = w.etapas || {}
      return {
        ...w,
        updatedAt: new Date().toISOString(),
        etapas: { ...etapas, [etapaId]: { ...(etapas[etapaId] || {}), [field]: value } },
      }
    }))
  }

  // ── Editor de um webinar ───────────────────────────────────────────────────
  if (editing) {
    const etapaMeta = ETAPAS.find((e) => e.id === activeEtapa) || ETAPAS[0]
    const etapaData = editing.etapas?.[activeEtapa] || {}
    return (
      <div className="space-y-5">
        {/* Header do editor */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setEditingId(null)}
            className="flex items-center gap-1 text-xs text-rl-muted hover:text-rl-text transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> {t('webinar.meusWebinars')}
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <Presentation className="w-4 h-4 text-rl-purple" />
            <h2 className="text-base font-black text-rl-text">{editing.nome}</h2>
          </div>
          <button
            onClick={() => exportWebinarPDF(editing, project)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-purple hover:border-rl-purple/30 transition-all shrink-0"
            title={t('webinar.baixarPdfTitulo')}
          >
            <Download className="w-3.5 h-3.5" /> {t('webinar.baixarPdf')}
          </button>
        </div>

        {/* Navegação de etapas */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {ETAPAS.map((e) => {
            const active = activeEtapa === e.id
            return (
              <button
                key={e.id}
                onClick={() => setActiveEtapa(e.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                  active
                    ? 'bg-rl-purple text-white border-rl-purple shadow-glow'
                    : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-text hover:border-rl-purple/30'
                }`}
              >
                <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black ${
                  active ? 'bg-white/20' : 'bg-rl-purple/10 text-rl-purple'
                }`}>
                  {e.num}
                </span>
                {e.label}
              </button>
            )
          })}
        </div>

        {/* Conteúdo da etapa */}
        {activeEtapa === 'abertura' && (
          <AberturaForm data={etapaData} onChange={(field, val) => updateField('abertura', field, val)} />
        )}
        {activeEtapa === 'historia' && (
          <HistoriaForm data={etapaData} onChange={(field, val) => updateField('historia', field, val)} />
        )}
        {activeEtapa === 'conteudo' && (
          <ConteudoForm data={etapaData} onChange={(field, val) => updateField('conteudo', field, val)} />
        )}
        {activeEtapa === 'oferta_agendamento' && (
          <OfertaAgendamentoForm data={etapaData} onChange={(field, val) => updateField('oferta_agendamento', field, val)} />
        )}
        {!etapaMeta.built && (
          <div className="glass-card p-10 text-center">
            <div className="text-4xl mb-3">{etapaMeta.emoji}</div>
            <h3 className="text-base font-bold text-rl-text">{t('webinar.etapaTitulo', { nome: etapaMeta.label })}</h3>
            <p className="text-sm text-rl-muted mt-1 max-w-md mx-auto">
              {t('webinar.emConstrucao')}
            </p>
          </div>
        )}

        <Toast toast={toast} />
      </div>
    )
  }

  // ── Lista de webinars ──────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="w-11 h-11 rounded-xl bg-rl-purple/10 flex items-center justify-center shrink-0">
          <Presentation className="w-5 h-5 text-rl-purple" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-black text-rl-text leading-tight">{t('webinar.titulo')}</h2>
          <p className="text-sm text-rl-subtle mt-0.5 max-w-2xl">
            {t('webinar.descricao')}
          </p>
        </div>
        {!publicMode && (
          <button
            onClick={handleShare}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-all shrink-0 ${
              copied
                ? 'bg-rl-green/10 border-rl-green/30 text-rl-green'
                : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-purple hover:border-rl-purple/30'
            }`}
            title={t('webinar.compartilharTitulo')}
          >
            {copied
              ? <><Check className="w-4 h-4" /> {t('webinar.linkCopiadoBotao')}</>
              : <><Link2 className="w-4 h-4" /> {t('webinar.compartilhar')}</>
            }
          </button>
        )}
        <button
          onClick={createWebinar}
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-rl-purple text-white shadow-glow hover:bg-rl-purple/90 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" /> {t('webinar.novo')}
        </button>
      </div>

      {webinars.length === 0 ? (
        <div className="rounded-xl border border-dashed border-rl-border bg-rl-surface/30 py-12 px-6 text-center space-y-3">
          <Presentation className="w-9 h-9 text-rl-muted/40 mx-auto" />
          <div>
            <p className="text-sm font-semibold text-rl-text">{t('webinar.vazioTitulo')}</p>
            <p className="text-xs text-rl-muted mt-1">{t('webinar.vazioTexto')}</p>
          </div>
          <button
            onClick={createWebinar}
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-rl-purple text-white shadow-glow hover:bg-rl-purple/90 transition-all"
          >
            <Plus className="w-4 h-4" /> {t('webinar.criarPrimeiro')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {webinars.map((w) => {
            const prog = aberturaProgress(w.etapas?.abertura || {})
            const isRenaming = renamingId === w.id
            return (
              <div key={w.id} className="glass-card p-4 group">
                <div className="flex items-start justify-between gap-2">
                  {isRenaming ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => commitRename(w.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitRename(w.id) }}
                      className="input-field text-sm font-bold flex-1"
                    />
                  ) : (
                    <button
                      onClick={() => { setEditingId(w.id); setActiveEtapa('abertura') }}
                      className="text-left flex-1 min-w-0"
                    >
                      <h3 className="text-sm font-bold text-rl-text truncate group-hover:text-rl-purple transition-colors">{w.nome}</h3>
                    </button>
                  )}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => exportWebinarPDF(w, project)}
                      className="p-1.5 rounded-lg text-rl-muted hover:text-rl-purple hover:bg-rl-purple/10 transition-all"
                      title={t('webinar.baixarPdf')}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { setRenamingId(w.id); setRenameValue(w.nome) }}
                      className="p-1.5 rounded-lg text-rl-muted hover:text-rl-purple hover:bg-rl-purple/10 transition-all"
                      title={t('webinar.renomear')}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteWebinar(w.id)}
                      className="p-1.5 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
                      title={t('comum.excluir')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-rl-muted mb-1">
                    <span>{t('webinar.abertura')}</span>
                    <span className="font-bold">{prog.percent}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-rl-surface overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-rl-purple to-rl-cyan transition-all" style={{ width: `${prog.percent}%` }} />
                  </div>
                </div>

                <button
                  onClick={() => { setEditingId(w.id); setActiveEtapa('abertura') }}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-purple hover:border-rl-purple/30 transition-all"
                >
                  {t('webinar.abrir')} <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <Toast toast={toast} />
    </div>
  )
}

// ─── Form da Abertura (render genérico a partir de ABERTURA_BLOCOS) ───────────
function AberturaForm({ data, onChange }) {
  const { lang } = useI18n()
  const { ABERTURA_BLOCOS } = webinarNoIdioma(lang)
  return <BlocoList blocos={ABERTURA_BLOCOS} data={data} onChange={onChange} />
}

// ─── Lista de blocos genérica (reusada por Abertura e História) ───────────────
function BlocoList({ blocos, data, onChange }) {
  const { t } = useI18n()
  return (
    <div className="space-y-4">
      {blocos.map((bloco) => (
        <div key={bloco.id} className="glass-card p-5 space-y-4">
          <div>
            <h3 className="text-sm font-black text-rl-text uppercase tracking-wide">{bloco.title}</h3>
            {bloco.subtitle && <p className="text-xs text-rl-muted mt-0.5">{bloco.subtitle}</p>}
          </div>

          {bloco.helper && (
            <div className="rounded-xl bg-rl-purple/5 border border-rl-purple/20 p-3 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rl-purple">{t('webinar.useFormulas')}</p>
              {bloco.helper.map((h, i) => (
                <p key={i} className="text-[11px] text-rl-subtle">• {h}</p>
              ))}
            </div>
          )}

          {bloco.fields.map((f) => (
            <FieldRenderer key={f.id} field={f} data={data} onChange={onChange} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Form da História ─────────────────────────────────────────────────────────
function HistoriaForm({ data, onChange }) {
  const { t, lang } = useI18n()
  const { HISTORIA_REGRAS, HISTORIA_TIPOS, HISTORIA_TRANSICOES, HISTORIA_3A_BLOCOS, HISTORIA_3B_BLOCOS } = webinarNoIdioma(lang)
  const tipo = data.tipo || ''
  return (
    <div className="space-y-4">
      {/* Regras de ouro */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-black text-rl-text uppercase tracking-wide mb-3">{t('webinar.historia.regrasTitulo')}</h3>
        <p className="text-xs text-rl-muted mb-3">
          {t('webinar.historia.regrasTexto')}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl bg-rl-green/5 border border-rl-green/30 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rl-green mb-2">{t('webinar.oQueFazer')}</p>
            <ul className="space-y-1">
              {HISTORIA_REGRAS.fazer.map((r, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11px] text-rl-subtle">
                  <Check className="w-3 h-3 text-rl-green mt-0.5 shrink-0" /> {r}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-red-400/5 border border-red-400/30 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-400 mb-2">{t('webinar.oQueNaoFazer')}</p>
            <ul className="space-y-1">
              {HISTORIA_REGRAS.naoFazer.map((r, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11px] text-rl-subtle">
                  <X className="w-3 h-3 text-red-400 mt-0.5 shrink-0" /> {r}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Etapa 1: tipo de história */}
      <div className="glass-card p-5 space-y-3">
        <div>
          <h3 className="text-sm font-black text-rl-text uppercase tracking-wide">{t('webinar.historia.tipoTitulo')}</h3>
          <p className="text-xs text-rl-muted mt-0.5">{t('webinar.historia.tipoTexto')}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {HISTORIA_TIPOS.map((tp) => {
            const active = tipo === tp.id
            return (
              <button
                key={tp.id}
                type="button"
                onClick={() => onChange('tipo', tp.id)}
                className={`text-left rounded-xl border-2 p-4 transition-all ${
                  active
                    ? 'bg-rl-purple/10 border-rl-purple/60 shadow-glow'
                    : 'bg-rl-surface border-rl-border hover:border-rl-purple/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    active ? 'border-rl-purple bg-rl-purple' : 'border-rl-border'
                  }`}>
                    {active && <Check className="w-2.5 h-2.5 text-white" />}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-wider text-rl-purple">{t('webinar.opcao', { id: tp.id })}</span>
                </div>
                <p className={`text-sm font-bold ${active ? 'text-rl-purple' : 'text-rl-text'}`}>{tp.label}</p>
                <p className="text-[11px] text-rl-subtle mt-1 leading-snug">{tp.desc}</p>
                <p className="text-[10px] text-rl-muted mt-2 italic">{t('webinar.exemploCurto', { texto: tp.example })}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Etapa 2: transições */}
      <div className="glass-card p-5 space-y-4">
        <div>
          <h3 className="text-sm font-black text-rl-text uppercase tracking-wide">{t('webinar.historia.transicaoTitulo')}</h3>
          <p className="text-xs text-rl-muted mt-0.5">{t('webinar.historia.transicaoTexto')}</p>
        </div>
        {HISTORIA_TRANSICOES.map((tr) => (
          <div key={tr.id} className="rounded-xl border border-rl-border p-3 space-y-2">
            <div>
              <p className="text-xs font-bold text-rl-text">{tr.title}</p>
              <p className="text-[10px] text-rl-muted">{tr.hint}</p>
            </div>
            <FieldRenderer field={tr.field} data={data} onChange={onChange} />
            <div className="rounded-lg bg-rl-purple/5 border border-rl-purple/20 p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rl-purple mb-0.5">{t('webinar.historia.suaTransicao')}</p>
              <p className="text-xs text-rl-text leading-snug">{tr.compute(data || {})}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Etapa 3: estrutura condicional */}
      {tipo === 'A' && (
        <>
          <SectionDivider label={t('webinar.historia.estruturaA')} />
          <BlocoList blocos={HISTORIA_3A_BLOCOS} data={data} onChange={onChange} />
        </>
      )}
      {tipo === 'B' && (
        <>
          <SectionDivider label={t('webinar.historia.estruturaB')} />
          <BlocoList blocos={HISTORIA_3B_BLOCOS} data={data} onChange={onChange} />
        </>
      )}
      {!tipo && (
        <div className="rounded-xl border border-dashed border-rl-border bg-rl-surface/30 p-6 text-center">
          <p className="text-sm text-rl-muted">
            <ComDestaque texto={t('webinar.historia.escolhaAntes')} destaque={t('webinar.historia.escolhaAntesDestaque')} />
          </p>
        </div>
      )}
    </div>
  )
}

function SectionDivider({ label }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <div className="h-px flex-1 bg-rl-border" />
      <span className="text-[11px] font-black uppercase tracking-wider text-rl-purple">{label}</span>
      <div className="h-px flex-1 bg-rl-border" />
    </div>
  )
}

// Card de regras "✓ fazer / ✗ não fazer" — compartilhado
function RulesCard({ titulo, descricao, fazer, naoFazer }) {
  const { t } = useI18n()
  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-black text-rl-text uppercase tracking-wide mb-1">{titulo}</h3>
      {descricao && <p className="text-xs text-rl-muted mb-3">{descricao}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-rl-green/5 border border-rl-green/30 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-rl-green mb-2">{t('webinar.oQueFazer')}</p>
          <ul className="space-y-1">
            {fazer.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px] text-rl-subtle">
                <Check className="w-3 h-3 text-rl-green mt-0.5 shrink-0" /> {r}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl bg-red-400/5 border border-red-400/30 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-red-400 mb-2">{t('webinar.oQueNaoFazer')}</p>
          <ul className="space-y-1">
            {naoFazer.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px] text-rl-subtle">
                <X className="w-3 h-3 text-red-400 mt-0.5 shrink-0" /> {r}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

// ─── Form do Conteúdo ─────────────────────────────────────────────────────────
function ConteudoForm({ data, onChange }) {
  const { t, lang } = useI18n()
  const {
    CONTEUDO_NIVEIS, CONTEUDO_REGRAS, CONTEUDO_ETAPA1, CONTEUDO_TEMAS,
    CONTEUDO_VALIDACAO, CONTEUDO_ETAPA4, CONTEUDO_ETAPA5, CONTEUDO_ETAPA6,
    CONTEUDO_ROTEIRO_ABERTURA, CONTEUDO_ROTEIRO_PILARES, CONTEUDO_ROTEIRO_PONTOS,
    CONTEUDO_SLIDES, CONTEUDO_ETAPA9, CONTEUDO_TRANSICOES, CONTEUDO_CHECKLIST,
  } = webinarNoIdioma(lang)
  const tema = data.tema || ''
  const temaMeta = CONTEUDO_TEMAS.find((tm) => tm.id === tema) || null
  const transAtiva = data.transicao_oferta || ''

  return (
    <div className="space-y-4">
      {/* 3 níveis de convencimento */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-black text-rl-text uppercase tracking-wide mb-1">{t('webinar.conteudo.niveisTitulo')}</h3>
        <p className="text-xs text-rl-muted mb-3">{t('webinar.conteudo.niveisTexto')}</p>
        <div className="space-y-2">
          {CONTEUDO_NIVEIS.map((n) => {
            const cls = n.tone === 'green'
              ? { box: 'bg-rl-green/5 border-rl-green/30', txt: 'text-rl-green' }
              : n.tone === 'gold'
                ? { box: 'bg-rl-gold/5 border-rl-gold/30', txt: 'text-rl-gold' }
                : { box: 'bg-red-400/5 border-red-400/30', txt: 'text-red-400' }
            return (
              <div key={n.nivel} className={`rounded-xl border p-3 ${cls.box}`}>
                <p className={`text-xs font-bold ${cls.txt}`}>{t('webinar.conteudo.nivel', { n: n.nivel, rotulo: n.label })}</p>
                <p className="text-[11px] text-rl-subtle mt-0.5">{n.text}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Regras de ouro */}
      <RulesCard
        titulo={t('webinar.conteudo.regrasTitulo')}
        fazer={CONTEUDO_REGRAS.fazer}
        naoFazer={CONTEUDO_REGRAS.naoFazer}
      />

      {/* Etapa 1 */}
      <BlocoList blocos={CONTEUDO_ETAPA1} data={data} onChange={onChange} />

      {/* Etapa 2: tema */}
      <div className="glass-card p-5 space-y-3">
        <div>
          <h3 className="text-sm font-black text-rl-text uppercase tracking-wide">{t('webinar.conteudo.temaTitulo')}</h3>
          <p className="text-xs text-rl-muted mt-0.5">{t('webinar.conteudo.temaTexto')}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {CONTEUDO_TEMAS.map((tm) => {
            const active = tema === tm.id
            return (
              <button
                key={tm.id}
                type="button"
                onClick={() => onChange('tema', tm.id)}
                className={`text-left rounded-xl border-2 p-3 transition-all ${
                  active ? 'bg-rl-purple/10 border-rl-purple/60 shadow-glow' : 'bg-rl-surface border-rl-border hover:border-rl-purple/30'
                }`}
              >
                <span className="text-[10px] font-black uppercase tracking-wider text-rl-purple">{t('webinar.opcao', { id: tm.id })}</span>
                <p className={`text-xs font-bold mt-0.5 ${active ? 'text-rl-purple' : 'text-rl-text'}`}>{tm.label}</p>
                <p className="text-[10px] text-rl-muted mt-1">{tm.desc}</p>
              </button>
            )
          })}
        </div>
        {temaMeta && (
          <div className="space-y-3 pt-1">
            {temaMeta.fields.map((f) => (
              <FieldRenderer key={f.id} field={f} data={data} onChange={onChange} />
            ))}
          </div>
        )}
      </div>

      {/* Etapa 3: validação (guia) */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-black text-rl-text uppercase tracking-wide mb-2">{t('webinar.conteudo.validacaoTitulo')}</h3>
        <p className="text-xs text-rl-muted mb-3">{t('webinar.conteudo.validacaoTexto')}</p>
        <ul className="space-y-1.5">
          {CONTEUDO_VALIDACAO.map((v, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-rl-subtle">
              <span className="text-rl-purple font-bold shrink-0">{i + 1}.</span> {v}
            </li>
          ))}
        </ul>
      </div>

      {/* Etapa 4 */}
      <BlocoList blocos={CONTEUDO_ETAPA4} data={data} onChange={onChange} />

      {/* Etapa 5 */}
      <BlocoList blocos={CONTEUDO_ETAPA5} data={data} onChange={onChange} />

      {/* Etapa 6 */}
      <BlocoList blocos={CONTEUDO_ETAPA6} data={data} onChange={onChange} />

      {/* Etapa 7: roteiro condicional */}
      <SectionDivider label={t('webinar.conteudo.roteiro')} />
      <div className="glass-card p-5 space-y-3">
        <FieldRenderer field={CONTEUDO_ROTEIRO_ABERTURA} data={data} onChange={onChange} />
      </div>
      {tema === 'A' && <BlocoList blocos={CONTEUDO_ROTEIRO_PILARES} data={data} onChange={onChange} />}
      {(tema === 'B' || tema === 'C') && <BlocoList blocos={CONTEUDO_ROTEIRO_PONTOS} data={data} onChange={onChange} />}
      {!tema && (
        <div className="rounded-xl border border-dashed border-rl-border bg-rl-surface/30 p-4 text-center">
          <p className="text-xs text-rl-muted"><ComDestaque texto={t('webinar.conteudo.escolhaTema')} destaque={t('webinar.conteudo.escolhaTemaDestaque')} /></p>
        </div>
      )}

      {/* Etapa 8: tipos de slides (guia) */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-black text-rl-text uppercase tracking-wide mb-3">{t('webinar.conteudo.slidesTitulo')}</h3>
        <div className="space-y-2">
          {CONTEUDO_SLIDES.map((s, i) => (
            <div key={i} className="rounded-xl border border-rl-border p-3">
              <p className="text-xs font-bold text-rl-text mb-1.5">{s.tipo}</p>
              <p className="text-[11px] text-rl-green">✅ {s.bom}</p>
              <p className="text-[11px] text-red-400 mt-0.5">❌ {s.ruim}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Etapa 9 */}
      <BlocoList blocos={CONTEUDO_ETAPA9} data={data} onChange={onChange} />

      {/* Etapa 10: transição para oferta */}
      <div className="glass-card p-5 space-y-3">
        <div>
          <h3 className="text-sm font-black text-rl-text uppercase tracking-wide">{t('webinar.conteudo.transicaoTitulo')}</h3>
          <p className="text-xs text-rl-muted mt-0.5">{t('webinar.conteudo.transicaoTexto')}</p>
        </div>
        <div className="space-y-2">
          {CONTEUDO_TRANSICOES.map((tr) => {
            const active = transAtiva === tr.id
            return (
              <button
                key={tr.id}
                type="button"
                onClick={() => onChange('transicao_oferta', active ? '' : tr.id)}
                className={`w-full text-left rounded-xl border p-3 transition-all ${
                  active ? 'bg-rl-purple/10 border-rl-purple/50' : 'bg-rl-surface border-rl-border hover:border-rl-purple/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${active ? 'border-rl-purple bg-rl-purple' : 'border-rl-border'}`}>
                    {active && <Check className="w-2.5 h-2.5 text-white" />}
                  </span>
                  <span className="text-xs font-bold text-rl-text">{tr.titulo}</span>
                </div>
                <p className="text-[11px] text-rl-subtle italic pl-6">{tr.texto}</p>
              </button>
            )
          })}
        </div>
        <FieldRenderer
          field={{ id: 'c_transicao_final', type: 'area', label: t('webinar.conteudo.suaTransicao') }}
          data={data}
          onChange={onChange}
        />
      </div>

      {/* Checklist final */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-black text-rl-text uppercase tracking-wide mb-3">{t('webinar.conteudo.checklistTitulo')}</h3>
        <ul className="space-y-1.5">
          {CONTEUDO_CHECKLIST.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-rl-subtle">
              <Check className="w-3.5 h-3.5 text-rl-green mt-0.5 shrink-0" /> {c}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ─── Form da Oferta de Agendamento ────────────────────────────────────────────
function OfertaAgendamentoForm({ data, onChange }) {
  const { t, lang } = useI18n()
  const { OA_ETAPAS_LISTA, OA_BLOCOS, OA_OBJECOES_FIXAS, OA_FECHAMENTO } = webinarNoIdioma(lang)
  return (
    <div className="space-y-4">
      {/* Lista das 10 etapas */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-black text-rl-text uppercase tracking-wide mb-1">{t('webinar.oferta.etapasTitulo')}</h3>
        <p className="text-xs text-rl-muted mb-3">{t('webinar.oferta.etapasTexto')}</p>
        <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
          {OA_ETAPAS_LISTA.map((e, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-rl-subtle">
              <span className="text-rl-purple font-bold shrink-0">{i + 1}.</span> {e}
            </li>
          ))}
        </ol>
      </div>

      {/* Etapas 1-8 */}
      <BlocoList blocos={OA_BLOCOS} data={data} onChange={onChange} />

      {/* Etapa 9 — objeções */}
      <SectionDivider label={t('webinar.oferta.objecoes')} />
      <p className="text-xs text-rl-muted -mt-2">{t('webinar.oferta.objecoesTexto')}</p>
      <div className="space-y-3">
        {OA_OBJECOES_FIXAS.map((obj) => (
          <div key={obj.n} className="glass-card p-4 space-y-2">
            <p className="text-sm font-bold text-rl-text">
              <span className="text-rl-purple">{t('webinar.oferta.objecao', { n: obj.n })}</span> &ldquo;{obj.pergunta}&rdquo;
            </p>
            <FieldRenderer
              field={{ id: `oa_obj${obj.n}_resp`, type: 'area', label: t('webinar.oferta.suaResposta') }}
              data={data}
              onChange={onChange}
            />
            <div className="rounded-lg bg-rl-cyan/5 border border-rl-cyan/30 p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rl-cyan mb-0.5">CTA</p>
              <p className="text-xs text-rl-text">{obj.cta}</p>
            </div>
          </div>
        ))}

        {/* 3 objeções personalizadas */}
        {[8, 9, 10].map((n) => (
          <div key={n} className="glass-card p-4 space-y-2">
            <p className="text-sm font-bold text-rl-purple">{t('webinar.oferta.objecaoNicho', { n })}</p>
            <FieldRenderer
              field={{ id: `oa_obj${n}_pergunta`, type: 'text', label: t('webinar.oferta.aObjecao') }}
              data={data}
              onChange={onChange}
            />
            <FieldRenderer
              field={{ id: `oa_obj${n}_resp`, type: 'area', label: t('webinar.oferta.suaResposta') }}
              data={data}
              onChange={onChange}
            />
            <FieldRenderer
              field={{ id: `oa_obj${n}_cta`, type: 'text', label: t('webinar.oferta.ctaAgendar') }}
              data={data}
              onChange={onChange}
            />
          </div>
        ))}
      </div>

      {/* Etapa 10 — fechamento */}
      <BlocoList blocos={OA_FECHAMENTO} data={data} onChange={onChange} />
    </div>
  )
}

function FieldRenderer({ field, data, onChange }) {
  const { t } = useI18n()
  const f = field

  if (f.type === 'alert') {
    return (
      <div className="flex items-start gap-2 p-3 rounded-xl bg-rl-gold/5 border border-rl-gold/30">
        <AlertTriangle className="w-4 h-4 text-rl-gold mt-0.5 shrink-0" />
        <p className="text-xs text-rl-text leading-snug">{f.text}</p>
      </div>
    )
  }

  if (f.type === 'preview') {
    const val = f.compute(data || {})
    return (
      <div className="rounded-xl bg-rl-purple/5 border-2 border-rl-purple/30 p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-rl-purple mb-1">{f.label}</p>
        <p className="text-base font-bold text-rl-text leading-snug">{val}</p>
      </div>
    )
  }

  if (f.type === 'info') {
    return (
      <div className="rounded-xl bg-rl-cyan/5 border border-rl-cyan/30 p-4">
        {f.label && <p className="text-[10px] font-bold uppercase tracking-wider text-rl-cyan mb-1">{f.label}</p>}
        <p className="text-sm font-semibold text-rl-text leading-snug">{f.text}</p>
      </div>
    )
  }

  if (f.type === 'radio') {
    return (
      <div>
        <label className="text-xs font-bold text-rl-text block mb-2">{f.label}</label>
        <div className="space-y-2">
          {f.options.map((opt) => {
            const active = data?.[f.id] === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange(f.id, active ? '' : opt.value)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-all flex items-center gap-2 ${
                  active
                    ? 'bg-rl-purple/10 border-rl-purple/50 text-rl-purple'
                    : 'bg-rl-surface border-rl-border text-rl-text hover:border-rl-purple/30'
                }`}
              >
                <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                  active ? 'border-rl-purple bg-rl-purple' : 'border-rl-border'
                }`}>
                  {active && <Check className="w-2.5 h-2.5 text-white" />}
                </span>
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  if (f.type === 'checks') {
    const selected = Array.isArray(data?.[f.id]) ? data[f.id] : []
    const toggle = (opt) => {
      const next = selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt]
      onChange(f.id, next)
    }
    return (
      <div>
        <label className="text-xs font-bold text-rl-text block mb-2">{f.label}</label>
        <div className="space-y-2">
          {f.options.map((opt, i) => {
            const active = selected.includes(opt)
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggle(opt)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-all flex items-start gap-2 ${
                  active
                    ? 'bg-rl-purple/10 border-rl-purple/50 text-rl-purple'
                    : 'bg-rl-surface border-rl-border text-rl-text hover:border-rl-purple/30'
                }`}
              >
                <span className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center mt-0.5 ${
                  active ? 'border-rl-purple bg-rl-purple' : 'border-rl-border'
                }`}>
                  {active && <Check className="w-2.5 h-2.5 text-white" />}
                </span>
                <span className="italic">&ldquo;{f.labels?.[i] ?? opt}&rdquo;</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  if (f.type === 'choice') {
    return (
      <div>
        <label className="text-xs font-bold text-rl-text block mb-1">{f.label}</label>
        {f.example && <p className="text-[11px] text-rl-muted mb-2 italic">{t('webinar.exemplo', { texto: f.example })}</p>}
        <div className="space-y-2">
          {f.options.map((opt) => (
            <div key={opt.id}>
              <label className="text-[11px] font-semibold text-rl-subtle block mb-1">{opt.label}</label>
              <input
                type="text"
                value={data?.[opt.id] || ''}
                onChange={(e) => onChange(opt.id, e.target.value)}
                className="input-field w-full text-sm"
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // text / area
  return (
    <div>
      <label className="text-xs font-bold text-rl-text block mb-1">{f.label}</label>
      {f.example && <p className="text-[11px] text-rl-muted mb-1.5 italic">{t('webinar.exemplo', { texto: f.example })}</p>}
      <div className={f.prefix ? 'flex items-start gap-2' : ''}>
        {f.prefix && (
          <span className="mt-2.5 text-xs font-bold text-rl-purple shrink-0 whitespace-nowrap">{f.prefix}</span>
        )}
        {f.type === 'area' ? (
          <textarea
            value={data?.[f.id] || ''}
            onChange={(e) => onChange(f.id, e.target.value)}
            rows={2}
            className="input-field w-full text-sm resize-y"
          />
        ) : (
          <input
            type="text"
            value={data?.[f.id] || ''}
            onChange={(e) => onChange(f.id, e.target.value)}
            className="input-field w-full text-sm"
          />
        )}
      </div>
    </div>
  )
}
