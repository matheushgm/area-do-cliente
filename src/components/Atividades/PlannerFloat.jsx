// Painel flutuante "Planejador · ClickUp": o pedido, a resposta com a data
// que cabe na agenda, a data forçada, a comparação com o time e a aprovação.
// Lê tudo do hook usePlanejador (objeto `pl`); o estado de aberto/minimizado
// é da página.
import { useId } from 'react'
import { AlertTriangle, ArrowRight, Info, Loader2, Minus, Sparkles, Users, X } from 'lucide-react'
import CargaDiaria from './CargaDiaria'
import { AREA_CLS, CriadaCard, FOCO } from './NovaAtividadePanel'
import { fmtCurta, fmtDiaCurto, fmtHora, fmtHoras, fmtLonga, fmtPct, iniciais, primeiroNome, tomOcupacao } from '../../lib/atividadesCarga'

const LARGURA = 380
const ALTURA_MAX = 520

export const STATUS = {
  ocioso:     { dot: 'bg-ln-t4',     texto: 'ocioso' },
  calculando: { dot: 'bg-ln-yellow', texto: 'lendo agenda…' },
  calculado:  { dot: 'bg-ln-green',  texto: 'calculado' },
  criada:     { dot: 'bg-ln-green',  texto: 'criada no ClickUp' },
  erro:       { dot: 'bg-ln-red',    texto: 'erro' },
}

export function statusDo(pl) {
  if (!pl) return 'ocioso'
  if (pl.criada) return 'criada'
  if (pl.calculando) return 'calculando'
  if (pl.erroCalculo) return 'erro'
  if (pl.resultado) return 'calculado'
  return 'ocioso'
}

function plural(n, um, varios) {
  return `${n} ${n === 1 ? um : varios}`
}

function Avatar({ nome, avatar, tamanho = 16 }) {
  const txt = String(avatar || iniciais(nome)).slice(0, 2).toUpperCase()
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-ln-brand/20 text-ln-brand font-semibold shrink-0 leading-none"
      style={{ width: tamanho, height: tamanho, fontSize: tamanho <= 16 ? 8 : 10 }}
      aria-hidden="true"
    >
      {txt}
    </span>
  )
}

function MiniKpi({ label, valor, sub, tom = 'text-ln-t1', title }) {
  return (
    <div className="min-w-0" title={title}>
      <p className="text-[10px] text-ln-t4 truncate">{label}</p>
      <p className={`text-[13px] font-semibold tabular leading-5 truncate ${tom}`}>{valor}</p>
      {sub && <p className="text-[10px] text-ln-t4 truncate tabular">{sub}</p>}
    </div>
  )
}

