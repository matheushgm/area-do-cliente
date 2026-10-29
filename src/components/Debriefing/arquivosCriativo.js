// Arquivos de um criativo da Central de anúncios (um anúncio pode ter vários).
//
// ad.arquivos = [{ path, name, formato, midia, largura, altura }]
//   formato: 'feed' | 'story' | 'card' (card = cartão de carrossel, na ordem)
//   midia:   'image' | 'video' | 'pdf' | 'other'
// O arquivo principal (o primeiro que não é story) continua espelhado em
// attachmentPath/attachmentName, que é o que etapaDoAd, o portal e quem ainda
// não conhece `arquivos` leem.
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export const ATTACHMENT_BUCKET = 'attachments'

export const FORMATOS = {
  feed:  { id: 'feed',  label: 'Feed' },
  story: { id: 'story', label: 'Story' },
  card:  { id: 'card',  label: 'Card' },
}

// Como o lote foi montado no "Grupo de anúncios" (ad.grupo.modo).
export const MODOS_GRUPO = {
  posts:     { id: 'posts',     label: 'Posts separados' },
  carrossel: { id: 'carrossel', label: 'Carrossel' },
}

export function midiaDoArquivo(file) {
  const mime = String(file?.type || '').toLowerCase()
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime === 'application/pdf') return 'pdf'
  return midiaDoNome(file?.name)
}

export function midiaDoNome(name) {
  const ext = String(name || '').split('.').pop()?.toLowerCase() || ''
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'heic'].includes(ext)) return 'image'
  if (['mp4', 'mov', 'webm', 'm4v'].includes(ext)) return 'video'
  if (ext === 'pdf') return 'pdf'
  return 'other'
}

// ─── Formato (feed x story) ──────────────────────────────────────────────────
const TOKEN_STORY = /^(story|stories|storie|storys|reel|reels|9x16|1080x1920)$/
const TOKEN_FEED  = /^(feed|4x5|1x1|1080x1350|1080x1080|quadrado)$/

