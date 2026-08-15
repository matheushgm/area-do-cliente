// Modal "Enviar pra aprovação do cliente" — Criativos com IA.
//
// Pega a leva de copy que acabou de ser gerada (ou uma do histórico), deixa o
// gestor escolher quais criativos vão, e cria um link compartilhável EXCLUSIVO
// daquela leva: /aprovacao-copy/<token>. O cliente aprova ou reprova cada copy
// nesse link; ao aprovar, a copy cai na Central de anúncios com o status
// "Aprovado para Edição" (fila do designer).
import { useMemo, useState } from 'react'
import {
  Send, Link2, Copy, Check, Loader2, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp,
} from 'lucide-react'
import Modal from '../UI/Modal'
import MarkdownBlock from './MarkdownBlock'
import { garantirAdsDaGeracao, montarEnvioDeLeva, linkDaLeva } from '../../lib/copyLevas'
import { useApp } from '../../context/AppContext'

const EMPTY = { levas: [] }

const STATUS_META = {
  pendente: { label: 'Aguardando', Icon: Clock, cls: 'text-rl-gold bg-rl-gold/10 border-rl-gold/30' },
  aprovado: { label: 'Aprovado', Icon: CheckCircle2, cls: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30' },
  reprovado: { label: 'Reprovado', Icon: XCircle, cls: 'text-red-500 bg-red-500/10 border-red-500/30' },
}

function fmtDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()} às ${hh}:${mi}`
}

export default function CopyAprovacaoModal({ project, creative, onClose, onToast }) {
  const { updateProject } = useApp()

  const store = project.copyAprovacoes || EMPTY
  const levas = useMemo(
    () => (store.levas || [])
      .filter((l) => l.creativeId === creative.id)
      .slice()
      .sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || '')),
    [store.levas, creative.id]
  )

  // Os itens da leva são os RASCUNHOS que essa geração criou na Central de
  // anúncios. Gerações antigas (anteriores ao rascunho automático) ganham os
  // seus na hora do envio — `novos` entra junto no mesmo patch.
  const { ads, novos } = useMemo(() => garantirAdsDaGeracao(project, creative), [project, creative])
  const disponiveis = ads.filter((ad) => (ad.copyAprovacao?.status || '') !== 'pendente')

  const [selected, setSelected] = useState(() => new Set(disponiveis.map((ad) => ad.id)))
  const [nome, setNome] = useState(
    () => `${creative.type === 'video' ? 'Roteiros' : 'Copies'} — ${(creative.name || 'geração').slice(0, 60)}`
  )
  const [busy, setBusy] = useState(false)
  const [novaLeva, setNovaLeva] = useState(levas.length === 0)
  const [copiedToken, setCopiedToken] = useState(null)

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function copiarLink(leva) {
    const url = linkDaLeva(leva.token)
    navigator.clipboard?.writeText(url)
      .then(() => {
        setCopiedToken(leva.token)
        setTimeout(() => setCopiedToken(null), 2000)
        onToast?.('Link da leva copiado!')
      })
      .catch(() => onToast?.('Link: ' + url))
  }

  function criarLeva() {
    const escolhidos = disponiveis.filter((ad) => selected.has(ad.id))
    if (!escolhidos.length || busy) return
    setBusy(true)
    // Só o que foi escolhido entra na Central: quem não vai pro cliente não
    // vira anúncio. `novos` são os que ainda não existiam lá.
    const idsNovos = new Set(novos.map((ad) => ad.id))
    const { leva, patch } = montarEnvioDeLeva({
      project,
      ads: escolhidos,
      nome,
      creative,
      adsExtras: escolhidos.filter((ad) => idsNovos.has(ad.id)),
    })
    updateProject(project.id, patch)
    setBusy(false)
    setNovaLeva(false)
    copiarLink(leva)
  }

  function excluirLeva(leva) {
    if (!window.confirm('Excluir essa leva? O link para de funcionar para o cliente.')) return
    // Quem ainda estava aguardando resposta volta a ser rascunho na Central —
    // sem isso o anúncio ficaria preso na aba de aprovação com um link morto.
    const debriefing = project.debriefing || {}
    updateProject(project.id, {
      copyAprovacoes: { ...store, levas: (store.levas || []).filter((l) => l.id !== leva.id) },
      debriefing: {
        ...debriefing,
        ads: (debriefing.ads || []).map((ad) =>
          ad?.copyAprovacao?.levaId === leva.id && ad.copyAprovacao.status === 'pendente'
            ? { ...ad, copyAprovacao: null, updatedAt: new Date().toISOString() }
            : ad
        ),
      },
    })
    onToast?.('Leva removida.')
  }

  return (
    <Modal onClose={onClose} maxWidth="2xl">
      <div className="p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rl-purple/10 flex items-center justify-center shrink-0">
            <Send className="w-5 h-5 text-rl-purple" />
          </div>
          <div>
            <h3 className="text-lg font-black text-rl-text leading-tight">
              Enviar pra aprovação do cliente
            </h3>
            <p className="text-xs text-rl-muted mt-0.5 max-w-lg">
              Gera um link exclusivo desta leva. O que o cliente aprovar entra na Central de
              anúncios como <strong className="text-rl-purple">Aprovado para Edição</strong>, na
              fila do designer.
            </p>
          </div>
        </div>

        {/* Levas já enviadas desta geração */}
        {levas.length > 0 && (
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rl-muted">
              Levas enviadas ({levas.length})
            </p>
            {levas.map((leva) => (
              <LevaCard
                key={leva.id}
                leva={leva}
                copied={copiedToken === leva.token}
                url={linkDaLeva(leva.token)}
                onCopy={() => copiarLink(leva)}
                onDelete={() => excluirLeva(leva)}
              />
            ))}
          </div>
        )}

        {/* Criar nova leva */}
        {!novaLeva ? (
          <button
            onClick={() => setNovaLeva(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-rl-border text-sm font-semibold text-rl-muted hover:text-rl-purple hover:border-rl-purple/40 transition-all"
          >
            <Link2 className="w-4 h-4" /> Gerar uma nova leva de aprovação
          </button>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-rl-muted mb-1 block">
                Nome da leva (o cliente vê)
              </label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="input-field w-full text-sm"
                placeholder="Ex: Copies de agosto, funil de diagnóstico"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-rl-muted">
                  Criativos desta leva ({selected.size}/{disponiveis.length})
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelected(new Set(disponiveis.map((ad) => ad.id)))}
                    className="text-[10px] text-rl-muted hover:text-rl-purple transition-colors"
                  >
                    Selecionar todos
                  </button>
                  <button
                    onClick={() => setSelected(new Set())}
                    className="text-[10px] text-rl-muted hover:text-rl-purple transition-colors"
                  >
                    Limpar
                  </button>
                </div>
              </div>
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {ads.map((ad) => {
                  const pendente = (ad.copyAprovacao?.status || '') === 'pendente'
                  return (
                    <label
                      key={ad.id}
                      className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${
                        pendente
                          ? 'border-rl-border bg-rl-surface/20 opacity-60 cursor-not-allowed'
                          : selected.has(ad.id)
                            ? 'border-rl-purple/40 bg-rl-purple/5 cursor-pointer'
                            : 'border-rl-border bg-rl-surface/30 hover:border-rl-border cursor-pointer'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(ad.id)}
                        disabled={pendente}
                        onChange={() => toggle(ad.id)}
                        className="mt-0.5 accent-rl-purple"
                      />
                      <span className="text-xs text-rl-text leading-snug flex-1">{ad.nome}</span>
                      {pendente && (
                        <span className="text-[9px] font-bold text-rl-gold shrink-0 whitespace-nowrap">
                          já com o cliente
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              {levas.length > 0 && (
                <button
                  onClick={() => setNovaLeva(false)}
                  className="text-xs px-4 py-2 rounded-xl bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all"
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={criarLeva}
                disabled={busy || selected.size === 0}
                className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl bg-rl-purple text-white shadow-glow hover:bg-rl-purple/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Gerar link e copiar
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── Card de uma leva já enviada ──────────────────────────────────────────────
function LevaCard({ leva, url, copied, onCopy, onDelete }) {
  const [open, setOpen] = useState(false)
  const itens = leva.itens || []
  const cont = itens.reduce((acc, it) => {
    const st = it.aprovacao?.status || 'pendente'
    acc[st] = (acc[st] || 0) + 1
    return acc
  }, {})

  return (
    <div className="rounded-xl border border-rl-border bg-rl-surface/30 overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-rl-text truncate">{leva.nome}</p>
          <p className="text-[11px] text-rl-muted mt-0.5">
            {itens.length} criativo{itens.length !== 1 ? 's' : ''} · enviada em{' '}
            {fmtDateTime(leva.enviadoEm || leva.criadoEm)}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {['pendente', 'aprovado', 'reprovado'].map((st) =>
            cont[st] ? (
              <span
                key={st}
                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_META[st].cls}`}
              >
                {cont[st]} {STATUS_META[st].label.toLowerCase()}
              </span>
            ) : null
          )}
        </div>
      </div>

      <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
        <code className="text-[10px] text-rl-muted bg-rl-bg/60 border border-rl-border rounded-lg px-2 py-1 truncate max-w-full">
          {url}
        </code>
        <button
          onClick={onCopy}
          className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-rl-purple/10 border border-rl-purple/30 text-rl-purple hover:bg-rl-purple/20 transition-all"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copiado!' : 'Copiar link'}
        </button>
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-lg text-rl-muted hover:text-rl-text transition-all"
        >
          {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {open ? 'Ocultar respostas' : 'Ver respostas'}
        </button>
        <button
          onClick={onDelete}
          className="ml-auto text-[10px] text-rl-muted hover:text-red-400 transition-colors"
        >
          Excluir leva
        </button>
      </div>

      {open && (
        <div className="border-t border-rl-border/60 divide-y divide-rl-border/40">
          {itens.map((it) => {
            const st = it.aprovacao?.status || 'pendente'
            const meta = STATUS_META[st]
            const StIcon = meta.Icon
            return (
              <div key={it.id} className="px-4 py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-rl-text leading-snug">{it.titulo}</p>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${meta.cls}`}
                  >
                    <StIcon className="w-3 h-3" /> {meta.label}
                  </span>
                </div>
                {st === 'reprovado' && (
                  <div className="space-y-1.5">
                    <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-2.5 py-2">
                      <p className="text-[9px] uppercase tracking-wider font-bold text-red-500">
                        Motivo
                      </p>
                      <p className="text-xs text-rl-text mt-0.5 whitespace-pre-wrap">
                        {it.aprovacao?.motivo || '—'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-rl-surface/60 border border-rl-border px-2.5 py-2">
                      <p className="text-[9px] uppercase tracking-wider font-bold text-rl-muted">
                        Como deveria estar
                      </p>
                      <p className="text-xs text-rl-text mt-0.5 whitespace-pre-wrap">
                        {it.aprovacao?.sugestao || '—'}
                      </p>
                    </div>
                  </div>
                )}
                {st === 'aprovado' && (
                  <p className="text-[10px] text-emerald-500 font-semibold">
                    Na Central de anúncios como Aprovado para Edição
                    {it.aprovacao?.decididoEm ? ` · ${fmtDateTime(it.aprovacao.decididoEm)}` : ''}
                  </p>
                )}
                <details className="group">
                  <summary className="text-[10px] text-rl-muted cursor-pointer hover:text-rl-text">
                    Ver copy enviada
                  </summary>
                  <div className="mt-2 rounded-lg bg-rl-bg/40 border border-rl-border px-3 py-2">
                    <MarkdownBlock content={it.conteudo} />
                  </div>
                </details>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
