// Corpo do painel lateral de uma atividade planejada (registro de
// atividades_planejadas): propriedades, sobrecarga assumida, aviso e a carga
// do responsável no momento da aprovação. O container e o header ficam fora.
import { AlertTriangle, ExternalLink } from 'lucide-react'
import CargaDiaria from './CargaDiaria'
import MarkdownView from '../Editor/MarkdownView'
import { Avatar, PrioridadeIcon, PRIORIDADE_LABEL, StatusIcon, dotDepartamento } from './IssueList'
import {
  chaveAtividade, fmtDiaCurto, fmtHora, fmtHoras, fmtLonga, fmtPct, fmtRelativo, fmtData,
} from '../../lib/atividadesCarga'
import { useI18n, t as tr } from '../../i18n'
import { rotuloTipoTarefa, rotuloDepartamento } from '../../lib/tarefas'

// rótulo em atividades.atividade.badge.<status>
const STATUS_BADGE = {
  criada: { cls: 'bg-ln-green/15 text-ln-green' },
  erro:   { cls: 'bg-ln-red/15 text-ln-red' },
}

const FOCO = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ln-t2'

function Propriedade({ label, title, children }) {
  return (
    <div className="flex items-center h-6 gap-2" title={title}>
      <dt className="w-24 shrink-0 text-xs text-ln-t3">{label}</dt>
      <dd className="min-w-0 flex-1 flex items-center gap-1.5 text-xs text-ln-t2">{children}</dd>
    </div>
  )
}

function Vazio({ children }) {
  const { t } = useI18n()
  return <span className="text-ln-t4">{children ?? t('atividades.atividade.naoInformado')}</span>
}

function tituloCriacao(iso) {
  const data = fmtData(iso)
  if (!data) return ''
  return tr('atividades.atividade.dataHora', { data, hora: fmtHora(iso) })
}

/**
 * @param {object} p
 * @param {object} p.registro     linha de atividades_planejadas (null = nada selecionado)
 * @param {Map}    p.nomeProjeto  project_id → nome do cliente
 * @param {Map}    p.nomeMembro   profile_id → nome
 * @param {number} [p.agora]      timestamp de referência para "há 2 h" (padrão: agora)
 */