function tokens(name) {
  return String(name || '')
    .replace(/\.[^.]+$/, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

// Proporção 9:16 (altura de 1,6× a largura pra cima) é story; quadrado, 4:5
// e paisagem vão pro feed.
export function formatoPorMedida(largura, altura) {
  if (!largura || !altura) return null
  return altura / largura >= 1.6 ? 'story' : 'feed'
}

export function formatoPorNome(name) {
  const t = tokens(name)
  if (t.some((x) => TOKEN_STORY.test(x))) return 'story'
  if (t.some((x) => TOKEN_FEED.test(x))) return 'feed'
  return null
}

// A medida manda (é o posicionamento de verdade); o nome só decide quando o
// arquivo não tem medida (PDF, vídeo que o navegador não abre).
export function formatoDoArquivo({ name, largura, altura }) {
  return formatoPorMedida(largura, altura) || formatoPorNome(name) || 'feed'
}

// Chave que junta o feed e o story da mesma peça: o nome sem extensão e sem
// as palavras de formato, com os números normalizados (AD01 = AD1 = AD 1).
// "AD1 - FEED.png" e "AD1 - STORY.png" dão a mesma chave.
export function chaveBase(name) {
  return tokens(name)
    .filter((x) => !TOKEN_STORY.test(x) && !TOKEN_FEED.test(x))
    .map((x) => x.replace(/\d+/g, (n) => String(Number(n))))
    .join('')
}

// Largura/altura de imagem ou vídeo lidas no navegador, sem subir nada.
// Vídeo que o navegador não decodifica (HEVC em alguns casos) desiste em 6 s.
export function lerMedidas(file) {
  const midia = midiaDoArquivo(file)
  if (midia !== 'image' && midia !== 'video') {
    return Promise.resolve({ midia, largura: null, altura: null })
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    let feito = false
    const fim = (largura, altura) => {
      if (feito) return
      feito = true
      URL.revokeObjectURL(url)
      resolve({ midia, largura: largura || null, altura: altura || null })
    }
    setTimeout(() => fim(), 6000)
    if (midia === 'image') {
      const img = new Image()
      img.onload = () => fim(img.naturalWidth, img.naturalHeight)
      img.onerror = () => fim()
      img.src = url
    } else {
      const v = document.createElement('video')
      v.preload = 'metadata'
      v.muted = true
      v.onloadedmetadata = () => fim(v.videoWidth, v.videoHeight)
      v.onerror = () => fim()
      v.src = url
    }
  })
}

const porNome = (a, b) => String(a || '').localeCompare(String(b || ''), 'pt-BR', { numeric: true, sensitivity: 'base' })

// Monta os criativos de "posts separados": cada criativo tem até um feed e um
// story. Junta pelo nome (chaveBase); o que não acha par vira criativo sozinho.
// `itens` = [{ uid, name, formato, ... }] → [{ feed: item|null, story: item|null }]
export function parearFeedStory(itens) {
  const porChave = new Map()
  for (const it of [...itens].sort((a, b) => porNome(a.name, b.name))) {
    const k = chaveBase(it.name)
    if (!porChave.has(k)) porChave.set(k, [])
    porChave.get(k).push(it)
  }
  const criativos = []
  for (const lista of porChave.values()) {
    const feeds = lista.filter((i) => i.formato !== 'story')
    const stories = lista.filter((i) => i.formato === 'story')
    const n = Math.max(feeds.length, stories.length)
    for (let i = 0; i < n; i++) criativos.push({ feed: feeds[i] || null, story: stories[i] || null })
  }
  const nomeDe = (c) => (c.feed || c.story).name
  return criativos.sort((a, b) => porNome(chaveBase(nomeDe(a)), chaveBase(nomeDe(b))) || porNome(nomeDe(a), nomeDe(b)))
}

// ─── Leitura no anúncio ──────────────────────────────────────────────────────
// Lista de arquivos do anúncio. Anúncio antigo (só attachmentPath) vira uma
// lista de um item, com o formato deduzido do nome.
export function arquivosDoAd(ad) {
  if (Array.isArray(ad?.arquivos) && ad.arquivos.length) return ad.arquivos
  if (!ad?.attachmentPath) return []
  const name = ad.attachmentName || ad.attachmentPath.split('/').pop()
  return [{
    path:    ad.attachmentPath,
    name,
    formato: ad.tipo === 'carrossel' ? 'card' : (formatoPorNome(name) || 'feed'),
    midia:   midiaDoNome(name),
  }]
}

// Campos antigos (attachmentPath/Name) apontando pro arquivo principal.
// attachmentUrl fica nulo: o bucket é privado, a URL pública não abre.
export function espelhoLegado(arquivos) {
  const principal = (arquivos || []).find((a) => a.formato !== 'story') || arquivos?.[0] || null
  return {
    attachmentPath: principal?.path || null,
    attachmentName: principal?.name || null,
    attachmentUrl:  null,
  }
}

// Resumo curto pra tabela: "Feed + Story", "Carrossel · 5 cards", "Story".
export function resumoArquivos(arquivos) {
  if (!arquivos?.length) return ''
  if (arquivos.some((a) => a.formato === 'card')) {
    return `Carrossel · ${arquivos.length} ${arquivos.length === 1 ? 'card' : 'cards'}`
  }
  const tem = (f) => arquivos.some((a) => a.formato === f)
  return [tem('feed') && 'Feed', tem('story') && 'Story'].filter(Boolean).join(' + ') || `${arquivos.length} arquivos`
}

export function caminhoArquivo(projectId, adId, formato, name) {
  const safe = String(name || 'arquivo').replace(/[^A-Za-z0-9._-]+/g, '_')
  return `${projectId}/debriefing/${adId}-${formato}-${safe}`
}

// URLs assinadas (1 h) pras miniaturas dos arquivos já salvos: { [path]: url }.
export function useUrlsAssinadas(paths) {
  const chave = (paths || []).filter(Boolean).join('|')
  const [urls, setUrls] = useState({})
  useEffect(() => {
    const lista = chave ? chave.split('|') : []
    if (!lista.length) return undefined
    let vivo = true
    supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrls(lista, 3600)
      .then(({ data }) => {
        if (!vivo || !data) return
        setUrls((prev) => {
          const next = { ...prev }
          for (const d of data) if (d?.signedUrl) next[d.path] = d.signedUrl
          return next
        })
      })
      .catch(() => {})
    return () => { vivo = false }
  }, [chave])
  return urls
}
