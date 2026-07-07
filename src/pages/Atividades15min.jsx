import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import AppSidebar from '../components/AppSidebar'
import Toast from '../components/UI/Toast'
import { useToast } from '../hooks/useToast'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import {
  Menu, Timer, ChevronLeft, ChevronRight, CalendarDays, Lock,
  Loader2, TrendingUp, Minus, TrendingDown,
} from 'lucide-react'

// ── Grade de blocos de 15 min (05:00 → 23:45) ────────────────────────────────
const START_HOUR = 5
const END_HOUR = 24 // exclusivo — último bloco começa 23:45
const pad = (n) => String(n).padStart(2, '0')

function buildSlots() {
  const slots = []
  for (let h = START_HOUR; h < END_HOUR; h++) {
    for (let m = 0; m < 60; m += 15) {
      const endTotal = h * 60 + m + 15
      const eh = Math.floor(endTotal / 60) % 24
      const em = endTotal % 60
      slots.push(`${pad(h)}:${pad(m)} - ${pad(eh)}:${pad(em)}`)
    }
  }
  return slots
}
const SLOTS = buildSlots()

// ── Prioridade: "mexe o ponteiro?" ───────────────────────────────────────────
const PRIORIDADES = [
  { id: 'alta',  label: 'Alta',  Icon: TrendingUp,   cls: 'text-rl-green bg-rl-green/15 border-rl-green/40',       dot: 'bg-rl-green' },
  { id: 'media', label: 'Média', Icon: Minus,        cls: 'text-rl-gold bg-rl-gold/15 border-rl-gold/40',         dot: 'bg-rl-gold' },
  { id: 'baixa', label: 'Baixa', Icon: TrendingDown, cls: 'text-red-400 bg-red-400/10 border-red-400/30',         dot: 'bg-red-400' },
]

const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fmtDiaLongo = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long',
  })
}

