// Bloco "Entrega" no painel da tarefa (replanejamento em cascata, src/lib/cascata.js): a data de
// entrega da família (o pai mais alto) e dois alertas com ação: tarefas atrasadas ("Replanejar a partir de hoje",
// só na tarefa pai)
// e dependentes que vencem antes de quem as bloqueia ("Ajustar dependências", o caso típico de uma
// data mudada no ClickUp, que não passa pela cascata). Só aparece em tarefa que tem família.
import { useState, useEffect } from 'react'
import { AlertTriangle, CalendarClock, Link2 } from 'lucide-react'
import {
  familia, atrasadaEm, planejarReplanejamento, conflitosDependencia, planejarAjusteConflitos,
  diferencaUteis, fmtDia,
} from '../../lib/cascata'
import { linhasDoPlano, gravarTudo } from '../../hooks/useCascata'
import { FOCO } from './Campos'
import { useI18n } from '../../i18n'

const BOTAO = `inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-ln-ink/[0.1] text-xs font-medium text-ln-t1 bg-ln-panel hover:bg-ln-ink/[0.04] ${FOCO}`

export default function EntregaPainel({ item, carregarGrafo, gravar, confirmar, avisar }) {
  const { t } = useI18n()
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

  const nome = (id) => itens.get(id)?.titulo || t('tarefaPainel.semTitulo')
  const hoje = new Date()
  const raiz = itens.get(raizId)
  const atrasadas = ids.filter((x) => !filhos.has(x) && atrasadaEm(itens.get(x), hoje))
  const ehPai = item.id === raizId
  const replanejar = ehPai && atrasadas.length ? planejarReplanejamento({ itens, relacoes, id: item.id, hoje }) : null
  const novaEntrega = replanejar?.outras.find((o) => o.id === raizId)?.patch.data_vencimento
  const conflitos = conflitosDependencia({ itens, relacoes, ids })

  async function aplicar({ plano, titulo, texto, acao }) {
    const resp = await confirmar({ icone: CalendarClock, titulo, texto, rotuloItens: t('cascata.novasDatas'), itens: linhasDoPlano(plano.outras, nome), maxItens: 6, acao })
    if (resp !== true) return
    setOcupado(true)
    const { falhas, erro } = await gravarTudo(plano.outras, gravar)
    setOcupado(false)
    if (falhas) avisar?.(t('cascata.falhas', { count: falhas, erro }), 'error')
    else avisar?.(t('cascata.entrega.replanejadas', { count: plano.outras.length }))
  }

  return (
    <section aria-label={t('cascata.entrega.titulo')} className="rounded-lg border border-ln-ink/[0.08] bg-ln-ink/[0.02] p-3 flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
        <span className="text-ln-t3">{t('cascata.entrega.titulo')}</span>
        <strong className="text-ln-t1 tabular">{fmtDia(raiz?.data_vencimento)}</strong>
        {raizId !== item.id && <span className="text-ln-t4 truncate max-w-[260px]" title={nome(raizId)}>· {nome(raizId)}</span>}
        {!atrasadas.length && !conflitos.length && <span className="inline-flex h-5 items-center px-1.5 rounded text-[11px] font-medium bg-ln-green/10 text-ln-green">{t('cascata.entrega.emDia')}</span>}
      </div>

      {ehPai && atrasadas.length > 0 && (
        <div className="rounded-md bg-ln-red/[0.06] border border-ln-red/20 p-2.5 flex flex-col gap-2">
          <p className="text-xs text-ln-t2 leading-relaxed">
            <AlertTriangle className="inline w-3.5 h-3.5 -mt-0.5 mr-1 text-ln-red" />
            <strong className="text-ln-red">{t('cascata.entrega.emRisco')}</strong> {t('cascata.entrega.atrasadas', { count: atrasadas.length })}
            {' '}({atrasadas.slice(0, 2).map((x) => `“${nome(x)}”, ${rotuloAtraso(itens.get(x).data_vencimento, hoje, t)}`).join('; ')}{atrasadas.length > 2 ? '…' : ''}).
            {novaEntrega && <> {t('cascata.entrega.novaEntrega')} <strong className="text-ln-t1">{fmtDia(novaEntrega)}</strong>.</>}
          </p>
          <div>
            <button
              type="button" disabled={ocupado} className={BOTAO}
              onClick={() => aplicar({
                plano: replanejar,
                titulo: t('cascata.entrega.replanejarTitulo'),
                texto: t('cascata.entrega.replanejarTexto', { hoje: fmtDia(hoje) })
                  + (novaEntrega ? ` ${t('cascata.entrega.entregaVaiPara', { nome: nome(raizId), data: fmtDia(novaEntrega) })}` : ''),
                acao: t('cascata.entrega.replanejarAcao', { count: replanejar.outras.length }),
              })}
            ><CalendarClock className="w-3.5 h-3.5" /> {t('cascata.entrega.replanejar')}</button>
          </div>
        </div>
      )}

      {conflitos.length > 0 && (
        <div className="rounded-md bg-ln-orange/[0.07] border border-ln-orange/25 p-2.5 flex flex-col gap-2">
          <p className="text-xs text-ln-t2 leading-relaxed">
            <Link2 className="inline w-3.5 h-3.5 -mt-0.5 mr-1 text-ln-orange" />
            {t('cascata.entrega.conflitos', { count: conflitos.length })}
            {' '}({conflitos.slice(0, 2).map((c) => t('cascata.entrega.conflito', { nome: nome(c.id), data: fmtDia(itens.get(c.id).data_vencimento), bloqueadora: nome(c.bloqueadora), dataBloqueadora: fmtDia(itens.get(c.bloqueadora).data_vencimento) })).join('; ')}{conflitos.length > 2 ? '…' : ''}).
            {' '}{t('cascata.entrega.conflitoMotivo')}
          </p>
          <div>
            <button
              type="button" disabled={ocupado} className={BOTAO}
              onClick={() => {
                const plano = planejarAjusteConflitos({ itens, relacoes, id: item.id })
                return aplicar({
                  plano,
                  titulo: t('cascata.entrega.ajustarTitulo'),
                  texto: t('cascata.entrega.ajustarTexto'),
                  acao: t('cascata.entrega.ajustarAcao', { count: plano.outras.length }),
                })
              }}
            ><Link2 className="w-3.5 h-3.5" /> {t('cascata.entrega.ajustar')}</button>
          </div>
        </div>
      )}
    </section>
  )
}

function rotuloAtraso(venc, hoje, t) {
  const n = diferencaUteis(venc, hoje)
  if (n < 1) return t('cascata.entrega.venceuEm', { data: fmtDia(venc) }) // fim de semana
  return t('cascata.entrega.venceuHa', { count: n })
}
