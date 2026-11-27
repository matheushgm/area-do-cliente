// Cartão "Resumo do cliente" no topo da Visão geral: o que o cliente contratou,
// quanto paga (MRR ou valor único), desde quando é cliente, o investimento e os
// parâmetros da Calculadora de ROI, a divisão da verba entre os canais
// (Planejamento de Campanhas) e as observações, editáveis aqui mesmo.
//
// Fontes: projects_v2 (services, services_data, contract_*, client_since,
// observacoes), roi_calculators (project.roiCalc, a calculadora principal) e
// campaign_plans (1ª conta do plano, a mesma que o app trata como orçamento do mês).
import { useMemo, useState } from 'react'
import { Briefcase, CalendarDays, Wallet, Calculator, PieChart, StickyNote, Pencil, Loader2, ArrowRight, Repeat } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { SERVICES_CONFIG, rotuloServico, rotuloSubServico, rotuloOpcaoServico } from '../../lib/constants'
import { fmtCurrency } from '../../lib/utils'
import { calcularResultadoRoi, orcamentoDoPlano, orcamentoDoRoi } from '../../lib/orcamentoSync'
import { channelStyle } from '../CampaignPlanner/campaignHelpers'
import { ObservacoesEditor, ObservacoesLeitura } from '../UI/ObservacoesCampo'
import { useI18n, localeAtual } from '../../i18n'

const num = (v) => {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}
const fmtMoeda = (v, dec = 0) => fmtCurrency(v, dec)
const fmtNum = (v) => (Number.isFinite(v) ? Math.round(v).toLocaleString(localeAtual()) : '—')
const fmtPct = (v) => `${num(v).toLocaleString(localeAtual(), { maximumFractionDigits: 1 })}%`

// Data (yyyy-mm-dd) no meio do dia, pra não voltar um dia no fuso do Brasil.
const dataLocal = (iso) => (iso ? new Date(String(iso).length === 10 ? `${iso}T12:00:00` : iso) : null)

// Serviços gravados como rótulo em pt ("Gestão de Meta Ads"); entregáveis em services_data por id.
function servicosContratados(project) {
  const ids = new Set()
  for (const s of project.services || []) {
    const cfg = SERVICES_CONFIG.find((c) => c.label === s || c.id === s)
    ids.add(cfg ? cfg.id : s)
  }
  for (const id of Object.keys(project.servicesData || {})) if (SERVICES_CONFIG.some((c) => c.id === id)) ids.add(id)
  return [...ids].map((id) => {
    const cfg = SERVICES_CONFIG.find((c) => c.id === id)
    const dados = project.servicesData?.[id] || {}
    const itens = (cfg?.sub || [])
      .map(({ key }) => ({ key, valor: dados[key] }))
      .filter(({ valor }) => valor !== '' && valor != null && valor !== '0' && valor !== 0)
    return { id, conhecido: !!cfg, itens }
  })
}

// Canais do 1º plano de campanhas (ou da raiz, no plano legado) com a fatia de cada um.
function distribuicaoVerba(plan, orcamentoRoi) {
  if (!plan || typeof plan !== 'object') return null
  const conta = Array.isArray(plan.accounts) && plan.accounts.length ? plan.accounts[0] : plan
  const canais = (conta.channels || []).filter((c) => c?.name && num(c.percentage) > 0)
  if (!canais.length) return null
  const total = orcamentoDoPlano(plan) || orcamentoRoi
  return {
    total,
    canais: canais.map((c) => ({ nome: c.name, pct: num(c.percentage), valor: total * (num(c.percentage) / 100), cor: channelStyle(c.name).color, logo: channelStyle(c.name).logo })),
  }
}

function Bloco({ icon: Icon, titulo, acao, children, className = '' }) {
  return (
    <div className={`rounded-xl border border-rl-border/60 p-3.5 min-w-0 ${className}`}>
      <div className="flex items-center gap-2 mb-2.5">
        <Icon className="w-3.5 h-3.5 text-rl-muted shrink-0" />
        <p className="text-xs font-semibold text-rl-muted flex-1 truncate">{titulo}</p>
        {acao}
      </div>
      {children}
    </div>
  )
}

