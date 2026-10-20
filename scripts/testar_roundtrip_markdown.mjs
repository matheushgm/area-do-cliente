// Testa se o editor (Lexical) devolve o MESMO Markdown que recebeu, com os
// criativos reais do banco. O texto dos criativos é um contrato lido por regex
// em vários lugares (splitChunks, replaceAdInContent, PDFs, copyLevas), então
// qualquer caractere a mais ou a menos na ida e volta quebra o fluxo.
//
//   node scripts/testar_roundtrip_markdown.mjs [limite=40]
//
// Lê SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY do .env (só leitura no banco).
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { createHeadlessEditor } from '@lexical/headless'
import { $getRoot } from 'lexical'
import {
  EDITOR_NODES,
  $markdownParaEditor,
  $editorParaMarkdown,
} from '../src/components/Editor/markdownConfig.js'

const env = Object.fromEntries(
  fs
    .readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [
        l.slice(0, i).trim(),
        l
          .slice(i + 1)
          .trim()
          .replace(/^"|"$/g, ''),
      ]
    })
)
const limite = Number(process.argv[2] || 40)
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// Mesma lógica de src/components/Criativos/CreativeResultBlock.jsx
const AD_HEADER = /^##\s+(?:ROTEIRO|AN[ÚU]NCIO)\s+\d+/im
function splitChunks(content) {
  const parts = content.split(/(?=^##\s+(?:ROTEIRO|AN[ÚU]NCIO)\s+\d+)/im)
  const ad = parts.filter((p) => p.trim() && AD_HEADER.test(p.trim()))
  if (ad.length) return ad
  const chunks = content
    .split(/\n---\n/)
    .map((c) => c.trim())
    .filter(Boolean)
  return chunks.length > 1 ? chunks : [content]
}
function stripTrailingSeparator(t) {
  return t.replace(/\n[ \t]*-{3,}\s*$/, '').trimEnd()
}
function parseChunk(chunk) {
  const firstLine = chunk.split('\n')[0].trim()
  const m = firstLine.match(/^#{1,3}\s+(.+)/)
  if (!m) return stripTrailingSeparator(chunk)
  const body = stripTrailingSeparator(chunk.slice(firstLine.length).trimStart())
  return body || chunk
}

const editor = createHeadlessEditor({
  nodes: EDITOR_NODES,
  onError: (e) => {
    throw e
  },
})
function roundtrip(md) {
  editor.update(
    () => {
      $getRoot().clear()
      $markdownParaEditor(md)
    },
    { discrete: true }
  )
  return editor.getEditorState().read(() => $editorParaMarkdown())
}
function primeiraDiferenca(a, b) {
  const la = a.split('\n'),
    lb = b.split('\n')
  for (let i = 0; i < Math.max(la.length, lb.length); i++) {
    if (la[i] !== lb[i]) return { linha: i + 1, antes: la[i], depois: lb[i] }
  }
  return null
}

const { data, error } = await sb
  .from('criativos')
  .select('id, answers, generated_content, created_at')
  .not('generated_content', 'is', null)
  .order('created_at', { ascending: false })
  .limit(limite)
if (error) {
  console.error(error.message)
  process.exit(1)
}

let total = 0,
  ok = 0
const falhas = []
for (const row of data) {
  const tipo = row.answers?.type || 'estatico'
  for (const chunk of splitChunks(row.generated_content)) {
    for (const [rotulo, texto] of [
      ['chunk', chunk.trim()],
      ['body', parseChunk(chunk.trim())],
    ]) {
      total++
      const volta = roundtrip(texto)
      if (volta === texto) {
        ok++
        continue
      }
      falhas.push({
        id: row.id,
        tipo,
        rotulo,
        diff: primeiraDiferenca(texto, volta),
        tam: [texto.length, volta.length],
      })
    }
  }
}
console.log(
  `criativos: ${data.length} · trechos testados: ${total} · idênticos: ${ok} · diferentes: ${falhas.length}`
)
const porMotivo = new Map()
for (const f of falhas) {
  const chave = `${f.tipo}/${f.rotulo}:\n   ANTES : ${f.diff?.antes ?? ''}\n   DEPOIS: ${f.diff?.depois ?? ''}`
  porMotivo.set(chave, (porMotivo.get(chave) || 0) + 1)
}
for (const [k, n] of [...porMotivo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25))
  console.log(`${String(n).padStart(3)}× ${k}`)
process.exit(falhas.length ? 2 : 0)
