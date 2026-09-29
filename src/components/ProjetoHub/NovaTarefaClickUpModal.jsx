// Cria uma tarefa no ClickUp a partir da página do cliente, passando pelo
// mesmo fluxo do Planejador de Atividades (usePlanejador): responsável,
// horas, data sugerida pela carga real e aprovação. Usado pelas sugestões do
// playbook (vem pré-preenchido) e pelo botão "Tarefa" das ações rápidas.
import { useEffect } from 'react'
import { Kanban, Loader2, Sparkles, AlertTriangle, ExternalLink, CheckCircle2, CalendarDays } from 'lucide-react'
import Modal from '../UI/Modal'
import { useApp } from '../../context/AppContext'
import { usePlanejador, TIPO_PARA_DEPARTAMENTO } from '../../hooks/usePlanejador'
import { fmtLonga, fmtHoras } from '../../lib/atividadesCarga'
import { PRIORIDADE_CLICKUP } from '../../lib/playbookSugestoes'

const INPUT = 'w-full px-3 py-2 rounded-lg bg-rl-surface border border-rl-border text-sm text-rl-text placeholder:text-rl-muted focus:outline-none focus:border-rl-purple/50 transition-colors'
const LABEL = 'block text-[11px] font-semibold uppercase tracking-wider text-rl-muted mb-1'

