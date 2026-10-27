// Gera dados FICTÍCIOS do Dashboard de Tráfego para o preview sem login
// (/dev/resultados): public/dash-teste/mock/meta.csv e google.csv, com as mesmas
// colunas de dash_insights.data. O viewer lê esses arquivos com ?mock=1.
//
// Uso: node scripts/gerar_mock_dash.mjs [dias=90]
// As datas terminam ontem, então rode de novo se o preview ficar sem dados recentes.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIAS = Number(process.argv[2]) || 90
const SAIDA = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'dash-teste', 'mock')

// Contas do cliente fictício (as mesmas que src/dev/mockResultados.js vincula)
export const CONTA_META = 'Aurora Odontologia'
export const CONTA_GOOGLE = 'Aurora Odontologia - Google'

// PRNG determinístico: o mock sai igual a cada execução
let semente = 42
const rnd = () => ((semente = (semente * 1664525 + 1013904223) % 4294967296) / 4294967296)
const varia = (v, amp = 0.25) => v * (1 + (rnd() * 2 - 1) * amp)
const inteiro = (v) => Math.max(0, Math.round(v))

const brl = (v) => `R$ ${v.toFixed(2).replace('.', ',')}`
const dec = (v) => v.toFixed(2).replace('.', ',')
const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const hoje = new Date()
const dias = Array.from({ length: DIAS }, (_, i) => {
  const d = new Date(hoje); d.setDate(d.getDate() - (DIAS - i)); return d
})

function csv(linhas) {
  const cols = Object.keys(linhas[0])
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [cols.map(q).join(','), ...linhas.map((l) => cols.map((c) => q(l[c])).join(','))].join('\n') + '\n'
}

// ─── Meta ────────────────────────────────────────────────────────────────────
// verba = R$/dia da campanha; tipo define a conversão que ela gera
const CAMPANHAS_META = [
  { nome: '[FUNDO] Conversas WhatsApp | Implante', tipo: 'whats', verba: 90, objetivo: 'OUTCOME_ENGAGEMENT', resultado: 'Conversas por mensagem iniciadas', destino: 'WHATSAPP',
    conjuntos: ['Raio 8km | 30-60', 'Lookalike 1% pacientes'], anuncios: ['01 Antes e depois', '02 Depoimento Dra. Lia', '03 Oferta avaliação'] },
  { nome: '[MEIO] Leads Formulário | Lentes', tipo: 'lead', verba: 55, objetivo: 'OUTCOME_LEADS', resultado: 'Leads no site', destino: 'WEBSITE',
    conjuntos: ['Interesses estética', 'Remarketing site 30d'], anuncios: ['01 Carrossel sorrisos', '02 Vídeo procedimento'] },
  { nome: '[TOPO] Vídeo Alcance | Marca', tipo: 'video', verba: 30, objetivo: 'OUTCOME_AWARENESS', resultado: 'ThruPlays', destino: 'ON_VIDEO',
    conjuntos: ['Aberto Goiânia'], anuncios: ['01 Tour clínica', '02 Dica de higiene'] },
]

