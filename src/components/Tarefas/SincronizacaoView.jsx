// Seção Sincronização do VertaTask (/tarefas?aba=sincronizacao): o que foi e o que veio do
// ClickUp, para auditar uma ação em massa ou um template e para quem usa entender por que o
// ClickUp ainda não mostra uma mudança. Ida = fila tarefas_outbox agrupada em lotes; volta =
// tarefas_sync_log (migration 121); rodadas = resumo de cada /api/tarefas-sync. Com
// ?sync_tarefa=<id> vira o histórico de uma tarefa só (edições, envios e recebidos juntos).
import { useMemo, useState } from 'react'
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, CheckCircle2, ChevronDown, ChevronRight, CircleDot, Clock,
  ExternalLink, HelpCircle, History, Loader2, RefreshCw, RotateCcw, Search, Send, Webhook, X,
} from 'lucide-react'
import { useSincronizacao } from '../../hooks/useSincronizacao'
import { fmtDataHora, fmtDataCurta, fmtEstimativa, rotuloStatus, rotuloPrioridade, rotuloTipoTarefa, rotuloDificuldade, rotuloDepartamento } from '../../lib/tarefas'
import {
  agruparLotes, situacaoItem, saudeGeral, traduzirErro, traduzirAviso, traduzirMotivo, descreverLog, ehProblemaLog,
  rotuloCampo, tempoRelativo, fmtDuracao, rotuloOperacao, FILA_ATRASADA_MS, descreverRelacao, rotuloRelacao,
} from '../../lib/sincronizacao'
import { useI18n, t as tr } from '../../i18n'
import { FOCO } from './Campos'

const PERIODOS = [1, 7, 30] // dias; 1 aparece como "24 h"
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
  const vazio = tr('sincronizacao.valor.vazio')
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return vazio
  if (campo === 'status') return rotuloStatus(v)
  if (campo === 'prioridade') return rotuloPrioridade(v)
  // opções do ClickUp: as conhecidas traduzidas, as outras como vieram
  if (campo === 'tipo_tarefa') return rotuloTipoTarefa(v)
  if (campo === 'dificuldade') return rotuloDificuldade(v)
  if (campo === 'departamento') return (Array.isArray(v) ? v : String(v).split(',')).map((d) => rotuloDepartamento(String(d).trim())).join(', ')
  if (campo === 'data_inicio' || campo === 'data_vencimento') return fmtDataCurta(v)
  if (campo === 'estimativa_min') return fmtEstimativa(v) || vazio
  if (campo === 'responsaveis') return v.map((id) => ctx.membrosMap.get(id)?.name?.split(' ')[0] || tr('sincronizacao.valor.alguem')).join(', ')
  if (campo === 'lista_id') return ctx.listasMap.get(v)?.nome || tr('sincronizacao.valor.outraLista')
  if (campo === 'parent_id') return ctx.tarefas.get(v)?.titulo || tr('sincronizacao.valor.outraTarefa')
  if (campo === 'arquivada') return v ? tr('sincronizacao.valor.sim') : tr('sincronizacao.valor.nao')
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

function Mudancas({ campos, detalhe, ctx }) {
  const { t } = useI18n()
  if (!campos?.length) return null
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
      {campos.map((c) => {
        const d = detalhe?.[c]
        return (
          <span key={c} className="text-[12px] text-ln-t3">
            <span className="text-ln-t2 font-medium">{rotuloCampo(c)}</span>
            {d ? <>: <span className="line-through decoration-ln-t4/60">{valorLegivel(c, d.de, ctx)}</span> → <span className="text-ln-t1">{valorLegivel(c, d.para, ctx)}</span></> : <span className="text-ln-t4"> {t('sincronizacao.alterada')}</span>}
          </span>
        )
      })}
    </div>
  )
}

// linha de tarefas_atividade (edição de pessoa): valores vêm como texto; responsáveis separados por vírgula
function EdicaoTexto({ a, ctx }) {
  const { t } = useI18n()
  if (a.campo === 'criada') return <span className="text-ln-t3">{t('sincronizacao.criouTarefa')}</span>
  const val = (v) => valorLegivel(a.campo, a.campo === 'responsaveis' && v ? String(v).split(',') : v, ctx)
  const curto = (v) => String(v).slice(0, 60)
  return (
    <span className="text-ln-t3">{t('sincronizacao.mudou', { campo: rotuloCampo(a.campo) })}{a.campo === 'descricao' ? '' : <>: <span className="line-through decoration-ln-t4/60">{curto(val(a.valor_antigo))}</span> → <span className="text-ln-t2">{curto(val(a.valor_novo))}</span></>}</span>
  )
}