export default function NovaTarefaClickUpModal({ project, sugestao = null, config, showToast, onCriada, onClose }) {
  const { projects, teamMembers, squads } = useApp()
  const pl = usePlanejador({
    projects, teamMembers, squads, config, showToast,
    onCriada: (r) => onCriada?.(r),
  })

  // Pré-preenche uma vez: projeto atual + conteúdo da sugestão (se houver)
  useEffect(() => {
    const tipo = sugestao?.tipo || 'Otimização'
    pl.novaAtividade({
      projectId: project.id,
      titulo: sugestao?.titulo || '',
      descricao: sugestao?.descricao || '',
      tipo,
      departamento: TIPO_PARA_DEPARTAMENTO[tipo] || 'Gestor de tráfego',
      horas: String(sugestao?.horas ?? config?.horas_por_tipo?.[tipo] ?? 1),
      prioridade: sugestao ? (PRIORIDADE_CLICKUP[sugestao.prioridade] || 'normal') : 'normal',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, sugestao?.chave])

  const semPasta = !project.clickupFolderId
  const f = pl.form

  return (
    <Modal onClose={onClose} maxWidth="2xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0"><Kanban className="w-5 h-5" /></div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-rl-text">{sugestao ? 'Aceitar sugestão e criar tarefa' : 'Nova tarefa no ClickUp'}</h3>
          <p className="text-xs text-rl-muted">A data de entrega é calculada pela carga real do responsável, como no Planejador.</p>
        </div>
      </div>

      {semPasta ? (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-rl-gold/10 border border-rl-gold/30 text-sm text-rl-text">
          <AlertTriangle className="w-5 h-5 text-rl-gold shrink-0" />
          <div>
            <p className="font-semibold">Este projeto não tem pasta do ClickUp vinculada.</p>
            <p className="text-rl-muted text-xs mt-1">Adicione o link do ClickUp no cabeçalho do cliente (botão + Link) pra criar tarefas por aqui.</p>
          </div>
        </div>
      ) : pl.criada ? (
        <div className="p-4 rounded-xl bg-rl-green/10 border border-rl-green/30">
          <div className="flex items-center gap-2 text-rl-green font-semibold text-sm"><CheckCircle2 className="w-4 h-4" /> Tarefa criada no ClickUp</div>
          <p className="text-sm text-rl-text mt-2">{pl.criada.titulo}</p>
          <p className="text-xs text-rl-muted mt-1">{pl.criada.responsavel} · entrega {fmtLonga(pl.criada.data)}</p>
          {pl.criada.aviso && <p className="text-xs text-rl-gold mt-2">{pl.criada.aviso}</p>}
          <div className="flex items-center gap-2 mt-4">
            {pl.criada.url && <a href={pl.criada.url} target="_blank" rel="noreferrer" className="btn-secondary text-sm flex items-center gap-1.5"><ExternalLink className="w-3.5 h-3.5" /> Abrir no ClickUp</a>}
            <button onClick={onClose} className="btn-primary text-sm">Fechar</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {sugestao && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-rl-purple/5 border border-rl-purple/20 text-xs text-rl-subtle">
              <Sparkles className="w-4 h-4 text-rl-purple shrink-0" />
              <span>Sugestão do playbook: <span className="text-rl-text">{sugestao.regra}</span></span>
            </div>
          )}
          <div>
            <label className={LABEL}>Título</label>
            <input value={f.titulo} onChange={(e) => pl.set('titulo', e.target.value)} autoFocus={!sugestao} placeholder="O que precisa ser feito" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Briefing</label>
            <textarea value={f.descricao} onChange={(e) => pl.set('descricao', e.target.value)} rows={sugestao ? 6 : 3} className={INPUT + ' resize-y font-mono text-xs'} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Tipo de tarefa</label>
              <select value={f.tipo} onChange={(e) => pl.setTipo(e.target.value)} className={INPUT}>
                <option value="">Selecione</option>
                {pl.TIPOS_TAREFA.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Lista no ClickUp</label>
              {pl.listas.length ? (
                <select value={f.listId} onChange={(e) => pl.set('listId', e.target.value)} className={INPUT}>
                  {pl.listas.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              ) : (
                <input value={f.listId} onChange={(e) => pl.set('listId', e.target.value)} placeholder={pl.loadingListas ? 'Carregando listas…' : 'ID da lista'} className={INPUT} />
              )}
              {pl.listasErro && <p className="text-[11px] text-rl-red mt-1">{pl.listasErro}</p>}
            </div>
            <div>
              <label className={LABEL}>Responsável</label>
              <select value={f.responsavelId} onChange={(e) => pl.setResponsavelId(e.target.value)} className={INPUT}>
                <option value="">Selecione</option>
                {pl.responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={LABEL}>Horas</label>
                <input value={f.horas} onChange={(e) => pl.set('horas', e.target.value)} inputMode="decimal" className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Prioridade</label>
                <select value={f.prioridade} onChange={(e) => pl.set('prioridade', e.target.value)} className={INPUT}>
                  {pl.PRIORIDADES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={LABEL}>Não começar antes de</label>
              <input type="date" value={f.naoAntesDe} onChange={(e) => pl.set('naoAntesDe', e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Prazo pedido (opcional)</label>
              <input type="date" value={f.dataDesejada} onChange={(e) => pl.set('dataDesejada', e.target.value)} className={INPUT} />
            </div>
          </div>

          {/* Resultado do cálculo */}
          {pl.erroCalculo && <p className="text-xs text-rl-red">{pl.erroCalculo}</p>}
          {pl.resultado && (
            <div className="p-3 rounded-xl bg-rl-surface border border-rl-border space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CalendarDays className="w-4 h-4 text-rl-purple" />
                <span className="text-rl-muted">Entrega sugerida:</span>
                <span className="font-semibold text-rl-text">{pl.sugerida ? fmtLonga(pl.sugerida) : 'não cabe no horizonte'}</span>
                <span className="text-xs text-rl-muted ml-auto">ocupação próximos dias {Math.round(pl.resultado.totais?.ocupacaoProximosDias ?? 0)}% · {fmtHoras(pl.horasNum)}</span>
                <button onClick={pl.calcular} disabled={!pl.formOk || pl.calculando} className="text-xs text-rl-purple hover:underline disabled:opacity-50">recalcular</button>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-rl-muted">Data de entrega:</span>
                <input type="date" value={pl.dataEscolhida} onChange={(e) => pl.setDataEscolhida(e.target.value)} className={INPUT + ' w-auto py-1'} />
              </div>
              {pl.forcandoData && pl.forcada && !pl.forcada.cabe && (
                <div className="text-xs text-rl-gold flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <div className="flex-1">
                    Data antes da sugerida: sobrecarrega {fmtHoras(pl.forcada.horasExcedentes)} do responsável. Justifique (mín. 5 caracteres):
                    <input value={pl.justificativa} onChange={(e) => pl.setJustificativa(e.target.value)} className={INPUT + ' mt-1'} placeholder="Por que precisa ser antes?" />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-rl-muted hover:bg-rl-surface">Cancelar</button>
            {!pl.resultado ? (
              <button onClick={pl.calcular} disabled={!pl.formOk || pl.calculando} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {pl.calculando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />}
                Calcular data de entrega
              </button>
            ) : (
              <button onClick={pl.aprovar} disabled={!pl.podeCriar} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {pl.criando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Kanban className="w-4 h-4" />}
                Criar tarefa no ClickUp
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
