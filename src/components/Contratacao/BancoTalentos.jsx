import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Loader2, Plus, FileText, Sparkles } from 'lucide-react'
import { cargoPorId, NIVEL_ROTULO, STATUS_CANDIDATO } from '../../lib/contratacao'
import { abrirCurriculo, atualizarCandidato, listarCandidatos, ultimaEntrevista } from './data'
import { Pagina, NivelBadge, StatusBadge, fmtData } from './ui'

const ORDENS = [
  { id: 'pontuacao', rotulo: 'Maior pontuação' },
  { id: 'recentes', rotulo: 'Entrevista mais recente' },
  { id: 'nome', rotulo: 'Nome' },
]

/** /contratacao/:cargo/talentos: todo mundo que passou pelo processo do cargo. */
export default function BancoTalentos({ cargoId, showToast }) {
  const navigate = useNavigate()
  const cargo = cargoPorId(cargoId)
  const [lista, setLista] = useState(null)
  const [busca, setBusca] = useState('')
  const [nivel, setNivel] = useState('')
  const [disp, setDisp] = useState('disponiveis') // todos | disponiveis | empregados
  const [status, setStatus] = useState('')
  const [ordem, setOrdem] = useState('pontuacao')

  useEffect(() => {
    listarCandidatos(cargoId).then(setLista).catch((e) => { showToast(e.message, 'error'); setLista([]) })
  }, [cargoId, showToast])

  const linhas = useMemo(() => {
    if (!lista) return []
    const t = busca.trim().toLowerCase()
    const rows = lista.map((c) => ({ c, e: ultimaEntrevista(c) }))
      .filter(({ c }) => !t || c.nome.toLowerCase().includes(t) || (c.email || '').toLowerCase().includes(t) || (c.cidade || '').toLowerCase().includes(t))
      .filter(({ e }) => !nivel || e?.nivel === nivel)
      .filter(({ c }) => disp === 'todos' || (disp === 'disponiveis' ? !c.empregado : c.empregado))
      .filter(({ c }) => !status || c.status === status)
    rows.sort((a, b) => {
      if (ordem === 'nome') return a.c.nome.localeCompare(b.c.nome)
      if (ordem === 'recentes') return String(b.e?.data || '').localeCompare(String(a.e?.data || ''))
      return (b.e?.pontuacao ?? -1) - (a.e?.pontuacao ?? -1)
    })
    return rows
  }, [lista, busca, nivel, disp, status, ordem])

  async function alternarEmpregado(c) {
    const empregado = !c.empregado
    setLista((l) => l.map((x) => (x.id === c.id ? { ...x, empregado } : x)))
    try {
      await atualizarCandidato(c.id, { empregado, empregado_atualizado_em: new Date().toISOString() })
    } catch (err) {
      setLista((l) => l.map((x) => (x.id === c.id ? { ...x, empregado: !empregado } : x)))
      showToast(err.message, 'error')
    }
  }

  if (!cargo) return null

  return (
    <Pagina
      titulo="Banco de talentos"
      migalhas={[{ rotulo: 'Contratação', to: '/contratacao' }, { rotulo: cargo.nome, to: `/contratacao/${cargo.id}` }, { rotulo: 'Banco de talentos' }]}
      acoes={
        <button type="button" onClick={() => navigate(`/contratacao/${cargo.id}/nova`)} className="btn-primary text-sm inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nova entrevista
        </button>
      }
    >
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-rl-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input className="input-field pl-9 text-sm" placeholder="Buscar por nome, e-mail ou cidade" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="inline-flex rounded-xl border border-rl-border bg-rl-surface p-1">
          {[['disponiveis', 'Disponíveis'], ['empregados', 'Empregados'], ['todos', 'Todos']].map(([id, r]) => (
            <button key={id} type="button" onClick={() => setDisp(id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${disp === id ? 'bg-rl-card text-rl-text shadow-sm' : 'text-rl-muted hover:text-rl-text'}`}>
              {r}
            </button>
          ))}
        </div>
        <select className="input-field w-auto text-sm" value={nivel} onChange={(e) => setNivel(e.target.value)}>
          <option value="">Todos os níveis</option>
          {['senior', 'pleno', 'junior', 'abaixo'].map((n) => <option key={n} value={n}>{NIVEL_ROTULO[n]}</option>)}
        </select>
        <select className="input-field w-auto text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {STATUS_CANDIDATO.map((s) => <option key={s.id} value={s.id}>{s.rotulo}</option>)}
        </select>
        <select className="input-field w-auto text-sm" value={ordem} onChange={(e) => setOrdem(e.target.value)}>
          {ORDENS.map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
        </select>
      </div>

      {lista == null ? (
        <div className="flex justify-center py-16 text-rl-muted"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : linhas.length === 0 ? (
        <div className="glass-card p-10 text-center text-sm text-rl-muted">
          {lista.length === 0 ? 'Ninguém no banco ainda. Faça a primeira entrevista.' : 'Nenhum candidato com esses filtros.'}
        </div>
      ) : (
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-rl-muted border-b border-rl-border">
                <th className="text-left font-semibold px-4 py-3">Candidato</th>
                <th className="text-right font-semibold px-2 py-3">Pontos</th>
                <th className="text-left font-semibold px-2 py-3">Nível</th>
                <th className="text-left font-semibold px-2 py-3">Status</th>
                <th className="text-left font-semibold px-2 py-3">Entrevista</th>
                <th className="text-left font-semibold px-2 py-3">Pretensão</th>
                <th className="text-center font-semibold px-4 py-3">Já empregado?</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ c, e }) => (
                <tr key={c.id} onClick={() => navigate(`/contratacao/${cargo.id}/candidato/${c.id}`)}
                  className={`border-b border-rl-border/50 last:border-0 cursor-pointer hover:bg-rl-surface/60 transition-colors ${c.empregado ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-rl-text">{c.nome}</span>
                      {c.curriculo_path && (
                        <button type="button" title="Abrir currículo" onClick={(ev) => { ev.stopPropagation(); abrirCurriculo(c) }} className="text-rl-muted hover:text-rl-purple">
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {e?.resumo_ia && <span title="Tem resumo da IA"><Sparkles className="w-3.5 h-3.5 text-rl-purple" /></span>}
                    </div>
                    <div className="text-[11px] text-rl-muted">{[c.cidade, c.email].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td className="px-2 py-3 text-right font-black tabular-nums text-rl-text">{e?.pontuacao ?? '-'}</td>
                  <td className="px-2 py-3"><NivelBadge nivel={e?.nivel} />{e && !e.finalizada && <span className="block text-[10px] text-rl-gold mt-0.5">em andamento</span>}</td>
                  <td className="px-2 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-2 py-3 text-xs text-rl-subtle">{fmtData(e?.data)}</td>
                  <td className="px-2 py-3 text-xs text-rl-subtle">{c.pretensao_salarial ? Number(c.pretensao_salarial).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : '-'}</td>
                  <td className="px-4 py-3 text-center" onClick={(ev) => ev.stopPropagation()}>
                    <button type="button" role="switch" aria-checked={c.empregado} onClick={() => alternarEmpregado(c)}
                      title={c.empregado ? 'Marcado como empregado (indisponível)' : 'Disponível para nós'}
                      className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${c.empregado ? 'bg-rl-red' : 'bg-rl-border'}`}>
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${c.empregado ? 'left-[18px]' : 'left-0.5'}`} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-rl-muted">
        {linhas.length} {linhas.length === 1 ? 'candidato' : 'candidatos'}. A chave "Já empregado?" tira a pessoa da lista de disponíveis sem apagar o histórico.
      </p>
    </Pagina>
  )
}
