// Modo Apresentação: tela cheia pro account percorrer o cliente em 3 telas.
//   1. Resultados: o dashboard de tráfego (API) travado na conta do cliente
//   2. Otimizações: o que mudou no gerenciador, em linguagem de leigo
//   3. Tarefas: o que foi entregue, o que vem aí e o que depende do cliente
import { useMemo, useState, useEffect, useRef } from 'react'
import {
  X, BarChart3, Wrench, ListChecks, Wallet, PauseCircle, ImagePlus, Users, Layers,
  Plus, Loader2, CheckCircle2, AlertTriangle, CalendarDays, UserRound, ChevronLeft, ChevronRight, Hand,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useDashboardData } from '../../hooks/useDashboardData'
import { useApresentacaoTarefas, dependeDoCliente } from '../../hooks/useApresentacaoTarefas'
import { ResultadosEmbed } from '../ProjetoHub/HubCentro'
import NovaTarefaClickUpModal from '../ProjetoHub/NovaTarefaClickUpModal'
import { CATEGORIAS, mudancasDoGerenciador, mudancasRegistradas } from '../../lib/otimizacoesLeigo'
import { bucketVencimento, paraData, inicioDoDia } from '../../lib/tarefas'
import { hojeISO } from '../../lib/atividadesCarga'
import { addDays, fmtBR } from '../../lib/dashboardData'

const ICONES = { Wallet, PauseCircle, ImagePlus, Users, Layers, Wrench }
const TABS = [
  { id: 'resultados', label: 'Resultados', Icon: BarChart3 },
  { id: 'otimizacoes', label: 'Otimizações', Icon: Wrench },
  { id: 'tarefas', label: 'Tarefas', Icon: ListChecks },
]
const PERIODOS = [
  { id: '7', label: '7 dias', dias: 7 },
  { id: '14', label: '14 dias', dias: 14 },
  { id: '30', label: '30 dias', dias: 30 },
  { id: 'custom', label: 'Outro período' },
]
const INPUT = 'px-2.5 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-xs text-rl-text focus:outline-none focus:border-rl-purple/50'

const fmtDia = (v) => {
  const d = paraData(v)
  return d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` : ''
}
const diasDeAtraso = (v) => {
  const d = paraData(v)
  return d ? Math.round((inicioDoDia().getTime() - inicioDoDia(d).getTime()) / 86400000) : 0
}

function SeletorPeriodo({ periodo, setPeriodo, de, ate, setDe, setAte }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {PERIODOS.map((p) => (
        <button key={p.id} onClick={() => setPeriodo(p.id)}
          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${periodo === p.id ? 'bg-rl-text text-white border-rl-text' : 'bg-rl-card border-rl-border text-rl-subtle hover:text-rl-text'}`}>
          {p.label}
        </button>
      ))}
      {periodo === 'custom' && (
        <span className="flex items-center gap-1.5 ml-1">
          <input type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)} className={INPUT} />
          <span className="text-xs text-rl-muted">até</span>
          <input type="date" value={ate} min={de} max={hojeISO()} onChange={(e) => setAte(e.target.value)} className={INPUT} />
        </span>
      )}
    </div>
  )
}

// Período compartilhado pelas telas 2 e 3 (cada uma tem o seu estado)
function usePeriodo(inicial = '7') {
  const [periodo, setPeriodo] = useState(inicial)
  const [de, setDe] = useState(addDays(hojeISO(), -6))
  const [ate, setAte] = useState(hojeISO())
  const faixa = useMemo(() => {
    const p = PERIODOS.find((x) => x.id === periodo)
    if (p?.dias) return { de: addDays(hojeISO(), -(p.dias - 1)), ate: hojeISO() }
    return { de: de || addDays(hojeISO(), -6), ate: ate || hojeISO() }
  }, [periodo, de, ate])
  return { periodo, setPeriodo, de, setDe, ate, setAte, faixa }
}

