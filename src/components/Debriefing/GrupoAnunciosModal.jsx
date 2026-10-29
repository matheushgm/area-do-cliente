// "Grupo de anúncios": sobe vários criativos já prontos de uma vez.
//   • Posts separados: cada peça vira um anúncio. O feed e o story da mesma
//     peça entram no MESMO anúncio (dois arquivos), pareados pelo nome do
//     arquivo; o formato sai da proporção da imagem/vídeo.
//   • Carrossel: um anúncio só, com os arquivos como cards, na ordem.
// Antes de criar, a pessoa revisa os pares e arrasta um arquivo pra outro
// criativo quando o nome não bastou pra juntar.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  X, Upload, Loader2, Layers, LayoutGrid, ArrowLeft, ArrowRight, Scissors, Trash2,
  Video, Image as ImageIcon,
} from 'lucide-react'
import Modal from '../UI/Modal'
import { FUNNELS } from '../Kickoff/KickoffFunnelRecommendations'
import { flattenCampaigns, TIPOS_ANUNCIO, Field } from './DebriefingAdModal'
import { STATUS_BY_ID, DEFAULT_STATUS, fmtDateBR, todayISO } from './debriefingData'
import {
  ATTACHMENT_BUCKET, FORMATOS, midiaDoArquivo, lerMedidas, formatoDoArquivo, parearFeedStory,
  caminhoArquivo, espelhoLegado,
} from './arquivosCriativo'
import { uploadFile } from '../../lib/supabase'

const ETAPAS_NOME = ['TOPO', 'MEIO', 'FUNDO']
// Peças prontas entram na fila de subir ou já rodando; "Finalizado" exige
// resultado e justificativa, que só fazem sentido anúncio a anúncio.
const STATUS_GRUPO = ['para_subir', 'em_andamento']
const MAX_CARDS_META = 10

