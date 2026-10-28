// Coluna central da página do cliente: timeline de atividades do projeto
// (otimizações, anotações, tarefas planejadas, tarefas do ClickUp, reuniões)
// e a aba de sugestões do playbook, que viram tarefa no ClickUp ao aceitar. A aba Tarefas é a
// área de tarefas do VertaTask (TarefasDoCliente → AreaTarefas), a mesma tela do /tarefas.
// A aba aberta vem de fora (ClientProfile): quem escolhe é o menu da página (MenuCliente).
import { useMemo, useState, useEffect, lazy, Suspense } from 'react'
import {
  ChevronDown, ChevronRight, Wrench, StickyNote, Kanban, ListChecks, Users, Sparkles,
  ExternalLink, Loader2, CheckCircle2, Clock, Pencil, Maximize2, Minimize2,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { gerarSugestoesProjeto } from '../../lib/playbookSugestoes'
import { hojeISO, fmtLonga } from '../../lib/atividadesCarga'
import { addDays } from '../../lib/dashboardData'
import MarkdownView from '../Editor/MarkdownView'
import SugestoesPlaybook from './SugestoesPlaybook'
import ResumoHub from './ResumoHub'
import RegistroModal from './RegistroModal'
// sob demanda: o VertaTask só é baixado quando a aba Tarefas abre
const TarefasDoCliente = lazy(() => import('../Tarefas/TarefasDoCliente'))
import NovaTarefaClickUpModal from './NovaTarefaClickUpModal'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const CANAL_LABEL = { meta: 'Meta Ads', google: 'Google Ads', ambos: 'Meta + Google', outro: 'Outro' }
const fmtData = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '')
const fmtDataHora = (ts) => {
  if (!ts) return ''
  const d = new Date(ts)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
const mesLabel = (iso) => (iso ? `${MESES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : 'Sem data')

const KIND = {
  otimizacao: { label: 'Otimização', Icon: Wrench, cls: 'fx-soft' },
  anotacao: { label: 'Anotação', Icon: StickyNote, cls: 'fx-soft' },
  planejada: { label: 'Tarefa planejada', Icon: Kanban, cls: 'fx-soft' },
  tarefa: { label: 'Tarefa', Icon: ListChecks, cls: 'fx-soft' },
  reuniao: { label: 'Reunião', Icon: Users, cls: 'fx-soft' },
}

// Abas que listam a timeline (filtrada por tipo). Resumo, Tarefas e Sugestões têm tela própria;
// Reuniões virou o módulo de atas; Resultados virou os módulos Resultados de Tráfego e de Funil.
export const ABAS_HUB = ['resumo', 'tarefas', 'sugestoes', 'otimizacoes', 'anotacoes']
const TAB_KINDS = {
  resumo: null,
  otimizacoes: ['otimizacao'],
  anotacoes: ['anotacao'],
}

// Sugestões do playbook pendentes e já decididas. Fica no ClientProfile (o menu mostra o
// número de pendentes mesmo com um módulo aberto) e desce pro HubCentro.
export function useSugestoesHub(dash, hub) {
  const todas = useMemo(() => gerarSugestoesProjeto({
    meta: dash.raw?.meta || [], google: dash.raw?.google || [], accounts: dash.accounts || {},
  }), [dash.raw, dash.accounts])
  const hoje = hojeISO()
  const statusPorChave = useMemo(() => new Map(hub.sugestoesStatus.map((s) => [s.chave, s])), [hub.sugestoesStatus])
  const pendentes = useMemo(() => todas.filter((s) => {
    const st = statusPorChave.get(s.chave)
    if (!st) return true
    if (st.status === 'aceita') return false
    return st.valida_ate && st.valida_ate < hoje
  }), [todas, statusPorChave, hoje])
  const decididas = useMemo(() => hub.sugestoesStatus
    .filter((s) => s.status === 'aceita' || !s.valida_ate || s.valida_ate >= hoje)
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')), [hub.sugestoesStatus, hoje])
  return { pendentes, decididas }
}


function Item({ item, expandido = false, nomes, onEditar, onNavigate }) {
  const [aberto, setAberto] = useState(false)
  const mostrar = expandido || aberto
  const k = KIND[item.kind]
  const r = item.registro
  const editavel = item.kind === 'otimizacao' || item.kind === 'anotacao'

  let sub = null, corpo = null
  if (item.kind === 'otimizacao') {
    sub = [CANAL_LABEL[r.canal], r.campanha, r.autor_nome].filter(Boolean).join(' · ')
    corpo = (
      <div className="space-y-1.5">
        {r.motivo && <p className="text-xs text-rl-subtle whitespace-pre-wrap">{r.motivo}</p>}
        {r.metricas_antes && (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(r.metricas_antes).map(([m, v]) => (
              <span key={m} className="text-[11px] px-2 py-0.5 rounded-md bg-rl-surface border border-rl-border text-rl-subtle">antes · {m.toUpperCase()}: <span className="text-rl-text font-medium">{typeof v === 'number' ? v.toLocaleString('pt-BR') : v}</span></span>
            ))}
          </div>
        )}
        {r.resultado && <p className="text-xs text-rl-green">Resultado: {r.resultado}</p>}
        {r.origem === 'sugestao' && <p className="text-[11px] text-rl-muted flex items-center gap-1"><Sparkles className="w-3 h-3" /> originada de uma sugestão do playbook</p>}
      </div>
    )
  } else if (item.kind === 'anotacao') {
    sub = r.autor_nome || null
    corpo = r.motivo ? <p className="text-xs text-rl-subtle whitespace-pre-wrap">{r.motivo}</p> : null
  } else if (item.kind === 'planejada') {
    const resp = nomes.get(r.responsavel_profile_id)
    sub = [resp, r.tipo_tarefa, item.prazo ? `entrega ${fmtData(item.prazo)}` : null, r.status === 'erro' ? 'erro ao criar' : null].filter(Boolean).join(' · ')
    // Briefing em markdown, recortado na altura (line-clamp não funciona com blocos aninhados)
    corpo = r.descricao ? <div className="text-rl-subtle max-h-28 overflow-hidden"><MarkdownView content={r.descricao} className="md-prose--xs" /></div> : null
  } else if (item.kind === 'tarefa') {
    const resp = (r.responsaveis || []).map((id) => nomes.get(id)).filter(Boolean).concat((r.responsaveis_extra || []).map((x) => x.nome)).join(', ')
    sub = [item.lista, resp, r.status, item.prazo ? `vence ${fmtData(item.prazo)}` : null].filter(Boolean).join(' · ')
  } else if (item.kind === 'reuniao') {
    const acoes = Array.isArray(r.next_actions) ? r.next_actions : []
    sub = [item.data ? fmtLonga(item.data) : null, acoes.length ? `${acoes.length} próxima${acoes.length > 1 ? 's' : ''} ação${acoes.length > 1 ? 'ões' : ''}` : null].filter(Boolean).join(' · ')
    corpo = (
      <div className="space-y-1">
        {acoes.slice(0, 5).map((a, i) => <p key={i} className="text-xs text-rl-subtle">• {typeof a === 'string' ? a : a.text || a.acao || a.title || JSON.stringify(a)}</p>)}
        <button onClick={() => onNavigate('atas')} className="text-xs text-rl-purple hover:underline">Abrir ata</button>
      </div>
    )
  }

  return (
    <div className="glass-card border border-rl-border/60 px-4 py-3">
      <div className="flex items-start gap-3">
        <button onClick={() => setAberto((v) => !v)} className="mt-1 p-0.5 rounded text-rl-muted hover:text-rl-text" aria-label="Expandir">
          {mostrar ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${k.cls}`}><k.Icon className="w-4 h-4" /></span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-semibold text-rl-text truncate ${item.fechada ? 'line-through opacity-60' : ''}`}>{item.titulo}</p>
            {item.kind === 'tarefa' && (item.fechada ? <CheckCircle2 className="w-3.5 h-3.5 text-rl-green shrink-0" /> : <Clock className="w-3.5 h-3.5 text-rl-muted shrink-0" />)}
          </div>
          <p className="text-[11px] text-rl-muted mt-0.5 truncate">{k.label}{sub ? ` · ${sub}` : ''}</p>
          {mostrar && corpo && <div className="mt-2">{corpo}</div>}
        </div>
        <div className="flex items-center gap-1 shrink-0 text-[11px] text-rl-muted">
          <span title={item.ts}>{item.kind === 'otimizacao' || item.kind === 'anotacao' ? fmtData(item.data) : fmtDataHora(item.ts)}</span>
          {item.url && <a href={item.url} target="_blank" rel="noreferrer" className="p-1 rounded-md hover:bg-rl-surface hover:text-rl-purple" title="Abrir no ClickUp"><ExternalLink className="w-3.5 h-3.5" /></a>}
          {editavel && <button onClick={() => onEditar(r)} className="p-1 rounded-md hover:bg-rl-surface hover:text-rl-text" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>}
        </div>
      </div>
    </div>
  )
}

// Espelho do Dashboard de Tráfego (API) travado na conta do projeto: o mesmo
// viewer de /dashboard-teste, em modo ?embed=1 (sem "Voltar", sem gravar navegação).
export function ResultadosEmbed({ contas, ativa, onTrocar, loading, apresentacao = false }) {
  // Tela cheia: o mesmo iframe muda só de posição (fixed) pra não recarregar o dashboard
  const [cheia, setCheia] = useState(false)
  useEffect(() => {
    if (!cheia) return
    const h = (e) => { if (e.key === 'Escape') setCheia(false) }
    window.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = '' }
  }, [cheia])

  if (loading && contas.length === 0) {
    return <div className="flex items-center gap-2 text-sm text-rl-muted py-10 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Lendo o dashboard de tráfego…</div>
  }
  if (contas.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-rl-subtle">Nenhuma conta de anúncio vinculada a este projeto no dashboard.</p>
        <p className="text-xs text-rl-muted mt-1">Vincule a conta em Dashboard de Tráfego → conta → projeto.</p>
      </div>
    )
  }
  const c = contas[Math.min(ativa, contas.length - 1)]
  // `contas` = todas as do projeto: o viewer pede ao servidor só elas, em vez da carteira inteira.
  const src = `/dash-teste/viewer.html?embed=1&cliente=${encodeURIComponent(c.conta)}&canal=${c.canal}&contas=${encodeURIComponent(JSON.stringify(contas.map(({ canal, conta }) => ({ canal, conta }))))}${apresentacao ? '&apresentacao=1' : ''}`
  const pilulas = contas.length > 1 && contas.map((x, i) => (
    <button key={x.canal + x.conta} onClick={() => onTrocar(i)}
      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${i === ativa ? 'bg-rl-text text-white border-rl-text' : 'bg-rl-card border-rl-border text-rl-subtle hover:text-rl-text'}`}>
      {x.canal === 'meta' ? 'Meta' : 'Google'} · {x.conta}
    </button>
  ))
  const botao = (
    <button onClick={() => setCheia((v) => !v)} className="btn-secondary text-xs flex items-center gap-1.5 !px-3 !py-1.5 ml-auto" title={cheia ? 'Minimizar (Esc)' : 'Ver em tela cheia'}>
      {cheia ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
      {cheia ? 'Minimizar' : 'Tela cheia'}
    </button>
  )
  return (
    <div className={cheia ? 'fx fixed inset-0 z-[70] bg-rl-bg flex flex-col' : 'space-y-3'}>
      <div className={`flex items-center gap-1.5 flex-wrap ${cheia ? 'px-4 py-2.5 border-b border-rl-border bg-rl-card shrink-0' : 'px-1'}`}>
        {cheia && <span className="text-sm font-semibold text-rl-text mr-2">{c.conta}</span>}
        {pilulas}
        {botao}
      </div>
      <div className={cheia ? 'flex-1 min-h-0' : 'glass-card overflow-hidden'}>
        <iframe
          key={src}
          src={src}
          title={`Dashboard de Tráfego · ${c.conta}`}
          className="w-full border-0 block"
          style={cheia ? { height: '100%' } : { minHeight: 'calc(100vh - 230px)', height: 1600 }}
        />
      </div>
    </div>
  )
}