// ── Tela 1: visão geral (a lista da tela principal do dashboard, só com as contas do cliente)
function VisaoGeralContas({ contas, loading }) {
  const ref = useRef(null)
  const [altura, setAltura] = useState(360)
  const src = useMemo(() => `/dash-teste/viewer.html?embed=1&lista=1&contas=${encodeURIComponent(JSON.stringify(contas))}&apresentacao=1`, [contas])

  // O viewer avisa a altura do conteúdo; o iframe cresce em vez de ter barra interna
  useEffect(() => {
    const h = (e) => {
      if (e.origin !== window.location.origin || e.source !== ref.current?.contentWindow) return
      if (e.data?.type === 'rl-embed-lista-h' && Number.isFinite(e.data.h)) setAltura(Math.min(3000, Math.max(260, e.data.h)))
    }
    window.addEventListener('message', h)
    return () => window.removeEventListener('message', h)
  }, [])

  if (loading && contas.length === 0) return null
  if (contas.length === 0) return null
  return (
    <section>
      <p className="text-sm font-semibold text-rl-text px-1 mb-2">Visão geral das contas <span className="text-rl-muted font-normal">· Meta Ads + Google Ads</span></p>
      <div className="glass-card overflow-hidden">
        <iframe ref={ref} key={src} src={src} title="Visão geral das contas" className="w-full border-0 block" style={{ height: altura }} />
      </div>
    </section>
  )
}

