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
import { t as tSolto, useI18n } from '../../i18n'

// "Roteiros da semana de 01/11 a 07/11" quando todos são da mesma semana. É só a
// sugestão do campo (a pessoa edita); o nome gravado na leva é o que ficar no campo.
function nomeSugerido(ads) {
  const video = ads.length > 0 && ads.every((ad) => ad.tipo === 'video')
  const base = video ? tSolto('central.levas.nomeRoteiros') : tSolto('central.levas.nomeCopies')
  const semanas = new Set(ads.map((ad) => semanaDoMes(dataDoAd(ad))?.periodo).filter(Boolean))
  if (semanas.size === 1) return tSolto('central.levas.nomeSemana', { base, periodo: [...semanas][0] })
  return tSolto('central.levas.nomeData', { base, data: fmtDateBR(new Date().toISOString().slice(0, 10)) })
}

export default function CentralAprovacaoModal({ project, preselecionados = [], onClose, onToast }) {
  const { updateProject } = useApp()
  const { t } = useI18n()
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
      .catch(() => onToast?.(t('central.link', { url })))
  }

  function criarLeva() {
    const escolhidos = candidatos.filter((ad) => selecionados.has(ad.id))
    if (!escolhidos.length) return
    const { leva, patch } = montarEnvioDeLeva({ project, ads: escolhidos, nome, revisaoInterna: true })
    updateProject(project.id, patch)
    setSelecionados(new Set())
    setNome(nomeSugerido([]))
    copiar(linkDaRevisao(leva.token), `${leva.token}|interno`, t('central.levas.criadaCopiado'))
  }

  function excluirLeva(leva) {
    if (!window.confirm(t('central.levas.confirmarExcluir'))) return
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
    onToast?.(t('central.levas.removida'))
  }

  return (
    <Modal onClose={onClose} maxWidth="2xl">
      <div className="p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rl-purple/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-rl-purple" />
          </div>
          <div>
            <h3 className="text-lg font-black text-rl-text leading-tight">{t('central.levas.titulo')}</h3>
            <p className="text-xs text-rl-muted mt-0.5 max-w-lg">
              {t('central.levas.intro1')}<strong className="text-rl-text">{t('central.levas.linkInterno')}</strong>
              {t('central.levas.intro2')}<strong className="text-rl-text">{t('central.levas.linkCliente')}</strong>
              {t('central.levas.intro3')}
            </p>
          </div>
        </div>

        {/* Nova leva */}
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-rl-muted mb-1 block">
              {t('central.levas.nomeLeva')}
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
                {t('central.levas.copiesSemPeca', { sel: selecionados.size, total: candidatos.length })}
              </label>
              {candidatos.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelecionados(new Set(candidatos.map((ad) => ad.id)))}
                    className="text-[10px] text-rl-muted hover:text-rl-purple transition-colors"
                  >
                    {t('central.levas.selecionarTodas')}
                  </button>
                  <button
                    onClick={() => setSelecionados(new Set())}
                    className="text-[10px] text-rl-muted hover:text-rl-purple transition-colors"
                  >
                    {t('comum.limpar')}
                  </button>
                </div>
              )}
            </div>
            {candidatos.length === 0 ? (
              <p className="text-xs text-rl-muted rounded-xl border border-dashed border-rl-border px-3 py-4 text-center">
                {t('central.levas.nenhumaLivre')}
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
                      {reprovada && <span className="text-[9px] font-bold text-red-500 shrink-0">{t('central.levas.reprovadaAntes')}</span>}
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
              <Link2 className="w-4 h-4" /> {t('central.levas.criar')}
            </button>
          </div>
        </div>

        {/* Levas da Central */}
        {levas.length > 0 && (
          <div className="space-y-3 pt-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rl-muted">
              {t('central.levas.tituloLevas', { count: levas.length })}
            </p>
            {levas.map((leva) => (
              <LevaCentral
                key={leva.id}
                leva={leva}
                copiado={copiado}
                onCopiarInterno={() => copiar(linkDaRevisao(leva.token), `${leva.token}|interno`, t('central.linkRevisaoCopiado'))}
                onCopiarCliente={() => copiar(linkDaLeva(leva.token), `${leva.token}|cliente`, t('central.linkClienteCopiado'))}
                onExcluir={() => excluirLeva(leva)}
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

// Chaves de resumoDaLeva; o rótulo vem de central.levas.chips.<chave>.
const CHIPS = [
  ['revisao',          'text-rl-purple bg-rl-purple/10 border-rl-purple/30'],
  ['reprovadoInterno', 'text-red-500 bg-red-500/10 border-red-500/30'],
  ['comCliente',       'text-rl-gold bg-rl-gold/10 border-rl-gold/30'],
  ['aprovado',         'text-emerald-500 bg-emerald-500/10 border-emerald-500/30'],
  ['reprovado',        'text-red-500 bg-red-500/10 border-red-500/30'],
]

function LevaCentral({ leva, copiado, onCopiarInterno, onCopiarCliente, onExcluir }) {
  const { t } = useI18n()
  const r = resumoDaLeva(leva)
  const total = (leva.itens || []).length
  const liberadas = r.comCliente + r.aprovado + r.reprovado
  return (
    <div className="rounded-xl border border-rl-border bg-rl-surface/30 px-4 py-3 space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-rl-text truncate">{leva.nome}</p>
          <p className="text-[11px] text-rl-muted mt-0.5">
            {t('central.levas.nTextos', { count: total })} · {t('central.levas.criadaEm', { data: fmtDateTimeBR(leva.criadoEm) })}
          </p>
        </div>
        <button
          onClick={onExcluir}
          className="p-1.5 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all shrink-0"
          title={t('central.levas.excluir')}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {CHIPS.map(([k, cls]) => (r[k] ? (
          <span key={k} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>
            {r[k]} {t(`central.levas.chips.${k}`)}
          </span>
        ) : null))}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <BotaoLink ativo={copiado === `${leva.token}|interno`} onClick={onCopiarInterno} rotulo={t('central.levas.linkInternoBotao')} />
        <BotaoLink
          ativo={copiado === `${leva.token}|cliente`}
          onClick={onCopiarCliente}
          rotulo={t('central.levas.linkClienteBotao')}
          desabilitado={liberadas === 0}
          dica={liberadas === 0 ? t('central.levas.liberaDica') : undefined}
        />
      </div>
    </div>
  )
}

function BotaoLink({ ativo, onClick, rotulo, desabilitado = false, dica }) {
  const { t } = useI18n()
  return (
    <button
      onClick={onClick}
      disabled={desabilitado}
      title={dica}
      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-rl-purple/10 border border-rl-purple/30 text-rl-purple hover:bg-rl-purple/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {ativo ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {ativo ? t('comum.copiado') : rotulo}
    </button>
  )
}
