// Modal "Aprovação de copy" da Central de anúncios.
//
// Para as copies que ainda não têm peça (aba "Ads para aprovação"): junta as
// escolhidas numa LEVA com revisão interna. Primeiro alguém do time aprova cada
// texto no link interno (/revisao-copy/<token>, com login); o link do cliente
// (/aprovacao-copy/<token>) só mostra o que o time liberou. O formato da leva
// vive em src/lib/copyLevas.js; quem grava as decisões é api/copy-aprovacao.js.
import { useMemo, useState } from 'react'
import { ShieldCheck, Link2, Copy, Check, Trash2, Video, Image as ImageIcon } from 'lucide-react'
import Modal from '../UI/Modal'
import { useApp } from '../../context/AppContext'
import {
  montarEnvioDeLeva, linkDaLeva, linkDaRevisao, copyEmLeva, podeIrPraRevisao, resumoDaLeva,
} from '../../lib/copyLevas'
import { dataDoAd, semanaDoMes, fmtDateBR, fmtDateTimeBR } from './debriefingData'

// "Roteiros da semana de 01/11 a 07/11" quando todos são da mesma semana.
function nomeSugerido(ads) {
  const video = ads.length > 0 && ads.every((ad) => ad.tipo === 'video')
  const base = video ? 'Roteiros' : 'Copies'
  const semanas = new Set(ads.map((ad) => semanaDoMes(dataDoAd(ad))?.periodo).filter(Boolean))
  if (semanas.size === 1) return `${base} da semana de ${[...semanas][0]}`
  return `${base} de ${fmtDateBR(new Date().toISOString().slice(0, 10))}`
}

