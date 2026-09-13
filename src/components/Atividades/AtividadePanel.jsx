// Corpo do painel lateral de uma atividade planejada (registro de
// atividades_planejadas): propriedades, sobrecarga assumida, aviso e a carga
// do responsável no momento da aprovação. O container e o header ficam fora.
import { AlertTriangle, ExternalLink } from 'lucide-react'
import CargaDiaria from './CargaDiaria'
import { Avatar, PrioridadeIcon, PRIORIDADE_LABEL, StatusIcon, dotDepartamento } from './IssueList'
import {
  chaveAtividade, fmtDiaCurto, fmtHora, fmtHoras, fmtLonga, fmtPct, fmtRelativo,
} from '../../lib/atividadesCarga'

const STATUS_BADGE = {
  criada: { label: 'Criada no ClickUp', cls: 'bg-ln-green/15 text-ln-green' },
  erro:   { label: 'Erro ao criar',     cls: 'bg-ln-red/15 text-ln-red' },
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

function Vazio({ children = 'não informado' }) {
  return <span className="text-ln-t4">{children}</span>
}

function tituloCriacao(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.toLocaleDateString('pt-BR')} às ${fmtHora(iso)}`
}

/**
 * @param {object} p
 * @param {object} p.registro     linha de atividades_planejadas (null = nada selecionado)
 * @param {Map}    p.nomeProjeto  project_id → nome do cliente
 * @param {Map}    p.nomeMembro   profile_id → nome
 * @param {number} [p.agora]      timestamp de referência para "há 2 h" (padrão: agora)
 */
export default function AtividadePanel({ registro, nomeProjeto, nomeMembro, agora = undefined }) {
  if (!registro) {
    return <p className="p-4 text-[13px] text-ln-t4">Selecione uma atividade na lista.</p>
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
            <span className={`inline-flex items-center h-5 px-1.5 rounded-full text-[11px] font-medium ${badge.cls}`}>{badge.label}</span>
          )}
        </div>
        <h2 className="mt-1.5 text-xl font-semibold text-ln-t2 tracking-[-0.01em] leading-tight break-words">
          {r.titulo || <span className="text-ln-t4 font-normal">Sem título</span>}
        </h2>
        {r.descricao ? (
          <p className="mt-2 text-sm text-ln-t3 leading-relaxed whitespace-pre-wrap break-words">{r.descricao}</p>
        ) : (
          <p className="mt-2 text-sm text-ln-t4">Sem briefing</p>
        )}
      </header>

      {r.sobrecarga && (
        <div className="ln-card !border-ln-red/40 p-3">
          <p className="text-xs font-medium text-ln-red">
            Sobrecarga assumida: {fmtHoras(r.horas_excedentes)} além da capacidade do dia
          </p>
          <p className="mt-1 text-xs text-ln-t3">
            <span className="text-ln-t4">Justificativa:</span> {r.justificativa || 'não informada'}
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
        <p className="ln-label">Propriedades</p>
        <dl className="flex flex-col">
          <Propriedade label="Cliente">
            {cliente ? <span className="truncate">{cliente}</span> : <Vazio>cliente não identificado</Vazio>}
          </Propriedade>
          <Propriedade label="Lista" title={r.clickup_list_id ? 'ID da lista no ClickUp' : undefined}>
            {r.clickup_list_id ? <span className="text-ln-t3 tabular">ID {r.clickup_list_id}</span> : <Vazio>não informada</Vazio>}
          </Propriedade>
          <Propriedade label="Tipo">
            {r.tipo_tarefa ? (
              <>
                <i className={`w-2 h-2 rounded-full shrink-0 ${dotDepartamento(r.departamento)}`} />
                <span className="truncate">{r.tipo_tarefa}</span>
              </>
            ) : <Vazio />}
          </Propriedade>
          <Propriedade label="Departamento">
            {r.departamento ? <span className="truncate">{r.departamento}</span> : <Vazio />}
          </Propriedade>
          <Propriedade label="Responsável">
            <Avatar nome={responsavel} tamanho={14} />
            {responsavel ? <span className="truncate">{responsavel}</span> : <Vazio>sem responsável</Vazio>}
          </Propriedade>
          <Propriedade label="Horas">
            <span className="tabular">{fmtHoras(r.horas_estimadas)}</span>
          </Propriedade>
          <Propriedade label="Prioridade">
            <PrioridadeIcon prioridade={prioridade} />
            <span>{PRIORIDADE_LABEL[prioridade]}</span>
          </Propriedade>
          <Propriedade label="Início" title={r.data_inicio_sugerida ? fmtLonga(r.data_inicio_sugerida) : undefined}>
            {r.data_inicio_sugerida ? <span className="tabular">{fmtDiaCurto(r.data_inicio_sugerida)}</span> : <Vazio />}
          </Propriedade>
          <Propriedade label="Sugerida" title={r.data_sugerida ? fmtLonga(r.data_sugerida) : undefined}>
            {r.data_sugerida ? <span className="tabular">{fmtDiaCurto(r.data_sugerida)}</span> : <Vazio>não coube no horizonte</Vazio>}
          </Propriedade>
          <Propriedade label="Entrega" title={r.data_escolhida ? fmtLonga(r.data_escolhida) : undefined}>
            {r.data_escolhida ? (
              <>
                <span className={`tabular ${r.sobrecarga ? 'text-ln-red font-medium' : ''}`}>{fmtDiaCurto(r.data_escolhida)}</span>
                {r.sobrecarga && <span className="text-[10px] font-semibold uppercase tracking-wide text-ln-red">forçada</span>}
              </>
            ) : <Vazio>sem data</Vazio>}
          </Propriedade>
          <Propriedade label="Criada por" title={tituloCriacao(r.created_at)}>
            {criadaPor ? <span className="truncate">{criadaPor}</span> : <Vazio>autor não identificado</Vazio>}
            {r.created_at && <span className="text-ln-t4 tabular whitespace-nowrap">{fmtRelativo(r.created_at, agora)}</span>}
          </Propriedade>
          <Propriedade label="ClickUp">
            {r.clickup_task_url ? (
              <a
                href={r.clickup_task_url}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir a tarefa no ClickUp"
                className={`inline-flex items-center gap-1 text-ln-accent hover:underline rounded ${FOCO}`}
              >
                Abrir tarefa <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            ) : r.status === 'erro' ? (
              <span className="text-ln-red">tarefa não criada</span>
            ) : (
              <Vazio>sem link</Vazio>
            )}
          </Propriedade>
        </dl>
      </section>

      <section>
        <p className="ln-label">Carga no momento da aprovação</p>
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
                Agenda de {responsavel || 'responsável'} lida em {fmtDiaCurto(snap.hoje)}: {fmtPct(totais.ocupacaoProximosDias)} ocupada nos 10 dias úteis
                {' · '}{Number(totais.atrasadas) || 0} atrasadas
                {' · '}{foraDoCalculo} fora do cálculo
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-ln-t4">Sem registro da carga no momento da aprovação.</p>
        )}
      </section>
    </div>
  )
}
