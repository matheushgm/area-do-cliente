// Módulo Contratação: cargos, roteiro de entrevista com pesos e régua de nível.
//
// Cada pergunta tem uma régua de 0 a 3 escrita a partir do playbook do cargo:
//   0 = não demonstrou · 1 = resposta de Júnior · 2 = de Pleno · 3 = de Sênior.
// A pontuação (0 a 100) é a média ponderada das notas. O nível sai da
// pontuação + "portões": para ser Sênior não basta média alta, precisa ter
// nota de Sênior nas competências que o playbook só pede do Sênior.
//
// Novo cargo = nova entrada em CARGOS (mesmo formato). Cargo com `ativo: false`
// aparece como "em breve".

export const NOTAS = [
  { valor: 0, rotulo: 'Não demonstrou', curto: '0', cor: 'red' },
  { valor: 1, rotulo: 'Júnior', curto: 'Jr', cor: 'gold' },
  { valor: 2, rotulo: 'Pleno', curto: 'Pl', cor: 'cyan' },
  { valor: 3, rotulo: 'Sênior', curto: 'Sr', cor: 'green' },
]

export const STATUS_CANDIDATO = [
  { id: 'entrevistado', rotulo: 'Entrevistado', cor: 'muted' },
  { id: 'em_espera', rotulo: 'Em espera', cor: 'gold' },
  { id: 'aprovado', rotulo: 'Aprovado', cor: 'cyan' },
  { id: 'contratado', rotulo: 'Contratado', cor: 'green' },
  { id: 'reprovado', rotulo: 'Reprovado', cor: 'red' },
]

