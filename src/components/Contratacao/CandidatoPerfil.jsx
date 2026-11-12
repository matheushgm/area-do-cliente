import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Loader2, FileText, Upload, Mail, Phone, Linkedin, MapPin, Wallet, Plus, Trash2, ChevronDown, ChevronRight, Sparkles, ClipboardList,
} from 'lucide-react'
import MarkdownView from '../Editor/MarkdownView'
import { calcularResultado, cargoPorId, CAMPOS_FORMULARIO, fmtBRL, fmtResposta, STATUS_CANDIDATO } from '../../lib/contratacao'
import {
  abrirCurriculo, atualizarCandidato, buscarCandidato, criarEntrevista, enviarCurriculo, excluirCandidato, excluirEntrevista,
} from './data'
import { useApp } from '../../context/AppContext'
import { Pagina, NivelBadge, StatusBadge, fmtData } from './ui'
import { Selos } from './ResultadoPainel'

function Campo({ Icon, valor, href }) {
  if (!valor) return null
  const conteudo = (
    <span className="inline-flex items-center gap-1.5 text-xs text-rl-subtle">
      <Icon className="w-3.5 h-3.5 text-rl-muted" /> {valor}
    </span>
  )
  return href ? <a href={href} target="_blank" rel="noreferrer" className="hover:text-rl-purple">{conteudo}</a> : conteudo
}

function EntrevistaItem({ cargo, e, aberta, onToggle, onAbrir, onExcluir }) {
  const r = calcularResultado(cargo, e.respostas)
  return (
    <li className="glass-card overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-rl-surface/50 transition-colors">
        {aberta ? <ChevronDown className="w-4 h-4 text-rl-muted" /> : <ChevronRight className="w-4 h-4 text-rl-muted" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-rl-text">Entrevista de {fmtData(e.data)}</p>
          <p className="text-[11px] text-rl-muted">
            {e.entrevistador_nome ? `com ${e.entrevistador_nome} · ` : ''}{r.respondidas}/{r.total} atividades
            {!e.finalizada && <span className="text-rl-gold"> · em andamento</span>}
          </p>
        </div>
        {e.resumo_ia && <Sparkles className="w-4 h-4 text-rl-purple" />}
        <span className="text-xl font-black tabular-nums text-rl-text">{e.pontuacao ?? r.pontuacao}</span>
        <NivelBadge nivel={e.nivel} />
      </button>
      {aberta && (
        <div className="px-5 pb-5 space-y-4 border-t border-rl-border/60 pt-4">
          <Selos porCompetencia={r.porCompetencia} />
          {e.sugestao_ia?.frase && <p className="text-sm text-rl-subtle italic">“{e.sugestao_ia.frase}”</p>}
          {e.resumo_ia ? (
            <MarkdownView content={e.resumo_ia} className="md-prose--13" codigo={false} />
          ) : (
            <p className="text-xs text-rl-muted">Sem resumo da IA. Abra a entrevista e anexe a transcrição para gerar.</p>
          )}
          {e.transcricao && (
            <details className="text-xs">
              <summary className="cursor-pointer text-rl-muted hover:text-rl-text">Transcrição ({e.transcricao.split(/\s+/).length.toLocaleString('pt-BR')} palavras)</summary>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-rl-subtle max-h-80 overflow-y-auto bg-rl-surface rounded-lg p-3">{e.transcricao}</pre>
            </details>
          )}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onExcluir} className="btn-ghost text-xs inline-flex items-center gap-1.5 hover:!text-rl-red"><Trash2 className="w-3.5 h-3.5" /> Excluir</button>
            <button type="button" onClick={onAbrir} className="btn-secondary text-xs inline-flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5" /> Abrir roteiro</button>
          </div>
        </div>
      )}
    </li>
  )
}

