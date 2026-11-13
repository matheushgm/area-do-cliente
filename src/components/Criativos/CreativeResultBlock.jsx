import { useState } from 'react'
import { Copy, CheckCheck, FileDown, Pencil, Check, X, Sparkles, Loader2, Trash2 } from 'lucide-react'
import MarkdownView from '../Editor/MarkdownView'
import MarkdownEditor from '../Editor/MarkdownEditor'
import { exportCreativoSinglePDF } from '../../lib/creativoPDF'
import { useI18n } from '../../i18n'

// ── Split ─────────────────────────────────────────────────────────────────────

const AD_HEADER = /^##\s+(?:ROTEIRO|AN[ÚU]NCIO)\s+\d+/im

function isNonAd(chunk) {
  return (
    /TABELA\s+DO\s+LABORAT/i.test(chunk)    ||
    /INSIGHTS?\s+ESTRAT[ÉE]G/i.test(chunk)  ||
    /COMBINAÇÕES?\s+DE\s+ALTA/i.test(chunk) ||
    /PRÓXIMOS?\s+GANCHOS/i.test(chunk)      ||
    /^\|\s*Tipo\s+de\s+Gancho/im.test(chunk)
  )
}

// Exportado: a leva de aprovação de copy precisa enxergar exatamente os mesmos
// chunks que os cards da tela, senão o índice do item enviado ao cliente não
// bate com o criativo que o gestor está vendo.
// Onde começa cada bloco do texto gerado: um anúncio/roteiro ou, nos roteiros
// de vídeo da habilidade, o estudo do público (antes) e a tabela do laboratório
// (depois), que não são cards. Sem a divisa da tabela ela grudava no último
// roteiro e o card inteiro sumia (isNonAd).
export const DIVISA_DE_BLOCO = /(?=^##\s+(?:ROTEIRO|AN[ÚU]NCIO)\s+\d+|^#{1,2}\s+(?:ESTUDO|TABELA)\b)/im
const EXTRA = /^#{1,2}\s+(ESTUDO|TABELA)\b/i

export function splitChunks(content) {
  const parts = content.split(DIVISA_DE_BLOCO)
  const adChunks = parts.filter((p) => {
    const t = p.trim()
    return t && AD_HEADER.test(t) && !isNonAd(t)
  })
  if (adChunks.length > 0) return adChunks.map((chunk) => ({ chunk }))

  // Enquanto só o estudo do público chegou (streaming), não há card ainda.
  const chunks = content.split(/\n---\n/).map((c) => c.trim()).filter((c) => c && !EXTRA.test(c))
  if (chunks.length > 1) return chunks.map((chunk) => ({ chunk }))
  if (EXTRA.test(content.trim())) return chunks.map((chunk) => ({ chunk }))

  return [{ chunk: content }]
}

// Estudo do público e tabela do laboratório de uma geração de vídeo, quando há.
export function extrasDoConteudo(content) {
  const extras = { estudo: '', tabela: '' }
  for (const parte of String(content || '').split(DIVISA_DE_BLOCO)) {
    const t = parte.trim()
    const m = t.match(EXTRA)
    if (m) extras[m[1].toUpperCase() === 'ESTUDO' ? 'estudo' : 'tabela'] = stripTrailingSeparator(t)
  }
  return extras
}

// Remove o separador "---" que o split por lookahead deixa grudado no final
// de cada chunk (menos o último) — decorativo, não deve aparecer nem na
// textarea de edição nem no card renderizado.
function stripTrailingSeparator(text) {
  return text.replace(/\n[ \t]*-{3,}\s*$/, '').trimEnd()
}

export function parseChunk(chunk) {
  const firstLine = chunk.split('\n')[0].trim()
  const headingMatch = firstLine.match(/^#{1,3}\s+(.+)/)
  if (!headingMatch) return { title: '', body: stripTrailingSeparator(chunk) }
  const title = headingMatch[1].trim()
  const body  = stripTrailingSeparator(chunk.slice(firstLine.length).trimStart())
  return { title, body: body || chunk }
}

// Nível do cabeçalho markdown de uma linha: "# " → 1, "## " → 2, "### " → 3.
// 0 quando a linha não é cabeçalho.
function headingLevel(line = '') {
  const match = line.trim().match(/^(#{1,3})\s+\S/)
  return match ? match[1].length : 0
}

// Devolve o texto editado com o cabeçalho original do chunk de volta no topo.
// A textarea de edição só expõe o body — sem o cabeçalho, o splitter perde a
// referência de início de chunk e o anúncio "some" (fica colado ao anterior).
//
// A comparação é por NÍVEL, não por "tem ou não tem #": o body do criativo
// estático começa em "### 1" (numeração da headline dentro do bloco), que é um
// subcabeçalho, não o título do chunk. Tratar isso como cabeçalho fazia o
// "# DOR: ... | Tipo" ser descartado no save, e o card perdia a dor e o ângulo.
function withOriginalHeading(chunk, edited) {
  const text = (edited || '').trim()
  const firstLine = chunk.split('\n')[0]
  const originalLevel = headingLevel(firstLine)
  if (!originalLevel) return text
  const editedLevel = headingLevel(text.split('\n')[0])
  const editedHasChunkHeading = editedLevel > 0 && editedLevel <= originalLevel
  return editedHasChunkHeading ? text : `${firstLine}\n\n${text}`
}

// ── ChunkCard ─────────────────────────────────────────────────────────────────

function ChunkCard({ item, index, type, companyName, onChange, onRefine, onDelete }) {
  const { t } = useI18n()
  const { title, body } = parseChunk(item.chunk)

  const [copied,        setCopied]        = useState(false)
  const [exporting,     setExporting]     = useState(false)
  const [editing,       setEditing]       = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [draft,         setDraft]         = useState('')
  const [refineOpen,     setRefineOpen]     = useState(false)
  const [refineNote,     setRefineNote]     = useState('')
  const [isRefining,     setIsRefining]     = useState(false)
  const [streamingBody,  setStreamingBody]  = useState('')
  const [refinedContent, setRefinedContent] = useState(null)

  function copyAll() {
    navigator.clipboard.writeText(item.chunk)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  function handleExport() {
    setExporting(true)
    try { exportCreativoSinglePDF({ content: item.chunk, type: type || 'estatico', index, companyName }) }
    finally { setExporting(false) }
  }

  function startEdit() { setDraft(body); setEditing(true); setRefineOpen(false) }
  function cancelEdit() { setEditing(false); setDraft('') }
  function saveEdit() {
    if (onChange && draft.trim()) {
      // Preserva o cabeçalho original do chunk (`# DOR: ... | Tipo`,
      // `## ROTEIRO N:` / `## ANÚNCIO N:`).
      onChange(withOriginalHeading(item.chunk, draft))
    }
    setEditing(false)
    setDraft('')
  }

  function toggleRefine() {
    setRefineOpen((v) => !v)
    setEditing(false)
    setRefineNote('')
    setRefinedContent(null)
    setStreamingBody('')
  }

  async function submitRefine() {
    if (!refineNote.trim() || !onRefine || isRefining) return
    setIsRefining(true)
    setStreamingBody('')
    setRefinedContent(null)
    try {
      const refined = await onRefine(item.chunk, refineNote, (text) => setStreamingBody(text))
      setRefinedContent(refined)
    } catch (e) {
      console.error('Refinar falhou:', e)
    } finally {
      setIsRefining(false)
      setStreamingBody('')
    }
  }

  function approveRefine() {
    if (onChange && refinedContent) {
      // Mesma proteção do saveEdit: se o output da IA veio sem cabeçalho,
      // recoloca o original pra não quebrar o splitter na próxima render.
      onChange(withOriginalHeading(item.chunk, refinedContent))
    }
    setRefinedContent(null)
    setRefineOpen(false)
    setRefineNote('')
  }

  function rejectRefine() {
    setRefinedContent(null)
  }

  // Botão "IA" da toolbar do editor: salva o que foi editado e abre o painel de
  // refino já apontando pro trecho selecionado. A IA devolve o criativo inteiro
  // com só aquele trecho mudado — mesmo fluxo de aprovar/recusar de sempre.
  function refinarTrecho(trecho) {
    saveEdit()
    setRefineOpen(true)
    setRefinedContent(null)
    setStreamingBody('')
    setRefineNote(t('criativos.resultado.notaTrecho', { trecho: String(trecho || '').trim() }))
  }

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-rl-border/40 flex items-start justify-between gap-3 bg-rl-surface/40">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-rl-muted font-semibold uppercase tracking-wide mb-0.5">
            {t('criativos.card.criativoN', { n: index + 1 })}
          </div>
          {title && (
            <p className="text-sm font-semibold text-rl-text leading-snug">{title}</p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {editing ? (
            <>
              <button
                onClick={saveEdit}
                className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg bg-rl-purple/10 border border-rl-purple/30 text-rl-purple hover:bg-rl-purple/20 transition-all"
              >
                <Check className="w-3 h-3" /> {t('comum.salvar')}
              </button>
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg bg-rl-surface text-rl-muted hover:text-red-400 transition-all"
              >
                <X className="w-3 h-3" /> {t('comum.cancelar')}
              </button>
            </>
          ) : (
            <>
              {onRefine && (
                <button
                  onClick={toggleRefine}
                  className={`flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                    refineOpen
                      ? 'bg-rl-purple/20 border-rl-purple/40 text-rl-purple'
                      : 'bg-rl-purple/10 border-rl-purple/30 text-rl-purple hover:bg-rl-purple/20'
                  }`}
                >
                  <Sparkles className="w-3 h-3" /> {t('criativos.resultado.refinar')}
                </button>
              )}
              {onChange && (
                <button
                  onClick={startEdit}
                  className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg bg-rl-surface text-rl-muted hover:text-rl-blue transition-all"
                >
                  <Pencil className="w-3 h-3" /> {t('comum.editar')}
                </button>
              )}
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg bg-rl-surface text-rl-muted hover:text-rl-purple transition-all disabled:opacity-50"
              >
                <FileDown className="w-3 h-3" /> PDF
              </button>
              <button
                onClick={copyAll}
                className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg bg-rl-surface text-rl-muted hover:text-rl-purple transition-all"
              >
                {copied ? <CheckCheck className="w-3 h-3 text-rl-green" /> : <Copy className="w-3 h-3" />}
                {copied ? t('comum.copiado') : t('comum.copiar')}
              </button>
              {/* Excluir — dois cliques, pra não apagar criativo sem querer */}
              {onDelete && (
                confirmDelete ? (
                  <span className="flex items-center gap-1">
                    <button
                      onClick={() => { setConfirmDelete(false); onDelete() }}
                      className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg bg-red-400/10 border border-red-400/30 text-red-400 hover:bg-red-400/20 transition-all"
                    >
                      <Check className="w-3 h-3" /> {t('comum.excluir')}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg bg-rl-surface text-rl-muted hover:text-rl-text transition-all"
                    >
                      {t('comum.cancelar')}
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    title={t('criativos.resultado.excluirCriativo')}
                    className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg bg-rl-surface text-rl-muted hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-3 h-3" /> {t('comum.excluir')}
                  </button>
                )
              )}
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        {editing ? (
          <MarkdownEditor
            value={draft}
            onChange={setDraft}
            minHeight={260}
            autoFocus
            onAI={onRefine ? refinarTrecho : undefined}
          />
        ) : (
          <MarkdownView content={body} />
        )}
      </div>

      {/* Painel de refinamento */}
      {refineOpen && !editing && (
        <div className="px-4 pb-4 space-y-2.5 border-t border-rl-purple/20 bg-rl-purple/5">

          {/* Fase 1: input — antes de refinar */}
          {!refinedContent && !isRefining && (
            <>
              <p className="text-[10px] font-semibold text-rl-purple uppercase tracking-wide pt-3">
                {t('criativos.resultado.oQueMelhorar')}
              </p>
              <textarea
                value={refineNote}
                onChange={(e) => setRefineNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitRefine() }}
                placeholder={t('criativos.resultado.refinarPlaceholder')}
                rows={3}
                className="w-full bg-rl-surface/60 border border-rl-purple/30 rounded-xl p-3 text-xs text-rl-text leading-relaxed resize-none focus:outline-none focus:border-rl-purple/60 transition-colors placeholder:text-rl-muted/60"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={submitRefine}
                  disabled={!refineNote.trim()}
                  className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg bg-rl-purple/10 border border-rl-purple/30 text-rl-purple hover:bg-rl-purple/20 transition-all disabled:opacity-50"
                >
                  <Sparkles className="w-3 h-3" /> {t('criativos.resultado.refinar')}
                </button>
                <button
                  onClick={() => { setRefineOpen(false); setRefineNote('') }}
                  className="text-[10px] px-2.5 py-1 text-rl-muted hover:text-rl-text transition-all"
                >
                  {t('comum.cancelar')}
                </button>
              </div>
            </>
          )}

          {/* Fase 2: streaming em andamento */}
          {isRefining && (
            <>
              <p className="text-[10px] font-semibold text-rl-purple uppercase tracking-wide pt-3 flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> {t('criativos.resultado.refinando')}
              </p>
              {streamingBody && (
                <div className="bg-rl-surface/60 border border-rl-purple/20 rounded-xl p-3">
                  <MarkdownView content={streamingBody} />
                </div>
              )}
            </>
          )}

          {/* Fase 3: versão refinada aguardando aprovação */}
          {refinedContent && !isRefining && (
            <>
              <p className="text-[10px] font-semibold text-rl-purple uppercase tracking-wide pt-3">
                {t('criativos.resultado.versaoRefinada')}
              </p>
              <div className="bg-rl-purple/5 border border-rl-purple/30 rounded-xl p-3">
                <MarkdownView content={refinedContent} />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={approveRefine}
                  className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 transition-all"
                >
                  <Check className="w-3 h-3" /> {t('criativos.resultado.aprovar')}
                </button>
                <button
                  onClick={rejectRefine}
                  className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg bg-rl-surface text-rl-muted hover:text-red-400 transition-all"
                >
                  <X className="w-3 h-3" /> {t('criativos.resultado.recusar')}
                </button>
              </div>
            </>
          )}

        </div>
      )}
    </div>
  )
}

// ── CreativeResultBlock ───────────────────────────────────────────────────────

export default function CreativeResultBlock({ content, type, companyName, onChunkChange, onRefine, onChunkDelete }) {
  const { t } = useI18n()
  const [allCopied, setAllCopied] = useState(false)
  const items = splitChunks(content)
  const { estudo, tabela } = extrasDoConteudo(content)

  function copyAll() {
    navigator.clipboard.writeText(content)
    setAllCopied(true)
    setTimeout(() => setAllCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-rl-muted">
          {t('criativos.resultado.nCriativos', { count: items.length })}
        </span>
        <button
          onClick={copyAll}
          className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all"
        >
          {allCopied ? <CheckCheck className="w-3.5 h-3.5 text-rl-green" /> : <Copy className="w-3.5 h-3.5" />}
          {allCopied ? t('criativos.resultado.tudoCopiado') : t('criativos.resultado.copiarTudo')}
        </button>
      </div>

      {/* Aberto enquanto os roteiros não começaram a chegar; depois recolhe. */}
      {estudo && <BlocoExtra titulo={t('criativos.resultado.estudoPublico')} texto={estudo} aberto={items.length === 0} />}

      {items.map((item, i) => (
        <ChunkCard
          key={i}
          item={item}
          index={i}
          type={type}
          companyName={companyName}
          onChange={onChunkChange ? (newContent) => onChunkChange(i, newContent) : undefined}
          onRefine={onRefine ? (chunkContent, note, onChunk) => onRefine(i, chunkContent, note, onChunk) : undefined}
          // Só oferece excluir quando sobra mais de um: apagar o último deixaria
          // o conteúdo vazio e derrubaria a tela de resultado.
          onDelete={onChunkDelete && items.length > 1 ? () => onChunkDelete(i) : undefined}
        />
      ))}

      {tabela && <BlocoExtra titulo={t('criativos.resultado.tabelaLab')} texto={tabela} aberto />}
    </div>
  )
}

function BlocoExtra({ titulo, texto, aberto = false }) {
  const corpo = texto.replace(/^#{1,2}[^\n]*\n?/, '').trim()
  return (
    <details open={aberto} className="glass-card overflow-hidden group">
      <summary className="px-5 py-3 text-xs font-bold text-rl-text cursor-pointer hover:bg-rl-surface/60">
        {titulo}
      </summary>
      <div className="px-5 pb-4 pt-1 border-t border-rl-border/60">
        <MarkdownView content={corpo} className="md-prose--13" />
      </div>
    </details>
  )
}
