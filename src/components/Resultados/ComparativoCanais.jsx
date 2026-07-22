// Painel "Meta Ads × Google Ads" — gasto, conversões e custo por conversão de
// cada canal no MÊS selecionado, usando as contas de anúncio vinculadas ao
// projeto (mesma fonte do dashboard de tráfego: dash_insights via /api).

import { CFG, num, fmtDate, inRange } from '../../lib/dashboardData'
import { fmtMoney, getDaysInMonth } from './resultadosHelpers'

const fmtInt = n => Number(n || 0).toLocaleString('pt-BR')

const CHANNELS = [
  { id: 'meta',   label: 'Meta Ads',   icon: '📱', color: 'blue',   textCls: 'text-rl-blue',   barCls: 'bg-rl-blue' },
  // rl-purple e rl-blue são quase a mesma cor no tema — o Google usa cyan para
  // que as duas séries fiquem distinguíveis lado a lado.
  { id: 'google', label: 'Google Ads', icon: '🔍', color: 'cyan', textCls: 'text-rl-cyan', barCls: 'bg-rl-cyan' },
]

// Gasto e conversões de um canal, restrito às contas do projeto e ao intervalo.
// As colunas de conversão diferem por canal — espelha CFG/channelSummary do
// dashboard de tráfego.
function channelTotals(rows, channel, names, from, to) {
  const { accountKey, dateKey } = CFG[channel]
  return (rows || []).reduce((a, r) => {
    if (!names.has(r[accountKey]?.trim())) return a
    if (!inRange(fmtDate(r[dateKey]), from, to)) return a
    if (channel === 'meta') {
      a.spend += num(r['Valor investido'])
      a.conv  += num(r['Número de conversas iniciadas no Whatsapp']) + num(r['Leads']) + num(r['Número de vendas'])
    } else {
      a.spend += num(r['Gasto'])
      a.conv  += num(r['Conversões'])
    }
    return a
  }, { spend: 0, conv: 0 })
}

function ChannelBlock({ ch, data, totalSpend, bestCpa }) {
  const cpa   = data.conv > 0 && data.spend > 0 ? data.spend / data.conv : 0
  const share = totalSpend > 0 ? (data.spend / totalSpend) * 100 : 0
  const isBest = cpa > 0 && bestCpa > 0 && cpa === bestCpa

  return (
    <div className="rounded-xl border border-rl-border bg-rl-surface/40 p-4">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className={`text-sm font-bold flex items-center gap-1.5 ${ch.textCls}`}>
          <span>{ch.icon}</span> {ch.label}
        </span>
        {isBest && (
          <span className="text-[10px] font-bold text-rl-green bg-rl-green/10 px-2 py-0.5 rounded-full">
            melhor custo/conv
          </span>
        )}
      </div>

      {data.spend > 0 || data.conv > 0 ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-[10px] text-rl-muted uppercase tracking-wider">Gasto</div>
              <div className="text-base font-bold text-rl-text leading-tight mt-0.5">{fmtMoney(data.spend)}</div>
              <div className="text-[10px] text-rl-muted mt-0.5">{share.toFixed(0)}% do total</div>
            </div>
            <div>
              <div className="text-[10px] text-rl-muted uppercase tracking-wider">Conversões</div>
              <div className={`text-base font-bold leading-tight mt-0.5 ${ch.textCls}`}>{fmtInt(data.conv)}</div>
            </div>
            <div>
              <div className="text-[10px] text-rl-muted uppercase tracking-wider">Custo / conv.</div>
              <div className="text-base font-bold text-rl-gold leading-tight mt-0.5">
                {cpa > 0 ? fmtMoney(cpa) : '—'}
              </div>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-rl-border/50 overflow-hidden mt-3">
            <div className={`h-full rounded-full transition-all duration-500 ${ch.barCls}`}
                 style={{ width: `${share}%` }} />
          </div>
        </>
      ) : (
        <p className="text-xs text-rl-muted py-2">Sem investimento neste canal no mês.</p>
      )}
    </div>
  )
}