const GESTOR_TRAFEGO = {
  id: 'gestor-trafego',
  nome: 'Gestor de Tráfego',
  descricao: 'Meta Ads + Google Ads, funil completo até a venda.',
  ativo: true,
  // Do playbook "Gestor de tráfego" (cargos e salários).
  niveis: [
    { id: 'junior', nome: 'Júnior', salario: 2000, carteira: 24000, clientes: 8,
      resumo: 'Sobe criativo, pausa o que passa do CPL alvo, negativa termos, testa público. Reporta ao account e não decide sozinho o que mexe na conta.' },
    { id: 'pleno', nome: 'Pleno', salario: 3000, carteira: 33000, clientes: 11,
      resumo: 'Gerencia Meta + Google ao mesmo tempo, analisa a jornada anúncio → LP → lead → comercial, faz testes estruturados, revisa páginas, relatório com embasamento. Toma decisões de otimização sozinho.' },
    { id: 'senior', nome: 'Sênior', salario: 4000, carteira: 43000, clientes: 14,
      resumo: 'Tudo do Pleno + domínio de CRM, calculadora de ROI e metas semanais, planilha de orçamento, testes A/B com relatório, acompanhamento de vendas. Decide sozinho, treina os juniores e cria playbook.',
      extra: '5% de comissão sobre a carteira acima de R$ 43 mil' },
  ],
  competencias: [
    { id: 'midia', nome: 'Operação de mídia', selo: 'Mão na massa' },
    { id: 'funil', nome: 'Funil e análise', selo: 'Olho no funil' },
    { id: 'testes', nome: 'Testes', selo: 'Cientista' },
    { id: 'relatorio', nome: 'Relatório', selo: 'Relatório que convence' },
    { id: 'dados', nome: 'CRM, ROI e planejamento', selo: 'Dono dos números' },
    { id: 'autonomia', nome: 'Autonomia', selo: 'Voa sozinho' },
  ],
  // Bloco de aquecimento: não pontua, vira contexto do perfil e da IA.
  aquecimento: [
    { id: 'vida_hoje', pergunta: 'Como tá sua vida hoje em relação ao trabalho, clientes...',
      observar: 'Está empregado? Quantos clientes cuida hoje? Por que quer sair?' },
    { id: 'carreira', pergunta: 'Me conta aí da sua carreira como um todo.',
      observar: 'Tempo de mercado, agência ou empresa, tamanho das contas que pegou.' },
    { id: 'exp_trafego', pergunta: 'E em relação à sua experiência com tráfego pago, como foi?',
      observar: 'Canais, nichos, verba gerida, se já teve meta de lead/venda.' },
  ],
  camposContexto: [
    { id: 'clientes_hoje', rotulo: 'Clientes que cuida hoje', tipo: 'numero' },
    { id: 'verba_mensal', rotulo: 'Verba de mídia somada (R$/mês)', tipo: 'moeda' },
    { id: 'disponibilidade', rotulo: 'Disponibilidade', tipo: 'opcoes',
      opcoes: ['Imediata', 'Aviso de 15 dias', 'Aviso de 30 dias', 'A combinar'] },
    { id: 'modelo_atual', rotulo: 'Modelo atual', tipo: 'opcoes',
      opcoes: ['CLT', 'PJ', 'Freelancer', 'Sem trabalho'] },
  ],
  sinaisAlerta: [
    { id: 'sem_conta_real', rotulo: 'Não mostrou nenhuma conta real' },
    { id: 'so_metrica_plataforma', rotulo: 'Só fala de CTR/CPM, nunca de lead ou venda' },
    { id: 'generico', rotulo: 'Respostas genéricas, sem número nem caso' },
    { id: 'culpa_cliente', rotulo: 'Põe a culpa sempre no cliente ou no comercial' },
  ],
  perguntas: [
    {
      id: 'multicanal', competencia: 'midia', peso: 3,
      atividade: 'Gerenciar contas multicanal (Google + Meta)',
      pergunta: 'Posso ver uma conta sua de Meta e Google e como você gerenciava ela?',
      observar: 'Abriu a conta de verdade? Mostrou os dois canais? Explica por que cada campanha existe?',
      regua: [
        'Não mostrou conta ou só falou em teoria.',
        'Mostra uma conta (geralmente só Meta). Sabe subir criativo, pausar o que passa do CPL alvo e negativar termos no Google.',
        'Mostra Meta e Google, explica a estrutura de cada canal e o papel de cada campanha, com meta de CPL por conta.',
        'Além disso, liga as contas ao resultado do cliente (verba, metas semanais, vendas) e conta decisões que tomou sozinho e o efeito delas.',
      ],
    },
    {
      id: 'jornada', competencia: 'funil', peso: 3,
      atividade: 'Analisar jornada completa de conversão: anúncio → landing page → lead',
      pergunta: 'Você consegue me mostrar como avaliava na prática os resultados das campanhas dos seus clientes?',
      observar: 'Para no CTR/CPL ou vai até lead qualificado e venda?',
      regua: [
        'Só métricas da plataforma, sem saber dizer se a campanha deu resultado para o cliente.',
        'Olha CPL e volume de leads contra o alvo.',
        'Analisa a jornada anúncio → LP → lead → contato do comercial e sabe onde o funil quebra (do CPM ao ROI).',
        'Mede até a venda e o ROI, e cruza traqueamento x banco de dados x CRM para conferir se os números batem.',
      ],
    },
    {
      id: 'otimizacao', competencia: 'midia', peso: 3,
      atividade: 'Subir criativos e otimizar no Meta Ads e no Google Ads',
      pergunta: 'Como você otimizava anúncio, conjunto e criativo?',
      observar: 'Tem critério (janela de dias, verba mínima, meta) ou mexe no feeling?',
      regua: [
        'Resposta genérica ("deixo a IA rodar", "troco o público").',
        'Pausa criativo, conjunto ou campanha com custo por lead acima do alvo e testa público.',
        'Otimiza nos três níveis e nos dois canais com base em resultado e meta: sabe quando escalar e quando trocar criativo (frequência alta, CTR caindo).',
        'Tem critério próprio claro (dias e verba antes de julgar), lembra de casos com número e já ensinou isso a alguém.',
      ],
    },
    {
      id: 'testes', competencia: 'testes', peso: 2,
      atividade: 'Executar testes estruturados de criativo, público e landing page',
      pergunta: 'Quando você via na prática que era o momento de testar algo novo?',
      observar: 'Testa com hipótese e uma variável por vez? Olha concorrente na biblioteca de anúncios?',
      regua: [
        'Testa quando dá vontade ou nunca testou de forma organizada.',
        'Testa público e criativo quando o CPL sobe; olha concorrentes na biblioteca de anúncios.',
        'Testes estruturados de criativo, público e LP com hipótese, uma variável por vez e decisão por dado.',
        'Testes entram no planejamento do mês, o aprendizado é registrado e vira padrão (playbook).',
      ],
    },
    {
      id: 'alem_anuncio', competencia: 'funil', peso: 3,
      atividade: 'Revisar e sugerir ajustes em páginas de destino',
      pergunta: 'Como você faz quando vê que o problema não é o anúncio?',
      observar: 'Sabe olhar página, time comercial e todas as etapas do funil?',
      regua: [
        'Continua mexendo só no anúncio.',
        'Percebe que o problema está fora do anúncio, mas passa para o account ou o estrategista resolver.',
        'Revisa e sugere ajuste na página (promessa, formulário, velocidade) e aponta problema no atendimento do comercial com dado na mão.',
        'Diagnostica a etapa que quebrou (página, tempo de resposta do comercial, qualificação no CRM, venda) e conduz o plano com o cliente.',
      ],
    },
    {
      id: 'relatorios', competencia: 'relatorio', peso: 2,
      atividade: 'Preencher relatórios com clareza e embasamento estratégico',
      pergunta: 'Como são os relatórios que você prepara para os clientes?',
      observar: 'É print do gerenciador ou explica o que aconteceu, por quê e o próximo passo?',
      regua: [
        'Não faz relatório ou é print do gerenciador.',
        'Reporta os dados com clareza para o account.',
        'Relatório com embasamento: o que aconteceu, por que aconteceu e o que vai fazer agora.',
        'Relatório ligado às metas de negócio, usado para conduzir a reunião; documenta boas práticas do cliente.',
      ],
    },
    {
      id: 'crm', competencia: 'dados', peso: 2, portaoSenior: true,
      atividade: 'Domínio de CRM',
      pergunta: 'Já cuidou de algum cliente em que você tinha que olhar CRM?',
      observar: 'Usa o CRM para otimizar a campanha ou só sabe que existe?',
      regua: [
        'Nunca olhou CRM de cliente.',
        'Já viu os leads no CRM do cliente, sem usar isso na otimização.',
        'Usa o CRM para ver qualidade e status dos leads e devolve isso para a campanha.',
        'Domina o CRM: acompanha vendas, cruza com UTM e traqueamento e otimiza por lead qualificado e venda.',
      ],
    },
    {
      id: 'planejamento', competencia: 'dados', peso: 2, portaoSenior: true,
      atividade: 'Planilha de projeção de ROI e acompanhamento das metas semanais',
      pergunta: 'Como você fazia os planejamentos para o mês seguinte?',
      observar: 'Parte da meta de vendas para chegar em leads e verba? Acompanha por semana?',
      regua: [
        'Não planeja, repete o mês anterior.',
        'Define verba por campanha com ajuda de alguém.',
        'Sabe usar a calculadora de ROI e preencher a planilha de orçamento a partir da meta.',
        'Monta a projeção (meta de vendas → leads → verba) e acompanha as metas semanais, corrigindo a rota no meio do mês.',
      ],
    },
    {
      id: 'ab', competencia: 'testes', peso: 2, portaoSenior: true,
      atividade: 'Criação de testes A/B nas páginas de captura',
      pergunta: 'Como funciona a parte de teste A/B?',
      observar: 'Já rodou um de verdade? Sabe quando o resultado é confiável?',
      regua: [
        'Não sabe explicar.',
        'Conhece o conceito, mas nunca rodou um.',
        'Já pediu ou rodou teste A/B de página com uma variável e sabe ler o resultado.',
        'Roda A/B com volume suficiente, faz relatório do teste e transforma a versão vencedora em padrão.',
      ],
    },
    {
      id: 'autonomia', competencia: 'autonomia', peso: 2, sugerida: true,
      atividade: 'Liderança e autonomia (do playbook)',
      pergunta: 'Me conta uma decisão importante que você tomou sozinho numa conta. E alguma vez você ensinou alguém do time?',
      observar: 'O playbook separa os níveis muito por autonomia: Júnior pede, Pleno otimiza sozinho, Sênior decide e treina.',
      regua: [
        'Não toma decisão sem pedir.',
        'Executa e reporta; o que mexe na conta passa por alguém antes.',
        'Toma as decisões de otimização sozinho e reporta depois; ajuda a melhorar processos.',
        'Decide sozinho, treina gente menos experiente e já criou playbook, curso ou conteúdo.',
      ],
    },
  ],
  // Régua de nível: pontuação mínima + portões.
  regua: {
    junior: 25,
    pleno: 55,
    senior: 75,
    portaoPleno: ['multicanal', 'jornada'], // as duas com nota ≥ 2
    portaoSeniorMinimo: 2, // nota 3 em pelo menos 2 das perguntas com portaoSenior
  },
}

