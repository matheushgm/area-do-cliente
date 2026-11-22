// Solicitações no portal: o cliente pede ao time (o mesmo formulário por tipo do /pedido/:token,
// agora com upload de arquivos) e acompanha cada pedido: recebido → em produção → concluído.
// O pedido cai no Intake do VertaTask (origem "Portal do cliente"); quando o time aceita, vira
// tarefa e o andamento vem dela (status, previsão e etapas concluídas).
import { useEffect, useMemo, useState } from 'react'
import {
  Loader2, RefreshCw, Plus, Inbox, Check, Clock, AlertCircle, ChevronDown, Paperclip, Flame, CalendarDays,
  UploadCloud, Image, Clapperboard, LayoutTemplate, Megaphone, Wallet, MessageCircle, PenLine, XCircle,
} from 'lucide-react'
import { PedidoFormulario } from '../../pages/PedidoPublico'
import { TIPOS_PEDIDO_MAP } from '../../lib/pedidoTipos'
import { dataCurta } from '../../lib/portalCentral'

const ICONES = { subir_criativos: UploadCloud, criativo_estatico: Image, criativo_video: Clapperboard, landing_page: LayoutTemplate, nova_campanha: Megaphone, orcamento: Wallet, whatsapp: MessageCircle, outras: PenLine }
const ATALHOS = ['subir_criativos', 'criativo_estatico', 'criativo_video', 'landing_page', 'nova_campanha', 'outras']
const ETAPAS = [
  { id: 'recebido', label: 'Recebido' },
  { id: 'producao', label: 'Em produção' },
  { id: 'concluido', label: 'Concluído' },
]
const FILTROS = [
  { id: 'andamento', label: 'Em andamento', etapas: ['recebido', 'producao'] },
  { id: 'concluido', label: 'Concluídas', etapas: ['concluido'] },
  { id: 'todas', label: 'Todas', etapas: null },
]

