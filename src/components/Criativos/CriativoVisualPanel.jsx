import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Sparkles, Loader2, Download, Image as ImageIcon, AlertCircle, Wand2,
} from 'lucide-react'
import { TEMPLATES } from './templates'
import { parseCreativeForFields, applyTemplatePlaceholders } from '../../lib/criativoTemplate'
import { elementToJpgBlob, downloadBlob, slugify } from '../../lib/htmlToJpg'
import { streamClaude } from '../../lib/claude'
import { useToast } from '../../hooks/useToast'
import Toast from '../UI/Toast'

const SYSTEM_PROMPT = `Você é um designer expert em ads do Meta/Instagram. Receberá um TEMPLATE HTML com placeholders ({{HEADLINE}}, {{SUBHEADLINE}}, {{CTA}}, {{BRAND_COLOR}}, {{COMPANY_NAME}}) e os textos a inserir.

Regras OBRIGATÓRIAS:
1. Retorne APENAS o HTML final — sem markdown, sem comentários, sem explicação. A primeira linha deve ser \`<!DOCTYPE html>\`.
2. Substitua os placeholders pelos textos fornecidos.
3. O canvas final é 1080x1080. NÃO altere width/height da .stage.
4. Ajuste font-size DO HEADLINE se ele for muito longo:
   - até 40 caracteres: mantém o tamanho do template.
   - 41-70 caracteres: reduz ~20% (ex: 92px → 76px).
   - acima de 70: reduz ~35% (ex: 92px → 60px). Pode quebrar em 2 linhas.
5. Mantenha cores, layout e estrutura geral do template. Pode ajustar pequenos detalhes (line-height, max-width do texto) se necessário pra ficar bonito.
6. Não adicione tags <script>, links externos ou imagens externas. Tudo self-contained.`

function buildUserMessage(template, fields) {
  return [
    `TEMPLATE HTML:`,
    '```html',
    template.html,
    '```',
    '',
    `VALORES PRA INSERIR:`,
    `- COMPANY_NAME: ${fields.companyName || ''}`,
    `- HEADLINE: ${fields.headline || ''}`,
    `- SUBHEADLINE: ${fields.subheadline || ''}`,
    `- CTA: ${fields.cta || 'Saiba mais'}`,
    `- BRAND_COLOR: ${fields.brandColor || '#000000'}`,
    '',
    'Retorne APENAS o HTML final, começando com <!DOCTYPE html>.',
  ].join('\n')
}

// Extrai apenas o HTML final do output da IA (caso venha com cerca de código)
function extractHtml(text) {
  const t = String(text || '')
  // tenta achar bloco ```html ... ```
  const m = t.match(/```(?:html)?\s*([\s\S]*?)```/i)
  if (m) return m[1].trim()
  // senão, recorta do <!DOCTYPE até </html>
  const start = t.search(/<!doctype html/i)
  const end = t.toLowerCase().lastIndexOf('</html>')
  if (start >= 0 && end > start) return t.slice(start, end + 7)
  return t.trim()
}