function NomeTarefa({ id, cu, ctx, className = '' }) {
  const { t: tt } = useI18n()
  const t = (id && ctx.tarefas.get(id)) || (cu && ctx.tarefas.get(`cu:${cu}`))
  if (!t) return <span className={`text-ln-t4 italic ${className}`}>{id || cu ? tt('sincronizacao.tarefaNaoExiste') : '—'}</span>
  const lista = ctx.listasMap.get(t.lista_id)
  const pasta = lista ? ctx.pastasMap.get(lista.pasta_id) : null
  return (
    <span className={`min-w-0 inline-flex items-center gap-1.5 ${className}`}>
      <button type="button" onClick={() => ctx.onAbrirTarefa(t.id)} className={`truncate text-left text-ln-t1 hover:text-ln-accent rounded ${FOCO}`} title={tt('sincronizacao.abrirNome', { nome: t.titulo })}>{t.titulo}</button>
      {pasta && <span className="hidden md:inline text-[11px] text-ln-t4 truncate max-w-[140px] shrink-0" title={`${pasta.nome} › ${lista.nome}`}>{pasta.nome}</span>}
      {t.arquivada && <Pilula>{tt('sincronizacao.arquivada')}</Pilula>}
      <button type="button" onClick={() => ctx.onFiltrarTarefa(t.id)} className={`ln-iconbtn !w-6 !h-6 shrink-0 ${FOCO}`} title={tt('sincronizacao.historicoDaTarefa')} aria-label={tt('sincronizacao.historicoDaTarefa')}><History className="w-3.5 h-3.5" /></button>
    </span>
  )
}

