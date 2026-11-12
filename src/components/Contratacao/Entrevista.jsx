import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Loader2, Check, Coffee, ListChecks, Sparkles, Trophy, Eye, FileText, Sparkle, CircleSlash, ArrowRight, ArrowLeft,
  CheckCircle2, AlertTriangle,
} from 'lucide-react'
import { calcularResultado, cargoPorId, NOTAS, NIVEL_COR } from '../../lib/contratacao'
import { atualizarCandidato, atualizarEntrevista, buscarEntrevista, abrirCurriculo } from './data'
import { COR, Pagina, NivelBadge, MedidorNivel, fmtData } from './ui'
import ResultadoPainel, { Selos } from './ResultadoPainel'
import ResumoIA from './ResumoIA'

const ETAPAS = [
  { id: 'aquecimento', rotulo: 'Aquecimento', Icon: Coffee },
  { id: 'atividades', rotulo: 'Atividades', Icon: ListChecks },
  { id: 'ia', rotulo: 'Transcrição e IA', Icon: Sparkles },
  { id: 'resultado', rotulo: 'Resultado', Icon: Trophy },
]

const NOTA_COR = ['red', 'gold', 'cyan', 'green']

/** Peso como bolinhas (●●○). */
function Peso({ valor }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={`Peso ${valor}`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={`w-1.5 h-1.5 rounded-full ${i <= valor ? 'bg-rl-purple' : 'bg-rl-border'}`} />
      ))}
    </span>
  )
}