// Confronto lado a lado dos dois canais numa métrica. As barras são
// normalizadas pelo maior valor da linha — a leitura é relativa, não absoluta.
function MetricCompare({ label, hint, values, format, lowerIsBetter = false }) {
  const max = Math.max(...CHANNELS.map(c => values[c.id] || 0), 1)
  const valid = CHANNELS.map(c => values[c.id]).filter(v => v > 0)
  const best = valid.length > 1 ? (lowerIsBetter ? Math.min(...valid) : Math.max(...valid)) : null

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <span className="text-[11px] font-semibold text-rl-text">{label}</span>
        <span className="text-[10px] text-rl-muted">{hint}</span>
      </div>
      <div className="space-y-1.5">
        {CHANNELS.map(ch => {
          const v = values[ch.id] || 0
          const isBest = best != null && v === best
          return (
            <div key={ch.id} className="flex items-center gap-2">
              <span className={`text-[10px] w-14 shrink-0 ${ch.textCls}`}>{ch.label.split(' ')[0]}</span>
              <div className="flex-1 h-2 rounded-full bg-rl-border/50 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${ch.barCls}`}
                     style={{ width: `${(v / max) * 100}%` }} />
              </div>
              <span className={`text-[11px] font-semibold w-24 text-right shrink-0 ${isBest ? 'text-rl-green' : 'text-rl-text'}`}>
                {v > 0 ? format(v) : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function ComparativoCanais({ dash, projectId, year, month, monthLabel }) {
  const { raw = {}, accounts = {}, loading, error } = dash || {}

  const names = new Set(
    Object.entries(accounts)
      .filter(([, a]) => a.projectId === projectId)
      .map(([name]) => name),
  )

  const mm   = String(month + 1).padStart(2, '0')
  const from = `${year}-${mm}-01`
  const to   = `${year}-${mm}-${String(getDaysInMonth(year, month)).padStart(2, '0')}`

  const header = (
    <div className="flex items-center justify-between gap-2 mb-3">
      <h4 className="text-sm font-bold text-rl-text">Meta Ads × Google Ads</h4>
      <span className="text-[11px] text-rl-muted">{monthLabel} · contas vinculadas</span>
    </div>
  )

  if (loading) {
    return <div className="glass-card p-5 h-full">{header}
      <p className="text-xs text-rl-muted">Carregando dados das contas de anúncio…</p>
    </div>
  }
  if (error) {
    return <div className="glass-card p-5 h-full">{header}
      <p className="text-xs text-rl-red">Erro ao carregar tráfego: {String(error)}</p>
    </div>
  }
  if (!names.size) {
    return <div className="glass-card p-5 h-full">{header}
      <p className="text-xs text-rl-muted">
        Nenhuma conta de anúncio vinculada a este cliente. Vincule uma conta na seção
        <b className="text-rl-text"> Resultados de Tráfego</b>, acima, para ver a comparação por canal.
      </p>
    </div>
  }

  const data = {
    meta:   channelTotals(raw.meta,   'meta',   names, from, to),
    google: channelTotals(raw.google, 'google', names, from, to),
  }
  const totalSpend = data.meta.spend + data.google.spend
  const totalConv  = data.meta.conv  + data.google.conv
  const totalCpa   = totalConv > 0 && totalSpend > 0 ? totalSpend / totalConv : 0

  // Menor custo por conversão entre os canais que de fato rodaram.
  const cpas = CHANNELS
    .map(c => (data[c.id].conv > 0 && data[c.id].spend > 0 ? data[c.id].spend / data[c.id].conv : 0))
    .filter(v => v > 0)
  const bestCpa = cpas.length > 1 ? Math.min(...cpas) : 0

  return (
    <div className="glass-card p-5 h-full">
      {header}

      {totalSpend === 0 ? (
        <p className="text-xs text-rl-muted py-4 text-center border border-dashed border-rl-border rounded-xl">
          Nenhum gasto registrado nas contas deste cliente em {monthLabel}.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CHANNELS.map(ch => (
              <ChannelBlock key={ch.id} ch={ch} data={data[ch.id]} totalSpend={totalSpend} bestCpa={bestCpa} />
            ))}
          </div>

          <div className="space-y-4 mt-4 pt-4 border-t border-rl-border/60">
            <MetricCompare
              label="Gasto" hint="quem consome mais verba"
              values={{ meta: data.meta.spend, google: data.google.spend }}
              format={fmtMoney}
            />
            <MetricCompare
              label="Conversões" hint="quem entrega mais volume"
              values={{ meta: data.meta.conv, google: data.google.conv }}
              format={fmtInt}
            />
            <MetricCompare
              label="Custo por conversão" hint="menor é melhor"
              values={{
                meta:   data.meta.conv   > 0 ? data.meta.spend   / data.meta.conv   : 0,
                google: data.google.conv > 0 ? data.google.spend / data.google.conv : 0,
              }}
              format={fmtMoney}
              lowerIsBetter
            />
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-rl-border/60">
            <div>
              <div className="text-[10px] text-rl-muted uppercase tracking-wider">Gasto total</div>
              <div className="text-lg font-bold text-rl-gold leading-tight mt-0.5">{fmtMoney(totalSpend)}</div>
            </div>
            <div>
              <div className="text-[10px] text-rl-muted uppercase tracking-wider">Conversões</div>
              <div className="text-lg font-bold text-rl-text leading-tight mt-0.5">{fmtInt(totalConv)}</div>
            </div>
            <div>
              <div className="text-[10px] text-rl-muted uppercase tracking-wider">Custo / conv. médio</div>
              <div className="text-lg font-bold text-rl-cyan leading-tight mt-0.5">
                {totalCpa > 0 ? fmtMoney(totalCpa) : '—'}
              </div>
            </div>
          </div>

          <p className="text-[10px] text-rl-muted mt-3 leading-relaxed">
            Conversões do Meta somam conversas no WhatsApp, leads e vendas; do Google, a coluna
            Conversões. Números vindos direto das contas — podem divergir do funil preenchido à mão.
          </p>
        </>
      )}
    </div>
  )
}
