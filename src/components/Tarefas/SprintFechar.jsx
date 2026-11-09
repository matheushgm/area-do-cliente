// Fechamento da sprint de uma pessoa: combinado x entregue, decisão de cada tarefa aberta
// (próxima sprint ou backlog, como o ClickUp pergunta ao fechar) e a retro curta. O % das metas fica em SprintMetas.
import { Avatar, FOCO } from './Campos'
import { CampoTexto, LinhaTarefa, Tile, fmtPct } from './SprintComum'
import { pessoaDoPerfil } from '../../lib/tarefas'
import { fmtMin, nTarefas } from '../../lib/sprints'
import { useI18n } from '../../i18n'

// valores de `resultado` gravados em tarefas_sprint_itens → chave do rótulo
const ROTULO_RESULTADO = { concluida: 'entregue', transbordou: 'foiProxima', devolvida: 'voltouBacklog', antecipada: 'antesInicio' }

export function DecisaoAtividade({ item, onDecidir }) {
  const { t } = useI18n()
  const atual = item.decisao || 'proxima'
  return (
    <span className="inline-flex rounded-md ring-1 ring-inset ring-ln-line overflow-hidden shrink-0" role="group" aria-label={t('sprints.fechar.oQueFazer')} onClick={(e) => e.stopPropagation()}>
      {[['proxima', t('sprints.fechar.proximaSprint')], ['backlog', t('sprints.fechar.backlog')]].map(([k, r]) => (
        <button key={k} type="button" aria-pressed={atual === k} onClick={() => onDecidir(item, k)} className={`h-6 px-2 text-[11px] whitespace-nowrap ${atual === k ? 'bg-ln-accent/10 text-ln-accent font-semibold' : 'text-ln-t3 hover:bg-ln-ink/5'} ${FOCO}`}>{r}</button>
      ))}
    </span>
  )
}

export default function SprintFechar({ fase, linha, resumo, s, ctx, membrosMap }) {
  const { t } = useI18n()
  const membro = membrosMap.get(linha.pessoa_id)
  const concluida = fase === 'concluida'
  const retro = (campo) => (v) => s.atualizarPessoa(linha.id, { [campo]: v })
  const combinadas = resumo.lista.filter((c) => !c.fora && !c.antecipada)
  return (
    <div className="h-full overflow-y-auto p-3 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {membro && <Avatar pessoa={pessoaDoPerfil(membro)} size={24} />}
        <p className="text-[14px] font-semibold text-ln-t1">{t('sprints.fechar.fechamentoDe', { nome: membro?.name || '' })}</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Tile k={t('sprints.tile.combinado')} v={fmtMin(resumo.compromissoMin)} sub={nTarefas(resumo.compromissoTarefas)} />
        <Tile k={t('sprints.tile.entregue')} v={fmtMin(resumo.feitoMin)} sub={nTarefas(resumo.feitoTarefas)} tom={resumo.feitoTarefas ? 'green' : undefined} />
        <Tile k={t('sprints.tile.sayDo')} v={fmtPct(resumo.sayDo)} />
        <Tile k={t('sprints.tile.foraDoPlano')} v={fmtMin(resumo.foraMin)} sub={nTarefas(resumo.foras.length)} tom={resumo.foras.length ? 'yellow' : undefined} />
      </div>

      {!concluida && (
        <section className="ln-card !p-0 overflow-hidden">
          <p className="px-3 h-9 flex items-center text-xs font-semibold text-ln-t2 border-b border-ln-ink/[0.05]">{t('sprints.fechar.ficouAberta')} <span className="ml-1.5 text-ln-t4 font-normal tabular">{resumo.abertas.length}</span></p>
          {resumo.abertas.map((c) => (
            <LinhaTarefa key={c.item.id} tarefa={c.tarefa} titulo={c.titulo} ctx={ctx} editavel fim={<DecisaoAtividade item={c.item} onDecidir={s.decidirItem} />} />
          ))}
          {!resumo.abertas.length && <p className="py-6 text-center text-[13px] text-ln-t4">{t('sprints.fechar.nadaAberto')}</p>}
        </section>
      )}

      {concluida && (
        <section className="ln-card !p-0 overflow-hidden">
          <p className="px-3 h-9 flex items-center text-xs font-semibold text-ln-t2 border-b border-ln-ink/[0.05]">{t('sprints.fechar.resultadoCada')}</p>
          {resumo.lista.filter((c) => !c.removida).map((c) => (
            <LinhaTarefa key={c.item.id} tarefa={c.tarefa} titulo={c.titulo} ctx={ctx} etiqueta={<span className={`ln-pill !h-5 !px-1.5 text-[10px] shrink-0 ${c.item.resultado === 'concluida' ? '!text-ln-green' : ''}`}>{ROTULO_RESULTADO[c.item.resultado] ? t(`sprints.fechar.resultado.${ROTULO_RESULTADO[c.item.resultado]}`) : t('sprints.fechar.semResultado')}</span>} />
          ))}
          {!combinadas.length && !resumo.foras.length && <p className="py-6 text-center text-[13px] text-ln-t4">{t('sprints.nenhumaTarefa')}</p>}
        </section>
      )}

      <section className="ln-card p-3 flex flex-col gap-2.5">
        <p className="text-[13px] font-semibold text-ln-t1">{t('sprints.fechar.retro')}</p>
        <div className="grid gap-2.5 lg:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs text-ln-t3">{t('sprints.fechar.funcionou')}
            <CampoTexto linhas={3} valor={linha.retro_funcionou} onSalvar={retro('retro_funcionou')} placeholder={t('sprints.fechar.funcionouPh')} somenteLeitura={concluida} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ln-t3">{t('sprints.fechar.travou')}
            <CampoTexto linhas={3} valor={linha.retro_travou} onSalvar={retro('retro_travou')} placeholder={t('sprints.fechar.travouPh')} somenteLeitura={concluida} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ln-t3">{t('sprints.fechar.mudanca')}
            <CampoTexto linhas={3} valor={linha.retro_mudanca} onSalvar={retro('retro_mudanca')} placeholder={t('sprints.fechar.mudancaPh')} somenteLeitura={concluida} />
          </label>
        </div>
      </section>
    </div>
  )
}
