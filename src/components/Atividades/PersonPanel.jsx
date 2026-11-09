// Corpo do painel lateral de uma pessoa (módulo Atividades, visual do Linear).
// O container e o cabeçalho do painel ficam fora; aqui vai o conteúdo rolável
// (cabeçalho da pessoa, KPIs, gráfico, alertas, clientes, abas de tarefas) e
// o rodapé fixo com as ações.
import { useId, useState, useEffect, useRef } from 'react'
import { AlertTriangle, Plus, RefreshCw, Loader2, Pencil, ChevronDown, ChevronRight, X, CheckCircle2 } from 'lucide-react'
import CargaDiaria from './CargaDiaria'
import { PrioridadeIcon, PRIORIDADE_LABEL } from './IssueList'
import {
  NIVEIS, diaDe, tomOcupacao,
  fmtHoras, fmtCurta, fmtDiaCurto, fmtPct, fmtHora, fmtRelativo, iniciais, primeiroNome, parseDuracao, hojeISO,
  rotuloNivel, textoSaude, rotuloOrigem,
} from '../../lib/atividadesCarga'
import { useI18n, t as tr, localeAtual } from '../../i18n'
import { rotuloTipoTarefa, rotuloDepartamento, rotuloStatus } from '../../lib/tarefas'
import { addDias, rotuloDia } from '../../lib/atividadesConcluidas'
import { useConcluidas } from '../../hooks/useConcluidas'
import { TIPOS_TAREFA } from '../../hooks/usePlanejador'

const FOCO = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ln-t2'

const TOM = {
  neutro:   'text-ln-t1',
  ambar:    'text-ln-yellow',
  vermelho: 'text-ln-red',
  laranja:  'text-ln-orange',
}

// `label`/`vazio` ficam em português; a tela traduz pelo id (atividades.pessoa.abas / .vazio)
export const ABAS = [
  { id: 'fila',      label: 'Fila',      vazio: 'Nada com data nos próximos 10 dias úteis' },
  { id: 'atrasadas', label: 'Atrasadas', vazio: 'Nenhuma atrasada contada no cálculo' },
  { id: 'semdata',   label: 'Sem data',  vazio: 'Todas as tarefas abertas têm data' },
  { id: 'zumbis',    label: 'Zumbis',    vazio: 'Nenhuma atrasada antiga fora do cálculo' },
  { id: 'concluidas', label: 'Concluídas', vazio: 'Nada concluído no período' },
]
const ABA_PADRAO = 'fila'

// Períodos da aba Concluídas. `dias` = janela que termina hoje (inclusive);
// 'ontem' é o dia anterior sozinho, para ver só o que fechou no dia passado.
// O rótulo vem de atividades.pessoa.periodos.<id>.
const PERIODOS_CONCLUIDAS = [
  { id: 'hoje',   label: 'Hoje',    dias: 1 },
  { id: 'ontem',  label: 'Ontem' },
  { id: '7dias',  label: '7 dias',  dias: 7 },
  { id: '30dias', label: '30 dias', dias: 30 },
]
function intervaloConcluidas(periodo, hoje) {
  if (periodo === 'ontem') { const o = addDias(hoje, -1); return { desde: o, ate: o } }
  const def = PERIODOS_CONCLUIDAS.find((p) => p.id === periodo && p.dias) || PERIODOS_CONCLUIDAS[2]
  return { desde: addDias(hoje, -(def.dias - 1)), ate: hoje }
}

// Status do ClickUp (dado): em português aparece como veio; nos outros idiomas, traduzido se conhecido.
function statusTela(status, lang) {
  return lang === 'pt' ? status : rotuloStatus(status)
}

function normalizarAba(aba) {
  return ABAS.some((a) => a.id === aba) ? aba : ABA_PADRAO
}

// Ordem de exibição: urgente > alta > normal > baixa > sem prioridade; dentro
// da mesma prioridade, pelo dia em que entram na agenda (ou vencimento).
const ORDEM_PRIORIDADE = { urgent: 0, high: 1, normal: 2, low: 3 }
function pesoPrioridade(t) {
  const p = ORDEM_PRIORIDADE[String(t.prioridade || '').toLowerCase()]
  return p === undefined ? 4 : p
}
function ordenarPorPrioridade(itens) {
  return [...itens].sort((a, b) => {
    const d = pesoPrioridade(a) - pesoPrioridade(b)
    if (d !== 0) return d
    const da = a.dia || a.vencimento || '9999', db = b.dia || b.vencimento || '9999'
    return da < db ? -1 : da > db ? 1 : 0
  })
}

// Grupos de prioridade da lista (estilo dos grupos por status do Linear); rótulo em atividades.prioridade.<id>
const GRUPOS_PRIORIDADE = [
  { id: 'urgent', label: 'Urgente',        cls: 'bg-ln-red/15 text-ln-red ring-ln-red/30' },
  { id: 'high',   label: 'Alta',           cls: 'bg-ln-orange/15 text-ln-orange ring-ln-orange/30' },
  { id: 'normal', label: 'Normal',         cls: 'bg-ln-blue/15 text-ln-blue ring-ln-blue/30' },
  { id: 'low',    label: 'Baixa',          cls: 'bg-ln-ink/5 text-ln-t3 ring-ln-ink/10' },
  { id: 'none',   label: 'Sem prioridade', cls: 'bg-ln-ink/5 text-ln-t4 ring-ln-ink/10' },
]
function grupoDe(t) {
  const p = String(t.prioridade || '').toLowerCase()
  return ORDEM_PRIORIDADE[p] === undefined ? 'none' : p
}
function agruparPorPrioridade(itens) {
  return GRUPOS_PRIORIDADE
    .map((g) => ({ ...g, itens: itens.filter((t) => grupoDe(t) === g.id), horas: itens.filter((t) => grupoDe(t) === g.id).reduce((s, t) => s + (Number(t.horas) || 0), 0) }))
    .filter((g) => g.itens.length > 0)
}

function itensDaAba(pessoa, aba, diaFiltro = null) {
  const fila = pessoa.filaProxima || []
  // o filtro de dia (clique no gráfico) vale para o que tem dia na agenda
  const porDia = (arr) => (diaFiltro ? arr.filter((t) => t.dia === diaFiltro) : arr)
  if (aba === 'atrasadas') return ordenarPorPrioridade(porDia(fila.filter((t) => t.atrasada)))
  if (aba === 'semdata') return ordenarPorPrioridade(pessoa.semData || [])
  if (aba === 'zumbis') return ordenarPorPrioridade(pessoa.zumbis || [])
  return ordenarPorPrioridade(porDia(fila))
}

