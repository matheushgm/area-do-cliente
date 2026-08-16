// Agregações puras da Capacidade do Time.
// Recebe as linhas cruas de `clickup_tasks` e devolve tudo que a UI desenha.
// Sem IO e sem React de propósito — a lógica de contagem é a parte que erra
// silenciosamente, então fica isolada e fácil de conferir.

export const BUCKETS = [
  { key: 'backlog',      label: 'Backlog',      cls: 'bg-rl-muted'   },
  { key: 'a_fazer',      label: 'A fazer',      cls: 'bg-rl-blue'    },
  { key: 'em_progresso', label: 'Em progresso', cls: 'bg-rl-cyan'    },
  { key: 'em_revisao',   label: 'Em revisão',   cls: 'bg-rl-purple'  },
  { key: 'outro',        label: 'Outro',        cls: 'bg-rl-gold'    },
]

const DAY_MS = 24 * 60 * 60 * 1000
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

export function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

const pad = n => String(n).padStart(2, '0')
export const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Horas a partir do time_estimate do ClickUp (milissegundos). */
export const msToHours = ms => (Number(ms) || 0) / 3_600_000

/**
 * Monta o modelo completo da página.
 *
 * Contagem por pessoa: uma tarefa com 2 responsáveis conta para os dois — é o
 * que representa carga percebida. Por isso a soma das linhas pode ser MAIOR
 * que `totalOpen`, que conta tarefas distintas. A UI diz isso explicitamente
 * em vez de esconder a diferença.
 *
 * @param {Array} tasks  linhas de clickup_tasks (já filtradas: abertas, não deletadas)
 * @param {{ today?: Date, days?: number }} opts
 */
export function buildWorkload(tasks, { today = new Date(), days = 7 } = {}) {
  const t0 = startOfDay(today)
  const todayKey = dayKey(t0)

  const window = Array.from({ length: days }, (_, i) => {
    const d = new Date(t0.getTime() + i * DAY_MS)
    return {
      key: dayKey(d),
      label: `${WEEKDAYS[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`,
      isToday: i === 0,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    }
  })
  const windowIndex = new Map(window.map((d, i) => [d.key, i]))

  const byPerson = new Map()
  const ensure = (id, name) => {
    const k = String(id)
    if (!byPerson.has(k)) {
      byPerson.set(k, {
        id: k,
        name,
        total: 0,
        buckets: Object.fromEntries(BUCKETS.map(b => [b.key, []])),
        overdue: [], dueToday: [], due7d: [], noDate: [],
        byDay: window.map(() => 0),
        hoursByDay: window.map(() => 0),
        // Tarefas do dia sem estimativa preenchida — é o que torna a coluna de
        // horas um piso, não um total. Contado em vez de estimado.
        missingByDay: window.map(() => 0),
        withEstimate: 0,
      })
    }
    return byPerson.get(k)
  }

  let totalOverdue = 0
  let withEstimate = 0

  for (const task of tasks) {
    const due = task.due_date ? new Date(task.due_date) : null
    const dueKey = due ? dayKey(startOfDay(due)) : null
    const isOverdue = !!due && startOfDay(due).getTime() < t0.getTime()
    const hasEstimate = Number(task.time_estimate_ms) > 0
    if (isOverdue) totalOverdue++
    if (hasEstimate) withEstimate++

    const assignees = Array.isArray(task.assignees) && task.assignees.length
      ? task.assignees
      : [{ id: '__none__', username: 'Sem responsável' }]

    for (const a of assignees) {
      const p = ensure(a.id, a.username || `Usuário ${a.id}`)
      p.total++
      const bucket = p.buckets[task.status_bucket] ? task.status_bucket : 'outro'
      p.buckets[bucket].push(task)
      if (hasEstimate) p.withEstimate++

      if (!due) {
        p.noDate.push(task)
      } else if (isOverdue) {
        p.overdue.push(task)
      } else {
        if (dueKey === todayKey) p.dueToday.push(task)
        const i = windowIndex.get(dueKey)
        if (i !== undefined) {
          p.due7d.push(task)
          p.byDay[i]++
          if (hasEstimate) p.hoursByDay[i] += msToHours(task.time_estimate_ms)
          else p.missingByDay[i]++
        }
      }
    }
  }

  const people = [...byPerson.values()].sort((a, b) => b.total - a.total)
  const maxTotal = people.reduce((m, p) => Math.max(m, p.total), 0)

  return {
    people,
    days: window,
    totalOpen: tasks.length,
    totalOverdue,
    peopleCount: people.filter(p => p.id !== '__none__' && p.total > 0).length,
    maxTotal,
    topPerson: people.find(p => p.total === maxTotal && maxTotal > 0) || null,
    // Cobertura de estimativa: sem isso, "carga em horas" é ficção. O callout
    // do dashboard antigo dizia que só ~1 em 8 tarefas tinha horas; agora o
    // número é medido a cada render em vez de escrito à mão.
    estimateCoverage: {
      withEstimate,
      total: tasks.length,
      pct: tasks.length ? Math.round((withEstimate / tasks.length) * 100) : 0,
    },
  }
}
