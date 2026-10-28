// Seção Sincronização do VertaTask (/tarefas?aba=sincronizacao): o que foi e o que veio do
// ClickUp, para auditar uma ação em massa ou um template e para quem usa entender por que o
// ClickUp ainda não mostra uma mudança. Ida = fila tarefas_outbox agrupada em lotes; volta =
// tarefas_sync_log (migration 120); rodadas = resumo de cada /api/tarefas-sync. Com
// ?sync_tarefa=<id> vira o histórico de uma tarefa só (edições, envios e recebidos juntos).
import { useMemo, useState } from 'react'
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, CheckCircle2, ChevronDown, ChevronRight, CircleDot, Clock,
  ExternalLink, HelpCircle, History, Loader2, RefreshCw, RotateCcw, Search, Send, Webhook, X,
} from 'lucide-react'
import { useSincronizacao } from '../../hooks/useSincronizacao'
import { fmtDataHora, fmtDataCurta, fmtEstimativa, rotuloStatus, prioridade as prioDe } from '../../lib/tarefas'
import {
  agruparLotes, situacaoItem, saudeGeral, traduzirErro, traduzirAviso, traduzirMotivo, descreverLog, ehProblemaLog,
  rotuloCampo, tempoRelativo, fmtDuracao, OPERACOES, FILA_ATRASADA_MS,
} from '../../lib/sincronizacao'
import { FOCO } from './Campos'

const PERIODOS = [[1, '24 h'], [7, '7 dias'], [30, '30 dias']]
const TOM = {
  green: 'bg-ln-green/10 text-ln-green',
  red: 'bg-ln-red/10 text-ln-red',
  yellow: 'bg-ln-yellow/15 text-[#8a6a14] dark:text-ln-yellow',
  accent: 'bg-ln-accent/10 text-ln-accent',
  muted: 'bg-ln-ink/[0.06] text-ln-t3',
}
const BORDA = { green: 'border-l-ln-green', red: 'border-l-ln-red', yellow: 'border-l-ln-yellow', accent: 'border-l-ln-accent', muted: 'border-l-ln-ink/20' }
const hora = (iso) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
const diaDe = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` }

function Pilula({ tom = 'muted', children, title }) {
  return <span title={title} className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[11px] font-semibold whitespace-nowrap ${TOM[tom]}`}>{children}</span>
}

function Tile({ icone: Icone, k, v, sub, tom, acao }) {
  return (
    <div className="ln-card px-4 py-3 min-w-0 flex flex-col gap-0.5">
      <p className="text-[11px] uppercase tracking-wider text-ln-t4 font-bold inline-flex items-center gap-1.5"><Icone className="w-3.5 h-3.5" />{k}</p>
      <p className={`text-xl font-bold tabular vt-display truncate ${tom === 'red' ? 'text-ln-red' : tom === 'yellow' ? 'text-[#8a6a14] dark:text-ln-yellow' : 'text-ln-t1'}`}>{v}</p>
      {sub && <p className="text-[11px] text-ln-t4 truncate" title={typeof sub === 'string' ? sub : undefined}>{sub}</p>}
      {acao}
    </div>
  )
}

// ── valores legíveis do antes/depois ────────────────────────────────────────
function valorLegivel(campo, v, ctx) {
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return '(vazio)'
  if (campo === 'status') return rotuloStatus(v)
  if (campo === 'prioridade') return prioDe(v)?.label || v
  if (campo === 'data_inicio' || campo === 'data_vencimento') return fmtDataCurta(v)
  if (campo === 'estimativa_min') return fmtEstimativa(v) || '(vazio)'
  if (campo === 'responsaveis') return v.map((id) => ctx.membrosMap.get(id)?.name?.split(' ')[0] || 'alguém').join(', ')
  if (campo === 'lista_id') return ctx.listasMap.get(v)?.nome || 'outra lista'
  if (campo === 'parent_id') return ctx.tarefas.get(v)?.titulo || 'outra tarefa'
  if (campo === 'arquivada') return v ? 'sim' : 'não'
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

function Mudancas({ campos, detalhe, ctx }) {
  if (!campos?.length) return null
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
      {campos.map((c) => {
        const d = detalhe?.[c]
        return (
          <span key={c} className="text-[12px] text-ln-t3">
            <span className="text-ln-t2 font-medium">{rotuloCampo(c)}</span>
            {d ? <>: <span className="line-through decoration-ln-t4/60">{valorLegivel(c, d.de, ctx)}</span> → <span className="text-ln-t1">{valorLegivel(c, d.para, ctx)}</span></> : <span className="text-ln-t4"> alterada</span>}
          </span>
        )
      })}
    </div>
  )
}

// linha de tarefas_atividade (edição de pessoa): valores vêm como texto; responsáveis separados por vírgula
function EdicaoTexto({ a, ctx }) {
  if (a.campo === 'criada') return <span className="text-ln-t3">criou a tarefa</span>
  const val = (v) => valorLegivel(a.campo, a.campo === 'responsaveis' && v ? String(v).split(',') : v, ctx)
  const curto = (v) => String(v).slice(0, 60)
  return (
    <span className="text-ln-t3">mudou {rotuloCampo(a.campo)}{a.campo === 'descricao' ? '' : <>: <span className="line-through decoration-ln-t4/60">{curto(val(a.valor_antigo))}</span> → <span className="text-ln-t2">{curto(val(a.valor_novo))}</span></>}</span>
  )
}