export default function CriativoVisualPanel({ project }) {
  const { toast, showToast } = useToast()
  const [selectedCreativeId, setSelectedCreativeId] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState(TEMPLATES[0].id)
  const [headline, setHeadline]       = useState('')
  const [subheadline, setSubheadline] = useState('')
  const [cta, setCta]                 = useState('Saiba mais')
  const [brandColor, setBrandColor]   = useState('#7C3AED')
  const [generating, setGenerating]   = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [generatedHtml, setGeneratedHtml] = useState('')
  const [errorMsg, setErrorMsg]       = useState('')
  const previewRef = useRef(null)
  const hiddenRef  = useRef(null)

  // Lista de creatives gerados (qualquer tipo serve; preferimos estáticos)
  const creatives = useMemo(() => {
    const all = Array.isArray(project?.creatives) ? project.creatives : []
    return all.filter((c) => c.content)
              .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  }, [project?.creatives])

  const selectedCreative = creatives.find((c) => c.id === selectedCreativeId) || null
  const selectedTemplate = TEMPLATES.find((t) => t.id === selectedTemplateId) || TEMPLATES[0]

  // Quando o user escolhe uma copy, popula os campos automaticamente
  useEffect(() => {
    if (!selectedCreative) return
    const fields = parseCreativeForFields(selectedCreative)
    if (fields.headline)    setHeadline(fields.headline)
    if (fields.subheadline) setSubheadline(fields.subheadline)
    if (fields.cta)         setCta(fields.cta)
  }, [selectedCreativeId]) // eslint-disable-line react-hooks/exhaustive-deps

  // HTML que vai na preview: prioriza o gerado pela IA; senão usa o template
  // com placeholders substituídos diretamente (fallback rápido).
  const previewHtml = useMemo(() => {
    if (generatedHtml) return generatedHtml
    return applyTemplatePlaceholders(selectedTemplate.html, {
      headline, subheadline, cta, brandColor,
      companyName: project?.companyName || '',
    })
  }, [generatedHtml, selectedTemplate, headline, subheadline, cta, brandColor, project?.companyName])

  // Sempre que mudar template OU os campos, invalida o HTML gerado pela IA
  useEffect(() => {
    setGeneratedHtml('')
    setErrorMsg('')
  }, [selectedTemplateId, headline, subheadline, cta, brandColor])

  async function handleGenerateAI() {
    if (!headline.trim()) {
      showToast('Preencha pelo menos o headline antes de gerar.', 'error')
      return
    }
    setGenerating(true)
    setErrorMsg('')
    setGeneratedHtml('')
    try {
      let acc = ''
      await streamClaude({
        model: 'claude-sonnet-4-5',
        max_tokens: 8000,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{
          role: 'user',
          content: [{
            type: 'text',
            text: buildUserMessage(selectedTemplate, {
              headline, subheadline, cta, brandColor,
              companyName: project?.companyName || '',
            }),
          }],
        }],
        onChunk: (text) => { acc = text },
      })
      const cleaned = extractHtml(acc)
      if (!cleaned || !/<!doctype html/i.test(cleaned)) {
        throw new Error('Resposta da IA não contém HTML válido.')
      }
      setGeneratedHtml(cleaned)
      showToast('Criativo gerado com IA!')
    } catch (e) {
      console.error('[CriativoVisual] erro IA:', e)
      setErrorMsg(e?.message || 'Erro ao gerar com IA.')
      showToast('Erro na IA. Você pode usar "Aplicar sem IA".', 'error')
    } finally {
      setGenerating(false)
    }
  }

  // Aplica os placeholders direto (sem IA) — modo rápido/seguro
  function handleApplyDirect() {
    if (!headline.trim()) {
      showToast('Preencha pelo menos o headline.', 'error')
      return
    }
    setGeneratedHtml('') // limpa cache da IA; previewHtml volta a usar o template
    showToast('Aplicado direto no template.')
  }

  async function handleDownload() {
    if (downloading) return
    setDownloading(true)
    try {
      // Renderiza num iframe oculto em 1080×1080 nativo, espera carregar, captura.
      const iframe = hiddenRef.current
      if (!iframe) throw new Error('Iframe oculto não encontrado.')
      iframe.srcdoc = previewHtml
      await new Promise((resolve) => {
        if (iframe.contentDocument?.readyState === 'complete') {
          // ainda assim aguarda um tick para renderização visual
          setTimeout(resolve, 350)
        } else {
          iframe.onload = () => setTimeout(resolve, 350)
        }
      })
      const body = iframe.contentDocument?.body
      if (!body) throw new Error('Conteúdo do iframe não acessível.')
      const blob = await elementToJpgBlob(body, { width: 1080, height: 1080, quality: 0.92 })
      if (!blob) throw new Error('Falha ao gerar a imagem.')
      const filename = `${slugify(project?.companyName || 'cliente')}-${selectedTemplate.id}-${Date.now()}.jpg`
      downloadBlob(blob, filename)
      showToast('JPG baixado!')
    } catch (e) {
      console.error('[CriativoVisual] erro download:', e)
      showToast(e?.message || 'Erro ao gerar JPG.', 'error')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-base font-bold text-rl-text flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-rl-purple" />
          Gerar criativo visual (JPG 1080×1080)
        </h3>
        <p className="text-xs text-rl-muted mt-0.5">
          Escolha uma copy já gerada, um template e gere uma imagem pronta pra rodar como anúncio.
        </p>
      </div>

      {/* Estado vazio: sem copys */}
      {creatives.length === 0 && (
        <div className="rounded-xl border border-dashed border-rl-border bg-rl-surface/30 p-6 text-center">
          <ImageIcon className="w-8 h-8 text-rl-muted/40 mx-auto mb-2" />
          <p className="text-sm text-rl-muted">
            Você ainda não tem nenhuma copy gerada. Gere uma copy primeiro na aba <span className="text-rl-text font-semibold">Copy</span> e volta aqui.
          </p>
        </div>
      )}

      {creatives.length > 0 && (
        <>
          {/* Coluna 1: configuração */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              {/* Selecionar copy */}
              <div>
                <label className="label-field">Copy gerada</label>
                <select
                  value={selectedCreativeId}
                  onChange={(e) => setSelectedCreativeId(e.target.value)}
                  className="input-field w-full"
                >
                  <option value="">— Escolha uma copy gerada —</option>
                  {creatives.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.id}{c.createdAt ? ` · ${new Date(c.createdAt).toLocaleDateString('pt-BR')}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-rl-muted mt-1">
                  Ao escolher, os campos abaixo são pré-preenchidos. Você pode editar.
                </p>
              </div>

              {/* Campos editáveis */}
              <div>
                <label className="label-field">Headline <span className="text-rl-red">*</span></label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Ex: Triplique suas vendas em 30 dias"
                  className="input-field w-full"
                  maxLength={120}
                />
              </div>

              <div>
                <label className="label-field">Subheadline (opcional)</label>
                <input
                  type="text"
                  value={subheadline}
                  onChange={(e) => setSubheadline(e.target.value)}
                  placeholder="Ex: Sem precisar contratar mais gente"
                  className="input-field w-full"
                  maxLength={200}
                />
              </div>

              <div>
                <label className="label-field">CTA</label>
                <input
                  type="text"
                  value={cta}
                  onChange={(e) => setCta(e.target.value)}
                  placeholder="Ex: Quero saber mais"
                  className="input-field w-full"
                  maxLength={40}
                />
              </div>

              <div>
                <label className="label-field">Cor de destaque</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="w-12 h-10 rounded-lg border border-rl-border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="input-field flex-1 font-mono text-sm uppercase"
                    maxLength={7}
                  />
                </div>
              </div>

              {/* Templates */}
              <div>
                <label className="label-field">Template</label>
                <div className="grid grid-cols-2 gap-2">
                  {TEMPLATES.map((t) => {
                    const active = selectedTemplateId === t.id
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTemplateId(t.id)}
                        className={`group rounded-xl border overflow-hidden transition-all text-left ${
                          active
                            ? 'border-rl-purple ring-2 ring-rl-purple/30 shadow-glow'
                            : 'border-rl-border hover:border-rl-purple/40'
                        }`}
                      >
                        <div className="aspect-square bg-white">
                          <img src={t.thumbnail} alt={t.name} className="w-full h-full block" />
                        </div>
                        <div className="px-2 py-1.5 bg-rl-surface">
                          <p className={`text-[11px] font-semibold ${active ? 'text-rl-purple' : 'text-rl-text'}`}>{t.name}</p>
                          <p className="text-[9px] text-rl-muted line-clamp-1">{t.description}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Ações */}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  onClick={handleGenerateAI}
                  disabled={generating || !headline.trim()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-rl-purple text-white shadow-glow hover:bg-rl-purple/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {generating
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Gerando…</>
                    : <><Sparkles className="w-4 h-4" />Gerar com IA</>
                  }
                </button>
                <button
                  onClick={handleApplyDirect}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-rl-border text-rl-muted hover:text-rl-text hover:border-rl-purple/30 transition-all"
                  title="Substitui os placeholders no template sem chamar a IA"
                >
                  Aplicar sem IA
                </button>
                <button
                  onClick={handleDownload}
                  disabled={downloading || !headline.trim()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-rl-green/40 text-rl-green hover:bg-rl-green/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all ml-auto"
                >
                  {downloading
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Gerando JPG…</>
                    : <><Download className="w-4 h-4" />Baixar JPG</>
                  }
                </button>
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-400/10 border border-red-400/30">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-400">{errorMsg}</p>
                </div>
              )}
            </div>

            {/* Coluna 2: preview visual */}
            <div>
              <label className="label-field">Preview</label>
              <div className="rounded-xl border border-rl-border bg-rl-surface/30 p-4 flex items-center justify-center">
                <div
                  ref={previewRef}
                  className="rounded-lg overflow-hidden shadow-md bg-white"
                  style={{ width: 540, height: 540 }}
                >
                  <iframe
                    title="preview"
                    srcDoc={previewHtml}
                    style={{
                      width: 1080, height: 1080,
                      border: 'none',
                      transform: 'scale(0.5)',
                      transformOrigin: '0 0',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              </div>
              <p className="text-[10px] text-rl-muted mt-2 text-center">
                Preview em escala 50% (tamanho real: 1080×1080)
              </p>
            </div>
          </div>

          {/* Iframe oculto usado pra renderizar em 1080×1080 nativo na hora do download */}
          <iframe
            ref={hiddenRef}
            title="render"
            srcDoc={previewHtml}
            aria-hidden="true"
            style={{
              position: 'fixed',
              left: -99999,
              top: 0,
              width: 1080,
              height: 1080,
              border: 'none',
              opacity: 0,
              pointerEvents: 'none',
            }}
          />
        </>
      )}

      <Toast toast={toast} />
    </div>
  )
}
