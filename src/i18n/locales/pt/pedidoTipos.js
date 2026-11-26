// Vazio de propósito: o português dos tipos de pedido (nomes, campos, opções, ajudas, títulos) é o
// próprio src/lib/pedidoTipos.js, que o servidor (api/intake-publico.js) também lê para montar a
// tarefa do Intake em português. A página (PedidoPublico.jsx) só consulta este namespace fora do
// português e cai no texto do arquivo quando falta a chave. Estrutura: ver locales/en/pedidoTipos.js.
export default {}
