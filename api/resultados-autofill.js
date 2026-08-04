// Preenchimento automático dos Resultados do Funil com os dados reais de mídia.
//
// Lê APENAS (dash_insights, alimentado de hora em hora pelo sync Meta/Google) e
// escreve o investimento e as conversões de cada semana fechada no JSONB
// `resultados.data` do projeto — os mesmos campos que o time preencheria à mão.
// Campos de funil que a API não conhece (MQL, SQL, vendas, receita) são
// preservados; nada é apagado.
//
// Quando roda:
//   • Vercel Cron nos dias 1, 8, 15 e 22, ~00h05 (BRT) — ver `crons` no vercel.json
//       dia  8 → fecha a Semana 1 (1–7)
//       dia 15 → fecha a Semana 2 (8–14)
//       dia 22 → fecha a Semana 3 (15–21)
//       dia  1 → fecha a Semana 4 (22–fim) do mês anterior
//     Cada execução repreenche todas as semanas já fechadas do mês de
//     referência, então uma execução que falhe é corrigida na seguinte.
//   • Manualmente, pelo botão "Puxar da API" no módulo Resultados (autenticado
//     com o JWT do usuário; aceita `projectId` + `year`/`month` e devolve o
//     JSONB mesclado para o front atualizar o estado local na hora).
//
// Autenticação: header do Vercel Cron (CRON_SECRET) ou JWT de usuário logado.
export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.SUPABASE_URL
// A chave legada `service_role` (JWT) foi desativada em 2026-04-28 — a nova é a
// secret (`sb_secret_…`). Aceita as duas envs para funcionar em qualquer
// ambiente que ainda não tenha sido renomeado.
const SERVICE_KEY  = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY     = process.env.SUPABASE_ANON_KEY
const CRON_SECRET  = process.env.CRON_SECRET

// Semanas do mês — mesmos limites de getWeekRanges() em resultadosHelpers.js.
const WEEK_BOUNDS = [[1, 7], [8, 14], [15, 21], [22, null]]

const pad = n => String(n).padStart(2, '0')
const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate() // month 1-12

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: opts.prefer || 'return=representation',
      ...(opts.range ? { Range: opts.range, 'Range-Unit': 'items' } : {}),
    },
  })
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch { data = text }
  if (res.status >= 400) throw new Error(`Supabase ${path}: HTTP ${res.status} ${text.slice(0, 300)}`)
  return data
}

// Hoje em Brasília. O Brasil não tem horário de verão desde 2019, então o
// deslocamento fixo de -3h é suficiente (e não depende de ICU no runtime Edge).
function todayBR() {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000)
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }
}

// Intervalo de dias de uma semana dentro do mês. `null` quando o mês nem chega
// ao início da semana (fevereiro não tem Semana 4 curta, mas a regra é geral).
function weekRange(year, month, week) {
  const dim = daysInMonth(year, month)
  const [start, rawEnd] = WEEK_BOUNDS[week - 1]
  if (start > dim) return null
  const end = rawEnd === null ? dim : Math.min(rawEnd, dim)
  return { start, end }
}

// Semanas JÁ FECHADAS de um mês, na data de referência.
function closedWeeks(year, month, today) {
  const isPast = year < today.y || (year === today.y && month < today.m)
  if (isPast) return [1, 2, 3, 4]
  if (year > today.y || (year === today.y && month > today.m)) return []
  const out = []
  if (today.d >= 8)  out.push(1)
  if (today.d >= 15) out.push(2)
  if (today.d >= 22) out.push(3)
  return out
}

// Semana em andamento (só usada no preenchimento manual): vai do início da
// semana até ONTEM. Retorna null se ainda não há dia fechado nela.
function partialWeek(year, month, today) {
  if (year !== today.y || month !== today.m) return null
  const yesterday = today.d - 1
  if (yesterday < 1) return null
  const week = today.d >= 22 ? 4 : today.d >= 15 ? 3 : today.d >= 8 ? 2 : 1
  const r = weekRange(year, month, week)
  if (!r || yesterday < r.start) return null
  return { week, start: r.start, end: Math.min(yesterday, r.end), parcial: true }
}

// Alvos padrão do cron: no dia 1 fecha o mês anterior inteiro; nos demais,
// todas as semanas fechadas do mês corrente.
function cronTargets(today) {
  if (today.d === 1) {
    const year  = today.m === 1 ? today.y - 1 : today.y
    const month = today.m === 1 ? 12 : today.m - 1
    return [1, 2, 3, 4].map(week => ({ year, month, week }))
  }
  return closedWeeks(today.y, today.m, today).map(week => ({ year: today.y, month: today.m, week }))
}