const fmtDataHora = (iso) => {
  if (!iso) return '-'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

/** Respostas da inscrição (formulário da vaga). Some quando o candidato veio direto para a entrevista. */
function FormularioInscricao({ f }) {
  if (!f?.respostas) return null
  const inscricoes = f.inscricoes || []
  const ultima = inscricoes[inscricoes.length - 1]
  const anteriores = inscricoes.slice(0, -1)
  return (
    <div className="rounded-xl border border-rl-border p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <ClipboardList className="w-4 h-4 text-rl-purple" />
        <span className="text-sm font-bold text-rl-text">Formulário de inscrição</span>
        <span className="text-[11px] text-rl-muted">
          {inscricoes.length > 1
            ? `${inscricoes.length} inscrições: ${inscricoes.map((i) => fmtDataHora(i.data)).join(', ')}`
            : `em ${fmtDataHora(ultima?.data)}`}
          {f.anuncio ? ` · anúncio ${f.anuncio}` : ''}
        </span>
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        {CAMPOS_FORMULARIO.map((campo) => {
          const v = f.respostas[campo.id]
          const antes = [...new Set(anteriores
            .map((i) => i.respostas?.[campo.id])
            .filter((a) => a != null && String(a).toLowerCase() !== String(v).toLowerCase())
            .map((a) => fmtResposta(campo, a)))]
          return (
            <div key={campo.id}>
              <dt className="text-[11px] text-rl-muted">{campo.rotulo}</dt>
              <dd className="text-sm font-semibold text-rl-text">
                {fmtResposta(campo, v)}
                {antes.length > 0 && <span className="ml-1.5 text-[11px] font-normal text-rl-muted">antes: {antes.join(', ')}</span>}
              </dd>
            </div>
          )
        })}
      </dl>
      {f.campanha && <p className="text-[10px] text-rl-muted">Campanha {f.campanha}{ultima?.plataforma ? ` · veio pelo ${ultima.plataforma}` : ''}</p>}
    </div>
  )
}

/** /contratacao/:cargo/candidato/:id: perfil + histórico de entrevistas. */
export default function CandidatoPerfil({ cargoId, candidatoId, showToast }) {
  const navigate = useNavigate()
  const { user } = useApp()
  const cargo = cargoPorId(cargoId)
  const [c, setC] = useState(null)
  const [aberta, setAberta] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [obs, setObs] = useState('')

  useEffect(() => {
    buscarCandidato(candidatoId)
      .then((d) => {
        d.contratacao_entrevistas.sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(b.created_at).localeCompare(String(a.created_at)))
        setC(d)
        setObs(d.observacoes || '')
        setAberta(d.contratacao_entrevistas[0]?.id || null)
      })
      .catch((e) => showToast(e.message, 'error'))
  }, [candidatoId, showToast])

  async function salvar(patch) {
    setC((x) => ({ ...x, ...patch }))
    try { await atualizarCandidato(candidatoId, patch) } catch (e) { showToast(e.message, 'error') }
  }

  async function trocarCurriculo(file) {
    if (!file) return
    setEnviando(true)
    try {
      const novo = await enviarCurriculo(c, file)
      setC((x) => ({ ...x, curriculo_path: novo.curriculo_path, curriculo_nome: novo.curriculo_nome }))
      showToast('Currículo atualizado.')
    } catch (e) { showToast(e.message, 'error') }
    setEnviando(false)
  }

  async function novaEntrevista() {
    try {
      const e = await criarEntrevista({ candidato_id: c.id, cargo: cargo.id, entrevistador_nome: user?.name || null })
      // Quem só tinha se inscrito passa a entrevistado ao abrir a primeira entrevista.
      if (c.status === 'inscrito') await atualizarCandidato(c.id, { status: 'entrevistado' })
      navigate(`/contratacao/${cargo.id}/entrevista/${e.id}`)
    } catch (e) { showToast(e.message, 'error') }
  }

  async function apagarEntrevista(id) {
    if (!window.confirm('Excluir esta entrevista? A transcrição e o resumo dela somem junto.')) return
    try {
      await excluirEntrevista(id)
      setC((x) => ({ ...x, contratacao_entrevistas: x.contratacao_entrevistas.filter((e) => e.id !== id) }))
    } catch (e) { showToast(e.message, 'error') }
  }

  async function apagarCandidato() {
    if (!window.confirm(`Excluir ${c.nome} do banco de talentos? Currículo, entrevistas e resumos são apagados e não dá para desfazer.`)) return
    try {
      await excluirCandidato(c)
      navigate(`/contratacao/${cargo.id}/talentos`)
    } catch (e) { showToast(e.message, 'error') }
  }

  if (!c || !cargo) return <div className="flex-1 flex justify-center py-24 text-rl-muted"><Loader2 className="w-5 h-5 animate-spin" /></div>

  const ultima = c.contratacao_entrevistas[0]

  return (
    <Pagina
      largura="max-w-5xl"
      migalhas={[
        { rotulo: 'Contratação', to: '/contratacao' },
        { rotulo: cargo.nome, to: `/contratacao/${cargo.id}` },
        { rotulo: 'Banco de talentos', to: `/contratacao/${cargo.id}/talentos` },
        { rotulo: c.nome },
      ]}
    >
      <section className="glass-card p-6 space-y-4">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-[240px] space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-black text-rl-text">{c.nome}</h2>
              <StatusBadge status={c.status} />
              {ultima && <NivelBadge nivel={ultima.nivel} />}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <Campo Icon={Mail} valor={c.email} href={c.email ? `mailto:${c.email}` : null} />
              <Campo Icon={Phone} valor={c.telefone} href={c.telefone ? `https://wa.me/55${c.telefone.replace(/\D/g, '').replace(/^55/, '')}` : null} />
              <Campo Icon={Linkedin} valor={c.linkedin} href={c.linkedin ? (c.linkedin.startsWith('http') ? c.linkedin : `https://${c.linkedin}`) : null} />
              <Campo Icon={MapPin} valor={c.cidade} />
              <Campo Icon={Wallet} valor={c.pretensao_salarial ? `Pretensão ${fmtBRL(c.pretensao_salarial)}` : null} />
            </div>
          </div>
          {ultima && (
            <div className="text-right">
              <div className="text-4xl font-black tabular-nums text-rl-text leading-none">{ultima.pontuacao ?? '-'}</div>
              <div className="text-[11px] text-rl-muted mt-1">última entrevista</div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-rl-border/60">
          {/* Flag do banco de talentos */}
          <div className={`rounded-xl border p-3 ${c.empregado ? 'border-rl-red/40 bg-rl-red/5' : 'border-rl-green/40 bg-rl-green/5'}`}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={c.empregado} className="accent-rl-red"
                onChange={(e) => salvar({ empregado: e.target.checked, empregado_atualizado_em: new Date().toISOString() })} />
              <span className="text-sm font-semibold text-rl-text">Já está empregado</span>
            </label>
            {c.empregado && (
              <input className="input-field text-xs mt-2" placeholder="Onde? (opcional)" defaultValue={c.empregado_onde || ''}
                onBlur={(e) => e.target.value !== (c.empregado_onde || '') && salvar({ empregado_onde: e.target.value || null })} />
            )}
            <p className="text-[10px] text-rl-muted mt-1.5">
              {c.empregado ? 'Fora da lista de disponíveis.' : 'Disponível para nós.'}
              {c.empregado_atualizado_em ? ` Atualizado em ${fmtData(c.empregado_atualizado_em)}.` : ''}
            </p>
          </div>

          <div className="rounded-xl border border-rl-border p-3">
            <span className="label-field">Status no processo</span>
            <select className="input-field text-sm" value={c.status} onChange={(e) => salvar({ status: e.target.value })}>
              {STATUS_CANDIDATO.map((s) => <option key={s.id} value={s.id}>{s.rotulo}</option>)}
            </select>
          </div>

          <div className="rounded-xl border border-rl-border p-3">
            <span className="label-field">Currículo</span>
            <div className="flex items-center gap-2">
              {c.curriculo_path ? (
                <button type="button" onClick={() => abrirCurriculo(c)} className="text-xs font-semibold text-rl-purple hover:underline inline-flex items-center gap-1 truncate min-w-0">
                  <FileText className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{c.curriculo_nome || 'Abrir'}</span>
                </button>
              ) : <span className="text-xs text-rl-muted">Nenhum anexado</span>}
              <label className="ml-auto btn-ghost text-xs inline-flex items-center gap-1 cursor-pointer shrink-0">
                {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {c.curriculo_path ? 'Trocar' : 'Anexar'}
                <input type="file" className="hidden" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt" onChange={(e) => { trocarCurriculo(e.target.files?.[0]); e.target.value = '' }} />
              </label>
            </div>
          </div>
        </div>

        <FormularioInscricao f={c.formulario} />

        <label className="block">
          <span className="label-field">Observações gerais</span>
          <textarea className="input-field text-sm min-h-[70px]" value={obs} onChange={(e) => setObs(e.target.value)}
            onBlur={() => obs !== (c.observacoes || '') && salvar({ observacoes: obs || null })}
            placeholder="Ex.: ótimo para Pleno, mas pediu acima da faixa; chamar de novo em março." />
        </label>
      </section>

      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold text-rl-text flex-1">Histórico de entrevistas</h3>
        <button type="button" onClick={novaEntrevista} className="btn-primary text-sm inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nova entrevista
        </button>
      </div>
      {c.contratacao_entrevistas.length === 0 ? (
        <div className="glass-card p-8 text-center text-sm text-rl-muted">Nenhuma entrevista registrada.</div>
      ) : (
        <ul className="space-y-3">
          {c.contratacao_entrevistas.map((e) => (
            <EntrevistaItem key={e.id} cargo={cargo} e={e}
              aberta={aberta === e.id}
              onToggle={() => setAberta(aberta === e.id ? null : e.id)}
              onAbrir={() => navigate(`/contratacao/${cargo.id}/entrevista/${e.id}`)}
              onExcluir={() => apagarEntrevista(e.id)} />
          ))}
        </ul>
      )}

      <div className="flex justify-end">
        <button type="button" onClick={apagarCandidato} className="text-xs text-rl-muted hover:text-rl-red inline-flex items-center gap-1">
          <Trash2 className="w-3.5 h-3.5" /> Excluir candidato do banco
        </button>
      </div>
    </Pagina>
  )
}
