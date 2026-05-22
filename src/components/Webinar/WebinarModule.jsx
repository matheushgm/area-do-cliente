import { useMemo, useState } from 'react'
import {
  Presentation, Plus, Trash2, Pencil, ChevronLeft, ChevronRight,
  AlertTriangle,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../hooks/useToast'
import Toast from '../UI/Toast'
import {
  ETAPAS, ABERTURA_BLOCOS, blankWebinar, aberturaProgress,
  HISTORIA_REGRAS, HISTORIA_TIPOS, HISTORIA_TRANSICOES,
  HISTORIA_3A_BLOCOS, HISTORIA_3B_BLOCOS,
  CONTEUDO_NIVEIS, CONTEUDO_REGRAS, CONTEUDO_ETAPA1, CONTEUDO_TEMAS,
  CONTEUDO_VALIDACAO, CONTEUDO_ETAPA4, CONTEUDO_ETAPA5, CONTEUDO_ETAPA6,
  CONTEUDO_ROTEIRO_ABERTURA, CONTEUDO_ROTEIRO_PILARES, CONTEUDO_ROTEIRO_PONTOS,
  CONTEUDO_SLIDES, CONTEUDO_ETAPA9, CONTEUDO_TRANSICOES, CONTEUDO_CHECKLIST,
  OA_ETAPAS_LISTA, OA_BLOCOS, OA_OBJECOES_FIXAS, OA_FECHAMENTO,
} from './webinarData'
import { Check, X } from 'lucide-react'

export default function WebinarModule({ project }) {
  const { updateProject } = useApp()
  const { toast, showToast } = useToast()

  const webinars = useMemo(
    () => (Array.isArray(project.webinars) ? project.webinars : []),
    [project.webinars]
  )
  const [editingId, setEditingId] = useState(null)
  const [activeEtapa, setActiveEtapa] = useState('abertura')
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')

  const editing = webinars.find((w) => w.id === editingId) || null

  function persist(next) {
    updateProject(project.id, { webinars: next })
  }

  function createWebinar() {
    const wb = blankWebinar(`Webinar ${webinars.length + 1}`)
    persist([...webinars, wb])
    setEditingId(wb.id)
    setActiveEtapa('abertura')
    showToast('Webinar criado!')
  }

  function deleteWebinar(id) {
    if (!window.confirm('Excluir este webinar? Essa ação não pode ser desfeita.')) return
    persist(webinars.filter((w) => w.id !== id))
    if (editingId === id) setEditingId(null)
    showToast('Webinar excluído.')
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
            <ChevronLeft className="w-4 h-4" /> Meus webinars
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <Presentation className="w-4 h-4 text-rl-purple" />
            <h2 className="text-base font-black text-rl-text">{editing.nome}</h2>
          </div>
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
            <h3 className="text-base font-bold text-rl-text">Etapa &ldquo;{etapaMeta.label}&rdquo;</h3>
            <p className="text-sm text-rl-muted mt-1 max-w-md mx-auto">
              Esta etapa ainda está em construção. Em breve você poderá preencher os blocos dela aqui.
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
          <h2 className="text-xl font-black text-rl-text leading-tight">Criação de Webinar</h2>
          <p className="text-sm text-rl-subtle mt-0.5 max-w-2xl">
            Construa webinars de conversão etapa por etapa. Cada webinar tem Abertura, História,
            Conteúdo e Ofertas. Você pode criar quantos webinars quiser.
          </p>
        </div>
        <button
          onClick={createWebinar}
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-rl-purple text-white shadow-glow hover:bg-rl-purple/90 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" /> Novo webinar
        </button>
      </div>

      {webinars.length === 0 ? (
        <div className="rounded-xl border border-dashed border-rl-border bg-rl-surface/30 py-12 px-6 text-center space-y-3">
          <Presentation className="w-9 h-9 text-rl-muted/40 mx-auto" />
          <div>
            <p className="text-sm font-semibold text-rl-text">Nenhum webinar criado ainda.</p>
            <p className="text-xs text-rl-muted mt-1">Crie o primeiro pra começar a preencher as etapas.</p>
          </div>
          <button
            onClick={createWebinar}
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-rl-purple text-white shadow-glow hover:bg-rl-purple/90 transition-all"
          >
            <Plus className="w-4 h-4" /> Criar primeiro webinar
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
                      onClick={() => { setRenamingId(w.id); setRenameValue(w.nome) }}
                      className="p-1.5 rounded-lg text-rl-muted hover:text-rl-purple hover:bg-rl-purple/10 transition-all"
                      title="Renomear"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteWebinar(w.id)}
                      className="p-1.5 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-rl-muted mb-1">
                    <span>Abertura</span>
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
                  Abrir webinar <ChevronRight className="w-3.5 h-3.5" />
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
  return <BlocoList blocos={ABERTURA_BLOCOS} data={data} onChange={onChange} />
}

// ─── Lista de blocos genérica (reusada por Abertura e História) ───────────────
function BlocoList({ blocos, data, onChange }) {
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
              <p className="text-[10px] font-bold uppercase tracking-wider text-rl-purple">Use as fórmulas</p>
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
  const tipo = data.tipo || ''
  return (
    <div className="space-y-4">
      {/* Regras de ouro */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-black text-rl-text uppercase tracking-wide mb-3">Regras de ouro da história</h3>
        <p className="text-xs text-rl-muted mb-3">
          História de 5-10 min que gera CONEXÃO e CONFIANÇA pra aumentar a conversão.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl bg-rl-green/5 border border-rl-green/30 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rl-green mb-2">✓ O que fazer</p>
            <ul className="space-y-1">
              {HISTORIA_REGRAS.fazer.map((r, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11px] text-rl-subtle">
                  <Check className="w-3 h-3 text-rl-green mt-0.5 shrink-0" /> {r}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-red-400/5 border border-red-400/30 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-400 mb-2">✗ O que NÃO fazer</p>
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
          <h3 className="text-sm font-black text-rl-text uppercase tracking-wide">Defina seu tipo de história</h3>
          <p className="text-xs text-rl-muted mt-0.5">Escolha o que se aplica a você — isso libera a estrutura certa abaixo.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {HISTORIA_TIPOS.map((t) => {
            const active = tipo === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChange('tipo', t.id)}
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
                  <span className="text-[10px] font-black uppercase tracking-wider text-rl-purple">Opção {t.id}</span>
                </div>
                <p className={`text-sm font-bold ${active ? 'text-rl-purple' : 'text-rl-text'}`}>{t.label}</p>
                <p className="text-[11px] text-rl-subtle mt-1 leading-snug">{t.desc}</p>
                <p className="text-[10px] text-rl-muted mt-2 italic">Ex: {t.example}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Etapa 2: transições */}
      <div className="glass-card p-5 space-y-4">
        <div>
          <h3 className="text-sm font-black text-rl-text uppercase tracking-wide">Escolha sua transição</h3>
          <p className="text-xs text-rl-muted mt-0.5">Como você vai ENTRAR na história. Preencha a que vai usar.</p>
        </div>
        {HISTORIA_TRANSICOES.map((tr) => (
          <div key={tr.id} className="rounded-xl border border-rl-border p-3 space-y-2">
            <div>
              <p className="text-xs font-bold text-rl-text">{tr.title}</p>
              <p className="text-[10px] text-rl-muted">{tr.hint}</p>
            </div>
            <FieldRenderer field={tr.field} data={data} onChange={onChange} />
            <div className="rounded-lg bg-rl-purple/5 border border-rl-purple/20 p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rl-purple mb-0.5">💡 Sua transição fica</p>
              <p className="text-xs text-rl-text leading-snug">{tr.compute(data || {})}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Etapa 3: estrutura condicional */}
      {tipo === 'A' && (
        <>
          <SectionDivider label="Estrutura — Avatar Transformado" />
          <BlocoList blocos={HISTORIA_3A_BLOCOS} data={data} onChange={onChange} />
        </>
      )}
      {tipo === 'B' && (
        <>
          <SectionDivider label="Estrutura — Socorrista" />
          <BlocoList blocos={HISTORIA_3B_BLOCOS} data={data} onChange={onChange} />
        </>
      )}
      {!tipo && (
        <div className="rounded-xl border border-dashed border-rl-border bg-rl-surface/30 p-6 text-center">
          <p className="text-sm text-rl-muted">
            Escolha o <strong>tipo de história</strong> acima pra liberar a estrutura de blocos (3A ou 3B).
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
  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-black text-rl-text uppercase tracking-wide mb-1">{titulo}</h3>
      {descricao && <p className="text-xs text-rl-muted mb-3">{descricao}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-rl-green/5 border border-rl-green/30 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-rl-green mb-2">✓ O que fazer</p>
          <ul className="space-y-1">
            {fazer.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px] text-rl-subtle">
                <Check className="w-3 h-3 text-rl-green mt-0.5 shrink-0" /> {r}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl bg-red-400/5 border border-red-400/30 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-red-400 mb-2">✗ O que NÃO fazer</p>
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
  const tema = data.tema || ''
  const temaMeta = CONTEUDO_TEMAS.find((t) => t.id === tema) || null
  const transAtiva = data.transicao_oferta || ''

  return (
    <div className="space-y-4">
      {/* 3 níveis de convencimento */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-black text-rl-text uppercase tracking-wide mb-1">Os 3 níveis de convencimento</h3>
        <p className="text-xs text-rl-muted mb-3">Seu conteúdo precisa estar no NÍVEL 3.</p>
        <div className="space-y-2">
          {CONTEUDO_NIVEIS.map((n) => {
            const cls = n.tone === 'green'
              ? { box: 'bg-rl-green/5 border-rl-green/30', txt: 'text-rl-green' }
              : n.tone === 'gold'
                ? { box: 'bg-rl-gold/5 border-rl-gold/30', txt: 'text-rl-gold' }
                : { box: 'bg-red-400/5 border-red-400/30', txt: 'text-red-400' }
            return (
              <div key={n.nivel} className={`rounded-xl border p-3 ${cls.box}`}>
                <p className={`text-xs font-bold ${cls.txt}`}>Nível {n.nivel} — {n.label}</p>
                <p className="text-[11px] text-rl-subtle mt-0.5">{n.text}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Regras de ouro */}
      <RulesCard
        titulo="Regras de ouro do conteúdo"
        fazer={CONTEUDO_REGRAS.fazer}
        naoFazer={CONTEUDO_REGRAS.naoFazer}
      />

      {/* Etapa 1 */}
      <BlocoList blocos={CONTEUDO_ETAPA1} data={data} onChange={onChange} />

      {/* Etapa 2: tema */}
      <div className="glass-card p-5 space-y-3">
        <div>
          <h3 className="text-sm font-black text-rl-text uppercase tracking-wide">ETAPA 2: Tema da aula</h3>
          <p className="text-xs text-rl-muted mt-0.5">Escolha a estrutura — libera os campos certos abaixo.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {CONTEUDO_TEMAS.map((t) => {
            const active = tema === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChange('tema', t.id)}
                className={`text-left rounded-xl border-2 p-3 transition-all ${
                  active ? 'bg-rl-purple/10 border-rl-purple/60 shadow-glow' : 'bg-rl-surface border-rl-border hover:border-rl-purple/30'
                }`}
              >
                <span className="text-[10px] font-black uppercase tracking-wider text-rl-purple">Opção {t.id}</span>
                <p className={`text-xs font-bold mt-0.5 ${active ? 'text-rl-purple' : 'text-rl-text'}`}>{t.label}</p>
                <p className="text-[10px] text-rl-muted mt-1">{t.desc}</p>
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
        <h3 className="text-sm font-black text-rl-text uppercase tracking-wide mb-2">ETAPA 3: Validando o conteúdo</h3>
        <p className="text-xs text-rl-muted mb-3">Pra cada tópico que você vai ensinar, confira:</p>
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
      <SectionDivider label="ETAPA 7: Roteiro do conteúdo" />
      <div className="glass-card p-5 space-y-3">
        <FieldRenderer field={CONTEUDO_ROTEIRO_ABERTURA} data={data} onChange={onChange} />
      </div>
      {tema === 'A' && <BlocoList blocos={CONTEUDO_ROTEIRO_PILARES} data={data} onChange={onChange} />}
      {(tema === 'B' || tema === 'C') && <BlocoList blocos={CONTEUDO_ROTEIRO_PONTOS} data={data} onChange={onChange} />}
      {!tema && (
        <div className="rounded-xl border border-dashed border-rl-border bg-rl-surface/30 p-4 text-center">
          <p className="text-xs text-rl-muted">Escolha o <strong>tema da aula</strong> (Etapa 2) pra liberar a estrutura do roteiro.</p>
        </div>
      )}

      {/* Etapa 8: tipos de slides (guia) */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-black text-rl-text uppercase tracking-wide mb-3">ETAPA 8: Tipos de slides</h3>
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
          <h3 className="text-sm font-black text-rl-text uppercase tracking-wide">ETAPA 10: Transição para oferta</h3>
          <p className="text-xs text-rl-muted mt-0.5">Escolha um modelo e adapte abaixo.</p>
        </div>
        <div className="space-y-2">
          {CONTEUDO_TRANSICOES.map((t) => {
            const active = transAtiva === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChange('transicao_oferta', active ? '' : t.id)}
                className={`w-full text-left rounded-xl border p-3 transition-all ${
                  active ? 'bg-rl-purple/10 border-rl-purple/50' : 'bg-rl-surface border-rl-border hover:border-rl-purple/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${active ? 'border-rl-purple bg-rl-purple' : 'border-rl-border'}`}>
                    {active && <Check className="w-2.5 h-2.5 text-white" />}
                  </span>
                  <span className="text-xs font-bold text-rl-text">{t.titulo}</span>
                </div>
                <p className="text-[11px] text-rl-subtle italic pl-6">{t.texto}</p>
              </button>
            )
          })}
        </div>
        <FieldRenderer
          field={{ id: 'c_transicao_final', type: 'area', label: 'Sua transição (adapte o modelo escolhido)' }}
          data={data}
          onChange={onChange}
        />
      </div>

      {/* Checklist final */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-black text-rl-text uppercase tracking-wide mb-3">Checklist final do conteúdo</h3>
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
  return (
    <div className="space-y-4">
      {/* Lista das 10 etapas */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-black text-rl-text uppercase tracking-wide mb-1">As 10 etapas da oferta de agendamento</h3>
        <p className="text-xs text-rl-muted mb-3">Objetivo: converter o webinar em aplicações para reunião de demonstração.</p>
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
      <SectionDivider label="ETAPA 9: Responder objeções + CTA" />
      <p className="text-xs text-rl-muted -mt-2">Estrutura de cada resposta: Pergunta → Resposta → CTA para agendar.</p>
      <div className="space-y-3">
        {OA_OBJECOES_FIXAS.map((obj) => (
          <div key={obj.n} className="glass-card p-4 space-y-2">
            <p className="text-sm font-bold text-rl-text">
              <span className="text-rl-purple">Objeção {obj.n}:</span> &ldquo;{obj.pergunta}&rdquo;
            </p>
            <FieldRenderer
              field={{ id: `oa_obj${obj.n}_resp`, type: 'area', label: 'Sua resposta' }}
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
            <p className="text-sm font-bold text-rl-purple">Objeção {n} (específica do seu nicho)</p>
            <FieldRenderer
              field={{ id: `oa_obj${n}_pergunta`, type: 'text', label: 'A objeção' }}
              data={data}
              onChange={onChange}
            />
            <FieldRenderer
              field={{ id: `oa_obj${n}_resp`, type: 'area', label: 'Sua resposta' }}
              data={data}
              onChange={onChange}
            />
            <FieldRenderer
              field={{ id: `oa_obj${n}_cta`, type: 'text', label: 'CTA para agendar' }}
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
                <span className="italic">&ldquo;{opt}&rdquo;</span>
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
        {f.example && <p className="text-[11px] text-rl-muted mb-2 italic">Exemplo: {f.example}</p>}
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
      {f.example && <p className="text-[11px] text-rl-muted mb-1.5 italic">Exemplo: {f.example}</p>}
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