export default function Atividades15min() {
  const navigate = useNavigate()
  const { user } = useApp()
  const { toast, showToast } = useToast()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [dia, setDia] = useState(() => toISO(new Date()))
  const [loading, setLoading] = useState(true)
  // rows: { [intervalo]: { id, atividade, prioridade } }
  const [rows, setRows] = useState({})
  const saveTimers = useRef({})

  // ── Carregar o dia (RLS já restringe ao usuário logado) ────────────────────
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!supabase) { setLoading(false); return }
      setLoading(true)
      const { data, error } = await supabase
        .from('atividades_15min')
        .select('id, intervalo, atividade, prioridade')
        .eq('dia', dia)
      if (cancelled) return
      if (error) {
        console.error('[Atividades15min] load:', error.message)
        showToast('Erro ao carregar atividades', 'error')
        setRows({})
      } else {
        const map = {}
        for (const r of data || []) {
          map[r.intervalo] = { id: r.id, atividade: r.atividade || '', prioridade: r.prioridade || null }
        }
        setRows(map)
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [dia, showToast])

  // ── Persistência de uma linha (upsert / delete) ────────────────────────────
  const persist = useCallback(async (intervalo, next) => {
    if (!supabase || !user?.id) return
    const isEmpty = !next.atividade?.trim() && !next.prioridade
    try {
      if (isEmpty) {
        if (next.id) {
          await supabase.from('atividades_15min').delete().eq('id', next.id)
          setRows((prev) => {
            const cp = { ...prev }
            if (cp[intervalo]) cp[intervalo] = { id: null, atividade: '', prioridade: null }
            return cp
          })
        }
        return
      }
      const payload = {
        user_id: user.id,
        dia,
        intervalo,
        atividade: next.atividade || '',
        prioridade: next.prioridade || null,
        updated_at: new Date().toISOString(),
      }
      const { data, error } = await supabase
        .from('atividades_15min')
        .upsert(payload, { onConflict: 'user_id,dia,intervalo' })
        .select('id')
        .single()
      if (error) throw error
      if (data?.id) {
        setRows((prev) => ({ ...prev, [intervalo]: { ...prev[intervalo], id: data.id } }))
      }
    } catch (e) {
      console.error('[Atividades15min] persist:', e.message)
      showToast('Erro ao salvar', 'error')
    }
  }, [dia, user, showToast])

  // Atualiza estado local imediatamente; agenda o save (debounce por bloco).
  const updateRow = useCallback((intervalo, patch, immediate = false) => {
    setRows((prev) => {
      const current = prev[intervalo] || { id: null, atividade: '', prioridade: null }
      const next = { ...current, ...patch }
      const cp = { ...prev, [intervalo]: next }
      clearTimeout(saveTimers.current[intervalo])
      const run = () => persist(intervalo, next)
      if (immediate) run()
      else saveTimers.current[intervalo] = setTimeout(run, 650)
      return cp
    })
  }, [persist])

  useEffect(() => {
    const timers = saveTimers.current
    return () => { Object.values(timers).forEach(clearTimeout) }
  }, [])

  // ── Resumo do dia ──────────────────────────────────────────────────────────
  const resumo = useMemo(() => {
    const counts = { alta: 0, media: 0, baixa: 0 }
    let preenchidos = 0
    for (const intervalo of SLOTS) {
      const r = rows[intervalo]
      if (!r) continue
      if (r.atividade?.trim() || r.prioridade) preenchidos++
      if (r.prioridade && counts[r.prioridade] != null) counts[r.prioridade]++
    }
    const comPrioridade = counts.alta + counts.media + counts.baixa
    const horas = (n) => (n * 15 / 60).toFixed(1).replace('.', ',')
    const pct = (n) => (comPrioridade ? Math.round((n / comPrioridade) * 100) : 0)
    return { counts, preenchidos, comPrioridade, horas, pct }
  }, [rows])

  const shiftDay = (delta) => {
    const [y, m, d] = dia.split('-').map(Number)
    const nd = new Date(y, m - 1, d + delta)
    setDia(toISO(nd))
  }

  return (
    <div className="min-h-screen flex bg-gradient-dark">
      <AppSidebar
        filter="atividades"
        setFilter={() => navigate('/')}
        counts={{}}
        activeAccounts={[]}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-rl-border bg-rl-bg/90 backdrop-blur-xl">
          <button onClick={() => setSidebarOpen(true)} aria-label="Abrir menu de navegação"
            className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-rl flex items-center justify-center">
              <Timer className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-rl-text text-sm">Atividades 15min</span>
          </div>
        </div>

        <main className="flex-1 px-4 sm:px-6 py-6 sm:py-8">
          <div className="max-w-3xl mx-auto space-y-6">

            {/* ── Header ─────────────────────────────────────── */}
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-2xl font-bold text-rl-text flex items-center gap-2.5">
                  <Timer className="w-6 h-6 text-rl-purple" />
                  Atividades 15min
                </h1>
                <p className="text-sm text-rl-muted mt-1">
                  Registre o que você fez a cada 15 minutos e marque o que mexe o ponteiro.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-rl-muted bg-rl-surface border border-rl-border rounded-full px-3 py-1.5">
                <Lock className="w-3.5 h-3.5 text-rl-green" />
                Só você vê o seu
              </div>
            </div>

            {/* ── Navegação de data ──────────────────────────── */}
            <div className="glass-card p-3 flex items-center justify-between gap-3">
              <button onClick={() => shiftDay(-1)} aria-label="Dia anterior"
                className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3 flex-1 justify-center">
                <div className="text-center">
                  <p className="text-sm font-semibold text-rl-text capitalize">{fmtDiaLongo(dia)}</p>
                  {dia !== toISO(new Date()) && (
                    <button onClick={() => setDia(toISO(new Date()))}
                      className="text-[11px] text-rl-purple hover:underline mt-0.5">
                      Voltar para hoje
                    </button>
                  )}
                </div>
                <label className="relative cursor-pointer text-rl-muted hover:text-rl-text transition-all">
                  <CalendarDays className="w-4 h-4" />
                  <input type="date" value={dia} onChange={(e) => e.target.value && setDia(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" aria-label="Escolher data" />
                </label>
              </div>
              <button onClick={() => shiftDay(1)} aria-label="Próximo dia"
                className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* ── Resumo ─────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3">
              {PRIORIDADES.map(({ id, label, cls, dot }) => (
                <div key={id} className="glass-card p-3">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${dot}`} />
                    <span className="text-[11px] text-rl-muted">{label}</span>
                  </div>
                  <p className={`text-xl font-bold mt-1 ${cls.split(' ')[0]}`}>{resumo.horas(resumo.counts[id])}h</p>
                  <p className="text-[10px] text-rl-muted">{resumo.pct(resumo.counts[id])}% do tempo</p>
                </div>
              ))}
            </div>

            {/* ── Grade de blocos ────────────────────────────── */}
            {loading ? (
              <div className="glass-card p-10 flex items-center justify-center text-rl-muted">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando…
              </div>
            ) : (
              <div className="glass-card overflow-hidden divide-y divide-rl-border/60">
                {SLOTS.map((intervalo) => {
                  const r = rows[intervalo] || { atividade: '', prioridade: null }
                  return (
                    <div key={intervalo}
                      className="flex items-center gap-2 sm:gap-3 px-2.5 sm:px-4 py-1.5 hover:bg-rl-surface/40 transition-colors">
                      <span className="w-[92px] sm:w-[104px] shrink-0 text-[11px] sm:text-xs font-mono text-rl-muted tabular-nums">
                        {intervalo}
                      </span>
                      <input
                        type="text"
                        value={r.atividade}
                        onChange={(e) => updateRow(intervalo, { atividade: e.target.value })}
                        onBlur={() => updateRow(intervalo, {}, true)}
                        placeholder="—"
                        className="flex-1 min-w-0 bg-transparent text-sm text-rl-text placeholder:text-rl-muted/40 outline-none py-1"
                      />
                      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                        {PRIORIDADES.map(({ id, label, Icon, cls }) => {
                          const active = r.prioridade === id
                          return (
                            <button
                              key={id}
                              title={id === 'alta' ? 'Alta — mexe o ponteiro' : label}
                              onClick={() => updateRow(intervalo, { prioridade: active ? null : id }, true)}
                              className={`flex items-center justify-center rounded-md border transition-all h-7 w-7 sm:w-auto sm:px-2 sm:gap-1 ${
                                active
                                  ? cls
                                  : 'border-transparent text-rl-muted/50 hover:text-rl-text hover:bg-rl-surface'
                              }`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline text-[11px] font-medium">{label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <p className="text-center text-[11px] text-rl-muted pb-4">
              {resumo.preenchidos} blocos preenchidos • salvo automaticamente
            </p>
          </div>
        </main>
      </div>

      <Toast toast={toast} />
    </div>
  )
}
