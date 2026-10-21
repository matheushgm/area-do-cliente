// Mescla do que o cliente envia nos formulários públicos de Resultados com o que já
// está gravado. Formato: { 'YYYY-MM': { <dia|semana>: entrada } }.
//
// O formulário manda o mês inteiro como estava quando a página abriu. Sem mescla, um
// preenchimento automático (fonte:'api') gravado depois disso seria apagado.
// Regras por entrada:
//   - só existe no servidor      → mantém (o formulário não apaga dados);
//   - só existe no cliente       → usa a do cliente;
//   - existem as duas            → a do cliente vence, EXCETO quando as duas são da API
//                                  e a do servidor é mais nova (cópia velha no navegador).
const novaDaApi = (srv, cli) =>
  srv?.fonte === 'api' && cli?.fonte === 'api' &&
  String(srv.atualizadoEm || '') > String(cli.atualizadoEm || '')

export function mergeResultados(server, client) {
  if (client === undefined) return server
  if (!client || typeof client !== 'object') return server
  const out = { ...(server || {}) }
  for (const [mes, entradasCli] of Object.entries(client)) {
    const entradasSrv = out[mes] || {}
    const mesclado = { ...entradasSrv }
    for (const [chave, cli] of Object.entries(entradasCli || {})) {
      const srv = entradasSrv[chave]
      mesclado[chave] = srv && novaDaApi(srv, cli) ? srv : cli
    }
    out[mes] = mesclado
  }
  return out
}
