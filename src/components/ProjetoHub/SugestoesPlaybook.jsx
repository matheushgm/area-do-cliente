// Aba "Sugestões" do hub: otimizações recomendadas pelo playbook a partir dos
// dados do dashboard (últimos 7 dias vs. 7 anteriores). Aceitar abre o modal
// que cria a tarefa no ClickUp; descartar esconde por 14 dias.
import { useState, useMemo } from 'react'
import { Sparkles, Check, X, ChevronDown, ChevronRight, ExternalLink, Loader2, RefreshCw, AlertTriangle, RotateCcw, Kanban } from 'lucide-react'
import { PRIORIDADE_LABEL } from '../../lib/playbookSugestoes'
import { fmtBR, maxDate } from '../../lib/dashboardData'

const PRI_CLS = {
  urgente: 'bg-rl-red/10 text-rl-red border-rl-red/30',
  alta: 'bg-rl-gold/10 text-rl-gold border-rl-gold/30',
  media: 'fx-soft border-transparent',
}
const CANAL_LABEL = { meta: 'Meta Ads', google: 'Google Ads' }

function Sugestao({ s, onAceitar, onDescartar }) {
  const [aberta, setAberta] = useState(false)
  return (
    <div className="glass-card border border-rl-border/60 p-4">
      <div className="flex items-start gap-3">
        <button onClick={() => setAberta((v) => !v)} className="mt-0.5 p-0.5 rounded text-rl-muted hover:text-rl-text" aria-label="Detalhes">
          {aberta ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${PRI_CLS[s.prioridade]}`}>{PRIORIDADE_LABEL[s.prioridade]}</span>
            <span className="text-[11px] text-rl-muted">{CANAL_LABEL[s.canal] || s.canal}</span>
            <span className="text-[11px] text-rl-muted">· {s.tipo}</span>
          </div>
          <p className="text-sm font-semibold text-rl-text leading-snug">{s.titulo}</p>
          <p className="text-xs text-rl-subtle mt-1">{s.contexto}</p>
          {s.evidencias?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {s.evidencias.map((e) => (
                <span key={e.label} className="text-[11px] px-2 py-0.5 rounded-md bg-rl-surface border border-rl-border text-rl-subtle">
                  {e.label}: <span className="text-rl-text font-medium">{e.valor}</span>
                </span>
              ))}
            </div>
          )}
          {aberta && (
            <div className="mt-3 text-xs text-rl-subtle space-y-2">
              {s.passos?.length > 0 && (
                <ol className="list-decimal pl-4 space-y-0.5">
                  {s.passos.map((p, i) => <li key={i}>{p}</li>)}
                </ol>
              )}
              <p className="italic text-rl-muted">Regra do playbook: {s.regra}</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onAceitar(s)} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-rl-green/10 text-rl-green border border-rl-green/30 hover:bg-rl-green/20" title="Criar tarefa no ClickUp">
            <Check className="w-3.5 h-3.5" /> Aceitar
          </button>
          <button onClick={() => onDescartar(s)} className="p-1.5 rounded-lg text-rl-muted hover:text-rl-red hover:bg-rl-red/10" title="Descartar por 14 dias">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SugestoesPlaybook({ dash, sugestoes, decididas, onAceitar, onDescartar, onReabrir, onRecarregar }) {
  const [verDecididas, setVerDecididas] = useState(false)
  const { loading, error, raw } = dash
  const temDados = (raw?.meta?.length || 0) + (raw?.google?.length || 0) > 0
  const ultimoDia = useMemo(() => {
    const a = maxDate(raw?.meta || [], 'Dia'), b = maxDate(raw?.google || [], 'Data')
    return [a, b].filter(Boolean).sort().pop() || null
  }, [raw])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-rl-muted px-1">
        <Sparkles className="w-3.5 h-3.5 text-rl-purple" />
        <span>
          Regras do playbook aplicadas aos últimos 7 dias do dashboard
          {ultimoDia ? ` (até ${fmtBR(ultimoDia)})` : ''}, comparados com os 7 anteriores.
        </span>
        <button onClick={onRecarregar} className="ml-auto p-1 rounded-md hover:bg-rl-surface hover:text-rl-text" title="Recarregar dados"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>

      {loading && !temDados && (
        <div className="flex items-center gap-2 text-sm text-rl-muted py-8 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Lendo o dashboard de tráfego…</div>
      )}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-rl-red/10 border border-rl-red/30 text-xs text-rl-text"><AlertTriangle className="w-4 h-4 text-rl-red shrink-0" /> {String(error)}</div>
      )}
      {!loading && !error && !temDados && (
        <div className="text-center py-8">
          <p className="text-sm text-rl-subtle">Nenhuma conta de anúncio vinculada a este projeto no dashboard.</p>
          <p className="text-xs text-rl-muted mt-1">Vincule a conta em Dashboard de Tráfego → conta → projeto pra gerar sugestões.</p>
        </div>
      )}
      {temDados && sugestoes.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-rl-subtle">Nenhuma sugestão pendente. A conta está dentro das regras do playbook.</p>
        </div>
      )}
      {sugestoes.map((s) => <Sugestao key={s.chave} s={s} onAceitar={onAceitar} onDescartar={onDescartar} />)}

      {decididas.length > 0 && (
        <div className="pt-2">
          <button onClick={() => setVerDecididas((v) => !v)} className="flex items-center gap-1.5 text-xs text-rl-muted hover:text-rl-text px-1">
            {verDecididas ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            {decididas.length} sugestão{decididas.length > 1 ? 'ões' : ''} aceita{decididas.length > 1 ? 's' : ''} ou descartada{decididas.length > 1 ? 's' : ''}
          </button>
          {verDecididas && (
            <div className="mt-2 space-y-1.5">
              {decididas.map((d) => (
                <div key={d.chave} className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-rl-surface border border-rl-border/60">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${d.status === 'aceita' ? 'bg-rl-green/10 text-rl-green' : 'bg-rl-bg text-rl-muted'}`}>{d.status}</span>
                  <span className="flex-1 truncate text-rl-subtle">{d.titulo || d.chave}</span>
                  {d.clickup_task_url && <a href={d.clickup_task_url} target="_blank" rel="noreferrer" className="text-rl-purple flex items-center gap-1"><Kanban className="w-3 h-3" /> tarefa <ExternalLink className="w-3 h-3" /></a>}
                  {d.status === 'descartada' && <button onClick={() => onReabrir(d.chave)} className="text-rl-muted hover:text-rl-text flex items-center gap-1" title="Voltar a mostrar"><RotateCcw className="w-3 h-3" /> reabrir</button>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