function alertasDe(pessoa) {
  const t = pessoa.totais || {}
  const out = []
  if ((pessoa.pctSemEstimativa || 0) >= 30) {
    out.push({
      id: 'estimativa',
      texto: tr('atividades.pessoa.alertas.estimativa', { pct: pessoa.pctSemEstimativa }),
      title: tr('atividades.pessoa.alertas.estimativaTitle', { count: Number(t.semEstimativa?.tarefas) || 0 }),
    })
  }
  if (pessoa.picoDeData) {
    out.push({
      id: 'pico',
      texto: tr('atividades.pessoa.alertas.pico', { dia: fmtDiaCurto(pessoa.picoDeData) }),
      title: tr('atividades.pessoa.alertas.picoTitle'),
    })
  }
  if ((Number(t.alemDoHorizonte) || 0) > 0) {
    out.push({
      id: 'alem',
      texto: tr('atividades.pessoa.alertas.alem', { horas: fmtHoras(t.alemDoHorizonte) }),
      title: tr('atividades.pessoa.alertas.alemTitle'),
    })
  }
  if ((Number(t.sobraFinal) || 0) > 0) {
    out.push({
      id: 'sobra',
      texto: tr('atividades.pessoa.alertas.sobra', { horas: fmtHoras(t.sobraFinal) }),
      title: tr('atividades.pessoa.alertas.sobraTitle'),
    })
  }
  return out
}

// ─── Peças ───────────────────────────────────────────────────────────────────

function Avatar({ pessoa }) {
  const avatar = pessoa.avatar || ''
  const foto = pessoa.foto || (/^https?:\/\//.test(avatar) ? avatar : null)
  if (foto) {
    return <img src={foto} alt="" referrerPolicy="no-referrer" className="w-6 h-6 rounded-full object-cover shrink-0" />
  }
  return (
    <span className="w-6 h-6 rounded-full bg-ln-brand/20 text-ln-brand text-[10px] font-semibold flex items-center justify-center shrink-0" aria-hidden="true">
      {avatar || iniciais(pessoa.nome)}
    </span>
  )
}

function Cabecalho({ pessoa, atualizadoEm }) {
  const { t } = useI18n()
  const saude = pessoa.saude || {}
  const nivel = NIVEIS[saude.nivel] || NIVEIS.sem_leitura
  const rotulo = rotuloNivel(NIVEIS[saude.nivel] ? saude.nivel : 'sem_leitura')
  const texto = textoSaude(saude)
  const deps = (pessoa.departamentos || []).filter(Boolean)
  const linha = [
    deps.length ? deps.map(rotuloDepartamento).join(', ') : t('atividades.semDepartamento'),
    t('atividades.porDia', { horas: fmtHoras(pessoa.capacidadeDia) }),
    atualizadoEm ? t('atividades.pessoa.atualizadoAs', { hora: fmtHora(atualizadoEm) }) : null,
  ].filter(Boolean).join(' · ')
  return (
    <header className="flex items-start gap-3">
      <Avatar pessoa={pessoa} />
      <div className="min-w-0 flex-1">
        <h2 className="text-[20px] font-semibold leading-6 tracking-[-0.01em] text-ln-t2 truncate" title={pessoa.nome}>
          {pessoa.nome || t('atividades.semNome')}
        </h2>
        <p className="mt-0.5 text-xs text-ln-t3 truncate" title={linha}>{linha}</p>
        <div className="mt-2">
          <span
            className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-xs font-medium ${nivel.bg} ${nivel.text}`}
            title={texto || rotulo}
          >
            <i className={`w-2 h-2 rounded-full ${nivel.dot}`} aria-hidden="true" />
            {rotulo}
            {saude.suspeito && <span className="text-[10px] opacity-80" aria-label={t('atividades.pessoa.leituraSuspeita')}>?</span>}
          </span>
        </div>
        {texto && <p className="mt-1 text-xs text-ln-t3">{texto}</p>}
      </div>
    </header>
  )
}

function Kpi({ label, valor, sub, tom = 'text-ln-t1', title }) {
  return (
    <div className="ln-card px-3 py-2 min-w-0" title={title}>
      <p className="text-[11px] text-ln-t4 truncate">{label}</p>
      <p className={`mt-0.5 text-base font-semibold leading-5 tabular truncate ${tom}`}>{valor}</p>
      {sub && <p className="text-[11px] text-ln-t3 truncate">{sub}</p>}
    </div>
  )
}

function Kpis({ pessoa }) {
  const { t } = useI18n()
  const tot = pessoa.totais || {}
  const ocupacao = Number(tot.ocupacaoProximosDias) || 0
  const atrasadas = Number(tot.atrasadas) || 0
  const zumbis = Number(tot.zumbis) || 0
  const semData = Number(tot.semData) || 0
  const fila = pessoa.filaProxima || []
  return (
    <div className="grid grid-cols-2 gap-2">
      <Kpi
        label={t('atividades.colunas.ocupacao10d')}
        valor={fmtPct(ocupacao)}
        sub={t('atividades.hDeH', { a: fmtHoras(tot.horasProximosDias), b: fmtHoras(tot.capacidadeProximosDias) })}
        tom={tomOcupacao(ocupacao).text}
        title={t('atividades.pessoa.kpi.ocupacaoTitle')}
      />
      <Kpi
        label={t('atividades.colunas.fila')}
        valor={`${Number(tot.consideradas) || 0} · ${fmtHoras(tot.horasConsideradas)}`}
        sub={t('atividades.pessoa.kpi.filaSub', { n: fila.length })}
        title={t('atividades.pessoa.kpi.filaTitle')}
      />
      <Kpi
        label={t('atividades.colunas.atrasadas')}
        valor={`${atrasadas} · ${fmtHoras(tot.horasAtrasadas)}`}
        sub={t('atividades.caemEmHojeCalculo')}
        tom={atrasadas > 0 ? TOM.ambar : TOM.neutro}
        title={t('atividades.pessoa.kpi.atrasadasTitle')}
      />
      <Kpi
        label={t('atividades.foraDoCalculo')}
        valor={String(zumbis + semData)}
        sub={t('atividades.pessoa.kpi.foraSub', { zumbis, semData })}
        tom={zumbis > 0 ? TOM.laranja : TOM.neutro}
        title={t('atividades.pessoa.kpi.foraTitle')}
      />
    </div>
  )
}

// Relógio de São Paulo em horas decimais (ex.: 14:30 → 14.5), atualizado a cada minuto
function horaAgoraSP() {
  const partes = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date())
  const h = Number(partes.find((x) => x.type === 'hour')?.value) || 0
  const m = Number(partes.find((x) => x.type === 'minute')?.value) || 0
  return h + m / 60
}
function fmtHM(h) {
  const total = Math.round(Math.max(0, h) * 60)
  const hh = Math.floor(total / 60), mm = total % 60
  if (hh === 0) return `${mm} min`
  return mm ? `${hh}h${String(mm).padStart(2, '0')}` : `${hh}h`
}

/**
 * Tarefas de hoje contra o que falta de relógio até o fim do expediente.
 * Responde: essa pessoa termina o dia ou vai empurrar coisa para amanhã?
 */
function HojeAteFim({ pessoa, fimExpediente = 18 }) {
  const { t } = useI18n()
  const [agora, setAgora] = useState(() => horaAgoraSP())
  useEffect(() => {
    const timer = setInterval(() => setAgora(horaAgoraSP()), 60 * 1000)
    return () => clearInterval(timer)
  }, [])
  const d = pessoa.diaHoje
  if (!d) {
    return (
      <div className="ln-card px-3 py-2.5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] text-ln-t4">{t('atividades.pessoa.hoje.ateAs', { h: fimExpediente })}</p>
          <p className="text-[13px] text-ln-t2">{t('atividades.pessoa.hoje.fimDeSemana')}</p>
        </div>
        {pessoa.proximoDia && <p className="text-xs text-ln-t3 tabular">{t('atividades.pessoa.hoje.proximoDiaUtil', { dia: fmtDiaCurto(pessoa.proximoDia.data), horas: fmtHoras(pessoa.proximoDia.cargaOriginal) })}</p>}
      </div>
    )
  }
  // cargaOriginal = tarefas que vencem hoje + atrasadas (caem em hoje), sem o teto da capacidade
  const horasHoje = Number(d.cargaOriginal) || 0
  const restante = Math.max(0, fimExpediente - agora)
  const acabou = agora >= fimExpediente
  const sobra = Math.max(0, horasHoje - restante)
  const cabe = sobra <= 0
  const escala = Math.max(horasHoje, restante, 0.01)
  const pctHoje = Math.min(100, (horasHoje / escala) * 100)
  const pctRestante = Math.min(100, (restante / escala) * 100)
  const tom = acabou && horasHoje > 0 ? 'text-ln-red' : cabe ? 'text-ln-green' : 'text-ln-red'
  const veredito = horasHoje === 0
    ? t('atividades.pessoa.hoje.nadaVencendo')
    : acabou
      ? t('atividades.pessoa.hoje.encerrado', { horas: fmtHoras(horasHoje) })
      : cabe
        ? t('atividades.pessoa.hoje.fecha', { folga: fmtHM(restante - horasHoje) })
        : t('atividades.pessoa.hoje.naoFecha', { sobra: fmtHM(sobra), h: fimExpediente })
  return (
    <div className={`ln-card px-3 py-2.5 ${!cabe && horasHoje > 0 ? '!border-ln-red/40' : ''}`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] text-ln-t4">{t('atividades.pessoa.hoje.ateAs', { h: fimExpediente })}</p>
        <p className="text-[11px] text-ln-t4 tabular">{t('atividades.pessoa.hoje.agoraFaltam', { agora: fmtHM(agora).replace(' min', 'min'), faltam: fmtHM(restante) })}</p>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={`text-lg font-semibold tabular ${tom}`}>{fmtHoras(horasHoje)}</span>
        <span className="text-xs text-ln-t3">{t('atividades.pessoa.hoje.deTarefas', { tarefas: t('atividades.nTarefas', { count: Number(d.tarefas) || 0 }) })}</span>
        <span className="text-xs text-ln-t4">·</span>
        <span className="text-xs text-ln-t3 tabular">{t('atividades.pessoa.hoje.relogio', { tempo: fmtHM(restante), h: fimExpediente })}</span>
      </div>
      {/* duas réguas na mesma escala: tarefas de hoje x tempo que falta */}
      <div className="mt-2 space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-16 text-[10px] text-ln-t4">{t('atividades.pessoa.hoje.reguaTarefas')}</span>
          <div className="flex-1 h-1.5 rounded-full bg-ln-ink/[0.06] overflow-hidden">
            <div className={`h-full ${cabe ? 'bg-ln-brand/70' : 'bg-ln-red/80'}`} style={{ width: `${pctHoje}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-16 text-[10px] text-ln-t4">{t('atividades.pessoa.hoje.reguaAte', { h: fimExpediente })}</span>
          <div className="flex-1 h-1.5 rounded-full bg-ln-ink/[0.06] overflow-hidden">
            <div className="h-full bg-ln-green/70" style={{ width: `${pctRestante}%` }} />
          </div>
        </div>
      </div>
      <p className={`mt-2 text-xs font-medium ${tom}`}>{veredito}</p>
    </div>
  )
}

function LinhaDia({ pessoa, diaSelecionado }) {
  const { t } = useI18n()
  if (!pessoa.resumo?.length) return null
  const d = diaDe(pessoa, diaSelecionado)
  let rotulo = t('comum.hoje')
  if (diaSelecionado) rotulo = t('atividades.pessoa.dia.selecionado', { dia: fmtDiaCurto(diaSelecionado) })
  else if (!pessoa.diaHoje && d) rotulo = t('atividades.pessoa.dia.fimDeSemana', { dia: fmtDiaCurto(d.data) })
  if (!d) return <p className="mt-2 text-xs text-ln-t4">{t('atividades.pessoa.dia.foraResumo', { rotulo })}</p>
  const estoura = (Number(d.excedente) || 0) > 0
  const livre = Number(d.livre) || 0
  return (
    <p className="mt-2 text-xs text-ln-t3">
      <span className="text-ln-t4">{rotulo}:</span>{' '}
      <span className={`tabular ${estoura ? TOM.vermelho : 'text-ln-t2'}`}>{t('atividades.hDeH', { a: fmtHoras(d.carga), b: fmtHoras(d.capacidade) })}</span>
      {' · '}
      <span className="tabular">{t('atividades.nTarefas', { count: Number(d.tarefas) || 0 })}</span>
      {estoura && <span className={TOM.vermelho}> · {t('atividades.pessoa.dia.estoura', { horas: fmtHoras(d.excedente) })}</span>}
      {!estoura && livre > 0 && <span> · {t('atividades.pessoa.dia.livres', { horas: fmtHoras(livre) })}</span>}
    </p>
  )
}

function Alertas({ alertas }) {
  const { t } = useI18n()
  if (!alertas.length) return null
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={t('atividades.pessoa.alertas.aria')}>
      {alertas.map((a) => (
        <li key={a.id} className="inline-flex items-center h-6 px-2 rounded-full border border-dashed border-ln-line text-xs text-ln-t3 whitespace-nowrap" title={a.title}>
          {a.texto}
        </li>
      ))}
    </ul>
  )
}