export const CARGOS = [GESTOR_TRAFEGO]

export const cargoPorId = (id) => CARGOS.find((c) => c.id === id) || null

const notaValida = (n) => typeof n === 'number' && n >= 0 && n <= 3

/**
 * Calcula pontuação, nível e detalhamento de uma entrevista.
 * Pergunta sem nota (não perguntada) fica fora da média.
 */
export function calcularResultado(cargo, respostas = {}) {
  const perguntas = cargo.perguntas
  let soma = 0
  let pesoTotal = 0
  let respondidas = 0
  for (const p of perguntas) {
    const n = respostas[p.id]?.nota
    if (!notaValida(n)) continue
    soma += (n / 3) * p.peso
    pesoTotal += p.peso
    respondidas++
  }
  const pontuacao = pesoTotal ? Math.round((soma / pesoTotal) * 100) : 0

  const porCompetencia = cargo.competencias.map((c) => {
    const ps = perguntas.filter((p) => p.competencia === c.id)
    const notas = ps.map((p) => respostas[p.id]?.nota).filter(notaValida)
    const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null
    return {
      ...c,
      seloNome: c.selo,
      media,
      respondidas: notas.length,
      total: ps.length,
      // selo ganho com média de Pleno; dourado com média de Sênior
      selo: media == null ? null : media >= 2.75 ? 'ouro' : media >= 2 ? 'prata' : null,
    }
  })

  const r = cargo.regua
  const nota = (id) => respostas[id]?.nota
  const passouPleno = r.portaoPleno.every((id) => (nota(id) ?? -1) >= 2)
  const portoesSenior = perguntas.filter((p) => p.portaoSenior)
  const notasSenior = portoesSenior.filter((p) => nota(p.id) === 3).length
  const passouSenior = notasSenior >= r.portaoSeniorMinimo

  let nivel = 'abaixo'
  const faltou = []
  if (pontuacao >= r.senior && passouSenior && passouPleno) nivel = 'senior'
  else if (pontuacao >= r.pleno && passouPleno) nivel = 'pleno'
  else if (pontuacao >= r.junior) nivel = 'junior'

  // O que faltou para o próximo degrau (mostrado no resultado).
  if (nivel === 'abaixo') {
    faltou.push(`Chegar a ${r.junior} pontos (hoje ${pontuacao}).`)
  }
  if (nivel === 'junior') {
    if (pontuacao < r.pleno) faltou.push(`Chegar a ${r.pleno} pontos (hoje ${pontuacao}).`)
    for (const id of r.portaoPleno) {
      if ((nota(id) ?? -1) < 2) {
        const p = perguntas.find((x) => x.id === id)
        faltou.push(`Resposta de Pleno em "${p.atividade}".`)
      }
    }
  }
  if (nivel === 'pleno') {
    if (pontuacao < r.senior) faltou.push(`Chegar a ${r.senior} pontos (hoje ${pontuacao}).`)
    if (!passouSenior) {
      const faltam = portoesSenior.filter((p) => nota(p.id) !== 3).map((p) => p.atividade)
      faltou.push(`Nota de Sênior em ${r.portaoSeniorMinimo} destes itens (tem ${notasSenior}): ${faltam.join('; ')}.`)
    }
  }

  return {
    pontuacao,
    nivel,
    respondidas,
    total: perguntas.length,
    porCompetencia,
    faltou,
    portoes: { pleno: passouPleno, senior: passouSenior, notasSenior },
  }
}

