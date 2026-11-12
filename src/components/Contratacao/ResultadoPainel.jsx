import { Award, Medal, AlertTriangle, Target, Wallet } from 'lucide-react'
import { NIVEL_ROTULO, NIVEL_COR, fmtBRL } from '../../lib/contratacao'
import { COR, MedidorNivel, NivelBadge } from './ui'

/** Selos por competência: cinza (bloqueado), prata (média de Pleno), ouro (média de Sênior). */
export function Selos({ porCompetencia, compacto = false }) {
  return (
    <div className={`flex flex-wrap ${compacto ? 'gap-1.5' : 'gap-2'}`}>
      {porCompetencia.map((c) => {
        const ganho = c.selo
        const classe = ganho === 'ouro'
          ? 'border-rl-gold/60 bg-rl-gold/15 text-rl-gold'
          : ganho === 'prata'
            ? 'border-rl-cyan/50 bg-rl-cyan/10 text-rl-cyan'
            : 'border-rl-border bg-rl-surface text-rl-muted opacity-60'
        return (
          <span key={c.id} title={`${c.nome}: ${c.media == null ? 'sem nota' : `média ${c.media.toFixed(1)} de 3`}`}
            className={`inline-flex items-center gap-1 rounded-full border font-semibold transition-all ${compacto ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'} ${classe}`}>
            {ganho === 'ouro' ? <Award className="w-3.5 h-3.5" /> : <Medal className="w-3.5 h-3.5" />}
            {c.seloNome}
          </span>
        )
      })}
    </div>
  )
}

/** Painel de resultado: pontuação, nível, régua, selos, o que faltou e referência salarial. */
export default function ResultadoPainel({ cargo, resultado, contexto = {}, sugestaoIA }) {
  const nivelInfo = cargo.niveis.find((n) => n.id === resultado.nivel)
  const cor = COR[NIVEL_COR[resultado.nivel]] || COR.muted
  const alertas = cargo.sinaisAlerta.filter((s) => contexto.alertas?.[s.id])
  const clientes = Number(contexto.clientes_hoje)

  return (
    <div className="space-y-4">
      <section className={`glass-card p-6 border ${cor.borda}`}>
        <div className="flex items-center gap-6 flex-wrap">
          <div className="text-center">
            <div className={`text-6xl font-black tabular-nums leading-none ${cor.txt}`}>{resultado.pontuacao}</div>
            <div className="text-[11px] text-rl-muted mt-1">de 100 pontos</div>
          </div>
          <div className="flex-1 min-w-[220px] space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-rl-muted">Encaixe sugerido</span>
              <span className={`text-2xl font-black ${cor.txt}`}>{NIVEL_ROTULO[resultado.nivel]}</span>
              {sugestaoIA?.nivel && sugestaoIA.nivel !== resultado.nivel && (
                <span className="inline-flex items-center gap-1 text-[11px] text-rl-muted">IA: <NivelBadge nivel={sugestaoIA.nivel} /></span>
              )}
            </div>
            <MedidorNivel pontuacao={resultado.pontuacao} regua={cargo.regua} nivel={resultado.nivel} />
            <p className="text-[11px] text-rl-muted pt-1">
              {resultado.respondidas} de {resultado.total} atividades avaliadas.
              Júnior a partir de {cargo.regua.junior}, Pleno {cargo.regua.pleno}, Sênior {cargo.regua.senior}, com os portões abaixo.
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-bold text-rl-text">Competências</h3>
          <ul className="space-y-2.5">
            {resultado.porCompetencia.map((c) => (
              <li key={c.id}>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-rl-subtle flex-1">{c.nome}</span>
                  {c.selo && (
                    <span className={`inline-flex items-center gap-1 font-semibold ${c.selo === 'ouro' ? 'text-rl-gold' : 'text-rl-cyan'}`}>
                      {c.selo === 'ouro' ? <Award className="w-3.5 h-3.5" /> : <Medal className="w-3.5 h-3.5" />}
                      {c.seloNome}
                    </span>
                  )}
                  <span className="text-rl-muted tabular-nums w-10 text-right">{c.media == null ? '-' : c.media.toFixed(1)}</span>
                </div>
                <div className="h-1.5 mt-1 rounded-full bg-rl-surface overflow-hidden">
                  <div className={`h-full rounded-full ${c.media == null ? '' : c.media >= 2.75 ? 'bg-rl-green' : c.media >= 2 ? 'bg-rl-cyan' : c.media >= 1 ? 'bg-rl-gold' : 'bg-rl-red'}`}
                    style={{ width: `${c.media == null ? 0 : (c.media / 3) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="glass-card p-5 space-y-4">
          {resultado.faltou.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-rl-text flex items-center gap-1.5"><Target className="w-4 h-4 text-rl-purple" /> Para subir de nível faltou</h3>
              <ul className="mt-2 space-y-1.5 text-xs text-rl-subtle list-disc pl-4">
                {resultado.faltou.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}
          {nivelInfo && (
            <div>
              <h3 className="text-sm font-bold text-rl-text flex items-center gap-1.5"><Wallet className="w-4 h-4 text-rl-green" /> Referência do playbook ({nivelInfo.nome})</h3>
              <p className="text-xs text-rl-subtle mt-2">
                Salário {fmtBRL(nivelInfo.salario)} · carteira de {fmtBRL(nivelInfo.carteira)} · média de {nivelInfo.clientes} clientes
                {nivelInfo.extra ? ` · ${nivelInfo.extra}` : ''}.
              </p>
              {Number.isFinite(clientes) && clientes > 0 && (
                <p className="text-xs text-rl-muted mt-1">
                  Hoje cuida de {clientes} {clientes === 1 ? 'cliente' : 'clientes'} (Júnior 8, Pleno 11, Sênior 14 no playbook).
                </p>
              )}
            </div>
          )}
          {alertas.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-rl-red flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Sinais de alerta</h3>
              <ul className="mt-2 space-y-1 text-xs text-rl-subtle list-disc pl-4">
                {alertas.map((a) => <li key={a.id}>{a.rotulo}</li>)}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