function Distribuicao({ porPasta }) {
  const { t } = useI18n()
  const max = Math.max(0, ...porPasta.map((p) => Number(p.horas) || 0))
  return (
    <section>
      <h3 className="ln-label">{t('atividades.pessoa.distribuicao')}</h3>
      {porPasta.length === 0 ? (
        <p className="text-xs text-ln-t4">{t('atividades.pessoa.semDistribuir')}</p>
      ) : (
        <ul className="space-y-0.5">
          {porPasta.map((p) => {
            const horas = Number(p.horas) || 0
            const largura = max > 0 ? Math.max(2, (horas / max) * 100) : 0
            return (
              <li key={p.pasta ?? 'sem-pasta'} className="flex items-center gap-2 h-6">
                <span className="flex-1 min-w-0 truncate text-xs text-ln-t2" title={p.pasta || t('atividades.semPasta')}>{p.pasta || t('atividades.semPasta')}</span>
                <span className="w-24 h-1.5 rounded-full bg-ln-ink/[0.06] overflow-hidden shrink-0" aria-hidden="true">
                  <span className="block h-full rounded-full bg-ln-brand/60" style={{ width: `${largura}%` }} />
                </span>
                <span className="w-16 text-right text-xs text-ln-t3 tabular shrink-0">{Number(p.tarefas) || 0} · {fmtHoras(horas)}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function Abas({ aba, onAba, contagens, prefixo }) {
  const { t } = useI18n()
  return (
    <div role="tablist" aria-label={t('atividades.pessoa.tarefasDaPessoa')} className="flex items-center gap-1 flex-wrap">
      {ABAS.map((a) => {
        const ativa = a.id === aba
        return (
          <button
            key={a.id}
            type="button"
            role="tab"
            id={`${prefixo}-aba-${a.id}`}
            aria-selected={ativa}
            aria-controls={`${prefixo}-painel-${a.id}`}
            onClick={() => onAba(a.id)}
            className={`ln-tab ${ativa ? 'ln-tab-active' : ''} ${FOCO}`}
          >
            {t(`atividades.pessoa.abas.${a.id}`)}
            {contagens[a.id] != null && <span className={`tabular ${ativa ? 'text-ln-t3' : 'text-ln-t4'}`}>{contagens[a.id]}</span>}
          </button>
        )
      })}
    </div>
  )
}

// Horas da tarefa com edição inline: clique vira um campo; Enter ou sair do
// campo grava a estimativa no ClickUp (via onEstimar) e a agenda recalcula.
function HorasEditaveis({ tarefa, estimada, onEstimar }) {
  const { t } = useI18n()
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)
  const [local, setLocal] = useState(null) // valor recém-salvo, até a agenda recarregar
  const [unidade, setUnidade] = useState('h') // número sem sufixo é lido nesta unidade
  const inputRef = useRef(null)

  useEffect(() => { setLocal(null) }, [tarefa.horas, tarefa.origem])
  useEffect(() => { if (editando) inputRef.current?.select() }, [editando])

  const horasMostradas = local ?? tarefa.horas
  const veioDoClickUp = local != null || !estimada
  const podeEditar = typeof onEstimar === 'function' && !!tarefa.id

  function abrir(e) {
    e.preventDefault(); e.stopPropagation()
    if (!podeEditar || salvando) return
    const h = Number(horasMostradas) || 0
    // abaixo de 1h edita em minutos; a partir de 1h, em horas
    if (h > 0 && h < 1) { setUnidade('min'); setValor(String(Math.round(h * 60))) }
    else { setUnidade('h'); setValor(localeAtual() === 'pt-BR' ? String(h).replace('.', ',') : String(h)) }
    setErro(null)
    setEditando(true)
  }
  async function salvar() {
    const n = parseDuracao(valor, unidade)
    setEditando(false)
    if (!(n > 0) || n === Number(horasMostradas) && veioDoClickUp) return
    setSalvando(true)
    setErro(null)
    try {
      await onEstimar(tarefa, n)
      setLocal(n)
    } catch (e) {
      setErro(e?.message || t('atividades.pessoa.naoSalvou'))
    } finally {
      setSalvando(false)
    }
  }
  function tecla(e) {
    if (e.key === 'Enter') { e.preventDefault(); salvar() }
    if (e.key === 'Escape') { e.preventDefault(); setEditando(false) }
  }

  if (editando) {
    const btn = (u, rotulo) => (
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()} // não tira o foco do input
        onClick={(e) => { e.stopPropagation(); setUnidade(u); inputRef.current?.focus() }}
        className={`h-5 px-1.5 rounded text-[10px] font-semibold transition-colors ${unidade === u ? 'bg-ln-accent text-white' : 'text-ln-t4 hover:bg-ln-ink/5'}`}
        aria-pressed={unidade === u}
        title={u === 'h' ? t('atividades.pessoa.horas.valorHoras') : t('atividades.pessoa.horas.valorMinutos')}
      >
        {rotulo}
      </button>
    )
    return (
      <span className="shrink-0 inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onBlur={salvar}
          onKeyDown={tecla}
          aria-label={t('atividades.pessoa.horas.aria', { nome: tarefa.nome || t('atividades.tarefa'), unidade: unidade === 'min' ? t('atividades.pessoa.horas.minutos') : t('atividades.pessoa.horas.horas') })}
          placeholder={unidade === 'min' ? '45' : (1.5).toLocaleString(localeAtual())}
          title={t('atividades.pessoa.horas.aceita')}
          className="w-14 h-6 px-1.5 rounded-md bg-ln-ink/[0.05] border border-ln-accent/60 text-right text-xs text-ln-t1 tabular outline-none"
        />
        <span className="inline-flex items-center rounded-md bg-ln-ink/[0.04] p-0.5">
          {btn('h', 'h')}
          {btn('min', 'min')}
        </span>
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={abrir}
      disabled={!podeEditar || salvando}
      className={`group/h w-14 shrink-0 h-6 px-1 rounded-md inline-flex items-center justify-end gap-1 text-xs tabular transition-colors duration-150 ${podeEditar ? 'hover:bg-ln-ink/5 cursor-text' : 'cursor-default'} ${erro ? 'text-ln-red' : 'text-ln-t2'} ${FOCO}`}
      title={erro ? t('atividades.pessoa.horas.erro', { erro }) : podeEditar ? (veioDoClickUp ? t('atividades.pessoa.horas.doClickupEditar') : t('atividades.pessoa.horas.estimadasEditar', { origem: rotuloOrigem(tarefa.origem) })) : (veioDoClickUp ? t('atividades.pessoa.horas.doClickup') : t('atividades.pessoa.horas.estimadas', { origem: rotuloOrigem(tarefa.origem) }))}
    >
      {salvando
        ? <Loader2 className="w-3 h-3 animate-spin text-ln-t3" />
        : <Pencil className="w-2.5 h-2.5 text-ln-t4 opacity-0 group-hover/h:opacity-100 transition-opacity" aria-hidden="true" />}
      <span>{fmtHoras(horasMostradas)}{!veioDoClickUp && <span className="text-ln-t4">*</span>}</span>
    </button>
  )
}

// Tipo de tarefa (dropdown do ClickUp) com edição inline: é o tipo que define
// as horas da tarefa. Trocar o tipo grava o campo no ClickUp (via onTipar) e as
// horas configuradas para ele viram a estimativa da tarefa.
function TipoEditavel({ tarefa, onTipar }) {
  const { t } = useI18n()
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)
  const [local, setLocal] = useState(null) // valor recém-salvo, até a agenda recarregar
  useEffect(() => { setLocal(null) }, [tarefa.tipoTarefa])

  const tipo = local ?? tarefa.tipoTarefa ?? ''
  const tipoAtual = tipo ? String(tipo).trim() : ''
  const podeEditar = typeof onTipar === 'function' && !!tarefa.id
  const opcoes = tipoAtual && !TIPOS_TAREFA.some((t) => t === tipoAtual) ? [tipoAtual, ...TIPOS_TAREFA] : TIPOS_TAREFA

  async function mudar(e) {
    const novo = e.target.value
    if (!novo || novo === tipoAtual) return
    setSalvando(true)
    setErro(null)
    try {
      await onTipar(tarefa, novo)
      setLocal(novo)
    } catch (err) {
      setErro(err?.message || t('atividades.pessoa.naoSalvou'))
    } finally {
      setSalvando(false)
    }
  }

  const titulo = erro
    ? t('atividades.pessoa.tipo.erro', { erro })
    : tipoAtual
      ? `${t('atividades.pessoa.tipo.titulo', { tipo: rotuloTipoTarefa(tipoAtual) })}${podeEditar ? `. ${t('atividades.pessoa.tipo.trocarRedefine')}` : ''}`
      : (podeEditar ? t('atividades.pessoa.tipo.semTipoEscolha') : t('atividades.pessoa.tipo.semTipo'))

  if (!podeEditar) {
    return tipoAtual
      ? <span className="shrink-0 max-w-[88px] truncate h-5 px-1.5 rounded-full bg-ln-ink/[0.05] text-[11px] leading-5 text-ln-t3" title={titulo}>{rotuloTipoTarefa(tipoAtual)}</span>
      : <span className="shrink-0 w-10" aria-hidden="true" />
  }
  return (
    <span
      className={`relative shrink-0 inline-flex items-center h-5 max-w-[88px] rounded-full text-[11px] leading-5 transition-colors duration-150 ${erro ? 'ring-1 ring-ln-red/50 text-ln-red' : tipoAtual ? 'bg-ln-ink/[0.05] text-ln-t3 hover:bg-ln-ink/10' : 'ring-1 ring-dashed ring-ln-line text-ln-t4 hover:text-ln-t2 hover:ring-ln-t4'}`}
      title={titulo}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="px-1.5 truncate inline-flex items-center gap-1">
        {salvando && <Loader2 className="w-3 h-3 animate-spin text-ln-t3 shrink-0" aria-hidden="true" />}
        {tipoAtual ? rotuloTipoTarefa(tipoAtual) : t('atividades.pessoa.tipo.mais')}
      </span>
      <select
        value={tipoAtual}
        onChange={mudar}
        disabled={salvando}
        aria-label={t('atividades.pessoa.tipo.aria', { nome: tarefa.nome || t('atividades.tarefa') })}
        className={`absolute inset-0 w-full h-full opacity-0 cursor-pointer ${FOCO}`}
      >
        <option value="" disabled>{tipoAtual ? t('atividades.pessoa.tipo.trocar') : t('atividades.pessoa.tipo.escolher')}</option>
        {opcoes.map((o) => <option key={o} value={o}>{rotuloTipoTarefa(o)}</option>)}
      </select>
    </span>
  )
}

/** Há quantos dias a tarefa está aberta no ClickUp (sinal de tarefa envelhecendo). */
function IdadeTarefa({ tarefa }) {
  const { t } = useI18n()
  const dias = Number(tarefa.diasAberta)
  if (!Number.isFinite(dias)) return <span className="w-9 shrink-0" aria-hidden="true" />
  const cor = dias >= 30 ? TOM.vermelho : dias >= 14 ? 'text-ln-orange' : 'text-ln-t4'
  const criada = tarefa.criadaEm ? t('atividades.pessoa.idade.criadaEm', { data: fmtCurta(tarefa.criadaEm) }) : ''
  const titulo = `${criada}${dias === 0 ? t('atividades.pessoa.idade.abertaHoje') : t('atividades.pessoa.idade.abertaHa', { count: dias })}`
  return (
    <span className={`w-9 shrink-0 text-[11px] tabular ${cor}`} title={titulo} aria-label={titulo}>
      {dias === 0 ? t('atividades.calor.hojeMinusc') : t('atividades.nD', { n: dias })}
    </span>
  )
}

function TarefaRow({ tarefa, aba, diaSelecionado, onEstimar, onTipar }) {
  const { t, lang } = useI18n()
  const zumbi = aba === 'zumbis'
  const atrasada = zumbi || !!tarefa.atrasada
  let dia = ''
  let tituloDia = ''
  if (aba === 'semdata') {
    dia = t('atividades.semDataMinusc')
    tituloDia = t('atividades.pessoa.linha.semDataTitle')
  } else if (zumbi) {
    dia = fmtCurta(tarefa.vencimento)
    tituloDia = t('atividades.pessoa.linha.zumbiTitle', { data: fmtCurta(tarefa.vencimento), count: Number(tarefa.diasAtraso) || 0 })
  } else if (tarefa.atrasada) {
    dia = fmtCurta(tarefa.vencimento || tarefa.dia)
    tituloDia = t('atividades.pessoa.linha.atrasadaTitle', { data: fmtCurta(tarefa.vencimento || tarefa.dia) })
  } else {
    dia = fmtCurta(tarefa.dia)
    tituloDia = t('atividades.pessoa.linha.agendaTitle', { dia: fmtDiaCurto(tarefa.dia) })
  }
  const estimada = !!tarefa.origem && tarefa.origem !== 'estimativa'
  const selecionada = !!diaSelecionado && tarefa.dia === diaSelecionado
  const corDia = atrasada ? TOM.vermelho : aba === 'semdata' ? 'text-ln-t4' : 'text-ln-t3'
  return (
    <li className={`ln-row-hover flex items-center gap-2 h-8 px-2 -mx-2 ${selecionada ? 'bg-ln-ink/[0.03]' : ''}`}>
      {tarefa.prioridade && PRIORIDADE_LABEL[String(tarefa.prioridade).toLowerCase()]
        ? <PrioridadeIcon prioridade={String(tarefa.prioridade).toLowerCase()} className="w-4 h-4" />
        : <span className="w-4 h-4 shrink-0 inline-flex items-center justify-center text-ln-t4/60" title={t('atividades.pessoa.linha.semPrioridadeClickup')} aria-label={t('atividades.prioridade.none')}>·</span>}
      <span className={`w-14 shrink-0 text-xs tabular ${corDia}`} title={tituloDia}>{dia}</span>
      <IdadeTarefa tarefa={tarefa} />
      <a
        href={tarefa.url || undefined}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex-1 min-w-0 truncate text-[13px] text-ln-t2 hover:text-ln-t1 rounded transition-colors duration-150 ${FOCO}`}
        title={`${tarefa.pasta || t('atividades.semPasta')} › ${tarefa.lista || t('atividades.semLista')}`}
      >
        {tarefa.nome || t('atividades.semTitulo')}
      </a>
      <span
        className="w-24 shrink-0 truncate text-[11px] text-ln-t3"
        title={tarefa.pasta ? t('atividades.pessoa.linha.clienteTitle', { cliente: `${tarefa.pasta}${tarefa.lista ? ` › ${tarefa.lista}` : ''}` }) : t('atividades.pessoa.linha.foraPasta')}
      >
        {tarefa.pasta || <span className="text-ln-t4">{t('atividades.pessoa.linha.semCliente')}</span>}
      </span>
      <TipoEditavel tarefa={tarefa} onTipar={onTipar} />
      <HorasEditaveis tarefa={tarefa} estimada={estimada} onEstimar={onEstimar} />
      {tarefa.status && (
        <span className="shrink-0 max-w-[96px] truncate h-5 px-1.5 rounded-full ring-1 ring-ln-line text-[11px] leading-5 text-ln-t3" title={statusTela(tarefa.status, lang)}>
          {statusTela(tarefa.status, lang)}
        </span>
      )}
    </li>
  )
}

// ─── Aba Concluídas ──────────────────────────────────────────────────────────

function ConcluidaRow({ tarefa }) {
  const { t, lang } = useI18n()
  const ciclo = Number(tarefa.cicloDias)
  const tituloCiclo = Number.isFinite(ciclo)
    ? (ciclo === 0 ? t('atividades.pessoa.concl.mesmoDia') : `${t('atividades.pessoa.concl.levou', { count: ciclo })}${tarefa.criadaEm ? ` ${t('atividades.pessoa.concl.criadaEm', { data: fmtCurta(tarefa.criadaEm) })}` : ''}`)
    : ''
  const registrado = Number(tarefa.tempoRegistrado)
  const estimada = !!tarefa.origem && tarefa.origem !== 'estimativa'
  return (
    <li className="ln-row-hover flex items-center gap-2 h-8 px-2 -mx-2">
      <CheckCircle2 className="w-4 h-4 shrink-0 text-ln-green" aria-hidden="true" />
      <span className="w-14 shrink-0 text-xs tabular text-ln-t3" title={tarefa.concluidaEm ? t('atividades.pessoa.concl.concluidaEm', { data: fmtCurta(tarefa.dia), hora: fmtHora(tarefa.concluidaEm) }) : ''}>
        {tarefa.concluidaEm ? fmtHora(tarefa.concluidaEm) : ''}
      </span>
      {Number.isFinite(ciclo)
        ? <span className="w-9 shrink-0 text-[11px] tabular text-ln-t4" title={tituloCiclo}>{t('atividades.nD', { n: ciclo })}</span>
        : <span className="w-9 shrink-0" aria-hidden="true" />}
      <a
        href={tarefa.url || undefined}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex-1 min-w-0 truncate text-[13px] text-ln-t2 hover:text-ln-t1 rounded transition-colors duration-150 ${FOCO}`}
        title={`${tarefa.pasta || t('atividades.semPasta')} › ${tarefa.lista || t('atividades.semLista')}`}
      >
        {tarefa.subtarefa && <span className="text-ln-t4 mr-1">↳</span>}
        {tarefa.nome || t('atividades.semTitulo')}
      </a>
      <span
        className="w-24 shrink-0 truncate text-[11px] text-ln-t3"
        title={tarefa.pasta ? t('atividades.pessoa.linha.clienteTitle', { cliente: `${tarefa.pasta}${tarefa.lista ? ` › ${tarefa.lista}` : ''}` }) : t('atividades.pessoa.linha.foraPasta')}
      >
        {tarefa.pasta || <span className="text-ln-t4">{t('atividades.pessoa.linha.semCliente')}</span>}
      </span>
      <span
        className="w-14 shrink-0 text-right text-xs tabular text-ln-t2"
        title={registrado > 0 ? `${t('atividades.pessoa.concl.registradas', { horas: fmtHoras(registrado) })} · ${estimada ? t('atividades.pessoa.concl.estimadasTipo', { horas: fmtHoras(tarefa.horas) }) : t('atividades.pessoa.concl.deEstimativa', { horas: fmtHoras(tarefa.horas) })}` : (estimada ? t('atividades.pessoa.horas.estimadasTipoOrigem', { origem: rotuloOrigem(tarefa.origem) }) : t('atividades.pessoa.horas.doClickup'))}
      >
        {registrado > 0 ? fmtHoras(registrado) : <>{fmtHoras(tarefa.horas)}{estimada && <span className="text-ln-t4">*</span>}</>}
      </span>
      {tarefa.status && (
        <span className="shrink-0 max-w-[96px] truncate h-5 px-1.5 rounded-full ring-1 ring-ln-line text-[11px] leading-5 text-ln-t3" title={statusTela(tarefa.status, lang)}>
          {statusTela(tarefa.status, lang)}
        </span>
      )}
    </li>
  )
}

function GrupoDia({ dia, hoje, itens, recolhido, onToggle }) {
  const horas = itens.reduce((s, t) => s + (Number(t.tempoRegistrado) > 0 ? Number(t.tempoRegistrado) : (Number(t.horas) || 0)), 0)
  return (
    <section className="mb-1.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!recolhido}
        className={`w-full h-9 -mx-2 px-2 rounded-lg flex items-center gap-2 text-left transition-colors duration-150 hover:bg-ln-ink/[0.03] ${FOCO}`}
        style={{ width: 'calc(100% + 16px)' }}
      >
        {recolhido ? <ChevronRight className="w-3.5 h-3.5 text-ln-t4 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-ln-t4 shrink-0" />}
        <span className={`text-[13px] font-medium ${dia === hoje ? 'text-ln-t1' : 'text-ln-t2'}`}>{rotuloDia(dia, hoje)}</span>
        <span className="text-[13px] text-ln-t3 tabular">{itens.length}</span>
        <span className="text-[11px] text-ln-t4 tabular ml-auto">{fmtHoras(horas)}</span>
      </button>
      {!recolhido && <ul>{itens.map((t, i) => <ConcluidaRow key={t.id || i} tarefa={t} />)}</ul>}
    </section>
  )
}

/** Tarefas que esta pessoa concluiu no período (lê o ClickUp via useConcluidas). */
function ConcluidasPessoa({ concl, periodo, onPeriodo, tarefas, vazio }) {
  const { t } = useI18n()
  const [recolhidos, setRecolhidos] = useState({})
  const hoje = concl.hoje
  const porDia = []
  for (const t of tarefas) {
    let g = porDia.find((x) => x.dia === t.dia)
    if (!g) { g = { dia: t.dia, itens: [] }; porDia.push(g) }
    g.itens.push(t)
  }
  porDia.sort((a, b) => (a.dia < b.dia ? 1 : a.dia > b.dia ? -1 : 0))
  const total = tarefas.length
  const horas = tarefas.reduce((s, t) => s + (Number(t.tempoRegistrado) > 0 ? Number(t.tempoRegistrado) : (Number(t.horas) || 0)), 0)
  const temEstimadas = tarefas.some((t) => !(Number(t.tempoRegistrado) > 0) && !!t.origem && t.origem !== 'estimativa')
  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <div role="group" aria-label={t('atividades.pessoa.periodo')} className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-ln-ink/[0.03] ring-1 ring-inset ring-ln-ink/5">
          {PERIODOS_CONCLUIDAS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPeriodo(p.id)}
              aria-pressed={periodo === p.id}
              className={`h-6 px-2.5 rounded-full text-[11px] font-medium transition-colors duration-150 ${periodo === p.id ? 'bg-ln-ink/[0.08] text-ln-t1' : 'text-ln-t3 hover:bg-ln-ink/5'} ${FOCO}`}
            >
              {t(`atividades.pessoa.periodos.${p.id}`)}
            </button>
          ))}
        </div>
        {concl.geradoEm && !concl.loading && (
          <span className="text-[11px] text-ln-t4 tabular">{t('atividades.nTarefas', { count: total })} · {fmtHoras(horas)}</span>
        )}
        <button
          type="button"
          onClick={() => concl.refresh()}
          disabled={concl.loading}
          className={`ml-auto inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] text-ln-t4 hover:text-ln-t2 hover:bg-ln-ink/5 transition-colors duration-150 disabled:opacity-60 ${FOCO}`}
          title={concl.geradoEm ? t('atividades.pessoa.concl.lidoReler', { quando: fmtRelativo(concl.geradoEm) }) : t('atividades.relerClickup')}
        >
          {concl.loading ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> : <RefreshCw className="w-3 h-3" aria-hidden="true" />}
          {concl.geradoEm ? fmtRelativo(concl.geradoEm) : t('atividades.pessoa.concl.reler')}
        </button>
      </div>

      <div className="mt-2">
        {concl.erro ? (
          <div className="ln-card p-3 flex items-start gap-2" role="alert">
            <AlertTriangle className="w-4 h-4 text-ln-red shrink-0 mt-0.5" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-ln-t2">{t('atividades.pessoa.concl.naoLeu')}</p>
              <p className="mt-0.5 text-[11px] text-ln-t3 break-words">{concl.erro}</p>
            </div>
          </div>
        ) : concl.loading && !concl.geradoEm ? (
          <div className="space-y-2" aria-busy="true">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-8 rounded-lg ln-shimmer" />)}
          </div>
        ) : total === 0 ? (
          <p className="h-8 flex items-center text-xs text-ln-t4">{vazio}</p>
        ) : (
          porDia.map((g) => (
            <GrupoDia key={g.dia} dia={g.dia} hoje={hoje} itens={g.itens} recolhido={!!recolhidos[g.dia]} onToggle={() => setRecolhidos((r) => ({ ...r, [g.dia]: !r[g.dia] }))} />
          ))
        )}
        {concl.truncado && <p className="mt-1.5 text-[11px] text-ln-yellow">{t('atividades.pessoa.concl.truncado')}</p>}
      </div>
      {temEstimadas && (
        <p className="mt-1.5 text-[11px] text-ln-t4">{t('atividades.pessoa.concl.notaEstimadas')}</p>
      )}
    </div>
  )
}

function GrupoPrioridade({ grupo, recolhido, onToggle, children }) {
  const { t } = useI18n()
  return (
    <section className="mb-1.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!recolhido}
        className={`w-full h-9 -mx-2 px-2 rounded-lg flex items-center gap-2 text-left transition-colors duration-150 hover:bg-ln-ink/[0.03] ${FOCO}`}
        style={{ width: 'calc(100% + 16px)' }}
      >
        {recolhido ? <ChevronRight className="w-3.5 h-3.5 text-ln-t4 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-ln-t4 shrink-0" />}
        <span className={`inline-flex items-center h-5 px-2 rounded-full ring-1 ring-inset text-[11px] font-semibold uppercase tracking-wide ${grupo.cls}`}>{t(`atividades.prioridade.${grupo.id}`)}</span>
        <span className="text-[13px] text-ln-t3 tabular">{grupo.itens.length}</span>
        <span className="text-[11px] text-ln-t4 tabular ml-auto">{fmtHoras(grupo.horas)}</span>
      </button>
      {!recolhido && <ul>{children}</ul>}
    </section>
  )
}

function ListaTarefas({ pessoa, aba, onAba, diaSelecionado, prefixo, onEstimar, onTipar, diaFiltro = null, onLimparDia }) {
  const { t } = useI18n()
  const [recolhidos, setRecolhidos] = useState({})
  // Concluídas: lê o ClickUp só quando a aba está aberta; o período é da pessoa
  const [periodoConcl, setPeriodoConcl] = useState('7dias')
  const hojeConcl = pessoa.hoje || hojeISO()
  const concl = useConcluidas(aba === 'concluidas', intervaloConcluidas(periodoConcl, hojeConcl))
  const clickupId = Number(pessoa.clickupId)
  const concluidas = concl.geradoEm
    ? concl.tarefas.filter((t) => (t.assignees || []).some((a) => Number(a.id) === clickupId))
    : null
  const filtraDia = !!diaFiltro && (aba === 'fila' || aba === 'atrasadas')
  const contagens = {
    fila: itensDaAba(pessoa, 'fila', diaFiltro).length,
    atrasadas: itensDaAba(pessoa, 'atrasadas', diaFiltro).length,
    semdata: (pessoa.semData || []).length,
    zumbis: (pessoa.zumbis || []).length,
    concluidas: concluidas ? concluidas.length : null,
  }
  const def = ABAS.find((a) => a.id === aba) || ABAS[0]
  if (aba === 'concluidas') {
    return (
      <section>
        <Abas aba={aba} onAba={onAba} contagens={contagens} prefixo={prefixo} />
        <div role="tabpanel" id={`${prefixo}-painel-${aba}`} aria-labelledby={`${prefixo}-aba-${aba}`} className="mt-2">
          <ConcluidasPessoa concl={concl} periodo={periodoConcl} onPeriodo={setPeriodoConcl} tarefas={concluidas || []} vazio={t(`atividades.pessoa.vazio.${def.id}`)} />
        </div>
      </section>
    )
  }
  const itens = itensDaAba(pessoa, aba, diaFiltro)
  const horasDia = itens.reduce((s, t) => s + (Number(t.horas) || 0), 0)
  const temEstimadas = itens.some((t) => !!t.origem && t.origem !== 'estimativa')
  return (
    <section>
      <Abas aba={aba} onAba={onAba} contagens={contagens} prefixo={prefixo} />
      {diaFiltro && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 h-6 pl-2.5 pr-1 rounded-full bg-ln-accent/15 text-ln-accent ring-1 ring-inset ring-ln-accent/30 font-medium">
            {filtraDia ? t('atividades.pessoa.filtroDia.so', { dia: fmtDiaCurto(diaFiltro), tarefas: t('atividades.nTarefas', { count: itens.length }), horas: fmtHoras(horasDia) }) : t('atividades.pessoa.filtroDia.naoAplica', { dia: fmtDiaCurto(diaFiltro) })}
            <button type="button" onClick={onLimparDia} className={`w-4 h-4 rounded-full inline-flex items-center justify-center hover:bg-ln-accent/25 ${FOCO}`} aria-label={t('atividades.pessoa.filtroDia.limpar')} title={t('atividades.pessoa.filtroDia.limpar')}>
              <X className="w-3 h-3" />
            </button>
          </span>
          <span className="text-ln-t4">{t('atividades.pessoa.filtroDia.dica')}</span>
        </div>
      )}
      <div role="tabpanel" id={`${prefixo}-painel-${aba}`} aria-labelledby={`${prefixo}-aba-${aba}`} className="mt-2">
        {itens.length === 0 ? (
          <p className="h-8 flex items-center text-xs text-ln-t4">{filtraDia ? t('atividades.pessoa.filtroDia.nada', { dia: fmtDiaCurto(diaFiltro) }) : t(`atividades.pessoa.vazio.${def.id}`)}</p>
        ) : (
          agruparPorPrioridade(itens).map((g) => (
            <GrupoPrioridade key={g.id} grupo={g} recolhido={!!recolhidos[g.id]} onToggle={() => setRecolhidos((r) => ({ ...r, [g.id]: !r[g.id] }))}>
              {g.itens.map((t, i) => <TarefaRow key={t.id || i} tarefa={t} aba={aba} diaSelecionado={diaSelecionado} onEstimar={onEstimar} onTipar={onTipar} />)}
            </GrupoPrioridade>
          ))
        )}
      </div>
      {temEstimadas && (
        <p className="mt-1.5 text-[11px] text-ln-t4">
          {t('atividades.pessoa.nota.base')}{onTipar ? ` ${t('atividades.pessoa.nota.tipo')}` : ''}{onEstimar ? (onTipar ? t('atividades.pessoa.nota.ouClique') : ` ${t('atividades.pessoa.nota.ouCliqueInicio')}`) : '.'}
        </p>
      )}
    </section>
  )
}

