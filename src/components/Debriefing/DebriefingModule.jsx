import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  Megaphone, Plus, Pencil, Trash2, ExternalLink, Video, Image as ImageIcon, Layers,
  Filter, X, Clock, Play, CheckCircle2, Paperclip, FlaskConical, Link2, Send, Palette,
  FileText, ChevronDown, Folder, FolderOpen, ShieldCheck,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../hooks/useToast'
import { deleteFile } from '../../lib/supabase'
import Toast from '../UI/Toast'
import DebriefingAdModal, { TIPOS_ANUNCIO, flattenCampaigns } from './DebriefingAdModal'
import CreativeTestModal from './CreativeTestModal'
import GrupoAnunciosModal from './GrupoAnunciosModal'
import AnexoPreview from '../UI/AnexoPreview'
import { arquivosDoAd, resumoArquivos, FORMATOS } from './arquivosCriativo'
import { FUNNELS } from '../Kickoff/KickoffFunnelRecommendations'
import {
  STATUS_OPTIONS, STATUS_BY_ID, RESULTADO_BY_ID, APROVACAO_BY_ID,
  ETAPAS, etapaDoAd, dataDoAd, agruparPorMes, agruparPorSemana, semanaDoMes, agruparPorPasta,
  pastasDoProjeto, normalizarPasta,
  fmtDateBR, fmtDateTimeBR, todayISO,
} from './debriefingData'
import { linkDaLeva, linkDaRevisao, podeIrPraRevisao } from '../../lib/copyLevas'
import CentralAprovacaoModal from './CentralAprovacaoModal'
import { useI18n } from '../../i18n'

const ATTACHMENT_BUCKET = 'attachments'

const EMPTY = { ads: [] }
const TIPO_ICON = { video: Video, imagem: ImageIcon, carrossel: Layers }
const STATUS_ICON = {
  rascunho: FileText,
  aprovado_edicao: Palette,
  para_subir: Clock,
  em_andamento: Play,
  finalizado: CheckCircle2,
}

