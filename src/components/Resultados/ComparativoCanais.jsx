// Painel "Meta Ads × Google Ads" — gasto, conversões e custo por conversão de
// cada canal no MÊS selecionado, usando as contas de anúncio vinculadas ao
// projeto (mesma fonte do dashboard de tráfego: dash_insights via /api).
//
// Um card por canal + uma barra de participação no investimento + uma frase
// de leitura (qual canal converte mais barato). Sem tabelas de comparação
// redundantes com o que os cards já mostram.

import { Lightbulb } from 'lucide-react'
import { CFG, num, fmtDate, inRange } from '../../lib/dashboardData'
import { fmtMoney, getDaysInMonth } from './resultadosHelpers'

const fmtInt = n => Number(n || 0).toLocaleString('pt-BR')

const CHANNELS = [
  { id: 'meta',   label: 'Meta Ads',   icon: '📱', textCls: 'text-rl-blue',   barCls: 'bg-rl-blue' },
  // rl-purple e rl-blue são quase a mesma cor no tema — o Google usa cyan para
  // que as duas séries fiquem distinguíveis lado a lado.
  { id: 'google', label: 'Google Ads', icon: '🔍', textCls: 'text-rl-cyan',   barCls: 'bg-rl-cyan' },
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

function ChannelCard({ ch, data, bestCpa }) {
  const cpa = data.conv > 0 && data.spend > 0 ? data.spend / data.conv : 0
  const isBest = cpa > 0 && bestCpa > 0 && cpa === bestCpa

  return (
    <div className="rounded-xl border border-rl-border bg-rl-surface/40 p-4">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className={`text-sm font-bold flex items-center gap-1.5 ${ch.textCls}`}>
          <span>{ch.icon}</span> {ch.label}
        </span>
        {isBest && (
          <span className="text-[10px] font-bold text-rl-green bg-rl-green/10 px-2 py-0.5 rounded-full shrink-0">
            melhor custo/conv
          </span>
        )}
      </div>

      {data.spend > 0 || data.conv > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-[10px] text-rl-muted uppercase tracking-wider">Gasto</div>
            <div className="text-base font-bold text-rl-text leading-tight mt-0.5">{fmtMoney(data.spend)}</div>
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
      ) : (
        <p className="text-xs text-rl-muted py-1">Sem investimento neste canal no mês.</p>
      )}
    </div>
  )
}

// Uma barra só, dividida por canal — participação de cada um na verba total.
// Substitui os dois cards falando a mesma coisa (%) em textos separados.
function SplitBar({ data, totalSpend }) {
  const metaPct   = totalSpend > 0 ? (data.meta.spend / totalSpend) * 100 : 0
  const googlePct = 100 - metaPct

  return (
    <div className="mt-4 mb-4">
      <div className="text-[10px] text-rl-muted uppercase tracking-wider mb-1.5">Participação no investimento</div>
      <div className="h-2 rounded-full overflow-hidden flex bg-rl-border/40">
        {metaPct   > 0 && <div style={{ width: `${metaPct}%` }}   className="bg-rl-blue" />}
        {googlePct > 0 && <div style={{ width: `${googlePct}%` }} className="bg-rl-cyan" />}
      </div>
      <div className="flex justify-between mt-1.5 text-[11px] font-semibold">
        <span className="text-rl-blue">Meta {metaPct.toFixed(0)}%</span>
        <span className="text-rl-cyan">Google {googlePct.toFixed(0)}%</span>
      </div>
    </div>
  )
}

// Uma frase só com a leitura que importa pra decisão: pra onde a verba rende
// mais. Substitui a comparação lado a lado em barras.
function Insight({ data }) {
  const mCpa = data.meta.conv   > 0 ? data.meta.spend   / data.meta.conv   : 0
  const gCpa = data.google.conv > 0 ? data.google.spend / data.google.conv : 0

  let text
  if (mCpa > 0 && gCpa > 0) {
    const cheaperIsMeta = mCpa <= gCpa
    const cheaper   = cheaperIsMeta ? 'Meta Ads' : 'Google Ads'
    const expensive = cheaperIsMeta ? 'Google Ads' : 'Meta Ads'
    const diff = Math.round((Math.max(mCpa, gCpa) / Math.min(mCpa, gCpa) - 1) * 100)
    text = diff < 5
      ? 'Os dois canais convertem a um custo parecido neste mês.'
      : `${cheaper} converte ${diff}% mais barato que ${expensive} neste mês — considere realocar verba.`
  } else if (mCpa > 0 || gCpa > 0) {
    text = `Só ${mCpa > 0 ? 'Meta Ads' : 'Google Ads'} teve conversões neste mês.`
  } else {
    return null
  }

  // mt-auto ancora o insight no rodapé quando o card estica para igualar a
  // altura do painel vizinho (Plano vs Realizado).
  return (
    <div className="flex items-start gap-2 mt-auto pt-4 border-t border-rl-border/60">
      <Lightbulb size={14} className="text-rl-gold shrink-0 mt-0.5" />
      <p className="text-xs text-rl-text leading-relaxed">{text}</p>
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
      <span className="text-[11px] text-rl-muted">{monthLabel}</span>
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

  // Menor custo por conversão entre os canais que de fato rodaram.
  const cpas = CHANNELS
    .map(c => (data[c.id].conv > 0 && data[c.id].spend > 0 ? data[c.id].spend / data[c.id].conv : 0))
    .filter(v => v > 0)
  const bestCpa = cpas.length > 1 ? Math.min(...cpas) : 0

  return (
    <div className="glass-card p-5 h-full flex flex-col">
      {header}

      {totalSpend === 0 ? (
        <p className="text-xs text-rl-muted py-4 text-center border border-dashed border-rl-border rounded-xl">
          Nenhum gasto registrado nas contas deste cliente em {monthLabel}.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CHANNELS.map(ch => (
              <ChannelCard key={ch.id} ch={ch} data={data[ch.id]} bestCpa={bestCpa} />
            ))}
          </div>

          <SplitBar data={data} totalSpend={totalSpend} />
          <Insight data={data} />
        </>
      )}
    </div>
  )
}