function NomeTarefa({ id, cu, ctx, className = '' }) {
  const t = (id && ctx.tarefas.get(id)) || (cu && ctx.tarefas.get(`cu:${cu}`))
  if (!t) return <span className={`text-ln-t4 italic ${className}`}>{id || cu ? 'tarefa que não existe mais' : '—'}</span>
  const lista = ctx.listasMap.get(t.lista_id)
  const pasta = lista ? ctx.pastasMap.get(lista.pasta_id) : null
  return (
    <span className={`min-w-0 inline-flex items-center gap-1.5 ${className}`}>
      <button type="button" onClick={() => ctx.onAbrirTarefa(t.id)} className={`truncate text-left text-ln-t1 hover:text-ln-accent rounded ${FOCO}`} title={`Abrir: ${t.titulo}`}>{t.titulo}</button>
      {pasta && <span className="hidden md:inline text-[11px] text-ln-t4 truncate max-w-[140px] shrink-0" title={`${pasta.nome} › ${lista.nome}`}>{pasta.nome}</span>}
      {t.arquivada && <Pilula>arquivada</Pilula>}
      <button type="button" onClick={() => ctx.onFiltrarTarefa(t.id)} className={`ln-iconbtn !w-6 !h-6 shrink-0 ${FOCO}`} title="Histórico de sincronização desta tarefa" aria-label="Histórico de sincronização desta tarefa"><History className="w-3.5 h-3.5" /></button>
    </span>
  )
}

