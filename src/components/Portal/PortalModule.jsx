// Renderizadores somente leitura do portal, um por módulo liberado.
// Recebem o payload já filtrado por api/portal.js (nunca o projeto inteiro).
import { useState } from 'react'
import { ExternalLink, FileText, Loader2, Star } from 'lucide-react'
import { BUSINESS_LABELS, MATURITY_LABELS } from '../../lib/constants'
import { fmtCurrency } from '../../lib/utils'
import { portalFileUrl } from '../../lib/portal'
import { CampanhasView } from '../../pages/CampanhasPublico'
import { AprovacaoView } from '../../pages/AprovacaoAnunciosPublico'
import { CriativosTool } from '../../pages/CriativosPublico'
import { QUESTIONS as PERSONA_QUESTIONS } from '../../pages/PersonaCreator'
import { QUESTIONS as PRODUTO_QUESTIONS } from '../ProdutoServicoModule'
import { TEMPLATE_SECTIONS, ACTION_AREAS } from '../MeetingMinutesModule'
import { getQuestionsFor, PILLARS_BY_ID } from '../Kickoff/KickoffQuestions'
import KickoffRadar from '../Kickoff/KickoffRadar'
import KickoffPillarBars from '../Kickoff/KickoffPillarBars'
import { STATUS_BY_ID, RESULTADO_BY_ID, APROVACAO_BY_ID } from '../Debriefing/debriefingData'
import { LP_STATUS_BY_ID } from '../LPCentral/lpCentralData'
import { hydrateOferta, DRIVER_BY_ID } from '../OfertaWizard/ofertaShared'
import { getPeriodLabel } from '../CampaignPlanner/campaignHelpers'
import PortalResultados from './PortalResultados'
import { Section, Field, Empty, Pill, Chips, Md, PreText, Details, ExtLink, fmtDate, fmtDateTime, fmtBytes } from './PortalUI'

// ─── Arquivo privado (URL assinada sob demanda) ──────────────────────────────
function FileButton({ projectId, token, bucket, path, label = 'Abrir' }) {
  const [busy, setBusy] = useState(false)
  if (!path) return null
  async function open() {
    setBusy(true)
    try {
      const { url } = await portalFileUrl(projectId, token, bucket, path)
      window.open(url, '_blank', 'noopener')
    } catch { /* sem acesso ou arquivo ausente */ } finally { setBusy(false) }
  }
  return (
    <button onClick={open} disabled={busy} className="btn-secondary inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5">
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />} {label}
    </button>
  )
}

// ─── Dados do Cliente ────────────────────────────────────────────────────────
function Dados({ data }) {
  if (!data) return <Empty />
  const people = (data.other_people || []).filter((p) => p?.name)
  return (
    <div className="space-y-4">
      <Section title="Empresa">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Empresa" value={data.company_name} />
          <Field label="Tipo de negócio" value={BUSINESS_LABELS[data.business_type] || data.business_type} />
          <Field label="Segmento" value={data.segmento} />
          <Field label="Responsável" value={data.responsible_name} />
          <Field label="Cargo" value={data.responsible_role} />
          <Field label="Maturidade digital" value={MATURITY_LABELS[data.digital_maturity] || data.digital_maturity} />
          <Field label="Time de vendas" value={data.has_sales_team === true ? 'Sim' : data.has_sales_team === false ? 'Não' : null} />
          <Field label="Cliente desde" value={fmtDate(data.created_at)} />
          <Field label="Dashboard" value={data.dashboard_url ? <ExtLink href={data.dashboard_url}>Abrir dashboard</ExtLink> : null} />
        </div>
      </Section>
      {(data.services || []).length > 0 && <Section title="Serviços contratados"><Chips items={data.services} /></Section>}
      {(data.competitors || []).length > 0 && <Section title="Concorrentes"><Chips items={data.competitors} /></Section>}
      {people.length > 0 && (
        <Section title="Outras pessoas envolvidas">
          <div className="grid sm:grid-cols-2 gap-2">
            {people.map((p, i) => <Field key={i} label={p.role || 'Contato'} value={p.name} />)}
          </div>
        </Section>
      )}
    </div>
  )
}

