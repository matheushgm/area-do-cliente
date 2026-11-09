// Calendário de prazo no estilo do seletor de período do Dashboard de Tráfego
// (public/dash-teste/viewer.html: atalhos numa coluna à esquerda, mês com setas,
// dia escolhido preenchido), adaptado para UM dia e para o futuro: os atalhos são
// de prazo (Hoje, Amanhã, Próxima segunda…) e o clique já escolhe. Tokens ln-*.
// `CalendarioPrazo` é só o conteúdo (vai dentro de um Popover); `DataInput` é o
// substituto do <input type="date"> com o mesmo calendário. Valores 'yyyy-mm-dd'.
// `min`/`max` bloqueiam os dias fora do intervalo (ex.: vencimento antes do início, que o
// ClickUp recusa); `motivoMin`/`motivoMax` explicam o bloqueio no rodapé e no título do dia.
import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Popover, FOCO } from './Campos'
import { useI18n, idiomaAtual, localeAtual } from '../../i18n'

// Em português os nomes são os de sempre (cravados); nos outros idiomas saem do Intl.
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const DOW = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const DOW_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const ehPt = () => idiomaAtual() === 'pt'
const nomeMes = (m) => (ehPt() ? MESES[m] : new Date(2024, m, 1).toLocaleDateString(localeAtual(), { month: 'long' }))
// 2024-09-01 é domingo
const inicialDia = (i) => (ehPt() ? DOW[i] : new Date(2024, 8, 1 + i).toLocaleDateString(localeAtual(), { weekday: 'narrow' }))
const diaCurto = (d) => (ehPt() ? DOW_CURTO[d.getDay()] : d.toLocaleDateString(localeAtual(), { weekday: 'short' }))

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const deYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const somaDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const ymAdd = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return ymd(d).slice(0, 7) }
const fmtCurto = (s) => { const d = deYmd(s); return ehPt() ? `${DOW_CURTO[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}` : `${diaCurto(d)} ${d.getMonth() + 1}/${d.getDate()}` }
export const fmtDataLonga = (s) => {
  const d = deYmd(s)
  if (!ehPt()) return d.toLocaleDateString(localeAtual(), { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
  return `${DOW_CURTO[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
}

/** Atalhos de prazo, calculados a partir de hoje. */
function atalhos(hoje) {
  const dow = hoje.getDay()
  const proxSegunda = somaDias(hoje, ((8 - dow) % 7) || 7)
  // "Esta sexta" só de domingo a quinta: na sexta e no fim de semana ela repetiria Hoje ou "Em 1 semana"
  const sexta = dow <= 4 ? somaDias(hoje, 5 - dow) : null
  const umMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, Math.min(hoje.getDate(), new Date(hoje.getFullYear(), hoje.getMonth() + 2, 0).getDate()))
  return [
    ['hoje', hoje], ['amanha', somaDias(hoje, 1)], ['sexta', sexta], ['segunda', proxSegunda],
    ['semana1', somaDias(hoje, 7)], ['semana2', somaDias(hoje, 14)], ['mes1', umMes],
  ].filter(([, d]) => d).map(([chave, d]) => ({ chave, valor: ymd(d) }))
}

/** "23/10", "23/10/26" ou "23/10/2026" → 'yyyy-mm-dd' (ano omitido = este ano). Em inglês, mês antes do dia (10/23). */
function lerDigitada(txt, hoje) {
  const m = String(txt).trim().match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/)
  if (!m) return null
  const [dia, mes] = ehPt() ? [Number(m[1]), Number(m[2])] : [Number(m[2]), Number(m[1])]
  const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : hoje.getFullYear()
  const d = new Date(y, mes - 1, dia)
  return d.getDate() === dia && d.getMonth() === mes - 1 ? ymd(d) : null
}

/** valor: 'yyyy-mm-dd' ou ''; onEscolher('yyyy-mm-dd' | '') — '' = sem data. */
export function CalendarioPrazo({ valor, onEscolher, min = '', max = '', motivoMin = '', motivoMax = '' }) {
  const { t } = useI18n()
  const hoje = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])
  const hojeS = ymd(hoje)
  const [mes, setMes] = useState((valor || hojeS).slice(0, 7))
  const [foco, setFoco] = useState(valor || hojeS)
  const [digitado, setDigitado] = useState('')
  const [erro, setErro] = useState(false)
  const gridRef = useRef(null)
  const lista = useMemo(() => atalhos(hoje), [hoje])
  const textoMin = min ? (motivoMin ? t('tarefas.calendario.motivoData', { motivo: motivoMin, data: fmtCurto(min) }) : t('tarefas.calendario.antesDe', { data: fmtCurto(min) })) : ''
  const textoMax = max ? (motivoMax ? t('tarefas.calendario.motivoData', { motivo: motivoMax, data: fmtCurto(max) }) : t('tarefas.calendario.depoisDe', { data: fmtCurto(max) })) : ''
  const foraDoIntervalo = (dia) => (min && dia < min ? textoMin : max && dia > max ? textoMax : '')

  // abre com o foco no dia escolhido (ou hoje): Enter confirma, setas andam
  // e, ao andar pelas setas, leva o foco junto (inclusive quando o mês muda)
  const focarRef = useRef(true)
  useEffect(() => {
    if (!focarRef.current) return
    focarRef.current = false
    gridRef.current?.querySelector(`[data-dia="${foco}"]`)?.focus()
  }, [foco, mes])

  function moverFoco(n) {
    const novo = ymd(somaDias(deYmd(foco), n))
    focarRef.current = true
    setFoco(novo)
    setMes(novo.slice(0, 7))
  }
  function onTecla(e) {
    const passo = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]
    if (passo) { e.preventDefault(); moverFoco(passo) }
    else if (e.key === 'PageUp' || e.key === 'PageDown') { e.preventDefault(); setMes((m) => ymAdd(m, e.key === 'PageUp' ? -1 : 1)) }
  }
  function confirmarDigitada() {
    if (!digitado.trim()) return
    const v = lerDigitada(digitado, hoje)
    if (v && !foraDoIntervalo(v)) onEscolher(v); else setErro(v ? foraDoIntervalo(v) : true)
  }

  const [y, m] = mes.split('-').map(Number)
  const vazios = new Date(y, m - 1, 1).getDay() // domingo = 0, como no dashboard
  const diasNoMes = new Date(y, m, 0).getDate()

  return (
    <div className="flex flex-col sm:flex-row min-h-0 overflow-auto">
      <div className="flex sm:flex-col gap-0.5 p-2 sm:w-[196px] shrink-0 overflow-x-auto bg-ln-ink/[0.025] border-b sm:border-b-0 sm:border-r border-ln-ink/[0.06]">
        {lista.map((a) => {
          const bloqueio = foraDoIntervalo(a.valor)
          return (
            <button
              key={a.chave} type="button" onClick={() => onEscolher(a.valor)} disabled={!!bloqueio} title={bloqueio || undefined}
              className={`shrink-0 flex items-center justify-between gap-3 h-8 px-2.5 rounded-md text-[12px] font-medium text-left whitespace-nowrap transition-colors duration-150 ${bloqueio ? 'text-ln-t4 opacity-50 cursor-not-allowed' : a.valor === valor ? 'bg-ln-accent/10 text-ln-accent' : 'text-ln-t2 hover:bg-ln-accent/[0.07] hover:text-ln-accent'} ${FOCO}`}
            >
              {t(`tarefas.calendario.atalho.${a.chave}`)}<span className="hidden sm:inline text-[11px] text-ln-t4 tabular">{fmtCurto(a.valor)}</span>
            </button>
          )
        })}
        {valor && (
          <button type="button" onClick={() => onEscolher('')} className={`shrink-0 flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[12px] font-medium text-ln-t3 hover:bg-ln-red/[0.07] hover:text-ln-red sm:mt-auto ${FOCO}`}>
            <X className="w-3 h-3" /> {t('tarefas.calendario.semData')}
          </button>
        )}
      </div>

      <div className="flex flex-col w-[248px] max-w-full mx-auto sm:mx-0">
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <button type="button" onClick={() => setMes(ymAdd(mes, -1))} className="ln-iconbtn !w-6 !h-6 border border-ln-ink/[0.08]" aria-label={t('tarefas.calendario.mesAnterior')}><ChevronLeft className="w-3.5 h-3.5" /></button>
          <span className="text-[12.5px] font-semibold text-ln-t1 capitalize">{nomeMes(m - 1)} {y}</span>
          <button type="button" onClick={() => setMes(ymAdd(mes, 1))} className="ln-iconbtn !w-6 !h-6 border border-ln-ink/[0.08]" aria-label={t('tarefas.calendario.mesSeguinte')}><ChevronRight className="w-3.5 h-3.5" /></button>
        </div>
        <div ref={gridRef} role="grid" aria-label={`${nomeMes(m - 1)} ${y}`} onKeyDown={onTecla} className="grid grid-cols-7 gap-y-0.5 px-3">
          {DOW.map((d, i) => <span key={i} className="text-center text-[10px] font-semibold uppercase text-ln-t4 pb-1">{inicialDia(i)}</span>)}
          {Array.from({ length: vazios }, (_, i) => <span key={`v${i}`} />)}
          {Array.from({ length: diasNoMes }, (_, i) => {
            const dia = `${mes}-${String(i + 1).padStart(2, '0')}`
            const escolhido = dia === valor, ehHoje = dia === hojeS, passado = dia < hojeS
            const fds = [0, 6].includes(deYmd(dia).getDay())
            const bloqueio = foraDoIntervalo(dia)
            return (
              <button
                key={dia} type="button" data-dia={dia} data-foco={dia === foco ? '1' : undefined}
                tabIndex={dia === foco || (!foco.startsWith(mes) && i === 0) ? 0 : -1}
                onClick={() => { if (!bloqueio) onEscolher(dia) }} onFocus={() => setFoco(dia)}
                aria-label={fmtDataLonga(dia)} aria-pressed={escolhido} aria-disabled={bloqueio ? true : undefined} title={bloqueio || undefined}
                className={`h-8 rounded-md text-[12px] tabular transition-colors duration-150 ${FOCO} ${
                  bloqueio ? 'text-ln-t4 opacity-40 line-through cursor-not-allowed'
                  : escolhido ? 'bg-ln-accent text-white font-semibold'
                    : ehHoje ? 'text-ln-accent font-semibold ring-1 ring-inset ring-ln-accent/40 hover:bg-ln-accent/10'
                      : `${passado ? 'text-ln-t4' : fds ? 'text-ln-t3' : 'text-ln-t2'} font-medium hover:bg-ln-accent/10 hover:text-ln-accent`
                }`}
              >
                {i + 1}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2 mt-2 px-3 py-2.5 border-t border-ln-ink/[0.06]">
          <input
            value={digitado} onChange={(e) => { setDigitado(e.target.value); setErro(false) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmarDigitada() } }}
            placeholder={t('tarefas.calendario.formatoData')} aria-label={t('tarefas.calendario.digitarData')} aria-invalid={!!erro} title={typeof erro === 'string' ? erro : undefined}
            className={`ln-input !h-7 !text-[12px] flex-1 min-w-0 tabular ${erro ? '!border-ln-red' : ''}`}
          />
          {mes !== hojeS.slice(0, 7) && (
            <button type="button" onClick={() => { setMes(hojeS.slice(0, 7)); setFoco(hojeS) }} className={`h-7 px-2 rounded-md text-[12px] font-medium text-ln-t3 hover:text-ln-accent hover:bg-ln-accent/[0.07] ${FOCO}`}>{t('tarefas.calendario.hoje')}</button>
          )}
        </div>
        {(min || max) && (
          <p className="px-3 pb-2.5 -mt-1 text-[11px] leading-snug text-ln-t4">
            {t('tarefas.calendario.bloqueado', { textos: [textoMin, textoMax].filter(Boolean).join(' · ') })}
          </p>
        )}
      </div>
    </div>
  )
}

/** Gatilho + Popover do calendário (largura cabe no celular). */
export function PopoverCalendario({ anchorRef, open, onClose, valor, onEscolher, ...limites }) {
  const vw = typeof window === 'undefined' ? 1024 : window.innerWidth
  // no celular os atalhos viram uma faixa em cima do mês e o conjunto fica mais alto
  return (
    <Popover anchorRef={anchorRef} open={open} onClose={onClose} width={Math.min(446, vw - 16)} alturaMax={vw < 640 ? 480 : 340}>
      <CalendarioPrazo valor={valor} onEscolher={(v) => { onEscolher(v); onClose() }} {...limites} />
    </Popover>
  )
}

/** Substituto do <input type="date">: mesmo valor 'yyyy-mm-dd', com o calendário acima. */
export function DataInput({ value, onChange, placeholder = null, className = '', 'aria-label': ariaLabel }) {
  const { t } = useI18n()
  const ref = useRef(null)
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <button
        ref={ref} type="button" onClick={() => setAberto((x) => !x)} aria-label={ariaLabel} aria-haspopup="dialog" aria-expanded={aberto}
        className={`ln-input flex items-center gap-2 text-left ${aberto ? '!border-ln-accent' : ''} ${className}`}
      >
        <CalendarDays className="w-3.5 h-3.5 text-ln-t4 shrink-0" />
        <span className={`truncate ${value ? 'text-ln-t1' : 'text-ln-t4'}`}>{value ? fmtCurtoAno(value) : (placeholder ?? t('tarefas.calendario.escolherData'))}</span>
      </button>
      <PopoverCalendario anchorRef={ref} open={aberto} onClose={() => setAberto(false)} valor={value || ''} onEscolher={(v) => onChange(v)} />
    </>
  )
}

const fmtCurtoAno = (s) => {
  const d = deYmd(s)
  const dd = String(d.getDate()).padStart(2, '0'), mm = String(d.getMonth() + 1).padStart(2, '0')
  return ehPt() ? `${DOW_CURTO[d.getDay()]}, ${dd}/${mm}/${d.getFullYear()}` : `${diaCurto(d)}, ${mm}/${dd}/${d.getFullYear()}`
}
