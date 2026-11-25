// Harness DEV (só import.meta.env.DEV): a tela de Testes A/B com um banco em
// memória, sem login. Reproduz só o pedaço do cliente do Supabase que
// src/lib/testesAB.js usa (select com embed das variantes, eq, in, order,
// maybeSingle/single, insert, update, delete) e a view ab_resumo_variantes.
import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import TestesAB, { AmbienteAB } from './TestesAB'

const agora = () => new Date().toISOString()
const uid = () => crypto.randomUUID()

function semente() {
  const ex = (o) => ({ descricao: null, project_id: null, vencedor_id: null, iniciado_em: null, encerrado_em: null, created_by: null, created_at: agora(), updated_at: agora(), conversao: 'todas', tipo: 'texto', ...o })
  const va = (o) => ({ hipotese: null, conteudo: {}, url: null, arquivada: false, created_at: agora(), updated_at: agora(), ...o })
  const ab_experimentos = [
    ex({ id: 'e1', slug: 'demo1', nome: 'Headline da captura de médicos', descricao: 'Dor do plantão x agenda particular', url: 'https://mkt.somosverta.com.br/captura-medicos', status: 'rodando', iniciado_em: agora() }),
    ex({ id: 'e2', slug: 'demo2', nome: 'CTA do webinar', url: 'https://lp.revenuelab.com.br/webinar-reunioes-qualificadas', status: 'rascunho', conversao: 'clique' }),
    ex({ id: 'e3', slug: 'demo3', nome: 'LP longa x curta', tipo: 'pagina', url: 'https://exemplo.com/lp', status: 'encerrado', vencedor_id: 'v32', encerrado_em: agora() }),
  ]
  const ab_variantes = [
    va({ id: 'v11', experimento_id: 'e1', nome: 'Original', original: true, peso: 34, ordem: 0 }),
    va({ id: 'v12', experimento_id: 'e1', nome: 'B, dor do plantão', hipotese: 'Médico cansado de plantão se reconhece na primeira linha', peso: 33, ordem: 1, conteudo: { headline: 'Saia do plantão sem perder renda', cta: 'Quero minha agenda particular' } }),
    va({ id: 'v13', experimento_id: 'e1', nome: 'C, número', hipotese: 'Número concreto dá prova', peso: 33, ordem: 2, conteudo: { headline: '**30 pacientes particulares** por mês em 90 dias' } }),
    va({ id: 'v21', experimento_id: 'e2', nome: 'Original', original: true, peso: 100, ordem: 0 }),
    va({ id: 'v31', experimento_id: 'e3', nome: 'Original', original: true, peso: 0, ordem: 0 }),
    va({ id: 'v32', experimento_id: 'e3', nome: 'Curta', peso: 100, ordem: 1, url: 'https://exemplo.com/lp-curta' }),
  ]
  const resumo = {
    v11: [1240, 418, 38, 30, 8], v12: [1198, 405, 61, 52, 9], v13: [1215, 411, 41, 35, 6],
    v31: [2100, 900, 54, 54, 0], v32: [2080, 890, 81, 81, 0],
  }
  return { ab_experimentos, ab_variantes, resumo }
}

function criarBanco() {
  const db = semente()
  const tabela = (nome) => {
    if (nome === 'ab_resumo_variantes') {
      return db.ab_variantes.map((v) => {
        const [impressoes, visitas, conversoes, lead, clique] = db.resumo[v.id] || [0, 0, 0, 0, 0]
        return { variante_id: v.id, experimento_id: v.experimento_id, impressoes, visitas, conversoes, conversoes_lead: lead, conversoes_clique: clique }
      })
    }
    return db[nome]
  }

  function from(nome) {
    const filtros = []
    let op = 'select'
    let valores = null
    let embed = false
    let modo = 'lista'
    const q = {
      select(cols) { if (op === 'select') embed = String(cols || '').includes('ab_variantes'); else modo = modo === 'lista' ? 'retorno' : modo; return q },
      order() { return q },
      eq(c, v) { filtros.push((r) => r[c] === v); return q },
      in(c, vs) { filtros.push((r) => vs.includes(r[c])); return q },
      maybeSingle() { modo = 'talvez'; return q },
      single() { modo = 'um'; return q },
      insert(v) { op = 'insert'; valores = v; return q },
      update(v) { op = 'update'; valores = v; return q },
      delete() { op = 'delete'; return q },
      then(ok, falha) { return Promise.resolve().then(executar).then(ok, falha) },
    }
    function executar() {
      const rows = tabela(nome)
      const passa = (r) => filtros.every((f) => f(r))
      if (op === 'insert') {
        const novos = (Array.isArray(valores) ? valores : [valores]).map((v) => ({
          id: uid(), created_at: agora(), updated_at: agora(),
          ...(nome === 'ab_variantes' ? { original: false, peso: 0, ordem: 0, conteudo: {}, arquivada: false } : { status: 'rascunho', tipo: 'texto', conversao: 'todas' }),
          ...v,
        }))
        rows.push(...novos)
        return { data: modo === 'um' ? novos[0] : novos, error: null }
      }
      if (op === 'update') {
        rows.filter(passa).forEach((r) => Object.assign(r, valores, { updated_at: agora() }))
        return { data: null, error: null }
      }
      if (op === 'delete') {
        const fora = new Set(rows.filter(passa).map((r) => r.id))
        db[nome] = rows.filter((r) => !fora.has(r.id))
        if (nome === 'ab_experimentos') db.ab_variantes = db.ab_variantes.filter((v) => !fora.has(v.experimento_id))
        return { data: null, error: null }
      }
      let out = rows.filter(passa).map((r) => ({ ...r }))
      if (embed) out = out.map((r) => ({ ...r, ab_variantes: db.ab_variantes.filter((v) => v.experimento_id === r.id).map((v) => ({ ...v })) }))
      if (modo === 'talvez') return { data: out[0] || null, error: null }
      if (modo === 'um') return { data: out[0], error: out[0] ? null : { message: 'não encontrado' } }
      return { data: out, error: null }
    }
    return q
  }
  return { from }
}

export default function DevTestesAB() {
  useParams()
  const banco = useMemo(() => criarBanco(), [])
  return (
    <AmbienteAB.Provider value={{ banco, base: '/dev/testes-ab' }}>
      <div className="min-h-screen bg-rl-bg flex">
        <TestesAB />
      </div>
    </AmbienteAB.Provider>
  )
}