export const NIVEL_ROTULO = {
  abaixo: 'Abaixo de Júnior',
  junior: 'Júnior',
  pleno: 'Pleno',
  senior: 'Sênior',
}

export const NIVEL_COR = {
  abaixo: 'red',
  junior: 'gold',
  pleno: 'cyan',
  senior: 'green',
}

export const fmtBRL = (n) =>
  n == null || n === '' || Number.isNaN(Number(n))
    ? '-'
    : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

// ─── Resumo da entrevista pela IA ──────────────────────────────────────────

export const MODELO_RESUMO = 'claude-opus-5-5'

export function promptResumo({ cargo, candidato, entrevista }) {
  const niveis = cargo.niveis
    .map((n) => `- ${n.nome} (salário ${fmtBRL(n.salario)}, média de ${n.clientes} clientes): ${n.resumo}`)
    .join('\n')

  const roteiro = cargo.perguntas
    .map((p) => {
      const resp = entrevista.respostas?.[p.id] || {}
      const nota = notaValida(resp.nota) ? `${resp.nota} (${NOTAS[resp.nota].rotulo})` : 'sem nota'
      return [
        `### ${p.id}: ${p.atividade} (peso ${p.peso})`,
        `Pergunta: ${p.pergunta}`,
        `Régua: 0 = ${p.regua[0]} | 1 = ${p.regua[1]} | 2 = ${p.regua[2]} | 3 = ${p.regua[3]}`,
        `Nota do entrevistador: ${nota}`,
        resp.obs ? `Anotação do entrevistador: ${resp.obs}` : null,
      ].filter(Boolean).join('\n')
    })
    .join('\n\n')

  const ctx = entrevista.contexto || {}
  const aquec = cargo.aquecimento
    .map((a) => `- ${a.pergunta} → ${ctx[a.id] || '(sem anotação)'}`)
    .join('\n')
  const campos = cargo.camposContexto
    .map((c) => `- ${c.rotulo}: ${ctx[c.id] ?? '-'}`)
    .join('\n')
  const alertas = cargo.sinaisAlerta.filter((s) => ctx.alertas?.[s.id]).map((s) => `- ${s.rotulo}`).join('\n')

  const system = `Você ajuda a Revenue Lab (agência de tráfego pago) a avaliar candidatos ao cargo de ${cargo.nome}.

Níveis do cargo segundo o playbook interno:
${niveis}

Seu trabalho: ler a transcrição da entrevista e escrever um resumo que vai ficar no perfil do candidato no banco de talentos.

Regras:
- Português do Brasil, direto, sem enrolação. Não use travessão (— ou –); use vírgula, dois-pontos ou ponto.
- Use só o que está na transcrição e nas anotações. Não invente número, empresa ou caso. Se algo não apareceu, diga que não apareceu.
- Cite trechos curtos da fala do candidato quando forem a prova de uma nota.
- Seja justo: aponte pontos fortes e pontos de atenção com o mesmo cuidado.

Formato da resposta (markdown):
## Resumo
Um parágrafo de quem é a pessoa, momento atual e experiência.
## Pontos fortes
## Pontos de atenção
## Leitura por atividade
Para cada atividade do roteiro: nota que você daria (0 a 3) e a evidência. Se discordar da nota do entrevistador, diga por quê.
## Nível sugerido
Júnior, Pleno ou Sênior (ou abaixo de Júnior), com a justificativa e o que faltou para o nível seguinte.
## Perguntas para um próximo papo
Até 4 perguntas para tirar as dúvidas que ficaram.

No fim, depois do markdown, um bloco de código \`\`\`json com exatamente este formato:
{"notas": {"<id da atividade>": 0}, "nivel": "junior|pleno|senior|abaixo", "frase": "uma frase que resume o candidato"}
Use os ids do roteiro. Atividade que não apareceu na conversa fica com null.`

  const user = `Candidato: ${candidato.nome}${candidato.cidade ? ` (${candidato.cidade})` : ''}
Pretensão salarial: ${fmtBRL(candidato.pretensao_salarial)}

## Aquecimento (anotações)
${aquec}

## Contexto
${campos}
${alertas ? `\nSinais de alerta marcados pelo entrevistador:\n${alertas}` : ''}

## Roteiro com as notas do entrevistador
${roteiro}

## Transcrição da entrevista
${entrevista.transcricao || '(sem transcrição)'}`

  return { system, messages: [{ role: 'user', content: user }] }
}

/** Separa o markdown do bloco ```json final (durante o streaming o bloco pode estar incompleto). */
export function separarResumo(texto) {
  const s = String(texto || '').replace(/[—–]/g, ',')
  const i = s.lastIndexOf('```json')
  if (i === -1) return { markdown: s.trim(), sugestao: null }
  const markdown = s.slice(0, i).trim()
  const bruto = s.slice(i + 7).replace(/```\s*$/, '').trim()
  let sugestao = null
  try { sugestao = JSON.parse(bruto) } catch { /* bloco ainda chegando */ }
  return { markdown, sugestao }
}
