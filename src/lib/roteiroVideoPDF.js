/**
 * Export de roteiros de VÍDEO no template Verta.
 *
 * Segue o mesmo padrão de `src/utils/exportPDF.js`: monta HTML inline e abre uma
 * janela de impressão. Isso preserva as fontes reais da marca (Sora/Manrope) e o
 * gradiente do header, coisas que o jsPDF de `creativoPDF.js` não consegue — por
 * isso o caminho de vídeo usa este módulo, e o estático continua no jsPDF.
 *
 * Layout: 1 roteiro por página — header em gradiente + 4 metadados, blocos
 * 01 Gancho / 02 Mensagem / 03 CTA, caixa "Legenda do post" e rodapé.
 */

// ─── Tokens da marca (Design system verta / tokens/colors.css) ────────────────
const AZUL = '#2A25F0'
const AZUL_CLARO = '#8FA6FF'
const TINTA = '#1A1C24'
const TINTA_FORTE = '#0B0B14'
const CINZA = '#9AA0B2'
const CINZA_MEDIO = '#5A6072'
const LINHA = '#E4E7F0'
const CAIXA_BG = '#EEF1FE'
const CAIXA_BORDA = '#DCE2FE'

// Página sob medida (px @96dpi): largura de A4 paisagem e altura calibrada para
// caber um roteiro inteiro sem comprimir a tipografia do template.
const PAG_W = 1123
const PAG_H = 1160

