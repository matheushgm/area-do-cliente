// Timer das tarefas (tarefas_tempo, migration 145).
// - TimerTarefa: propriedade "Tempo" no painel da tarefa (iniciar/parar, total, registros do
//   time, adicionar tempo à mão, excluir o próprio registro).
// - TimerAtivo: pílula com o timer rodando da pessoa (cabeçalho do VertaTask), com parar.
import { useMemo, useState } from 'react'
import { Play, Square, Plus, Trash2, ChevronDown } from 'lucide-react'
import { useTimer, useTempoDaTarefa, useAgora } from '../../hooks/useTimer'
import { segundosDaEntrada, fmtRelogio, fmtDuracao, lerDuracao } from '../../lib/tempo'
import { pessoaDoPerfil } from '../../lib/tarefas'
import { Avatar, FOCO } from './Campos'
import { useI18n } from '../../i18n'

function dataHoraLocal(d = new Date()) {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return x.toISOString().slice(0, 16)
}
const fmtQuando = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** Botão iniciar/parar com o relógio; usado no painel e no menu da linha. */
export function BotaoTimer({ item, user, onAviso, compacto = false }) {
  const { t } = useI18n()
  const timer = useTimer(user)
  const [ocupado, setOcupado] = useState(false)
  const aqui = timer.rodando?.tarefa_id === item.id
  const agora = useAgora(aqui)
  if (!timer.habilitado) return null

  async function alternar(e) {
    e?.stopPropagation()
    if (ocupado) return
    setOcupado(true)
    if (aqui) {
      const r = await timer.parar()
      if (r.error) onAviso?.(r.error, 'error')
      else if (r.data) onAviso?.(t('horas.timer.parado', { tempo: fmtDuracao(r.data.segundos) }))
    } else {
      const antes = timer.tarefa
      const r = await timer.iniciar(item)
      if (r.error) onAviso?.(r.error, 'error')
      else if (r.anterior && antes) onAviso?.(t('horas.timer.trocou', { titulo: antes.titulo || '' }))
    }
    setOcupado(false)
  }

  return (
    <button
      type="button" onClick={alternar} disabled={ocupado}
      title={aqui ? t('horas.timer.parar') : t('horas.timer.iniciar')} aria-label={aqui ? t('horas.timer.parar') : t('horas.timer.iniciar')}
      className={`inline-flex items-center gap-1.5 h-7 ${compacto ? 'px-1.5' : 'px-2.5'} rounded-md text-xs font-semibold transition-colors disabled:opacity-60 ${FOCO} ${
        aqui ? 'bg-ln-red/10 text-ln-red hover:bg-ln-red/15' : 'bg-ln-accent/10 text-ln-accent hover:bg-ln-accent/15'
      }`}
    >
      {aqui ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
      {aqui ? <span className="tabular">{fmtRelogio(segundosDaEntrada(timer.rodando, agora))}</span> : !compacto && t('horas.timer.iniciarCurto')}
    </button>
  )
}

function FormManual({ onSalvar, onCancelar }) {
  const { t } = useI18n()
  const [quando, setQuando] = useState(() => dataHoraLocal(new Date(Date.now() - 60 * 60000)))
  const [duracao, setDuracao] = useState('')
  const [nota, setNota] = useState('')
  const [erro, setErro] = useState(null)
  const [salvando, setSalvando] = useState(false)
  async function salvar(e) {
    e.preventDefault()
    const seg = lerDuracao(duracao)
    if (!seg) { setErro(t('horas.timer.duracaoInvalida')); return }
    setSalvando(true)
    const r = await onSalvar({ inicio: new Date(quando), segundos: seg, nota: nota.trim() })
    setSalvando(false)
    if (r?.error) setErro(r.error)
  }
  return (
    <form onSubmit={salvar} className="mt-2 p-2.5 rounded-lg ring-1 ring-inset ring-ln-line flex flex-col gap-2">
      <div className="flex gap-2">
        <label className="flex-1 min-w-0 flex flex-col gap-1 text-[11px] text-ln-t3">{t('horas.timer.quando')}
          <input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} className="ln-input !h-8 !text-xs" required />
        </label>
        <label className="w-28 flex flex-col gap-1 text-[11px] text-ln-t3">{t('horas.timer.duracao')}
          <input autoFocus value={duracao} onChange={(e) => { setDuracao(e.target.value); setErro(null) }} placeholder={t('horas.timer.duracaoPlaceholder')} className="ln-input !h-8 !text-xs" />
        </label>
      </div>
      <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder={t('horas.timer.nota')} className="ln-input !h-8 !text-xs" />
      {erro && <p className="text-[11px] text-ln-red">{erro}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancelar} className="ln-pill">{t('horas.timer.cancelar')}</button>
        <button type="submit" disabled={salvando} className="ln-primary !h-7 !text-xs">{t('horas.timer.salvar')}</button>
      </div>
    </form>
  )
}

