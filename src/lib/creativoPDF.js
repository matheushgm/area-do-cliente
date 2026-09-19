// Export dos criativos (anúncios estáticos) em PDF — HTML + window.print(), no
// mesmo scaffold dos outros documentos. Roteiros de vídeo saem no template
// Verta (roteiroVideoPDF.js); se o parse falhar, caem neste layout.
//
// Sistema monocromático azul + neutros frios (Design system verta): azul-marca
// #2A25F0 é a única cor "alta"; todo o resto é ink ou papel.
import { exportRoteirosVideoPDF } from './roteiroVideoPDF'
import { printDocument, todayLong } from './printDoc'
import { escapeHtml as esc } from './utils'

const CSS = `
  body { color: #0B0B14; }
  .cover { background: #070230; color: #fff; min-height: 100vh; padding: 48px 56px; border-top: 6px solid #2A25F0; display: flex; flex-direction: column; page-break-after: always; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand-mark { width: 40px; height: 40px; border-radius: 10px; background: #2A25F0; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; }
  .brand-name { font-size: 18px; font-weight: 800; }
  .brand-sub { font-size: 11px; color: #8FA6FF; }
  .hero { margin-top: 90px; }
  .hero-kicker { font-size: 34px; color: #8FA6FF; }
  .hero-title { font-size: 52px; font-weight: 800; line-height: 1.05; }
  .hero-rule { border: 0; border-top: 1px solid #28285A; margin: 24px 0; }
  .hero-sub { color: #8FA6FF; font-size: 14px; }
  .info { background: #100A4A; border-radius: 12px; padding: 24px 28px; margin-top: 40px; }
  .info-label { font-size: 9px; letter-spacing: .1em; font-weight: 700; color: #8FA6FF; text-transform: uppercase; }
  .info-value { font-size: 22px; font-weight: 800; margin: 4px 0 14px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; border-top: 1px solid #28285A; padding-top: 14px; margin-bottom: 14px; }
  .info-grid .info-value { font-size: 14px; margin-bottom: 0; }
  .info-note { font-size: 12px; color: #DCE2FE; margin: 4px 0 12px; }
  .cover-foot { margin-top: auto; text-align: center; font-size: 11px; color: #8FA6FF; padding-top: 40px; }
  .cover-foot small { display: block; color: #5A5A8C; margin-top: 4px; }
  .ad { padding: 24px 40px 32px; page-break-before: always; }
  .ad-head { background: #2A25F0; color: #fff; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #518CFF; border-radius: 6px 6px 0 0; margin-bottom: 18px; }
  .ad-head h2 { font-size: 15px; font-weight: 800; }
  .ad-head span { font-size: 11px; color: #DCE2FE; }
  .meta { font-size: 11px; font-weight: 700; color: #1800DB; margin: 8px 0; }
  .sec { background: #EEF1FE; border-left: 4px solid #2A25F0; border-radius: 6px; padding: 8px 12px; font-size: 12px; font-weight: 800; color: #1800DB; margin: 14px 0 8px; }
  .sub { font-size: 10px; font-weight: 700; color: #767C8E; text-transform: uppercase; letter-spacing: .05em; margin: 10px 0 4px; }
  .field { border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; background: #F2F4FA; page-break-inside: avoid; }
  .field-label { font-size: 8.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #767C8E; margin-bottom: 3px; }
  .field-value { font-size: 12px; line-height: 1.5; white-space: pre-wrap; }
  .field.headline { background: #EEF1FE; }
  .field.headline .field-label, .field.headline .field-value { color: #1800DB; }
  .field.headline .field-value { font-size: 13.5px; font-weight: 700; }
  .field.cta { background: #2A25F0; }
  .field.cta .field-label { color: #DCE2FE; }
  .field.cta .field-value { color: #fff; }
  .field.gancho { background: #EEF1FE; }
  .field.gancho .field-label { color: #1800DB; }
  .field.legenda { background: #F8F9FC; border: 1px solid #E4E7F0; }
  .field.legenda .field-label { color: #2A25F0; }
  .field.legenda .field-value { color: #3D4254; }
  .ad ul { margin: 6px 0 6px 18px; }
  .ad li { font-size: 11px; margin-bottom: 3px; }
  .ad p { font-size: 11px; color: #3D4254; margin-bottom: 6px; }
  .ad-foot { margin-top: 24px; padding-top: 8px; border-top: 1px solid #E4E7F0; font-size: 9px; color: #767C8E; display: flex; justify-content: space-between; }
`

