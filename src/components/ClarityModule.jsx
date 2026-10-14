import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCw, Plug, Unplug, MousePointerClick, AlertTriangle, ScrollText, Timer, Users, Activity } from 'lucide-react'
import { apiFetch } from '../lib/api'
import { linhasDoSnapshot, agrupar, totalGeral, porPagina, porAnuncio, porCampanha, fmtSeg } from '../lib/clarity'

const fmtInt = (n) => Number(n || 0).toLocaleString('pt-BR')
const fmtPct = (n) => (n == null ? '–' : `${n.toFixed(n < 10 ? 1 : 0).replace('.', ',')}%`)
const fmtDia = (d) => d.split('-').reverse().slice(0, 2).join('/')

// Cor do scroll médio: quanto da página o visitante realmente leu.
const corScroll = (v) => (v == null ? '' : v >= 60 ? 'text-rl-green' : v >= 30 ? 'text-rl-gold' : 'text-rl-red')
const corFrustracao = (v) => (v == null ? '' : v >= 8 ? 'text-rl-red' : v >= 3 ? 'text-rl-gold' : 'text-rl-subtle')

function Kpi({ icon: Icon, label, valor, cor = '' }) {
  return (
    <div className="glass-card border border-rl-border/60 p-4">
      <div className="flex items-center gap-1.5 text-[11px] text-rl-muted"><Icon className="w-3.5 h-3.5" />{label}</div>
      <div className={`text-2xl font-bold tabular-nums mt-1 ${cor || 'text-rl-text'}`}>{valor}</div>
    </div>
  )
}

const VISOES = [
  { id: 'anuncio', label: 'Por anúncio', dim: 'url', col: 'utm_content (ID do anúncio)', fn: porAnuncio },
  { id: 'campanha', label: 'Por campanha', dim: 'url', col: 'utm_campaign (ID)', fn: porCampanha },
  { id: 'pagina', label: 'Por página', dim: 'url', col: 'Página', fn: porPagina },
  { id: 'device', label: 'Dispositivo', dim: 'device', col: 'Dispositivo', fn: (k) => k || '(n/d)' },
  { id: 'origem', label: 'Origem', dim: 'origem', col: 'Origem | Mídia', fn: (k) => k || '(direto)' },
]