/** Card com a data sugerida, os KPIs da agenda, o gráfico e a data que vai pro ClickUp. */
export function ResultadoCard({ pl, hoje }) {
  const inputId = useId()
  const r = pl?.resultado
  if (!r) return null
  const s = r.sugestao || null
  const t = r.totais || {}
  const resumo = r.resumo || []
  const nome = primeiroNome(pl.responsavel?.nome) || 'a pessoa'
  const horizonte = pl.config?.horizonte_dias_uteis ?? 60
  const hojeRef = hoje || r.hoje || null
  const cabe = !!(s?.cabe && s?.entrega)
  const ocup = Number(t.ocupacaoProximosDias) || 0
  const tom = tomOcupacao(ocup)
  const atrasadas = Number(t.atrasadas) || 0
  const zumbis = Number(t.zumbis) || 0
  const semData = Number(t.semData) || 0
  const diasAloc = s?.alocacao?.length || 0
  const diferente = !!(pl.sugerida && pl.dataEscolhida && pl.dataEscolhida !== pl.sugerida)

  return (
    <div className="ln-card p-3">
      <p className="text-[11px] text-ln-t4">Entrega possível sem sobrecarregar {nome}</p>
      {cabe ? (
        <>
          <p className="text-base font-semibold text-ln-t1 mt-0.5 capitalize tabular">{fmtLonga(s.entrega)}</p>
          <p className="text-xs text-ln-t3 mt-0.5 tabular">
            Começa {s.inicio && s.inicio !== hojeRef ? fmtCurta(s.inicio) : 'hoje'}
            {' · '}{plural(Number(s.diasUteisAteEntrega) || diasAloc, 'dia útil', 'dias úteis')}
            {' · '}{fmtHoras(pl.horasNum)} em {plural(diasAloc, 'dia', 'dias')}
          </p>
        </>
      ) : (
        <>
          <p className="text-base font-semibold text-ln-red mt-0.5">Não cabe nos próximos {horizonte} dias úteis</p>
          <p className="text-xs text-ln-t3 mt-0.5">A agenda de {nome} está tomada. Compare com o time ou redistribua tarefas.</p>
        </>
      )}

      <div className="grid grid-cols-3 gap-2 mt-3">
        <MiniKpi
          label="Ocupação 10d"
          valor={fmtPct(ocup)}
          tom={tom.text}
          sub={`${fmtHoras(t.horasProximosDias)} de ${fmtHoras(t.capacidadeProximosDias)}`}
          title="Horas já na agenda nos próximos 10 dias úteis, sobre a capacidade"
        />
        <MiniKpi
          label="Atrasadas contadas"
          valor={`${atrasadas} · ${fmtHoras(t.horasAtrasadas)}`}
          tom={atrasadas > 0 ? 'text-ln-yellow' : 'text-ln-t1'}
          sub="caem em hoje"
          title="Tarefas vencidas que ainda entram no cálculo (caem em hoje)"
        />
        <MiniKpi
          label="Fora do cálculo"
          valor={zumbis + semData}
          tom={zumbis > 0 ? 'text-ln-orange' : 'text-ln-t1'}
          sub={`${zumbis} zumbis · ${semData} sem data`}
          title="Atrasadas há tempo demais e tarefas sem data: aparecem, mas não ocupam a agenda"
        />
      </div>

      {resumo.length > 0 && (
        <div className="mt-3">
          <CargaDiaria
            resumo={resumo}
            capacidade={r.capacidadeDia}
            hoje={hojeRef}
            sugestao={s}
            forcada={pl.forcada || null}
            dataEscolhida={pl.dataEscolhida || null}
            altura={90}
            legenda={false}
          />
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <label htmlFor={inputId} className="text-xs text-ln-t3 shrink-0">Data que vai pro ClickUp</label>
        <div className="w-36">
          <input
            id={inputId}
            type="date"
            value={pl.dataEscolhida || ''}
            min={hojeRef || undefined}
            onChange={(e) => pl.setDataEscolhida?.(e.target.value)}
            className={`ln-input tabular ${FOCO}`}
          />
        </div>
        {diferente && (
          <button
            type="button"
            onClick={() => pl.setDataEscolhida?.(pl.sugerida)}
            className={`ln-pill tabular ${FOCO}`}
            title={`Voltar para ${fmtLonga(pl.sugerida)}`}
          >
            Voltar para a sugerida ({fmtCurta(pl.sugerida)})
          </button>
        )}
      </div>
    </div>
  )
}

/** Aviso quando a data escolhida é antes da sugerida. */
export function BlocoDataForcada({ pl }) {
  if (!pl?.forcandoData) return null
  const f = pl.forcada
  const nome = primeiroNome(pl.responsavel?.nome) || 'a pessoa'
  const cap = pl.resultado?.capacidadeDia
  const data = fmtCurta(pl.dataEscolhida)

  if (!f) {
    return (
      <div className="rounded-lg ring-1 ring-ln-ink/5 bg-ln-ink/[0.02] p-2.5 text-xs text-ln-t3 flex items-center gap-2" aria-live="polite">
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> Avaliando a data…
      </div>
    )
  }
  if (f.cabe) {
    return (
      <div className="rounded-lg ring-1 ring-ln-yellow/30 bg-ln-yellow/5 p-2.5 text-xs text-ln-yellow flex items-start gap-2">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>Cabe até {data} sem estourar, mas usando toda a folga desses dias. Qualquer imprevisto atrasa.</span>
      </div>
    )
  }
  const detalheDia = f.cargaNoDia != null && cap ? `: o dia fica com ${fmtHoras(f.cargaNoDia)} para ${fmtHoras(cap)}` : ''
  return (
    <div className="rounded-lg ring-1 ring-ln-red/30 bg-ln-red/5 p-2.5 space-y-2">
      <p className="text-xs text-ln-red flex items-start gap-2">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>Entregar em {data} estoura {fmtHoras(f.horasExcedentes)} da capacidade de {nome}{detalheDia}. Ou alguém faz hora extra, ou outra tarefa atrasa.</span>
      </p>
      <textarea
        rows={2}
        value={pl.justificativa || ''}
        onChange={(e) => pl.setJustificativa?.(e.target.value)}
        placeholder="Justifique a data forçada (obrigatório)"
        aria-label="Justificativa da data forçada"
        className={AREA_CLS}
      />
    </div>
  )
}

/** Botão "Comparar com o time" e a lista de quem entrega antes. */
export function Comparacao({ pl }) {
  const c = pl?.comparacao || null
  const rows = c?.rows || []
  const erros = c?.erros || []
  const atualId = pl?.form?.responsavelId || pl?.responsavel?.id || null
  return (
    <div>
      <button
        type="button"
        onClick={() => pl?.comparar?.()}
        disabled={!!pl?.comparando}
        title="Compara a mesma tarefa na agenda de todo o time"
        className={`ln-pill disabled:opacity-50 disabled:cursor-not-allowed ${FOCO}`}
      >
        {pl?.comparando
          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Lendo o time…</>
          : <><Users className="w-3.5 h-3.5" /> Comparar com o time</>}
      </button>

      {c && (
        <div className="mt-2 divide-y divide-ln-ink/5">
          {rows.length === 0 && <p className="text-xs text-ln-t4 py-2">Ninguém do time pôde ser lido.</p>}
          {rows.map((row) => {
            const s = row.resultado?.sugestao || null
            const t = row.resultado?.totais || {}
            const atual = !!atualId && row.pessoa?.id === atualId
            return (
              <div key={row.pessoa?.id || row.pessoa?.clickupId} className="flex items-center gap-2 py-1.5">
                <Avatar nome={row.pessoa?.nome} avatar={row.pessoa?.avatar} tamanho={16} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] leading-4 text-ln-t2 truncate">
                    {row.pessoa?.nome}
                    {atual && <span className="ml-1.5 text-[10px] font-semibold text-ln-accent">atual</span>}
                  </p>
                  <p className="text-[11px] leading-4 text-ln-t3 tabular">
                    {fmtPct(t.ocupacaoProximosDias)} ocupado · {Number(t.consideradas) || 0} na fila
                  </p>
                </div>
                <p className={`text-xs font-semibold tabular shrink-0 ${s?.entrega ? 'text-ln-t1' : 'text-ln-red'}`}>
                  {s?.entrega ? fmtDiaCurto(s.entrega) : 'não cabe'}
                </p>
                {!atual && s?.entrega && (
                  <button
                    type="button"
                    onClick={() => pl.escolherAlternativa?.(row)}
                    title={`Usar ${primeiroNome(row.pessoa?.nome)} como responsável`}
                    className={`text-[11px] text-ln-accent hover:underline shrink-0 inline-flex items-center gap-0.5 rounded ${FOCO}`}
                  >
                    usar <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            )
          })}
          {erros.length > 0 && (
            <p className="text-[11px] text-ln-t4 pt-2" title={erros.map((e) => `${e.clickupUserId}: ${e.error}`).join('; ')}>
              {plural(erros.length, 'pessoa não pôde', 'pessoas não puderam')} ser lida(s) no ClickUp.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * @param {object} p
 * @param {object} p.pl              objeto do hook usePlanejador
 * @param {boolean} p.aberto
 * @param {boolean} p.minimizado
 * @param {Function} p.onMinimizar   (bool) => void
 * @param {Function} p.onFechar
 * @param {number} p.offsetRight     px a partir da direita (abre espaço pro painel lateral)
 * @param {string} p.hoje            yyyy-mm-dd
 */
export default function PlannerFloat({ pl, aberto, minimizado = false, onMinimizar, onFechar, offsetRight = 16, hoje = null }) {
  if (!aberto || !pl) return null

  const status = statusDo(pl)
  const st = STATUS[status]
  // O hook ainda não guarda a hora do cálculo; quando guardar, aparece aqui
  const calculadoEm = pl.calculadoEm || pl.resultado?.calculadoEm || null
  const textoStatus = status === 'calculado' && calculadoEm ? `calculado ${fmtHora(calculadoEm)}` : st.texto
  const right = Number(offsetRight) || 16

  if (minimizado) {
    return (
      <div className="fixed bottom-4 z-50 rounded-full bg-ln-card" style={{ right, boxShadow: 'var(--ln-shadow-panel)' }}>
        <button
          type="button"
          onClick={() => onMinimizar?.(false)}
          aria-label="Reabrir o planejador"
          title="Reabrir o planejador"
          className={`ln-pill ${FOCO}`}
        >
          <span className={`w-2 h-2 rounded-full ${st.dot}`} aria-hidden="true" />
          <span className="text-ln-t2">Planejador</span>
          <span className="text-ln-t4 tabular">· {textoStatus}</span>
        </button>
      </div>
    )
  }

  const cliente = pl.cliente?.nome || ''
  const lista = (pl.listas || []).find((l) => l.id === pl.form?.listId)?.name || pl.form?.listId || ''
  const responsavel = pl.responsavel?.nome || ''
  const titulo = String(pl.form?.titulo || '').trim() || 'Atividade sem título'
  const mostrarPedido = !!(pl.resultado || pl.calculando)
  const mostrarRodape = !!pl.resultado && !pl.criada

  return (
    <section
      role="dialog"
      aria-label="Planejador ClickUp"
      className="fixed bottom-4 z-50 flex flex-col overflow-hidden rounded-xl bg-ln-card border border-ln-ink/[0.12] max-w-[calc(100vw-2rem)]"
      style={{ right, width: LARGURA, maxHeight: ALTURA_MAX, boxShadow: 'var(--ln-ring-card), var(--ln-shadow-panel)' }}
    >
      {/* Header */}
      <div className="h-11 shrink-0 flex items-center gap-2 px-3 border-b border-ln-ink/5">
        <Sparkles className="w-4 h-4 text-ln-accent shrink-0" />
        <span className="text-[13px] font-medium text-ln-t2 shrink-0">Planejador · ClickUp</span>
        <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} aria-hidden="true" />
        <span className="text-xs text-ln-t3 truncate flex-1 min-w-0 tabular" aria-live="polite">{textoStatus}</span>
        <button type="button" onClick={() => onMinimizar?.(true)} aria-label="Minimizar o planejador" title="Minimizar" className={`ln-iconbtn ${FOCO}`}>
          <Minus className="w-4 h-4" />
        </button>
        <button type="button" onClick={onFechar} aria-label="Fechar o planejador" title="Fechar" className={`ln-iconbtn ${FOCO}`}>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Corpo */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 text-[13px] leading-5">
        {pl.criada ? (
          <CriadaCard criada={pl.criada} onNova={() => pl.novaAtividade?.()} />
        ) : (
          <>
            {mostrarPedido && (
              <div className="ml-10 rounded-lg bg-ln-ink/[0.04] ring-1 ring-ln-ink/5 p-2.5 text-ln-t2">
                <p className="break-words">
                  <span className="font-medium">{titulo}</span>
                  <span className="text-ln-t3 tabular"> · {fmtHoras(pl.horasNum)}</span>
                  {responsavel && <span className="text-ln-t3"> · {responsavel}</span>}
                </p>
              </div>
            )}

            {cliente && (
              <p className="text-xs text-ln-t4 truncate" title={`${cliente} › ${lista}`}>
                {cliente}{lista ? ` › ${lista}` : ''} adicionado ao contexto
              </p>
            )}

            {pl.calculando ? (
              <p className="text-ln-t2 flex items-center gap-2" aria-live="polite">
                <Loader2 className="w-4 h-4 animate-spin text-ln-accent shrink-0" />
                Lendo as tarefas abertas de {primeiroNome(responsavel) || 'quem executa'} no ClickUp…
              </p>
            ) : pl.erroCalculo ? (
              <p className="text-ln-red flex items-start gap-2" role="alert">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="break-words">{pl.erroCalculo}</span>
              </p>
            ) : pl.resultado ? (
              <>
                <ResultadoCard pl={pl} hoje={hoje} />
                <BlocoDataForcada pl={pl} />
                <Comparacao pl={pl} />
              </>
            ) : (
              <p className="text-xs text-ln-t4">
                Preencha a atividade no painel e calcule a data de entrega. A leitura da agenda no ClickUp aparece aqui.
              </p>
            )}
          </>
        )}
      </div>

      {/* Rodapé */}
      {mostrarRodape && (
        <div className="shrink-0 border-t border-ln-ink/[0.08] px-3 py-2.5 space-y-2">
          <p className="text-xs text-ln-t3 leading-4">
            Vai para <span className="text-ln-t2 font-medium">{lista || 'lista a definir'}</span> de{' '}
            <span className="text-ln-t2 font-medium">{cliente || 'cliente a definir'}</span>, {responsavel || 'sem responsável'},{' '}
            <span className="tabular">{fmtHoras(pl.horasNum)}</span>, entrega{' '}
            <span className="text-ln-t2 font-medium tabular">{pl.dataEscolhida ? fmtLonga(pl.dataEscolhida) : 'a definir'}</span>
          </p>
          <button
            type="button"
            onClick={() => pl.aprovar?.()}
            disabled={!pl.podeCriar}
            title={pl.podeCriar ? 'Cria a tarefa no ClickUp com essa data' : 'Preencha o que falta (e a justificativa, se a data for forçada)'}
            className={`ln-primary w-full justify-center ${FOCO}`}
          >
            {pl.criando
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Criando…</>
              : 'Aprovar e criar no ClickUp'}
          </button>
        </div>
      )}
    </section>
  )
}
