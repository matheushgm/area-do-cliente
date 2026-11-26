// Bancos compartilháveis (sem login): /banco-de-anuncios-publico e /banco-de-lps-publico.
// Os filtros na querystring (?type=, ?funil=) guardam os valores em português; só o rótulo traduz.
export default {
  marca: 'Revenue Lab',
  carregando: 'Carregando...',
  todosFunis: 'Todos os funis',
  anuncios: {
    titulo: 'Banco de Anúncios',
    anuncio: 'Anúncio',
    visualizar: 'Visualizar',
    baixar: 'Baixar arquivo',
    video: 'Vídeo',
    estatico: 'Estático',
    todos: 'Todos',
    contagem: { one: '{count} anúncio', other: '{count} anúncios' },
    vazio: 'Nenhum anúncio encontrado com esses filtros',
  },
  lps: {
    titulo: 'Banco de LP',
    semPreview: 'Sem preview',
    modelosPadrao: 'Modelos padrão',
    modelosSub: 'estruturas de referência de landing page',
    modeloSub: 'Modelo padrão · estrutura de referência',
    fechar: 'Fechar',
    contagem: { one: '{count} LP', other: '{count} LPs' },
    vazio: 'Nenhuma landing page encontrada com esses filtros',
  },
}