const meta = []
let adSeq = 1000
for (const c of CAMPANHAS_META) {
  const campaignId = String(23850000000 + adSeq++)
  for (const conj of c.conjuntos) {
    const adsetId = String(23851000000 + adSeq++)
    c.anuncios.forEach((anuncio, ai) => {
      const adId = String(23852000000 + adSeq++)
      // pesos diferentes por anúncio: sempre há um vencedor e um fraco
      const peso = [1.5, 1, 0.55][ai] ?? 0.8
      const qualidade = [1.25, 1, 0.6][ai] ?? 0.9
      // o último anúncio do fundo foi pausado há 12 dias
      const pausaEm = c.tipo === 'whats' && ai === 2 ? DIAS - 12 : Infinity
      dias.forEach((d, di) => {
        const ativo = di < pausaEm
        const tendencia = 0.8 + (di / DIAS) * 0.45 // a conta cresce no período
        const fds = [0, 6].includes(d.getDay()) ? 0.75 : 1
        const gasto = ativo ? varia((c.verba / (c.conjuntos.length * c.anuncios.length)) * peso * tendencia * fds * 1.6, 0.3) : 0
        const cpm = varia(c.tipo === 'video' ? 14 : 32, 0.2)
        const impr = inteiro((gasto / cpm) * 1000)
        const ctr = varia(c.tipo === 'video' ? 0.45 : 1.15, 0.3) * qualidade / 100
        const cliquesLink = inteiro(impr * ctr)
        const cliques = inteiro(cliquesLink * varia(1.6, 0.15))
        const conversas = c.tipo === 'whats' ? inteiro(cliquesLink * varia(0.32, 0.35) * qualidade) : 0
        const leads = c.tipo === 'lead' ? inteiro(cliquesLink * varia(0.14, 0.4) * qualidade) : 0
        const mql = c.tipo === 'lead' ? inteiro(leads * varia(0.45, 0.4)) : 0
        const vendas = c.tipo === 'whats' && rnd() < 0.06 * qualidade ? 1 : 0
        const plays = c.tipo === 'video' ? inteiro(impr * 0.62) : 0
        const p3 = inteiro(plays * varia(0.34, 0.2))
        const conv = conversas + leads + vendas
        meta.push({
          'Dia': iso(d), 'Nome da conta': CONTA_META, 'Nome da campanha': c.nome, 'Conjunto de Anúncio': conj, 'Nome do Anúncio': anuncio,
          'account_id': '1234567890123', 'campaign_id': campaignId, 'adset_id': adsetId, 'ad_id': adId,
          'Status da Campanha': 'ACTIVE', 'Status do Conjunto de Anúncio': 'ACTIVE', 'Status do Aúncio': ativo ? 'ACTIVE' : 'PAUSED',
          'Objetivo de Campanha': c.objetivo, 'Tipo de resultado': c.resultado, 'Destino do conjunto de anúncio': c.destino,
          'Valor investido': brl(gasto), 'Impressões': impr, 'Frequência': dec(impr ? varia(1.35, 0.2) : 0), 'CPM': brl(impr ? cpm : 0),
          'Cliques': cliques, 'Número de cliques no link': cliquesLink, 'Ctr link': impr ? dec((cliquesLink / impr) * 100) : '',
          'Visualizações da página de destino': c.tipo === 'lead' ? inteiro(cliquesLink * 0.8) : 0,
          'Número de conversas iniciadas no Whatsapp': conversas, 'Custo por conversa iniciadas no Whatsapp': conversas ? brl(gasto / conversas) : '',
          'Leads': leads, 'Custo por lead': leads ? brl(gasto / leads) : '', 'MQL': mql,
          'Número de vendas': vendas, 'Custo por venda': vendas ? brl(gasto / vendas) : '', 'ROAS de vendas': vendas ? dec((vendas * 4800) / gasto) : '',
          'Conversões': conv, 'Resultados': c.tipo === 'video' ? inteiro(plays * 0.12) : conv,
          'Adições ao carrinho': 0, 'Finalizações de compra iniciadas': 0, 'Compartilhamentos': inteiro(rnd() * 2), 'Seguidores': c.tipo === 'video' ? inteiro(rnd() * 4) : 0,
          'Visitas ao perfil': inteiro(cliques * 0.08),
          'Número de vezes que o vídeo foi exibido': plays || '', 'Número de vezes que assistiram os 3 primeiros segundos': p3,
          'Número de vezes que assistiram 25% do vídeo': plays ? inteiro(p3 * 0.55) : '', 'Número de vezes que assistiram 50% do vídeo': plays ? inteiro(p3 * 0.33) : '',
          'Número de vezes que assistiram 75% do vídeo': plays ? inteiro(p3 * 0.2) : '', 'Número de vezes que assistiram 95% do vídeo': plays ? inteiro(p3 * 0.12) : '',
          'Número de vezes que assistiram 100% do vídeo': plays ? inteiro(p3 * 0.1) : '', 'Tempo médio do vídeo em segundos': plays ? inteiro(varia(9, 0.3)) : '',
          'Link do anúncio': '',
        })
      })
    })
  }
}

// ─── Google ──────────────────────────────────────────────────────────────────
const CAMPANHAS_GOOGLE = [
  { nome: 'Pesquisa | Implante dentário', verba: 70, cpc: 3.4, taxa: 0.11 },
  { nome: 'Pesquisa | Lentes de contato dental', verba: 45, cpc: 2.6, taxa: 0.08 },
  { nome: 'Pesquisa | Marca', verba: 12, cpc: 0.9, taxa: 0.22 },
]
const google = []
CAMPANHAS_GOOGLE.forEach((c, ci) => {
  dias.forEach((d, di) => {
    const tendencia = 0.85 + (di / DIAS) * 0.3
    const gasto = varia(c.verba * tendencia, 0.25)
    const cpc = varia(c.cpc, 0.2)
    const cliques = inteiro(gasto / cpc)
    const impr = inteiro(cliques / varia(0.065, 0.3))
    const conv = Math.round(cliques * varia(c.taxa, 0.5) * 100) / 100
    google.push({
      'Data': iso(d), 'Nome da conta': CONTA_GOOGLE, 'Campanha': c.nome, 'Grupo de palavras': '', 'Fonte de dados': 'google_ads',
      'customer_id': '1234567890', 'campaign_id': String(20000000000 + ci),
      'Gasto': brl(gasto), 'Impressões': impr, 'CLiques': cliques, 'CTR': impr ? `${dec((cliques / impr) * 100)}%` : '', 'cpc': brl(cpc),
      'Conversões': dec(conv), 'Custo por conversão': conv ? brl(gasto / conv) : '', 'Taxa de conversão': cliques ? `${dec((conv / cliques) * 100)}%` : '',
      'Impressões elegíveis': inteiro(impr * 1.4), 'Impressões na parte superior': `${dec(varia(62, 0.2))}%`,
      '% de perda por orçamento': `${dec(ci === 0 ? varia(28, 0.3) : varia(6, 0.5))}%`, '% de perda por classificação': `${dec(varia(18, 0.4))}%`,
      'Perda de impressão na parte superior ': `${dec(varia(22, 0.3))}%`,
    })
  })
})

mkdirSync(SAIDA, { recursive: true })
writeFileSync(join(SAIDA, 'meta.csv'), csv(meta))
writeFileSync(join(SAIDA, 'google.csv'), csv(google))
console.log(`mock: ${meta.length} linhas Meta, ${google.length} Google (${iso(dias[0])} a ${iso(dias.at(-1))}) em ${SAIDA}`)
