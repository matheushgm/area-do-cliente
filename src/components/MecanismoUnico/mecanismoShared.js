// ─────────────────────────────────────────────────────────────────────────────
// Camada compartilhada do Mecanismo Único (playbook XPN Digital).
// Schema, hidratação, metadados dos passos do wizard e o montador do pitch.
// Sem React — importado pelo módulo interno, pelo wizard e pela página pública.
// ─────────────────────────────────────────────────────────────────────────────

// Estado vazio inicial — usado quando project.mecanismoUnico ainda não existe.
export function newMecanismo() {
  return {
    // Seção 1 — pesquisa de mercado
    concorrentes: [],
    padroesMercado: [],
    promessasComuns: [],
    // Seção 2 — mapeamento do cliente
    tentativas: [],
    justificativas: [],
    quase: { conseguiu: '', faltou: '' },
    // Seção 3 — mecanismo do problema
    viloes: [],
    vilaoPrincipal: '',
    vilaoJustificativa: '',
    conexao: { vilao: '', problema: '', fracasso: '' },
    provas: [],
    provaTexto: '',
    // Seção 4 — mecanismo da solução
    diferentes: [],
    formatoNome: '',
    nomeMecanismo: '',
    tecnicas: {},  // { [techId]: 'texto preenchido' }
    // Seção 5 — montagem final
    euAjudo: '',
    aConseguir: '',
    atravesDo: '',
    porqueFalhou: { problema: '', razao: '', prova: '' },
    porqueFunciona: { explicacao: '', diferente: '', voce: '' },
    promessaPrazo: '',
    promessaResultado: '',
    // Seção 6 — validação
    validacao: {},          // { [criterioId]: 'sim' | 'nao' }
    testeAmigo: '',
    // IA
    aiAnalysis: null,        // pitch refinado
    positioningAI: null,     // posicionamento + ângulos alternativos
    updatedAt: null,
  }
}

// Mescla o mecanismo salvo com os defaults (evita undefined em registros antigos)
export function hydrateMecanismo(saved) {
  const base = newMecanismo()
  if (!saved) return base
  return {
    ...base,
    ...saved,
    quase:          { ...base.quase, ...(saved.quase || {}) },
    conexao:        { ...base.conexao, ...(saved.conexao || {}) },
    porqueFalhou:   { ...base.porqueFalhou, ...(saved.porqueFalhou || {}) },
    porqueFunciona: { ...base.porqueFunciona, ...(saved.porqueFunciona || {}) },
    tecnicas:       { ...(saved.tecnicas || {}) },
    validacao:      { ...(saved.validacao || {}) },
    concorrentes:    saved.concorrentes    || [],
    padroesMercado:  saved.padroesMercado  || [],
    promessasComuns: saved.promessasComuns || [],
    tentativas:      saved.tentativas      || [],
    justificativas:  saved.justificativas  || [],
    viloes:          saved.viloes          || [],
    provas:          saved.provas          || [],
    diferentes:      saved.diferentes      || [],
  }
}

// ─── Metadados dos passos (uma decisão por tela) ────────────────────────────
export const STEP_META = [
  { id: 'concorrentes', title: 'Seus concorrentes',   subtitle: 'Quem mais disputa esse cliente',      optional: false },
  { id: 'mercado',      title: 'O padrão do mercado', subtitle: 'O que todo mundo fala igual',         optional: true  },
  { id: 'tentativas',   title: 'O que ele já tentou', subtitle: 'E por que ELE acha que não deu certo', optional: false },
  { id: 'vilao',        title: 'O vilão',             subtitle: 'Quem leva a culpa (nunca o cliente)',  optional: false },
  { id: 'prova',        title: 'Conexão e prova',     subtitle: 'Por que sua explicação é crível',      optional: false },
  { id: 'diferente',    title: 'O que é diferente',   subtitle: 'Diferente de... eu...',                optional: false },
  { id: 'nome',         title: 'Nome do mecanismo',   subtitle: 'Batize a sua solução',                 optional: false },
  { id: 'porque',       title: 'Por que funciona',    subtitle: 'As técnicas que sustentam',            optional: true  },
  { id: 'montagem',     title: 'Montagem do pitch',   subtitle: 'Junta tudo no esqueleto final',        optional: false },
  { id: 'validacao',    title: 'Validação',           subtitle: 'Os 7 critérios + teste do amigo',      optional: true  },
  { id: 'final',        title: 'Pitch pronto',        subtitle: 'Revise o resultado',                   optional: false },
]

// Progresso de preenchimento por passo (checks da trilha)
export function computeFilledMap(d = {}) {
  return {
    concorrentes: (d.concorrentes || []).some((c) => c.nome?.trim() || c.oferta?.trim()),
    mercado:      (d.padroesMercado || []).length > 0 || (d.promessasComuns || []).length > 0,
    tentativas:   (d.tentativas || []).some((t) => t.tentou?.trim()) || (d.justificativas || []).length > 0,
    vilao:        !!d.vilaoPrincipal?.trim(),
    prova:        !!d.provaTexto?.trim() || !!d.conexao?.vilao?.trim(),
    diferente:    (d.diferentes || []).some((x) => x.deles?.trim() || x.voce?.trim()),
    nome:         !!d.nomeMecanismo?.trim(),
    porque:       Object.values(d.tecnicas || {}).some((v) => v?.trim()),
    montagem:     !!d.euAjudo?.trim() || !!d.aConseguir?.trim(),
    validacao:    Object.keys(d.validacao || {}).length > 0 || !!d.testeAmigo,
    final:        !!d.aiAnalysis,
  }
}

// ─── Pitch builder ──────────────────────────────────────────────────────────
export function buildPitch(d) {
  const parts = []
  const header = [
    d.euAjudo ? `**Eu ajudo:** ${d.euAjudo}` : null,
    d.aConseguir ? `**A conseguir:** ${d.aConseguir}` : null,
    (d.atravesDo || d.nomeMecanismo) ? `**Através do:** ${d.atravesDo || d.nomeMecanismo}` : null,
  ].filter(Boolean).join('\n\n')
  if (header) parts.push(header)

  const falhou = [
    d.porqueFalhou?.problema,
    d.porqueFalhou?.razao,
    d.porqueFalhou?.prova,
  ].filter(Boolean).join(' ')
  if (falhou) parts.push(`## Por que falhou até agora\n\n${falhou}`)

  const funcionaParts = [
    d.porqueFunciona?.explicacao,
    (d.porqueFunciona?.diferente || d.porqueFunciona?.voce)
      ? `Diferente de ${d.porqueFunciona?.diferente || '...'}, ${d.porqueFunciona?.voce || '...'}.`
      : null,
  ].filter(Boolean).join(' ')
  if (funcionaParts) parts.push(`## Por que vai funcionar\n\n${funcionaParts}`)

  if (d.promessaPrazo || d.promessaResultado) {
    parts.push(`## Promessa\n\nEm ${d.promessaPrazo || '__'}, ${d.promessaResultado || '__'}.`)
  }

  return parts.join('\n\n')
}
