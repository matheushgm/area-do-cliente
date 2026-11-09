// Lista de tarefas à esquerda do Gantt. A biblioteca só desenha o nome (sem colunas), então a lista é
// nossa e a biblioteca fica só com a linha do tempo (`showTaskList={false}`). As duas andam juntas:
// mesmas linhas, na mesma ordem (a do `sequence`, sem as filhas de quem está recolhido), mesma altura
// de linha, e a rolagem vertical é a da linha do tempo (a roda aqui rola lá; lá move aqui).
// Colunas = `config.colunasGantt` da view (COLUNAS_GANTT), editadas pelo botão "Colunas" da barra.
// As células são as da Lista (`Celula`), com Início, Vencimento e Duração próprias do Gantt.
import { useRef, useState } from 'react'
import { ChevronRight, GripVertical } from 'lucide-react'
import { Celula } from './ListaView'
import { StatusCampo, DataCampo, limitesInicio, limitesVencimento, FOCO } from './Campos'
import { fmtDataNumerica } from '../../lib/tarefas'
import { diasUteisEntre } from '../../lib/templates'
import { diasDaTarefa } from '../../lib/gantt'
import { useI18n } from '../../i18n'

export const LARGURA_COLUNA = { status: 120, resp: 96, inicio: 96, venc: 96, duracao: 84, prio: 100, estim: 96, tipo: 140, sprint: 120, cliente: 140, criada: 96, concluida: 96 }
const NOME = { padrao: 300, min: 180, max: 600 }
const CHAVE_NOME = 'tarefas.gantt.larguraNome'
const lerNome = () => { try { const v = Number(localStorage.getItem(CHAVE_NOME)); return v >= NOME.min && v <= NOME.max ? v : NOME.padrao } catch { return NOME.padrao } }

function CelulaGantt({ k, item, ctx }) {
  const { t } = useI18n()
  if (k === 'inicio' || k === 'venc') {
    const campo = k === 'inicio' ? 'data_inicio' : 'data_vencimento'
    const lim = k === 'inicio' ? limitesInicio(item) : limitesVencimento(item)
    return (
      <DataCampo valor={item[campo]} item={item} placeholder="" {...lim} onChange={(v) => ctx.onAtualizar(item.id, { [campo]: v })}
        render={<span className="text-[13px] tabular whitespace-nowrap text-ln-t2">{item[campo] ? fmtDataNumerica(item[campo]) : '—'}</span>} />
    )
  }
  if (k === 'duracao') {
    const d = diasDaTarefa(item)
    return <span className="text-[13px] tabular text-ln-t2">{d ? t('tarefas.gantt.diasUteis', { n: diasUteisEntre(d.a, d.b) + 1 }) : ''}</span>
  }
  return <Celula k={k} item={item} ctx={ctx} />
}

/**
 * linhas: [{ id, item, depth, temFilhos, recolhido, parentId }] na ordem da tela; cols: chaves visíveis;
 * scrollTop/altura: da linha do tempo; onRolar(dy); onAlternar(id); onMover({ taskId, fromParentId,
 * toParentId, toIndex, afterId, beforeId }) ou null quando a reordenação está desligada.
 */
