import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, Users, ClipboardCheck, Database, ArrowRight, Loader2 } from 'lucide-react'
import { CARGOS, cargoPorId } from '../../lib/contratacao'
import { contarPorCargo, listarCandidatos, ultimaEntrevista } from './data'
import { Pagina, NivelBadge, DisponivelBadge, fmtData } from './ui'

/** /contratacao: um quadrado por cargo. */
export function CargosGrid() {
  const navigate = useNavigate()
  const [contagem, setContagem] = useState({})
  useEffect(() => { contarPorCargo().then(setContagem).catch(() => {}) }, [])

  return (
    <Pagina titulo="Contratação">
      <p className="text-sm text-rl-subtle -mt-3">
        Escolha o cargo para fazer uma entrevista pontuada ou abrir o banco de talentos de quem já passou pelo processo.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARGOS.map((c) => {
          const n = contagem[c.id]
          return (
            <button
              key={c.id}
              type="button"
              disabled={!c.ativo}
              onClick={() => navigate(`/contratacao/${c.id}`)}
              className="glass-card p-5 text-left aspect-[4/3] flex flex-col hover:border-rl-purple/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <div className="w-11 h-11 rounded-xl bg-rl-purple/10 flex items-center justify-center mb-auto">
                <Briefcase className="w-5 h-5 text-rl-purple" />
              </div>
              <h3 className="text-lg font-black text-rl-text mt-4">{c.nome}</h3>
              <p className="text-xs text-rl-subtle mt-1">{c.descricao}</p>
              <div className="flex items-center gap-3 mt-3 text-[11px] text-rl-muted">
                <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {n?.total || 0} no banco</span>
                <span>{n?.disponiveis || 0} disponíveis</span>
                <ArrowRight className="w-4 h-4 ml-auto text-rl-muted group-hover:text-rl-purple group-hover:translate-x-0.5 transition-all" />
              </div>
            </button>
          )
        })}
      </div>
    </Pagina>
  )
}

/** /contratacao/:cargo: as duas funções do cargo + últimas entrevistas. */
export function CargoHub({ cargoId }) {
  const navigate = useNavigate()
  const cargo = cargoPorId(cargoId)
  const [recentes, setRecentes] = useState(null)

  useEffect(() => {
    listarCandidatos(cargoId)
      .then((cs) => setRecentes(cs.slice(0, 6)))
      .catch(() => setRecentes([]))
  }, [cargoId])

  if (!cargo) return <Pagina titulo="Cargo não encontrado" migalhas={[{ rotulo: 'Contratação', to: '/contratacao' }]} />

  const opcoes = [
    {
      Icon: ClipboardCheck, cor: 'text-rl-green bg-rl-green/10',
      titulo: 'Nova entrevista',
      texto: 'Roteiro com pesos para usar durante a conversa. Anexa o currículo, dá nota por resposta e no fim encaixa como Júnior, Pleno ou Sênior.',
      to: `/contratacao/${cargo.id}/nova`,
    },
    {
      Icon: Database, cor: 'text-rl-cyan bg-rl-cyan/10',
      titulo: 'Banco de talentos',
      texto: 'Todo mundo que já passou pelo processo, com pontuação, nível, resumo da IA e a marcação de quem já está empregado.',
      to: `/contratacao/${cargo.id}/talentos`,
    },
  ]

  return (
    <Pagina titulo={cargo.nome} migalhas={[{ rotulo: 'Contratação', to: '/contratacao' }, { rotulo: cargo.nome }]}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {opcoes.map((o) => (
          <button key={o.titulo} type="button" onClick={() => navigate(o.to)}
            className="glass-card p-6 text-left hover:border-rl-purple/50 transition-all group">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${o.cor}`}>
              <o.Icon className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-black text-rl-text mt-4 flex items-center gap-2">
              {o.titulo}
              <ArrowRight className="w-4 h-4 text-rl-muted group-hover:text-rl-purple group-hover:translate-x-0.5 transition-all" />
            </h3>
            <p className="text-sm text-rl-subtle mt-1">{o.texto}</p>
          </button>
        ))}
      </div>

      <section className="glass-card p-5">
        <h3 className="text-sm font-bold text-rl-text mb-3">Últimos candidatos</h3>
        {recentes == null ? (
          <div className="flex justify-center py-6 text-rl-muted"><Loader2 className="w-4 h-4 animate-spin" /></div>
        ) : recentes.length === 0 ? (
          <p className="text-sm text-rl-muted">Ninguém entrevistado ainda para este cargo.</p>
        ) : (
          <ul className="divide-y divide-rl-border/60">
            {recentes.map((c) => {
              const e = ultimaEntrevista(c)
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => navigate(`/contratacao/${cargo.id}/candidato/${c.id}`)}
                    className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-rl-surface/60 rounded-lg px-2 -mx-2 transition-colors">
                    <span className="text-sm font-semibold text-rl-text flex-1 min-w-0 truncate">{c.nome}</span>
                    <span className="text-xs text-rl-muted hidden sm:inline">{fmtData(e?.data)}</span>
                    <span className="text-sm font-black text-rl-text tabular-nums w-10 text-right">{e?.pontuacao ?? '-'}</span>
                    <NivelBadge nivel={e?.nivel} />
                    <DisponivelBadge empregado={c.empregado} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </Pagina>
  )
}