// ── ida: um item da fila ─────────────────────────────────────────────────────
function ItemFila({ it, ctx, mostrarTarefa = true }) {
  const { t } = useI18n()
  const s = situacaoItem(it)
  const [ocupado, setOcupado] = useState(false)
  const agir = async (fn, ok) => {
    setOcupado(true)
    const r = await fn([it.id])
    setOcupado(false)
    if (r.error) ctx.onToast(r.error, 'error'); else ctx.onToast(ok)
  }
  const espera = it.processed_at && it.status === 'ok' ? new Date(it.processed_at) - new Date(it.created_at) : null
  const rel = descreverRelacao(it)
  return (
    <div className="py-2.5 px-3 flex flex-col gap-1 border-t border-ln-ink/[0.06] first:border-t-0">
      <div className="flex items-center gap-2 min-w-0 text-[13px]">
        <span className="text-[11px] text-ln-t4 tabular w-10 shrink-0">{hora(it.created_at)}</span>
        <Pilula tom="muted">{rotuloOperacao(it.operacao)}</Pilula>
        {mostrarTarefa ? <NomeTarefa id={it.tarefa_id} ctx={ctx} className="flex-1" /> : <span className="flex-1 text-ln-t3 text-[12px]">{it.campos?.length ? it.campos.map(rotuloCampo).join(', ') : it.operacao === 'criar' ? t('sincronizacao.tarefaInteira') : ''}</span>}
        <Pilula tom={s.tom} title={it.processed_at ? t('sincronizacao.ultimaTentativa', { data: fmtDataHora(it.processed_at) }) : undefined}>{s.rotulo}</Pilula>
        {espera != null && <span className="hidden sm:inline text-[11px] text-ln-t4 tabular whitespace-nowrap" title={t('sincronizacao.tempoAteClickup')}>{t('sincronizacao.depois', { tempo: fmtDuracao(espera) })}</span>}
      </div>
      {mostrarTarefa && it.campos?.length > 0 && <p className="pl-12 text-[12px] text-ln-t3">{it.campos.map(rotuloCampo).join(', ')}</p>}
      {rel && (
        <p className="pl-12 text-[12px] text-ln-t3 flex items-center gap-1.5 min-w-0">
          <span className="shrink-0">{rel.rotulo}</span><NomeTarefa id={rel.outraId} ctx={ctx} className="min-w-0" />
          <span className="hidden sm:inline shrink-0 text-ln-t4">· {rel.clickup ? t('sincronizacao.viraNoClickup', { tipo: rel.clickup }) : t('sincronizacao.soNoVertaTask')}</span>
        </p>
      )}
      {it.erro && (
        <div className="pl-12 text-[12px] flex flex-col gap-0.5">
          <span className={it.status === 'erro' ? 'text-ln-red' : 'text-ln-t3'}>{traduzirErro(it.erro)}</span>
          {traduzirErro(it.erro) !== it.erro && <span className="text-ln-t4 font-mono text-[11px] break-all">{it.erro}</span>}
        </div>
      )}
      {it.avisos?.map((a, i) => <p key={i} className="pl-12 text-[12px] text-[#8a6a14] dark:text-ln-yellow inline-flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />{traduzirAviso(a)}</p>)}
      {it.resolvido_por && <p className="pl-12 text-[11px] text-ln-t4">{t(it.status === 'cancelado' ? 'sincronizacao.ignoradoPor' : 'sincronizacao.reenviadoPor', { nome: ctx.membrosMap.get(it.resolvido_por)?.name || t('sincronizacao.valor.alguem'), quando: tempoRelativo(it.resolvido_em) })}</p>}
      {it.status === 'erro' && (
        <div className="pl-12 flex gap-2 mt-0.5">
          <button type="button" disabled={ocupado} onClick={() => agir(ctx.sync.reenviar, t('sincronizacao.toast.deVolta'))} className="ln-pill !h-6 disabled:opacity-50"><RotateCcw className="w-3 h-3" /> {t('sincronizacao.tentarDeNovo')}</button>
          <button type="button" disabled={ocupado} onClick={() => agir(ctx.sync.ignorar, t('sincronizacao.toast.ignorado'))} className="ln-pill !h-6 disabled:opacity-50"><X className="w-3 h-3" /> {t('sincronizacao.ignorar')}</button>
        </div>
      )}
    </div>
  )
}

// ── ida: um lote (template, edição em massa ou edição avulsa) ────────────────
function Lote({ lote, ctx, abertoInicial = false }) {
  const { t, locale } = useI18n()
  const [aberto, setAberto] = useState(abertoInicial)
  const autor = lote.ator_id ? (ctx.membrosMap.get(lote.ator_id)?.name || t('sincronizacao.lote.alguemDoTime')) : t('sincronizacao.lote.semAutor')
  const { cont } = lote
  const ops = Object.entries(lote.ops).map(([k, n]) => `${n} ${rotuloOperacao(k).toLocaleLowerCase(locale)}`).join(' · ')
  const tom = cont.erro ? 'red' : lote.emAberto ? (lote.esperaMs > FILA_ATRASADA_MS ? 'yellow' : 'accent') : 'green'
  const status = cont.erro
    ? t('sincronizacao.lote.falharam', { count: cont.erro })
    : lote.emAberto
      ? t('sincronizacao.lote.enviando', { ok: cont.ok, total: lote.total - cont.ignorado - cont.cancelado, tempo: fmtDuracao(lote.esperaMs) })
      : lote.duracaoMs != null ? t('sincronizacao.lote.noClickupEm', { tempo: fmtDuracao(lote.duracaoMs) }) : (cont.cancelado || cont.ignorado) === lote.total ? t('sincronizacao.lote.cancelado') : t('sincronizacao.lote.noClickup')
  const comErro = lote.itens.filter((i) => i.status === 'erro').map((i) => i.id)
  return (
    <div className={`ln-card overflow-hidden border-l-[3px] ${BORDA[tom]}`}>
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} className={`w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-ln-ink/[0.02] ${FOCO}`}>
        {aberto ? <ChevronDown className="w-4 h-4 text-ln-t4 shrink-0" /> : <ChevronRight className="w-4 h-4 text-ln-t4 shrink-0" />}
        <span className="text-[12px] text-ln-t4 tabular w-10 shrink-0">{hora(lote.inicio)}</span>
        <span className="min-w-0 flex-1 flex flex-col">
          <span className="text-[13px] text-ln-t1 truncate">
            <b className="font-semibold">{autor}</b>{' '}
            {lote.total === 1 ? <>· {rotuloOperacao(lote.itens[0].operacao).toLocaleLowerCase(locale)} <span className="text-ln-t2">{ctx.tarefas.get(lote.itens[0].tarefa_id)?.titulo || t('sincronizacao.lote.tarefa')}</span></> : <>· {t('sincronizacao.lote.alteracoesEm', { n: lote.total, tarefas: t('sincronizacao.lote.nTarefas', { count: lote.tarefas }) })}</>}
          </span>
          <span className="text-[11px] text-ln-t4 truncate">{ops}{lote.campos.length ? ` · ${lote.campos.slice(0, 5).map(rotuloCampo).join(', ')}${lote.campos.length > 5 ? ` +${lote.campos.length - 5}` : ''}` : ''}{lote.avisos ? ` · ${t('sincronizacao.lote.comAviso', { count: lote.avisos })}` : ''}</span>
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
              <span className="text-[12px] text-ln-red flex-1">{t('sincronizacao.lote.falharamNoLote', { count: comErro.length })}</span>
              <button type="button" onClick={async () => { const r = await ctx.sync.reenviar(comErro); ctx.onToast(r.error || t('sincronizacao.toast.nDeVolta', { count: comErro.length }), r.error ? 'error' : undefined) }} className="ln-pill !h-6"><RotateCcw className="w-3 h-3" /> {t('sincronizacao.tentarTodas')}</button>
            </div>
          )}
          {lote.itens.slice().sort((a, b) => b.id - a.id).map((it) => <ItemFila key={it.id} it={it} ctx={ctx} />)}
        </div>
      )}
    </div>
  )
}

