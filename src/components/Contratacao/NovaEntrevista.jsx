import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, Loader2, Play, Search, UserPlus, UserCheck } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { cargoPorId } from '../../lib/contratacao'
import { atualizarCandidato, criarCandidato, criarEntrevista, enviarCurriculo, listarCandidatos } from './data'
import { Pagina, DisponivelBadge } from './ui'

const VAZIO = { nome: '', email: '', telefone: '', linkedin: '', cidade: '', pretensao_salarial: '' }

/** /contratacao/:cargo/nova: dados do candidato + currículo, depois abre o roteiro. */
export default function NovaEntrevista({ cargoId, showToast }) {
  const navigate = useNavigate()
  const { user } = useApp()
  const cargo = cargoPorId(cargoId)
  const [modo, setModo] = useState('novo') // novo | existente
  const [form, setForm] = useState(VAZIO)
  const [arquivo, setArquivo] = useState(null)
  const [existentes, setExistentes] = useState([])
  const [busca, setBusca] = useState('')
  const [escolhido, setEscolhido] = useState(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => { listarCandidatos(cargoId).then(setExistentes).catch(() => {}) }, [cargoId])

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return existentes.filter((c) => !t || c.nome.toLowerCase().includes(t) || (c.email || '').toLowerCase().includes(t)).slice(0, 8)
  }, [busca, existentes])

  // Aviso de possível duplicado ao digitar nome/e-mail de alguém que já está no banco.
  const duplicado = useMemo(() => {
    if (modo !== 'novo') return null
    const email = form.email.trim().toLowerCase()
    const nome = form.nome.trim().toLowerCase()
    return existentes.find((c) => (email && (c.email || '').toLowerCase() === email) || (nome.length > 5 && c.nome.toLowerCase() === nome)) || null
  }, [form.email, form.nome, existentes, modo])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function comecar(e) {
    e.preventDefault()
    if (modo === 'novo' && !form.nome.trim()) { showToast('Preencha o nome do candidato.', 'error'); return }
    if (modo === 'existente' && !escolhido) { showToast('Escolha o candidato no banco.', 'error'); return }
    setSalvando(true)
    try {
      let cand = escolhido
      if (modo === 'novo') {
        cand = await criarCandidato({
          cargo: cargo.id,
          nome: form.nome.trim(),
          email: form.email.trim() || null,
          telefone: form.telefone.trim() || null,
          linkedin: form.linkedin.trim() || null,
          cidade: form.cidade.trim() || null,
          pretensao_salarial: form.pretensao_salarial ? Number(String(form.pretensao_salarial).replace(/\D/g, '')) : null,
        })
      }
      // Quem veio do formulário da vaga vira entrevistado quando a entrevista começa.
      if (cand.status === 'inscrito') cand = await atualizarCandidato(cand.id, { status: 'entrevistado' })
      if (arquivo) cand = await enviarCurriculo(cand, arquivo)
      const ent = await criarEntrevista({
        candidato_id: cand.id,
        cargo: cargo.id,
        entrevistador_nome: user?.name || null,
      })
      navigate(`/contratacao/${cargo.id}/entrevista/${ent.id}`)
    } catch (err) {
      showToast(err.message, 'error')
      setSalvando(false)
    }
  }

  if (!cargo) return null

  return (
    <Pagina
      titulo="Nova entrevista"
      largura="max-w-3xl"
      migalhas={[{ rotulo: 'Contratação', to: '/contratacao' }, { rotulo: cargo.nome, to: `/contratacao/${cargo.id}` }, { rotulo: 'Nova entrevista' }]}
    >
      <form onSubmit={comecar} className="space-y-5">
        <div className="inline-flex rounded-xl border border-rl-border bg-rl-surface p-1">
          {[
            { id: 'novo', rotulo: 'Candidato novo', Icon: UserPlus },
            { id: 'existente', rotulo: 'Já está no banco', Icon: UserCheck },
          ].map((m) => (
            <button key={m.id} type="button" onClick={() => setModo(m.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${modo === m.id ? 'bg-rl-card text-rl-text shadow-sm' : 'text-rl-muted hover:text-rl-text'}`}>
              <m.Icon className="w-3.5 h-3.5" /> {m.rotulo}
            </button>
          ))}
        </div>

        {modo === 'novo' ? (
          <div className="glass-card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="sm:col-span-2">
              <span className="label-field">Nome completo *</span>
              <input className="input-field" value={form.nome} onChange={set('nome')} autoFocus />
            </label>
            <label><span className="label-field">E-mail</span><input className="input-field" type="email" value={form.email} onChange={set('email')} /></label>
            <label><span className="label-field">WhatsApp</span><input className="input-field" value={form.telefone} onChange={set('telefone')} /></label>
            <label><span className="label-field">LinkedIn</span><input className="input-field" value={form.linkedin} onChange={set('linkedin')} placeholder="linkedin.com/in/..." /></label>
            <label><span className="label-field">Cidade</span><input className="input-field" value={form.cidade} onChange={set('cidade')} /></label>
            <label><span className="label-field">Pretensão salarial (R$)</span><input className="input-field" inputMode="numeric" value={form.pretensao_salarial} onChange={set('pretensao_salarial')} placeholder="3000" /></label>
            {duplicado && (
              <p className="sm:col-span-2 text-xs text-rl-gold bg-rl-gold/10 border border-rl-gold/30 rounded-lg px-3 py-2">
                {duplicado.nome} já está no banco deste cargo.{' '}
                <button type="button" className="underline font-semibold" onClick={() => { setModo('existente'); setEscolhido(duplicado) }}>
                  Usar o cadastro existente
                </button>
              </p>
            )}
          </div>
        ) : (
          <div className="glass-card p-5 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-rl-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input className="input-field pl-9" placeholder="Buscar por nome ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus />
            </div>
            {filtrados.length === 0 ? (
              <p className="text-sm text-rl-muted">Nenhum candidato encontrado.</p>
            ) : (
              <ul className="space-y-1">
                {filtrados.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => setEscolhido(c)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all ${escolhido?.id === c.id ? 'border-rl-purple bg-rl-purple/10' : 'border-transparent hover:bg-rl-surface'}`}>
                      <span className="text-sm font-semibold text-rl-text flex-1 truncate">{c.nome}</span>
                      <span className="text-xs text-rl-muted truncate hidden sm:inline">{c.email}</span>
                      <DisponivelBadge empregado={c.empregado} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="glass-card p-5">
          <span className="label-field">Currículo {modo === 'existente' && escolhido?.curriculo_nome ? '(substitui o atual)' : ''}</span>
          <label className="mt-1 flex items-center gap-3 border border-dashed border-rl-border rounded-xl px-4 py-4 cursor-pointer hover:border-rl-purple/50 hover:bg-rl-surface/50 transition-all">
            {arquivo ? <FileText className="w-5 h-5 text-rl-purple" /> : <Upload className="w-5 h-5 text-rl-muted" />}
            <span className="text-sm text-rl-subtle flex-1 truncate">
              {arquivo ? arquivo.name : 'PDF, Word ou imagem. Clique para escolher.'}
            </span>
            <input type="file" className="hidden" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt" onChange={(e) => setArquivo(e.target.files?.[0] || null)} />
          </label>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={salvando} className="btn-primary inline-flex items-center gap-2 text-sm">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Começar entrevista
          </button>
        </div>
      </form>
    </Pagina>
  )
}
