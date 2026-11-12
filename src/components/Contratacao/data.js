// Acesso ao Supabase do módulo Contratação (tabelas e bucket só para admin).
import { supabase, getSignedUrl, deleteFile } from '../../lib/supabase'

export const BUCKET = 'contratacao'

const agora = () => new Date().toISOString()

function check({ data, error }, msg) {
  if (error) {
    console.error(`[contratacao] ${msg}:`, error.message)
    throw new Error(msg)
  }
  return data
}

export async function listarCandidatos(cargo) {
  let q = supabase
    .from('contratacao_candidatos')
    .select('*, contratacao_entrevistas(id, data, pontuacao, nivel, finalizada, resumo_ia, sugestao_ia)')
    .order('created_at', { ascending: false })
  if (cargo) q = q.eq('cargo', cargo)
  return check(await q, 'Não foi possível carregar os candidatos.') || []
}

export async function contarPorCargo() {
  const rows = check(
    await supabase.from('contratacao_candidatos').select('cargo, empregado'),
    'Não foi possível carregar os cargos.',
  ) || []
  const out = {}
  for (const r of rows) {
    out[r.cargo] ||= { total: 0, disponiveis: 0 }
    out[r.cargo].total++
    if (!r.empregado) out[r.cargo].disponiveis++
  }
  return out
}

export async function buscarCandidato(id) {
  return check(
    await supabase
      .from('contratacao_candidatos')
      .select('*, contratacao_entrevistas(*)')
      .eq('id', id)
      .single(),
    'Candidato não encontrado.',
  )
}

export async function criarCandidato(dados) {
  return check(
    await supabase.from('contratacao_candidatos').insert(dados).select().single(),
    'Não foi possível salvar o candidato.',
  )
}

export async function atualizarCandidato(id, patch) {
  return check(
    await supabase
      .from('contratacao_candidatos')
      .update({ ...patch, updated_at: agora() })
      .eq('id', id)
      .select()
      .single(),
    'Não foi possível salvar o candidato.',
  )
}

export async function excluirCandidato(c) {
  if (c.curriculo_path) await deleteFile(BUCKET, c.curriculo_path)
  check(await supabase.from('contratacao_candidatos').delete().eq('id', c.id), 'Não foi possível excluir.')
}

export async function criarEntrevista(dados) {
  return check(
    await supabase.from('contratacao_entrevistas').insert(dados).select().single(),
    'Não foi possível abrir a entrevista.',
  )
}

export async function buscarEntrevista(id) {
  return check(
    await supabase
      .from('contratacao_entrevistas')
      .select('*, contratacao_candidatos(*)')
      .eq('id', id)
      .single(),
    'Entrevista não encontrada.',
  )
}

export async function atualizarEntrevista(id, patch) {
  check(
    await supabase.from('contratacao_entrevistas').update({ ...patch, updated_at: agora() }).eq('id', id),
    'Não foi possível salvar a entrevista.',
  )
}

export async function excluirEntrevista(id) {
  check(await supabase.from('contratacao_entrevistas').delete().eq('id', id), 'Não foi possível excluir a entrevista.')
}

/** Sobe o currículo para `<candidatoId>/<timestamp>-<nome>` e grava no candidato. */
export async function enviarCurriculo(candidato, file) {
  const limpo = file.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-')
  const path = `${candidato.id}/${Date.now()}-${limpo}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
  if (error) throw new Error('Não foi possível enviar o currículo.')
  if (candidato.curriculo_path) await deleteFile(BUCKET, candidato.curriculo_path)
  return atualizarCandidato(candidato.id, { curriculo_path: path, curriculo_nome: file.name })
}

export async function abrirCurriculo(candidato) {
  if (!candidato?.curriculo_path) return
  // Abre a aba antes do await para o navegador não bloquear o pop-up.
  const aba = window.open('', '_blank')
  const url = await getSignedUrl(BUCKET, candidato.curriculo_path)
  if (url && aba) aba.location.href = url
  else if (aba) aba.close()
}

/** Última entrevista (pela data e criação) de um candidato vindo de listarCandidatos. */
export function ultimaEntrevista(c) {
  const es = [...(c.contratacao_entrevistas || [])]
  es.sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(b.created_at || '').localeCompare(String(a.created_at || '')))
  return es[0] || null
}
