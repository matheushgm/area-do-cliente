// Roteiro de vídeo da Central: o que vem antes do rótulo GANCHO (a linha
// "# ROT08 · Fundo · Gancho: ... · Mensagem: ...", o Quem, o Quando e a tabela
// de O quê) é material do time. O cliente aprova só o texto falado: Gancho,
// Mensagem e CTA. Copy sem esse rótulo (estáticos, roteiros soltos) passa inteira.
const INICIO_DO_TEXTO = /^[ \t]*(?:\*\*|__)?[ \t]*GANCHO\b[^\n:]*:/m

export function separarCopy(conteudo) {
  const s = String(conteudo ?? '')
  const m = INICIO_DO_TEXTO.exec(s)
  if (!m || m.index === 0) return { cabecalho: '', texto: s }
  return { cabecalho: s.slice(0, m.index).trimEnd(), texto: s.slice(m.index) }
}

export const copyParaCliente = (conteudo) => separarCopy(conteudo).texto

// O cliente editou só o texto: a copy do anúncio volta com o cabeçalho na frente.
export const juntarCopy = (cabecalho, texto) =>
  cabecalho ? `${cabecalho}\n\n${String(texto ?? '').trimStart()}` : String(texto ?? '')