// ── Autenticação ─────────────────────────────────────────────────────────────
async function authorize(req) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()

  // Vercel Cron: manda `Authorization: Bearer $CRON_SECRET` quando a env existe.
  // Não existe fallback pelo header `x-vercel-cron`: ele NÃO é removido das
  // requisições externas (testado em produção), então qualquer um poderia
  // disparar a escrita. Sem CRON_SECRET, só JWT de usuário passa.
  if (CRON_SECRET && token && token === CRON_SECRET) return { ok: true, via: 'cron' }

  if (!token) return { ok: false }
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY || SERVICE_KEY },
  })
  if (!res.ok) return { ok: false }
  return { ok: true, via: 'user' }
}

// ── Núcleo ───────────────────────────────────────────────────────────────────
export default async function handler(req) {
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'Servidor não configurado.' }, 500)

  const auth = await authorize(req)
  if (!auth.ok) return json({ error: 'Não autorizado.' }, 401)

  // Parâmetros aceitos tanto por query (cron/GET) quanto por body (botão/POST).
  const url = new URL(req.url)
  let body = {}
  if (req.method === 'POST') {
    try { body = await req.json() } catch { body = {} }
  }
  const qp = k => body[k] ?? url.searchParams.get(k)
  const projectId   = qp('projectId') || null
  const yearParam   = qp('year')  ? Number(qp('year'))  : null
  const monthParam  = qp('month') ? Number(qp('month')) : null   // 1-12
  const dryRun      = String(qp('dry') || '') === '1'

  const today = todayBR()

  // Alvos: mês pedido (manual) ou os do cron.
  let targets
  if (yearParam && monthParam) {
    if (monthParam < 1 || monthParam > 12) return json({ error: 'month inválido (1-12).' }, 400)
    targets = closedWeeks(yearParam, monthParam, today).map(week => ({ year: yearParam, month: monthParam, week }))
    // No preenchimento manual do mês corrente, inclui também a semana em curso
    // (até ontem) — é o que dá a sensação de acompanhamento diário.
    const partial = partialWeek(yearParam, monthParam, today)
    if (partial) targets.push({ year: yearParam, month: monthParam, week: partial.week, parcial: true })
  } else {
    targets = cronTargets(today)
  }

  if (!targets.length) {
    return json({ ok: true, ranAt: new Date().toISOString(), targets: [], updated: [], skipped: [], note: 'Nenhuma semana fechada para preencher.' })
  }

  // Resolve o intervalo de dias de cada alvo e a janela total da consulta.
  const windows = targets
    .map(t => {
      const base = weekRange(t.year, t.month, t.week)
      if (!base) return null
      const end = t.parcial ? Math.min(today.d - 1, base.end) : base.end
      if (end < base.start) return null
      return { ...t, start: base.start, end }
    })
    .filter(Boolean)
  if (!windows.length) return json({ ok: true, ranAt: new Date().toISOString(), targets: [], updated: [], skipped: [] })

  const allDates = windows.flatMap(w => [`${w.year}-${pad(w.month)}-${pad(w.start)}`, `${w.year}-${pad(w.month)}-${pad(w.end)}`]).sort()
  const pFrom = allDates[0]
  const pTo   = allDates[allDates.length - 1]

  try {
    // 1) Gasto e conversões por projeto/dia (agregados no Postgres — migration 075).
    // { [project_id]: { 'YYYY-MM-DD': [gasto, conversões] } }
    const byProject = await sb('/rpc/dash_totals_by_project', {
      method: 'POST',
      body: JSON.stringify({ p_from: pFrom, p_to: pTo }),
    })

    const projectIds = Object.keys(byProject).filter(id => !projectId || id === projectId)
    if (!projectIds.length) {
      return json({
        ok: true, ranAt: new Date().toISOString(), updated: [],
        skipped: [{ projectId, reason: 'nenhuma conta vinculada com veiculação no período' }],
      })
    }
    const cellOf = (pid, dateKey) => {
      const v = byProject[pid]?.[dateKey]
      return v ? { spend: Number(v[0]) || 0, conv: Number(v[1]) || 0 } : null
    }

    // 2) Resultados atuais dos projetos envolvidos.
    const inList = `(${projectIds.map(id => `"${id}"`).join(',')})`
    const resultadoRows = await sb(`/resultados?select=project_id,data&project_id=in.${inList}`)
    const currentByProject = {}
    for (const r of resultadoRows) currentByProject[r.project_id] = r.data || {}

    // 3) Mescla semana a semana.
    const nowIso  = new Date().toISOString()
    const updated = []
    const skipped = []
    const payload = []
    const mergedByProject = {}

    for (const pid of projectIds) {
      const current = currentByProject[pid] || {}
      const modelo  = current.modelo
      if (modelo !== 'b2b' && modelo !== 'b2c') {
        skipped.push({ projectId: pid, reason: 'modelo do funil não escolhido' })
        continue
      }

      const next = JSON.parse(JSON.stringify(current))
      const semanas = []

      for (const w of windows) {
        const monthKey = `${w.year}-${pad(w.month)}`
        let spend = 0, conv = 0
        for (let day = w.start; day <= w.end; day++) {
          const cell = cellOf(pid, `${w.year}-${pad(w.month)}-${pad(day)}`)
          if (!cell) continue
          spend += cell.spend
          conv  += cell.conv
        }
        // Semana sem nenhuma veiculação não vira card vazio.
        if (spend <= 0 && conv <= 0) continue

        const investido = Math.round(spend * 100) / 100
        const leads     = Math.round(conv)
        const meta      = { fonte: 'api', atualizadoEm: nowIso, ...(w.parcial ? { parcial: true } : {}) }

        if (modelo === 'b2b') {
          const bag  = ((next.b2b ||= {})[monthKey] ||= {})
          const prev = bag[`semana${w.week}`] || {}
          bag[`semana${w.week}`] = {
            ...prev,
            investido,
            leads,
            mql:           prev.mql           || 0,
            sql:           prev.sql           || 0,
            vendas:        prev.vendas        || 0,
            receitaVendas: prev.receitaVendas || 0,
            ...meta,
          }
        } else {
          const bag  = ((next.b2c_semanas ||= {})[monthKey] ||= {})
          const prev = bag[String(w.week)] || {}
          bag[String(w.week)] = {
            ...prev,
            investido,
            leads,
            vendas:      prev.vendas      || 0,
            valorVendas: prev.valorVendas || 0,
            ...meta,
          }
          // B2C abre em modo Diário — preenche também dia a dia.
          const dias = ((next.b2c ||= {})[monthKey] ||= {})
          for (let day = w.start; day <= w.end; day++) {
            const cell = cellOf(pid, `${w.year}-${pad(w.month)}-${pad(day)}`)
            if (!cell || (cell.spend <= 0 && cell.conv <= 0)) continue
            const prevDia = dias[pad(day)] || {}
            dias[pad(day)] = {
              ...prevDia,
              investido:   Math.round(cell.spend * 100) / 100,
              leads:       Math.round(cell.conv),
              vendas:      prevDia.vendas      || 0,
              valorVendas: prevDia.valorVendas || 0,
              fonte: 'api',
              atualizadoEm: nowIso,
            }
          }
        }

        semanas.push({ mes: monthKey, semana: w.week, investido, leads, parcial: !!w.parcial })
      }

      if (!semanas.length) {
        skipped.push({ projectId: pid, reason: 'sem investimento no período' })
        continue
      }

      mergedByProject[pid] = next
      payload.push({ project_id: pid, period: '1900-01-01', data: next })
      updated.push({ projectId: pid, modelo, semanas })
    }

    if (payload.length && !dryRun) {
      await sb('/resultados?on_conflict=project_id,period', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: JSON.stringify(payload),
      })
    }

    return json({
      ok: true,
      ranAt: nowIso,
      via: auth.via,
      dryRun,
      periodo: { de: pFrom, ate: pTo },
      semanas: windows.map(w => ({ mes: `${w.year}-${pad(w.month)}`, semana: w.week, de: w.start, ate: w.end, parcial: !!w.parcial })),
      updated,
      skipped,
      // Só no modo manual (1 projeto): devolve o JSONB mesclado para o front
      // atualizar o estado local sem esperar um reload.
      data: projectId ? (mergedByProject[projectId] ?? null) : undefined,
    })
  } catch (e) {
    return json({ error: 'Falha ao preencher os resultados.', detail: String(e?.message || e) }, 500)
  }
}