export default function HubCentro({ project, hub, dash, config, showToast, onNavigate, acaoRapida = null, tab = 'resumo', onAbrirTab, sugestoes }) {
  const { teamMembers } = useApp()
  const [modal, setModal] = useState(null) // { tipo:'registro', registro?, tipoInicial } | { tipo:'tarefa', sugestao? }

  const nomes = useMemo(() => new Map((teamMembers || []).map((m) => [m.id, m.name])), [teamMembers])

  // Ações rápidas da coluna esquerda abrem o modal correspondente
  useEffect(() => {
    if (!acaoRapida) return
    if (acaoRapida.id === 'tarefa') setModal({ tipo: 'tarefa' })
    else if (acaoRapida.id === 'otimizacao' || acaoRapida.id === 'anotacao') setModal({ tipo: 'registro', tipoInicial: acaoRapida.id })
  }, [acaoRapida])

  // ── Sugestões do playbook ──────────────────────────────────────────────────
  const hoje = hojeISO()
  const { pendentes: sugestoesPendentes, decididas } = sugestoes

  const itens = useMemo(() => {
    const kinds = TAB_KINDS[tab]
    return kinds ? hub.timeline.filter((i) => kinds.includes(i.kind)) : hub.timeline
  }, [hub.timeline, tab])
  // as abas agrupam por mês
  const grupos = useMemo(() => {
    const m = new Map()
    for (const it of itens) { const k = mesLabel(it.data); if (!m.has(k)) m.set(k, []); m.get(k).push(it) }
    return [...m.entries()]
  }, [itens])

  // ── Ações ─────────────────────────────────────────────────────────────────
  async function descartar(s) {
    try {
      await hub.marcarSugestao(s, 'descartada', { valida_ate: addDays(hoje, 14) })
      showToast('Sugestão descartada por 14 dias')
    } catch (e) { showToast(e.message, 'error') }
  }
  async function tarefaCriada(r, sugestao) {
    hub.registrarPlanejada(r?.registro)
    if (sugestao) {
      try {
        await hub.marcarSugestao(sugestao, 'aceita', { clickup_task_id: r?.taskId || null, clickup_task_url: r?.url || null, atividade_id: r?.registro?.id || null })
      } catch (e) { showToast(e.message, 'error') }
    }
  }

  return (
    <div className="space-y-4">
      {tab === 'resumo' ? (
        <ResumoHub dash={dash} timeline={hub.timeline} sugestoesPendentes={sugestoesPendentes.length} onAbrirSugestoes={() => onAbrirTab('sugestoes')}
          onAbrirTab={(id) => (id === 'resultados' ? onNavigate('trafego') : onAbrirTab(id))} />
      ) : tab === 'tarefas' ? (
        <Suspense fallback={<div className="flex items-center justify-center gap-2 py-20 text-sm text-rl-muted"><Loader2 className="w-4 h-4 animate-spin" /> Carregando tarefas…</div>}>
          <TarefasDoCliente project={project} />
        </Suspense>
      ) : tab === 'sugestoes' ? (
        <SugestoesPlaybook
          dash={dash}
          sugestoes={sugestoesPendentes}
          decididas={decididas}
          onAceitar={(s) => setModal({ tipo: 'tarefa', sugestao: s })}
          onDescartar={descartar}
          onReabrir={(chave) => hub.reabrirSugestao(chave).catch((e) => showToast(e.message, 'error'))}
          onRecarregar={dash.reload}
        />
      ) : hub.loading && hub.timeline.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-rl-muted py-10 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Carregando atividades…</div>
      ) : itens.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-sm text-rl-subtle">Nada por aqui ainda.</p>
          <p className="text-xs text-rl-muted mt-1">Use as ações rápidas da coluna à esquerda pra registrar uma otimização, anotação ou tarefa.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grupos.map(([mes, lista]) => (
            <div key={mes}>
              <p className="text-sm font-semibold text-rl-subtle px-1 mb-2 flex items-center gap-2">
                {mes}
                <span className="text-[11px] font-medium text-rl-muted">{lista.length}</span>
              </p>
              <div className="space-y-2">
                {lista.map((it) => (
                  <Item key={it.id} item={it} nomes={nomes} onNavigate={onNavigate}
                    onEditar={(r) => setModal({ tipo: 'registro', registro: r })} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal?.tipo === 'registro' && (
        <RegistroModal
          registro={modal.registro || null}
          tipoInicial={modal.tipoInicial}
          onClose={() => setModal(null)}
          onSalvar={async (dados) => {
            if (modal.registro) { await hub.atualizarRegistro(modal.registro.id, dados); showToast('Registro atualizado') }
            else { await hub.adicionarRegistro(dados); showToast(dados.tipo === 'anotacao' ? 'Anotação salva' : 'Otimização registrada') }
          }}
          onExcluir={modal.registro ? (id) => hub.removerRegistro(id).then(() => showToast('Registro excluído')) : null}
        />
      )}
      {modal?.tipo === 'tarefa' && (
        <NovaTarefaClickUpModal
          project={project}
          sugestao={modal.sugestao || null}
          config={config}
          showToast={showToast}
          onCriada={(r) => tarefaCriada(r, modal.sugestao)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
