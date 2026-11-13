// Matriz de Objeção (Ferramentas da página do cliente).
export default {
  titulo: 'Matriz de Objeção',
  descricao: 'Mapeie as objeções de venda do cliente: como antecipar, a causa provável e a melhor resposta. Você pode compartilhar um link pro próprio cliente preencher junto.',
  compartilharTitle: 'Cria/copia o link pro cliente preencher a matriz',
  linkCopiado: 'Link copiado!',
  linkCopiadoToast: 'Link copiado pro clipboard!',
  linkToast: 'Link: {url}',
  compartilhar: 'Compartilhar com cliente',
  vazioAntes: 'Nenhuma objeção cadastrada ainda. Clique em ',
  vazioBotao: '“Adicionar objeção”',
  vazioDepois: ' abaixo.',
  removerLinha: 'Remover linha',
  adicionar: 'Adicionar objeção',
  contagem: { one: '{count} objeção cadastrada · salvas automaticamente', other: '{count} objeções cadastradas · salvas automaticamente' },
  colunas: {
    tipo: { label: 'Tipo de objeção', placeholder: 'Ex: "Está caro"', hint: 'A objeção como o cliente fala' },
    antecipar: { label: 'Como antecipar a objeção', placeholder: 'Ex: mostrar ROI antes do preço', hint: 'O que fazer antes dela surgir' },
    causa: { label: 'Causa provável', placeholder: 'Ex: não enxergou o valor entregue', hint: 'Por que o cliente pensa isso' },
    resposta: { label: 'Resposta para a objeção', placeholder: 'Ex: "Quanto custa NÃO resolver isso?"', hint: 'O contorno na hora' },
  },
}