function Esqueleto({ pessoa }) {
  const { t } = useI18n()
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 rounded-full ln-shimmer" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-40 rounded ln-shimmer" />
          <div className="h-3 w-56 max-w-full rounded ln-shimmer" />
          <div className="h-6 w-24 rounded-full ln-shimmer" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 rounded-[9px] ln-shimmer" />)}
      </div>
      <div className="h-[140px] rounded-lg ln-shimmer" />
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-8 rounded-lg ln-shimmer" />)}
      </div>
      <p className="text-xs text-ln-t4">{t('atividades.pessoa.lendoDe', { nome: primeiroNome(pessoa.nome) || t('atividades.estaPessoa') })}</p>
    </div>
  )
}

function Erro({ pessoa, onRecarregar }) {
  const { t } = useI18n()
  return (
    <div className="ln-card p-4 flex items-start gap-3" role="alert">
      <AlertTriangle className="w-4 h-4 text-ln-red shrink-0 mt-0.5" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-ln-t2">{t('atividades.pessoa.erro.titulo')}</p>
        <p className="mt-0.5 text-xs text-ln-t3 break-words">{pessoa.erro}</p>
        <button
          type="button"
          onClick={() => onRecarregar?.(pessoa)}
          className={`ln-pill mt-3 ${FOCO}`}
          title={t('atividades.pessoa.erro.tentarTitle')}
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> {t('atividades.tentarDeNovo')}
        </button>
      </div>
    </div>
  )
}