/** Linha "Tempo" do painel + registros. */
export function TimerTarefa({ item, user, membrosMap, onAviso }) {
  const { t } = useI18n()
  const timer = useTimer(user)
  const tempo = useTempoDaTarefa(item.id, user)
  const [aberto, setAberto] = useState(false)
  const [manual, setManual] = useState(false)
  const rodandoAlguem = tempo.entradas.some((e) => !e.fim)
  const agora = useAgora(rodandoAlguem)
  const { total, meu } = useMemo(() => {
    let tot = 0, eu = 0
    for (const e of tempo.entradas) { const s = segundosDaEntrada(e, agora); tot += s; if (e.user_id === user?.id) eu += s }
    return { total: tot, meu: eu }
  }, [tempo.entradas, agora, user?.id])
  if (!timer.habilitado) return null
  const n = tempo.entradas.length

  return (
    <div className="min-w-0 flex-1 flex flex-col">
      <div className="flex items-center gap-2 flex-wrap">
        <BotaoTimer item={item} user={user} onAviso={onAviso} />
        {total > 0 && <span className="tabular text-ln-t2" title={meu !== total ? t('horas.timer.seu', { tempo: fmtDuracao(meu) }) : undefined}>{t('horas.timer.total', { tempo: fmtDuracao(total) })}</span>}
        <button type="button" onClick={() => setAberto((v) => !v)} className={`inline-flex items-center gap-0.5 text-ln-t4 hover:text-ln-t2 rounded ${FOCO}`} aria-expanded={aberto}>
          {aberto ? t('horas.timer.ocultarRegistros') : t('horas.timer.registros', { count: n })}
          <ChevronDown className={`w-3 h-3 transition-transform ${aberto ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {aberto && (
        <div className="mt-2 flex flex-col">
          {!n && <p className="text-[11px] text-ln-t4 py-1">{t('horas.timer.semRegistros')}</p>}
          {tempo.entradas.map((e) => {
            const m = membrosMap?.get(e.user_id)
            const pessoa = m ? pessoaDoPerfil(m) : { id: e.user_id, nome: '?', iniciais: '?', cor: '#87909e' }
            const meuReg = e.user_id === user?.id
            return (
              <div key={e.id} className="group/reg flex items-center gap-2 min-h-[28px] text-[12px]">
                <Avatar pessoa={pessoa} size={16} />
                <span className="truncate text-ln-t3 min-w-0 flex-1" title={e.nota || undefined}>
                  {pessoa.nome.split(' ')[0]} · {fmtQuando(e.inicio)}{e.nota ? ` · ${e.nota}` : ''}
                </span>
                {e.origem === 'manual' && <span className="text-[10px] uppercase tracking-wide text-ln-t4">{t('horas.timer.manual')}</span>}
                <span className={`tabular ${e.fim ? 'text-ln-t2' : 'text-ln-red font-semibold'}`}>{e.fim ? fmtDuracao(e.segundos) : `${fmtRelogio(segundosDaEntrada(e, agora))} ${t('horas.timer.rodando')}`}</span>
                {meuReg && (
                  <button
                    type="button" title={t('horas.timer.excluir')} aria-label={t('horas.timer.excluir')}
                    onClick={async () => { if (!window.confirm(t('horas.timer.excluirConfirm'))) return; const r = await tempo.excluir(e.id); if (r.error) onAviso?.(r.error, 'error') }}
                    className="ln-iconbtn !w-5 !h-5 opacity-0 group-hover/reg:opacity-100 focus-visible:opacity-100"
                  ><Trash2 className="w-3 h-3" /></button>
                )}
              </div>
            )
          })}
          {manual ? (
            <FormManual onCancelar={() => setManual(false)} onSalvar={async (v) => { const r = await tempo.adicionarManual(v); if (!r.error) setManual(false); return r }} />
          ) : (
            <button type="button" onClick={() => setManual(true)} className={`mt-1 self-start inline-flex items-center gap-1 text-[12px] text-ln-t3 hover:text-ln-t1 rounded ${FOCO}`}>
              <Plus className="w-3 h-3" /> {t('horas.timer.adicionar')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Pílula do timer rodando (cabeçalho do VertaTask). Some quando nada roda. */
export function TimerAtivo({ user, onAbrir, onAviso }) {
  const { t } = useI18n()
  const timer = useTimer(user)
  const agora = useAgora(!!timer.rodando)
  const [ocupado, setOcupado] = useState(false)
  if (!timer.habilitado || !timer.rodando) return null
  const titulo = timer.tarefa?.titulo || t('horas.timer.tarefaPrivada')
  return (
    <div className="inline-flex items-center h-8 rounded-full bg-ln-red/10 text-ln-red pl-2.5 pr-1 gap-1.5 max-w-[320px]" title={t('horas.timer.ativoTitulo', { titulo })}>
      <span className="relative flex w-2 h-2 shrink-0"><span className="absolute inset-0 rounded-full bg-ln-red animate-ping opacity-60" /><span className="relative w-2 h-2 rounded-full bg-ln-red" /></span>
      <button type="button" onClick={() => onAbrir?.(timer.rodando.tarefa_id)} className={`min-w-0 truncate text-xs font-medium hover:underline rounded ${FOCO}`} title={t('horas.timer.abrirTarefa')}>
        {titulo}
      </button>
      <span className="tabular text-xs font-semibold">{fmtRelogio(segundosDaEntrada(timer.rodando, agora))}</span>
      <button
        type="button" disabled={ocupado} aria-label={t('horas.timer.parar')} title={t('horas.timer.parar')}
        onClick={async () => { setOcupado(true); const r = await timer.parar(); setOcupado(false); if (r.error) onAviso?.(r.error, 'error'); else if (r.data) onAviso?.(t('horas.timer.parado', { tempo: fmtDuracao(r.data.segundos) })) }}
        className={`w-6 h-6 rounded-full inline-flex items-center justify-center hover:bg-ln-red/15 disabled:opacity-60 ${FOCO}`}
      ><Square className="w-3 h-3 fill-current" /></button>
    </div>
  )
}