function Conectar({ projectId, onConectado }) {
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState('')

  async function conectar() {
    setBusy(true); setErro('')
    try {
      onConectado(await apiFetch('/api/clarity', { body: { action: 'conectar', project_id: projectId, token } }))
    } catch (e) { setErro(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="glass-card border border-rl-border/60 p-6 max-w-2xl space-y-4">
      <div className="flex items-center gap-2 font-semibold text-rl-text"><Plug className="w-4 h-4 text-rl-purple" /> Conectar o Microsoft Clarity</div>
      <p className="text-sm text-rl-subtle">
        No Clarity do cliente: <b>Settings → Data Export → Generate new API token</b>. Cole o token abaixo.
        Ele fica guardado só no servidor e nunca volta para a tela. O Clarity libera 10 consultas por dia,
        então a Área do Cliente guarda uma foto diária e mostra a partir dela.
      </p>
      <textarea
        value={token} onChange={(e) => setToken(e.target.value)} rows={3} placeholder="Token da API do Clarity"
        className="w-full bg-rl-surface border border-rl-border rounded-xl px-3 py-2 text-xs font-mono text-rl-text"
      />
      {erro && <div className="text-sm text-rl-red flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" />{erro}</div>}
      <button onClick={conectar} disabled={busy || token.trim().length < 40} className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />} Conectar e puxar dados
      </button>
    </div>
  )
}

export default function ClarityModule({ project }) {
  const projectId = project.id
  const [estado, setEstado] = useState(null)
  const [erro, setErro] = useState('')
  const [busy, setBusy] = useState(false)
  const [visao, setVisao] = useState('anuncio')
  const [dia, setDia] = useState(null)

  const carregar = useCallback(async () => {
    try { setEstado(await apiFetch(`/api/clarity?project_id=${projectId}`)) } catch (e) { setErro(e.message) }
  }, [projectId])
  useEffect(() => { carregar() }, [carregar])

  const snaps = useMemo(() => estado?.snapshots || [], [estado])
  const dias = useMemo(() => [...new Set(snaps.map((s) => s.dia))].sort().reverse(), [snaps])
  const diaAtivo = dia && dias.includes(dia) ? dia : dias[0]
  const snapDe = (dim, d = diaAtivo) => snaps.find((s) => s.dia === d && s.dimensao === dim)

  const v = VISOES.find((x) => x.id === visao)
  const snapVisao = snapDe(v.dim)
  const linhasUrl = useMemo(() => (snapDe('url') ? linhasDoSnapshot(snapDe('url').dados) : null), [snaps, diaAtivo]) // eslint-disable-line react-hooks/exhaustive-deps
  const tot = linhasUrl ? totalGeral(linhasUrl) : null
  const tabela = useMemo(() => (snapVisao ? agrupar(linhasDoSnapshot(snapVisao.dados), v.fn) : []), [snapVisao, visao]) // eslint-disable-line react-hooks/exhaustive-deps

  const evolucao = useMemo(() => dias.slice(0, 14).reverse().map((d) => {
    const s = snapDe('url', d)
    const t = s ? totalGeral(linhasDoSnapshot(s.dados)) : null
    return { dia: d, sessoes: t?.sessoes || 0, scroll: t?.scroll }
  }), [snaps]) // eslint-disable-line react-hooks/exhaustive-deps
  const maxSessoes = Math.max(1, ...evolucao.map((e) => e.sessoes))

  async function acao(action) {
    setBusy(true); setErro('')
    try { setEstado(await apiFetch('/api/clarity', { body: { action, project_id: projectId } })) } catch (e) { setErro(e.message) } finally { setBusy(false) }
  }

  if (!estado && !erro) return <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-rl-subtle" /></div>
  if (estado && !estado.conectado) return <Conectar projectId={projectId} onConectado={setEstado} />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <div className="font-semibold text-rl-text flex items-center gap-2"><MousePointerClick className="w-4 h-4 text-rl-purple" /> Comportamento na LP (Clarity)</div>
          <div className="text-[11px] text-rl-muted">
            Janela: últimas 24h até a coleta{estado?.ultimo_sync ? ` · atualizado ${new Date(estado.ultimo_sync).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}
            {estado?.chamadas_restantes != null ? ` · ${estado.chamadas_restantes} consultas restantes hoje` : ''}
          </div>
        </div>
        {dias.length > 0 && (
          <select value={diaAtivo} onChange={(e) => setDia(e.target.value)} className="bg-rl-surface border border-rl-border rounded-lg px-2 py-1.5 text-xs text-rl-text">
            {dias.map((d) => <option key={d} value={d}>{fmtDia(d)}</option>)}
          </select>
        )}
        <button onClick={() => acao('sync')} disabled={busy} className="btn-secondary !px-3 !py-1.5 flex items-center gap-1.5 text-xs">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Atualizar
        </button>
        <button
          onClick={() => { if (window.confirm('Desconectar o Clarity deste projeto? As fotos já gravadas continuam salvas.')) acao('desconectar') }}
          disabled={busy} title="Desconectar" className="p-1.5 rounded-lg text-rl-subtle hover:text-rl-red hover:bg-rl-surface"
        ><Unplug className="w-4 h-4" /></button>
      </div>

      {(erro || estado?.ultimo_erro) && (
        <div className="text-sm text-rl-red flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" />{erro || estado.ultimo_erro}</div>
      )}

      {!tot ? (
        <div className="glass-card border border-rl-border/60 p-6 text-sm text-rl-subtle">Ainda não há foto de URL. Clique em Atualizar.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Kpi icon={Activity} label="Sessões" valor={fmtInt(tot.sessoes)} />
            <Kpi icon={Users} label="Usuários" valor={fmtInt(tot.usuarios)} />
            <Kpi icon={ScrollText} label="Scroll médio" valor={fmtPct(tot.scroll)} cor={corScroll(tot.scroll)} />
            <Kpi icon={Timer} label="Tempo ativo médio" valor={fmtSeg(tot.tempoAtivo)} />
            <Kpi icon={MousePointerClick} label="Sessões com clique de raiva" valor={fmtPct(tot.pctRage)} cor={corFrustracao(tot.pctRage)} />
          </div>

          <div className="glass-card border border-rl-border/60 p-4">
            <div className="flex flex-wrap gap-1 mb-3">
              {VISOES.map((x) => (
                <button
                  key={x.id} onClick={() => setVisao(x.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${visao === x.id ? 'bg-rl-purple/15 text-rl-purple' : 'text-rl-subtle hover:bg-rl-surface'}`}
                >{x.label}</button>
              ))}
            </div>
            {!snapVisao ? (
              <div className="text-sm text-rl-subtle py-4">Essa visão é preenchida pela rotina diária (ainda não rodou para este dia).</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-rl-muted border-b border-rl-border/60">
                      <th className="py-2 pr-3 font-medium">{v.col}</th>
                      <th className="py-2 px-2 font-medium text-right">Sessões</th>
                      <th className="py-2 px-2 font-medium text-right">Scroll</th>
                      <th className="py-2 px-2 font-medium text-right">Tempo ativo</th>
                      <th className="py-2 px-2 font-medium text-right">Clique de raiva</th>
                      <th className="py-2 px-2 font-medium text-right">Clique morto</th>
                      <th className="py-2 pl-2 font-medium text-right">Voltou rápido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tabela.map((r) => (
                      <tr key={r.chave} className="border-b border-rl-border/30 last:border-0">
                        <td className="py-2 pr-3 text-rl-text font-mono break-all max-w-[360px]">{r.chave}</td>
                        <td className="py-2 px-2 text-right tabular-nums">{fmtInt(r.sessoes)}</td>
                        <td className={`py-2 px-2 text-right tabular-nums ${corScroll(r.scroll)}`}>{fmtPct(r.scroll)}</td>
                        <td className="py-2 px-2 text-right tabular-nums">{fmtSeg(r.tempoAtivo)}</td>
                        <td className={`py-2 px-2 text-right tabular-nums ${corFrustracao(r.pctRage)}`}>{fmtPct(r.pctRage)}</td>
                        <td className={`py-2 px-2 text-right tabular-nums ${corFrustracao(r.pctDead)}`}>{fmtPct(r.pctDead)}</td>
                        <td className={`py-2 pl-2 text-right tabular-nums ${corFrustracao(r.pctQuickback)}`}>{fmtPct(r.pctQuickback)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[11px] text-rl-muted mt-2">
                  Scroll e tempo ativo são médias ponderadas pelas sessões. Os três últimos são a % de sessões que tiveram o comportamento.
                  Amostras com poucas sessões oscilam muito.
                </p>
              </div>
            )}
          </div>

          {evolucao.length > 1 && (
            <div className="glass-card border border-rl-border/60 p-4">
              <div className="text-xs font-medium text-rl-text mb-3">Sessões por dia de coleta</div>
              <div className="flex items-end gap-1.5 h-24">
                {evolucao.map((e) => (
                  <div key={e.dia} className="flex-1 flex flex-col items-center justify-end gap-1 h-full" title={`${fmtDia(e.dia)}: ${e.sessoes} sessões · scroll ${fmtPct(e.scroll)}`}>
                    <div className="w-full rounded-t bg-rl-purple/70" style={{ height: `${Math.max(4, (e.sessoes / maxSessoes) * 100)}%` }} />
                    <span className="text-[10px] text-rl-muted">{fmtDia(e.dia)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
