#!/usr/bin/env node
// Conta, por arquivo, os textos de interface que ainda estão em português cravado no código
// (fora do i18n). É uma estimativa para acompanhar o checklist (docs/i18n-checklist.md), não
// uma lista exata: pega texto entre tags JSX e literais de string com cara de frase, e ignora
// comentários, imports, classes CSS, chaves de i18n e strings técnicas.
//
//   node scripts/i18n_inventario.mjs              → tabela de todos os arquivos com texto
//   node scripts/i18n_inventario.mjs src/pages    → só uma pasta
//   node scripts/i18n_inventario.mjs --arquivo src/pages/Login.jsx   → lista os textos achados
//   node scripts/i18n_inventario.mjs --md         → linhas prontas para o checklist
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
const args = process.argv.slice(2)
const modoMd = args.includes('--md')
const iArq = args.indexOf('--arquivo')
const soArquivo = iArq >= 0 ? args[iArq + 1] : null
const alvos = args.filter((a, i) => !a.startsWith('--') && i !== iArq + 1)
const PADRAO = ['src', 'public/dash-teste', 'api']
const IGNORAR_DIR = new Set(['node_modules', 'dev', 'fixtures', 'vendor', 'mock', 'i18n'])
const EXT = new Set(['.js', '.jsx', '.mjs', '.html'])

function listar(dir, out = []) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome)
    const st = statSync(p)
    if (st.isDirectory()) { if (!IGNORAR_DIR.has(nome)) listar(p, out) }
    else if (EXT.has(extname(nome))) out.push(p)
  }
  return out
}

// Palavra portuguesa comum ou acento: separa texto de interface de identificador.
const PT = /[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]|\b(de|do|da|dos|das|para|com|sem|não|um|uma|os|as|no|na|ao|por|seu|sua|mais|novo|nova|salvar|cancelar|excluir|editar|carregando|nenhum|nenhuma|erro|clique|selecione|adicionar|abrir|fechar|voltar|enviar|copiar|buscar|tarefa|cliente|semana|hoje|ontem|dias?)\b/i
const TECNICO = /^(https?:|\/|\.|#|[a-z0-9_-]+$|[A-Z_]+$|[\w.-]+\.(js|jsx|css|png|svg|json)$)|^\s*$/

function semComentarios(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, a) => a + ' '.repeat(m.length - a.length))
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
}

function textos(arquivo) {
  const src = semComentarios(readFileSync(arquivo, 'utf8'))
  const achados = []
  const linhaDe = (i) => src.slice(0, i).split('\n').length
  const ok = (s) => {
    const v = s.trim()
    return v.length > 1 && /[a-zA-ZÀ-ú]{2}/.test(v) && PT.test(v) && !TECNICO.test(v)
  }
  // Texto entre tags (JSX/HTML).
  for (const m of src.matchAll(/>([^<>{}]+)</g)) {
    if (ok(m[1])) achados.push({ linha: linhaDe(m.index), texto: m[1].trim() })
  }
  // Literais de string, exceto import, className, chaves t('...') e console.
  for (const m of src.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g)) {
    const antes = src.slice(Math.max(0, m.index - 40), m.index)
    if (/(import|from|className=|class=|console\.\w+\(|\bt\(|require\()\s*$/.test(antes)) continue
    if (/^[\w.]+$/.test(m[2])) continue
    if (ok(m[2])) achados.push({ linha: linhaDe(m.index), texto: m[2].trim().slice(0, 90) })
  }
  const vistos = new Set()
  return achados
    .sort((a, b) => a.linha - b.linha)
    .filter((a) => { const k = a.linha + a.texto; if (vistos.has(k)) return false; vistos.add(k); return true })
}

if (soArquivo) {
  for (const a of textos(join(RAIZ, soArquivo))) console.log(`${String(a.linha).padStart(5)}  ${a.texto}`)
  process.exit(0)
}

const arquivos = (alvos.length ? alvos : PADRAO).flatMap((d) => {
  const p = join(RAIZ, d)
  return statSync(p).isDirectory() ? listar(p) : [p]
})
const linhas = arquivos
  .map((p) => ({ arq: relative(RAIZ, p), n: textos(p).length }))
  .filter((x) => x.n > 0)
  .sort((a, b) => a.arq.localeCompare(b.arq))

const total = linhas.reduce((s, x) => s + x.n, 0)
if (modoMd) {
  for (const x of linhas) console.log(`- [ ] \`${x.arq}\` (${x.n})`)
} else {
  for (const x of linhas) console.log(`${String(x.n).padStart(5)}  ${x.arq}`)
}
console.log(`\n${linhas.length} arquivos com texto em português · ~${total} textos`)