// ─── Kickoff ─────────────────────────────────────────────────────────────────
function Kickoff({ data }) {
  if (!data?.completedAt) return <Empty text="Kickoff ainda não concluído." />
  const questions = getQuestionsFor(data.businessType)
  const color = data.stageColor || '#7C3AED'
  return (
    <div className="space-y-4">
      <Section>
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white shrink-0" style={{ background: color }}>{Math.round(data.totalScore ?? 0)}</div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-rl-muted font-semibold">Diagnóstico inicial · {({ b2b: 'B2B', b2c: 'B2C', hibrido: 'Híbrido' })[data.businessType] || ''}</p>
            <h3 className="text-lg font-bold text-rl-text">{data.stageLabel}</h3>
            {data.stageDesc && <p className="text-sm text-rl-muted mt-1">{data.stageDesc}</p>}
            <p className="text-[11px] text-rl-muted mt-2">Concluído em {fmtDate(data.completedAt)}</p>
          </div>
        </div>
      </Section>
      <div className="grid lg:grid-cols-2 gap-4">
        <Section title="Radar dos pilares"><div className="flex justify-center"><KickoffRadar pillarScores={data.scores || {}} width={380} height={380} fillColor={color} /></div></Section>
        <Section title="Score por pilar"><KickoffPillarBars pillarScores={data.scores || {}} questions={questions} answers={data.answers || {}} /></Section>
      </div>
      {(data.nextSteps || []).length > 0 && (
        <Section title="Próximos passos recomendados">
          <ol className="space-y-3">
            {data.nextSteps.map((step, i) => {
              const pillar = data.weaknesses?.[i] ? PILLARS_BY_ID[data.weaknesses[i]] : null
              return (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-rl-purple/10 border border-rl-purple/30 text-rl-purple text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</div>
                  <div>
                    {pillar && <p className="text-[10px] uppercase tracking-wide text-rl-muted font-semibold mb-0.5">Pilar: {pillar.label}</p>}
                    <p className="text-sm text-rl-text leading-snug">{step}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        </Section>
      )}
      {data.aiAnalysis && <Section title="Análise"><Md content={data.aiAnalysis} /></Section>}
    </div>
  )
}

// ─── Produtos / Serviços ─────────────────────────────────────────────────────
function Produtos({ data }) {
  const list = data || []
  if (!list.length) return <Empty text="Nenhum produto ou serviço cadastrado." />
  return (
    <div className="space-y-4">
      {list.map((p) => {
        const answered = PRODUTO_QUESTIONS.filter((q) => p.answers?.[q.id])
        return (
          <Section key={p.id} title={p.nome || 'Sem nome'} right={<Pill>{p.tipo === 'servico' ? 'Serviço' : 'Produto'}</Pill>}>
            {p.summary && <div className="mb-4"><Md content={p.summary} /></div>}
            {answered.length > 0 && (
              <Details title="Respostas do formulário" meta={`${answered.length} perguntas`}>
                <div className="space-y-3 mt-2">
                  {answered.map((q) => (
                    <div key={q.id}>
                      <p className="text-[11px] font-semibold text-rl-muted">{q.emoji} {q.label}</p>
                      <PreText text={p.answers[q.id]} />
                    </div>
                  ))}
                </div>
              </Details>
            )}
          </Section>
        )
      })}
    </div>
  )
}

// ─── Personas ────────────────────────────────────────────────────────────────
function Personas({ data }) {
  const list = data || []
  if (!list.length) return <Empty text="Nenhuma persona publicada." />
  return (
    <div className="space-y-4">
      {list.map((p) => {
        const answered = PERSONA_QUESTIONS.filter((q) => {
          const v = p.answers?.[q.id]
          return Array.isArray(v) ? v.some(Boolean) : !!v
        })
        return (
          <Section key={p.id} title={p.name || 'Persona'}>
            {p.generatedProfile ? <PreText text={p.generatedProfile} /> : <p className="text-sm text-rl-muted">Perfil ainda não gerado.</p>}
            {answered.length > 0 && (
              <div className="mt-4">
                <Details title="Respostas do briefing" meta={`${answered.length} perguntas`} defaultOpen={!p.generatedProfile}>
                  <div className="space-y-3 mt-2">
                    {answered.map((q) => {
                      const v = p.answers[q.id]
                      const items = Array.isArray(v) ? v.filter(Boolean) : [String(v)]
                      return (
                        <div key={q.id}>
                          <p className="text-[11px] font-semibold text-rl-muted">{q.emoji} {q.label}</p>
                          <ul className="mt-1 space-y-1">{items.map((it, i) => <li key={i} className="text-sm text-rl-text flex gap-2"><span className="text-rl-purple">•</span><span>{it}</span></li>)}</ul>
                        </div>
                      )
                    })}
                  </div>
                </Details>
              </div>
            )}
          </Section>
        )
      })}
    </div>
  )
}

// ─── Oferta Matadora ─────────────────────────────────────────────────────────
function Oferta({ data }) {
  const list = data || []
  if (!list.length) return <Empty text="Nenhuma oferta publicada." />
  return (
    <div className="space-y-4">
      {list.map((raw, idx) => {
        const o = hydrateOferta(raw)
        const bonus = (o.bonus || []).filter(Boolean)
        return (
          <Section key={o.id || idx} title={o.nome || `Oferta ${idx + 1}`} subtitle={o.createdAt ? `Criada em ${fmtDate(o.createdAt)}` : null} right={raw.principal ? <Pill>Principal</Pill> : null}>
            <div className="grid sm:grid-cols-2 gap-3 mb-4">
              <Field label="Dor atual" value={o.dorAtual} />
              <Field label="Resultado dos sonhos" value={o.resultadoSonho} />
              <Field label="Núcleo da oferta" value={o.nucleo} />
              <Field label="Preço" value={o.preco} />
              <Field label="Garantia" value={o.garantia} />
              <Field label="Urgência" value={o.urgencia} />
              <Field label="Escassez" value={o.escassez} />
            </div>
            {(o.problemas || []).length > 0 && (
              <div className="mb-4">
                <p className="text-[11px] font-semibold text-rl-muted mb-1.5">Problemas que a oferta resolve</p>
                <ul className="space-y-1">{o.problemas.map((p, i) => <li key={p.id || i} className="text-sm text-rl-text flex gap-2"><span className="text-rl-purple">•</span><span>{p.texto}{DRIVER_BY_ID?.[p.driver]?.label ? <span className="text-rl-muted"> · {DRIVER_BY_ID[p.driver].label}</span> : null}</span></li>)}</ul>
              </div>
            )}
            {(o.itensStack || []).length > 0 && (
              <div className="mb-4">
                <p className="text-[11px] font-semibold text-rl-muted mb-1.5">Stack de valor</p>
                <ul className="space-y-1">{o.itensStack.map((it, i) => <li key={it.id || i} className="text-sm text-rl-text flex justify-between gap-3"><span>{it.nome}</span>{it.valor && <span className="text-rl-muted tabular-nums">{it.valor}</span>}</li>)}</ul>
              </div>
            )}
            {bonus.length > 0 && <div className="mb-4"><p className="text-[11px] font-semibold text-rl-muted mb-1.5">Bônus</p><Chips items={bonus} /></div>}
            {o.generatedOffer && <Details title="Oferta gerada" defaultOpen={idx === 0}><div className="mt-2"><Md content={o.generatedOffer} /></div></Details>}
          </Section>
        )
      })}
    </div>
  )
}

// ─── ROI ─────────────────────────────────────────────────────────────────────
function RoiBlock({ calc, result }) {
  if (!calc && !result) return null
  const r = result || {}
  const money = (v) => (v || v === 0 ? fmtCurrency(v) : null)
  const int = (v) => (v || v === 0 ? Math.ceil(v).toLocaleString('pt-BR') : null)
  return (
    <>
      {calc && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <Field label="Orçamento de mídia / mês" value={money(calc.media_orcamento ?? calc.mediaOrcamento)} />
          <Field label="Custo de marketing / mês" value={money(calc.custo_marketing ?? calc.custoMarketing)} />
          <Field label="Ticket médio" value={money(calc.ticket_medio ?? calc.ticketMedio)} />
          <Field label="Compras por cliente" value={calc.qtd_compras ?? calc.qtdCompras} />
          <Field label="Margem bruta" value={(calc.margem_bruta ?? calc.margemBruta) != null ? `${calc.margem_bruta ?? calc.margemBruta}%` : null} />
          <Field label="ROI desejado" value={(calc.roi_desejado ?? calc.roiDesejado) != null ? `${calc.roi_desejado ?? calc.roiDesejado}x` : null} />
        </div>
      )}
      {result && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Leads necessários" value={int(r.leadsNecessarios)} />
          <Field label="MQLs necessários" value={int(r.mqlsNecessarios)} />
          <Field label="SQLs necessários" value={int(r.sqlsNecessarios)} />
          <Field label="Vendas necessárias" value={int(r.vendasNecessarias)} />
          <Field label="Custo por lead" value={money(r.custoPorLead)} />
          <Field label="Custo por MQL" value={money(r.custoPorMQL)} />
          <Field label="Custo por SQL" value={money(r.custoPorSQL)} />
          <Field label="CAC" value={money(r.cac)} />
          <Field label="Investimento total" value={money(r.totalInvestimento)} />
          <Field label="Faturamento" value={money(r.faturamento)} />
          <Field label="Lucro bruto" value={money(r.lucroBruto)} />
          <Field label="Lucro líquido" value={money(r.lucroLiquido)} />
        </div>
      )}
    </>
  )
}
function Roi({ data }) {
  if (!data || (!data.calc && !data.result && !(data.cenarios || []).length)) return <Empty text="Calculadora de ROI ainda não preenchida." />
  const cenarios = (data.cenarios || []).filter((c) => c?.calc || c?.result)
  return (
    <div className="space-y-4">
      {(data.calc || data.result) && <Section title="Cenário principal"><RoiBlock calc={data.calc} result={data.result} /></Section>}
      {cenarios.slice(data.calc ? 1 : 0).map((c) => (
        <Section key={c.id} title={c.nome || 'Cenário'}><RoiBlock calc={c.calc} result={c.result} /></Section>
      ))}
    </div>
  )
}

// ─── Campanhas ───────────────────────────────────────────────────────────────
function Campanhas({ data }) {
  if (!data) return <Empty text="Nenhum planejamento de verba publicado ainda." />
  const period = getPeriodLabel(data.startDate, data.endDate)
  return (
    <div className="space-y-4">
      <Section title={data.name || 'Planejamento de verba'} subtitle={period} />
      <CampanhasView plan={data} />
    </div>
  )
}

// ─── Central de anúncios ─────────────────────────────────────────────────────
function Debriefing({ data, projectId, token }) {
  const ads = data?.ads || []
  if (!ads.length) return <Empty text="Nenhum anúncio cadastrado." />
  const sorted = [...ads].sort((a, b) => String(b.createdAt || b.addedAt || '').localeCompare(String(a.createdAt || a.addedAt || '')))
  return (
    <div className="space-y-3">
      {sorted.map((ad) => {
        const st = STATUS_BY_ID[ad.status]
        const res = RESULTADO_BY_ID[ad.resultado]
        const ap = ad.aprovacao?.status ? APROVACAO_BY_ID[ad.aprovacao.status] : null
        return (
          <Section key={ad.id}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-rl-text">{ad.nome || 'Anúncio sem nome'}</p>
                <p className="text-[11px] text-rl-muted mt-0.5">
                  {ad.tipo && <span className="capitalize">{ad.tipo}</span>}
                  {ad.createdAt && <> · {fmtDate(ad.createdAt)}</>}
                  {ad.version > 1 && <> · v{ad.version}</>}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {st && <Pill color={st.color} bg={st.bgColor}>{st.label}</Pill>}
                {ap && <Pill color={ap.color} bg={ap.bgColor}>{ap.label}</Pill>}
                {res && <Pill color={res.color} bg={res.bgColor}>{res.emoji} {res.label}</Pill>}
              </div>
            </div>
            {ad.observacao && <p className="text-sm text-rl-muted mt-2">{ad.observacao}</p>}
            {ad.copy && <div className="mt-3"><Details title="Copy"><PreText text={ad.copy} /></Details></div>}
            <div className="flex flex-wrap gap-2 mt-3">
              {ad.url && <ExtLink href={ad.url} className="btn-secondary inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 !no-underline"><ExternalLink className="w-3.5 h-3.5" /> Ver peça</ExtLink>}
              {ad.attachmentPath && <FileButton projectId={projectId} token={token} bucket="attachments" path={ad.attachmentPath} label={ad.attachmentName || 'Anexo'} />}
            </div>
          </Section>
        )
      })}
    </div>
  )
}

// ─── Central de Landing Pages ────────────────────────────────────────────────
function LPCentral({ data }) {
  const lps = data?.lps || []
  if (!lps.length) return <Empty text="Nenhuma landing page cadastrada." />
  return (
    <div className="space-y-3">
      {lps.map((lp) => {
        const st = LP_STATUS_BY_ID[lp.status]
        const ap = lp.aprovacao?.status ? APROVACAO_BY_ID[lp.aprovacao.status] : null
        return (
          <Section key={lp.id}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-rl-text">{lp.nome || 'Landing page'}</p>
                {lp.url && <ExtLink href={lp.url} className="text-xs" />}
                {lp.createdAt && <p className="text-[11px] text-rl-muted mt-0.5">{fmtDate(lp.createdAt)}</p>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {st && <Pill color={st.color} bg={st.bgColor}>{st.label}</Pill>}
                {ap && <Pill color={ap.color} bg={ap.bgColor}>{ap.label}</Pill>}
              </div>
            </div>
            {lp.observacao && <p className="text-sm text-rl-muted mt-2">{lp.observacao}</p>}
          </Section>
        )
      })}
    </div>
  )
}

// ─── Landing pages geradas (IA) ──────────────────────────────────────────────
function LandingPages({ data }) {
  const list = data || []
  if (!list.length) return <Empty text="Nenhuma landing page gerada." />
  return (
    <div className="space-y-3">
      {list.map((lp, i) => (
        <Details key={lp.id} title={lp.name || `Landing page ${i + 1}`} meta={[lp.personaName, lp.productName, lp.createdAt && fmtDate(lp.createdAt)].filter(Boolean).join(' · ')} defaultOpen={i === 0}>
          <div className="mt-2"><Md content={lp.content} /></div>
        </Details>
      ))}
    </div>
  )
}

// ─── Google Ads ──────────────────────────────────────────────────────────────
const GADS_TYPES = { marca: 'Marca / Brand', generico: 'Genérico', concorrentes: 'Concorrentes', problema: 'Problema / Dor' }
function GoogleAds({ data }) {
  const list = data || []
  if (!list.length) return <Empty text="Nenhuma campanha de Google Ads gerada." />
  return (
    <div className="space-y-3">
      {list.map((g, i) => (
        <Details key={g.id} title={`Geração ${list.length - i}`} meta={[g.createdAt && fmtDateTime(g.createdAt), (g.campaignTypes || []).map((t) => GADS_TYPES[t] || t).join(', ')].filter(Boolean).join(' · ')} defaultOpen={i === 0}>
          {(g.keywordGroups || []).length > 0 && (
            <div className="mt-2 space-y-3">
              {g.keywordGroups.map((grp, i) => (
                <div key={grp.id || i}>
                  <p className="text-[11px] font-semibold text-rl-muted mb-1">{grp.name || 'Grupo'}</p>
                  <Chips items={(grp.keywords || []).map((k) => k.keyword).filter(Boolean)} />
                </div>
              ))}
            </div>
          )}
          <div className="mt-3"><Md content={g.content} /></div>
        </Details>
      ))}
    </div>
  )
}

// ─── Lab. Meta Ads ───────────────────────────────────────────────────────────
const AUD = { remarketing: 'Remarketing', lookalike: 'Lookalike', interesses: 'Interesses' }
function MetaLab({ data }) {
  if (!data?.budget) return <Empty text="Protocolo de testes ainda não configurado." />
  const phases = [
    ['Fase 01 · Teste de criativos', 'Dias 1 a 7', 'Até 11 criativos concorrendo; seguem os 3 melhores por CPL ou CTR.'],
    ['Fase 02 · Teste de públicos', 'Dias 8 a 14', 'Cinco públicos (lookalike, interesses, quentes, regionais, demográficos); seguem os 3 melhores.'],
    ['Fase 03 · Teste de ganchos', 'Dias 15 a 21', 'Ganchos diferentes com o criativo e o público campeões.'],
  ]
  return (
    <div className="space-y-4">
      <Section title="Lab. Meta Ads">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Orçamento diário" value={fmtCurrency(data.budget)} />
          <Field label="Tipo de público" value={AUD[data.audienceType] || data.audienceType} />
        </div>
      </Section>
      <div className="grid md:grid-cols-3 gap-3">
        {phases.map(([t, d, desc]) => (
          <Section key={t}><p className="text-sm font-semibold text-rl-text">{t}</p><p className="text-[11px] text-rl-muted">{d}</p><p className="text-sm text-rl-text mt-2">{desc}</p></Section>
        ))}
      </div>
    </div>
  )
}

// ─── Estratégia ──────────────────────────────────────────────────────────────
const SWOT = [['forcas', 'Forças', 'text-rl-green'], ['fraquezas', 'Fraquezas', 'text-red-400'], ['oportunidades', 'Oportunidades', 'text-rl-blue'], ['ameacas', 'Ameaças', 'text-rl-gold']]
const NIVEL = { baixo: 'Baixo', medio: 'Médio', alto: 'Alto' }
function Estrategia({ data }) {
  if (!data) return <Empty text="Estratégia ainda não publicada." />
  const problemas = data.problemas || []
  const swot = data.swot || {}
  const showSwot = !swot.oculto && SWOT.some(([k]) => swot[k])
  const concorrentes = data.concorrentes || []
  const riscos = data.riscos || []
  const funis = data.funis || []
  if (!problemas.length && !showSwot && !concorrentes.length && !riscos.length && !funis.length) return <Empty text="Estratégia ainda não publicada." />
  return (
    <div className="space-y-4">
      {problemas.length > 0 && <Section title="Problemas identificados"><ol className="space-y-1.5">{problemas.map((p, i) => <li key={i} className="text-sm text-rl-text flex gap-2"><span className="text-rl-purple font-semibold">{i + 1}.</span><span>{p}</span></li>)}</ol></Section>}
      {showSwot && (
        <Section title="Análise SWOT">
          <div className="grid sm:grid-cols-2 gap-3">
            {SWOT.map(([k, label, cls]) => swot[k] ? <div key={k} className="rounded-xl bg-rl-surface p-3"><p className={`text-[11px] font-semibold ${cls} mb-1`}>{label}</p><PreText text={swot[k]} /></div> : null)}
          </div>
        </Section>
      )}
      {concorrentes.length > 0 && (
        <Section title="Concorrentes">
          <div className="space-y-3">
            {concorrentes.map((c, i) => (
              <div key={c.id || i} className="rounded-xl bg-rl-surface p-3">
                <p className="text-sm font-semibold text-rl-text">{c.nome || `Concorrente ${i + 1}`}</p>
                {c.grandePromessa && <p className="text-sm text-rl-text mt-1">{c.grandePromessa}</p>}
                <div className="flex flex-wrap gap-3 mt-1.5 text-xs">
                  {c.linkSite && <ExtLink href={c.linkSite}>Site</ExtLink>}
                  {c.linkInstagram && <ExtLink href={c.linkInstagram}>Instagram</ExtLink>}
                  {c.linkBiblioteca && <ExtLink href={c.linkBiblioteca}>Biblioteca de anúncios</ExtLink>}
                </div>
                {c.metaAds && <div className="mt-2"><PreText text={c.metaAds} /></div>}
              </div>
            ))}
          </div>
        </Section>
      )}
      {riscos.length > 0 && (
        <Section title="Riscos">
          <div className="space-y-2">
            {riscos.map((r, i) => (
              <div key={r.id || i} className="rounded-xl bg-rl-surface p-3 flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="text-sm font-medium text-rl-text">{r.problema}</p>{r.riscoGerado && <p className="text-sm text-rl-muted mt-0.5">{r.riscoGerado}</p>}{r.impacto && <p className="text-xs text-rl-muted mt-0.5">Impacto: {r.impacto}</p>}</div>
                {r.nivel && <Pill>{NIVEL[r.nivel] || r.nivel}</Pill>}
              </div>
            ))}
          </div>
        </Section>
      )}
      {funis.length > 0 && <Section title="Funis"><Chips items={funis} /></Section>}
    </div>
  )
}

// ─── NPS ─────────────────────────────────────────────────────────────────────
function npsScore(resps) {
  const scored = resps.filter((r) => typeof r.score === 'number')
  if (!scored.length) return null
  const prom = scored.filter((r) => r.score >= 9).length
  const det  = scored.filter((r) => r.score <= 6).length
  return Math.round(((prom - det) / scored.length) * 100)
}
function Nps({ data }) {
  const marcos = data || []
  const withResp = marcos.filter((m) => (m.respostas || []).length)
  if (!withResp.length) return <Empty text="Nenhuma resposta de NPS ainda." />
  return (
    <div className="space-y-4">
      {withResp.map((m) => {
        const score = npsScore(m.respostas)
        return (
          <Section key={m.id} title={m.label} subtitle={m.descricao} right={score !== null ? <div className="text-right"><p className="text-[10px] uppercase tracking-wider text-rl-muted">NPS</p><p className={`text-xl font-bold ${score >= 50 ? 'text-rl-green' : score >= 0 ? 'text-rl-gold' : 'text-red-400'}`}>{score}</p></div> : null}>
            <div className="space-y-2">
              {m.respostas.map((r) => (
                <div key={r.id} className="rounded-xl bg-rl-surface p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-rl-text">{r.name || 'Anônimo'}</p>
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-rl-text"><Star className="w-3.5 h-3.5 text-rl-gold" />{r.score}</span>
                  </div>
                  {r.q2 && <p className="text-sm text-rl-text mt-1">{r.q2}</p>}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {r.q3 && <Pill>Comunicação: {r.q3}</Pill>}
                    {r.q4 && <Pill>Resultados: {r.q4}</Pill>}
                    {r.q5 && <Pill>Transparência: {r.q5}</Pill>}
                  </div>
                  {r.q6 && <p className="text-xs text-rl-muted mt-2">{r.q6}</p>}
                  {r.submittedAt && <p className="text-[10px] text-rl-muted mt-1">{fmtDateTime(r.submittedAt)}</p>}
                </div>
              ))}
            </div>
          </Section>
        )
      })}
    </div>
  )
}

// ─── Atas ────────────────────────────────────────────────────────────────────
function Atas({ data }) {
  const list = data || []
  if (!list.length) return <Empty text="Nenhuma ata publicada." />
  return (
    <div className="space-y-3">
      {list.map((a, i) => {
        const tpl = a.template || {}
        const actions = a.next_actions || []
        return (
          <Details key={a.id} title={a.title || 'Ata de reunião'} meta={[a.meeting_date && fmtDate(a.meeting_date), (a.attendees || []).length ? `${a.attendees.length} participantes` : null].filter(Boolean).join(' · ')} defaultOpen={i === 0}>
            <div className="space-y-4 mt-2">
              {(a.attendees || []).length > 0 && <Chips items={a.attendees} />}
              {TEMPLATE_SECTIONS.filter((s) => tpl[s.id]).map((s) => (
                <div key={s.id}><p className={`text-[11px] font-semibold ${s.color || 'text-rl-muted'} mb-1`}>{s.title}</p><PreText text={tpl[s.id]} /></div>
              ))}
              {actions.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-rl-muted mb-1.5">Próximas ações</p>
                  <ul className="space-y-1.5">
                    {actions.map((ac, i) => {
                      const area = ACTION_AREAS.find((x) => x.value === ac.area)
                      return (
                        <li key={ac.id || i} className={`text-sm flex items-start gap-2 ${ac.done ? 'line-through text-rl-muted' : 'text-rl-text'}`}>
                          <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${ac.done ? 'bg-rl-green' : 'bg-rl-gold'}`} />
                          <span>{ac.title}{ac.owner && <span className="text-rl-muted"> · {ac.owner}</span>}{ac.due_date && <span className="text-rl-muted"> · {fmtDate(ac.due_date)}</span>}{area && <span className="text-rl-muted"> · {area.label}</span>}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
              {a.notes && <div><p className="text-[11px] font-semibold text-rl-muted mb-1">Observações</p><PreText text={a.notes} /></div>}
              {a.recording_url && <ExtLink href={a.recording_url} className="text-xs">Gravação da reunião</ExtLink>}
            </div>
          </Details>
        )
      })}
    </div>
  )
}

// ─── Links ───────────────────────────────────────────────────────────────────
function Links({ data }) {
  const l = data || {}
  const fixed = [['Instagram', l.instagram], ['Website', l.website], ['Google Drive', l.googleDrive]].filter(([, u]) => u)
  const outros = (l.outros || []).filter((o) => o?.url)
  if (!fixed.length && !outros.length) return <Empty text="Nenhum link cadastrado." />
  return (
    <Section title="Links importantes">
      <div className="grid sm:grid-cols-2 gap-2">
        {[...fixed, ...outros.map((o) => [o.label || o.url, o.url])].map(([label, url], i) => (
          <a key={i} href={/^https?:\/\//i.test(url) ? url : `https://${url}`} target="_blank" rel="noreferrer" className="rounded-xl bg-rl-surface p-3 hover:bg-rl-bg transition-colors flex items-center gap-3">
            <ExternalLink className="w-4 h-4 text-rl-cyan shrink-0" />
            <div className="min-w-0"><p className="text-sm font-medium text-rl-text truncate">{label}</p><p className="text-[11px] text-rl-muted truncate">{url}</p></div>
          </a>
        ))}
      </div>
    </Section>
  )
}

// ─── Anexos ──────────────────────────────────────────────────────────────────
function Anexos({ data, projectId, token }) {
  const list = data || []
  if (!list.length) return <Empty text="Nenhum anexo publicado." />
  return (
    <Section title="Anexos">
      <div className="divide-y divide-rl-border/60">
        {list.map((a) => (
          <div key={a.id} className="py-2.5 flex items-center gap-3">
            <FileText className="w-4 h-4 text-rl-muted shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-rl-text truncate">{a.name}</p>
              <p className="text-[11px] text-rl-muted">{[fmtBytes(a.size), (a.uploaded_at || a.uploadedAt) && fmtDate(a.uploaded_at || a.uploadedAt)].filter(Boolean).join(' · ')}</p>
            </div>
            <FileButton projectId={projectId} token={token} bucket="attachments" path={a.storage_path} />
          </div>
        ))}
      </div>
    </Section>
  )
}

// ─── Interativos (usam a sessão do portal nas próprias APIs) ─────────────────
function Aprovacao({ projectId, token, level }) {
  return <AprovacaoView auth={{ portal: token, projectId }} readOnly={level !== 'edit'} embedded />
}
function Criativos({ projectId, token }) {
  return <CriativosTool auth={{ projectId, portal: token }} embedded />
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────
const RENDERERS = {
  dados: Dados, kickoff: Kickoff, produtos: Produtos, icp: Personas, oferta: Oferta, roi: Roi,
  campaign: Campanhas, debriefing: Debriefing, lpcentral: LPCentral, landingpage: LandingPages,
  googleads: GoogleAds, metalab: MetaLab, estrategiav2: Estrategia, resultados: PortalResultados,
  nps: Nps, atas: Atas, links: Links, anexos: Anexos,
  aprovacao: Aprovacao, criativos: Criativos,
}

export default function PortalModule({ moduleId, label, data, projectId, token, level }) {
  const R = RENDERERS[moduleId]
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-rl-text px-1">{label}</h2>
      {R ? <R data={data} projectId={projectId} token={token} level={level} /> : <Empty text="Módulo indisponível no portal." />}
    </div>
  )
}
