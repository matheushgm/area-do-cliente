import { useEffect, useState, useCallback } from 'react'
import { FlaskConical, X, Loader2, CheckCircle2, AlertTriangle, Clock, Play } from 'lucide-react'
import Modal from '../UI/Modal'
import { supabase } from '../../lib/supabase'

// Contas liberadas no PILOTO (escrita no Meta) — espelha o guardrail do motor.
const PILOT_ACCOUNTS = [
  { id: 'act_5346279295414773', label: 'Grupo AJ' },
  { id: 'act_1307754696082194', label: 'Matheus Business' },
]

// Dica de campanhas ativas (datalist) por conta — o motor resolve por nome.
const CAMPAIGN_HINTS = {
  act_5346279295414773: [
    'MEIO_CBO_LEADS_Diagnostico_Maturidade_BIM_Construtoras',
    'AF_FUNDO_CAPTACAO_LEADS_AUTO_F_BIM_MQL_2',
    'AF_FUNDO_CAPTACAO_LEADS_AUTO_F_REVIT_MQL_NOVA',
    'AJ | Topo | Visitas ao perfil l Conteudos',
    'AJ l Forms l ABO l Vaga de estagio',
  ],
}

const STATUS_LABEL = {
  queued: { t: 'Na fila', Icon: Clock, c: 'text-rl-muted' },
  publishing: { t: 'Publicando…', Icon: Loader2, c: 'text-rl-cyan' },
  paused_ready: { t: 'Pronto p/ ativar (pausado)', Icon: CheckCircle2, c: 'text-rl-gold' },
  active: { t: 'Ativo', Icon: CheckCircle2, c: 'text-rl-green' },
  evaluating: { t: 'Avaliando', Icon: Clock, c: 'text-rl-cyan' },
  evaluated: { t: 'Avaliado', Icon: CheckCircle2, c: 'text-rl-green' },
  error: { t: 'Erro', Icon: AlertTriangle, c: 'text-rl-red' },
}