// ── volta: uma linha do log ──────────────────────────────────────────────────
// rótulo = chave de sincronizacao.origem
const ORIGEM = { clickup: ['gravado', ArrowDownLeft], webhook: ['webhook', Webhook], rodada: ['rodada', RefreshCw] }
function LinhaLog({ l, ctx, mostrarTarefa = true }) {
  const { t } = useI18n()
  const d = descreverLog(l)
  const [rot, Icone] = ORIGEM[l.origem] ? [t(`sincronizacao.origem.${ORIGEM[l.origem][0]}`), ORIGEM[l.origem][1]] : [l.origem, CircleDot]
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
        {l.origem === 'clickup' && !l.acao?.startsWith('relacao_') && <Mudancas campos={l.campos} detalhe={l.detalhe} ctx={ctx} />}
        {l.acao?.startsWith('relacao_') && l.detalhe?.relacionada_id && (
          <p className="text-[12px] text-ln-t3 flex items-center gap-1.5 min-w-0">
            <span className="shrink-0">{rotuloRelacao(l.detalhe.tipo)}</span><NomeTarefa id={l.detalhe.relacionada_id} ctx={ctx} className="min-w-0" />
          </p>
        )}
      </div>
    </div>
  )
}

function Rodada({ l }) {
  const { t, locale } = useI18n()
  const [aberto, setAberto] = useState(false)
  const r = l.detalhe || {}
  const via = r.via === 'user' ? (r.por?.nome ? t('sincronizacao.rodada.porNome', { nome: r.por.nome }) : t('sincronizacao.rodada.peloVertaTask')) : (r.via === 'cron' || r.via === 'script' ? t(`sincronizacao.rodada.via.${r.via}`) : r.via || '—')
  // chave de sincronizacao.rodada.numeros, valor
  const numeros = [
    ['lidas', r.tarefas_recebidas], ['criadas', r.criadas], ['atualizadas', r.atualizadas],
    ['puladasConflito', r.puladas_conflito], ['semPai', r.sem_pai], ['removidas', r.removidas], ['comentarios', r.comentarios],
    ['relacoesCriadas', r.relacoes_criadas], ['relacoesDesfeitas', r.relacoes_removidas],
  ].filter(([, n]) => n)
  const push = r.push && !r.push.erro ? [
    ['enviadas', (r.push.criadas || 0) + (r.push.atualizadas || 0) + (r.push.excluidas || 0)], ['relacoesEnviadas', r.push.relacoes],
    ['juntadas', r.push.agrupadas], ['canceladas', r.push.canceladas], ['errosEnvio', r.push.erros],
  ].filter(([, n]) => n) : []
  const avisos = [...(r.avisos || []), ...(r.push?.avisos || [])]
  return (
    <div className={`ln-card overflow-hidden border-l-[3px] ${l.acao === 'erro' ? BORDA.red : r.puladas_conflito || r.incompleto || avisos.length ? BORDA.yellow : BORDA.green}`}>
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} disabled={!avisos.length && l.acao !== 'erro'} className={`w-full text-left px-3 py-2.5 flex items-center gap-3 ${FOCO}`}>
        <span className="text-[12px] text-ln-t4 tabular w-10 shrink-0">{hora(l.created_at)}</span>
        <span className="min-w-0 flex-1 flex flex-col">
          <span className="text-[13px] text-ln-t1">{t('sincronizacao.rodada.titulo', { via })}{r.duracao_s ? <span className="text-ln-t4"> · {Number(r.duracao_s).toLocaleString(locale)} s</span> : null}</span>
          <span className="text-[11px] text-ln-t4">{l.acao === 'erro' ? (l.motivo || t('sincronizacao.rodada.falhou')) : [...numeros, ...push].map(([k, n]) => `${Number(n).toLocaleString(locale)} ${t(`sincronizacao.rodada.numeros.${k}`)}`).join(' · ') || t('sincronizacao.rodada.nadaNovo')}</span>
        </span>
        {r.webhook && r.webhook.status !== 'active' && <Pilula tom="yellow" title={r.webhook.aviso}>{r.webhook.reativado ? t('sincronizacao.rodada.webhookReativado') : `webhook ${r.webhook.status}`}</Pilula>}
        {r.reconciliar && <Pilula tom="muted" title={t('sincronizacao.rodada.reconciliacaoTitle')}>{t('sincronizacao.rodada.reconciliacao')}</Pilula>}
        {avisos.length > 0 && <Pilula tom="yellow">{t('sincronizacao.rodada.avisos', { count: avisos.length })}</Pilula>}
        {l.acao === 'erro' ? <Pilula tom="red">{t('sincronizacao.rodada.falhou')}</Pilula> : r.incompleto ? <Pilula tom="yellow" title={t('sincronizacao.rodada.incompletaTitle')}>{t('sincronizacao.rodada.incompleta')}</Pilula> : <Pilula tom="green">{t('sincronizacao.rodada.ok')}</Pilula>}
      </button>
      {aberto && avisos.length > 0 && (
        <ul className="border-t border-ln-ink/[0.08] px-4 py-2 flex flex-col gap-1 text-[12px] text-ln-t3">
          {avisos.slice(0, 60).map((a, i) => <li key={i}>{traduzirAviso(a)}</li>)}
        </ul>
      )}
    </div>
  )
}

