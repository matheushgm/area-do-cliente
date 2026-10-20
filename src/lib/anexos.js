// Helpers de anexos (chat e tarefas): tipo pelo nome/mime, tamanho legível e
// URL de acesso (assinada para arquivo privado do Storage, direta para URL
// externa, ex.: anexo vindo do ClickUp).
import { getSignedUrl } from './supabase'

export function fmtBytes(n) {
  const v = Number(n)
  if (!Number.isFinite(v) || v <= 0) return ''
  if (v < 1024) return `${v} B`
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(0)} KB`
  if (v < 1024 * 1024 * 1024) return `${(v / 1048576).toFixed(1)} MB`
  return `${(v / 1073741824).toFixed(2)} GB`
}

/** 'imagem' | 'video' | 'audio' | 'pdf' | 'texto' | 'outro' */
export function tipoDoAnexo(a) {
  const mime = String(a?.type || a?.mimetype || '').toLowerCase()
  const ext = String(a?.name || a?.title || a?.path || '').split('.').pop().toLowerCase()
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'heic'].includes(ext)) return 'imagem'
  if (mime.startsWith('video/') || ['mp4', 'mov', 'webm', 'm4v'].includes(ext)) return 'video'
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'ogg', 'aac'].includes(ext)) return 'audio'
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (mime.startsWith('text/') || ['txt', 'md', 'csv', 'json', 'log'].includes(ext)) return 'texto'
  return 'outro'
}

/** URL para abrir/baixar: assinada (1h) quando o anexo mora no Storage. */
export async function urlDoAnexo(a, bucket) {
  if (a?.path && bucket) return (await getSignedUrl(bucket, a.path)) || a.url || null
  return a?.url || null
}

export const nomeDoAnexo = (a) => a?.name || a?.title || (a?.path ? String(a.path).split('/').pop().replace(/^\d+-/, '') : 'arquivo')
