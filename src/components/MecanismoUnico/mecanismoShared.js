// ─────────────────────────────────────────────────────────────────────────────
// Camada compartilhada do Mecanismo Único (playbook XPN Digital).
// Schema, hidratação, metadados dos passos do wizard e o montador do pitch.
// Sem React — importado pelo módulo interno, pelo wizard e pela página pública.
// ─────────────────────────────────────────────────────────────────────────────
import { t } from '../../i18n'
import TEXTOS_PT from '../../i18n/locales/pt/mecanismoPassos.js'

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
  { id: 'concorrentes', optional: false },
  { id: 'mercado', optional: true },
  { id: 'tentativas', optional: false },
  { id: 'vilao', optional: false },
  { id: 'prova', optional: false },
  { id: 'diferente', optional: false },
  { id: 'nome', optional: false },
  { id: 'porque', optional: true },
  { id: 'montagem', optional: false },
  { id: 'validacao', optional: true },
  { id: 'final', optional: false },
]

// Título e subtítulo no idioma de agora (getters; o texto mora em mecanismoPassos.passos).
STEP_META.forEach((s) => {
  for (const campo of ['title', 'subtitle']) {
    Object.defineProperty(s, campo, {
      enumerable: true, configurable: true, get: () => t(`mecanismoPassos.passos.${s.id}.${campo}`),
    })
  }
})

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
// `pt: true` monta sempre em português (o pitch que vai no prompt da IA);
// sem isso, os rótulos seguem o idioma da tela.
function rotuloPitch(chave, vars, pt) {
  if (!pt) return t(`mecanismoPassos.pitch.${chave}`, vars)
  const v = TEXTOS_PT.pitch[chave] || ''
  return vars ? v.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m)) : v
}

export function buildPitch(d, { pt = false } = {}) {
  const L = (chave, vars) => rotuloPitch(chave, vars, pt)
  const parts = []
  const header = [
    d.euAjudo ? `**${L('euAjudo')}** ${d.euAjudo}` : null,
    d.aConseguir ? `**${L('aConseguir')}** ${d.aConseguir}` : null,
    (d.atravesDo || d.nomeMecanismo) ? `**${L('atravesDo')}** ${d.atravesDo || d.nomeMecanismo}` : null,
  ].filter(Boolean).join('\n\n')
  if (header) parts.push(header)

  const falhou = [
    d.porqueFalhou?.problema,
    d.porqueFalhou?.razao,
    d.porqueFalhou?.prova,
  ].filter(Boolean).join(' ')
  if (falhou) parts.push(`## ${L('porqueFalhou')}\n\n${falhou}`)

  const funcionaParts = [
    d.porqueFunciona?.explicacao,
    (d.porqueFunciona?.diferente || d.porqueFunciona?.voce)
      ? L('diferenteDe', { deles: d.porqueFunciona?.diferente || '...', voce: d.porqueFunciona?.voce || '...' })
      : null,
  ].filter(Boolean).join(' ')
  if (funcionaParts) parts.push(`## ${L('porqueFunciona')}\n\n${funcionaParts}`)

  if (d.promessaPrazo || d.promessaResultado) {
    parts.push(`## ${L('promessa')}\n\n${L('promessaTexto', { prazo: d.promessaPrazo || '__', resultado: d.promessaResultado || '__' })}`)
  }

  return parts.join('\n\n')
}