// ── ida: um item da fila ─────────────────────────────────────────────────────
function ItemFila({ it, ctx, mostrarTarefa = true }) {
  const s = situacaoItem(it)
  const [ocupado, setOcupado] = useState(false)
  const agir = async (fn, ok) => {
    setOcupado(true)
    const r = await fn([it.id])
    setOcupado(false)
    if (r.error) ctx.onToast(r.error, 'error'); else ctx.onToast(ok)
  }
  const espera = it.processed_at && it.status === 'ok' ? new Date(it.processed_at) - new Date(it.created_at) : null
  return (
    <div className="py-2.5 px-3 flex flex-col gap-1 border-t border-ln-ink/[0.06] first:border-t-0">
      <div className="flex items-center gap-2 min-w-0 text-[13px]">
        <span className="text-[11px] text-ln-t4 tabular w-10 shrink-0">{hora(it.created_at)}</span>
        <Pilula tom="muted">{OPERACOES[it.operacao] || it.operacao}</Pilula>
        {mostrarTarefa ? <NomeTarefa id={it.tarefa_id} ctx={ctx} className="flex-1" /> : <span className="flex-1 text-ln-t3 text-[12px]">{it.campos?.length ? it.campos.map(rotuloCampo).join(', ') : it.operacao === 'criar' ? 'tarefa inteira' : ''}</span>}
        <Pilula tom={s.tom} title={it.processed_at ? `Última tentativa: ${fmtDataHora(it.processed_at)}` : undefined}>{s.rotulo}</Pilula>
        {espera != null && <span className="hidden sm:inline text-[11px] text-ln-t4 tabular whitespace-nowrap" title="Tempo entre a edição e a chegada ao ClickUp">{fmtDuracao(espera)} depois</span>}
      </div>
      {mostrarTarefa && it.campos?.length > 0 && <p className="pl-12 text-[12px] text-ln-t3">{it.campos.map(rotuloCampo).join(', ')}</p>}
      {it.erro && (
        <div className="pl-12 text-[12px] flex flex-col gap-0.5">
          <span className={it.status === 'erro' ? 'text-ln-red' : 'text-ln-t3'}>{traduzirErro(it.erro)}</span>
          {traduzirErro(it.erro) !== it.erro && <span className="text-ln-t4 font-mono text-[11px] break-all">{it.erro}</span>}
        </div>
      )}
      {it.avisos?.map((a, i) => <p key={i} className="pl-12 text-[12px] text-[#8a6a14] dark:text-ln-yellow inline-flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />{traduzirAviso(a)}</p>)}
      {it.resolvido_por && <p className="pl-12 text-[11px] text-ln-t4">{it.status === 'cancelado' ? 'Ignorado' : 'Mandado de novo'} por {ctx.membrosMap.get(it.resolvido_por)?.name || 'alguém'} {tempoRelativo(it.resolvido_em)}</p>}
      {it.status === 'erro' && (
        <div className="pl-12 flex gap-2 mt-0.5">
          <button type="button" disabled={ocupado} onClick={() => agir(ctx.sync.reenviar, 'De volta à fila; enviando ao ClickUp')} className="ln-pill !h-6 disabled:opacity-50"><RotateCcw className="w-3 h-3" /> Tentar de novo</button>
          <button type="button" disabled={ocupado} onClick={() => agir(ctx.sync.ignorar, 'Erro ignorado')} className="ln-pill !h-6 disabled:opacity-50"><X className="w-3 h-3" /> Ignorar</button>
        </div>
      )}
    </div>
  )
}

// ── ida: um lote (template, edição em massa ou edição avulsa) ────────────────
function Lote({ lote, ctx, abertoInicial = false }) {
  const [aberto, setAberto] = useState(abertoInicial)
  const autor = lote.ator_id ? (ctx.membrosMap.get(lote.ator_id)?.name || 'Alguém do time') : 'Autor não registrado'
  const { cont } = lote
  const ops = Object.entries(lote.ops).map(([k, n]) => `${n} ${(OPERACOES[k] || k).toLowerCase()}`).join(' · ')
  const tom = cont.erro ? 'red' : lote.emAberto ? (lote.esperaMs > FILA_ATRASADA_MS ? 'yellow' : 'accent') : 'green'
  const status = cont.erro
    ? `${cont.erro} ${cont.erro === 1 ? 'falhou' : 'falharam'}`
    : lote.emAberto
      ? `Enviando: ${cont.ok} de ${lote.total - cont.ignorado - cont.cancelado} (${fmtDuracao(lote.esperaMs)} até agora)`
      : lote.duracaoMs != null ? `No ClickUp em ${fmtDuracao(lote.duracaoMs)}` : (cont.cancelado || cont.ignorado) === lote.total ? 'Cancelado' : 'No ClickUp'
  const comErro = lote.itens.filter((i) => i.status === 'erro').map((i) => i.id)
  return (
    <div className={`ln-card overflow-hidden border-l-[3px] ${BORDA[tom]}`}>
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} className={`w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-ln-ink/[0.02] ${FOCO}`}>
        {aberto ? <ChevronDown className="w-4 h-4 text-ln-t4 shrink-0" /> : <ChevronRight className="w-4 h-4 text-ln-t4 shrink-0" />}
        <span className="text-[12px] text-ln-t4 tabular w-10 shrink-0">{hora(lote.inicio)}</span>
        <span className="min-w-0 flex-1 flex flex-col">
          <span className="text-[13px] text-ln-t1 truncate">
            <b className="font-semibold">{autor}</b>{' '}
            {lote.total === 1 ? <>· {(OPERACOES[lote.itens[0].operacao] || '').toLowerCase()} <span className="text-ln-t2">{ctx.tarefas.get(lote.itens[0].tarefa_id)?.titulo || 'tarefa'}</span></> : <>· {lote.total} alterações em {lote.tarefas} {lote.tarefas === 1 ? 'tarefa' : 'tarefas'}</>}
          </span>
          <span className="text-[11px] text-ln-t4 truncate">{ops}{lote.campos.length ? ` · ${lote.campos.slice(0, 5).map(rotuloCampo).join(', ')}${lote.campos.length > 5 ? ` +${lote.campos.length - 5}` : ''}` : ''}{lote.avisos ? ` · ${lote.avisos} com aviso` : ''}</span>
        </span>
        {lote.emAberto > 0 && lote.total > 1 && (
          <span className="hidden sm:block w-24 h-1.5 rounded-full bg-ln-ink/[0.08] overflow-hidden shrink-0" aria-hidden="true"><i className="block h-full bg-ln-accent" style={{ width: `${Math.round(lote.progresso * 100)}%` }} /></span>
        )}
        <Pilula tom={tom}>{lote.emAberto ? <Loader2 className="w-3 h-3 animate-spin" /> : cont.erro ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}{status}</Pilula>
      </button>
      {aberto && (
        <div className="border-t border-ln-ink/[0.08] bg-ln-ink/[0.012]">
          {comErro.length > 1 && (
            <div className="px-3 py-2 flex items-center gap-2 border-b border-ln-ink/[0.06]">
              <span className="text-[12px] text-ln-red flex-1">{comErro.length} alterações deste lote falharam.</span>
              <button type="button" onClick={async () => { const r = await ctx.sync.reenviar(comErro); ctx.onToast(r.error || `${comErro.length} de volta à fila`, r.error ? 'error' : undefined) }} className="ln-pill !h-6"><RotateCcw className="w-3 h-3" /> Tentar de novo todas</button>
            </div>
          )}
          {lote.itens.slice().sort((a, b) => b.id - a.id).map((it) => <ItemFila key={it.id} it={it} ctx={ctx} />)}
        </div>
      )}
    </div>
  )
}

// ── volta: uma linha do log ──────────────────────────────────────────────────
const ORIGEM = { clickup: ['Gravado', ArrowDownLeft], webhook: ['Webhook', Webhook], rodada: ['Rodada', RefreshCw] }
function LinhaLog({ l, ctx, mostrarTarefa = true }) {
  const d = descreverLog(l)
  const [rot, Icone] = ORIGEM[l.origem] || [l.origem, CircleDot]
  return (
    <div className="py-2.5 px-3 flex flex-col gap-0.5 border-t border-ln-ink/[0.06] first:border-t-0">
      <div className="flex items-center gap-2 min-w-0 text-[13px]">
        <span className="text-[11px] text-ln-t4 tabular w-10 shrink-0">{hora(l.created_at)}</span>
        <span className="inline-flex items-center gap-1 text-[11px] text-ln-t4 w-[74px] shrink-0" title={l.evento || undefined}><Icone className="w-3 h-3" />{rot}</span>
        <Pilula tom={d.tom}>{d.rotulo}</Pilula>
        {mostrarTarefa && <NomeTarefa id={l.tarefa_id} cu={l.clickup_task_id} ctx={ctx} className="flex-1" />}
      </div>
      <div className="pl-[136px] max-sm:pl-12">
        {l.motivo && <p className="text-[12px] text-ln-t3">{traduzirMotivo(l.motivo)}</p>}
        {l.origem === 'clickup' && <Mudancas campos={l.campos} detalhe={l.detalhe} ctx={ctx} />}
      </div>
    </div>
  )
}

function Rodada({ l }) {
  const [aberto, setAberto] = useState(false)
  const r = l.detalhe || {}
  const via = { cron: 'automática (todo dia)', user: 'pelo VertaTask', script: 'script local' }[r.via] || r.via || '—'
  const numeros = [
    ['tarefas lidas', r.tarefas_recebidas], ['criadas', r.criadas], ['atualizadas', r.atualizadas],
    ['puladas por conflito', r.puladas_conflito], ['sem pai', r.sem_pai], ['removidas', r.removidas], ['comentários', r.comentarios],
  ].filter(([, n]) => n)
  const push = r.push && !r.push.erro ? [['enviadas ao ClickUp', (r.push.criadas || 0) + (r.push.atualizadas || 0) + (r.push.excluidas || 0)], ['erros no envio', r.push.erros]].filter(([, n]) => n) : []
  const avisos = [...(r.avisos || []), ...(r.push?.avisos || [])]
  return (
    <div className={`ln-card overflow-hidden border-l-[3px] ${l.acao === 'erro' ? BORDA.red : r.puladas_conflito || avisos.length ? BORDA.yellow : BORDA.green}`}>
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} disabled={!avisos.length && l.acao !== 'erro'} className={`w-full text-left px-3 py-2.5 flex items-center gap-3 ${FOCO}`}>
        <span className="text-[12px] text-ln-t4 tabular w-10 shrink-0">{hora(l.created_at)}</span>
        <span className="min-w-0 flex-1 flex flex-col">
          <span className="text-[13px] text-ln-t1">Rodada {via}{r.duracao_s ? <span className="text-ln-t4"> · {String(r.duracao_s).replace('.', ',')} s</span> : null}</span>
          <span className="text-[11px] text-ln-t4">{l.acao === 'erro' ? (l.motivo || 'falhou') : [...numeros, ...push].map(([k, n]) => `${n} ${k}`).join(' · ') || 'nada novo'}</span>
        </span>
        {avisos.length > 0 && <Pilula tom="yellow">{avisos.length} {avisos.length === 1 ? 'aviso' : 'avisos'}</Pilula>}
        {l.acao === 'erro' ? <Pilula tom="red">falhou</Pilula> : <Pilula tom="green">ok</Pilula>}
      </button>
      {aberto && avisos.length > 0 && (
        <ul className="border-t border-ln-ink/[0.08] px-4 py-2 flex flex-col gap-1 text-[12px] text-ln-t3">
          {avisos.slice(0, 60).map((a, i) => <li key={i}>{traduzirAviso(a)}</li>)}
        </ul>
      )}
    </div>
  )
}