function SemClickup({ pessoa }) {
  const { t } = useI18n()
  return (
    <div className="ln-card p-4 flex items-start gap-3">
      <AlertTriangle className="w-4 h-4 text-ln-t4 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-ln-t2">{t('atividades.pessoa.semClickup.titulo')}</p>
        <p className="mt-0.5 text-xs text-ln-t3">
          {textoSaude(pessoa.saude) || t('atividades.saude.semClickup')}. {t('atividades.pessoa.semClickup.dica')}
        </p>
      </div>
    </div>
  )
}

// ─── Painel ──────────────────────────────────────────────────────────────────

/**
 * @param {object}   p
 * @param {object}   p.pessoa            pessoa enriquecida (enriquecerPessoa)
 * @param {string}   [p.hoje]            yyyy-mm-dd (cai em pessoa.hoje)
 * @param {string}   [p.diaSelecionado]  dia destacado na linha de calor do time
 * @param {string}   [p.abaInicial]      'fila' | 'atrasadas' | 'semdata' | 'zumbis'
 * @param {Function} [p.onNovaAtividade] (pessoa) => void
 * @param {Function} [p.onRecarregar]    (pessoa) => void
 * @param {Function} [p.onEstimar]       (pessoa, tarefa, horas) => Promise  grava a estimativa no ClickUp
 * @param {Function} [p.onTipar]         (pessoa, tarefa, tipo) => Promise   grava o tipo de tarefa (e as horas dele) no ClickUp
 */