export default function DebriefingModule({ project }) {
  const { updateProject } = useApp()
  const { toast, showToast } = useToast()
  const { t, lang } = useI18n()

  const persisted = project.debriefing || EMPTY
  const [editingAd, setEditingAd] = useState(null) // ad obj | {} | null
  const [showTest, setShowTest] = useState(false)  // modal "Subir teste no Meta"
  const [showGrupo, setShowGrupo] = useState(false) // modal "Grupo de anúncios"
  // Modal "Aprovação de copy" (revisão do time e depois o cliente): ids que já vêm marcados.
  const [aprovacaoCopy, setAprovacaoCopy] = useState(null)
  const [menuNovo, setMenuNovo] = useState(false)   // dropdown do "Novo anúncio"
  const [verArquivos, setVerArquivos] = useState(null) // { anexos, indice } na pré-visualização
  const [filterTipo,    setFilterTipo]    = useState('')
  const [filterFunil,   setFilterFunil]   = useState('')
  const [filterStatus,  setFilterStatus]  = useState('')
  // Aba atual: design pronto | ads para aprovação
  const [etapa, setEtapa] = useState('design')
  const [linkCopiado, setLinkCopiado] = useState(false)

  const ads = useMemo(() => persisted.ads || [], [persisted.ads])
  const campaigns = useMemo(() => flattenCampaigns(project.campaignPlan), [project.campaignPlan])

  // Quantos anúncios em cada aba (contagem sempre do total, ignora os filtros).
  const contagemPorEtapa = useMemo(() => {
    const acc = { design: 0, aprovacao: 0 }
    for (const ad of ads) acc[etapaDoAd(ad)] += 1
    return acc
  }, [ads])

  // Ordena por data de criação (do mais recente pro mais antigo),
  // aplica a aba e depois os filtros
  const visibleAds = useMemo(() => {
    return ads
      .slice()
      .sort((a, b) => (dataDoAd(b) || '').localeCompare(dataDoAd(a) || ''))
      .filter((ad) => {
        if (etapaDoAd(ad) !== etapa) return false
        if (filterTipo && ad.tipo !== filterTipo) return false
        if (filterFunil && ad.funilId !== filterFunil) return false
        if (filterStatus && (ad.status || 'para_subir') !== filterStatus) return false
        return true
      })
  }, [ads, etapa, filterTipo, filterFunil, filterStatus])

  // Blocos por mês de criação, do mais recente pro mais antigo ("Sem data" no fim)
  // `lang` refaz o rótulo do mês ("Outubro 2026" / "October 2026") ao trocar o idioma.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const grupos = useMemo(() => agruparPorMes(visibleAds), [visibleAds, lang])
  // Meses recolhidos (chave yyyy-mm ou 'sem-data'); todos nascem abertos.
  const [recolhidos, setRecolhidos] = useState(() => new Set())
  const chaveDoMes = (grupo) => grupo.chave || 'sem-data'
  const mesAtual = todayISO().slice(0, 7)
  function alternarMes(chave) {
    setRecolhidos((prev) => {
      const next = new Set(prev)
      if (next.has(chave)) next.delete(chave)
      else next.add(chave)
      return next
    })
  }

  // Semanas dentro do mês (chave yyyy-mm|sN); todas nascem abertas.
  const [semanasRecolhidas, setSemanasRecolhidas] = useState(() => new Set())
  const semanaAtual = semanaDoMes(todayISO())?.chave
  function alternarSemana(chave) {
    setSemanasRecolhidas((prev) => {
      const next = new Set(prev)
      if (next.has(chave)) next.delete(chave)
      else next.add(chave)
      return next
    })
  }

  // Pastas dentro da semana (ad.pasta). Nascem recolhidas; as que a pessoa abre
  // ficam lembradas neste navegador, por projeto. A chave é semana|pasta
  // ('sem-data|pasta' para quem não tem data).
  const chavePastasLS = `central.pastasAbertas.${project.id}`
  const [pastasAbertas, setPastasAbertas] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(chavePastasLS) || '[]')) } catch { return new Set() }
  })
  function mudarPastasAbertas(fn) {
    setPastasAbertas((prev) => {
      const next = fn(new Set(prev))
      try { localStorage.setItem(chavePastasLS, JSON.stringify([...next])) } catch { /* sem storage: só não lembra */ }
      return next
    })
  }
  function alternarPasta(chave) {
    mudarPastasAbertas((abertas) => {
      if (abertas.has(chave)) abertas.delete(chave)
      else abertas.add(chave)
      return abertas
    })
  }
  // Abre a pasta pra onde os anúncios foram (salvar, mover, grupo novo).
  function abrirPastasDe(lista) {
    const chaves = lista
      .filter((ad) => normalizarPasta(ad.pasta))
      .map((ad) => `${semanaDoMes(dataDoAd(ad))?.chave || 'sem-data'}|${normalizarPasta(ad.pasta)}`)
    if (chaves.length) mudarPastasAbertas((abertas) => { chaves.forEach((c) => abertas.add(c)); return abertas })
  }
  const pastas = useMemo(() => pastasDoProjeto(ads), [ads])
  const [renomeando, setRenomeando] = useState(null) // { chave, valor }
  const cancelouRenomeio = useRef(false)

  // Seleção pelas caixas da tabela, pra mover vários de uma vez. Só conta o
  // que está visível na aba e nos filtros atuais.
  const [selecionados, setSelecionados] = useState(() => new Set())
  const [pastaDestino, setPastaDestino] = useState('')
  const selecionadosVisiveis = visibleAds.filter((ad) => selecionados.has(ad.id))
  function selecionar(ids, marcar) {
    setSelecionados((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => (marcar ? next.add(id) : next.delete(id)))
      return next
    })
  }

  const isAprovacao = etapa === 'aprovacao'

  function copiarLink(url) {
    navigator.clipboard?.writeText(url)
      .then(() => { setLinkCopiado(true); setTimeout(() => setLinkCopiado(false), 2000) })
      .catch(() => {})
  }

  function persist(next) {
    updateProject(project.id, { debriefing: next })
  }

  function handleSaveAd(ad) {
    const list = persisted.ads || []
    const exists = list.some((x) => x.id === ad.id)
    const next = exists
      ? list.map((x) => (x.id === ad.id ? ad : x))
      : [...list, ad]
    persist({ ...persisted, ads: next })
    setEditingAd(null)
    abrirPastasDe([ad])
    showToast(exists ? t('central.anuncioAtualizado') : t('central.anuncioCadastrado'))
  }

  // Grupo de anúncios: entram todos de uma vez, já com os arquivos no Storage.
  function handleSaveGrupo(novos, grupo) {
    persist({ ...persisted, ads: [...(persisted.ads || []), ...novos] })
    setShowGrupo(false)
    setEtapa('design')
    abrirPastasDe(novos)
    showToast(t('central.grupoCriado', { count: novos.length, nome: grupo.nome }))
  }

  function handleDelete(id) {
    if (!window.confirm(t('central.confirmarExcluir'))) return
    const target = (persisted.ads || []).find((x) => x.id === id)
    // Remove os arquivos do Storage (best-effort) pra não deixar lixo
    for (const arq of arquivosDoAd(target)) {
      deleteFile(ATTACHMENT_BUCKET, arq.path).catch(() => {})
    }
    const next = (persisted.ads || []).filter((x) => x.id !== id)
    persist({ ...persisted, ads: next })
    showToast(t('central.anuncioRemovido'))
  }

  // Atualiza um campo único de um anúncio (edição inline na tabela).
  // Quando muda status, aplica a mesma lógica de auto-data do modal.
  function updateAd(id, patch) {
    const list = persisted.ads || []
    const next = list.map((x) => {
      if (x.id !== id) return x
      const merged = { ...x, ...patch, updatedAt: new Date().toISOString() }
      // Auto-data ao mudar status
      if ('status' in patch) {
        const today = todayISO()
        if (patch.status === 'em_andamento' && !merged.startedAt) merged.startedAt = today
        if (patch.status === 'finalizado') {
          if (!merged.startedAt)  merged.startedAt  = today
          if (!merged.finishedAt) merged.finishedAt = today
        }
      }
      return merged
    })
    persist({ ...persisted, ads: next })
  }

  // Muda vários anúncios de uma vez (mover pra pasta, renomear pasta).
  function updateAds(ids, patch) {
    const alvo = new Set(ids)
    const now = new Date().toISOString()
    const next = (persisted.ads || []).map((x) => (alvo.has(x.id) ? { ...x, ...patch, updatedAt: now } : x))
    persist({ ...persisted, ads: next })
    return next.filter((x) => alvo.has(x.id))
  }

  function moverParaPasta(nome) {
    const pasta = normalizarPasta(nome) || null
    const ids = selecionadosVisiveis.map((ad) => ad.id)
    if (!ids.length) return
    abrirPastasDe(updateAds(ids, { pasta }))
    setSelecionados(new Set())
    setPastaDestino('')
    const n = ids.length
    showToast(pasta
      ? t('central.movidos', { count: n, pasta })
      : t('central.sairamDaPasta', { count: n }))
  }

  // Renomear vale pro projeto todo: a pasta é o mesmo nome em qualquer mês.
  function renomearPasta(antiga, nova) {
    setRenomeando(null)
    const nome = normalizarPasta(nova)
    if (!antiga || !nome || nome === antiga) return
    const ids = (persisted.ads || []).filter((ad) => normalizarPasta(ad.pasta) === antiga).map((ad) => ad.id)
    updateAds(ids, { pasta: nome })
    mudarPastasAbertas((abertas) => new Set([...abertas].map((c) => (c.endsWith(`|${antiga}`) ? c.slice(0, -antiga.length) + nome : c))))
    showToast(t('central.pastaRenomeada', { nome }))
  }

  // ── Link público de aprovação (mesmo client_share_token de /campanhas etc.) ─
  function getOrCreateShareToken() {
    if (project.clientShareToken) return project.clientShareToken
    const token = crypto.randomUUID()
    updateProject(project.id, { clientShareToken: token })
    return token
  }

  function handleShareAprovacao() {
    const token = getOrCreateShareToken()
    if (!token) return
    const url = `${window.location.origin}/aprovacao/${token}`
    navigator.clipboard.writeText(url)
      .then(() => showToast(t('central.linkAprovacaoCopiado')))
      .catch(() => showToast(t('central.link', { url })))
  }

  // Fila do designer: copy aprovada pelo cliente, peça ainda não produzida.
  const paraEditar = useMemo(
    () => ads.filter((ad) => ad.status === 'aprovado_edicao'),
    [ads]
  )

  const hasFilters = filterTipo || filterFunil || filterStatus

  // Uma linha da tabela (o mesmo anúncio aparece solto ou dentro da pasta).
  function renderLinha(ad) {
    const TipoIcon = TIPO_ICON[ad.tipo] || Layers
    const status = STATUS_BY_ID[ad.status || 'para_subir']
    const StatusIcon = STATUS_ICON[ad.status || 'para_subir'] || Clock
    const resultado = ad.resultado ? RESULTADO_BY_ID[ad.resultado] : null
    const dtStr = fmtDateBR(dataDoAd(ad))
    const arquivos = arquivosDoAd(ad)

    return (
      <tr
        key={ad.id}
        onClick={() => setEditingAd(ad)}
        className={`border-b border-rl-border/40 hover:bg-rl-surface/40 cursor-pointer transition-colors ${selecionados.has(ad.id) ? 'bg-rl-purple/5' : ''}`}
      >
        <td className="pl-3 py-2.5 w-8" onClick={(e) => e.stopPropagation()}>
          <Caixa marcada={selecionados.has(ad.id)} onChange={() => selecionar([ad.id], !selecionados.has(ad.id))} label={t('central.selecionar', { nome: ad.nome || t('central.anuncio') })} />
        </td>
        <Td className="whitespace-nowrap text-rl-subtle">{dtStr}</Td>
        {/* Nome comprido (títulos de roteiro) quebrava a linha
            inteira: limita a largura e corta em 2 linhas. */}
        <Td className="font-mono text-xs font-semibold text-rl-text min-w-[220px] max-w-[300px]">
          <span className="flex items-start gap-1.5">
            <span className="line-clamp-2 break-words" title={ad.nome || ''}>
              {ad.nome || '—'}
            </span>
            {(ad.version || 1) > 1 && (
              <span
                className="font-sans shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rl-purple/10 text-rl-purple border border-rl-purple/30"
                title={t('central.versoesAnteriores', { count: ad.versionHistory?.length || 0 })}
              >
                v{ad.version}
              </span>
            )}
            {ad.copy && (
              <span
                className="font-sans shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rl-blue/10 text-rl-blue border border-rl-blue/30"
                title={t('central.copyTagDica')}
              >
                {t('central.copyTag')}
              </span>
            )}
            {ad.grupo?.nome && ad.grupo.nome !== ad.pasta && (
              <span
                className="font-sans shrink-0 max-w-[110px] truncate text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rl-surface text-rl-subtle border border-rl-border"
                title={t('central.subidoNoGrupo', { nome: ad.grupo.nome })}
              >
                {ad.grupo.nome}
              </span>
            )}
          </span>
        </Td>
        <Td>
          <InlineSelect
            value={ad.tipo || ''}
            onChange={(v) => updateAd(ad.id, { tipo: v })}
            options={TIPOS_ANUNCIO.map((tp) => ({ value: tp.id, label: tp.label }))}
            color="#7C3AED"
            bgColor="rgba(124,58,237,0.10)"
            borderColor="rgba(124,58,237,0.30)"
            LeftIcon={TipoIcon}
          />
        </Td>
        <Td>
          <AprovacaoCell
            ad={ad}
            mostrarCopy={isAprovacao}
            onEnviar={() => {
              // Só copy (sem peça): passa pela revisão do time antes do cliente.
              if (isAprovacao) { setAprovacaoCopy({ ids: [ad.id] }); return }
              updateAd(ad.id, { aprovacao: { status: 'pendente', enviadoEm: new Date().toISOString() } })
              showToast(t('central.enviadoAprovacao'))
            }}
          />
        </Td>
        <Td>
          <div className="flex flex-col items-start gap-1">
            <InlineSelect
              value={ad.status || 'para_subir'}
              onChange={(v) => updateAd(ad.id, { status: v })}
              options={STATUS_OPTIONS.map((s) => ({ value: s.id, label: s.label }))}
              color={status.color}
              bgColor={status.bgColor}
              borderColor={status.borderColor}
              LeftIcon={StatusIcon}
            />
            {resultado && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap"
                style={{
                  color: resultado.color,
                  background: resultado.bgColor,
                  borderColor: resultado.borderColor,
                }}
                title={ad.justificativa || ''}
              >
                <span>{resultado.emoji}</span> {resultado.label}
              </span>
            )}
            {ad.status === 'em_andamento' && ad.startedAt && (
              <span className="text-[9px] text-rl-muted whitespace-nowrap">
                {t('central.desde', { data: fmtDateBR(ad.startedAt) })}
              </span>
            )}
            {ad.status === 'finalizado' && ad.finishedAt && (
              <span className="text-[9px] text-rl-muted whitespace-nowrap">
                {t('central.fim', { data: fmtDateBR(ad.finishedAt) })}
              </span>
            )}
          </div>
        </Td>
        <Td className="text-xs">
          <InlineSelect
            value={ad.campanhaId || ''}
            onChange={(v) => updateAd(ad.id, { campanhaId: v })}
            options={[
              { value: '', label: t('central.semCampanha') },
              ...campaigns.map((c) => ({
                value: c.id,
                label: `[${c.stageLabel}] ${c.name}${c.channel ? ' · ' + c.channel : ''}`,
              })),
            ]}
            color="#0F172A"
            bgColor="#F8FAFC"
            borderColor="#E2E8F0"
            textPlaceholder={t('central.semCampanha')}
          />
        </Td>
        <Td>
          <InlineSelect
            value={ad.funilId || ''}
            onChange={(v) => updateAd(ad.id, { funilId: v })}
            options={[
              { value: '', label: t('central.semFunil') },
              ...FUNNELS.map((f) => ({ value: f.id, label: `${f.icon} ${f.label}` })),
            ]}
            color="#2563EB"
            bgColor="rgba(37,99,235,0.08)"
            borderColor="rgba(37,99,235,0.25)"
            textPlaceholder={t('central.semFunil')}
          />
        </Td>
        <Td>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Na aba de aprovação, o link útil é o da etapa em que a copy
                está: a revisão do time ou a leva que o cliente recebeu. */}
            {isAprovacao && ad.copyAprovacao?.status === 'revisao' && ad.copyAprovacao?.token && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  copiarLink(linkDaRevisao(ad.copyAprovacao.token))
                  showToast(t('central.linkRevisaoCopiado'))
                }}
                className="inline-flex items-center gap-1 text-xs text-rl-purple font-semibold hover:underline"
                title={t('central.copiarLinkRevisao', { nome: ad.copyAprovacao.levaNome || '' })}
              >
                <Link2 className="w-3 h-3" /> {t('central.linkInterno')}
              </button>
            )}
            {isAprovacao && ad.copyAprovacao?.status === 'pendente' && ad.copyAprovacao?.token && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  copiarLink(linkDaLeva(ad.copyAprovacao.token))
                  showToast(t('central.linkClienteCopiado'))
                }}
                className="inline-flex items-center gap-1 text-xs text-rl-purple font-semibold hover:underline"
                title={t('central.copiarLinkLeva', { nome: ad.copyAprovacao.levaNome || '' })}
              >
                <Link2 className="w-3 h-3" /> {t('central.linkDaLeva')}
              </button>
            )}
            {ad.url ? (
              <a
                href={ad.url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs text-rl-purple font-semibold hover:underline"
              >
                <ExternalLink className="w-3 h-3" /> {t('central.linkCurto')}
              </a>
            ) : (
              !arquivos.length && <span className="text-rl-muted italic text-xs">—</span>
            )}
            {/* Arquivos do criativo (feed, story, cards): abre a
                pré-visualização e navega entre eles. */}
            {arquivos.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setVerArquivos({ anexos: arquivos, indice: 0 }) }}
                className="inline-flex items-center gap-1 text-xs text-rl-blue font-semibold hover:underline whitespace-nowrap"
                title={arquivos.map((a) => `${FORMATOS[a.formato]?.label || t('central.arquivo')}: ${a.name}`).join('\n')}
              >
                <Paperclip className="w-3 h-3" /> {resumoArquivos(arquivos)}
              </button>
            )}
          </div>
        </Td>
        <Td className="max-w-[200px]">
          {ad.observacao ? (
            <span className="text-[11px] text-rl-subtle line-clamp-2" title={ad.observacao}>
              {ad.observacao}
            </span>
          ) : (
            <span className="text-rl-muted italic text-xs">—</span>
          )}
        </Td>
        <Td>
          <div className="flex items-center gap-1 justify-end">
            <button
              onClick={(e) => { e.stopPropagation(); setEditingAd(ad) }}
              className="p-1.5 rounded-lg text-rl-muted hover:text-rl-purple hover:bg-rl-purple/10 transition-all"
              title={t('comum.editar')}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(ad.id) }}
              className="p-1.5 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
              title={t('comum.excluir')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </Td>
      </tr>
    )
  }

  // ▾ Semana 1  01/11 a 07/11  10 criativos, com as pastas da semana embaixo.
  function renderSemana(sg) {
    const aberta = !semanasRecolhidas.has(sg.chave)
    const ids = sg.ads.map((a) => a.id)
    const nSel = ids.filter((id) => selecionados.has(id)).length
    // Copies da semana que ainda não foram pra revisão (aba de aprovação).
    const livres = isAprovacao ? sg.ads.filter(podeIrPraRevisao) : []
    return (
      <Fragment key={sg.chave}>
        <tr className="border-b border-rl-border/40">
          <td className="pl-3 py-2 w-8">
            <Caixa
              marcada={nSel > 0 && nSel === ids.length}
              parcial={nSel > 0 && nSel < ids.length}
              onChange={() => selecionar(ids, nSel < ids.length)}
              label={t('central.selecionarSemana', { semana: sg.rotulo })}
            />
          </td>
          <td colSpan={10} className="py-1.5 pr-3">
            <span className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => alternarSemana(sg.chave)}
                aria-expanded={aberta}
                aria-label={aberta ? t('central.recolherSemana', { semana: sg.rotulo }) : t('central.expandirSemana', { semana: sg.rotulo })}
                className="flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-rl-surface transition-all"
              >
                <ChevronDown className={`w-3.5 h-3.5 text-rl-muted transition-transform duration-150 ${aberta ? '' : '-rotate-90'}`} />
                <span className={`text-xs font-semibold ${sg.chave === semanaAtual ? 'text-rl-purple' : 'text-rl-text'}`}>
                  {sg.rotulo}
                </span>
                <span className="text-xs text-rl-subtle tabular-nums">{sg.periodo}</span>
              </button>
              <span className="text-xs text-rl-muted tabular-nums">
                {t('central.nCriativos', { count: sg.ads.length })}
              </span>
              {livres.length > 0 && (
                <button
                  type="button"
                  onClick={() => setAprovacaoCopy({ ids: livres.map((a) => a.id) })}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-rl-purple/30 text-rl-purple hover:bg-rl-purple/10 transition-all"
                  title={t('central.enviarLevaDica')}
                >
                  <ShieldCheck className="w-3 h-3" /> {t('central.enviarNAprovacao', { count: livres.length })}
                </button>
              )}
            </span>
          </td>
        </tr>
        {aberta && renderPastas(sg.ads, sg.chave, true)}
      </Fragment>
    )
  }

  // Pastas de um trecho (a semana, ou "Sem data"). Sem pasta nenhuma, as
  // linhas ficam soltas. `escopo` entra na chave da pasta aberta.
  function renderPastas(lista, escopo, dentroDaSemana = false) {
    return agruparPorPasta(lista).map((pg, j, todas) => {
      if (todas.length === 1 && !pg.pasta) return pg.ads.map(renderLinha)
      const chaveP = `${escopo}|${pg.pasta || ''}`
      const aberta = pastasAbertas.has(chaveP)
      const idsP = pg.ads.map((a) => a.id)
      const nSel = idsP.filter((id) => selecionados.has(id)).length
      return (
        <Fragment key={chaveP}>
          <tr className="border-b border-rl-border/40 bg-rl-surface/30">
            <td className="pl-3 py-2 w-8">
              <Caixa
                marcada={nSel > 0 && nSel === idsP.length}
                parcial={nSel > 0 && nSel < idsP.length}
                onChange={() => selecionar(idsP, nSel < idsP.length)}
                label={t('central.selecionarPasta', { nome: pg.rotulo })}
              />
            </td>
            <td colSpan={10} className={`py-1.5 pr-3 ${dentroDaSemana ? 'pl-5' : ''}`}>
              <span className="group/pasta flex items-center gap-2">
                {renomeando?.chave === chaveP ? (
                  <span className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-rl-purple shrink-0" />
                    <input
                      autoFocus
                      value={renomeando.valor}
                      onChange={(e) => setRenomeando({ ...renomeando, valor: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur()
                        if (e.key === 'Escape') { e.stopPropagation(); cancelouRenomeio.current = true; setRenomeando(null) }
                      }}
                      onBlur={() => {
                        if (cancelouRenomeio.current) { cancelouRenomeio.current = false; return }
                        renomearPasta(pg.pasta, renomeando.valor)
                      }}
                      className="input-field text-xs py-1 px-2 w-64"
                      maxLength={60}
                    />
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => alternarPasta(chaveP)}
                    aria-expanded={aberta}
                    className="flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-rl-surface transition-all"
                  >
                    <ChevronDown className={`w-3.5 h-3.5 text-rl-muted transition-transform duration-150 ${aberta ? '' : '-rotate-90'}`} />
                    {aberta
                      ? <FolderOpen className="w-4 h-4 text-rl-purple shrink-0" />
                      : <Folder className="w-4 h-4 text-rl-purple shrink-0" />}
                    <span className={`text-[13px] font-semibold ${pg.pasta ? 'text-rl-text' : 'text-rl-muted italic'}`}>{pg.rotulo}</span>
                  </button>
                )}
                <span className="text-xs text-rl-muted tabular-nums">
                  {t('central.nCriativos', { count: pg.ads.length })}
                </span>
                {pg.pasta && renomeando?.chave !== chaveP && (
                  <button
                    type="button"
                    onClick={() => { cancelouRenomeio.current = false; setRenomeando({ chave: chaveP, valor: pg.pasta }) }}
                    className="p-1 rounded text-rl-muted opacity-0 group-hover/pasta:opacity-100 hover:text-rl-purple transition-all"
                    title={t('central.renomearPasta')}
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </span>
            </td>
          </tr>
          {aberta && pg.ads.map(renderLinha)}
        </Fragment>
      )
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-rl-purple/10 flex items-center justify-center shrink-0">
          <Megaphone className="w-5 h-5 text-rl-purple" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-black text-rl-text leading-tight">{t('central.titulo')}</h2>
          <p className="text-sm text-rl-subtle mt-0.5 max-w-2xl">
            {t('central.subtitulo')}
          </p>
        </div>
      </div>

      {/* Abas: as duas visualizações da central */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-rl-surface border border-rl-border w-fit max-w-full overflow-x-auto">
        {ETAPAS.map((e) => (
          <button
            key={e.id}
            onClick={() => setEtapa(e.id)}
            title={e.desc}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              etapa === e.id
                ? 'bg-rl-purple text-white shadow-sm'
                : 'text-rl-muted hover:text-rl-text'
            }`}
          >
            {e.label}
            <span className={`ml-1.5 text-[10px] font-bold ${etapa === e.id ? 'text-white/70' : 'text-rl-muted'}`}>
              {contagemPorEtapa[e.id]}
            </span>
          </button>
        ))}
      </div>
      <p className="-mt-3 text-xs text-rl-muted">
        {ETAPAS.find((e) => e.id === etapa)?.desc}
      </p>

      {/* Fila do designer: copies que o cliente aprovou e ainda não viraram peça */}
      {paraEditar.length > 0 && (
        <button
          onClick={() => {
            const ativo = etapa === 'aprovacao' && filterStatus === 'aprovado_edicao'
            setEtapa('aprovacao')
            setFilterStatus(ativo ? '' : 'aprovado_edicao')
          }}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
            filterStatus === 'aprovado_edicao'
              ? 'border-rl-purple/50 bg-rl-purple/10'
              : 'border-rl-purple/30 bg-rl-purple/5 hover:bg-rl-purple/10'
          }`}
        >
          <Palette className="w-4 h-4 text-rl-purple shrink-0" />
          <span className="text-sm text-rl-text">
            <strong className="font-bold">{paraEditar.length}</strong>{' '}
            {t('central.filaDesigner', { count: paraEditar.length })}
          </span>
          <span className="ml-auto text-[11px] font-semibold text-rl-purple shrink-0">
            {filterStatus === 'aprovado_edicao' ? t('central.mostrarTodos') : t('central.verFila')}
          </span>
        </button>
      )}

      {/* Toolbar: filtros + novo */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-rl-muted">
            <Filter className="w-3.5 h-3.5" /> {t('central.filtros')}
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input-field text-xs py-1.5 pl-3 pr-8 w-auto"
          >
            <option value="">{t('central.todosStatus')}</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            className="input-field text-xs py-1.5 pl-3 pr-8 w-auto"
          >
            <option value="">{t('central.todosTipos')}</option>
            {TIPOS_ANUNCIO.map((tp) => (
              <option key={tp.id} value={tp.id}>{tp.label}</option>
            ))}
          </select>
          <select
            value={filterFunil}
            onChange={(e) => setFilterFunil(e.target.value)}
            className="input-field text-xs py-1.5 pl-3 pr-8 w-auto"
          >
            <option value="">{t('central.todosFunis')}</option>
            {FUNNELS.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
          {hasFilters && (
            <button
              onClick={() => { setFilterTipo(''); setFilterFunil(''); setFilterStatus('') }}
              className="text-[10px] text-rl-muted hover:text-rl-red transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" /> {t('comum.limpar')}
            </button>
          )}
          <span className="text-xs text-rl-muted ml-1">
            {t('central.nAnuncios', { count: visibleAds.length })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Na aba de aprovação o que existe é copy: o link passa pela revisão
              do time. Peça pronta continua no link de sempre do cliente. */}
          <button
            onClick={isAprovacao ? () => setAprovacaoCopy({ ids: selecionadosVisiveis.map((ad) => ad.id) }) : handleShareAprovacao}
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border border-rl-border text-rl-subtle hover:text-rl-purple hover:border-rl-purple/40 transition-all"
            title={isAprovacao
              ? t('central.linkAprovacaoDicaCopy')
              : t('central.linkAprovacaoDica')}
          >
            <Link2 className="w-4 h-4" /> {t('central.linkAprovacao')}
          </button>
          <button
            onClick={() => setShowTest(true)}
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border border-rl-purple/40 text-rl-purple hover:bg-rl-purple/10 transition-all"
          >
            <FlaskConical className="w-4 h-4" /> {t('central.subirTeste')}
          </button>
          <div className="relative">
            <button
              onClick={() => setMenuNovo((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-rl-purple text-white shadow-glow hover:bg-rl-purple/90 transition-all"
            >
              <Plus className="w-4 h-4" /> {t('central.novoAnuncio')}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${menuNovo ? 'rotate-180' : ''}`} />
            </button>
            {menuNovo && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuNovo(false)} />
                <div className="absolute right-0 z-20 mt-1 w-72 rounded-xl border border-rl-border bg-rl-surface shadow-2xl p-1">
                  <MenuItem
                    Icon={Plus}
                    titulo={t('central.anuncioUnico')}
                    texto={t('central.anuncioUnicoTexto')}
                    onClick={() => { setMenuNovo(false); setEditingAd({}) }}
                  />
                  <MenuItem
                    Icon={Layers}
                    titulo={t('central.grupoAnuncios')}
                    texto={t('central.grupoAnunciosTexto')}
                    onClick={() => { setMenuNovo(false); setShowGrupo(true) }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Selecionados: mover pra uma pasta */}
      {selecionadosVisiveis.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap px-4 py-2.5 rounded-xl border border-rl-purple/30 bg-rl-purple/5">
          <span className="text-sm font-semibold text-rl-text">
            {t('central.nSelecionados', { count: selecionadosVisiveis.length })}
          </span>
          <span className="text-xs text-rl-muted ml-2">{t('central.moverParaPasta')}</span>
          <input
            list="central-pastas"
            value={pastaDestino}
            onChange={(e) => setPastaDestino(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && normalizarPasta(pastaDestino)) moverParaPasta(pastaDestino) }}
            placeholder={t('central.pastaPlaceholder')}
            className="input-field text-xs py-1.5 px-3 w-64"
            maxLength={60}
          />
          <datalist id="central-pastas">
            {pastas.map((p) => <option key={p} value={p} />)}
          </datalist>
          <button
            onClick={() => moverParaPasta(pastaDestino)}
            disabled={!normalizarPasta(pastaDestino)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-rl-purple text-white hover:bg-rl-purple/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FolderOpen className="w-3.5 h-3.5" /> {t('central.mover')}
          </button>
          {selecionadosVisiveis.some((ad) => normalizarPasta(ad.pasta)) && (
            <button
              onClick={() => moverParaPasta('')}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-rl-border text-rl-subtle hover:text-rl-text transition-all"
            >
              {t('central.tirarDaPasta')}
            </button>
          )}
          {isAprovacao && selecionadosVisiveis.some(podeIrPraRevisao) && (
            <button
              onClick={() => setAprovacaoCopy({ ids: selecionadosVisiveis.filter(podeIrPraRevisao).map((ad) => ad.id) })}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-rl-purple/40 text-rl-purple hover:bg-rl-purple/10 transition-all"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {t('central.enviarNAprovacao', { count: selecionadosVisiveis.filter(podeIrPraRevisao).length })}
            </button>
          )}
          <button
            onClick={() => setSelecionados(new Set())}
            className="ml-auto text-xs text-rl-muted hover:text-rl-text flex items-center gap-1 transition-colors"
          >
            <X className="w-3 h-3" /> {t('central.limparSelecao')}
          </button>
        </div>
      )}

      {/* Tabela */}
      {ads.length === 0 ? (
        <EmptyState onCreate={() => setEditingAd({})} />
      ) : visibleAds.length === 0 ? (
        <div className="rounded-xl border border-dashed border-rl-border bg-rl-surface/30 py-10 text-center">
          <p className="text-sm text-rl-muted">
            {hasFilters
              ? t('central.nenhumComFiltros')
              : isAprovacao
                ? t('central.vazioAprovacao')
                : t('central.vazioDesign')}
          </p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            {/* Uma tabela só (as colunas ficam alinhadas entre os meses), com
                cada mês separado como os grupos da lista de tarefas. */}
            <table className="w-full text-sm">
              {grupos.map((grupo, i) => (
                <tbody key={chaveDoMes(grupo)}>
                  {/* ▾ Outubro 2026  14 criativos (os visíveis nesta aba, com os filtros) */}
                  <tr>
                    <td colSpan={11} className={`px-2 pb-1 ${i === 0 ? 'pt-2' : 'pt-8'}`}>
                      <span className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => alternarMes(chaveDoMes(grupo))}
                          aria-expanded={!recolhidos.has(chaveDoMes(grupo))}
                          aria-label={recolhidos.has(chaveDoMes(grupo)) ? t('central.expandirMes') : t('central.recolherMes')}
                          className="w-5 h-5 rounded flex items-center justify-center text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all"
                        >
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${recolhidos.has(chaveDoMes(grupo)) ? '-rotate-90' : ''}`} />
                        </button>
                        <span className={`text-[13px] font-semibold ${grupo.chave === mesAtual ? 'text-rl-purple' : 'text-rl-text'}`}>
                          {grupo.rotulo}
                        </span>
                        <span className="text-xs text-rl-muted tabular-nums">
                          {t('central.nCriativos', { count: grupo.ads.length })}
                        </span>
                      </span>
                    </td>
                  </tr>
                  {/* Cabeçalho das colunas, repetido em cada mês */}
                  {!recolhidos.has(chaveDoMes(grupo)) && (
                    <tr className="border-b border-rl-border">
                      <th className="pl-3 w-8">
                        <Caixa
                          marcada={grupo.ads.length > 0 && grupo.ads.every((a) => selecionados.has(a.id))}
                          parcial={grupo.ads.some((a) => selecionados.has(a.id))}
                          onChange={() => selecionar(grupo.ads.map((a) => a.id), !grupo.ads.every((a) => selecionados.has(a.id)))}
                          label={t('central.selecionar', { nome: grupo.rotulo })}
                        />
                      </th>
                      <Th className="w-24">{t('central.colunas.data')}</Th>
                      <Th className="min-w-[220px]">{t('central.colunas.nome')}</Th>
                      <Th>{t('central.colunas.tipo')}</Th>
                      <Th>{t('central.colunas.aprovacao')}</Th>
                      <Th>{t('central.colunas.status')}</Th>
                      <Th>{t('central.colunas.campanha')}</Th>
                      <Th>{t('central.colunas.funil')}</Th>
                      <Th>{isAprovacao ? t('central.colunas.linkCliente') : t('central.colunas.link')}</Th>
                      <Th>{t('central.colunas.obs')}</Th>
                      <Th className="w-20"></Th>
                    </tr>
                  )}
                  {!recolhidos.has(chaveDoMes(grupo)) && (grupo.chave
                    ? agruparPorSemana(grupo.ads).map(renderSemana)
                    : renderPastas(grupo.ads, 'sem-data'))}
                </tbody>
              ))}
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {editingAd !== null && (
        <DebriefingAdModal
          initial={editingAd.id ? editingAd : null}
          campaignPlan={project.campaignPlan}
          projectId={project.id}
          existingAdsCount={ads.length}
          pastas={pastas}
          onSave={handleSaveAd}
          onClose={() => setEditingAd(null)}
        />
      )}

      {aprovacaoCopy && (
        <CentralAprovacaoModal
          project={project}
          preselecionados={aprovacaoCopy.ids}
          onClose={() => { setAprovacaoCopy(null); setSelecionados(new Set()) }}
          onToast={showToast}
        />
      )}

      {showTest && (
        <CreativeTestModal
          project={project}
          onClose={() => setShowTest(false)}
          onToast={showToast}
        />
      )}

      {showGrupo && (
        <GrupoAnunciosModal
          projectId={project.id}
          campaignPlan={project.campaignPlan}
          existingAds={ads}
          pastas={pastas}
          onSave={handleSaveGrupo}
          onClose={() => setShowGrupo(false)}
        />
      )}

      {verArquivos && (
        <AnexoPreview
          anexos={verArquivos.anexos}
          indice={verArquivos.indice}
          bucket={ATTACHMENT_BUCKET}
          onFechar={() => setVerArquivos(null)}
        />
      )}

      <Toast toast={toast} />
    </div>
  )
}

// Caixa de seleção da tabela; `parcial` mostra o traço quando só parte do
// mês ou da pasta está marcada.
function Caixa({ marcada, parcial = false, onChange, label }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = parcial && !marcada
  }, [parcial, marcada])
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={!!marcada}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      aria-label={label}
      className="w-3.5 h-3.5 cursor-pointer accent-[#7C3AED] align-middle"
    />
  )
}

function MenuItem({ Icon, titulo, texto, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-left hover:bg-rl-purple/10 transition-all"
    >
      <Icon className="w-4 h-4 mt-0.5 text-rl-purple shrink-0" />
      <span>
        <span className="text-sm font-semibold text-rl-text block">{titulo}</span>
        <span className="text-[11px] text-rl-muted">{texto}</span>
      </span>
    </button>
  )
}

// ─── Pequenos subcomponentes ──────────────────────────────────────────────────

// Célula de aprovação do cliente: badge do status ou botão "Enviar" quando o
// anúncio ainda não foi mandado pro link público de aprovação. Na aba de
// aprovação também mostra quando quem está com o cliente é a COPY, não a peça.
const COPY_BADGE = {
  // Revisão interna (levas da Central): o time aprova antes do cliente ver.
  // Rótulo em central.copyBadge.<chave> (a chave é o copyAprovacao.status gravado).
  revisao:   { cls: 'border-rl-purple/30 bg-rl-purple/10 text-rl-purple' },
  reprovado_interno: { cls: 'border-red-500/30 bg-red-500/10 text-red-500' },
  pendente:  { cls: 'border-rl-gold/30 bg-rl-gold/10 text-rl-gold' },
  aprovado:  { cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' },
  // O cliente ajustou o texto antes de aprovar: a copy do anúncio já é a dele.
  aprovado_editado: { cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' },
  reprovado: { cls: 'border-red-500/30 bg-red-500/10 text-red-500' },
}

function AprovacaoCell({ ad, onEnviar, mostrarCopy = false }) {
  const { t } = useI18n()
  const info = ad.aprovacao ? APROVACAO_BY_ID[ad.aprovacao.status] : null

  // Na aba de aprovação o que importa é a resposta do cliente sobre a COPY —
  // a peça ainda nem existe. Quando ela existir, o anúncio muda de aba.
  const st = ad.copyAprovacao?.status
  const copyKey = st === 'aprovado' && ad.copyAprovacao?.editado ? 'aprovado_editado' : st
  const copyBadge = mostrarCopy ? COPY_BADGE[copyKey] : null
  if (copyBadge) {
    const esperando = st === 'pendente' || st === 'revisao'
    const marcoCopy = esperando ? ad.copyAprovacao.enviadoEm : ad.copyAprovacao.decididoEm
    const revisor = ad.copyAprovacao.revisao?.por?.nome
    const tooltip = st === 'reprovado' || st === 'reprovado_interno'
      ? [
          st === 'reprovado_interno' && revisor ? t('central.reprovadaPor', { nome: revisor }) : null,
          t('central.motivo', { texto: ad.copyAprovacao.motivo || '—' }),
          t('central.comoDeveria', { texto: ad.copyAprovacao.sugestao || '—' }),
        ].filter(Boolean).join('\n')
      : copyKey === 'aprovado_editado'
        ? t('central.clienteAjustou')
        : st === 'pendente' && revisor
          ? t('central.liberadaPor', { nome: revisor })
          : undefined
    return (
      <div className="flex flex-col items-start gap-0.5">
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${copyBadge.cls}`}
          title={tooltip}
        >
          {st === 'revisao' ? <ShieldCheck className="w-3 h-3" /> : <FileText className="w-3 h-3" />} {t(`central.copyBadge.${copyKey}`)}
        </span>
        {marcoCopy && (
          <span className="text-[9px] text-rl-muted whitespace-nowrap">
            {esperando ? t('central.desdePrefixo') : ''}{fmtDateTimeBR(marcoCopy)}
          </span>
        )}
        {/* Reprovada (pelo time ou pelo cliente): dá pra mandar de novo depois de corrigir. */}
        {(st === 'reprovado' || st === 'reprovado_interno') && ad.copy && (
          <button
            onClick={(e) => { e.stopPropagation(); onEnviar() }}
            className="text-[9px] font-semibold text-rl-purple hover:underline"
          >
            {t('central.enviarDeNovo')}
          </button>
        )}
      </div>
    )
  }

  // Aba de aprovação sem texto: não há o que aprovar ainda.
  if (mostrarCopy && !info && !String(ad.copy || '').trim()) {
    return <span className="text-[10px] text-rl-muted italic" title={t('central.semCopyDica')}>{t('central.semCopy')}</span>
  }

  if (!info) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onEnviar() }}
        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border border-rl-border text-rl-muted hover:text-rl-purple hover:border-rl-purple/40 transition-all whitespace-nowrap"
        title={mostrarCopy
          ? t('central.enviarDicaCopy')
          : t('central.enviarDica')}
      >
        <Send className="w-3 h-3" /> {t('comum.enviar')}
      </button>
    )
  }

  const tooltip = ad.aprovacao.status === 'reprovado'
    ? `${t('central.motivo', { texto: ad.aprovacao.motivo || '—' })}\n${t('central.comoDeveria', { texto: ad.aprovacao.sugestao || '—' })}`
    : undefined

  // Data/hora relevante pro status: pendente → quando enviamos; decidido → quando o cliente decidiu.
  const marco = ad.aprovacao.status === 'pendente' ? ad.aprovacao.enviadoEm : ad.aprovacao.decididoEm

  return (
    <div className="flex flex-col items-start gap-0.5">
      <span
        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap"
        style={{ color: info.color, background: info.bgColor, borderColor: info.borderColor }}
        title={tooltip}
      >
        {info.label}
      </span>
      {marco && (
        <span className="text-[9px] text-rl-muted whitespace-nowrap">
          {fmtDateTimeBR(marco)}
        </span>
      )}
    </div>
  )
}

function Th({ children, className = '' }) {
  return (
    <th className={`text-left text-[11px] font-medium text-rl-muted px-3 h-8 whitespace-nowrap ${className}`}>
      {children}
    </th>
  )
}
function Td({ children, className = '', onClick }) {
  return (
    <td className={`px-3 py-2.5 align-middle ${className}`} onClick={onClick}>
      {children}
    </td>
  )
}

// InlineSelect: dropdown estilizado como chip pra edição inline na tabela.
// Stop-propagation no click pra não disparar o onClick da linha (que abre o modal).
function InlineSelect({
  value, onChange, options = [],
  color = '#0F172A', bgColor = '#F8FAFC', borderColor = '#E2E8F0',
  LeftIcon = null,
  textPlaceholder = null,
}) {
  const isEmpty = !value
  const displayColor = isEmpty && textPlaceholder ? '#94A3B8' : color
  const displayBg    = isEmpty && textPlaceholder ? 'transparent' : bgColor
  const displayBorder= isEmpty && textPlaceholder ? '#E2E8F0' : borderColor

  return (
    <div
      className="relative inline-block"
      onClick={(e) => e.stopPropagation()}
    >
      {LeftIcon && !isEmpty && (
        <LeftIcon
          className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none"
          style={{ color: displayColor }}
        />
      )}
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none cursor-pointer text-[11px] font-bold rounded-full border focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-white focus:ring-rl-purple/30 transition-all ${
          LeftIcon && !isEmpty ? 'pl-7' : 'pl-2.5'
        } pr-6 py-0.5`}
        style={{
          color: displayColor,
          background: displayBg,
          borderColor: displayBorder,
          fontStyle: isEmpty && textPlaceholder ? 'italic' : 'normal',
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <svg
        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        style={{ color: displayColor }}
        aria-hidden
      >
        <path d="M3 5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function EmptyState({ onCreate }) {
  const { t } = useI18n()
  return (
    <div className="rounded-xl border border-dashed border-rl-border bg-rl-surface/30 py-10 px-6 text-center space-y-3">
      <Megaphone className="w-8 h-8 text-rl-muted/40 mx-auto" />
      <div>
        <p className="text-sm font-semibold text-rl-text">
          {t('central.vazioTitulo')}
        </p>
        <p className="text-xs text-rl-muted mt-1 max-w-md mx-auto">
          {t('central.vazioTexto')}
        </p>
      </div>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-rl-purple text-white shadow-glow hover:bg-rl-purple/90 transition-all"
      >
        <Plus className="w-4 h-4" /> {t('central.adicionarPrimeiro')}
      </button>
    </div>
  )
}