// ── Tela 2: Otimizações ─────────────────────────────────────────────────────
function TelaOtimizacoes({ dash, hub }) {
  const per = usePeriodo('7')
  const { faixa } = per
  const raw = dash.raw
  const temDados = (raw?.meta?.length || 0) + (raw?.google?.length || 0) > 0

  const itens = useMemo(() => [
    ...mudancasDoGerenciador(raw || { meta: [], google: [] }, faixa.de, faixa.ate),
    ...mudancasRegistradas(hub.otimizacoes, faixa.de, faixa.ate),
  ], [raw, hub.otimizacoes, faixa])

  const porCat = useMemo(() => {
    const m = new Map(CATEGORIAS.map((c) => [c.id, []]))
    for (const i of itens) m.get(i.cat)?.push(i)
    return m
  }, [itens])
  const comItens = CATEGORIAS.filter((c) => porCat.get(c.id).length > 0)

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-rl-text">O que mudou nas suas campanhas</h2>
          <p className="text-sm text-rl-subtle mt-1">De {fmtBR(faixa.de)} a {fmtBR(faixa.ate)}, comparado com o período anterior de mesmo tamanho.</p>
        </div>
        <SeletorPeriodo {...per} />
      </div>

      {dash.loading && !temDados ? (
        <div className="flex items-center gap-2 text-sm text-rl-muted py-10 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Lendo o gerenciador de anúncios…</div>
      ) : (
        <>
          {/* Resumo por categoria */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {CATEGORIAS.filter((c) => c.id !== 'outras').map((c) => {
              const Icon = ICONES[c.icone]
              const n = porCat.get(c.id).length
              return (
                <div key={c.id} className={`glass-card p-4 text-center ${n === 0 ? 'opacity-60' : ''}`}>
                  <span className="w-9 h-9 rounded-full fx-soft flex items-center justify-center mx-auto mb-2"><Icon className="w-4 h-4" /></span>
                  <p className="text-2xl font-bold text-rl-text tabular-nums leading-none">{n}</p>
                  <p className="text-[11px] text-rl-muted mt-1.5">{c.label}</p>
                </div>
              )
            })}
          </div>

          {comItens.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-rl-green mx-auto mb-2" />
              <p className="text-base font-semibold text-rl-text">Nenhuma mudança relevante neste período</p>
              <p className="text-sm text-rl-subtle mt-1">As campanhas seguiram estáveis: mesmas peças no ar e investimento no mesmo ritmo.</p>
            </div>
          ) : comItens.map((c) => {
            const Icon = ICONES[c.icone]
            const lista = porCat.get(c.id)
            return (
              <div key={c.id} className="glass-card p-5">
                <div className="flex items-start gap-3 mb-3">
                  <span className="w-10 h-10 rounded-full fx-soft flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></span>
                  <div className="min-w-0">
                    <p className="text-base font-bold text-rl-text">{c.label} <span className="text-rl-muted font-medium">({lista.length})</span></p>
                    <p className="text-sm text-rl-subtle">{c.porque}</p>
                  </div>
                </div>
                <ul className="space-y-2.5">
                  {lista.map((i, k) => (
                    <li key={k} className="flex items-start gap-2.5 text-sm text-rl-text">
                      <span className="w-1.5 h-1.5 rounded-full bg-rl-purple mt-2 shrink-0" />
                      <span className="min-w-0">
                        {i.texto}
                        <span className="text-[11px] text-rl-muted"> · {i.canal === 'meta' ? 'Meta Ads' : i.canal === 'google' ? 'Google Ads' : i.canal === 'ambos' ? 'Meta + Google' : 'Conta'}{i.data ? ` · ${fmtBR(i.data)}` : ''}</span>
                        {i.motivo && <span className="block text-xs text-rl-subtle mt-0.5">Por quê: {i.motivo}</span>}
                        {i.resultado && <span className="block text-xs text-rl-subtle">Resultado: {i.resultado}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

// ── Tela 3: Tarefas ─────────────────────────────────────────────────────────
const GRUPOS_ABERTAS = [
  { id: 'atrasado', label: 'Em atraso', buckets: ['atrasado'], tom: 'neg' },
  { id: 'hoje', label: 'Hoje', buckets: ['hoje'], tom: 'pos' },
  { id: 'semana', label: 'Ainda esta semana', buckets: ['amanha', 'semana'], tom: 'neutro' },
  { id: 'proxima', label: 'Próxima semana', buckets: ['proxima'], tom: 'neutro' },
  { id: 'depois', label: 'Mais adiante', buckets: ['futuro', 'semdata'], tom: 'neutro' },
]

function LinhaTarefa({ t, nomePorId, concluida = false, doCliente = false }) {
  const resp = doCliente
    ? 'Você'
    : [...(t.responsaveis || []).map((id) => nomePorId.get(id)), ...(t.responsaveis_extra || []).map((x) => x.nome)].filter(Boolean).join(', ')
  const atraso = !concluida && bucketVencimento(t) === 'atrasado' ? diasDeAtraso(t.data_vencimento) : 0
  return (
    <li className="flex items-start gap-2.5 py-2 border-b border-rl-border/40 last:border-0">
      {concluida
        ? <CheckCircle2 className="w-4 h-4 text-rl-green mt-0.5 shrink-0" />
        : <span className="w-4 h-4 rounded-full border-2 border-rl-border mt-0.5 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-rl-text">{t.titulo}</p>
        <p className="text-[11px] text-rl-muted flex items-center gap-x-3 gap-y-0.5 flex-wrap mt-0.5">
          {resp && <span className="flex items-center gap-1"><UserRound className="w-3 h-3" /> {resp}</span>}
          {concluida && t.data_conclusao && <span>Entregue em {fmtDia(t.data_conclusao)}</span>}
          {!concluida && t.data_vencimento && (
            <span className={`flex items-center gap-1 ${atraso ? 'text-[var(--fx-neg-fg)] font-semibold' : ''}`}>
              <CalendarDays className="w-3 h-3" /> {fmtDia(t.data_vencimento)}{atraso ? ` · ${atraso} ${atraso > 1 ? 'dias' : 'dia'} de atraso` : ''}
            </span>
          )}
        </p>
      </div>
    </li>
  )
}

function TelaTarefas({ project, config, showToast }) {
  const { teamMembers } = useApp()
  const per = usePeriodo('7')
  const { faixa } = per
  const t = useApresentacaoTarefas(project.id, faixa.de)
  const [modal, setModal] = useState(null) // { dependeCliente }
  const nomePorId = useMemo(() => new Map((teamMembers || []).map((m) => [m.id, m.name])), [teamMembers])

  const finalizadas = useMemo(() => t.concluidas.filter((x) => {
    const d = (x.data_conclusao || '').slice(0, 10)
    return d && d >= faixa.de && d <= faixa.ate
  }), [t.concluidas, faixa])

  const doCliente = useMemo(() => t.abertas.filter((x) => dependeDoCliente(x, nomePorId)), [t.abertas, nomePorId])
  const doTime = useMemo(() => t.abertas.filter((x) => !dependeDoCliente(x, nomePorId)), [t.abertas, nomePorId])
  const grupos = useMemo(() => GRUPOS_ABERTAS.map((g) => ({
    ...g, itens: doTime.filter((x) => g.buckets.includes(bucketVencimento(x))),
  })).filter((g) => g.itens.length > 0), [doTime])
  const clienteAtrasadas = doCliente.filter((x) => bucketVencimento(x) === 'atrasado').length
  const semPasta = !project.clickupFolderId

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-rl-text">Tarefas e entregas</h2>
          <p className="text-sm text-rl-subtle mt-1">O que já foi entregue, o que está vindo e o que precisamos de você.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setModal({ dependeCliente: true })} disabled={semPasta}
            className="btn-secondary text-xs flex items-center gap-1.5 !px-3 !py-1.5 disabled:opacity-50" title={semPasta ? 'Projeto sem pasta do ClickUp vinculada' : ''}>
            <Hand className="w-3.5 h-3.5" /> Nova demanda do cliente
          </button>
          <button onClick={() => setModal({ dependeCliente: false })} disabled={semPasta}
            className="btn-primary text-xs flex items-center gap-1.5 !px-3 !py-1.5 disabled:opacity-50" title={semPasta ? 'Projeto sem pasta do ClickUp vinculada' : ''}>
            <Plus className="w-3.5 h-3.5" /> Nova atividade
          </button>
        </div>
      </div>

      {t.erro && <p className="text-sm text-rl-red">{t.erro}</p>}
      {t.loading && t.abertas.length === 0 && finalizadas.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-rl-muted py-10 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Carregando tarefas…</div>
      ) : (
        <>
          {/* Demandas que dependem do cliente */}
          <div className="glass-card p-5 border-2 border-rl-gold/40">
            <div className="flex items-start gap-3 mb-2">
              <span className="w-10 h-10 rounded-full bg-rl-gold/15 text-rl-gold flex items-center justify-center shrink-0"><Hand className="w-5 h-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-rl-text">Demandas que dependem de você <span className="text-rl-muted font-medium">({doCliente.length})</span></p>
                <p className="text-sm text-rl-subtle">Itens que só andam quando você envia, aprova ou libera. Quanto antes, mais rápido seguimos.</p>
              </div>
              {clienteAtrasadas > 0 && (
                <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-[var(--fx-neg-bg)] text-[var(--fx-neg-fg)] shrink-0">
                  <AlertTriangle className="w-3 h-3" /> {clienteAtrasadas} em atraso
                </span>
              )}
            </div>
            {doCliente.length === 0 ? (
              <p className="text-sm text-rl-subtle py-2">Nada pendente com você no momento.</p>
            ) : (
              <ul>{doCliente.map((x) => <LinhaTarefa key={x.id} t={x} nomePorId={nomePorId} doCliente />)}</ul>
            )}
          </div>

          {/* Finalizadas */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
              <p className="text-base font-bold text-rl-text flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-rl-green" /> Finalizado <span className="text-rl-muted font-medium">({finalizadas.length})</span>
              </p>
              <SeletorPeriodo {...per} />
            </div>
            <p className="text-[11px] text-rl-muted mb-2">Entregas de {fmtBR(faixa.de)} a {fmtBR(faixa.ate)}</p>
            {finalizadas.length === 0
              ? <p className="text-sm text-rl-subtle py-2">Nenhuma entrega concluída neste período.</p>
              : <ul>{finalizadas.map((x) => <LinhaTarefa key={x.id} t={x} nomePorId={nomePorId} concluida />)}</ul>}
          </div>

          {/* Próximas, por prazo */}
          {grupos.map((g) => (
            <div key={g.id} className="glass-card p-5">
              <p className={`text-base font-bold mb-2 flex items-center gap-2 ${g.tom === 'neg' ? 'text-[var(--fx-neg-fg)]' : 'text-rl-text'}`}>
                {g.tom === 'neg' && <AlertTriangle className="w-4 h-4" />}{g.label} <span className="text-rl-muted font-medium">({g.itens.length})</span>
              </p>
              <ul>{g.itens.map((x) => <LinhaTarefa key={x.id} t={x} nomePorId={nomePorId} />)}</ul>
            </div>
          ))}
          {grupos.length === 0 && <div className="glass-card p-5 text-sm text-rl-subtle">Nenhuma tarefa do time em aberto.</div>}
        </>
      )}

      {modal && (
        <NovaTarefaClickUpModal
          project={project}
          dependeCliente={modal.dependeCliente}
          config={config}
          showToast={showToast}
          onCriada={() => t.recarregar()}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

// ── Shell ───────────────────────────────────────────────────────────────────
export default function ModoApresentacao({ project, hub, config, showToast, onClose }) {
  const [tab, setTab] = useState('resultados')
  const dash = useDashboardData({ source: 'api', projectId: project.id, dias: 75 })
  const [contaAtiva, setContaAtiva] = useState(0)

  const contasDash = useMemo(() => {
    const out = []
    for (const ch of ['meta', 'google']) {
      const nomes = new Set((dash.raw?.[ch] || []).map((r) => (r['Nome da conta'] || '').trim()).filter(Boolean))
      for (const n of [...nomes].sort()) out.push({ canal: ch, conta: n })
    }
    return out
  }, [dash.raw])

  // Esc fecha; ← → trocam de tela (ignora quando há modal aberto ou campo em foco)
  useEffect(() => {
    const h = (e) => {
      const alvo = e.target
      if (alvo?.closest?.('input, textarea, select, [role="dialog"]')) return
      if (document.querySelector('[data-modal-open], .fixed.inset-0.z-50')) return
      const i = TABS.findIndex((x) => x.id === tab)
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' && i < TABS.length - 1) setTab(TABS[i + 1].id)
      else if (e.key === 'ArrowLeft' && i > 0) setTab(TABS[i - 1].id)
    }
    window.addEventListener('keydown', h, true) // captura: roda antes do Esc do modal
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', h, true); document.body.style.overflow = prev }
  }, [tab, onClose])

  const idx = TABS.findIndex((x) => x.id === tab)

  return (
    <div className="fx fixed inset-0 z-[60] bg-rl-bg flex flex-col">
      <header className="shrink-0 flex items-center gap-4 px-4 sm:px-6 h-16 border-b border-rl-border bg-rl-card">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-rl-muted">Modo Apresentação</p>
          <p className="text-sm font-bold text-rl-text truncate">{project.companyName}</p>
        </div>
        <nav className="flex items-center gap-1 mx-auto">
          {TABS.map(({ id, label, Icon }, i) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === id ? 'bg-rl-purple text-white shadow-sm' : 'text-rl-subtle hover:bg-rl-surface hover:text-rl-text'}`}>
              <span className="text-[11px] opacity-70">{i + 1}</span><Icon className="w-4 h-4" /> <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </nav>
        <button onClick={onClose} className="btn-secondary text-xs flex items-center gap-1.5 !px-3 !py-1.5 shrink-0" title="Sair do modo apresentação (Esc)">
          <X className="w-3.5 h-3.5" /> Sair
        </button>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-6">
        {tab === 'resultados' && (
          <div className="max-w-[1600px] mx-auto space-y-6">
            <VisaoGeralContas contas={contasDash} loading={dash.loading} />
            {contasDash.length > 0 && <p className="text-sm font-semibold text-rl-text px-1 -mb-3">Detalhe por conta</p>}
            <ResultadosEmbed apresentacao contas={contasDash} ativa={contaAtiva} onTrocar={setContaAtiva} loading={dash.loading} />
          </div>
        )}
        {tab === 'otimizacoes' && <TelaOtimizacoes dash={dash} hub={hub} />}
        {tab === 'tarefas' && <TelaTarefas project={project} config={config} showToast={showToast} />}
      </main>

      <footer className="shrink-0 flex items-center justify-between px-4 sm:px-6 h-12 border-t border-rl-border bg-rl-card">
        <button onClick={() => idx > 0 && setTab(TABS[idx - 1].id)} disabled={idx === 0} className="flex items-center gap-1 text-sm text-rl-subtle hover:text-rl-text disabled:opacity-30">
          <ChevronLeft className="w-4 h-4" /> {idx > 0 ? TABS[idx - 1].label : ''}
        </button>
        <span className="text-[11px] text-rl-muted">{idx + 1} de {TABS.length} · use ← → pra navegar, Esc pra sair</span>
        <button onClick={() => idx < TABS.length - 1 && setTab(TABS[idx + 1].id)} disabled={idx === TABS.length - 1} className="flex items-center gap-1 text-sm text-rl-subtle hover:text-rl-text disabled:opacity-30">
          {idx < TABS.length - 1 ? TABS[idx + 1].label : ''} <ChevronRight className="w-4 h-4" />
        </button>
      </footer>
    </div>
  )
}