export default function PersonPanel({ pessoa, hoje, diaSelecionado = null, abaInicial = ABA_PADRAO, onNovaAtividade, onRecarregar, onEstimar, onTipar, fimExpediente = 18 }) {
  const { t } = useI18n()
  // Dia escolhido no gráfico desta pessoa: filtra a lista de tarefas. Começa
  // com o dia selecionado na linha de calor do time (se houver) e reseta ao
  // trocar de pessoa.
  const [diaFiltro, setDiaFiltro] = useState(diaSelecionado)
  const [chaveDia, setChaveDia] = useState(`${pessoa?.profileId}|${diaSelecionado}`)
  const chaveAtual = `${pessoa?.profileId}|${diaSelecionado}`
  if (chaveAtual !== chaveDia) { setChaveDia(chaveAtual); setDiaFiltro(diaSelecionado) }
  const diaAtivo = diaFiltro
  const prefixo = useId()
  // A aba segue a prop quando o painel troca de pessoa ou a tabela pede outra
  // aba; entre trocas, quem manda é o clique do usuário.
  const chaveAba = `${pessoa?.profileId ?? ''}|${normalizarAba(abaInicial)}`
  const [aba, setAba] = useState(() => normalizarAba(abaInicial))
  const [chaveAnterior, setChaveAnterior] = useState(chaveAba)
  if (chaveAba !== chaveAnterior) {
    setChaveAnterior(chaveAba)
    setAba(normalizarAba(abaInicial))
  }

  if (!pessoa) return null

  const semClickup = !pessoa.clickupId
  const carregando = !pessoa.api && !pessoa.erro && !semClickup
  const atualizadoEm = pessoa.atualizadoEm || pessoa.geradoEm || pessoa.api?.geradoEm || null
  const hojeRef = hoje || pessoa.hoje || null
  const nome = primeiroNome(pessoa.nome) || t('atividades.estaPessoa')

  return (
    <div className="flex flex-col min-h-full text-ln-t2">
      <div className="flex-1 px-4 py-4 space-y-5">
        {carregando ? (
          <Esqueleto pessoa={pessoa} />
        ) : (
          <>
            <Cabecalho pessoa={pessoa} atualizadoEm={atualizadoEm} />

            {pessoa.erro && <Erro pessoa={pessoa} onRecarregar={onRecarregar} />}
            {!pessoa.erro && semClickup && <SemClickup pessoa={pessoa} />}

            {pessoa.api && (
              <>
                <Kpis pessoa={pessoa} />
                <HojeAteFim pessoa={pessoa} fimExpediente={fimExpediente} />

                <section>
                  {pessoa.resumo?.length ? (
                    <CargaDiaria
                      resumo={pessoa.resumo}
                      capacidade={pessoa.capacidadeDia}
                      hoje={hojeRef}
                      diaSelecionado={diaAtivo}
                      altura={120}
                      onSelecionarDia={setDiaFiltro}
                    />
                  ) : (
                    <p className="text-xs text-ln-t4">{t('atividades.pessoa.semDiasUteis')}</p>
                  )}
                  <LinhaDia pessoa={pessoa} diaSelecionado={diaAtivo} />
                </section>

                <Alertas alertas={alertasDe(pessoa)} />

                <Distribuicao porPasta={pessoa.porPasta || []} />

                <ListaTarefas pessoa={pessoa} aba={aba} onAba={setAba} diaSelecionado={diaAtivo} diaFiltro={diaAtivo} onLimparDia={() => setDiaFiltro(null)} prefixo={prefixo} onEstimar={onEstimar ? (tarefa, horas) => onEstimar(pessoa, tarefa, horas) : null} onTipar={onTipar ? (tarefa, tipo) => onTipar(pessoa, tarefa, tipo) : null} />
              </>
            )}
          </>
        )}
      </div>

      <footer className="sticky bottom-0 z-10 flex items-center gap-2 flex-wrap px-4 py-3 border-t border-ln-ink/[0.08] bg-ln-panel">
        <button
          type="button"
          onClick={() => onNovaAtividade?.(pessoa)}
          disabled={semClickup}
          className={`ln-primary ${FOCO}`}
          title={semClickup ? t('atividades.pessoa.semClickup.naoAtribui') : t('atividades.novaParaX', { nome: pessoa.nome })}
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" /> {t('atividades.novaParaX', { nome })}
        </button>
        <button
          type="button"
          onClick={() => onRecarregar?.(pessoa)}
          disabled={semClickup || carregando}
          className={`ln-pill ${FOCO}`}
          title={semClickup ? t('atividades.pessoa.semClickup.nadaRecarregar') : t('atividades.pessoa.lerDeNovo')}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} aria-hidden="true" /> {t('atividades.recarregarClickup')}
        </button>
      </footer>
    </div>
  )
}
