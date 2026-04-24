import { useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  Rocket, TrendingUp, Award, CheckCircle2, ChevronRight,
  Star, MessageSquare, BarChart2, ThumbsUp, ThumbsDown,
  Minus, RotateCcw, Send, Clock, Link2, Check,
  Plus, Users, Phone, Mail, User,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const MARCOS = [
  {
    id: 'marco1', num: '01', title: 'Pós-Onboarding', description: 'Após a primeira campanha ir ao ar',
    icon: Rocket, color: 'purple',
    tw: { text: 'text-rl-purple', bg: 'bg-rl-purple/10', border: 'border-rl-purple/25', badge: 'bg-rl-purple text-white', btn: 'bg-rl-purple hover:bg-rl-purple/90 text-white' },
  },
  {
    id: 'marco2', num: '02', title: 'Primeiros 3 Meses', description: '90 dias de parceria',
    icon: TrendingUp, color: 'blue',
    tw: { text: 'text-rl-blue', bg: 'bg-rl-blue/10', border: 'border-rl-blue/25', badge: 'bg-rl-blue text-white', btn: 'bg-rl-blue hover:bg-rl-blue/90 text-white' },
  },
  {
    id: 'marco3', num: '03', title: '6 Meses', description: 'Meio ano de parceria',
    icon: Award, color: 'gold',
    tw: { text: 'text-rl-gold', bg: 'bg-rl-gold/10', border: 'border-rl-gold/25', badge: 'bg-rl-gold text-rl-bg', btn: 'bg-rl-gold hover:bg-rl-gold/90 text-rl-bg' },
  },
]

const Q3_OPTIONS = ['Ruim', 'Regular', 'Bom', 'Excelente']
const Q4_OPTIONS = ['Sim, dentro do esperado', 'Parcialmente', 'Não, abaixo do esperado']
const Q5_OPTIONS = ['Sim, tenho clareza total', 'Às vezes fico com dúvidas', 'Não, sinto falta de mais transparência']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNPSCategory(score) {
  if (score <= 6) return { label: 'Detrator', color: 'text-red-400',  bg: 'bg-red-400/10',  border: 'border-red-400/20',  Icon: ThumbsDown }
  if (score <= 8) return { label: 'Neutro',   color: 'text-rl-gold',  bg: 'bg-rl-gold/10',  border: 'border-rl-gold/20',  Icon: Minus      }
  return              { label: 'Promotor', color: 'text-rl-green', bg: 'bg-rl-green/10', border: 'border-rl-green/20', Icon: ThumbsUp   }
}

function getActionLabel(score) {
  if (score <= 6) return { text: 'Account manager entra em contato em até 24h para entender e reverter.', color: 'text-red-400', bg: 'bg-red-400/5', border: 'border-red-400/15' }
  if (score <= 8) return { text: 'Agendar alinhamento estratégico no próximo ciclo.', color: 'text-rl-gold', bg: 'bg-rl-gold/5', border: 'border-rl-gold/15' }
  return              { text: 'Solicitar depoimento ou case ao cliente.', color: 'text-rl-green', bg: 'bg-rl-green/5', border: 'border-rl-green/15' }
}

function getQ2Label(score) {
  if (score <= 6) return 'O que fez você dar essa nota? O que precisaria mudar para você se sentir bem atendido?'
  if (score <= 8) return 'O que está faltando para a nossa parceria ser excelente na sua visão?'
  return 'O que mais te surpreendeu positivamente na nossa parceria até agora?'
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Backward compat: old format was a single object, new format is an array
function getResponses(nps, marcoId) {
  const val = nps?.[marcoId]
  if (!val) return []
  if (Array.isArray(val)) return val.filter(r => r?.submittedAt)
  if (val?.submittedAt) return [val]
  return []
}

// ─── Radio Option ─────────────────────────────────────────────────────────────

function RadioOption({ label, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
        selected
          ? 'bg-rl-purple/10 border-rl-purple/40 text-rl-purple'
          : 'bg-rl-surface border-rl-border text-rl-muted hover:border-rl-muted/50 hover:text-rl-text'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${selected ? 'border-rl-purple' : 'border-rl-border'}`}>
          {selected && <div className="w-2 h-2 rounded-full bg-rl-purple" />}
        </div>
        {label}
      </div>
    </button>
  )
}

// ─── NPS Form (admin — inclui campo de respondente) ──────────────────────────

function NPSForm({ marco, onSubmit, onCancel }) {
  const [respondentName, setRespondentName] = useState('')
  const [step, setStep]     = useState(0)
  const [form, setForm]     = useState({ score: null, q2: '', q3: '', q4: '', q5: '', q6: '' })
  const [saving, setSaving] = useState(false)

  const category = form.score !== null ? getNPSCategory(form.score) : null
  const tw = marco.tw

  const handleSubmit = async () => {
    setSaving(true)
    await onSubmit({
      name: respondentName.trim() || 'Sem nome',
      ...form,
      submittedAt: new Date().toISOString(),
    })
    setSaving(false)
  }

  return (
    <div className="space-y-5">

      {/* Respondente */}
      <div>
        <label className="text-[10px] font-bold text-rl-muted uppercase tracking-wide block mb-1.5">
          <User className="w-3 h-3 inline mr-1" />Respondente
        </label>
        <input
          value={respondentName}
          onChange={(e) => setRespondentName(e.target.value)}
          placeholder="Nome de quem está respondendo"
          className="input-field text-sm w-full"
        />
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {['Nota', 'Diagnóstico', 'Avaliação', 'Encerramento'].map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold transition-all ${
              i < step ? 'bg-rl-green text-white' : i === step ? tw.badge : 'bg-rl-surface text-rl-muted border border-rl-border'
            }`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`text-[11px] font-medium hidden sm:block ${i === step ? tw.text : 'text-rl-muted'}`}>{s}</span>
            {i < 3 && <ChevronRight className="w-3 h-3 text-rl-border shrink-0" />}
          </div>
        ))}
      </div>

      {/* Step 0 — Nota */}
      {step === 0 && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-rl-text mb-1">Em uma escala de 0 a 10, qual a probabilidade de você indicar a Revenue Lab para outro empresário?</p>
            <p className="text-xs text-rl-muted">0 = Jamais indicaria · 10 = Indicaria com certeza</p>
          </div>
          <div className="grid grid-cols-11 gap-1.5">
            {[0,1,2,3,4,5,6,7,8,9,10].map((n) => {
              const c = getNPSCategory(n)
              const sel = form.score === n
              return (
                <button key={n} onClick={() => setForm(f => ({ ...f, score: n }))}
                  className={`h-10 rounded-xl text-sm font-bold transition-all border ${
                    sel ? `${c.bg} ${c.border} ${c.color} shadow-sm scale-105` : 'bg-rl-surface border-rl-border text-rl-muted hover:border-rl-muted/50 hover:text-rl-text'
                  }`}>
                  {n}
                </button>
              )
            })}
          </div>
          {category && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium ${category.bg} ${category.border} ${category.color}`}>
              <category.Icon className="w-4 h-4 shrink-0" />
              Nota {form.score} — {category.label}
            </div>
          )}
          <div className="flex justify-end">
            <button onClick={() => setStep(1)} disabled={form.score === null}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${tw.btn} disabled:opacity-40 disabled:cursor-not-allowed`}>
              Próximo <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 1 — Diagnóstico */}
      {step === 1 && (
        <div className="space-y-4">
          <div className={`px-3 py-2 rounded-xl border text-xs font-medium ${getNPSCategory(form.score).bg} ${getNPSCategory(form.score).border} ${getNPSCategory(form.score).color}`}>
            Nota {form.score} — {category.label}
          </div>
          <div>
            <p className="text-sm font-semibold text-rl-text mb-3">{getQ2Label(form.score)}</p>
            <textarea value={form.q2} onChange={(e) => setForm(f => ({ ...f, q2: e.target.value }))}
              placeholder="Escreva aqui..." rows={4} autoFocus className="input-field resize-none text-sm leading-relaxed w-full" />
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(0)} className="text-sm text-rl-muted hover:text-rl-text transition-colors flex items-center gap-1">
              <RotateCcw className="w-3.5 h-3.5" /> Voltar
            </button>
            <button onClick={() => setStep(2)} disabled={!form.q2.trim()}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${tw.btn} disabled:opacity-40 disabled:cursor-not-allowed`}>
              Próximo <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — Avaliação */}
      {step === 2 && (
        <div className="space-y-5">
          {[
            { q: 'Como você avalia a comunicação e o atendimento da equipe?', key: 'q3', opts: Q3_OPTIONS },
            { q: 'Os resultados das campanhas estão dentro do que foi combinado no início?', key: 'q4', opts: Q4_OPTIONS },
            { q: 'Você sente que entende o que está sendo feito e por quê?', key: 'q5', opts: Q5_OPTIONS },
          ].map(({ q, key, opts }) => (
            <div key={key} className="space-y-2">
              <p className="text-sm font-semibold text-rl-text">{q}</p>
              {opts.map(o => <RadioOption key={o} label={o} selected={form[key] === o} onClick={() => setForm(f => ({ ...f, [key]: o }))} />)}
            </div>
          ))}
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="text-sm text-rl-muted hover:text-rl-text transition-colors flex items-center gap-1">
              <RotateCcw className="w-3.5 h-3.5" /> Voltar
            </button>
            <button onClick={() => setStep(3)} disabled={!form.q3 || !form.q4 || !form.q5}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${tw.btn} disabled:opacity-40 disabled:cursor-not-allowed`}>
              Próximo <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Encerramento */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-rl-text mb-1">Tem algo que você gostaria que a gente soubesse e que não perguntamos aqui?</p>
            <p className="text-xs text-rl-muted mb-3">Campo opcional</p>
            <textarea value={form.q6} onChange={(e) => setForm(f => ({ ...f, q6: e.target.value }))}
              placeholder="Fique à vontade para comentar..." rows={4} autoFocus className="input-field resize-none text-sm leading-relaxed w-full" />
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="text-sm text-rl-muted hover:text-rl-text transition-colors flex items-center gap-1">
              <RotateCcw className="w-3.5 h-3.5" /> Voltar
            </button>
            <button onClick={handleSubmit} disabled={saving}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${tw.btn} disabled:opacity-60`}>
              {saving
                ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Salvando...</>
                : <><Send className="w-4 h-4" />Salvar resposta</>
              }
            </button>
          </div>
        </div>
      )}

      <div className="pt-1 border-t border-rl-border/40">
        <button onClick={onCancel} className="text-xs text-rl-muted hover:text-rl-text transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ─── Response Row (linha expansível de cada respondente) ──────────────────────

function ResponseRow({ response }) {
  const [expanded, setExpanded] = useState(false)
  const cat    = getNPSCategory(response.score)
  const action = getActionLabel(response.score)

  return (
    <div className="border border-rl-border/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-rl-surface/60 transition-colors text-left"
      >
        {/* Score */}
        <div className={`w-9 h-9 rounded-lg shrink-0 flex items-center justify-center text-sm font-black border ${cat.bg} ${cat.border}`}>
          <span className={cat.color}>{response.score}</span>
        </div>
        {/* Name + date */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-rl-text truncate">{response.name || 'Anônimo'}</p>
          {response.email && <p className="text-xs text-rl-muted truncate">{response.email}</p>}
        </div>
        {/* Category + date + chevron */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border hidden sm:inline ${cat.bg} ${cat.border} ${cat.color}`}>
            {cat.label}
          </span>
          <span className="text-[10px] text-rl-muted hidden sm:inline flex items-center gap-1">
            <Clock className="w-3 h-3 inline" /> {fmtDate(response.submittedAt)}
          </span>
          <ChevronRight className={`w-3.5 h-3.5 text-rl-muted transition-transform shrink-0 ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-rl-border/30 px-4 py-4 space-y-3 bg-rl-surface/40">
          {/* Contact */}
          {(response.email || response.phone) && (
            <div className="flex flex-wrap gap-4">
              {response.email && (
                <span className="flex items-center gap-1.5 text-xs text-rl-muted">
                  <Mail className="w-3 h-3 shrink-0" /> {response.email}
                </span>
              )}
              {response.phone && (
                <span className="flex items-center gap-1.5 text-xs text-rl-muted">
                  <Phone className="w-3 h-3 shrink-0" /> {response.phone}
                </span>
              )}
            </div>
          )}
          {/* Action */}
          <div className={`px-3 py-2 rounded-lg border text-xs leading-relaxed ${action.bg} ${action.border} ${action.color}`}>
            <span className="font-semibold">Ação recomendada: </span>{action.text}
          </div>
          {/* Q2 */}
          {response.q2 && (
            <div className="glass-card p-3">
              <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wide mb-1 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> Diagnóstico
              </p>
              <p className="text-sm text-rl-text leading-relaxed">{response.q2}</p>
            </div>
          )}
          {/* Q3/Q4/Q5 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { label: 'Comunicação',  val: response.q3 },
              { label: 'Resultados',   val: response.q4 },
              { label: 'Transparência', val: response.q5 },
            ].filter(({ val }) => val).map(({ label, val }) => (
              <div key={label} className="glass-card p-2.5">
                <p className="text-[9px] font-bold text-rl-muted uppercase tracking-wide mb-0.5">{label}</p>
                <p className="text-xs text-rl-text font-medium leading-snug">{val}</p>
              </div>
            ))}
          </div>
          {/* Q6 */}
          {response.q6 && (
            <div className="glass-card p-3">
              <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wide mb-1 flex items-center gap-1">
                <Star className="w-3 h-3" /> Comentário adicional
              </p>
              <p className="text-sm text-rl-text leading-relaxed">{response.q6}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Marco Card ───────────────────────────────────────────────────────────────

function MarcoCard({ marco, responses, onAddResponse, onClearAll, onCopyLink, isCopied }) {
  const [open, setOpen]         = useState(false)
  const [addingNew, setAddingNew] = useState(false)
  const Icon  = marco.icon
  const tw    = marco.tw
  const count = responses.length
  const hasResponses = count > 0
  const avgScore = hasResponses
    ? (responses.reduce((a, r) => a + r.score, 0) / count).toFixed(1)
    : null

  return (
    <div className={`glass-card overflow-hidden border ${hasResponses ? 'border-rl-green/20' : tw.border}`}>
      {/* Header */}
      <div
        className={`px-5 py-4 flex items-center justify-between cursor-pointer select-none ${hasResponses ? 'bg-rl-green/5' : tw.bg}`}
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
            hasResponses ? 'bg-rl-green/10 border-rl-green/20' : `${tw.bg} ${tw.border}`
          }`}>
            <Icon className={`w-4 h-4 ${hasResponses ? 'text-rl-green' : tw.text}`} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${hasResponses ? 'text-rl-green' : tw.text}`}>
                Marco {marco.num}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                hasResponses
                  ? 'bg-rl-green/15 text-rl-green border-rl-green/20'
                  : `${tw.bg} ${tw.border} ${tw.text}`
              }`}>
                {count} resposta{count !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-sm font-semibold text-rl-text">{marco.title}</p>
            <p className="text-xs text-rl-muted">{marco.description}</p>
          </div>
        </div>

        {/* Right side — stop propagation to avoid toggling card */}
        <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
          {avgScore && (
            <div className="text-right mr-1">
              <p className="text-xl font-black text-rl-text leading-none">{avgScore}</p>
              <p className="text-[9px] text-rl-muted">média</p>
            </div>
          )}
          <button
            onClick={onCopyLink}
            title="Copiar link para o cliente"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              isCopied
                ? 'bg-rl-green/10 border-rl-green/30 text-rl-green'
                : 'bg-rl-surface border-rl-border text-rl-muted hover:border-rl-gold/40 hover:text-rl-gold'
            }`}
          >
            {isCopied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
            {isCopied ? 'Copiado!' : 'Copiar link'}
          </button>
          <button
            onClick={() => { setOpen(true); setAddingNew(true) }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${tw.btn}`}
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar
          </button>
        </div>
      </div>

      {/* Body */}
      {open && (
        <div className="px-5 py-4 space-y-4">

          {/* Lista de respostas */}
          {hasResponses && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wide flex items-center gap-1.5">
                  <Users className="w-3 h-3" /> {count} respondente{count !== 1 ? 's' : ''}
                </p>
                <button
                  onClick={onClearAll}
                  className="text-[10px] text-red-400/70 hover:text-red-400 transition-colors"
                >
                  Limpar tudo
                </button>
              </div>
              {responses.map((r, i) => (
                <ResponseRow key={i} response={r} />
              ))}
            </div>
          )}

          {/* Formulário para nova resposta */}
          {addingNew ? (
            <div className={`${hasResponses ? 'border-t border-rl-border/40 pt-4' : ''}`}>
              {hasResponses && (
                <p className="text-xs font-bold text-rl-muted uppercase tracking-wide mb-4">Nova resposta</p>
              )}
              <NPSForm
                marco={marco}
                onSubmit={async (formData) => {
                  await onAddResponse(formData)
                  setAddingNew(false)
                }}
                onCancel={() => setAddingNew(false)}
              />
            </div>
          ) : !hasResponses ? (
            <div className="text-center py-6">
              <p className="text-sm text-rl-muted mb-3">Nenhuma resposta ainda.</p>
              <button
                onClick={() => setAddingNew(true)}
                className={`inline-flex items-center gap-2 text-sm font-semibold ${tw.text} hover:opacity-80 transition-opacity`}
              >
                <Plus className="w-4 h-4" /> Adicionar primeira resposta
              </button>
            </div>
          ) : null}

        </div>
      )}
    </div>
  )
}

