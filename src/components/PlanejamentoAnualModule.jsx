import { useState, useCallback, useMemo, useRef } from 'react'
import { useApp } from '../context/AppContext'
import {
  TrendingUp, Package, Users2, DollarSign, BarChart3,
  Plus, Trash2, ArrowRight, CheckCircle2, AlertTriangle, Calculator,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS    = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const MONTH_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const SECTIONS = [
  { id: 'config',   label: 'Configuração',    emoji: '⚙️' },
  { id: 'produtos', label: 'Produtos',         emoji: '📦' },
  { id: 'funil',    label: 'Funil',            emoji: '🔁' },
  { id: 'custos',   label: 'Custos Fixos',     emoji: '💰' },
  { id: 'rh',       label: 'RH',               emoji: '👥' },
  { id: 'dre',      label: 'DRE & Projeção',   emoji: '📊' },
]

const DEFAULT_DATA = {
  setup:    { faturamentoAnterior:'', metaAnual:'', mediaUltimos3Meses:'', taxaMarketing:'', taxaImposto:'' },
  produtos: [{ id: crypto.randomUUID(), nome:'', ticketMedio:'', composicao:'' }],
  funil:    { leadToMQL:'', mqlToSQL:'', sqlToVenda:'' },
  custos:   [],
  rh:       [],
  realizado:{},
}

// ─── Math helpers ─────────────────────────────────────────────────────────────

// CAGR: taxa mensal necessária para crescer de faturamentoAnterior (anual) até metaAnual em 12 meses
// Equivalente ao =TAXA(11; -mediaBase; 0; meta; 0) do Excel quando a média mensal * crescimento ≈ CAGR
function findMonthlyRate(faturamentoAnterior, metaAnual) {
  if (!faturamentoAnterior || !metaAnual || faturamentoAnterior <= 0 || metaAnual <= 0) return 0
  return Math.pow(metaAnual / faturamentoAnterior, 1 / 12) - 1
}

function buildProjections(jan, rate) {
  return Array.from({ length: 12 }, (_, i) => jan * Math.pow(1 + rate, i))
}

function weightedTicket(produtos) {
  const totalComp = produtos.reduce((s, p) => s + (Number(p.composicao) || 0), 0)
  if (!totalComp) return 0
  return produtos.reduce((s, p) => s + (Number(p.ticketMedio) || 0) * ((Number(p.composicao) || 0) / totalComp), 0)
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtBRL = (n) => {
  if (n == null || isNaN(n) || !isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', { style:'currency', currency:'BRL', minimumFractionDigits:0, maximumFractionDigits:0 })
}
const fmtPct  = (n, d=1) => (n == null || isNaN(n) || !isFinite(n)) ? '—' : `${(n*100).toFixed(d)}%`
const fmtNum  = (n) => (n == null || isNaN(n) || !isFinite(n)) ? '—' : Math.ceil(n).toLocaleString('pt-BR')
const numVal  = (v) => { const n = Number(String(v).replace(',','.')); return isNaN(n) ? 0 : n }

// ─── DRE Computation ──────────────────────────────────────────────────────────
function computeDRE(revenue, setup, custos, rh, funil, ticket) {
  const taxaImposto  = numVal(setup.taxaImposto)
  const taxaMarketing= numVal(setup.taxaMarketing)
  const impostos     = revenue * (taxaImposto / 100)
  const lucroBruto   = revenue - impostos
  const marketing    = revenue * (taxaMarketing / 100)
  const totalRH      = rh.reduce((s,r) => s + numVal(r.salario) * (1 + numVal(r.encargos) / 100), 0)
  const totalFixos   = custos.reduce((s,c) => s + numVal(c.valor), 0)
  const lucroLiquido = lucroBruto - marketing - totalRH - totalFixos
  const margemBruta  = revenue > 0 ? lucroBruto / revenue : 0
  const margemLiquida= revenue > 0 ? lucroLiquido / revenue : 0

  const vendas       = ticket > 0 && revenue > 0 ? revenue / ticket : 0
  const cac          = vendas > 0 ? marketing / vendas : 0
  // LB/CAC = (LucroBruto per sale) / CAC = LucroBruto / Marketing
  const lbCac        = marketing > 0 ? lucroBruto / marketing : null

  // Ponto de Equilíbrio = custos fixos / margem de contribuição
  const margemContrib = 1 - taxaImposto/100 - taxaMarketing/100
  const pontoEq       = margemContrib > 0 ? (totalRH + totalFixos) / margemContrib : null

  // Funil reverso
  const sqlRate  = numVal(funil.sqlToVenda) / 100
  const mqlRate  = numVal(funil.mqlToSQL)   / 100
  const ldRate   = numVal(funil.leadToMQL)  / 100
  const vendasNec= Math.ceil(vendas)
  const sqlNec   = sqlRate > 0 ? Math.ceil(vendasNec / sqlRate) : null
  const mqlNec   = (sqlNec && mqlRate > 0) ? Math.ceil(sqlNec / mqlRate) : null
  const leadsNec = (mqlNec && ldRate > 0)  ? Math.ceil(mqlNec / ldRate)  : null

  return { impostos, lucroBruto, marketing, totalRH, totalFixos, lucroLiquido,
           margemBruta, margemLiquida, vendas, cac, lbCac, pontoEq,
           vendasNec, sqlNec, mqlNec, leadsNec }
}

// ─── Shared field component (must be at module level — never inside a component) ─
function NumField({ label, value, onChange, prefix, suffix, hint }) {
  return (
    <div>
      <label className="label-field">{label}</label>
      {hint && <p className="text-xs text-rl-muted mb-1">{hint}</p>}
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rl-muted text-sm">{prefix}</span>}
        <input
          type="number"
          value={value ?? ''}
          onChange={onChange}
          className={`input-field ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-10' : ''}`}
          placeholder="0"
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-rl-muted text-sm">{suffix}</span>}
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionNav({ active, setActive, data }) {
  const completions = {
    config:   !!(numVal(data.setup.metaAnual) && numVal(data.setup.mediaUltimos3Meses)),
    produtos: data.produtos.some(p => p.nome && numVal(p.ticketMedio) > 0),
    funil:    !!(numVal(data.funil.sqlToVenda)),
    custos:   data.custos.length > 0,
    rh:       data.rh.length > 0,
    dre:      true,
  }
  return (
    <div className="flex gap-2 flex-wrap mb-6">
      {SECTIONS.map(s => (
        <button key={s.id} onClick={() => setActive(s.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
            active === s.id
              ? 'bg-gradient-rl text-white border-transparent shadow-glow'
              : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-text hover:border-rl-green/30'
          }`}>
          <span>{s.emoji}</span>
          {s.label}
          {completions[s.id] && active !== s.id && (
            <span className="w-1.5 h-1.5 rounded-full bg-rl-green shrink-0" />
          )}
        </button>
      ))}
    </div>
  )
}

// ── Config ────────────────────────────────────────────────────────────────────
function ConfigSection({ data, onChange }) {
  const s = data
  const crescimento = numVal(s.faturamentoAnterior) && numVal(s.metaAnual)
    ? (numVal(s.metaAnual) / numVal(s.faturamentoAnterior) - 1) * 100 : null
  const rate = numVal(s.faturamentoAnterior) && numVal(s.metaAnual)
    ? findMonthlyRate(numVal(s.faturamentoAnterior), numVal(s.metaAnual)) * 100 : null

  return (
    <div className="space-y-5">
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-rl-text">📅 Faturamento Anual</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <NumField label="Faturamento do Ano Anterior" value={s.faturamentoAnterior}
            onChange={e => onChange({ ...s, faturamentoAnterior: e.target.value })} prefix="R$" hint="Base para calcular crescimento" />
          <NumField label="Meta de Faturamento (Ano Atual)" value={s.metaAnual}
            onChange={e => onChange({ ...s, metaAnual: e.target.value })} prefix="R$" hint="Quanto quer faturar este ano" />
        </div>
        {crescimento !== null && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${crescimento >= 0 ? 'bg-rl-green/8 border-rl-green/25 text-rl-green' : 'bg-red-500/8 border-red-500/25 text-red-400'}`}>
            <TrendingUp className="w-4 h-4 shrink-0" />
            <span className="text-sm font-semibold">
              Crescimento necessário: {crescimento >= 0 ? '+' : ''}{crescimento.toFixed(1)}% em relação ao ano anterior
            </span>
          </div>
        )}
      </div>

      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-rl-text">📈 Projeção de Crescimento (Juros Composto)</h3>
        <p className="text-xs text-rl-muted -mt-2">
          Informe a média dos últimos 3 meses — será o ponto de partida das projeções mensais. A taxa de crescimento mensal é calculada via CAGR a partir do faturamento anterior e da meta anual (equivalente ao =TAXA do Excel).
        </p>
        <NumField label="Média dos últimos 3 meses (faturamento base)" value={s.mediaUltimos3Meses}
          onChange={e => onChange({ ...s, mediaUltimos3Meses: e.target.value })} prefix="R$"
          hint="Ponto de partida para a curva de crescimento mensal" />
        {rate !== null && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rl-purple/8 border border-rl-purple/25 text-rl-purple">
            <Calculator className="w-4 h-4 shrink-0" />
            <span className="text-sm font-semibold">
              Taxa de crescimento: {rate >= 0 ? '+' : ''}{rate.toFixed(2)}% ao mês (juros composto)
            </span>
          </div>
        )}
      </div>

      <div className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-rl-text">💸 Parâmetros Financeiros</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <NumField label="Investimento em Marketing" value={s.taxaMarketing}
            onChange={e => onChange({ ...s, taxaMarketing: e.target.value })} suffix="%" hint="% do faturamento bruto" />
          <NumField label="Alíquota de Impostos" value={s.taxaImposto}
            onChange={e => onChange({ ...s, taxaImposto: e.target.value })} suffix="%" hint="% do faturamento bruto" />
        </div>
      </div>
    </div>
  )
}

// ── Produtos ──────────────────────────────────────────────────────────────────
function ProdutosSection({ produtos, onChange }) {
  const add    = () => onChange([...produtos, { id: crypto.randomUUID(), nome:'', ticketMedio:'', composicao:'' }])
  const remove = (id) => onChange(produtos.filter(p => p.id !== id))
  const upd    = (id, f, v) => onChange(produtos.map(p => p.id === id ? { ...p, [f]: v } : p))
  const total  = produtos.reduce((s, p) => s + numVal(p.composicao), 0)
  const ok     = Math.abs(total - 100) < 0.1

  return (
    <div className="space-y-4">
      {produtos.map((p, i) => (
        <div key={p.id} className="glass-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-rl-text">Produto / Serviço {i + 1}</span>
            {produtos.length > 1 && (
              <button onClick={() => remove(p.id)} className="p-1.5 text-rl-muted hover:text-red-400 rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="label-field">Nome</label>
              <input value={p.nome} onChange={e => upd(p.id,'nome',e.target.value)} className="input-field" placeholder="Ex: Consultoria Mensal" />
            </div>
            <div>
              <label className="label-field">Ticket Médio</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rl-muted text-sm">R$</span>
                <input type="number" value={p.ticketMedio} onChange={e => upd(p.id,'ticketMedio',e.target.value)} className="input-field pl-8" placeholder="0" />
              </div>
            </div>
            <div>
              <label className="label-field">% Composição na Carteira</label>
              <div className="relative">
                <input type="number" min="0" max="100" value={p.composicao} onChange={e => upd(p.id,'composicao',e.target.value)} className="input-field pr-8" placeholder="0" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-rl-muted text-sm">%</span>
              </div>
            </div>
          </div>
        </div>
      ))}

      <button onClick={add} className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-rl-gold/30 text-rl-gold hover:border-rl-gold/50 text-sm font-medium transition-all">
        <Plus className="w-4 h-4" /> Adicionar Produto / Serviço
      </button>

      <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${ok ? 'bg-rl-green/8 border-rl-green/25' : 'bg-rl-gold/8 border-rl-gold/25'}`}>
        <span className="text-sm text-rl-muted">Total da composição</span>
        <span className={`text-sm font-bold ${ok ? 'text-rl-green' : 'text-rl-gold'}`}>
          {total.toFixed(1)}% {ok ? '✓' : `(faltam ${(100 - total).toFixed(1)}%)`}
        </span>
      </div>

      {weightedTicket(produtos) > 0 && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-rl-cyan/8 border border-rl-cyan/25">
          <span className="text-sm text-rl-muted">Ticket médio ponderado</span>
          <span className="text-sm font-bold text-rl-cyan">{fmtBRL(weightedTicket(produtos))}</span>
        </div>
      )}
    </div>
  )
}

// ── Funil ─────────────────────────────────────────────────────────────────────
function FunilSection({ data, onChange }) {
  const stages = [
    { key:'leadToMQL', from:'Lead',  to:'MQL',   emoji:'📥', color:'rl-blue'   },
    { key:'mqlToSQL',  from:'MQL',   to:'SQL',    emoji:'🎯', color:'rl-purple' },
    { key:'sqlToVenda',from:'SQL',   to:'Venda',  emoji:'💰', color:'rl-green'  },
  ]
  const conv = (numVal(data.leadToMQL)/100) * (numVal(data.mqlToSQL)/100) * (numVal(data.sqlToVenda)/100)

  return (
    <div className="space-y-4">
      <p className="text-xs text-rl-muted">Configure as taxas de conversão entre cada etapa do funil. O sistema vai calcular quantos leads você precisa gerar mensalmente para atingir a meta.</p>
      {stages.map(s => (
        <div key={s.key} className="glass-card p-5 flex items-center gap-4">
          <span className="text-2xl">{s.emoji}</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-rl-text">{s.from} → {s.to}</p>
            <p className="text-xs text-rl-muted">Percentual de {s.from}s que avançam para {s.to}</p>
          </div>
          <div className="relative w-28 shrink-0">
            <input type="number" min="0" max="100" value={data[s.key] ?? ''}
              onChange={e => onChange({ ...data, [s.key]: e.target.value })}
              className="input-field pr-8 text-right" placeholder="0" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-rl-muted text-sm">%</span>
          </div>
        </div>
      ))}
      {conv > 0 && (
        <div className="glass-card p-4 bg-rl-purple/5 border border-rl-purple/20">
          <p className="text-xs text-rl-muted mb-1">Conversão total Lead → Venda</p>
          <p className="text-2xl font-bold text-rl-purple">{fmtPct(conv, 2)}</p>
          <p className="text-xs text-rl-muted mt-1">Para cada 1.000 leads, {(conv * 1000).toFixed(1)} viram clientes</p>
        </div>
      )}
    </div>
  )
}

// ── Custos Fixos ──────────────────────────────────────────────────────────────
function CustosSection({ custos, onChange }) {
  const add    = () => onChange([...custos, { id: crypto.randomUUID(), nome:'', valor:'' }])
  const remove = (id) => onChange(custos.filter(c => c.id !== id))
  const upd    = (id, f, v) => onChange(custos.map(c => c.id === id ? { ...c, [f]: v } : c))
  const total  = custos.reduce((s,c) => s + numVal(c.valor), 0)

  return (
    <div className="space-y-4">
      <p className="text-xs text-rl-muted">Adicione todos os custos fixos mensais (exceto RH e marketing, que são calculados automaticamente).</p>
      {custos.map(c => (
        <div key={c.id} className="glass-card p-4 flex items-center gap-3">
          <div className="flex-1">
            <input value={c.nome} onChange={e => upd(c.id,'nome',e.target.value)} className="input-field" placeholder="Nome do custo (ex: Aluguel, Software...)" />
          </div>
          <div className="relative w-36 shrink-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rl-muted text-sm">R$</span>
            <input type="number" value={c.valor} onChange={e => upd(c.id,'valor',e.target.value)} className="input-field pl-8 text-right" placeholder="0" />
          </div>
          <button onClick={() => remove(c.id)} className="p-1.5 text-rl-muted hover:text-red-400 rounded-lg transition-colors shrink-0">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button onClick={add} className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-rl-gold/30 text-rl-gold hover:border-rl-gold/50 text-sm font-medium transition-all">
        <Plus className="w-4 h-4" /> Adicionar Custo Fixo
      </button>
      {total > 0 && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-rl-surface border border-rl-border">
          <span className="text-sm text-rl-muted">Total mensal de custos fixos</span>
          <span className="text-sm font-bold text-rl-text">{fmtBRL(total)}</span>
        </div>
      )}
    </div>
  )
}

// ── Recursos Humanos ──────────────────────────────────────────────────────────
function RHSection({ rh, onChange }) {
  const add    = () => onChange([...rh, { id: crypto.randomUUID(), cargo:'', salario:'', encargos:'70' }])
  const remove = (id) => onChange(rh.filter(r => r.id !== id))
  const upd    = (id, f, v) => onChange(rh.map(r => r.id === id ? { ...r, [f]: v } : r))
  const totalSal = rh.reduce((s,r) => s + numVal(r.salario), 0)
  const totalEnc = rh.reduce((s,r) => s + numVal(r.salario) * (numVal(r.encargos)/100), 0)

  return (
    <div className="space-y-4">
      <p className="text-xs text-rl-muted">Inclua todos os colaboradores. Os encargos (INSS, FGTS, 13º, férias, etc.) são tipicamente 70–80% do salário base para CLT.</p>
      {rh.map((r, i) => (
        <div key={r.id} className="glass-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-rl-text">Colaborador {i + 1}</span>
            <button onClick={() => remove(r.id)} className="p-1.5 text-rl-muted hover:text-red-400 rounded-lg transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="label-field">Cargo / Nome</label>
              <input value={r.cargo} onChange={e => upd(r.id,'cargo',e.target.value)} className="input-field" placeholder="Ex: Vendedor" />
            </div>
            <div>
              <label className="label-field">Salário Base</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rl-muted text-sm">R$</span>
                <input type="number" value={r.salario} onChange={e => upd(r.id,'salario',e.target.value)} className="input-field pl-8" placeholder="0" />
              </div>
            </div>
            <div>
              <label className="label-field">Encargos / Benefícios</label>
              <div className="relative">
                <input type="number" value={r.encargos} onChange={e => upd(r.id,'encargos',e.target.value)} className="input-field pr-8" placeholder="70" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-rl-muted text-sm">%</span>
              </div>
            </div>
          </div>
          {numVal(r.salario) > 0 && (
            <p className="text-xs text-rl-muted">
              Custo real: <span className="text-rl-cyan font-semibold">{fmtBRL(numVal(r.salario) * (1 + numVal(r.encargos)/100))}</span>/mês
            </p>
          )}
        </div>
      ))}
      <button onClick={add} className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-rl-cyan/30 text-rl-cyan hover:border-rl-cyan/50 text-sm font-medium transition-all">
        <Plus className="w-4 h-4" /> Adicionar Colaborador
      </button>
      {rh.length > 0 && (
        <div className="glass-card p-4 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-rl-muted">Total salários</span><span>{fmtBRL(totalSal)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-rl-muted">Total encargos</span><span>{fmtBRL(totalEnc)}</span></div>
          <div className="flex justify-between text-sm font-bold border-t border-rl-border pt-2">
            <span className="text-rl-text">Custo total RH</span>
            <span className="text-rl-cyan">{fmtBRL(totalSal + totalEnc)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── DRE Row ───────────────────────────────────────────────────────────────────
function DRERow({ label, value, bold, negative, highlight, isPct, isRatio, threshold, indent }) {
  let display = '—'
  let color = bold ? 'text-rl-text' : 'text-rl-muted'

  if (value != null && !isNaN(value) && isFinite(value)) {
    if (isPct)        display = fmtPct(value)
    else if (isRatio) { display = value.toFixed(2) + 'x'; color = value >= (threshold||3) ? 'text-rl-green' : 'text-red-400' }
    else              { display = fmtBRL(Math.abs(value)); if (negative && value !== 0) display = `(${display})` }

    if      (highlight === 'green')  color = 'text-rl-green'
    else if (highlight === 'cyan')   color = 'text-rl-cyan'
    else if (highlight === 'purple') color = 'text-rl-purple'
    else if (highlight === 'gold')   color = 'text-rl-gold'
    else if (highlight === 'red')    color = 'text-red-400'
    else if (negative && !isRatio)   color = 'text-rl-muted'
  }

  return (
    <div className={`flex items-center justify-between py-1 ${indent ? 'pl-3' : ''}`}>
      <span className={`text-xs ${bold ? 'font-semibold text-rl-text' : 'text-rl-muted'}`}>{label}</span>
      <span className={`text-xs font-mono ${bold ? 'font-bold' : 'font-medium'} ${color}`}>{display}</span>
    </div>
  )
}

// ── DRE Section ───────────────────────────────────────────────────────────────
function DRESection({ setup, produtos, funil, custos, rh, realizado, onRealizadoChange }) {
  const [selMonth, setSelMonth] = useState(() => {
    // Default: current month (0-indexed) or 0
    const m = new Date().getMonth()
    return m < 12 ? m : 0
  })

  const mediaBase = numVal(setup.mediaUltimos3Meses)
  const anterior  = numVal(setup.faturamentoAnterior)
  const annual    = numVal(setup.metaAnual)
  const ticket    = useMemo(() => weightedTicket(produtos), [produtos])
  const rate      = useMemo(() => findMonthlyRate(anterior, annual), [anterior, annual])
  const projs     = useMemo(() => buildProjections(mediaBase, rate), [mediaBase, rate])
  const totalP = projs.reduce((s,v) => s + v, 0)

  const totalRH      = rh.reduce((s,r) => s + numVal(r.salario)*(1+numVal(r.encargos)/100),0)
  const totalFixos   = custos.reduce((s,c) => s + numVal(c.valor),0)
  const realTotal    = Object.values(realizado||{}).reduce((s,v)=>s+(numVal(v)||0),0)

  const dreP = useMemo(() => computeDRE(projs[selMonth]||0, setup, custos, rh, funil, ticket), [selMonth,projs,setup,custos,rh,funil,ticket])
  const dreR = useMemo(() => {
    const rv = numVal(realizado?.[selMonth])
    return rv > 0 ? computeDRE(rv, setup, custos, rh, funil, ticket) : null
  }, [selMonth,realizado,setup,custos,rh,funil,ticket])

  const kpis = [
    { label:'Meta Anual',           value: fmtBRL(annual),         color:'text-rl-green'  },
    { label:'Projeção (soma 12m)',   value: fmtBRL(totalP),         color: Math.abs(totalP-annual)<1?'text-rl-green':'text-rl-gold' },
    { label:'Ticket Médio Pond.',    value: fmtBRL(ticket),         color:'text-rl-cyan'   },
    { label:'Taxa Mensal Composta',  value: `${(rate*100).toFixed(2)}%`, color:'text-rl-purple' },
    { label:'Custo Total Fixo/mês',  value: fmtBRL(totalRH+totalFixos), color:'text-rl-gold' },
    { label:'Realizado Acumulado',   value: fmtBRL(realTotal),      color:'text-rl-text'   },
  ]

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="glass-card p-4">
            <p className="text-xs text-rl-muted mb-1 leading-snug">{k.label}</p>
            <p className={`text-base font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Planned vs Realized table */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-rl-text mb-4">📅 Planejado vs Realizado — clique no mês para ver a DRE</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-rl-border">
                <th className="text-left py-2 pr-3 text-rl-muted font-medium w-10">Mês</th>
                <th className="text-right py-2 px-3 text-rl-muted font-medium">Planejado</th>
                <th className="text-right py-2 px-3 text-rl-muted font-medium">Realizado</th>
                <th className="text-right py-2 px-3 text-rl-muted font-medium hidden sm:table-cell">Δ</th>
                <th className="py-2 pl-3 text-rl-muted font-medium hidden sm:table-cell">Ating.</th>
              </tr>
            </thead>
            <tbody>
              {MONTHS.map((m, i) => {
                const plan  = projs[i] || 0
                const real  = numVal(realizado?.[i])
                const delta = real - plan
                const pct   = plan > 0 && real > 0 ? real/plan : null
                const isSel = selMonth === i
                return (
                  <tr key={m} onClick={() => setSelMonth(i)}
                    className={`border-b border-rl-border/30 cursor-pointer transition-colors ${isSel ? 'bg-rl-purple/10' : 'hover:bg-rl-surface/50'}`}>
                    <td className={`py-2.5 pr-3 font-semibold ${isSel ? 'text-rl-purple' : 'text-rl-text'}`}>{m}</td>
                    <td className="py-2.5 px-3 text-right text-rl-text">{fmtBRL(plan)}</td>
                    <td className="py-2.5 px-3 text-right" onClick={e => e.stopPropagation()}>
                      <input type="number" value={realizado?.[i] ?? ''}
                        onChange={e => onRealizadoChange({ ...(realizado||{}), [i]: e.target.value })}
                        className="w-28 text-right bg-rl-surface border border-rl-border rounded-lg px-2 py-1 text-xs text-rl-text focus:outline-none focus:border-rl-purple/50"
                        placeholder="—" />
                    </td>
                    <td className={`py-2.5 px-3 text-right font-medium hidden sm:table-cell ${real===0?'text-rl-muted':delta>=0?'text-rl-green':'text-red-400'}`}>
                      {real > 0 ? `${delta>=0?'+':''}${fmtBRL(delta)}` : '—'}
                    </td>
                    <td className="py-2.5 pl-3 hidden sm:table-cell">
                      {pct ? (
                        <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${pct>=1?'bg-rl-green/15 text-rl-green':'bg-red-500/15 text-red-400'}`}>
                          {(pct*100).toFixed(0)}%
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-rl-border font-bold text-sm">
                <td className="py-2 pr-3 text-rl-text">Total</td>
                <td className="py-2 px-3 text-right text-rl-green">{fmtBRL(totalP)}</td>
                <td className="py-2 px-3 text-right text-rl-text">{realTotal > 0 ? fmtBRL(realTotal) : '—'}</td>
                <td colSpan={2} className="hidden sm:table-cell" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* DRE Month Detail */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-rl-text">📊 DRE — {MONTH_FULL[selMonth]}</h3>
          <div className="flex gap-1 flex-wrap">
            {MONTHS.map((m,i) => (
              <button key={m} onClick={() => setSelMonth(i)}
                className={`px-2 py-1 rounded text-xs font-medium transition-all ${selMonth===i?'bg-rl-purple text-white':'text-rl-muted hover:text-rl-text'}`}>
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Planned */}
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-rl-purple uppercase tracking-wider mb-3">Planejado — {fmtBRL(projs[selMonth])}</p>
            <DRERow label="Receita Bruta"                    value={projs[selMonth]}    bold />
            <DRERow label={`(−) Impostos (${numVal(setup.taxaImposto)}%)`} value={-dreP.impostos} negative indent />
            <DRERow label="= Lucro Bruto"                    value={dreP.lucroBruto}    bold highlight="green" />
            <DRERow label="Margem Bruta"                     value={dreP.margemBruta}   isPct />
            <div className="border-t border-rl-border/40 my-2" />
            <DRERow label={`(−) Marketing (${numVal(setup.taxaMarketing)}%)`} value={-dreP.marketing} negative indent />
            <DRERow label="(−) Custo RH"                    value={-totalRH}            negative indent />
            <DRERow label="(−) Custos Fixos"                 value={-totalFixos}         negative indent />
            <div className="border-t border-rl-border/40 my-2" />
            <DRERow label="= Lucro Líquido"                  value={dreP.lucroLiquido}  bold highlight={dreP.lucroLiquido>=0?'green':'red'} />
            <DRERow label="Margem Líquida"                   value={dreP.margemLiquida} isPct highlight={dreP.margemLiquida>=0.1?'green':dreP.margemLiquida>=0?'gold':'red'} />
            <div className="border-t border-rl-border/40 my-2" />
            <DRERow label="CAC"                              value={dreP.cac}           bold highlight="cyan" />
            <DRERow label="LB / CAC (meta > 3×)"            value={dreP.lbCac}         isRatio threshold={3} bold />
            <DRERow label="Ponto de Equilíbrio"              value={dreP.pontoEq}       bold highlight="purple" />
          </div>

          {/* Realized */}
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-rl-gold uppercase tracking-wider mb-3">
              Realizado — {numVal(realizado?.[selMonth]) > 0 ? fmtBRL(numVal(realizado[selMonth])) : 'Aguardando entrada'}
            </p>
            {dreR ? (
              <>
                <DRERow label="Receita Bruta"                    value={numVal(realizado[selMonth])} bold />
                <DRERow label={`(−) Impostos (${numVal(setup.taxaImposto)}%)`} value={-dreR.impostos} negative indent />
                <DRERow label="= Lucro Bruto"                    value={dreR.lucroBruto}    bold highlight="green" />
                <DRERow label="Margem Bruta"                     value={dreR.margemBruta}   isPct />
                <div className="border-t border-rl-border/40 my-2" />
                <DRERow label={`(−) Marketing (${numVal(setup.taxaMarketing)}%)`} value={-dreR.marketing} negative indent />
                <DRERow label="(−) Custo RH"                    value={-totalRH}            negative indent />
                <DRERow label="(−) Custos Fixos"                 value={-totalFixos}         negative indent />
                <div className="border-t border-rl-border/40 my-2" />
                <DRERow label="= Lucro Líquido"                  value={dreR.lucroLiquido}  bold highlight={dreR.lucroLiquido>=0?'green':'red'} />
                <DRERow label="Margem Líquida"                   value={dreR.margemLiquida} isPct highlight={dreR.margemLiquida>=0.1?'green':dreR.margemLiquida>=0?'gold':'red'} />
                <div className="border-t border-rl-border/40 my-2" />
                <DRERow label="CAC"                              value={dreR.cac}           bold highlight="cyan" />
                <DRERow label="LB / CAC (meta > 3×)"            value={dreR.lbCac}         isRatio threshold={3} bold />
                <DRERow label="Ponto de Equilíbrio"              value={dreR.pontoEq}       bold highlight="purple" />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-center gap-2">
                <BarChart3 className="w-8 h-8 text-rl-border" />
                <p className="text-sm text-rl-muted">Insira o faturamento realizado<br />na tabela acima para ver a DRE comparada</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Funil Reverso */}
      {(dreP.leadsNec || dreP.mqlNec || dreP.sqlNec) && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-rl-text mb-4">🔁 Funil Reverso — {MONTH_FULL[selMonth]} (Planejado)</h3>
          <p className="text-xs text-rl-muted mb-4">
            Para faturar <span className="text-rl-green font-semibold">{fmtBRL(projs[selMonth])}</span> com ticket médio de <span className="text-rl-cyan font-semibold">{fmtBRL(ticket)}</span>, você precisa de:
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            {[
              { label:'Leads',  value: dreP.leadsNec, color:'rl-blue'   },
              { label:'MQLs',   value: dreP.mqlNec,   color:'rl-purple' },
              { label:'SQLs',   value: dreP.sqlNec,   color:'rl-cyan'   },
              { label:'Vendas', value: dreP.vendasNec, color:'rl-green'  },
            ].map((st, i, arr) => (
              <div key={st.label} className="flex items-center gap-3">
                <div className="text-center">
                  <div className={`text-3xl font-black text-${st.color}`}>{st.value != null ? fmtNum(st.value) : '—'}</div>
                  <div className="text-xs text-rl-muted">{st.label}</div>
                </div>
                {i < arr.length - 1 && <ArrowRight className="w-4 h-4 text-rl-muted shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PlanejamentoAnualModule({ project }) {
  const { updateProject } = useApp()
  const saveTimer = useRef(null)

  const [activeSection, setActiveSection] = useState('config')
  const [saved, setSaved] = useState(false)
  const [data, setData] = useState(() => {
    const stored = project.planejamentoAnual || {}
    return {
      setup:    { ...DEFAULT_DATA.setup,    ...(stored.setup    || {}) },
      produtos: stored.produtos?.length ? stored.produtos : DEFAULT_DATA.produtos,
      funil:    { ...DEFAULT_DATA.funil,    ...(stored.funil    || {}) },
      custos:   stored.custos   || [],
      rh:       stored.rh       || [],
      realizado:stored.realizado|| {},
    }
  })

  const persist = useCallback((next) => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      updateProject(project.id, { planejamentoAnual: next })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }, 800)
  }, [project.id, updateProject])

  const update = useCallback((key, value) => {
    setData(prev => {
      const next = { ...prev, [key]: value }
      persist(next)
      return next
    })
  }, [persist])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-rl-text flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-rl-green" />
            Planejamento Anual
          </h2>
          <p className="text-xs text-rl-muted mt-0.5">
            Projeção com juros composto · DRE · Funil reverso · Planejado vs Realizado
          </p>
        </div>
        {saved && (
          <span className="flex items-center gap-1.5 text-xs text-rl-green">
            <CheckCircle2 className="w-3.5 h-3.5" /> Salvo
          </span>
        )}
      </div>

      <SectionNav active={activeSection} setActive={setActiveSection} data={data} />

      {activeSection === 'config'   && <ConfigSection   data={data.setup}    onChange={v => update('setup',    v)} />}
      {activeSection === 'produtos' && <ProdutosSection produtos={data.produtos} onChange={v => update('produtos', v)} />}
      {activeSection === 'funil'    && <FunilSection    data={data.funil}    onChange={v => update('funil',    v)} />}
      {activeSection === 'custos'   && <CustosSection   custos={data.custos} onChange={v => update('custos',   v)} />}
      {activeSection === 'rh'       && <RHSection       rh={data.rh}        onChange={v => update('rh',       v)} />}
      {activeSection === 'dre'      && (
        <DRESection
          setup={data.setup} produtos={data.produtos} funil={data.funil}
          custos={data.custos} rh={data.rh} realizado={data.realizado}
          onRealizadoChange={v => update('realizado', v)}
        />
      )}
    </div>
  )
}
