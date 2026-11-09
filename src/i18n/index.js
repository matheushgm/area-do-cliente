import { useCallback, useSyncExternalStore } from 'react'
// Um arquivo por namespace: `locales/<idioma>/<namespace>.js`, e a chave começa pelo
// nome do arquivo (`login.entrar` → locales/pt/login.js, chave `entrar`). Cada tela
// tem o seu, para duas pessoas traduzindo ao mesmo tempo não mexerem no mesmo arquivo.
function carregar(modulos) {
  const out = {}
  for (const [caminho, mod] of Object.entries(modulos)) {
    out[caminho.split('/').pop().replace(/\.js$/, '')] = mod.default
  }
  return out
}
// Fora do Vite (regras copiadas para rodar no Node, ex.: cascata.js, sprints.js) não há
// `import.meta.glob`: os dicionários ficam vazios e `t` devolve a própria chave, sem quebrar.
// O Vite troca cada chamada literal pelo objeto dos módulos, então o try não custa nada lá.
function globPt() { try { return import.meta.glob('./locales/pt/*.js', { eager: true }) } catch { return {} } }
function globEn() { try { return import.meta.glob('./locales/en/*.js', { eager: true }) } catch { return {} } }
const pt = carregar(globPt())
const en = carregar(globEn())

// Internacionalização da área interna. Sem biblioteca: um store fora do React
// (useSyncExternalStore), então `t()` funciona também em código que não é
// componente, e os componentes que chamam `useI18n()` redesenham na troca.
//
// Regras:
// - Chave = namespace (nome do arquivo em locales/) + caminho (`'sidebar.clientes'`).
//   O português é a fonte: chave que falta no inglês cai no português, e falta
//   nos dois devolve a própria chave (e avisa no console em DEV).
// - Variáveis com `{nome}`: t('x.y', { nome: 'Ana' }).
// - Plural: o valor é `{ one, other }` (e `zero`, opcional) e a escolha vem de `vars.count`.
// - Em componente, use `const { t } = useI18n()`; o `t` solto não faz o
//   componente redesenhar ao trocar o idioma.
// - Rótulo em constante de módulo (menus, listas) guarda a CHAVE, e a tradução
//   acontece no render.

export const IDIOMAS = [
  { id: 'pt', rotulo: 'Português', curto: 'PT', locale: 'pt-BR' },
  { id: 'en', rotulo: 'English', curto: 'EN', locale: 'en-US' },
]

const DICIONARIOS = { pt, en }
const PADRAO = 'pt'
const STORAGE_KEY = 'rl_lang'
const EVENTO = 'rl-lang'

function valido(id) {
  return IDIOMAS.some((i) => i.id === id) ? id : null
}

function lerSalvo() {
  try { return valido(localStorage.getItem(STORAGE_KEY)) } catch { return null }
}

let atual = (typeof window !== 'undefined' && lerSalvo()) || PADRAO

function aplicarNoDocumento(id) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = IDIOMAS.find((i) => i.id === id)?.locale || 'pt-BR'
}
aplicarNoDocumento(atual)

const ouvintes = new Set()
function avisar() { ouvintes.forEach((fn) => fn()) }

function assinar(fn) {
  ouvintes.add(fn)
  return () => ouvintes.delete(fn)
}

// Outra aba (ou o iframe do dashboard) trocou o idioma: acompanha.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return
    const novo = valido(e.newValue) || PADRAO
    if (novo === atual) return
    atual = novo
    aplicarNoDocumento(novo)
    avisar()
  })
}

export function idiomaAtual() { return atual }

// Escolha gravada neste navegador (null = nunca escolheu aqui).
export function idiomaSalvoLocal() { return lerSalvo() }

export function localeAtual() {
  return IDIOMAS.find((i) => i.id === atual)?.locale || 'pt-BR'
}

export function definirIdioma(id) {
  const novo = valido(id) || PADRAO
  if (novo === atual) return
  atual = novo
  try { localStorage.setItem(STORAGE_KEY, novo) } catch { /* noop */ }
  aplicarNoDocumento(novo)
  window.dispatchEvent(new Event(EVENTO))
  avisar()
}

function buscar(dic, chave) {
  let v = dic
  for (const parte of chave.split('.')) {
    if (v == null || typeof v !== 'object') return undefined
    v = v[parte]
  }
  return v
}

const avisadas = new Set()
const regrasPlural = {}

function traduzir(lang, chave, vars) {
  let v = buscar(DICIONARIOS[lang], chave)
  if (v === undefined && lang !== PADRAO) v = buscar(DICIONARIOS[PADRAO], chave)
  if (v === undefined) {
    if (import.meta.env?.DEV && Object.keys(pt).length && !avisadas.has(chave)) {
      avisadas.add(chave)
      console.warn(`[i18n] chave sem tradução: ${chave}`)
    }
    return chave
  }
  if (v && typeof v === 'object') {
    const n = Number(vars?.count ?? 0)
    const locale = IDIOMAS.find((i) => i.id === lang)?.locale || 'pt-BR'
    const regras = (regrasPlural[locale] ||= new Intl.PluralRules(locale))
    // Em pt-BR o CLDR põe o 0 no singular ("0 dia"); aqui o zero vai para `zero`, se houver, senão `other`.
    const forma = n === 0 ? 'zero' : regras.select(n)
    v = v[forma] ?? v.other ?? ''
  }
  if (typeof v !== 'string') return chave
  if (!vars) return v
  return v.replace(/\{(\w+)\}/g, (m, nome) => (vars[nome] ?? m))
}

// `t` fora de componente (helpers, toasts disparados por código).
export function t(chave, vars) {
  return traduzir(atual, chave, vars)
}

export function useI18n() {
  const lang = useSyncExternalStore(assinar, idiomaAtual, () => PADRAO)
  const tt = useCallback((chave, vars) => traduzir(lang, chave, vars), [lang])
  const locale = IDIOMAS.find((i) => i.id === lang)?.locale || 'pt-BR'
  return { lang, locale, t: tt, setLang: definirIdioma }
}