// Próximo AD### do dia: continua a numeração dos anúncios que já têm o mesmo
// sufixo _DD.MM no nome, pra não repetir AD001 no mesmo dia.
function proximoNumero(ads, dataISO) {
  const [, mm, dd] = String(dataISO || '').split('-')
  const sufixo = `_${dd}.${mm}`
  let max = 0
  for (const ad of ads || []) {
    const nome = String(ad?.nome || '').toUpperCase()
    if (!nome.endsWith(sufixo)) continue
    const m = nome.match(/_AD(\d+)/)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return max + 1
}

function nomePadrao({ etapa, tipo, num, dataISO }) {
  const [, mm, dd] = String(dataISO || '').split('-')
  const code = TIPOS_ANUNCIO.find((t) => t.id === tipo)?.code || 'AD'
  return `${etapa}_${code}_AD${String(num).padStart(3, '0')}_${dd}.${mm}`
}

// Roda `fn` em cada item com no máximo `n` ao mesmo tempo.
async function emLotes(lista, n, fn) {
  let i = 0
  const trabalhador = async () => { while (i < lista.length) await fn(lista[i++]) }
  await Promise.all(Array.from({ length: Math.min(n, lista.length) }, trabalhador))
}

// Criativos de "posts separados" a partir dos itens. `anteriores` preserva id e
// nome digitado de quem continua com o mesmo arquivo.
function paraCriativos(lista, anteriores = []) {
  return parearFeedStory(lista).map(({ feed, story }) => {
    const antigo = anteriores.find((c) => (feed && c.feed === feed.uid) || (story && c.story === story.uid))
    return {
      id:          antigo?.id || crypto.randomUUID(),
      feed:        feed?.uid || null,
      story:       story?.uid || null,
      nome:        antigo?.nomeEditado ? antigo.nome : '',
      nomeEditado: !!antigo?.nomeEditado,
    }
  })
}

export default function GrupoAnunciosModal({ projectId, campaignPlan, existingAds = [], onSave, onClose }) {
  const campaigns = useMemo(() => flattenCampaigns(campaignPlan), [campaignPlan])
  const inputRef = useRef(null)
  const grupoId = useMemo(() => crypto.randomUUID(), [])

  const [modo, setModo] = useState('posts')
  const [itens, setItens] = useState([])          // arquivos escolhidos, com File e prévia local
  const [criativos, setCriativos] = useState([])  // posts: [{ id, feed: uid, story: uid, nome, nomeEditado }]
  const [carrossel, setCarrossel] = useState(() => ({ id: crypto.randomUUID(), nome: '', nomeEditado: false }))
  const [ajustado, setAjustado] = useState(false) // mexeu nos pares à mão: arquivo novo não refaz tudo
  const [lendo, setLendo] = useState(false)
  const [arrastandoArquivo, setArrastandoArquivo] = useState(false)
  const [comum, setComum] = useState({
    nomeGrupo: '', createdAt: todayISO(), etapa: 'FUNDO', campanhaId: '', funilId: '',
    status: DEFAULT_STATUS, observacao: '',
  })
  const [enviarAprovacao, setEnviarAprovacao] = useState(true)
  const [progresso, setProgresso] = useState(null) // { feitos, total } durante o upload
  const [erro, setErro] = useState('')

  // Libera as prévias locais ao fechar.
  const itensRef = useRef(itens)
  useEffect(() => { itensRef.current = itens }, [itens])
  useEffect(() => () => itensRef.current.forEach((it) => URL.revokeObjectURL(it.preview)), [])

  const porUid = useMemo(() => Object.fromEntries(itens.map((it) => [it.uid, it])), [itens])
  const setC = (campo, valor) => setComum((prev) => ({ ...prev, [campo]: valor }))

  const primeiroNum = useMemo(() => proximoNumero(existingAds, comum.createdAt), [existingAds, comum.createdAt])
  const tipoDe = (c) => ([c.feed, c.story].some((uid) => porUid[uid]?.midia === 'video') ? 'video' : 'imagem')
  const nomeDe = (c, i) => (c.nomeEditado
    ? c.nome
    : nomePadrao({ etapa: comum.etapa, tipo: tipoDe(c), num: primeiroNum + i, dataISO: comum.createdAt }))
  const nomeCarrossel = carrossel.nomeEditado
    ? carrossel.nome
    : nomePadrao({ etapa: comum.etapa, tipo: 'carrossel', num: primeiroNum, dataISO: comum.createdAt })

  // ── Arquivos ─────────────────────────────────────────────────────────────
  async function adicionarArquivos(fileList) {
    const files = [...(fileList || [])].filter((f) => ['image', 'video'].includes(midiaDoArquivo(f)))
    if (!files.length) {
      setErro('Só imagem e vídeo entram no grupo.')
      return
    }
    setErro('')
    setLendo(true)
    const novos = await Promise.all(files.map(async (file) => {
      const med = await lerMedidas(file)
      return {
        uid: crypto.randomUUID(), file, name: file.name, preview: URL.createObjectURL(file), path: null,
        ...med, formato: formatoDoArquivo({ name: file.name, ...med }),
      }
    }))
    setLendo(false)
    const todos = [...itens, ...novos]
    setItens(todos)
    setCriativos((prev) => (ajustado ? [...prev, ...paraCriativos(novos)] : paraCriativos(todos, prev)))
  }

  function removerArquivo(uid) {
    const it = porUid[uid]
    if (it) URL.revokeObjectURL(it.preview)
    setItens((prev) => prev.filter((x) => x.uid !== uid))
    setCriativos((prev) => prev
      .map((c) => ({ ...c, feed: c.feed === uid ? null : c.feed, story: c.story === uid ? null : c.story }))
      .filter((c) => c.feed || c.story))
  }

  // Solta um arquivo num slot (feed/story) de um criativo. Se o slot estava
  // ocupado, os dois trocam de lugar; o formato passa a ser o do slot.
  function mover(uid, destinoId, slot) {
    setCriativos((prev) => {
      const origem = prev.find((c) => c.feed === uid || c.story === uid)
      if (!origem) return prev
      const slotOrigem = origem.feed === uid ? 'feed' : 'story'
      if (origem.id === destinoId && slotOrigem === slot) return prev
      const next = prev.map((c) => ({ ...c }))
      const o = next.find((c) => c.id === origem.id)
      const d = next.find((c) => c.id === destinoId)
      const ocupante = d[slot]
      d[slot] = uid
      o[slotOrigem] = ocupante || null
      return next.filter((c) => c.feed || c.story)
    })
    setAjustado(true)
  }

  function separar(c) {
    setCriativos((prev) => prev.flatMap((x) => (x.id === c.id
      ? [{ ...x, story: null }, { id: crypto.randomUUID(), feed: null, story: x.story, nome: '', nomeEditado: false }]
      : [x])))
    setAjustado(true)
  }

  function moverCard(uid, delta) {
    setItens((prev) => {
      const i = prev.findIndex((x) => x.uid === uid)
      const j = i + delta
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  // ── Criar ────────────────────────────────────────────────────────────────
  const planos = modo === 'carrossel'
    ? (itens.length ? [{ adId: carrossel.id, nome: nomeCarrossel, tipo: 'carrossel', arquivos: itens.map((it) => ({ uid: it.uid, formato: 'card' })) }] : [])
    : criativos.map((c, i) => ({
      adId: c.id, nome: nomeDe(c, i), tipo: tipoDe(c),
      arquivos: [c.feed && { uid: c.feed, formato: 'feed' }, c.story && { uid: c.story, formato: 'story' }].filter(Boolean),
    }))

  const pares = criativos.filter((c) => c.feed && c.story).length
  const bloqueio = !itens.length
    ? 'Adicione os arquivos do grupo.'
    : modo === 'carrossel' && itens.length < 2
      ? 'O carrossel precisa de pelo menos 2 cards.'
      : planos.some((p) => !p.nome.trim())
        ? 'Todo anúncio precisa de nome.'
        : ''

  async function criar() {
    if (bloqueio || progresso) return
    if (!projectId) { setErro('Projeto sem ID. Recarregue a página antes de subir.'); return }
    setErro('')
    const tarefas = planos.flatMap((p) => p.arquivos.map((a) => ({ ...a, adId: p.adId })))
    const pendentes = tarefas.filter((t) => !porUid[t.uid].path)
    const caminhos = {}
    let falhas = 0
    setProgresso({ feitos: tarefas.length - pendentes.length, total: tarefas.length })
    await emLotes(pendentes, 3, async (t) => {
      const it = porUid[t.uid]
      const path = caminhoArquivo(projectId, t.adId, t.formato, it.name)
      const ok = await uploadFile(ATTACHMENT_BUCKET, path, it.file).catch(() => null)
      if (ok) caminhos[t.uid] = path
      else falhas += 1
      setProgresso((p) => ({ ...p, feitos: p.feitos + 1 }))
    })
    // Guarda o que já subiu: tentar de novo só reenvia o que falhou.
    setItens((prev) => prev.map((it) => (caminhos[it.uid] ? { ...it, path: caminhos[it.uid] } : it)))
    if (falhas) {
      setProgresso(null)
      setErro(`${falhas} ${falhas === 1 ? 'arquivo não subiu' : 'arquivos não subiram'}. Clique em criar de novo pra reenviar só ${falhas === 1 ? 'ele' : 'eles'}.`)
      return
    }

    const now = new Date().toISOString()
    const hoje = todayISO()
    const grupo = {
      id: grupoId,
      nome: comum.nomeGrupo.trim() || `Grupo de ${fmtDateBR(comum.createdAt)}`,
      modo,
      criadoEm: now,
    }
    const ads = planos.map((p) => {
      const arquivos = p.arquivos.map((a) => {
        const it = porUid[a.uid]
        return {
          path: caminhos[a.uid] || it.path, name: it.name, formato: a.formato,
          midia: it.midia, largura: it.largura, altura: it.altura,
        }
      })
      return {
        id:             p.adId,
        createdAt:      comum.createdAt,
        nome:           p.nome.trim(),
        tipo:           p.tipo,
        campanhaId:     comum.campanhaId,
        funilId:        comum.funilId,
        observacao:     comum.observacao.trim(),
        status:         comum.status,
        startedAt:      comum.status === 'em_andamento' ? hoje : null,
        finishedAt:     null,
        resultado:      null,
        justificativa:  '',
        url:            '',
        arquivos,
        ...espelhoLegado(arquivos),
        aprovacao:      enviarAprovacao ? { status: 'pendente', enviadoEm: now } : null,
        version:        1,
        versionHistory: [],
        grupo,
        addedAt:        now,
        updatedAt:      now,
      }
    })
    onSave(ads, grupo)
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const subindo = !!progresso
  return (
    <Modal onClose={subindo ? undefined : onClose} maxWidth="4xl">
      <div className="flex items-start justify-between gap-4 mb-4 pb-4 border-b border-rl-border">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-rl-muted font-bold mb-1">Novo grupo de anúncios</p>
          <h3 className="text-lg font-black text-rl-text leading-tight">Subir vários criativos de uma vez</h3>
        </div>
        <button
          onClick={onClose}
          disabled={subindo}
          className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all shrink-0 disabled:opacity-40"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="max-h-[65vh] overflow-y-auto pr-1 space-y-5">
        {/* Modo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <ModoBotao
            ativo={modo === 'posts'}
            onClick={() => setModo('posts')}
            Icon={LayoutGrid}
            titulo="Posts separados"
            texto="Cada peça vira um anúncio. O feed e o story da mesma peça ficam juntos no mesmo criativo."
          />
          <ModoBotao
            ativo={modo === 'carrossel'}
            onClick={() => setModo('carrossel')}
            Icon={Layers}
            titulo="Carrossel"
            texto="Um anúncio só, com os arquivos como cards, na ordem que você deixar."
          />
        </div>

        {/* Área de upload */}
        <div
          onClick={() => !lendo && !subindo && inputRef.current?.click()}
          onDragOver={(e) => {
            if (![...e.dataTransfer.types].includes('Files')) return
            e.preventDefault()
            setArrastandoArquivo(true)
          }}
          onDragLeave={() => setArrastandoArquivo(false)}
          onDrop={(e) => {
            if (![...e.dataTransfer.types].includes('Files')) return
            e.preventDefault()
            setArrastandoArquivo(false)
            if (!lendo && !subindo) adicionarArquivos(e.dataTransfer.files)
          }}
          className={`w-full flex flex-col items-center justify-center gap-1 px-4 py-5 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
            arrastandoArquivo ? 'border-rl-purple/60 bg-rl-purple/10 text-rl-purple' : 'border-rl-border text-rl-muted hover:border-rl-purple/40 hover:text-rl-purple'
          }`}
        >
          {lendo
            ? <span className="flex items-center gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Lendo as medidas dos arquivos...</span>
            : <span className="flex items-center gap-2 text-sm font-semibold"><Upload className="w-4 h-4" /> {itens.length ? 'Adicionar mais arquivos' : 'Arraste os arquivos aqui ou clique pra escolher'}</span>}
          <span className="text-[11px] text-rl-muted">
            Imagens e vídeos. 9:16 entra como story; quadrado e 4:5 como feed.
          </span>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={(e) => { adicionarArquivos(e.target.files); e.target.value = '' }}
            className="hidden"
          />
        </div>

        {/* Revisão */}
        {itens.length > 0 && modo === 'posts' && (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <p className="text-xs font-bold text-rl-text uppercase tracking-wide">
                {criativos.length} {criativos.length === 1 ? 'criativo' : 'criativos'}
                <span className="ml-1.5 normal-case font-normal text-rl-muted">
                  · {itens.length} {itens.length === 1 ? 'arquivo' : 'arquivos'}, {pares} com feed e story
                </span>
              </p>
              <p className="text-[11px] text-rl-muted">
                Arraste um arquivo pra outro criativo pra juntar ou trocar. O formato é o da coluna onde ele fica.
              </p>
            </div>
            <div className="rounded-xl border border-rl-border divide-y divide-rl-border/60">
              {criativos.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="text-[11px] font-bold text-rl-muted w-5 text-right shrink-0">{i + 1}</span>
                  <Slot item={porUid[c.feed]} formato="feed" onSoltar={(uid) => mover(uid, c.id, 'feed')} onRemover={removerArquivo} />
                  <Slot item={porUid[c.story]} formato="story" onSoltar={(uid) => mover(uid, c.id, 'story')} onRemover={removerArquivo} />
                  <div className="flex-1 min-w-0 space-y-1">
                    <input
                      type="text"
                      value={nomeDe(c, i)}
                      onChange={(e) => setCriativos((prev) => prev.map((x) => (x.id === c.id ? { ...x, nome: e.target.value, nomeEditado: true } : x)))}
                      className="input-field w-full font-mono text-xs py-1.5"
                      maxLength={80}
                    />
                    <p className="text-[10px] text-rl-muted truncate" title={[porUid[c.feed]?.name, porUid[c.story]?.name].filter(Boolean).join(' + ')}>
                      {tipoDe(c) === 'video' ? <Video className="w-3 h-3 inline -mt-0.5" /> : <ImageIcon className="w-3 h-3 inline -mt-0.5" />}{' '}
                      {[porUid[c.feed]?.name, porUid[c.story]?.name].filter(Boolean).join(' + ')}
                    </p>
                  </div>
                  {c.feed && c.story && (
                    <button
                      type="button"
                      onClick={() => separar(c)}
                      className="p-1.5 rounded-lg text-rl-muted hover:text-rl-purple hover:bg-rl-purple/10 transition-all shrink-0"
                      title="Separar: o story vira outro criativo"
                    >
                      <Scissors className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {itens.length > 0 && modo === 'carrossel' && (
          <div className="space-y-2">
            <Field label="Nome do anúncio" required>
              <input
                type="text"
                value={nomeCarrossel}
                onChange={(e) => setCarrossel((prev) => ({ ...prev, nome: e.target.value, nomeEditado: true }))}
                className="input-field w-full font-mono text-sm"
                maxLength={80}
              />
            </Field>
            <p className="text-xs font-bold text-rl-text uppercase tracking-wide">
              {itens.length} {itens.length === 1 ? 'card' : 'cards'}
              {itens.length > MAX_CARDS_META && (
                <span className="ml-2 normal-case font-semibold text-rl-gold">O Meta aceita até {MAX_CARDS_META} cards por carrossel.</span>
              )}
            </p>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {itens.map((it, i) => (
                <div key={it.uid} className="shrink-0 w-28 space-y-1">
                  <div className="relative w-28 h-28 rounded-lg overflow-hidden border border-rl-border bg-rl-surface">
                    <Miniatura item={it} />
                    <span className="absolute top-1 left-1 text-[10px] font-bold px-1.5 rounded bg-black/60 text-white">{i + 1}</span>
                    <button
                      type="button"
                      onClick={() => removerArquivo(it.uid)}
                      className="absolute top-1 right-1 p-0.5 rounded bg-black/60 text-white hover:bg-red-500/80"
                      title="Tirar do carrossel"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <button type="button" onClick={() => moverCard(it.uid, -1)} disabled={i === 0} className="p-1 rounded text-rl-muted hover:text-rl-purple disabled:opacity-30" title="Mover pra esquerda">
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] text-rl-muted truncate" title={it.name}>{it.name}</span>
                    <button type="button" onClick={() => moverCard(it.uid, 1)} disabled={i === itens.length - 1} className="p-1 rounded text-rl-muted hover:text-rl-purple disabled:opacity-30" title="Mover pra direita">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dados que valem pro grupo todo */}
        <div className="space-y-3 pt-1">
          <p className="text-xs font-bold text-rl-text uppercase tracking-wide">Vale pra todos os anúncios do grupo</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nome do grupo" hint="Pra achar o lote depois. Ex.: Estáticos de novembro">
              <input
                type="text"
                value={comum.nomeGrupo}
                onChange={(e) => setC('nomeGrupo', e.target.value)}
                placeholder={`Grupo de ${fmtDateBR(comum.createdAt)}`}
                className="input-field w-full"
                maxLength={80}
              />
            </Field>
            <Field label="Data de criação" required>
              <input
                type="date"
                value={comum.createdAt}
                onChange={(e) => setC('createdAt', e.target.value || todayISO())}
                className="input-field w-full"
              />
            </Field>
            <Field label="Campanha">
              <select
                value={comum.campanhaId}
                onChange={(e) => {
                  const camp = campaigns.find((c) => c.id === e.target.value)
                  setComum((prev) => ({ ...prev, campanhaId: e.target.value, etapa: camp?.stageCode || prev.etapa }))
                }}
                disabled={campaigns.length === 0}
                className="input-field w-full"
              >
                <option value="">— sem campanha vinculada —</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>[{c.stageLabel}] {c.name}{c.channel ? ` · ${c.channel}` : ''}</option>
                ))}
              </select>
            </Field>
            <Field label="Etapa no nome" hint="Começo do nome padrão (FUNDO_IMG_AD001_DD.MM).">
              <select value={comum.etapa} onChange={(e) => setC('etapa', e.target.value)} className="input-field w-full">
                {ETAPAS_NOME.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </Field>
            <Field label="Funil">
              <select value={comum.funilId} onChange={(e) => setC('funilId', e.target.value)} className="input-field w-full">
                <option value="">— escolha um funil —</option>
                {FUNNELS.map((f) => <option key={f.id} value={f.id}>{f.icon}  {f.label}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={comum.status} onChange={(e) => setC('status', e.target.value)} className="input-field w-full">
                {STATUS_GRUPO.map((id) => <option key={id} value={id}>{STATUS_BY_ID[id].label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Observação (opcional)">
            <textarea
              value={comum.observacao}
              onChange={(e) => setC('observacao', e.target.value)}
              rows={2}
              className="input-field w-full resize-y"
            />
          </Field>
          <label className="flex items-start gap-2.5 p-3 rounded-xl border border-rl-border bg-rl-surface/40 cursor-pointer">
            <input
              type="checkbox"
              checked={enviarAprovacao}
              onChange={(e) => setEnviarAprovacao(e.target.checked)}
              className="mt-0.5 accent-[#7C3AED]"
            />
            <span>
              <span className="text-xs font-bold text-rl-text uppercase tracking-wide block">Enviar pra aprovação do cliente</span>
              <span className="text-[11px] text-rl-muted">Cada criativo aparece no link de aprovação, com todos os formatos dele.</span>
            </span>
          </label>
        </div>
      </div>

      {/* Rodapé */}
      <div className="mt-4 pt-4 border-t border-rl-border flex items-center justify-between gap-3 flex-wrap">
        <p className={`text-xs ${erro ? 'text-red-500' : 'text-rl-muted'}`}>
          {erro || (subindo
            ? `Subindo ${progresso.feitos} de ${progresso.total} arquivos...`
            : bloqueio || `${planos.length} ${planos.length === 1 ? 'anúncio vai ser criado' : 'anúncios vão ser criados'}.`)}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            disabled={subindo}
            className="text-sm font-semibold px-4 py-2 rounded-xl border border-rl-border text-rl-subtle hover:text-rl-text transition-all disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={criar}
            disabled={!!bloqueio || subindo}
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-rl-purple text-white shadow-glow hover:bg-rl-purple/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {subindo && <Loader2 className="w-4 h-4 animate-spin" />}
            {planos.length > 1 ? `Criar ${planos.length} anúncios` : 'Criar anúncio'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function ModoBotao({ ativo, onClick, Icon, titulo, texto }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
        ativo ? 'border-rl-purple/50 bg-rl-purple/10' : 'border-rl-border bg-rl-surface/40 hover:border-rl-purple/30'
      }`}
    >
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${ativo ? 'text-rl-purple' : 'text-rl-muted'}`} />
      <span>
        <span className={`text-sm font-bold block ${ativo ? 'text-rl-purple' : 'text-rl-text'}`}>{titulo}</span>
        <span className="text-[11px] text-rl-muted">{texto}</span>
      </span>
    </button>
  )
}

function Miniatura({ item }) {
  if (!item) return null
  return item.midia === 'video'
    ? <video src={item.preview} muted preload="metadata" className="w-full h-full object-cover pointer-events-none" />
    : <img src={item.preview} alt={item.name} className="w-full h-full object-cover pointer-events-none" />
}

// Lugar de um formato dentro do criativo. Aceita soltar um arquivo arrastado
// de outro criativo; o arquivo dentro dele também pode ser arrastado.
function Slot({ item, formato, onSoltar, onRemover }) {
  const [sobre, setSobre] = useState(false)
  const dims = formato === 'story' ? 'w-11 h-[78px]' : 'w-[62px] h-[78px]'
  return (
    <div className="shrink-0 flex flex-col items-center gap-0.5">
      <div
        onDragOver={(e) => {
          if (![...e.dataTransfer.types].includes('text/x-arquivo')) return
          e.preventDefault()
          setSobre(true)
        }}
        onDragLeave={() => setSobre(false)}
        onDrop={(e) => {
          const uid = e.dataTransfer.getData('text/x-arquivo')
          setSobre(false)
          if (uid) { e.preventDefault(); onSoltar(uid) }
        }}
        className={`relative ${dims} rounded-lg overflow-hidden border transition-all ${
          sobre ? 'border-rl-purple ring-2 ring-rl-purple/30'
            : item ? 'border-rl-border' : 'border-dashed border-rl-border bg-rl-surface/40'
        }`}
      >
        {item ? (
          <div
            draggable
            onDragStart={(e) => { e.dataTransfer.setData('text/x-arquivo', item.uid); e.dataTransfer.effectAllowed = 'move' }}
            className="w-full h-full cursor-grab active:cursor-grabbing bg-rl-surface"
            title={`${item.name}${item.largura ? ` · ${item.largura}×${item.altura}` : ''}`}
          >
            <Miniatura item={item} />
            <button
              type="button"
              onClick={() => onRemover(item.uid)}
              className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/60 text-white hover:bg-red-500/80"
              title="Tirar este arquivo"
            >
              <Trash2 className="w-2.5 h-2.5" />
            </button>
          </div>
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-[9px] text-rl-muted text-center px-1">
            sem {FORMATOS[formato].label.toLowerCase()}
          </span>
        )}
      </div>
      <span className="text-[9px] font-bold uppercase tracking-wide text-rl-muted">{FORMATOS[formato].label}</span>
    </div>
  )
}