export default function GanttLista({ linhas, cols, ctx, alturaLinha, cabecalho, scrollTop, altura, onRolar, onAlternar, onMover }) {
  const { t } = useI18n()
  const [larguraNome, setLarguraNome] = useState(lerNome)
  const [arrastando, setArrastando] = useState(null) // { id, parentId }
  const [alvo, setAlvo] = useState(null) // { id, depois }
  const [redimensionando, setRedimensionando] = useState(false)
  const largura = larguraNome + cols.reduce((a, k) => a + (LARGURA_COLUNA[k] || 100), 0)
  const grade = `${larguraNome}px ${cols.map((k) => `${LARGURA_COLUNA[k] || 100}px`).join(' ')}`

  const ini = Math.max(0, Math.floor(scrollTop / alturaLinha) - 8)
  const fim = Math.min(linhas.length, Math.ceil((scrollTop + altura) / alturaLinha) + 8)

  // alça do Nome: arrastar muda a largura (local, como a do Nome da Lista); duplo clique volta ao padrão
  const alca = useRef(null)
  const iniciarAlca = (e) => {
    e.preventDefault()
    const x0 = e.clientX, w0 = larguraNome
    let w = w0
    setRedimensionando(true)
    document.body.style.cursor = 'col-resize'
    const mover = (ev) => { w = Math.min(NOME.max, Math.max(NOME.min, w0 + ev.clientX - x0)); setLarguraNome(w) }
    const soltar = () => {
      window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar)
      setRedimensionando(false)
      document.body.style.cursor = ''
      try { localStorage.setItem(CHAVE_NOME, String(Math.round(w))) } catch { /* sem storage */ }
    }
    window.addEventListener('pointermove', mover); window.addEventListener('pointerup', soltar)
  }

  const soltar = () => {
    const a = arrastando, b = alvo
    setArrastando(null); setAlvo(null)
    if (!a || !b || a.id === b.id || !onMover) return
    const irmas = linhas.filter((l) => l.parentId === a.parentId && l.id !== a.id)
    const k = irmas.findIndex((l) => l.id === b.id)
    if (k < 0) return
    const toIndex = b.depois ? k + 1 : k
    onMover({ taskId: a.id, fromParentId: a.parentId, toParentId: a.parentId, toIndex, afterId: irmas[toIndex - 1]?.id ?? null, beforeId: irmas[toIndex]?.id ?? null })
  }

  return (
    <div className="shrink-0 max-w-[60%] border-r border-ln-border overflow-x-auto overflow-y-hidden bg-ln-bg" onWheel={(e) => { if (!e.shiftKey) onRolar(e.deltaY) }}>
      <div style={{ width: largura }} className="h-full flex flex-col">
        <div className="grid shrink-0 items-end border-b border-ln-border bg-ln-panel text-[11px] font-semibold uppercase tracking-wide text-ln-t4" style={{ gridTemplateColumns: grade, height: cabecalho }}>
          <div className="relative flex items-end self-stretch px-3">
            <span className="flex items-center h-9">{t('tarefas.gantt.tarefa')}</span>
            <span ref={alca} role="separator" aria-orientation="vertical" aria-label={t('tarefas.gantt.larguraTarefa')} tabIndex={0}
              onPointerDown={iniciarAlca} onDoubleClick={() => { setLarguraNome(NOME.padrao); try { localStorage.removeItem(CHAVE_NOME) } catch { /* sem storage */ } }}
              onKeyDown={(e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const w = Math.min(NOME.max, Math.max(NOME.min, larguraNome + (e.key === 'ArrowRight' ? 20 : -20))); setLarguraNome(w); try { localStorage.setItem(CHAVE_NOME, String(w)) } catch { /* sem storage */ } } }}
              className={`group/alca absolute -right-1.5 top-0 bottom-0 z-10 flex w-3 cursor-col-resize justify-center ${FOCO}`} title={t('tarefas.gantt.larguraTitulo')}>
              <span className={`h-full w-px transition-all ${redimensionando ? 'w-0.5 bg-ln-accent' : 'bg-ln-border group-hover/alca:w-0.5 group-hover/alca:bg-ln-accent group-focus-visible/alca:w-0.5 group-focus-visible/alca:bg-ln-accent'}`} />
            </span>
          </div>
          {cols.map((k) => <div key={k} className="flex items-center h-9 px-2 truncate">{ctx.rotuloColuna?.(k) || k}</div>)}
        </div>
        <div className="relative flex-1 overflow-hidden" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); soltar() }}>
          {redimensionando && <span aria-hidden="true" className="pointer-events-none absolute top-0 bottom-0 z-10 w-0.5 bg-ln-accent/60" style={{ left: larguraNome - 1 }} />}
          <div className="absolute inset-x-0 top-0" style={{ height: linhas.length * alturaLinha, transform: `translateY(${-scrollTop}px)` }}>
            {linhas.slice(ini, fim).map((l, i) => {
              const idx = ini + i
              const it = l.item
              const sel = ctx.selecionadaId === l.id
              const valido = arrastando && arrastando.parentId === l.parentId && arrastando.id !== l.id
              return (
                <div key={l.id}
                  className={`group absolute inset-x-0 grid items-center border-b border-ln-ink/[0.05] text-[13px] ${sel ? 'bg-ln-accent/[0.08]' : 'hover:bg-ln-ink/[0.03]'} ${arrastando?.id === l.id ? 'opacity-40' : ''}`}
                  style={{ gridTemplateColumns: grade, height: alturaLinha, transform: `translateY(${idx * alturaLinha}px)` }}
                  onDragOver={(e) => { if (!valido) return; e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); setAlvo({ id: l.id, depois: e.clientY > r.top + r.height / 2 }) }}
                >
                  {valido && alvo?.id === l.id && <span aria-hidden="true" className={`absolute left-2 right-2 h-0.5 rounded bg-ln-accent ${alvo.depois ? '-bottom-px' : '-top-px'}`} />}
                  <div className="flex items-center min-w-0 h-full pr-2" style={{ paddingLeft: 4 + l.depth * 16 }}>
                    {onMover ? (
                      <span draggable onDragStart={(e) => { setArrastando({ id: l.id, parentId: l.parentId }); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', l.id) }}
                        onDragEnd={() => { setArrastando(null); setAlvo(null) }}
                        className="inline-flex items-center justify-center w-4 h-6 shrink-0 text-ln-t4 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing" title={t('tarefas.gantt.arrasteOrdem')}>
                        <GripVertical className="w-3.5 h-3.5" />
                      </span>
                    ) : <span className="w-4 shrink-0" />}
                    {l.temFilhos ? (
                      <button type="button" onClick={() => onAlternar(l.id)} aria-expanded={!l.recolhido} aria-label={l.recolhido ? t('tarefas.gantt.expandir') : t('tarefas.gantt.recolher')}
                        className={`inline-flex items-center justify-center w-5 h-5 shrink-0 rounded text-ln-t3 hover:bg-ln-ink/5 ${FOCO}`}>
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${l.recolhido ? '' : 'rotate-90'}`} />
                      </button>
                    ) : <span className="w-5 shrink-0" />}
                    <StatusCampo item={it} statuses={ctx.statusesDe?.(it) || ctx.statuses} modo="icon" onChange={(s) => ctx.onMudarStatus?.(it, s)} className="shrink-0 mx-1" />
                    <button type="button" onClick={() => ctx.onAbrir?.(l.id)} title={it.titulo}
                      className={`min-w-0 flex-1 truncate text-left ${l.temFilhos ? 'font-semibold text-ln-t1' : 'text-ln-t2'} ${it.status_tipo === 'closed' ? 'line-through text-ln-t4' : ''} hover:text-ln-accent ${FOCO}`}>
                      {it.titulo || t('tarefas.semTitulo')}
                    </button>
                  </div>
                  {cols.map((k) => <div key={k} className="flex items-center min-w-0 px-2 overflow-hidden"><CelulaGantt k={k} item={it} ctx={ctx} /></div>)}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