function esc(t) {
  if (t == null) return ''
  return String(t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Remove marcação markdown residual que a IA às vezes deixa no meio do texto. */
function limpo(t) {
  return esc(String(t || '').replace(/\*\*(.*?)\*\*/g, '$1').trim())
}

// ─── Parsing do output da IA ──────────────────────────────────────────────────
// Formato gerado (ver VIDEO_SYSTEM_PARTS em CriativosModule.jsx):
//
//   ## ROTEIRO 1: Gancho: História | Nível: 3
//   **GANCHO (0s – 3s):**
//   [texto]
//   **MENSAGEM (3s – 45s):**
//   [texto]
//   **CTA FINAL (45s – 60s)**
//   [texto]
//   **📝 LEGENDA DO POST:** [texto]

export function splitRoteiros(content) {
  const partes = String(content || '').split(/(?=^##\s+ROTEIRO\s+\d+)/im)
  const achados = partes.filter((p) => /^##\s+ROTEIRO\s+\d+/im.test(p.trim()))
  if (achados.length) return achados.map((p) => p.trim())

  // Fallback: conteúdo separado por "---" (gerações antigas ou coladas à mão)
  return String(content || '')
    .split(/\n---+\n/)
    .map((c) => c.trim())
    .filter((c) => c && /GANCHO/i.test(c))
}

/**
 * Extrai a narração de um roteiro em tabela markdown ("| Tempo | Fala | Imagem |"),
 * escolhendo a coluna de fala. Retorna '' se não houver tabela reconhecível.
 */
function falaDaTabela(texto) {
  const linhas = texto.split('\n').filter((l) => l.trim().startsWith('|'))
  if (linhas.length < 2) return ''

  const celulas = (l) =>
    l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())

  const cabecalho = celulas(linhas[0]).map((c) => c.toLowerCase())
  let col = cabecalho.findIndex((c) => /fala|narra|áudio|audio|texto/.test(c))
  if (col < 0) col = cabecalho.length > 1 ? 1 : 0 // convenção: 2ª coluna é a fala

  return linhas
    .slice(1)
    .filter((l) => !/^\|[\s|:-]+\|?$/.test(l.trim())) // descarta a linha separadora
    .map((l) => celulas(l)[col] || '')
    .map((t) => t.replace(/^["“]|["”]$/g, '').trim())
    .filter(Boolean)
    .join(' ')
}

/**
 * Extrai os campos de um roteiro. Tolerante a variações de rótulo porque o
 * output da IA nem sempre respeita o formato à risca.
 */
export function parseRoteiro(chunk) {
  const texto = String(chunk || '')

  const cabecalho = texto.match(/^##\s+ROTEIRO\s+(\d+)\s*:?\s*(.*)$/im)
  const metaLinha = cabecalho ? cabecalho[2].trim() : ''

  // Variações reais do cabeçalho:
  //   "Gancho: ⚡ Sensação | Nível: Inconsciente do Problema"
  //   "Gancho: Dilema | Meio de Funil"        (sem o rótulo "Nível:")
  const tipoGancho = metaLinha.match(/Gancho\s*:\s*([^|]+)/i)
  const nivelRotulado = metaLinha.match(/N[íi]vel\s*:\s*([^|]+)/i)
  const depoisDaBarra = metaLinha.includes('|') ? metaLinha.split('|').pop().trim() : ''
  const nivel = nivelRotulado ? nivelRotulado[1].trim() : depoisDaBarra

  /**
   * A IA às vezes repete o TIPO do bloco na mesma linha do rótulo
   * (ex.: "**GANCHO (0s – 3s):** Dilema" ou "**🔥 MENSAGEM (3s – 45s)** — Oferta")
   * antes do texto real, que vem abaixo. Essa primeira linha é anotação, não copy:
   * descartamos quando é curta e não termina como frase.
   */
  const semAnotacaoDeTipo = (bruto) => {
    const linhas = bruto.split('\n')
    if (linhas.length < 2) return bruto
    const primeira = linhas[0].replace(/^[—–-]\s*/, '').trim()
    const ehAnotacao = primeira.length > 0 && primeira.length <= 50 && !/[.!?:]$/.test(primeira)
    return ehAnotacao ? linhas.slice(1).join('\n').trim() : bruto
  }

  const campo = (re) => {
    const m = texto.match(re)
    if (!m) return ''
    return semAnotacaoDeTipo(m[1].replace(/^[ \t]*\n/, '').trim())
  }

  // Cada bloco vai até o próximo rótulo em negrito ou o fim do chunk.
  // O "[^*]*" antes do nome cobre rótulos com emoji: "**⏱ GANCHO ...**".
  const ate = String.raw`([\s\S]*?)(?=\n\s*\*\*|$)`
  const gancho = campo(new RegExp(String.raw`\*\*[^*]*GANCHO[^*]*\*\*:?\s*${ate}`, 'i'))
  let mensagem = campo(new RegExp(String.raw`\*\*[^*]*MENSAGEM[^*]*\*\*:?\s*${ate}`, 'i'))
  const cta = campo(new RegExp(String.raw`\*\*[^*]*CTA[^*]*\*\*:?\s*${ate}`, 'i'))
  const legenda = campo(new RegExp(String.raw`\*\*[^*]*LEGENDA[^*]*\*\*:?\s*${ate}`, 'i'))

  // Gerações antigas trazem o desenvolvimento numa tabela "| Tempo | Fala | Imagem |"
  // sob o rótulo "**ROTEIRO**", sem um bloco MENSAGEM. Aproveitamos a coluna de
  // fala para o bloco 02 não sair vazio.
  if (!mensagem) mensagem = falaDaTabela(texto)

  // Duração total = maior marca de tempo citada (ex.: "CTA FINAL (45s – 60s)" → 60 s).
  // Um "Duração alvo: 45s" explícito, quando existe, tem precedência.
  const alvo = texto.match(/Dura[çc][ãa]o\s*(?:alvo)?\s*:?\s*~?\s*(\d+)\s*s/i)
  const marcas = [...texto.matchAll(/(\d+)\s*s\b/gi)].map((m) => Number(m[1]))
  const total = alvo ? Number(alvo[1]) : marcas.length ? Math.max(...marcas) : null
  const duracao = total ? `${total} s` : '30-60 s'

  // Hashtags saem da legenda e vão para a linha de baixo da caixa.
  const tags = legenda.match(/#[\p{L}\d_]+/gu) || []
  const legendaLimpa = legenda.replace(/#[\p{L}\d_]+/gu, '').replace(/\s{2,}/g, ' ').trim()

  return {
    numero: cabecalho ? Number(cabecalho[1]) : null,
    // Emoji some do título: a Sora não tem esses glifos e some na impressão.
    titulo: (tipoGancho ? tipoGancho[1] : metaLinha || 'Roteiro')
      .replace(/\p{Extended_Pictographic}|️/gu, '')
      .trim(),
    nivel,
    duracao,
    gancho,
    mensagem,
    cta,
    legenda: legendaLimpa,
    hashtags: tags.join(' '),
  }
}

// ─── Montagem do HTML ─────────────────────────────────────────────────────────

function paragrafos(valor) {
  const blocos = String(valor || '')
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, ' ').trim())
    .filter(Boolean)
  if (!blocos.length) return '<p style="margin:6px 0 0;"></p>'
  return blocos
    .map((p, i) => {
      const margem = i === 0 ? (blocos.length > 1 ? '6px 0 16px' : '6px 0 0') : i < blocos.length - 1 ? '0 0 16px' : '0'
      return `<p style="margin:${margem};">${limpo(p)}</p>`
    })
    .join('')
}

function celula(rotulo, valor) {
  return `
        <div style="background:rgba(7,2,48,0.35);padding:12px 18px;">
          <div style="font-family:'Sora',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.5);margin-bottom:6px;">${esc(rotulo)}</div>
          <div style="font-weight:600;font-size:16px;">${esc(valor)}</div>
        </div>`
}

function bloco(numero, titulo, dica, corpoHTML, peso = '500', primeiro = false) {
  const borda = primeiro ? '' : `border-top:1px solid ${LINHA};margin-top:24px;padding-top:24px;`
  return `
      <section style="display:grid;grid-template-columns:118px 1fr;gap:28px;break-inside:avoid;${borda}">
        <div>
          <div style="font-family:'Sora',sans-serif;font-weight:800;font-size:34px;line-height:1;color:${AZUL};">${numero}</div>
          <div style="font-family:'Sora',sans-serif;font-weight:700;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;color:${TINTA_FORTE};margin-top:12px;">${esc(titulo)}</div>
          <div style="font-size:12.5px;line-height:1.5;color:${CINZA};margin-top:6px;">${esc(dica)}</div>
        </div>
        <div style="font-size:16.5px;line-height:1.55;font-weight:${peso};color:${TINTA};text-wrap:pretty;">${corpoHTML}</div>
      </section>`
}

function artigo(r, indice, origem) {
  const quebra = indice > 1 ? 'break-before:page;' : ''
  const metas = [
    ['Data de gravação', r.data || 'A definir'],
    ['Duração estimada', r.duracao || '30-60 s'],
    ['Plataforma', r.plataforma || 'Reels / Feed / YouTube'],
    ['Nível de consciência', r.nivel || 'A definir'],
  ]

  const legenda =
    r.legenda || r.hashtags
      ? `
      <section style="break-inside:avoid;border-top:1px solid ${LINHA};margin-top:24px;padding-top:24px;">
        <div style="background:${CAIXA_BG};border:1px solid ${CAIXA_BORDA};border-radius:12px;padding:20px 24px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
            <span style="font-family:'Sora',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:${AZUL};">Legenda do post</span>
          </div>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.55;font-weight:500;color:${TINTA};text-wrap:pretty;">${limpo(r.legenda)}</p>
          <div style="font-size:15px;font-weight:600;color:${CINZA_MEDIO};">${limpo(r.hashtags)}</div>
        </div>
      </section>`
      : ''

  return `
  <article style="${quebra}break-inside:auto;">
    <header style="position:relative;overflow:hidden;background:radial-gradient(135% 130% at 8% 0%, ${AZUL} 0%, #14049C 42%, #070230 100%);color:#fff;padding:40px 56px 32px;">
      <img src="${origem}/verta/simbolo.png" alt="" style="position:absolute;right:-70px;top:-60px;width:360px;opacity:0.14;pointer-events:none;">
      <div style="position:relative;display:flex;align-items:center;justify-content:space-between;gap:24px;margin-bottom:26px;">
        <img src="${origem}/verta/logo-branca.png" alt="Verta" style="height:30px;width:auto;">
        <span style="font-family:'Sora',sans-serif;font-weight:700;font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:rgba(255,255,255,0.72);">Roteiro · Anúncio pago</span>
      </div>
      <div style="position:relative;font-family:'Sora',sans-serif;font-weight:700;font-size:13px;letter-spacing:0.24em;text-transform:uppercase;color:${AZUL_CLARO};margin-bottom:14px;">Roteiro ${String(indice).padStart(2, '0')}</div>
      <h1 style="position:relative;font-family:'Sora',sans-serif;font-weight:800;font-size:34px;line-height:1.1;letter-spacing:-0.02em;margin:0 0 24px;max-width:84%;text-wrap:balance;">${limpo(r.titulo)}</h1>
      <div style="position:relative;display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.16);border-radius:12px;overflow:hidden;">${metas
        .map(([k, v]) => celula(k, v))
        .join('')}
      </div>
    </header>

    <div style="padding:32px 56px 24px;background:#fff;">
${bloco('01', 'Gancho', 'Primeiros 3 segundos. Fala olhando pra câmera.', paragrafos(r.gancho), '500', true)}
${bloco('02', 'Mensagem', 'Desenvolvimento. Entregue a virada de chave.', paragrafos(r.mensagem))}
${bloco('03', 'CTA', 'Chamada final. Direta e no imperativo.', paragrafos(r.cta), '600')}
${legenda}
    </div>

    <footer style="display:flex;align-items:center;justify-content:space-between;padding:14px 56px;background:#fff;border-top:1px solid ${LINHA};">
      <img src="${origem}/verta/logo-azul.png" alt="Verta" style="height:18px;width:auto;opacity:0.85;">
      <span style="font-size:12px;color:${CINZA};letter-spacing:0.02em;">Documento confidencial · preparado pela Verta</span>
    </footer>
  </article>`
}

/** Exportado para permitir inspeção/teste do HTML sem abrir janela. */
export function montarHTML(roteiros, { titulo, origem }) {
  const artigos = roteiros.map((r, i) => artigo(r, i + 1, origem)).join('\n')
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${esc(titulo)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  /* Página sob medida: um roteiro por página, sem comprimir a tipografia. */
  @page { size: ${PAG_W}px ${PAG_H}px; margin: 0; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Manrope',-apple-system,BlinkMacSystemFont,sans-serif; background:#fff; color:${TINTA};
         -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  /* footer ancorado no rodapé da página, mesmo em roteiro curto */
  article { min-height:${PAG_H - 4}px; display:flex; flex-direction:column; }
  article > div { flex:1; }
  .print-btn { position:fixed; right:24px; bottom:24px; z-index:99;
    font-family:'Sora',sans-serif; font-weight:700; font-size:14px; color:#fff;
    background:${AZUL}; border:0; border-radius:10px; padding:14px 22px; cursor:pointer;
    box-shadow:0 6px 20px rgba(42,37,240,0.35); }
  @media print { .print-btn { display:none; } }
</style>
</head>
<body>
${artigos}
<button class="print-btn" onclick="window.print()">Salvar como PDF</button>
</body>
</html>`
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Abre a janela de impressão com os roteiros de vídeo no template Verta.
 * @param {string} content  Markdown gerado pela IA
 * @param {object} opts     { companyName, index } — index limita a 1 roteiro
 * @returns {boolean}       false se não havia roteiro reconhecível
 */
export function exportRoteirosVideoPDF(content, { companyName = 'Cliente', index = null } = {}) {
  let chunks = splitRoteiros(content)
  if (!chunks.length) return false

  if (index != null) {
    // Export de um card individual: o conteúdo já é o roteiro isolado.
    chunks = [chunks[0]]
  }

  const roteiros = chunks.map(parseRoteiro).filter((r) => r.gancho || r.mensagem || r.cta)
  if (!roteiros.length) return false

  const titulo = `${companyName} · Roteiros de Anúncio em Vídeo`
  const html = montarHTML(roteiros, { titulo, origem: window.location.origin })

  const win = window.open('', '_blank', `width=1100,height=900`)
  if (!win) {
    alert('Permita pop-ups para exportar o PDF.')
    return true
  }
  win.document.write(html)
  win.document.close()
  return true
}
