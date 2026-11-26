// Mini-i18n do Dashboard de Tráfego (viewer.html e anuncio.html).
//
// O viewer é HTML estático servido de public/ e não importa de src/, então não usa src/i18n.
// Mesmas regras: chave = namespace + caminho (`v1.carregando`), português é a fonte, chave que
// falta no inglês cai no português, plural `{ one, other, zero? }` com `vars.count`, variáveis `{nome}`.
// Os dicionários ficam em ./i18n/<namespace>.js, cada um com `export default { pt: {...}, en: {...} }`,
// e são registrados com `registrar('<namespace>', dic)`.
//
// Idioma: dentro do app (iframe, mesma origem) vale o `rl_lang` do localStorage, que o app grava.
// No link público (`?shared=1`, e a página anuncio.html) vale a regra das páginas públicas: `?lang=en|pt` (fica salvo) →
// escolha salva neste navegador → idioma do navegador → português.
// Troca ao vivo: o app grava `rl_lang`, o evento `storage` chega aqui e disparamos `idioma-mudou`,
// que o viewer usa para redesenhar.

const STORAGE_KEY = 'rl_lang'
const LOCALES = { pt: 'pt-BR', en: 'en-US' }
const DICS = {}

const valido = (v) => (v === 'pt' || v === 'en' ? v : null)
function lerSalvo() {
  try { return valido(localStorage.getItem(STORAGE_KEY)) } catch { return null }
}

function idiomaInicial() {
  const qs = new URLSearchParams(location.search)
  const daUrl = valido(qs.get('lang'))
  if (daUrl) {
    try { localStorage.setItem(STORAGE_KEY, daUrl) } catch { /* noop */ }
    return daUrl
  }
  const salvo = lerSalvo()
  if (salvo) return salvo
  // Públicos: o link compartilhado do viewer e a página de um anúncio (/anuncio/<token> ou anuncio.html).
  if (qs.get('shared') === '1' || /\/anuncio(\.html$|\/)/.test(location.pathname)) {
    for (const l of navigator.languages || [navigator.language]) {
      const id = valido(String(l || '').slice(0, 2).toLowerCase())
      if (id) return id
    }
  }
  return 'pt'
}

let atual = idiomaInicial()
function aplicarNoDocumento() { document.documentElement.lang = LOCALES[atual] }
aplicarNoDocumento()

window.addEventListener('storage', (e) => {
  if (e.key && e.key !== STORAGE_KEY) return
  const novo = lerSalvo() || 'pt'
  if (novo === atual) return
  atual = novo
  aplicarNoDocumento()
  traduzirDom()
  window.dispatchEvent(new CustomEvent('idioma-mudou'))
})

export function idioma() { return atual }
export function locale() { return LOCALES[atual] }

export function registrar(ns, dic) { DICS[ns] = dic }

function buscar(obj, partes) {
  let v = obj
  for (const p of partes) {
    if (v == null || typeof v !== 'object') return undefined
    v = v[p]
  }
  return v
}

const regras = {}
export function t(chave, vars) {
  const [ns, ...partes] = chave.split('.')
  const dic = DICS[ns]
  let v = dic && buscar(dic[atual], partes)
  if (v === undefined && dic) v = buscar(dic.pt, partes)
  if (v === undefined) {
    if (!t._avisadas) t._avisadas = new Set()
    if (!t._avisadas.has(chave)) { t._avisadas.add(chave); console.warn(`[i18n viewer] chave sem tradução: ${chave}`) }
    return chave
  }
  if (typeof v === 'function') return v(vars || {})
  if (v && typeof v === 'object') {
    const n = Number(vars?.count ?? 0)
    const r = (regras[atual] ||= new Intl.PluralRules(LOCALES[atual]))
    const forma = n === 0 ? 'zero' : r.select(n)
    v = v[forma] ?? v.other ?? ''
  }
  if (typeof v !== 'string') return chave
  if (!vars) return v
  return v.replace(/\{(\w+)\}/g, (m, nome) => (vars[nome] ?? m))
}

// HTML fixo da página: `<span data-i18n="v1.fonte">texto em pt</span>` troca o conteúdo;
// `data-i18n-html` troca como HTML (só texto nosso, nunca dado de fora);
// `data-i18n-attr="title:v1.chave;placeholder:v1.outra"` troca atributos.
export function traduzirDom(raiz = document) {
  raiz.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n) })
  raiz.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml) })
  raiz.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    for (const par of el.dataset.i18nAttr.split(';')) {
      const [attr, chave] = par.split(':')
      if (attr && chave) el.setAttribute(attr.trim(), t(chave.trim()))
    }
  })
}