function PerguntaCard({ p, indice, resposta, notaIA, onNota, onObs }) {
  const nota = resposta?.nota
  const respondida = typeof nota === 'number'
  return (
    <article id={`p-${p.id}`} className={`glass-card p-5 space-y-4 transition-all ${respondida ? `border ${COR[NOTA_COR[nota]].borda}` : ''}`}>
      <header className="flex items-start gap-3">
        <span className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-sm font-black ${respondida ? `${COR[NOTA_COR[nota]].bg} ${COR[NOTA_COR[nota]].txt}` : 'bg-rl-surface text-rl-muted'}`}>
          {respondida ? <Check className="w-4 h-4" /> : indice + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-rl-muted">{p.atividade}</span>
            <Peso valor={p.peso} />
            {p.portaoSenior && <span className="text-[10px] font-semibold text-rl-green">conta para Sênior</span>}
            {p.sugerida && <span className="text-[10px] font-semibold text-rl-purple">sugerida pelo playbook</span>}
          </div>
          <h3 className="text-base font-bold text-rl-text mt-1">“{p.pergunta}”</h3>
          <p className="text-xs text-rl-subtle mt-1 flex items-start gap-1.5"><Eye className="w-3.5 h-3.5 mt-0.5 shrink-0" />{p.observar}</p>
        </div>
      </header>

      {/* Checklist: uma linha por nível, uma escolha só (clicar de novo desmarca). */}
      <div role="radiogroup" aria-label="Nota da resposta" className="rounded-xl border border-rl-border divide-y divide-rl-border/70 overflow-hidden">
        {NOTAS.map((n) => {
          const ativo = nota === n.valor
          const c = COR[NOTA_COR[n.valor]]
          return (
            <button key={n.valor} type="button" role="radio" aria-checked={ativo} onClick={() => onNota(ativo ? null : n.valor)}
              className={`w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors ${ativo ? c.bg : 'hover:bg-rl-surface/60'}`}>
              <span className={`mt-0.5 w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-all ${ativo ? `${c.solido} border-transparent text-white` : 'border-rl-border bg-rl-card'}`}>
                {ativo && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
              </span>
              <span className="flex-1 min-w-0 text-sm leading-snug">
                <span className={`font-bold ${ativo ? c.txt : 'text-rl-text'}`}>{n.valor} · {n.rotulo}</span>
                <span className={`ml-2 ${ativo ? 'text-rl-text' : 'text-rl-subtle'}`}>{p.regua[n.valor]}</span>
              </span>
              {notaIA === n.valor && (
                <span className="mt-0.5 shrink-0 inline-flex items-center gap-0.5 text-[10px] font-semibold text-rl-purple" title="Nota que a IA daria pela transcrição">
                  <Sparkle className="w-3 h-3" /> IA
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex items-start gap-2">
        <textarea
          className="input-field min-h-[60px] text-sm flex-1"
          placeholder="Anotações: o que ele mostrou, números, exemplos..."
          value={resposta?.obs || ''}
          onChange={(e) => onObs(e.target.value)}
        />
        {respondida && (
          <button type="button" onClick={() => onNota(null)} title="Não perguntei / limpar nota"
            className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface">
            <CircleSlash className="w-4 h-4" />
          </button>
        )}
      </div>
    </article>
  )
}

/** /contratacao/:cargo/entrevista/:id: o roteiro gamificado. */
export default function Entrevista({ cargoId, entrevistaId, showToast }) {
  const navigate = useNavigate()
  const cargo = cargoPorId(cargoId)
  const [ent, setEnt] = useState(null)
  const [cand, setCand] = useState(null)
  const [erro, setErro] = useState(null)
  const [etapa, setEtapa] = useState('aquecimento')
  const [salvo, setSalvo] = useState('ok') // ok | salvando | erro
  const [ganho, setGanho] = useState(null) // "+N" que aparece ao lado da pontuação
  const timer = useRef(null)
  const pendente = useRef({})
  const ultimaPont = useRef(null)

  useEffect(() => {
    buscarEntrevista(entrevistaId)
      .then((e) => {
        const { contratacao_candidatos: c, ...resto } = e
        setEnt(resto)
        setCand(c)
        if (resto.finalizada) setEtapa('resultado')
      })
      .catch((err) => setErro(err.message))
  }, [entrevistaId])

  const resultado = useMemo(() => (ent && cargo ? calcularResultado(cargo, ent.respostas) : null), [ent, cargo])

  // "+N pontos" quando a pontuação sobe.
  useEffect(() => {
    if (!resultado) return
    const antes = ultimaPont.current
    ultimaPont.current = resultado.pontuacao
    if (antes == null || resultado.pontuacao === antes) return
    setGanho(resultado.pontuacao - antes)
    const t = setTimeout(() => setGanho(null), 1400)
    return () => clearTimeout(t)
  }, [resultado])

  const gravar = useCallback(async () => {
    const patch = pendente.current
    pendente.current = {}
    if (!Object.keys(patch).length) return
    setSalvo('salvando')
    try {
      await atualizarEntrevista(entrevistaId, patch)
      setSalvo('ok')
    } catch {
      setSalvo('erro')
    }
  }, [entrevistaId])

  useEffect(() => () => { clearTimeout(timer.current); gravar() }, [gravar])

  // Aplica no estado e agenda a gravação (pontuação e nível vão junto, sempre recalculados).
  const mudar = useCallback((fn) => {
    setEnt((atual) => {
      const novo = fn(atual)
      const r = calcularResultado(cargo, novo.respostas)
      pendente.current = {
        ...pendente.current,
        respostas: novo.respostas,
        contexto: novo.contexto,
        pontuacao: r.pontuacao,
        nivel: r.respondidas ? r.nivel : null,
        detalhe: { porCompetencia: r.porCompetencia.map(({ id, media, selo }) => ({ id, media, selo })), faltou: r.faltou, portoes: r.portoes },
      }
      return novo
    })
    setSalvo('salvando')
    clearTimeout(timer.current)
    timer.current = setTimeout(gravar, 700)
  }, [cargo, gravar])

  const setResposta = (id, campo, valor) =>
    mudar((e) => ({ ...e, respostas: { ...e.respostas, [id]: { ...(e.respostas?.[id] || {}), [campo]: valor } } }))
  const setContexto = (campo, valor) => mudar((e) => ({ ...e, contexto: { ...(e.contexto || {}), [campo]: valor } }))
  const setAlerta = (id, valor) => mudar((e) => ({ ...e, contexto: { ...(e.contexto || {}), alertas: { ...(e.contexto?.alertas || {}), [id]: valor } } }))

  // Patch direto (usado pelo bloco da IA): grava na hora.
  const salvarDireto = async (patch) => {
    setEnt((e) => ({ ...e, ...patch }))
    try { await atualizarEntrevista(entrevistaId, patch) } catch (err) { showToast(err.message, 'error') }
  }

  const aplicarNotasIA = (notas, substituir) => {
    mudar((e) => {
      const respostas = { ...(e.respostas || {}) }
      for (const p of cargo.perguntas) {
        const n = notas[p.id]
        if (typeof n !== 'number') continue
        if (!substituir && typeof respostas[p.id]?.nota === 'number') continue
        respostas[p.id] = { ...(respostas[p.id] || {}), nota: n }
      }
      return { ...e, respostas }
    })
    showToast('Notas da IA aplicadas.')
  }

  async function finalizar() {
    clearTimeout(timer.current)
    await gravar()
    try {
      await atualizarEntrevista(entrevistaId, { finalizada: true })
      setEnt((e) => ({ ...e, finalizada: true }))
      showToast('Entrevista salva no banco de talentos.')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  async function reabrir() {
    await atualizarEntrevista(entrevistaId, { finalizada: false })
    setEnt((e) => ({ ...e, finalizada: false }))
  }

  async function mudarStatus(status) {
    try {
      const c = await atualizarCandidato(cand.id, { status })
      setCand(c)
    } catch (err) { showToast(err.message, 'error') }
  }

  if (erro) return <Pagina titulo={erro} migalhas={[{ rotulo: 'Contratação', to: '/contratacao' }]} />
  if (!ent || !cargo) return <div className="flex-1 flex justify-center py-24 text-rl-muted"><Loader2 className="w-5 h-5 animate-spin" /></div>

  const idxEtapa = ETAPAS.findIndex((x) => x.id === etapa)
  const ctx = ent.contexto || {}
  const corNivel = COR[NIVEL_COR[resultado.nivel]] || COR.muted
  const notasIA = ent.sugestao_ia?.notas || {}

  return (
    <Pagina
      largura="max-w-5xl"
      migalhas={[
        { rotulo: 'Contratação', to: '/contratacao' },
        { rotulo: cargo.nome, to: `/contratacao/${cargo.id}` },
        { rotulo: cand.nome, to: `/contratacao/${cargo.id}/candidato/${cand.id}` },
        { rotulo: `Entrevista de ${fmtData(ent.data)}` },
      ]}
    >
      {/* Placar fixo: pontuação ao vivo, nível, progresso e selos */}
      <div className="sticky top-14 lg:top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-rl-bg/90 backdrop-blur-xl border-b border-rl-border/60">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-rl-text truncate">{cand.nome}</h2>
              {cand.curriculo_path && (
                <button type="button" onClick={() => abrirCurriculo(cand)} className="text-rl-muted hover:text-rl-purple" title={`Abrir currículo (${cand.curriculo_nome})`}>
                  <FileText className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-[11px] text-rl-muted">
              {resultado.respondidas}/{resultado.total} atividades ·{' '}
              {salvo === 'salvando' ? 'salvando...' : salvo === 'erro' ? <span className="text-rl-red">erro ao salvar</span> : 'salvo'}
              {ent.finalizada && ' · finalizada'}
            </p>
          </div>
          <div className="flex-1 min-w-[160px]">
            <MedidorNivel pontuacao={resultado.pontuacao} regua={cargo.regua} nivel={resultado.nivel} compacto />
            <div className="mt-2 hidden md:block"><Selos porCompetencia={resultado.porCompetencia} compacto /></div>
          </div>
          <div className="relative text-right">
            <div className={`text-3xl font-black tabular-nums leading-none ${corNivel.txt}`}>{resultado.pontuacao}</div>
            <div className="mt-1"><NivelBadge nivel={resultado.respondidas ? resultado.nivel : null} /></div>
            {ganho != null && (
              <span className={`absolute -top-3 -left-8 text-xs font-black animate-bounce ${ganho > 0 ? 'text-rl-green' : 'text-rl-red'}`}>
                {ganho > 0 ? `+${ganho}` : ganho}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1 mt-3 overflow-x-auto">
          {ETAPAS.map((e, i) => (
            <button key={e.id} type="button" onClick={() => setEtapa(e.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${etapa === e.id ? 'bg-rl-purple text-white' : i < idxEtapa ? 'text-rl-text hover:bg-rl-surface' : 'text-rl-muted hover:bg-rl-surface'}`}>
              <e.Icon className="w-3.5 h-3.5" /> {e.rotulo}
            </button>
          ))}
        </div>
      </div>

      {etapa === 'aquecimento' && (
        <div className="space-y-4">
          <p className="text-sm text-rl-subtle">Perguntas gerais para abrir a conversa. Não valem pontos, mas ficam no perfil e a IA usa como contexto.</p>
          {cargo.aquecimento.map((a, i) => (
            <article key={a.id} className="glass-card p-5 space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-rl-muted">Dúvida geral {i + 1}</span>
              <h3 className="text-base font-bold text-rl-text">“{a.pergunta}”</h3>
              <p className="text-xs text-rl-subtle flex items-start gap-1.5"><Eye className="w-3.5 h-3.5 mt-0.5 shrink-0" />{a.observar}</p>
              <textarea className="input-field min-h-[70px] text-sm" value={ctx[a.id] || ''} onChange={(e) => setContexto(a.id, e.target.value)} placeholder="Anotações" />
            </article>
          ))}
          <section className="glass-card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cargo.camposContexto.map((c) => (
              <label key={c.id}>
                <span className="label-field">{c.rotulo}</span>
                {c.tipo === 'opcoes' ? (
                  <select className="input-field" value={ctx[c.id] || ''} onChange={(e) => setContexto(c.id, e.target.value)}>
                    <option value="">-</option>
                    {c.opcoes.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input className="input-field" inputMode="numeric" value={ctx[c.id] ?? ''} onChange={(e) => setContexto(c.id, e.target.value.replace(/[^\d]/g, ''))} />
                )}
              </label>
            ))}
          </section>
          <div className="flex justify-end">
            <button type="button" onClick={() => { setEtapa('atividades'); window.scrollTo({ top: 0 }) }} className="btn-primary text-sm inline-flex items-center gap-2">
              Ir para as atividades <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {etapa === 'atividades' && (
        <div className="space-y-4">
          <p className="text-sm text-rl-subtle">
            Faça a pergunta, ouça e clique na régua que mais parece com a resposta. Clicar de novo tira a nota (pergunta que você pulou não entra na média).
          </p>
          {cargo.perguntas.map((p, i) => (
            <PerguntaCard
              key={p.id}
              p={p}
              indice={i}
              resposta={ent.respostas?.[p.id]}
              notaIA={notasIA[p.id]}
              onNota={(v) => setResposta(p.id, 'nota', v)}
              onObs={(v) => setResposta(p.id, 'obs', v)}
            />
          ))}
          <section className="glass-card p-5 space-y-3">
            <h3 className="text-sm font-bold text-rl-text flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-rl-red" /> Sinais de alerta</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {cargo.sinaisAlerta.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm text-rl-subtle cursor-pointer">
                  <input type="checkbox" checked={!!ctx.alertas?.[s.id]} onChange={(e) => setAlerta(s.id, e.target.checked)} className="accent-rl-red" />
                  {s.rotulo}
                </label>
              ))}
            </div>
          </section>
          <div className="flex justify-between">
            <button type="button" onClick={() => setEtapa('aquecimento')} className="btn-ghost text-sm inline-flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Aquecimento</button>
            <button type="button" onClick={() => { setEtapa('ia'); window.scrollTo({ top: 0 }) }} className="btn-primary text-sm inline-flex items-center gap-2">
              Transcrição e IA <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {etapa === 'ia' && (
        <div className="space-y-4">
          <p className="text-sm text-rl-subtle">
            Depois da conversa, cole ou anexe a transcrição. A IA resume, mostra a nota que daria em cada atividade e sugere o nível. O resumo fica no perfil do candidato.
          </p>
          <ResumoIA
            cargo={cargo}
            candidato={cand}
            entrevista={ent}
            onSalvar={salvarDireto}
            onAplicarNotas={aplicarNotasIA}
            showToast={showToast}
          />
          <div className="flex justify-end">
            <button type="button" onClick={() => { setEtapa('resultado'); window.scrollTo({ top: 0 }) }} className="btn-primary text-sm inline-flex items-center gap-2">
              Ver resultado <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {etapa === 'resultado' && (
        <div className="space-y-4">
          <ResultadoPainel cargo={cargo} resultado={resultado} contexto={ctx} sugestaoIA={ent.sugestao_ia} />
          <section className="glass-card p-5 flex items-center gap-3 flex-wrap">
            <span className="text-sm text-rl-subtle flex-1 min-w-[200px]">
              {ent.finalizada
                ? 'Entrevista finalizada e salva no banco de talentos.'
                : 'Ao finalizar, a pontuação e o nível entram no banco de talentos.'}
            </span>
            <select className="input-field w-auto text-sm" value={cand.status} onChange={(e) => mudarStatus(e.target.value)} title="Status do candidato">
              <option value="entrevistado">Entrevistado</option>
              <option value="em_espera">Em espera</option>
              <option value="aprovado">Aprovado</option>
              <option value="contratado">Contratado</option>
              <option value="reprovado">Reprovado</option>
            </select>
            {ent.finalizada ? (
              <>
                <button type="button" onClick={reabrir} className="btn-ghost text-sm">Reabrir</button>
                <button type="button" onClick={() => navigate(`/contratacao/${cargo.id}/candidato/${cand.id}`)} className="btn-primary text-sm inline-flex items-center gap-2">
                  Ver perfil <ArrowRight className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button type="button" onClick={finalizar} disabled={!resultado.respondidas} className="btn-primary text-sm inline-flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Finalizar entrevista
              </button>
            )}
          </section>
        </div>
      )}
    </Pagina>
  )
}