export default function AtividadePanel({ registro, nomeProjeto, nomeMembro, agora = undefined }) {
  const { t } = useI18n()
  if (!registro) {
    return <p className="p-4 text-[13px] text-ln-t4">{t('atividades.atividade.selecione')}</p>
  }

  const r = registro
  const cliente = nomeProjeto?.get(r.project_id) || null
  const responsavel = nomeMembro?.get(r.responsavel_profile_id) || null
  const criadaPor = nomeMembro?.get(r.created_by) || null
  const badge = STATUS_BADGE[r.status] || null
  const prioridade = PRIORIDADE_LABEL[r.prioridade] ? r.prioridade : 'normal'
  const snap = r.snapshot_carga || null
  const temSnapshot = !!(snap && Array.isArray(snap.resumo) && snap.resumo.length > 0)
  const totais = snap?.totais || null
  const foraDoCalculo = totais ? (Number(totais.zumbis) || 0) + (Number(totais.semData) || 0) : 0

  return (
    <div className="flex flex-col gap-5 p-4">
      <header>
        <div className="flex items-center gap-2 text-xs text-ln-t3">
          <StatusIcon registro={r} />
          <span className="tabular">{chaveAtividade(r.id)}</span>
          {badge && (
            <span className={`inline-flex items-center h-5 px-1.5 rounded-full text-[11px] font-medium ${badge.cls}`}>{t(`atividades.atividade.badge.${r.status}`)}</span>
          )}
        </div>
        <h2 className="mt-1.5 text-xl font-semibold text-ln-t2 tracking-[-0.01em] leading-tight break-words">
          {r.titulo || <span className="text-ln-t4 font-normal">{t('atividades.semTitulo')}</span>}
        </h2>
        {r.descricao ? (
          <MarkdownView content={r.descricao} className="md-prose--13 mt-2 text-ln-t3 break-words" />
        ) : (
          <p className="mt-2 text-sm text-ln-t4">{t('atividades.atividade.semBriefing')}</p>
        )}
      </header>

      {r.sobrecarga && (
        <div className="ln-card !border-ln-red/40 p-3">
          <p className="text-xs font-medium text-ln-red">
            {t('atividades.atividade.sobrecarga', { horas: fmtHoras(r.horas_excedentes) })}
          </p>
          <p className="mt-1 text-xs text-ln-t3">
            <span className="text-ln-t4">{t('atividades.atividade.justificativa')}</span> {r.justificativa || t('atividades.atividade.naoInformada')}
          </p>
        </div>
      )}

      {r.aviso && (
        <div className="ln-card !border-ln-yellow/40 p-3 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-ln-yellow" aria-hidden="true" />
          <p className="text-xs text-ln-t2 leading-relaxed">{r.aviso}</p>
        </div>
      )}

      <section>
        <p className="ln-label">{t('atividades.atividade.propriedades')}</p>
        <dl className="flex flex-col">
          <Propriedade label={t('atividades.atividade.prop.cliente')}>
            {cliente ? <span className="truncate">{cliente}</span> : <Vazio>{t('atividades.atividade.clienteNaoIdentificado')}</Vazio>}
          </Propriedade>
          <Propriedade label={t('atividades.atividade.prop.lista')} title={r.clickup_list_id ? t('atividades.atividade.idListaTitle') : undefined}>
            {r.clickup_list_id ? <span className="text-ln-t3 tabular">{t('atividades.atividade.id', { id: r.clickup_list_id })}</span> : <Vazio>{t('atividades.atividade.naoInformada')}</Vazio>}
          </Propriedade>
          <Propriedade label={t('atividades.atividade.prop.tipo')}>
            {r.tipo_tarefa ? (
              <>
                <i className={`w-2 h-2 rounded-full shrink-0 ${dotDepartamento(r.departamento)}`} />
                <span className="truncate">{rotuloTipoTarefa(r.tipo_tarefa)}</span>
              </>
            ) : <Vazio />}
          </Propriedade>
          <Propriedade label={t('atividades.atividade.prop.departamento')}>
            {r.departamento ? <span className="truncate">{rotuloDepartamento(r.departamento)}</span> : <Vazio />}
          </Propriedade>
          <Propriedade label={t('atividades.atividade.prop.responsavel')}>
            <Avatar nome={responsavel} tamanho={14} />
            {responsavel ? <span className="truncate">{responsavel}</span> : <Vazio>{t('atividades.atividade.semResponsavelMinusc')}</Vazio>}
          </Propriedade>
          <Propriedade label={t('atividades.atividade.prop.horas')}>
            <span className="tabular">{fmtHoras(r.horas_estimadas)}</span>
          </Propriedade>
          <Propriedade label={t('atividades.atividade.prop.prioridade')}>
            <PrioridadeIcon prioridade={prioridade} />
            <span>{t(`atividades.prioridade.${prioridade}`)}</span>
          </Propriedade>
          <Propriedade label={t('atividades.atividade.prop.inicio')} title={r.data_inicio_sugerida ? fmtLonga(r.data_inicio_sugerida) : undefined}>
            {r.data_inicio_sugerida ? <span className="tabular">{fmtDiaCurto(r.data_inicio_sugerida)}</span> : <Vazio />}
          </Propriedade>
          <Propriedade label={t('atividades.atividade.prop.sugerida')} title={r.data_sugerida ? fmtLonga(r.data_sugerida) : undefined}>
            {r.data_sugerida ? <span className="tabular">{fmtDiaCurto(r.data_sugerida)}</span> : <Vazio>{t('atividades.atividade.naoCoube')}</Vazio>}
          </Propriedade>
          <Propriedade label={t('atividades.atividade.prop.entrega')} title={r.data_escolhida ? fmtLonga(r.data_escolhida) : undefined}>
            {r.data_escolhida ? (
              <>
                <span className={`tabular ${r.sobrecarga ? 'text-ln-red font-medium' : ''}`}>{fmtDiaCurto(r.data_escolhida)}</span>
                {r.sobrecarga && <span className="text-[10px] font-semibold uppercase tracking-wide text-ln-red">{t('atividades.atividade.forcada')}</span>}
              </>
            ) : <Vazio>{t('atividades.semDataMinusc')}</Vazio>}
          </Propriedade>
          <Propriedade label={t('atividades.atividade.prop.criadaPor')} title={tituloCriacao(r.created_at)}>
            {criadaPor ? <span className="truncate">{criadaPor}</span> : <Vazio>{t('atividades.atividade.autorNaoIdentificado')}</Vazio>}
            {r.created_at && <span className="text-ln-t4 tabular whitespace-nowrap">{fmtRelativo(r.created_at, agora)}</span>}
          </Propriedade>
          <Propriedade label="ClickUp">
            {r.clickup_task_url ? (
              <a
                href={r.clickup_task_url}
                target="_blank"
                rel="noopener noreferrer"
                title={t('atividades.atividade.abrirTarefaTitle')}
                className={`inline-flex items-center gap-1 text-ln-accent hover:underline rounded ${FOCO}`}
              >
                {t('atividades.atividade.abrirTarefa')} <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            ) : r.status === 'erro' ? (
              <span className="text-ln-red">{t('atividades.atividade.naoCriada')}</span>
            ) : (
              <Vazio>{t('atividades.atividade.semLink')}</Vazio>
            )}
          </Propriedade>
        </dl>
      </section>

      <section>
        <p className="ln-label">{t('atividades.atividade.cargaAprovacao')}</p>
        {temSnapshot ? (
          <>
            <CargaDiaria
              resumo={snap.resumo}
              capacidade={snap.capacidadeDia}
              hoje={snap.hoje}
              sugestao={snap.sugestao || null}
              diaSelecionado={r.sobrecarga ? r.data_escolhida : null}
              altura={100}
            />
            {totais && (
              <p className="mt-2 text-[11px] text-ln-t4 tabular">
                {t('atividades.atividade.agendaLida', { nome: responsavel || t('atividades.atividade.responsavelMinusc'), dia: fmtDiaCurto(snap.hoje), pct: fmtPct(totais.ocupacaoProximosDias) })}
                {' · '}{t('atividades.atividade.nAtrasadas', { n: Number(totais.atrasadas) || 0 })}
                {' · '}{t('atividades.atividade.nFora', { n: foraDoCalculo })}
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-ln-t4">{t('atividades.atividade.semSnapshot')}</p>
        )}
      </section>
    </div>
  )
}