// ─── Parsing do conteúdo gerado pela IA ───────────────────────────────────────

function parseAdLines(chunk) {
  return chunk.split('\n').map((raw) => {
    const line = raw.trimEnd()
    if (!line.trim() || line.trim() === '---') return { kind: 'space' }
    if (/^##\s+/.test(line))      return { kind: 'h2',    text: line.replace(/^##\s+/, '') }
    if (/^###\s+/.test(line))     return { kind: 'h3',    text: line.replace(/^###\s+/, '') }
    if (/^#\s+/.test(line))       return { kind: 'h1',    text: line.replace(/^#\s+/, '') }
    // **LABEL:** value  OU  **LABEL (time)**
    const bold = line.match(/^\*\*(.*?)\*\*:?\s*(.*)$/)
    if (bold) return { kind: 'field', label: bold[1], value: bold[2].replace(/\*\*(.*?)\*\*/g, '$1') }
    if (/^-\s+/.test(line))       return { kind: 'bullet', text: line.replace(/^-\s+/, '') }
    return { kind: 'body', text: line.replace(/\*\*(.*?)\*\*/g, '$1') }
  })
}

function fieldClass(label) {
  if (/OPÇÃO\s+\d+\s+DE\s+HEADLINE|HEADLINE\s+PRINCIPAL/i.test(label)) return 'headline'
  if (/CALL.TO.ACTION|CTA\s+FINAL/i.test(label)) return 'cta'
  if (/GANCHO/i.test(label)) return 'gancho'
  if (/LEGENDA/i.test(label)) return 'legenda'
  return ''
}

function adHtml(chunk, i, total, isVideo, companyName, today) {
  const out = []
  let inList = false
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false } }
  for (const s of parseAdLines(chunk)) {
    if (s.kind === 'bullet') {
      if (!inList) { out.push('<ul>'); inList = true }
      out.push(`<li>${esc(s.text)}</li>`)
      continue
    }
    closeList()
    if (s.kind === 'space') continue
    if (s.kind === 'h1')         out.push(`<div class="meta">${esc(s.text)}</div>`)
    else if (s.kind === 'h2')    out.push(`<div class="sec">${esc(s.text)}</div>`)
    else if (s.kind === 'h3')    out.push(`<div class="sub">${esc(s.text)}</div>`)
    else if (s.kind === 'field') out.push(`<div class="field ${fieldClass(s.label)}"><div class="field-label">${esc(s.label)}</div>${s.value ? `<div class="field-value">${esc(s.value)}</div>` : ''}</div>`)
    else if (s.text.trim())      out.push(`<p>${esc(s.text)}</p>`)
  }
  closeList()
  return `
  <section class="ad">
    <div class="ad-head"><h2>${isVideo ? 'Roteiro' : 'Anúncio'} ${i + 1}</h2>${total > 1 ? `<span>${i + 1} de ${total}</span>` : ''}</div>
    ${out.join('\n    ')}
    <div class="ad-foot"><span>Verta × ${esc(companyName)}</span><span>${esc(today)}</span></div>
  </section>`
}

function coverHtml({ companyName, type, adTypeLabels, quantity, customNote, today }) {
  return `
  <section class="cover">
    <div class="brand">
      <div class="brand-mark">V</div>
      <div><div class="brand-name">Verta</div><div class="brand-sub">Ferramenta interna</div></div>
    </div>
    <div class="hero">
      <div class="hero-kicker">Criativos</div>
      <div class="hero-title">${type === 'video' ? 'de vídeo' : 'estáticos'}</div>
      <hr class="hero-rule">
      <div class="hero-sub">Anúncios gerados com IA — Verta</div>
    </div>
    <div class="info">
      <div class="info-label">Cliente</div>
      <div class="info-value">${esc(companyName)}</div>
      <div class="info-grid">
        <div><div class="info-label">Tipo</div><div class="info-value">${type === 'video' ? 'Vídeo (roteiro)' : 'Estático (imagem)'}</div></div>
        <div><div class="info-label">Quantidade</div><div class="info-value">${quantity} criativo${quantity !== 1 ? 's' : ''}</div></div>
      </div>
      <div class="info-label">Tipos de anúncio</div>
      <div class="info-note">${esc((adTypeLabels || []).join(' · ') || '—')}</div>
      ${customNote ? `<div class="info-label">Direção criativa</div><div class="info-note">“${esc(customNote)}”</div>` : ''}
    </div>
    <div class="cover-foot">Gerado em ${esc(today)}<small>Confidencial — uso exclusivo</small></div>
  </section>`
}

/**
 * Decide se um criativo é roteiro de vídeo.
 *
 * O conteúdo vem primeiro, e por um motivo concreto: `type` NÃO é persistido em
 * `criativos.answers`, e os componentes de card chamam o export com
 * `type: type || 'estatico'`. Ou seja, todo criativo salvo chega aqui marcado como
 * "estatico" por causa de um default — não porque alguém o classificou assim.
 *
 * A forma do conteúdo é a evidência real: roteiro de vídeo traz o rótulo GANCHO,
 * anúncio estático traz HEADLINE. Os flags só decidem quando o conteúdo é ambíguo.
 */
function ehRoteiroDeVideo({ type, isVideo, content }) {
  const temGancho = /\*\*[^*\n]*GANCHO/i.test(content || '')
  const temHeadline = /HEADLINE/i.test(content || '')
  if (temGancho !== temHeadline) return temGancho

  if (type === 'video') return true
  if (type === 'estatico') return false
  return isVideo === true
}

function splitIntoAds(content) {
  const parts = content.split(/(?=^##\s+(?:ROTEIRO|AN[ÚU]NCIO)\s+\d+)/im)
  const ads = parts.filter((p) => /^##\s+(?:ROTEIRO|AN[ÚU]NCIO)\s+\d+/im.test(p.trim()))
  // Fallback por ---
  if (ads.length === 0) {
    return content
      .split(/\n---\n/)
      .map((c) => c.trim())
      .filter((c) => c && (/HEADLINE/i.test(c) || /GANCHO/i.test(c) || /CALL.TO.ACTION/i.test(c)))
  }
  return ads
}

const slug = (s) => (s || 'Cliente').replace(/\s+/g, '-')

// ─── API pública ──────────────────────────────────────────────────────────────

/** Exporta UM anúncio individual (de um CreativeCard). */
export function exportCreativoSinglePDF({ content, type, index, companyName }) {
  if (ehRoteiroDeVideo({ type, content }) && exportRoteirosVideoPDF(content, { companyName, index })) return

  const isVideo = type === 'video'
  const today = todayLong()
  printDocument({
    title: `Criativo-${isVideo ? 'Video' : 'Estatico'}-${index + 1}-${slug(companyName)}`,
    css: CSS,
    body: adHtml(content, index, 1, isVideo, companyName || 'Cliente', today),
  })
}

/** Exporta o conjunto completo de anúncios de uma geração (de CreativeHistory). */
export function exportCreativoSetPDF({ creative, companyName }) {
  const { content, type = 'estatico', adTypeLabels = [], quantity = 1, customNote = '', createdAt } = creative

  // Lê `creative.type` cru (e não o `type` acima) porque o default 'estatico'
  // esconderia o undefined dos criativos salvos, que não persistem esse campo.
  if (
    ehRoteiroDeVideo({ type: creative.type, isVideo: creative.isVideo, content }) &&
    exportRoteirosVideoPDF(content, { companyName })
  ) return

  const isVideo = type === 'video'
  const today = todayLong()
  const name = companyName || 'Cliente'
  const ads = splitIntoAds(content)
  const coverDate = createdAt
    ? new Date(createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : today
  printDocument({
    title: `Criativos-${isVideo ? 'Video' : 'Estatico'}-${createdAt ? new Date(createdAt).toISOString().slice(0, 10) : today}-${slug(companyName)}`,
    css: CSS,
    body: coverHtml({ companyName: name, type, adTypeLabels, quantity, customNote, today: coverDate })
      + ads.map((chunk, i) => adHtml(chunk.trim(), i, ads.length, isVideo, name, today)).join(''),
  })
}