export default function CentralAprovacaoModal({ project, preselecionados = [], onClose, onToast }) {
  const { updateProject } = useApp()
  const ads = useMemo(() => project.debriefing?.ads || [], [project.debriefing])

  // Copies que podem ir numa leva nova, da mais recente pra mais antiga.
  const candidatos = useMemo(
    () => ads.filter(podeIrPraRevisao).sort((a, b) => (dataDoAd(b) || '').localeCompare(dataDoAd(a) || '')),
    [ads]
  )
  const [selecionados, setSelecionados] = useState(() => {
    const ok = new Set(candidatos.map((ad) => ad.id))
    return new Set(preselecionados.filter((id) => ok.has(id)))
  })
  const [nome, setNome] = useState(() => nomeSugerido(candidatos.filter((ad) => preselecionados.includes(ad.id))))
  const [copiado, setCopiado] = useState(null) // `${token}|interno` | `${token}|cliente`

  // Só as levas com revisão interna (as da Central). As do Criativos com IA
  // continuam no modal de lá.
  const levas = useMemo(
    () => (project.copyAprovacoes?.levas || [])
      .filter((l) => l?.revisaoInterna)
      .slice()
      .sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || '')),
    [project.copyAprovacoes]
  )

  function alternar(id) {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function copiar(url, chave, msg) {
    navigator.clipboard?.writeText(url)
      .then(() => {
        setCopiado(chave)
        setTimeout(() => setCopiado(null), 2000)
        onToast?.(msg)
      })
      .catch(() => onToast?.('Link: ' + url))
  }

  function criarLeva() {
    const escolhidos = candidatos.filter((ad) => selecionados.has(ad.id))
    if (!escolhidos.length) return
    const { leva, patch } = montarEnvioDeLeva({ project, ads: escolhidos, nome, revisaoInterna: true })
    updateProject(project.id, patch)
    setSelecionados(new Set())
    setNome(nomeSugerido([]))
    copiar(linkDaRevisao(leva.token), `${leva.token}|interno`, 'Leva criada. Link da revisão interna copiado!')
  }

  function excluirLeva(leva) {
    if (!window.confirm('Excluir essa leva? Os dois links param de funcionar.')) return
    // Quem ainda esperava o time ou o cliente volta a ser só copy na Central.
    const debriefing = project.debriefing || {}
    updateProject(project.id, {
      copyAprovacoes: {
        ...(project.copyAprovacoes || {}),
        levas: (project.copyAprovacoes?.levas || []).filter((l) => l.id !== leva.id),
      },
      debriefing: {
        ...debriefing,
        ads: (debriefing.ads || []).map((ad) =>
          ad?.copyAprovacao?.levaId === leva.id && copyEmLeva(ad)
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
            <ShieldCheck className="w-5 h-5 text-rl-purple" />
          </div>
          <div>
            <h3 className="text-lg font-black text-rl-text leading-tight">Aprovação de copy</h3>
            <p className="text-xs text-rl-muted mt-0.5 max-w-lg">
              Primeiro o time revisa no <strong className="text-rl-text">link interno</strong> (precisa
              de login). O <strong className="text-rl-text">link do cliente</strong> só mostra os textos
              que alguém do time aprovou.
            </p>
          </div>
        </div>

        {/* Nova leva */}
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-rl-muted mb-1 block">
              Nome da leva (o cliente vê)
            </label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="input-field w-full text-sm"
              maxLength={160}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-rl-muted">
                Copies sem peça ({selecionados.size}/{candidatos.length})
              </label>
              {candidatos.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelecionados(new Set(candidatos.map((ad) => ad.id)))}
                    className="text-[10px] text-rl-muted hover:text-rl-purple transition-colors"
                  >
                    Selecionar todas
                  </button>
                  <button
                    onClick={() => setSelecionados(new Set())}
                    className="text-[10px] text-rl-muted hover:text-rl-purple transition-colors"
                  >
                    Limpar
                  </button>
                </div>
              )}
            </div>
            {candidatos.length === 0 ? (
              <p className="text-xs text-rl-muted rounded-xl border border-dashed border-rl-border px-3 py-4 text-center">
                Nenhuma copy livre agora: as que estão sem peça já estão numa leva ou foram aprovadas.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                {candidatos.map((ad) => {
                  const Icone = ad.tipo === 'video' ? Video : ImageIcon
                  const reprovada = ad.copyAprovacao?.status === 'reprovado' || ad.copyAprovacao?.status === 'reprovado_interno'
                  return (
                    <label
                      key={ad.id}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-all ${
                        selecionados.has(ad.id)
                          ? 'border-rl-purple/40 bg-rl-purple/5'
                          : 'border-rl-border bg-rl-surface/30'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selecionados.has(ad.id)}
                        onChange={() => alternar(ad.id)}
                        className="accent-rl-purple"
                      />
                      <Icone className="w-3.5 h-3.5 text-rl-muted shrink-0" />
                      <span className="font-mono text-xs text-rl-text flex-1 truncate" title={ad.nome}>{ad.nome}</span>
                      {reprovada && <span className="text-[9px] font-bold text-red-500 shrink-0">reprovada antes</span>}
                      <span className="text-[10px] text-rl-muted shrink-0 tabular-nums">{fmtDateBR(dataDoAd(ad))}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <button
              onClick={criarLeva}
              disabled={selecionados.size === 0}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl bg-rl-purple text-white shadow-glow hover:bg-rl-purple/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Link2 className="w-4 h-4" /> Criar leva e copiar o link interno
            </button>
          </div>
        </div>

        {/* Levas da Central */}
        {levas.length > 0 && (
          <div className="space-y-3 pt-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rl-muted">
              Levas ({levas.length})
            </p>
            {levas.map((leva) => (
              <LevaCentral
                key={leva.id}
                leva={leva}
                copiado={copiado}
                onCopiarInterno={() => copiar(linkDaRevisao(leva.token), `${leva.token}|interno`, 'Link da revisão interna copiado!')}
                onCopiarCliente={() => copiar(linkDaLeva(leva.token), `${leva.token}|cliente`, 'Link do cliente copiado!')}
                onExcluir={() => excluirLeva(leva)}
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

const CHIPS = [
  ['revisao',          'em revisão',            'text-rl-purple bg-rl-purple/10 border-rl-purple/30'],
  ['reprovadoInterno', 'reprovadas na revisão', 'text-red-500 bg-red-500/10 border-red-500/30'],
  ['comCliente',       'com o cliente',         'text-rl-gold bg-rl-gold/10 border-rl-gold/30'],
  ['aprovado',         'aprovadas pelo cliente', 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30'],
  ['reprovado',        'reprovadas pelo cliente', 'text-red-500 bg-red-500/10 border-red-500/30'],
]

function LevaCentral({ leva, copiado, onCopiarInterno, onCopiarCliente, onExcluir }) {
  const r = resumoDaLeva(leva)
  const total = (leva.itens || []).length
  const liberadas = r.comCliente + r.aprovado + r.reprovado
  return (
    <div className="rounded-xl border border-rl-border bg-rl-surface/30 px-4 py-3 space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-rl-text truncate">{leva.nome}</p>
          <p className="text-[11px] text-rl-muted mt-0.5">
            {total} {total === 1 ? 'texto' : 'textos'} · criada em {fmtDateTimeBR(leva.criadoEm)}
          </p>
        </div>
        <button
          onClick={onExcluir}
          className="p-1.5 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all shrink-0"
          title="Excluir leva"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {CHIPS.map(([k, rotulo, cls]) => (r[k] ? (
          <span key={k} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>
            {r[k]} {rotulo}
          </span>
        ) : null))}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <BotaoLink ativo={copiado === `${leva.token}|interno`} onClick={onCopiarInterno} rotulo="Link interno" />
        <BotaoLink
          ativo={copiado === `${leva.token}|cliente`}
          onClick={onCopiarCliente}
          rotulo="Link do cliente"
          desabilitado={liberadas === 0}
          dica={liberadas === 0 ? 'Libera quando alguém do time aprovar um texto na revisão' : undefined}
        />
      </div>
    </div>
  )
}

function BotaoLink({ ativo, onClick, rotulo, desabilitado = false, dica }) {
  return (
    <button
      onClick={onClick}
      disabled={desabilitado}
      title={dica}
      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-rl-purple/10 border border-rl-purple/30 text-rl-purple hover:bg-rl-purple/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {ativo ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {ativo ? 'Copiado!' : rotulo}
    </button>
  )
}
