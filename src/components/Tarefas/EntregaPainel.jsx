// Bloco "Entrega" no painel da tarefa (replanejamento em cascata, src/lib/cascata.js): a data de
// entrega da família (o pai mais alto) e dois alertas com ação: tarefas atrasadas ("Replanejar a partir de hoje")
// e dependentes que vencem antes de quem as bloqueia ("Ajustar dependências", o caso típico de uma
// data mudada no ClickUp, que não passa pela cascata). Só aparece em tarefa que tem família.
import { useState, useEffect } from 'react'
import { AlertTriangle, CalendarClock, Link2 } from 'lucide-react'
import {
  familia, atrasadaEm, planejarReplanejamento, conflitosDependencia, planejarAjusteConflitos,
  diferencaUteis, fmtDia,
} from '../../lib/cascata'
import { linhasDoPlano, gravarTudo, plural } from '../../hooks/useCascata'
import { FOCO } from './Campos'

const BOTAO = `inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-ln-ink/[0.1] text-xs font-medium text-ln-t1 bg-ln-panel hover:bg-ln-ink/[0.04] ${FOCO}`

export default function EntregaPainel({ item, carregarGrafo, gravar, confirmar, avisar }) {
  const [grafo, setGrafo] = useState(null)
  const [ocupado, setOcupado] = useState(false)

  // relê a família quando a tarefa ou o que está na tela muda (carregarGrafo muda junto com as tarefas)
  useEffect(() => {
    let vivo = true
    const t = setTimeout(() => {
      carregarGrafo(item.id).then((g) => { if (vivo) setGrafo(g) }).catch((e) => console.error('Entrega: falha ao ler a família', e))
    }, 300)
    return () => { vivo = false; clearTimeout(t) }
  }, [item.id, carregarGrafo])

  if (!grafo?.itens?.has(item.id)) return null
  const { itens, relacoes } = grafo
  const { raizId, ids, filhos } = familia(itens, item.id)
  if (ids.length < 2) return null

  const nome = (id) => itens.get(id)?.titulo || 'Sem título'
  const hoje = new Date()
  const raiz = itens.get(raizId)
  const atrasadas = ids.filter((x) => !filhos.has(x) && atrasadaEm(itens.get(x), hoje))
  const replanejar = atrasadas.length ? planejarReplanejamento({ itens, relacoes, id: item.id, hoje }) : null
  const novaEntrega = replanejar?.outras.find((o) => o.id === raizId)?.patch.data_vencimento
  const conflitos = conflitosDependencia({ itens, relacoes, ids })

  async function aplicar({ plano, titulo, texto, acao }) {
    const resp = await confirmar({ icone: CalendarClock, titulo, texto, rotuloItens: 'Novas datas', itens: linhasDoPlano(plano.outras, nome), maxItens: 6, acao })
    if (resp !== true) return
    setOcupado(true)
    const { falhas, erro } = await gravarTudo(plano.outras, gravar)
    setOcupado(false)
    if (falhas) avisar?.(`${plural(falhas, 'tarefa não foi atualizada', 'tarefas não foram atualizadas')}: ${erro}`, 'error')
    else avisar?.(`${plural(plano.outras.length, 'tarefa replanejada', 'tarefas replanejadas')}`)
  }

  return (
    <section aria-label="Entrega" className="rounded-lg border border-ln-ink/[0.08] bg-ln-ink/[0.02] p-3 flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
        <span className="text-ln-t3">Entrega</span>
        <strong className="text-ln-t1 tabular">{fmtDia(raiz?.data_vencimento)}</strong>
        {raizId !== item.id && <span className="text-ln-t4 truncate max-w-[260px]" title={nome(raizId)}>· {nome(raizId)}</span>}
        {!atrasadas.length && !conflitos.length && <span className="inline-flex h-5 items-center px-1.5 rounded text-[11px] font-medium bg-ln-green/10 text-ln-green">em dia</span>}
      </div>

      {atrasadas.length > 0 && (
        <div className="rounded-md bg-ln-red/[0.06] border border-ln-red/20 p-2.5 flex flex-col gap-2">
          <p className="text-xs text-ln-t2 leading-relaxed">
            <AlertTriangle className="inline w-3.5 h-3.5 -mt-0.5 mr-1 text-ln-red" />
            <strong className="text-ln-red">Entrega em risco:</strong> {plural(atrasadas.length, 'tarefa atrasada', 'tarefas atrasadas')}
            {' '}({atrasadas.slice(0, 2).map((x) => `“${nome(x)}”, ${rotuloAtraso(itens.get(x).data_vencimento, hoje)}`).join('; ')}{atrasadas.length > 2 ? '…' : ''}).
            {novaEntrega && <> Replanejando a partir de hoje, a entrega vai para <strong className="text-ln-t1">{fmtDia(novaEntrega)}</strong>.</>}
          </p>
          <div>
            <button
              type="button" disabled={ocupado} className={BOTAO}
              onClick={() => aplicar({
                plano: replanejar,
                titulo: 'Replanejar a partir de hoje?',
                texto: `As atrasadas passam a vencer hoje (${fmtDia(hoje)}) e as que dependem delas andam junto, mantendo a distância entre elas.`
                  + (novaEntrega ? ` A entrega “${nome(raizId)}” vai para ${fmtDia(novaEntrega)}.` : ''),
                acao: `Replanejar ${plural(replanejar.outras.length, 'tarefa', 'tarefas')}`,
              })}
            ><CalendarClock className="w-3.5 h-3.5" /> Replanejar a partir de hoje</button>
          </div>
        </div>
      )}

      {conflitos.length > 0 && (
        <div className="rounded-md bg-ln-orange/[0.07] border border-ln-orange/25 p-2.5 flex flex-col gap-2">
          <p className="text-xs text-ln-t2 leading-relaxed">
            <Link2 className="inline w-3.5 h-3.5 -mt-0.5 mr-1 text-ln-orange" />
            {conflitos.length === 1 ? 'Uma tarefa vence' : `${conflitos.length} tarefas vencem`} antes de quem a bloqueia
            {' '}({conflitos.slice(0, 2).map((c) => `“${nome(c.id)}” vence ${fmtDia(itens.get(c.id).data_vencimento)}, mas “${nome(c.bloqueadora)}” só ${fmtDia(itens.get(c.bloqueadora).data_vencimento)}`).join('; ')}{conflitos.length > 2 ? '…' : ''}).
            {' '}Acontece quando a data muda sem a cascata, por exemplo no ClickUp.
          </p>
          <div>
            <button
              type="button" disabled={ocupado} className={BOTAO}
              onClick={() => {
                const plano = planejarAjusteConflitos({ itens, relacoes, id: item.id })
                return aplicar({
                  plano,
                  titulo: 'Ajustar as dependências?',
                  texto: 'Cada tarefa em conflito passa a vencer junto com quem a bloqueia, e as que dependem dela andam a mesma distância.',
                  acao: `Ajustar ${plural(plano.outras.length, 'tarefa', 'tarefas')}`,
                })
              }}
            ><Link2 className="w-3.5 h-3.5" /> Ajustar dependências</button>
          </div>
        </div>
      )}
    </section>
  )
}

function rotuloAtraso(venc, hoje) {
  const n = diferencaUteis(venc, hoje)
  if (n < 1) return `venceu em ${fmtDia(venc)}` // fim de semana
  return n === 1 ? 'venceu há 1 dia útil' : `venceu há ${n} dias úteis`
}