// ─── NPS Summary Banner ───────────────────────────────────────────────────────

function NPSSummary({ nps }) {
  const allResponses = MARCOS.flatMap(m => getResponses(nps, m.id))
  if (allResponses.length === 0) return null

  const scores     = allResponses.map(r => r.score)
  const n          = scores.length
  const avg        = (scores.reduce((a, b) => a + b, 0) / n).toFixed(1)
  const promotores = scores.filter(s => s >= 9).length
  const detratores = scores.filter(s => s <= 6).length
  const npsScore   = Math.round(((promotores - detratores) / n) * 100)
  const marcosAtivos = MARCOS.filter(m => getResponses(nps, m.id).length > 0).length

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 className="w-4 h-4 text-rl-purple" />
        <p className="text-sm font-semibold text-rl-text">Visão Geral do NPS</p>
        <span className="text-xs text-rl-muted ml-auto">
          {n} resposta{n !== 1 ? 's' : ''} · {marcosAtivos} de {MARCOS.length} marcos
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="text-center">
          <p className="text-[10px] text-rl-muted mb-1">NPS Score</p>
          <p className={`text-2xl font-black ${npsScore >= 50 ? 'text-rl-green' : npsScore >= 0 ? 'text-rl-gold' : 'text-red-400'}`}>
            {npsScore > 0 ? `+${npsScore}` : npsScore}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-rl-muted mb-1">Média de notas</p>
          <p className="text-2xl font-black text-rl-text">{avg}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-rl-muted mb-1">Promotores</p>
          <p className="text-2xl font-black text-rl-green">{promotores}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-rl-muted mb-1">Detratores</p>
          <p className="text-2xl font-black text-red-400">{detratores}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NPSModule({ project }) {
  const { updateProject } = useApp()
  const [copiedMarco, setCopiedMarco] = useState(null)
  const nps = project.nps || {}

  const handleAddResponse = async (marcoId, formData) => {
    const current = getResponses(nps, marcoId)
    const updated = { ...nps, [marcoId]: [...current, formData] }
    updateProject(project.id, { nps: updated })
  }

  const handleClearAll = (marcoId) => {
    const updated = { ...nps, [marcoId]: [] }
    updateProject(project.id, { nps: updated })
  }

  const handleCopyLink = (marcoId) => {
    let token = project.clientShareToken || project.client_share_token
    if (!token) {
      token = crypto.randomUUID()
      updateProject(project.id, { clientShareToken: token })
    }
    const url = `${window.location.origin}/nps/${token}?marco=${marcoId}`
    navigator.clipboard.writeText(url)
    setCopiedMarco(marcoId)
    setTimeout(() => setCopiedMarco(null), 2500)
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-rl-text flex items-center gap-2">
          <Star className="w-5 h-5 text-rl-gold" />
          NPS — Satisfação do Cliente
        </h2>
        <p className="text-sm text-rl-muted mt-0.5">
          Copie o link de cada marco e envie aos participantes — cada pessoa preenche de forma independente
        </p>
      </div>

      {/* Summary */}
      <NPSSummary nps={nps} />

      {/* How it works */}
      <div className="glass-card p-4 space-y-3">
        <p className="text-xs font-bold text-rl-muted uppercase tracking-wide">Como usar as respostas</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-red-400/5 border border-red-400/15">
            <ThumbsDown className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-400">Nota 0–6 (Detrator)</p>
              <p className="text-rl-muted mt-0.5">Account manager entra em contato em até 24h para entender e reverter.</p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-rl-gold/5 border border-rl-gold/15">
            <Minus className="w-4 h-4 text-rl-gold shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rl-gold">Nota 7–8 (Neutro)</p>
              <p className="text-rl-muted mt-0.5">Agendar alinhamento estratégico no próximo ciclo.</p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-rl-green/5 border border-rl-green/15">
            <ThumbsUp className="w-4 h-4 text-rl-green shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rl-green">Nota 9–10 (Promotor)</p>
              <p className="text-rl-muted mt-0.5">Solicitar depoimento ou case ao cliente.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Marcos */}
      <div className="space-y-4">
        {MARCOS.map((marco) => (
          <MarcoCard
            key={marco.id}
            marco={marco}
            responses={getResponses(nps, marco.id)}
            onAddResponse={(formData) => handleAddResponse(marco.id, formData)}
            onClearAll={() => handleClearAll(marco.id)}
            onCopyLink={() => handleCopyLink(marco.id)}
            isCopied={copiedMarco === marco.id}
          />
        ))}
      </div>
    </div>
  )
}
