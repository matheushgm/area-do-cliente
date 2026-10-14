// Reescreve um texto em Markdown com IA a partir de uma instrução, opcionalmente
// focada num trecho selecionado. É o refino padrão do TextoEditavelIA (Kickoff,
// Mecanismo Único, Produto/Serviço…). Devolve o texto INTEIRO atualizado, em
// streaming, pra tela mostrar a versão nova e o time aprovar ou recusar.
import { streamClaude } from './claude'
import { buildCachedPayload } from './buildContext'

export const MODELO_REFINO = 'claude-opus-5-5'

const SYSTEM = `Você edita textos em markdown produzidos para clientes de uma agência de marketing (Revenue Lab).

Receberá um TEXTO ATUAL e uma INSTRUÇÃO. Se houver um TRECHO SELECIONADO, altere somente esse trecho e mantenha todo o resto exatamente igual, caractere por caractere. Sem trecho, aplique a instrução ao texto inteiro.

Regras:
- Devolva SOMENTE o texto inteiro atualizado, em markdown. Sem comentários, sem explicações, sem bloco de código em volta.
- Preserve cabeçalhos, rótulos em negrito, listas, tabelas e separadores (---) que não fizerem parte da mudança.
- Português brasileiro. Não use travessões (—); use vírgula, dois-pontos ou ponto-final.`

/** Tira a cerca \`\`\` que a IA às vezes põe em volta (mesmo incompleta, durante o streaming) e os travessões. */
export function limparSaida(s) {
  return String(s || '')
    .trim()
    .replace(/^```(?:markdown|md)?[ \t]*\n/, '')
    .replace(/\n?```$/, '')
    .replace(/—/g, '-')
}

export async function refinarMarkdown({
  texto,
  trecho,
  instrucao,
  project,
  onChunk,
  signal,
  maxTokens = 8000,
}) {
  const instruction = [
    '## TEXTO ATUAL',
    '',
    texto,
    '',
    trecho ? `## TRECHO SELECIONADO\n\n${trecho}\n` : '',
    '## INSTRUÇÃO',
    '',
    instrucao,
  ].join('\n')

  // Com projeto, o contexto do cliente entra no system (com cache); sem, só o prompt.
  const payload = project
    ? buildCachedPayload({ systemPrompt: SYSTEM, project, instruction })
    : { system: SYSTEM, messages: [{ role: 'user', content: instruction }] }

  const saida = await streamClaude({
    model: MODELO_REFINO,
    max_tokens: maxTokens,
    system: payload.system,
    messages: payload.messages,
    onChunk: onChunk ? (t) => onChunk(limparSaida(t)) : undefined,
    signal,
  })
  return limparSaida(saida)
}