// texto do dicionário com **negrito** marcado
const negrito = (txt) => String(txt).split(/\*\*(.+?)\*\*/).map((p, i) => (i % 2 ? <b key={i}>{p}</b> : p))
const ITENS_IDA = ['fila', 'lote', 'mesmaTarefa', 'tentativas', 'moverLista']
const ITENS_VOLTA = ['webhook', 'rodada', 'leve', 'incompleta', 'ignorados', 'conflito', 'naoVem', 'chat']

function ComoFunciona() {
  const { t } = useI18n()
  const [aberto, setAberto] = useState(false)
  return (
    <section className="ln-card overflow-hidden">
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} className={`w-full text-left px-4 py-2.5 flex items-center gap-2 text-[13px] font-semibold text-ln-t1 ${FOCO}`}>
        <HelpCircle className="w-4 h-4 text-ln-accent" /> {t('sincronizacao.como.titulo')}
        {aberto ? <ChevronDown className="w-4 h-4 text-ln-t4 ml-auto" /> : <ChevronRight className="w-4 h-4 text-ln-t4 ml-auto" />}
      </button>
      {aberto && (
        <div className="border-t border-ln-ink/[0.08] px-4 py-3 grid gap-3 md:grid-cols-2 text-[13px] text-ln-t2 leading-relaxed">
          <div>
            <p className="font-semibold text-ln-t1 inline-flex items-center gap-1.5 mb-1"><ArrowUpRight className="w-4 h-4 text-ln-accent" /> {t('sincronizacao.como.ida')}</p>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              {ITENS_IDA.map((k) => <li key={k}>{negrito(t(`sincronizacao.como.itensIda.${k}`))}</li>)}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-ln-t1 inline-flex items-center gap-1.5 mb-1"><ArrowDownLeft className="w-4 h-4 text-ln-accent" /> {t('sincronizacao.como.volta')}</p>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              {ITENS_VOLTA.map((k) => <li key={k}>{negrito(t(`sincronizacao.como.itensVolta.${k}`))}</li>)}
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
// chaves de sincronizacao.acaoCurta
const ACAO_CURTA = new Set(['atualizada', 'criada', 'removida', 'sem_mudanca', 'ignorado', 'pulada_conflito', 'erro'])

const Vazio = ({ children }) => <p className="ln-card px-4 py-8 text-center text-[13px] text-ln-t4">{children}</p>

export default function SincronizacaoView({ membrosMap, listasMap, pastasMap, tarefaFiltro, onFiltrarTarefa, onAbrirTarefa, onToast }) {
  const { t, lang } = useI18n()
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
      onToast(r?.emAndamento ? t('sincronizacao.toast.emAndamento') : t('sincronizacao.toast.rodadaConcluida'))
    } catch (e) { onToast(e.message, 'error') } finally { setRodando(false) }
  }

  const webhook = sync.estado.clickup_webhook
  const rodada = sync.estado.clickup
  // última conferência da saúde do webhook (rodada do cron); null = ativo ou não conferido
  const saudeWebhook = rodada?.resumo?.webhook && rodada.resumo.webhook.status !== 'active' ? rodada.resumo.webhook : null
  const membros = useMemo(() => [...new Set(sync.fila.map((i) => i.ator_id).filter(Boolean))].map((id) => ({ id, nome: membrosMap.get(id)?.name || t('sincronizacao.valor.alguemMaiusculo') })).sort((a, b) => a.nome.localeCompare(b.nome)), [sync.fila, membrosMap, lang]) // eslint-disable-line react-hooks/exhaustive-deps
  const tarefaAlvo = tarefaFiltro ? sync.tarefas.get(tarefaFiltro) : null

  const ABAS = [
    ['problemas', t('sincronizacao.abas.problemas'), problemas.length],
    ['envios', t('sincronizacao.abas.envios'), null],
    ['recebidos', t('sincronizacao.abas.recebidos'), null],
    ['rodadas', t('sincronizacao.abas.rodadas'), null],
  ]

  return (
    <div className="p-5 flex flex-col gap-4 max-w-6xl">
      {sync.erro && <p className="text-[13px] text-ln-red">{t('sincronizacao.erroCarregar', { erro: sync.erro })}</p>}
      {sync.logIndisponivel && (
        <p className="ln-card px-4 py-2.5 text-[12px] text-[#8a6a14] dark:text-ln-yellow inline-flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{t('sincronizacao.logIndisponivel')}</p>
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
          <Tile icone={Send} k={t('sincronizacao.tiles.fila')} v={emAberto.length} tom={emAberto.length && Date.now() - Math.min(...emAberto.map((i) => new Date(i.created_at))) > FILA_ATRASADA_MS ? 'yellow' : undefined}
            sub={emAberto.length ? t('sincronizacao.tiles.maisAntiga', { quando: tempoRelativo(emAberto.reduce((m, i) => (i.created_at < m ? i.created_at : m), emAberto[0].created_at)) }) : t('sincronizacao.tiles.vazia')} />
          <Tile icone={AlertTriangle} k={t('sincronizacao.tiles.comErro')} v={erros.length} tom={erros.length ? 'red' : undefined} sub={erros.length ? t('sincronizacao.tiles.naoChegaram') : t('sincronizacao.tiles.nenhum')} />
          <Tile icone={Webhook} k={t('sincronizacao.tiles.ultimoEvento')} v={tempoRelativo(webhook?.ultimo_fim)} tom={webhook?.ultimo_ok === false || saudeWebhook ? 'yellow' : undefined}
            sub={saudeWebhook ? (saudeWebhook.reativado ? t('sincronizacao.tiles.webhookReativado') : `webhook ${saudeWebhook.status}`) : webhook?.resumo ? `${webhook.resumo.evento || t('sincronizacao.tiles.evento')} · ${ACAO_CURTA.has(webhook.resumo.acao) ? t(`sincronizacao.acaoCurta.${webhook.resumo.acao}`) : webhook.resumo.acao || ''}` : 'webhook'} />
          <Tile icone={RefreshCw} k={t('sincronizacao.tiles.ultimaRodada')} v={tempoRelativo(rodada?.ultimo_fim || rodada?.ultimo_inicio)} tom={rodada?.ultimo_ok === false ? 'yellow' : undefined}
            sub={rodada?.ultimo_ok === false ? t('sincronizacao.tiles.comErroMinusculo') : rodada?.resumo?.incompleto ? t('sincronizacao.tiles.incompleta') : rodada?.resumo ? `${rodada.resumo.por?.nome ? `${t('sincronizacao.rodada.porNome', { nome: rodada.resumo.por.nome.split(' ')[0] })} · ` : ''}${t('sincronizacao.tiles.tarefasAtualizadas', { count: (rodada.resumo.criadas || 0) + (rodada.resumo.atualizadas || 0) })}` : ''}
            acao={<button type="button" onClick={sincronizarAgora} disabled={rodando} className="ln-pill !h-6 mt-1 self-start disabled:opacity-50"><RefreshCw className={`w-3 h-3 ${rodando ? 'animate-spin' : ''}`} />{rodando ? t('comum.sincronizando') : t('sincronizacao.sincronizarAgora')}</button>} />
        </div>
        <ComoFunciona />
      </>)}

      {/* ── histórico de uma tarefa ── */}
      {tarefaFiltro ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => onFiltrarTarefa(null)} className="ln-pill"><X className="w-3.5 h-3.5" /> {t('sincronizacao.historico.verTudo')}</button>
            <h2 className="text-[15px] font-bold text-ln-t1 truncate flex-1 min-w-0">{t('sincronizacao.historico.titulo')}{tarefaAlvo ? <>: <span className="font-semibold">{tarefaAlvo.titulo}</span></> : ''}</h2>
            {tarefaAlvo && <button type="button" onClick={() => onAbrirTarefa(tarefaAlvo.id)} className="ln-pill">{t('sincronizacao.historico.abrirTarefa')}</button>}
            {tarefaAlvo?.clickup_url && <a href={tarefaAlvo.clickup_url} target="_blank" rel="noopener noreferrer" className="ln-pill">ClickUp <ExternalLink className="w-3 h-3" /></a>}
            {tarefaAlvo && (
              <button
                type="button" className="ln-pill"
                title={t('sincronizacao.historico.forcarTitle')}
                onClick={async () => {
                  if (!window.confirm(t('sincronizacao.historico.forcarConfirmar'))) return
                  const r = await sync.forcar(tarefaAlvo.id)
                  onToast(r.error || t('sincronizacao.toast.tarefaNaFila'), r.error ? 'error' : undefined)
                }}
              ><Send className="w-3.5 h-3.5" /> {t('sincronizacao.historico.forcar')}</button>
            )}
          </div>
          <p className="text-[12px] text-ln-t4">{t('sincronizacao.historico.ajuda')}</p>
          {sync.carregando && !historico.length ? <div className="py-12 flex justify-center text-ln-t4"><Loader2 className="w-4 h-4 animate-spin" /></div>
            : !historico.length ? <Vazio>{t('sincronizacao.historico.vazio')}</Vazio>
              : (
                <div className="flex flex-col gap-2">
                  <PorDia itens={historico} render={(h) => (
                    <div key={`${h.tipo}-${h.x.id}`} className="ln-card overflow-hidden flex">
                      <span className={`w-[92px] shrink-0 px-2 py-2.5 text-[11px] font-semibold inline-flex items-start gap-1 ${h.tipo === 'edicao' ? 'text-ln-t3' : h.tipo === 'fila' ? 'text-ln-accent' : 'text-[#2a7a4f] dark:text-ln-green'}`}>
                        {h.tipo === 'edicao' ? <><CircleDot className="w-3 h-3 mt-px" />{t('sincronizacao.historico.edicaoAqui')}</> : h.tipo === 'fila' ? <><ArrowUpRight className="w-3 h-3 mt-px" />{t('sincronizacao.historico.paraClickup')}</> : <><ArrowDownLeft className="w-3 h-3 mt-px" />{t('sincronizacao.historico.doClickup')}</>}
                      </span>
                      <div className="flex-1 min-w-0">
                        {h.tipo === 'fila' ? <ItemFila it={h.x} ctx={ctx} mostrarTarefa={false} />
                          : h.tipo === 'log' ? <LinhaLog l={h.x} ctx={ctx} mostrarTarefa={false} />
                            : (
                              <div className="py-2.5 px-3 text-[13px] flex items-center gap-2 min-w-0">
                                <span className="text-[11px] text-ln-t4 tabular w-10 shrink-0">{hora(h.x.created_at)}</span>
                                <span className="truncate"><b className="font-semibold text-ln-t1">{h.x.ator_nome || t('sincronizacao.valor.alguemMaiusculo')}</b> <EdicaoTexto a={h.x} ctx={ctx} /></span>
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
            {PERIODOS.map((n) => <button key={n} type="button" onClick={() => setDias(n)} className={`ln-tab ${dias === n ? 'ln-tab-active' : ''}`} aria-pressed={dias === n}>{n === 1 ? '24 h' : t('comum.dias', { count: n })}</button>)}
            <div className="ml-auto flex items-center gap-2">
              {aba === 'envios' && membros.length > 0 && (
                <select className="ln-input !h-7 !w-[150px] text-xs" value={pessoa} onChange={(e) => setPessoa(e.target.value)} aria-label={t('sincronizacao.filtros.quemFez')}>
                  <option value="">{t('sincronizacao.filtros.todasPessoas')}</option>
                  {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              )}
              {aba === 'recebidos' && (
                <label className="inline-flex items-center gap-1.5 text-xs text-ln-t3 cursor-pointer" title={t('sincronizacao.filtros.ecosTitle')}>
                  <input type="checkbox" checked={ecos} onChange={(e) => setEcos(e.target.checked)} /> {t('sincronizacao.filtros.mostrarEcos')}
                </label>
              )}
              <label className="relative">
                <Search className="w-3.5 h-3.5 text-ln-t4 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input className="ln-input !h-7 !w-[190px] !pl-7 text-xs" placeholder={t('sincronizacao.filtros.buscarTarefa')} value={busca} onChange={(e) => setBusca(e.target.value)} aria-label={t('sincronizacao.filtros.buscarTarefa')} />
              </label>
              <button type="button" onClick={sync.recarregar} className="ln-iconbtn" aria-label={t('sincronizacao.filtros.recarregar')} title={t('sincronizacao.filtros.recarregarTitle')}>
                {sync.carregando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {sync.carregando && !sync.fila.length && !sync.log.length ? (
            <div className="py-16 flex justify-center text-ln-t4"><Loader2 className="w-4 h-4 animate-spin" /></div>
          ) : aba === 'problemas' ? (
            !problemas.length ? <Vazio><CheckCircle2 className="w-5 h-5 text-ln-green mx-auto mb-1" />{dias === 1 ? t('sincronizacao.vazios.problemas24h') : t('sincronizacao.vazios.problemasDias', { count: dias })}</Vazio> : (
              <div className="flex flex-col gap-2">
                {erros.length > 1 && (
                  <div className="ln-card px-3 py-2 flex items-center gap-2">
                    <span className="text-[13px] text-ln-t2 flex-1">{t('sincronizacao.nComErro', { count: erros.length })}</span>
                    <button type="button" onClick={async () => { const r = await sync.reenviar(erros.map((i) => i.id)); onToast(r.error || t('sincronizacao.toast.nDeVolta', { count: erros.length }), r.error ? 'error' : undefined) }} className="ln-pill"><RotateCcw className="w-3.5 h-3.5" /> {t('sincronizacao.tentarTodas')}</button>
                  </div>
                )}
                <PorDia itens={problemas} render={(p) => (
                  <div key={`${p.tipo}-${p.x.id}`} className={`ln-card overflow-hidden border-l-[3px] ${p.tipo === 'fila' && p.x.status === 'erro' ? BORDA.red : BORDA.yellow}`}>
                    <p className="px-3 pt-2 text-[11px] font-semibold text-ln-t4 inline-flex items-center gap-1">{p.tipo === 'fila' ? <><ArrowUpRight className="w-3 h-3" />{t('sincronizacao.como.ida')}</> : <><ArrowDownLeft className="w-3 h-3" />{t('sincronizacao.como.volta')}</>}</p>
                    {p.tipo === 'fila' ? <ItemFila it={p.x} ctx={ctx} /> : <LinhaLog l={p.x} ctx={ctx} />}
                  </div>
                )} />
              </div>
            )
          ) : aba === 'envios' ? (
            !lotes.length ? <Vazio>{t('sincronizacao.vazios.envios')}</Vazio> : (
              <div className="flex flex-col gap-2">
                <p className="text-[12px] text-ln-t4">{t('sincronizacao.ajudaLotes')}</p>
                <PorDia itens={lotes.slice(0, 300)} render={(l) => <Lote key={l.id} lote={l} ctx={ctx} abertoInicial={l.cont.erro > 0 && l.total <= 5} />} />
              </div>
            )
          ) : aba === 'recebidos' ? (
            sync.logIndisponivel ? <Vazio>{t('sincronizacao.vazios.migration')}</Vazio> : !recebidos.length ? <Vazio>{t('sincronizacao.vazios.recebidos')}</Vazio> : (
              <div className="flex flex-col gap-2">
                <p className="text-[12px] text-ln-t4">{negrito(t('sincronizacao.ajudaRecebidos'))}</p>
                <PorDia itens={recebidos.slice(0, 500)} render={(l) => <div key={l.id} className="ln-card overflow-hidden"><LinhaLog l={l} ctx={ctx} /></div>} />
              </div>
            )
          ) : (
            sync.logIndisponivel ? <Vazio>{t('sincronizacao.vazios.migration')}</Vazio> : !rodadas.length ? <Vazio>{t('sincronizacao.vazios.rodadas')}</Vazio> : (
              <div className="flex flex-col gap-2"><PorDia itens={rodadas} render={(l) => <Rodada key={l.id} l={l} />} /></div>
            )
          )}
        </section>
      )}
      <p className="text-[11px] text-ln-t4 inline-flex items-center gap-1.5"><Clock className="w-3 h-3" />{t('sincronizacao.rodape')}</p>
    </div>
  )
}