function LinkModulo({ onClick, children }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 text-[11px] text-rl-muted hover:text-rl-purple shrink-0">
      {children} <ArrowRight className="w-3 h-3" />
    </button>
  )
}

function Destaque({ icon: Icon, label, valor, detalhe }) {
  return (
    <div className="rounded-xl bg-rl-surface/60 px-3.5 py-3 min-w-0">
      <p className="text-[11px] font-semibold text-rl-muted flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" /> {label}</p>
      <p className="text-xl font-bold text-rl-text tabular-nums leading-tight mt-1 truncate">{valor}</p>
      {detalhe && <p className="text-[11px] text-rl-muted mt-0.5 truncate" title={detalhe}>{detalhe}</p>}
    </div>
  )
}

function Par({ label, valor }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 border-b border-rl-border/40 last:border-0">
      <span className="text-xs text-rl-muted truncate">{label}</span>
      <span className="text-sm font-semibold text-rl-text tabular-nums shrink-0">{valor}</span>
    </div>
  )
}

export default function ResumoCliente({ project, onNavigate }) {
  const { t, locale } = useI18n()
  const { updateProject } = useApp()
  const [editandoObs, setEditandoObs] = useState(false)
  const [rascunhoObs, setRascunhoObs] = useState('')
  const [salvandoObs, setSalvandoObs] = useState(false)

  const servicos = useMemo(() => servicosContratados(project), [project])

  // Valor do contrato: assessoria é recorrente (MRR); programa de aceleração é valor único,
  // a não ser que tenha sido parcelado por mês.
  const valor = num(project.contractValue)
  const recorrente = project.contractModel === 'assessoria'
  const parcelado = !recorrente && project.contractPaymentType === 'mensal'
  const duracao = num(project.contractDurationMonths)
  const valorDetalhe = [
    recorrente && duracao ? t('hub.resumoCliente.contratoMeses', { count: duracao }) : null,
    recorrente && duracao ? t('hub.resumoCliente.totalContrato', { valor: fmtMoeda(valor * duracao) }) : null,
    parcelado ? t('hub.resumoCliente.parcelado') : null,
  ].filter(Boolean).join(' · ')

  // Cliente desde: 1º contrato (client_since; renovação não zera) ou o início do contrato atual.
  const desdeIso = project.clientSince || project.contractDate
  const desde = dataLocal(desdeIso)
  const meses = desde ? Math.max(0, (Date.now() - desde.getTime()) / (30.44 * 86400000)) : null
  const tempoCasa = meses == null ? null
    : meses < 1 ? t('hub.resumoCliente.haDias', { count: Math.max(1, Math.round(meses * 30.44)) })
      : t('hub.resumoCliente.haMeses', { n: meses.toLocaleString(localeAtual(), { maximumFractionDigits: 1 }) })

  // Calculadora de ROI (a principal, que é a sincronizada com o planejamento)
  const calc = project.roiCalc
  const midia = orcamentoDoRoi(calc)
  const resultado = useMemo(() => (calc ? calcularResultadoRoi(calc) || project.roiResult || null : null), [calc, project.roiResult])
  const totalInvestido = calc ? midia + num(calc.custoMarketing) : 0

  const dist = useMemo(() => distribuicaoVerba(project.campaignPlan, midia), [project.campaignPlan, midia])

  async function salvarObs() {
    setSalvandoObs(true)
    try {
      await updateProject(project.id, { observacoes: rascunhoObs })
      setEditandoObs(false)
    } finally {
      setSalvandoObs(false)
    }
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-7 h-7 rounded-full fx-soft flex items-center justify-center shrink-0"><Briefcase className="w-3.5 h-3.5" /></span>
        <p className="text-sm font-semibold text-rl-text flex-1">{t('hub.resumoCliente.titulo')}</p>
        <LinkModulo onClick={() => onNavigate('dados')}>{t('hub.resumoCliente.editarDados')}</LinkModulo>
      </div>

      {/* Números do contrato */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-3">
        <Destaque
          icon={recorrente ? Repeat : Wallet}
          label={recorrente ? t('hub.resumoCliente.mrr') : t('hub.resumoCliente.valorUnico')}
          valor={valor ? `${fmtMoeda(valor, valor % 1 ? 2 : 0)}${recorrente || parcelado ? t('hub.info.porMes') : ''}` : '—'}
          detalhe={valorDetalhe || null}
        />
        <Destaque
          icon={CalendarDays}
          label={t('hub.resumoCliente.clienteDesde')}
          valor={desde ? desde.toLocaleDateString(locale) : '—'}
          detalhe={tempoCasa}
        />
        <Destaque
          icon={Calculator}
          label={t('hub.resumoCliente.investimento')}
          valor={midia ? `${fmtMoeda(midia)}${t('hub.info.porMes')}` : '—'}
          detalhe={!calc ? t('hub.resumoCliente.semCalculadora')
            : totalInvestido > midia ? t('hub.resumoCliente.totalInvestido', { valor: fmtMoeda(totalInvestido, 2) })
              : t('hub.resumoCliente.daCalculadora')}
        />
      </div>

      {/* Produtos contratados */}
      <Bloco icon={Briefcase} titulo={t('hub.resumoCliente.produtos')} className="mb-3">
        {servicos.length === 0 ? (
          <p className="text-sm text-rl-subtle">{t('hub.resumoCliente.semProdutos')}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {servicos.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-rl-purple/10 text-rl-purple border border-rl-purple/20">
                <span className="font-medium">{s.conhecido ? rotuloServico(s.id) : s.id}</span>
                {s.itens.length > 0 && (
                  <span className="text-rl-purple/70">
                    {s.itens.map((it) => `${rotuloSubServico(it.key)}: ${rotuloOpcaoServico(it.valor)}`).join(' · ')}
                  </span>
                )}
              </span>
            ))}
          </div>
        )}
      </Bloco>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        {/* Parâmetros da Calculadora de ROI */}
        <Bloco icon={Calculator} titulo={t('hub.resumoCliente.parametrosRoi')} acao={<LinkModulo onClick={() => onNavigate('roi')}>{t('hub.resumoCliente.abrir')}</LinkModulo>}>
          {!calc ? (
            <p className="text-sm text-rl-subtle">{t('hub.resumoCliente.semCalculadoraTexto')}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5">
              <div>
                <Par label={t('roi.calc.orcamentoMidia')} valor={fmtMoeda(midia)} />
                <Par label={t('roi.calc.custoMarketing')} valor={fmtMoeda(calc.custoMarketing, num(calc.custoMarketing) % 1 ? 2 : 0)} />
                <Par label={t('roi.calc.ticketMedio')} valor={fmtMoeda(calc.ticketMedio, num(calc.ticketMedio) % 1 ? 2 : 0)} />
                <Par label={t('roi.calc.compras')} valor={fmtNum(num(calc.qtdCompras))} />
                <Par label={t('roi.calc.margem')} valor={fmtPct(calc.margemBruta)} />
                <Par label={t('roi.calc.roiDesejado')} valor={fmtPct(calc.roiDesejado)} />
                <Par label={t('roi.calc.taxas.lead2mql')} valor={fmtPct(calc.taxaLead2MQL)} />
                <Par label={t('roi.calc.taxas.mql2sql')} valor={fmtPct(calc.taxaMQL2SQL)} />
                <Par label={t('roi.calc.taxas.sql2venda')} valor={fmtPct(calc.taxaSQL2Venda)} />
              </div>
              <div className="mt-3 sm:mt-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-rl-muted mb-1">{t('hub.resumoCliente.metasMes')}</p>
                {!resultado ? (
                  <p className="text-xs text-rl-subtle">{t('hub.resumoCliente.semResultado')}</p>
                ) : (
                  <>
                    <Par label={t('roi.calc.leadsNec')} valor={fmtNum(resultado.leadsNecessarios)} />
                    <Par label={t('roi.calc.mqlsNec')} valor={fmtNum(resultado.mqlsNecessarios)} />
                    <Par label={t('roi.calc.sqlsNec')} valor={fmtNum(resultado.sqlsNecessarios)} />
                    <Par label={t('roi.calc.vendasNec')} valor={fmtNum(resultado.vendasNecessarias)} />
                    <Par label={t('roi.calc.cplMidia')} valor={Number.isFinite(resultado.custoPorLead) ? fmtMoeda(resultado.custoPorLead, 2) : '—'} />
                    <Par label={t('roi.calc.cacMidia')} valor={Number.isFinite(resultado.cac) ? fmtMoeda(resultado.cac, 2) : '—'} />
                    <Par label={t('roi.calc.faturamentoAlvo')} valor={fmtMoeda(resultado.faturamento)} />
                  </>
                )}
              </div>
            </div>
          )}
        </Bloco>

        {/* Distribuição da verba entre os canais */}
        <Bloco icon={PieChart} titulo={t('hub.resumoCliente.distribuicao')} acao={<LinkModulo onClick={() => onNavigate('campaign')}>{t('hub.resumoCliente.abrir')}</LinkModulo>}>
          {!dist ? (
            <p className="text-sm text-rl-subtle">{t('hub.resumoCliente.semDistribuicao')}</p>
          ) : (
            <>
              <div className="flex h-2.5 rounded-full overflow-hidden bg-rl-surface mb-3" role="img" aria-label={dist.canais.map((c) => `${c.nome} ${fmtPct(c.pct)}`).join(', ')}>
                {dist.canais.map((c) => <div key={c.nome} style={{ width: `${c.pct}%`, background: c.cor, minWidth: 3 }} />)}
              </div>
              <div className="space-y-1.5">
                {dist.canais.map((c) => (
                  <div key={c.nome} className="flex items-center gap-2 text-sm">
                    {c.logo ? <img src={c.logo} alt="" className="w-4 h-4 shrink-0" /> : <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.cor }} />}
                    <span className="text-rl-text flex-1 min-w-0 truncate">{c.nome}</span>
                    <span className="text-xs text-rl-muted tabular-nums">{fmtPct(c.pct)}</span>
                    <span className="font-semibold text-rl-text tabular-nums w-24 text-right">{dist.total ? fmtMoeda(c.valor) : '—'}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-rl-muted mt-2.5">
                {t('hub.resumoCliente.distribuicaoRodape', { valor: fmtMoeda(dist.total) })}
                {midia > 0 && Math.round(dist.total) !== Math.round(midia) ? ` ${t('hub.resumoCliente.divergeRoi', { valor: fmtMoeda(midia) })}` : ''}
              </p>
            </>
          )}
        </Bloco>
      </div>

      {/* Observações */}
      <Bloco
        icon={StickyNote}
        titulo={t('hub.info.observacoes')}
        acao={!editandoObs && (
          <button onClick={() => { setRascunhoObs(project.observacoes || ''); setEditandoObs(true) }} className="flex items-center gap-1 text-[11px] text-rl-muted hover:text-rl-purple shrink-0">
            <Pencil className="w-3 h-3" /> {t('comum.editar')}
          </button>
        )}
      >
        {editandoObs ? (
          <div>
            <ObservacoesEditor value={rascunhoObs} onChange={(e) => setRascunhoObs(e.target.value)} rows={5} placeholder={t('hub.resumoCliente.obsPlaceholder')} />
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => setEditandoObs(false)} disabled={salvandoObs} className="px-3 py-1.5 rounded-lg text-xs text-rl-muted hover:text-rl-text hover:bg-rl-surface">{t('comum.cancelar')}</button>
              <button onClick={salvarObs} disabled={salvandoObs} className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5">
                {salvandoObs && <Loader2 className="w-3 h-3 animate-spin" />} {t('comum.salvar')}
              </button>
            </div>
          </div>
        ) : project.observacoes ? (
          <ObservacoesLeitura texto={project.observacoes} />
        ) : (
          <button onClick={() => { setRascunhoObs(''); setEditandoObs(true) }} className="text-sm text-rl-subtle hover:text-rl-purple text-left">
            {t('hub.resumoCliente.semObs')}
          </button>
        )}
      </Bloco>
    </div>
  )
}
