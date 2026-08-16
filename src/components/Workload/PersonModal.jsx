import { useState } from 'react'
import { ExternalLink, ArrowLeft, X } from 'lucide-react'
import Modal from '../UI/Modal'
import { BUCKETS } from '../../lib/workload'

const fmtDate = iso => iso
  ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  : '—'

function TaskList({ tasks, onBack, label }) {
  return (
    <>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[12px] text-rl-cyan hover:underline mb-3"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> voltar ao resumo
      </button>
      <div className="text-[11px] text-rl-muted mb-2">{tasks.length} tarefa(s) · {label}</div>
      <div className="max-h-[46vh] overflow-y-auto flex flex-col gap-1.5 pr-1">
        {tasks.length === 0 && (
          <div className="text-[12px] text-rl-muted text-center py-6">Nenhuma tarefa nessa categoria.</div>
        )}
        {tasks.map(t => (
          <a
            key={t.task_id}
            href={t.url || `https://app.clickup.com/t/${t.task_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2 rounded-lg border border-rl-border hover:border-rl-cyan hover:bg-rl-surface transition-colors group"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] text-rl-text truncate">{t.name || t.task_id}</div>
              <div className="text-[10.5px] text-rl-muted truncate">
                {[t.folder_name, t.list_name].filter(Boolean).join(' › ') || 'sem lista'}
                {t.status ? ` · ${t.status}` : ''}
              </div>
            </div>
            <span className="text-[10.5px] text-rl-muted tabular-nums shrink-0">{fmtDate(t.due_date)}</span>
            <ExternalLink className="w-3.5 h-3.5 text-rl-muted group-hover:text-rl-cyan shrink-0" />
          </a>
        ))}
      </div>
    </>
  )
}

/**
 * Detalhe de uma pessoa. Diferente do dashboard estático antigo — que só
 * conseguia listar IDs de task — aqui o cache guarda nome, lista e prazo,
 * então a listagem é legível sem abrir o ClickUp.
 */
export default function PersonModal({ person, onClose }) {
  const [view, setView] = useState(null)   // { tasks, label } | null

  const cards = [
    { key: 'overdue',  label: 'Em atraso',        tasks: person.overdue,  tone: 'text-rl-red' },
    { key: 'today',    label: 'Vence hoje',       tasks: person.dueToday, tone: 'text-rl-gold' },
    { key: 'due7d',    label: 'Vence em 7 dias',  tasks: person.due7d,    tone: 'text-rl-text' },
    { key: 'no_date',  label: 'Sem data',         tasks: person.noDate,   tone: 'text-rl-muted' },
  ]
  const maxBucket = Math.max(1, ...BUCKETS.map(b => person.buckets[b.key].length))

  return (
    <Modal onClose={onClose} maxWidth="2xl">
      <div className="flex items-start justify-between mb-5">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-rl-text truncate">
            {person.id === '__none__' ? 'Sem responsável' : person.name}
          </h2>
          <div className="text-[12px] text-rl-muted">
            {person.total} tarefas abertas · {person.withEstimate} com horas estimadas
          </div>
        </div>
        <button onClick={onClose} aria-label="Fechar" className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface">
          <X className="w-4 h-4" />
        </button>
      </div>

      {view ? (
        <TaskList tasks={view.tasks} label={view.label} onBack={() => setView(null)} />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
            {cards.map(c => (
              <button
                key={c.key}
                onClick={() => setView({ tasks: c.tasks, label: c.label })}
                className="glass-card px-3 py-2.5 text-left hover:border-rl-cyan transition-colors"
              >
                <div className="text-[10.5px] text-rl-muted leading-tight">{c.label}</div>
                <div className={`text-xl font-bold mt-1 leading-none ${c.tone}`}>{c.tasks.length}</div>
              </button>
            ))}
          </div>

          <p className="text-[11px] text-rl-muted mb-2">
            Carga por status · clique numa barra para ver as tarefas
          </p>
          <div className="flex items-end gap-3 h-40">
            {BUCKETS.map(b => {
              const n = person.buckets[b.key].length
              return (
                <button
                  key={b.key}
                  onClick={() => setView({ tasks: person.buckets[b.key], label: b.label })}
                  className="flex-1 flex flex-col items-center gap-1.5 group"
                >
                  <span className="text-[11px] font-semibold text-rl-text">{n}</span>
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className={`w-full rounded-t ${b.cls} ${n ? 'opacity-80 group-hover:opacity-100' : 'opacity-20'} transition-opacity`}
                      style={{ height: `${n ? Math.max((n / maxBucket) * 100, 4) : 2}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-rl-muted text-center leading-tight">{b.label}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </Modal>
  )
}
