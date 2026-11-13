// Constantes do Playbook "Construção de Mecanismo Único" (XPN Digital).
// Cobrem opções pré-definidas usadas pelas 6 seções.
//
// Os textos moram em src/i18n/locales/{pt,en}/mecanismoPassos.js. No fim deste arquivo
// cada campo de texto vira um getter que traduz no idioma de agora (como no Kickoff),
// então quem lê `v.label` continua igual. Ids e valores gravados não mudam.
import { t } from '../../i18n'

// ─── Seção 3: Vilões candidatos ───────────────────────────────────────────────
export const VILOES = [
  { id: 'ultrapassados' },
  { id: 'generica' },
  { id: 'gurus' },
  { id: 'fora_contexto' },
  { id: 'outro_publico' },
  { id: 'peca_faltando' },
]

// ─── Seção 3: Tipos de prova ──────────────────────────────────────────────────
export const TIPOS_PROVA = [
  { id: 'dado' },
  { id: 'pesquisa' },
  { id: 'comparacao' },
  { id: 'historia' },
  { id: 'logica' },
]

// ─── Seção 3: Exemplos de conexão lógica + prova (por tipo de cliente) ────────
// Cada exemplo mostra a cadeia completa (vilão → problema → fracasso) e o tipo
// de prova que a sustenta. As provas são sempre evidência do PRÓPRIO negócio
// (o que ele viu atendendo), justamente pra ensinar que prova se colhe, não se
// inventa — o cliente deve trocar pelos números reais dele.
export const EXEMPLOS_CONEXAO = {
  b2b: [
    { id: 'b2b-bpo' },
    { id: 'b2b-trafego' },
    { id: 'b2b-erp' },
    { id: 'b2b-comercial' },
    { id: 'b2b-distribuidora' },
  ],
  b2c: [
    { id: 'b2c-colchao' },
    { id: 'b2c-emagrecimento' },
    { id: 'b2c-otica' },
    { id: 'b2c-odonto' },
    { id: 'b2c-carro' },
  ],
}

// ─── Seção 4: Formatos de nome do mecanismo ───────────────────────────────────
export const FORMATOS_NOME = [
  { id: 'metodo_nome' },
  { id: 'sistema_sigla' },
  { id: 'os_numero_palavra' },
  { id: 'conceito_metafora' },
]

// ─── Seção 4: Técnicas de "por que funciona" ──────────────────────────────────
export const TECNICAS = [
  { id: 'autoridade' },
  { id: 'especificidade' },
  { id: 'segredo' },
  { id: 'processo' },
]

// ─── Seção 6: Critérios de validação ──────────────────────────────────────────
export const CRITERIOS_VALIDACAO = [
  { id: 'verdadeiro' },
  { id: 'fazSentido' },
  { id: 'novidade' },
  { id: 'interessante' },
  { id: 'contavel' },
  { id: 'diferente' },
  { id: 'aplicavel' },
]

// ─── Seção 6: Teste do amigo ──────────────────────────────────────────────────
export const TESTE_AMIGO = [
  { id: 'aprovado' },
  { id: 'nao_entendi' },
  { id: 'ja_vi_em_lugares' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Conta quantos critérios da validação foram marcados como "sim"
export function countValidacao(validacao = {}) {
  return CRITERIOS_VALIDACAO.reduce((acc, c) => acc + (validacao[c.id] === 'sim' ? 1 : 0), 0)
}

// Determina o veredito final
export function vereditoValidacao(validacao = {}) {
  const count = countValidacao(validacao)
  if (count === 7) return { tier: 'excelente', label: t('mecanismoPassos.veredito.excelente'), color: '#15803D' }
  if (count >= 5)  return { tier: 'bom',       label: t('mecanismoPassos.veredito.bom'), color: '#EAB308' }
  return { tier: 'refazer', label: t('mecanismoPassos.veredito.refazer'), color: '#EF4444' }
}

// ─── Textos traduzidos (getters) ──────────────────────────────────────────────
function ligar(alvo, campo, chave) {
  Object.defineProperty(alvo, campo, { enumerable: true, configurable: true, get: () => t(chave) })
}

VILOES.forEach((v) => ligar(v, 'label', `mecanismoPassos.viloes.${v.id}`))
TIPOS_PROVA.forEach((p) => ligar(p, 'label', `mecanismoPassos.tiposProva.${p.id}`))
for (const lista of Object.values(EXEMPLOS_CONEXAO)) {
  for (const ex of lista) {
    for (const campo of ['segmento', 'vilao', 'problema', 'fracasso', 'prova']) {
      ligar(ex, campo, `mecanismoPassos.exemplos.${ex.id}.${campo}`)
    }
  }
}
FORMATOS_NOME.forEach((f) => {
  ligar(f, 'label', `mecanismoPassos.formatos.${f.id}.label`)
  ligar(f, 'exemplo', `mecanismoPassos.formatos.${f.id}.exemplo`)
})
TECNICAS.forEach((tc) => {
  ligar(tc, 'label', `mecanismoPassos.tecnicas.${tc.id}.label`)
  ligar(tc, 'placeholder', `mecanismoPassos.tecnicas.${tc.id}.placeholder`)
})
CRITERIOS_VALIDACAO.forEach((c) => {
  ligar(c, 'label', `mecanismoPassos.criterios.${c.id}.label`)
  ligar(c, 'desc', `mecanismoPassos.criterios.${c.id}.desc`)
})
TESTE_AMIGO.forEach((a) => {
  ligar(a, 'label', `mecanismoPassos.testeAmigo.${a.id}.label`)
  ligar(a, 'resultado', `mecanismoPassos.testeAmigo.${a.id}.resultado`)
})