export default function CreativeTestModal({ project, onClose, onToast }) {
  const [accountId, setAccountId] = useState(PILOT_ACCOUNTS[0].id)
  const [campaign, setCampaign] = useState('')
  const [driveLink, setDriveLink] = useState('')
  const [label, setLabel] = useState('')
  const [adsetMode, setAdsetMode] = useState('new')
  const [budget, setBudget] = useState('35')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)
  const [tests, setTests] = useState([])
  const [activating, setActivating] = useState(null)

  const loadTests = useCallback(async () => {
    const { data } = await supabase
      .from('creative_tests')
      .select('id,campaign_name,status,verdict,ad_id,error_msg,created_at')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
      .limit(10)
    setTests(data || [])
  }, [project.id])

  useEffect(() => { loadTests() }, [loadTests])

  const submit = async () => {
    setErr(null)
    if (!driveLink.trim()) return setErr('Cole o link público do criativo no Drive.')
    if (!campaign.trim()) return setErr('Escolha/digite a campanha ativa de destino.')
    setSaving(true)
    try {
      // 1. grava o teste na fila (RLS: authenticated)
      const row = {
        project_id: project.id,
        account_id: accountId,
        drive_link: driveLink.trim(),
        creative_label: label.trim() || null,
        campaign_name: campaign.trim(),
        adset_mode: adsetMode,
        daily_budget: adsetMode === 'new' ? Math.round(parseFloat(budget || '0') * 100) || null : null,
      }
      const { error: insErr } = await supabase.from('creative_tests').insert(row)
      if (insErr) throw new Error(insErr.message)

      // 2. dispara o motor (workflow_dispatch) com o JWT da sessão
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/launch-creative', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      })
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e.error?.message || ('HTTP ' + r.status))
      }
      onToast?.('Teste enviado! Publicando na nuvem (~1-2 min) — sobe PAUSADO.')
      setDriveLink(''); setLabel('')
      await loadTests()
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  const activate = async (testId) => {
    setActivating(testId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/activate-ad', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token || ''}`, 'content-type': 'application/json' },
        body: JSON.stringify({ test_id: testId }),
      })
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e.error?.message || ('HTTP ' + r.status))
      }
      onToast?.('Anúncio ativado! Veredito automático em 7 dias.')
      await loadTests()
    } catch (e) {
      onToast?.(e.message, 'error')
    } finally {
      setActivating(null)
    }
  }

  const hints = CAMPAIGN_HINTS[accountId] || []

  return (
    <Modal onClose={onClose} maxWidth="lg">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rl-purple/10 flex items-center justify-center shrink-0">
            <FlaskConical className="w-5 h-5 text-rl-purple" />
          </div>
          <div>
            <h3 className="text-lg font-black text-rl-text leading-tight">Subir teste no Meta</h3>
            <p className="text-xs text-rl-subtle">Sobe o criativo PAUSADO numa campanha ativa. Você ativa depois com 1 clique.</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface" aria-label="Fechar">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-rl-muted">
            Conta (piloto)
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}
              className="mt-1 w-full bg-rl-surface border border-rl-border rounded-lg px-3 py-2 text-sm text-rl-text">
              {PILOT_ACCOUNTS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-rl-muted">
            Identificação (opcional)
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex.: VID_gancho_dor"
              className="mt-1 w-full bg-rl-surface border border-rl-border rounded-lg px-3 py-2 text-sm text-rl-text" />
          </label>
        </div>

        <label className="block text-xs font-semibold text-rl-muted">
          Campanha ativa de destino
          <input list="camp-hints" value={campaign} onChange={(e) => setCampaign(e.target.value)}
            placeholder="nome exato da campanha ativa"
            className="mt-1 w-full bg-rl-surface border border-rl-border rounded-lg px-3 py-2 text-sm text-rl-text" />
          <datalist id="camp-hints">{hints.map((h) => <option key={h} value={h} />)}</datalist>
        </label>

        <label className="block text-xs font-semibold text-rl-muted">
          Link do criativo no Drive <span className="text-rl-subtle font-normal">(precisa estar &quot;Qualquer pessoa com o link&quot;)</span>
          <input value={driveLink} onChange={(e) => setDriveLink(e.target.value)} placeholder="https://drive.google.com/file/d/..."
            className="mt-1 w-full bg-rl-surface border border-rl-border rounded-lg px-3 py-2 text-sm text-rl-text" />
        </label>

        <div className="grid grid-cols-2 gap-3 items-end">
          <label className="text-xs font-semibold text-rl-muted">
            Conjunto
            <select value={adsetMode} onChange={(e) => setAdsetMode(e.target.value)}
              className="mt-1 w-full bg-rl-surface border border-rl-border rounded-lg px-3 py-2 text-sm text-rl-text">
              <option value="new">Novo conjunto (teste 1:1)</option>
              <option value="same">Mesmo conjunto (referência)</option>
            </select>
          </label>
          {adsetMode === 'new' && (
            <label className="text-xs font-semibold text-rl-muted">
              Orçamento/dia (R$) <span className="text-rl-subtle font-normal">— só ABO</span>
              <input type="number" min="1" value={budget} onChange={(e) => setBudget(e.target.value)}
                className="mt-1 w-full bg-rl-surface border border-rl-border rounded-lg px-3 py-2 text-sm text-rl-text" />
            </label>
          )}
        </div>

        {err && <p className="text-xs text-rl-red flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />{err}</p>}

        <button onClick={submit} disabled={saving}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
          {saving ? 'Enviando…' : 'Subir teste (pausado)'}
        </button>
      </div>

      {/* Testes recentes deste cliente */}
      {tests.length > 0 && (
        <div className="mt-5 pt-4 border-t border-rl-border">
          <p className="text-xs font-bold text-rl-muted mb-2">Testes recentes</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {tests.map((t) => {
              const s = STATUS_LABEL[t.status] || STATUS_LABEL.queued
              return (
                <div key={t.id} className="flex items-center gap-2 text-xs bg-rl-surface rounded-lg px-3 py-2">
                  <s.Icon className={`w-3.5 h-3.5 shrink-0 ${s.c} ${t.status === 'publishing' ? 'animate-spin' : ''}`} />
                  <span className="flex-1 truncate text-rl-text">{t.campaign_name}</span>
                  <span className={s.c}>{s.t}</span>
                  {t.verdict && <span className={t.verdict === 'good' ? 'text-rl-green' : 'text-rl-red'}>{t.verdict === 'good' ? '👍 bom' : '👎 ruim'}</span>}
                  {t.error_msg && <span className="text-rl-red truncate max-w-[120px]" title={t.error_msg}>{t.error_msg}</span>}
                  {t.status === 'paused_ready' && (
                    <button
                      onClick={() => activate(t.id)}
                      disabled={activating === t.id}
                      className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md bg-rl-green/15 text-rl-green font-semibold hover:bg-rl-green/25 disabled:opacity-50"
                    >
                      {activating === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                      Ativar
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          <button onClick={loadTests} className="mt-2 text-xs text-rl-cyan hover:underline">↻ atualizar status</button>
        </div>
      )}
    </Modal>
  )
}