function Linha({ etapa }) {
  if (etapa === 'recusado') {
    return <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-500"><XCircle className="w-4 h-4" /> Não vai ser feito</span>
  }
  const atual = ETAPAS.findIndex((e) => e.id === etapa)
  return (
    <ol className="flex items-center gap-1.5 text-[11px] sm:text-xs" aria-label="Andamento">
      {ETAPAS.map((e, i) => {
        const feito = i < atual || (i === atual && etapa === 'concluido')
        const agora = i === atual && etapa !== 'concluido'
        return (
          <li key={e.id} className="flex items-center gap-1.5">
            <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center shrink-0 ${feito ? 'bg-emerald-600 text-white' : agora ? 'bg-rl-purple text-white' : 'bg-rl-surface text-rl-muted border border-rl-border'}`}>
              {feito ? <Check className="w-3 h-3" strokeWidth={3} /> : agora ? <span className="w-1.5 h-1.5 rounded-full bg-white" /> : <span className="text-[10px]">{i + 1}</span>}
            </span>
            <span className={`font-semibold ${feito || agora ? 'text-rl-text' : 'text-rl-muted'}`}>{e.label}</span>
            {i < ETAPAS.length - 1 && <span className={`w-4 sm:w-8 h-px ${i < atual ? 'bg-emerald-600' : 'bg-rl-border'}`} />}
          </li>
        )
      })}
    </ol>
  )
}

function Cartao({ p }) {
  const [aberto, setAberto] = useState(false)
  const Ic = ICONES[p.tipo] || (p.origem?.startsWith('Aprovação') ? AlertCircle : PenLine)
  const t = p.tarefa
  const previsao = t && !t.concluidaEm && t.vencimento
  return (
    <div className="glass-card !p-0 overflow-hidden">
      <button type="button" onClick={() => setAberto((v) => !v)} className="w-full text-left p-4 flex items-start gap-3" aria-expanded={aberto}>
        <span className="w-10 h-10 shrink-0 rounded-xl bg-rl-purple/10 text-rl-purple inline-flex items-center justify-center"><Ic className="w-5 h-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-rl-muted">{p.tipoNome || (p.origem?.startsWith('Aprovação') ? 'Ajuste pedido na aprovação' : 'Pedido')}</span>
            {p.urgente && <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider text-red-500"><Flame className="w-3 h-3" />urgente</span>}
          </span>
          <span className="block text-[15px] font-semibold text-rl-text leading-snug mt-0.5">{p.titulo}</span>
          <span className="mt-2.5 block"><Linha etapa={p.etapa} /></span>
          <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-rl-muted">
            <span>Pedido em {dataCurta(p.criadoEm)}</span>
            {previsao && <span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />Previsão {dataCurta(t.vencimento)}</span>}
            {t?.concluidaEm && <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><Check className="w-3.5 h-3.5" />Concluído em {dataCurta(t.concluidaEm)}</span>}
            {t?.subtarefas > 0 && p.etapa !== 'concluido' && <span>{t.feitas} de {t.subtarefas} etapas feitas</span>}
            {p.arquivos?.length > 0 && <span className="inline-flex items-center gap-1"><Paperclip className="w-3.5 h-3.5" />{p.arquivos.length} {p.arquivos.length === 1 ? 'arquivo' : 'arquivos'}</span>}
          </span>
        </span>
        <ChevronDown className={`w-4 h-4 text-rl-muted shrink-0 mt-1 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>
      {aberto && (
        <div className="px-4 pb-4 pt-0 border-t border-rl-border/60">
          {p.etapa === 'recusado' && p.motivoRecusa && (
            <div className="mt-3 rounded-xl bg-red-500/[0.06] border border-red-500/20 p-3 text-sm text-rl-text"><b>Por quê:</b> {p.motivoRecusa}</div>
          )}
          {p.itens?.length > 0 ? (
            <dl className="mt-3 grid gap-2">
              {p.itens.filter((i) => !['nome', 'contato', 'urgente'].includes(i.k)).map((i) => (
                <div key={i.k} className="grid sm:grid-cols-[160px_1fr] gap-0.5 sm:gap-3">
                  <dt className="text-xs font-semibold text-rl-muted">{i.label}</dt>
                  <dd className="text-sm text-rl-text whitespace-pre-line break-words">
                    {i.tipo === 'link' || i.tipo === 'drive' ? <a href={i.valor} target="_blank" rel="noreferrer" className="text-rl-blue underline break-all">{i.valor}</a> : i.valor}
                  </dd>
                </div>
              ))}
            </dl>
          ) : <p className="mt-3 text-sm text-rl-muted">Sem detalhes registrados.</p>}
        </div>
      )}
    </div>
  )
}

export default function PortalSolicitacoes({ projectId, token, pedidosEstado }) {
  const { pedidos, podePedir, prazos, empresa, carregando, erro, recarregar } = pedidosEstado
  const infoInicial = useMemo(() => ({ empresa, prazos }), [empresa, prazos])
  const [novo, setNovo] = useState(null) // null | { tipo }
  const [filtro, setFiltro] = useState('andamento')
  const contagem = useMemo(() => Object.fromEntries(FILTROS.map((f) => [f.id, pedidos.filter((p) => !f.etapas || f.etapas.includes(p.etapa)).length])), [pedidos])
  const lista = useMemo(() => {
    const f = FILTROS.find((x) => x.id === filtro)
    return pedidos.filter((p) => !f?.etapas || f.etapas.includes(p.etapa))
  }, [pedidos, filtro])
  const portal = useMemo(() => ({ projectId, token }), [projectId, token])
  // Ao abrir a aba, relê: o andamento muda do lado do time.
  useEffect(() => { recarregar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (novo) {
    return (
      <PedidoFormulario
        key={novo.tipo || 'novo'}
        portal={portal}
        embedded
        tipoInicial={novo.tipo}
        infoInicial={infoInicial}
        onEnviado={() => recarregar()}
        onVoltar={() => { setNovo(null); recarregar() }}
      />
    )
  }

  return (
    <div className="space-y-4">
      {podePedir && (
        <div className="glass-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-[15px] font-bold text-rl-text">Do que você precisa?</p>
              <p className="text-xs text-rl-muted">Cada pedido pergunta só o necessário para o time começar sem voltar com dúvida.</p>
            </div>
            <button type="button" onClick={() => setNovo({ tipo: null })} className="btn-primary text-sm inline-flex items-center gap-1.5"><Plus className="w-4 h-4" /> Nova solicitação</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {ATALHOS.map((id) => {
              const tp = TIPOS_PEDIDO_MAP[id]
              if (!tp) return null
              const Ic = ICONES[id]
              return (
                <button key={id} type="button" onClick={() => setNovo({ tipo: id })} className="text-left rounded-xl border border-rl-border bg-rl-card hover:border-rl-purple hover:shadow-sm px-3 py-3 transition flex flex-col gap-2">
                  <span className="w-8 h-8 rounded-lg bg-rl-purple/10 text-rl-purple inline-flex items-center justify-center"><Ic className="w-4 h-4" /></span>
                  <span className="text-[13px] font-semibold text-rl-text leading-tight">{tp.nome}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap gap-1.5" role="tablist">
          {FILTROS.map((f) => (
            <button key={f.id} type="button" role="tab" aria-selected={filtro === f.id} onClick={() => setFiltro(f.id)} className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${filtro === f.id ? 'bg-rl-text text-rl-card border-rl-text' : 'border-rl-border text-rl-muted hover:text-rl-text'}`}>
              {f.label} <span className="tabular-nums opacity-70">{contagem[f.id]}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={recarregar} disabled={carregando} className="text-xs font-semibold text-rl-muted hover:text-rl-text inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-rl-surface">
          <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      {carregando && !pedidos.length ? (
        <div className="glass-card p-10 flex justify-center text-rl-muted"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : erro && !pedidos.length ? (
        <div className="glass-card p-8 text-center text-sm text-rl-text"><AlertCircle className="w-7 h-7 mx-auto text-red-400 mb-2" />{erro}</div>
      ) : lista.length ? (
        <div className="space-y-2.5">{lista.map((p) => <Cartao key={p.id} p={p} />)}</div>
      ) : (
        <div className="glass-card p-10 text-center">
          <Inbox className="w-8 h-8 mx-auto text-rl-muted mb-2" />
          <p className="text-sm font-semibold text-rl-text">{filtro === 'andamento' ? 'Nada em andamento agora.' : 'Nenhuma solicitação aqui.'}</p>
          {podePedir && <p className="text-xs text-rl-muted mt-1 inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Pediu algo? Acompanhe cada etapa por aqui.</p>}
        </div>
      )}
    </div>
  )
}