function ComoFunciona() {
  const [aberto, setAberto] = useState(false)
  return (
    <section className="ln-card overflow-hidden">
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} className={`w-full text-left px-4 py-2.5 flex items-center gap-2 text-[13px] font-semibold text-ln-t1 ${FOCO}`}>
        <HelpCircle className="w-4 h-4 text-ln-accent" /> Como a sincronização com o ClickUp funciona
        {aberto ? <ChevronDown className="w-4 h-4 text-ln-t4 ml-auto" /> : <ChevronRight className="w-4 h-4 text-ln-t4 ml-auto" />}
      </button>
      {aberto && (
        <div className="border-t border-ln-ink/[0.08] px-4 py-3 grid gap-3 md:grid-cols-2 text-[13px] text-ln-t2 leading-relaxed">
          <div>
            <p className="font-semibold text-ln-t1 inline-flex items-center gap-1.5 mb-1"><ArrowUpRight className="w-4 h-4 text-ln-accent" /> Daqui para o ClickUp</p>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li>Toda edição feita aqui entra numa fila e costuma chegar ao ClickUp em segundos.</li>
              <li><b>Template e edição em massa</b> viram muitas alterações de uma vez. O ClickUp aceita cerca de 100 chamadas por minuto, então um lote grande leva minutos (já levou 33 min com 164 alterações). Enquanto o lote não termina, o ClickUp mostra a versão antiga.</li>
              <li>Cada alteração tenta até 5 vezes. Se o ClickUp recusar (data de início depois do vencimento, opção que não existe na lista), ela para em <b>Problemas</b> e o ClickUp fica diferente daqui até alguém resolver.</li>
              <li>Mover a tarefa de lista <b>não</b> vai para o ClickUp: mova lá também.</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-ln-t1 inline-flex items-center gap-1.5 mb-1"><ArrowDownLeft className="w-4 h-4 text-ln-accent" /> Do ClickUp para cá</p>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li>Mudanças feitas no ClickUp chegam pelo <b>webhook</b>, em segundos.</li>
              <li>Uma <b>rodada</b> completa confere o que o webhook perdeu: todo dia às 6h, ao abrir o VertaTask (se a última tem mais de 30 min) e pelo botão &ldquo;Sincronizar agora&rdquo;.</li>
              <li>Enquanto uma tarefa está sendo enviada daqui, os eventos dela vindos do ClickUp são <b>ignorados</b>: quem grava a versão final é o envio. É o que evita tarefa duplicada.</li>
              <li><b>Conflito:</b> se a tarefa foi editada aqui depois da última sincronização e o ClickUp não é mais novo, vale a edição daqui.</li>
              <li>Não vêm do ClickUp: tempo rastreado, dependências e tarefas arquivadas lá.</li>
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}

function PorDia({ itens, render }) {
  const grupos = []
  for (const x of itens) {
    const k = diaDe(x._t)
    if (!grupos.length || grupos[grupos.length - 1].k !== k) grupos.push({ k, iso: x._t, itens: [] })
    grupos[grupos.length - 1].itens.push(x)
  }
  return grupos.map((g) => (
    <div key={g.k} className="flex flex-col gap-2">
      <h3 className="text-[11px] uppercase tracking-wider text-ln-t4 font-bold mt-2">{fmtDataCurta(g.iso)}</h3>
      {g.itens.map(render)}
    </div>
  ))
}

// resultado do último evento do webhook, no quadro do topo
const ACAO_CURTA = { atualizada: 'tarefa atualizada', criada: 'tarefa nova', removida: 'tarefa removida', sem_mudanca: 'sem mudança', ignorado: 'ignorado', pulada_conflito: 'conflito', erro: 'erro' }

const Vazio = ({ children }) => <p className="ln-card px-4 py-8 text-center text-[13px] text-ln-t4">{children}</p>

export default function SincronizacaoView({ membrosMap, listasMap, pastasMap, tarefaFiltro, onFiltrarTarefa, onAbrirTarefa, onToast }) {
  const [dias, setDias] = useState(7)
  const [aba, setAba] = useState('problemas')
  const [ecos, setEcos] = useState(false)
  const [busca, setBusca] = useState('')
  const [pessoa, setPessoa] = useState('')
  const [rodando, setRodando] = useState(false)
  const sync = useSincronizacao({ dias, tarefaId: tarefaFiltro, ecos })
  const ctx = { sync, membrosMap, listasMap, pastasMap, tarefas: sync.tarefas, onAbrirTarefa, onFiltrarTarefa, onToast }

  const termo = busca.trim().toLowerCase()
  const casa = (tarefaId, cu) => {
    if (!termo) return true
    const t = (tarefaId && sync.tarefas.get(tarefaId)) || (cu && sync.tarefas.get(`cu:${cu}`))
    return !!t && t.titulo.toLowerCase().includes(termo)
  }

  const erros = useMemo(() => sync.fila.filter((i) => i.status === 'erro'), [sync.fila])
  const saude = saudeGeral({ fila: sync.fila, erros: erros.length, webhook: sync.estado.clickup_webhook, rodada: sync.estado.clickup })
  const emAberto = sync.fila.filter((i) => i.status === 'pendente' || i.status === 'processando')

  const lotes = useMemo(() => {
    const fila = sync.fila.filter((i) => (!pessoa || i.ator_id === pessoa))
    return agruparLotes(fila).filter((l) => !termo || l.itens.some((i) => casa(i.tarefa_id))).map((l) => ({ ...l, _t: l.inicio }))
  }, [sync.fila, pessoa, termo, sync.tarefas]) // eslint-disable-line react-hooks/exhaustive-deps

  const ehRodada = (l) => l.origem === 'rodada' && (l.acao === 'resumo' || l.acao === 'erro')
  const recentes = (a, b) => new Date(b._t) - new Date(a._t)
  const recebidos = useMemo(() => sync.log.filter((l) => !ehRodada(l) && casa(l.tarefa_id, l.clickup_task_id)).map((l) => ({ ...l, _t: l.created_at })).sort(recentes), [sync.log, termo, sync.tarefas]) // eslint-disable-line react-hooks/exhaustive-deps
  const rodadas = useMemo(() => sync.log.filter(ehRodada).map((l) => ({ ...l, _t: l.created_at })).sort(recentes), [sync.log])
  const problemas = useMemo(() => {
    const ps = [
      ...erros.map((i) => ({ tipo: 'fila', x: i, _t: i.created_at })),
      ...sync.fila.filter((i) => i.status !== 'erro' && i.avisos?.length).map((i) => ({ tipo: 'fila', x: i, _t: i.created_at })),
      ...sync.log.filter((l) => ehProblemaLog(l) && !ehRodada(l)).map((l) => ({ tipo: 'log', x: l, _t: l.created_at })),
    ].filter((p) => (p.tipo === 'fila' ? casa(p.x.tarefa_id) : casa(p.x.tarefa_id, p.x.clickup_task_id)))
    return ps.sort((a, b) => new Date(b._t) - new Date(a._t))
  }, [erros, sync.fila, sync.log, termo, sync.tarefas]) // eslint-disable-line react-hooks/exhaustive-deps

  // histórico de uma tarefa só: edições (tarefas_atividade), envios e recebidos numa linha do tempo
  const historico = useMemo(() => {
    if (!tarefaFiltro) return []
    return [
      ...sync.fila.map((i) => ({ tipo: 'fila', x: i, _t: i.created_at })),
      ...sync.log.map((l) => ({ tipo: 'log', x: l, _t: l.created_at })),
      ...sync.atividade.map((a) => ({ tipo: 'edicao', x: a, _t: a.created_at })),
    ].sort((a, b) => new Date(b._t) - new Date(a._t))
  }, [tarefaFiltro, sync.fila, sync.log, sync.atividade])

  async function sincronizarAgora() {
    setRodando(true)
    try {
      const r = await sync.sincronizarAgora()
      onToast(r?.emAndamento ? 'Já há uma rodada em andamento' : 'Rodada concluída')
    } catch (e) { onToast(e.message, 'error') } finally { setRodando(false) }
  }

  const webhook = sync.estado.clickup_webhook
  const rodada = sync.estado.clickup
  const membros = useMemo(() => [...new Set(sync.fila.map((i) => i.ator_id).filter(Boolean))].map((id) => ({ id, nome: membrosMap.get(id)?.name || 'Alguém' })).sort((a, b) => a.nome.localeCompare(b.nome)), [sync.fila, membrosMap])
  const tarefaAlvo = tarefaFiltro ? sync.tarefas.get(tarefaFiltro) : null

  const ABAS = [
    ['problemas', 'Problemas', problemas.length],
    ['envios', 'Enviados ao ClickUp', null],
    ['recebidos', 'Recebidos do ClickUp', null],
    ['rodadas', 'Rodadas', null],
  ]

  return (
    <div className="p-5 flex flex-col gap-4 max-w-6xl">
      {sync.erro && <p className="text-[13px] text-ln-red">Não consegui carregar: {sync.erro}</p>}
      {sync.logIndisponivel && (
        <p className="ln-card px-4 py-2.5 text-[12px] text-[#8a6a14] dark:text-ln-yellow inline-flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />O rastro do que chega do ClickUp ainda não está ligado (migration 120). Os envios daqui aparecem normalmente.</p>
      )}

      {/* ── saúde + números ── */}
      {!tarefaFiltro && (<>
        <section className={`ln-card px-4 py-3 border-l-[3px] ${BORDA[saude.tom]} flex items-start gap-3`} aria-live="polite">
          {saude.tom === 'green' ? <CheckCircle2 className="w-5 h-5 text-ln-green shrink-0 mt-0.5" /> : saude.tom === 'accent' ? <Loader2 className="w-5 h-5 text-ln-accent animate-spin shrink-0 mt-0.5" /> : <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${saude.tom === 'red' ? 'text-ln-red' : 'text-ln-yellow'}`} />}
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-ln-t1">{saude.titulo}</p>
            <p className="text-[13px] text-ln-t3">{saude.texto}</p>
          </div>
        </section>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile icone={Send} k="Fila para o ClickUp" v={emAberto.length} tom={emAberto.length && Date.now() - Math.min(...emAberto.map((i) => new Date(i.created_at))) > FILA_ATRASADA_MS ? 'yellow' : undefined}
            sub={emAberto.length ? `mais antiga ${tempoRelativo(emAberto.reduce((m, i) => (i.created_at < m ? i.created_at : m), emAberto[0].created_at))}` : 'vazia'} />
          <Tile icone={AlertTriangle} k="Com erro" v={erros.length} tom={erros.length ? 'red' : undefined} sub={erros.length ? 'não chegaram ao ClickUp' : 'nenhum'} />
          <Tile icone={Webhook} k="Último evento do ClickUp" v={tempoRelativo(webhook?.ultimo_fim)} tom={webhook?.ultimo_ok === false ? 'yellow' : undefined}
            sub={webhook?.resumo ? `${webhook.resumo.evento || 'evento'} · ${ACAO_CURTA[webhook.resumo.acao] || webhook.resumo.acao || ''}` : 'webhook'} />
          <Tile icone={RefreshCw} k="Última rodada" v={tempoRelativo(rodada?.ultimo_fim || rodada?.ultimo_inicio)} tom={rodada?.ultimo_ok === false ? 'yellow' : undefined}
            sub={rodada?.ultimo_ok === false ? 'com erro' : rodada?.resumo ? `${(rodada.resumo.criadas || 0) + (rodada.resumo.atualizadas || 0)} tarefas atualizadas` : ''}
            acao={<button type="button" onClick={sincronizarAgora} disabled={rodando} className="ln-pill !h-6 mt-1 self-start disabled:opacity-50"><RefreshCw className={`w-3 h-3 ${rodando ? 'animate-spin' : ''}`} />{rodando ? 'Sincronizando…' : 'Sincronizar agora'}</button>} />
        </div>
        <ComoFunciona />
      </>)}

      {/* ── histórico de uma tarefa ── */}
      {tarefaFiltro ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => onFiltrarTarefa(null)} className="ln-pill"><X className="w-3.5 h-3.5" /> Ver tudo</button>
            <h2 className="text-[15px] font-bold text-ln-t1 truncate flex-1 min-w-0">Histórico de sincronização{tarefaAlvo ? <>: <span className="font-semibold">{tarefaAlvo.titulo}</span></> : ''}</h2>
            {tarefaAlvo && <button type="button" onClick={() => onAbrirTarefa(tarefaAlvo.id)} className="ln-pill">Abrir tarefa</button>}
            {tarefaAlvo?.clickup_url && <a href={tarefaAlvo.clickup_url} target="_blank" rel="noopener noreferrer" className="ln-pill">ClickUp <ExternalLink className="w-3 h-3" /></a>}
            {tarefaAlvo && (
              <button
                type="button" className="ln-pill"
                title="Manda todos os campos desta tarefa para o ClickUp"
                onClick={async () => {
                  if (!window.confirm('Mandar a tarefa inteira (todos os campos) para o ClickUp? O que estiver diferente lá será sobrescrito pela versão daqui.')) return
                  const r = await sync.forcar(tarefaAlvo.id)
                  onToast(r.error || 'Tarefa na fila para o ClickUp', r.error ? 'error' : undefined)
                }}
              ><Send className="w-3.5 h-3.5" /> Forçar envio ao ClickUp</button>
            )}
          </div>
          <p className="text-[12px] text-ln-t4">Edições feitas aqui, o que foi para o ClickUp e o que veio de lá, do mais recente para o mais antigo.</p>
          {sync.carregando && !historico.length ? <div className="py-12 flex justify-center text-ln-t4"><Loader2 className="w-4 h-4 animate-spin" /></div>
            : !historico.length ? <Vazio>Nada registrado para esta tarefa.</Vazio>
              : (
                <div className="flex flex-col gap-2">
                  <PorDia itens={historico} render={(h) => (
                    <div key={`${h.tipo}-${h.x.id}`} className="ln-card overflow-hidden flex">
                      <span className={`w-[92px] shrink-0 px-2 py-2.5 text-[11px] font-semibold inline-flex items-start gap-1 ${h.tipo === 'edicao' ? 'text-ln-t3' : h.tipo === 'fila' ? 'text-ln-accent' : 'text-[#2a7a4f] dark:text-ln-green'}`}>
                        {h.tipo === 'edicao' ? <><CircleDot className="w-3 h-3 mt-px" />Edição aqui</> : h.tipo === 'fila' ? <><ArrowUpRight className="w-3 h-3 mt-px" />Para o ClickUp</> : <><ArrowDownLeft className="w-3 h-3 mt-px" />Do ClickUp</>}
                      </span>
                      <div className="flex-1 min-w-0">
                        {h.tipo === 'fila' ? <ItemFila it={h.x} ctx={ctx} mostrarTarefa={false} />
                          : h.tipo === 'log' ? <LinhaLog l={h.x} ctx={ctx} mostrarTarefa={false} />
                            : (
                              <div className="py-2.5 px-3 text-[13px] flex items-center gap-2 min-w-0">
                                <span className="text-[11px] text-ln-t4 tabular w-10 shrink-0">{hora(h.x.created_at)}</span>
                                <span className="truncate"><b className="font-semibold text-ln-t1">{h.x.ator_nome || 'Alguém'}</b> <EdicaoTexto a={h.x} ctx={ctx} /></span>
                              </div>
                            )}
                      </div>
                    </div>
                  )} />
                </div>
              )}
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {ABAS.map(([k, rot, n]) => (
              <button key={k} type="button" onClick={() => setAba(k)} className={`ln-tab ${aba === k ? 'ln-tab-active' : ''}`} aria-pressed={aba === k}>
                {rot}{n ? <span className={`ml-0.5 px-1.5 rounded-full text-[10px] tabular ${k === 'problemas' ? 'bg-ln-red/15 text-ln-red' : 'bg-ln-ink/10'}`}>{n}</span> : null}
              </button>
            ))}
            <span className="w-px h-5 bg-ln-ink/10 mx-1" />
            {PERIODOS.map(([n, rot]) => <button key={n} type="button" onClick={() => setDias(n)} className={`ln-tab ${dias === n ? 'ln-tab-active' : ''}`} aria-pressed={dias === n}>{rot}</button>)}
            <div className="ml-auto flex items-center gap-2">
              {aba === 'envios' && membros.length > 0 && (
                <select className="ln-input !h-7 !w-[150px] text-xs" value={pessoa} onChange={(e) => setPessoa(e.target.value)} aria-label="Quem fez">
                  <option value="">Todas as pessoas</option>
                  {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              )}
              {aba === 'recebidos' && (
                <label className="inline-flex items-center gap-1.5 text-xs text-ln-t3 cursor-pointer" title="Eventos do ClickUp que não mudaram nada (a volta das edições feitas aqui)">
                  <input type="checkbox" checked={ecos} onChange={(e) => setEcos(e.target.checked)} /> Mostrar ecos
                </label>
              )}
              <label className="relative">
                <Search className="w-3.5 h-3.5 text-ln-t4 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input className="ln-input !h-7 !w-[190px] !pl-7 text-xs" placeholder="Buscar tarefa" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar tarefa" />
              </label>
              <button type="button" onClick={sync.recarregar} className="ln-iconbtn" aria-label="Recarregar" title="Recarregar (atualiza sozinho a cada 15 s)">
                {sync.carregando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {sync.carregando && !sync.fila.length && !sync.log.length ? (
            <div className="py-16 flex justify-center text-ln-t4"><Loader2 className="w-4 h-4 animate-spin" /></div>
          ) : aba === 'problemas' ? (
            !problemas.length ? <Vazio><CheckCircle2 className="w-5 h-5 text-ln-green mx-auto mb-1" />Nenhum problema {dias === 1 ? 'nas últimas 24 h' : `nos últimos ${dias} dias`}.</Vazio> : (
              <div className="flex flex-col gap-2">
                {erros.length > 1 && (
                  <div className="ln-card px-3 py-2 flex items-center gap-2">
                    <span className="text-[13px] text-ln-t2 flex-1">{erros.length} alterações com erro.</span>
                    <button type="button" onClick={async () => { const r = await sync.reenviar(erros.map((i) => i.id)); onToast(r.error || `${erros.length} de volta à fila`, r.error ? 'error' : undefined) }} className="ln-pill"><RotateCcw className="w-3.5 h-3.5" /> Tentar de novo todas</button>
                  </div>
                )}
                <PorDia itens={problemas} render={(p) => (
                  <div key={`${p.tipo}-${p.x.id}`} className={`ln-card overflow-hidden border-l-[3px] ${p.tipo === 'fila' && p.x.status === 'erro' ? BORDA.red : BORDA.yellow}`}>
                    <p className="px-3 pt-2 text-[11px] font-semibold text-ln-t4 inline-flex items-center gap-1">{p.tipo === 'fila' ? <><ArrowUpRight className="w-3 h-3" />Daqui para o ClickUp</> : <><ArrowDownLeft className="w-3 h-3" />Do ClickUp para cá</>}</p>
                    {p.tipo === 'fila' ? <ItemFila it={p.x} ctx={ctx} /> : <LinhaLog l={p.x} ctx={ctx} />}
                  </div>
                )} />
              </div>
            )
          ) : aba === 'envios' ? (
            !lotes.length ? <Vazio>Nenhuma alteração enviada ao ClickUp no período.</Vazio> : (
              <div className="flex flex-col gap-2">
                <p className="text-[12px] text-ln-t4">Cada linha é um lote: edições seguidas da mesma pessoa (um template aplicado, uma edição em massa) ficam juntas. Abra para ver tarefa por tarefa.</p>
                <PorDia itens={lotes.slice(0, 300)} render={(l) => <Lote key={l.id} lote={l} ctx={ctx} abertoInicial={l.cont.erro > 0 && l.total <= 5} />} />
              </div>
            )
          ) : aba === 'recebidos' ? (
            sync.logIndisponivel ? <Vazio>Disponível depois da migration 120.</Vazio> : !recebidos.length ? <Vazio>Nada recebido do ClickUp no período.</Vazio> : (
              <div className="flex flex-col gap-2">
                <p className="text-[12px] text-ln-t4"><b>Gravado</b> = o ClickUp mudou a tarefa aqui (com o antes e o depois). <b>Webhook</b> = evento que chegou e não mudou nada, com o motivo.</p>
                <PorDia itens={recebidos.slice(0, 500)} render={(l) => <div key={l.id} className="ln-card overflow-hidden"><LinhaLog l={l} ctx={ctx} /></div>} />
              </div>
            )
          ) : (
            sync.logIndisponivel ? <Vazio>Disponível depois da migration 120.</Vazio> : !rodadas.length ? <Vazio>Nenhuma rodada registrada no período.</Vazio> : (
              <div className="flex flex-col gap-2"><PorDia itens={rodadas} render={(l) => <Rodada key={l.id} l={l} />} /></div>
            )
          )}
        </section>
      )}
      <p className="text-[11px] text-ln-t4 inline-flex items-center gap-1.5"><Clock className="w-3 h-3" />Atualiza sozinho a cada 15 s. O rastro do que chega do ClickUp fica guardado por 30 dias.</p>
    </div>
  )
}
