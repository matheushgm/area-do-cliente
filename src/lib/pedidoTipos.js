// Tipos de pedido que o cliente faz pelo link público /pedido/:token.
// Um arquivo só para a página (monta o formulário), o servidor (api/intake-publico.js valida,
// confere o Drive e monta título e descrição da tarefa) e o Intake (mostra as respostas).
// Os três primeiros espelham os templates do VertaTask (`tarefas_modelos.nome` em `template`):
// no Intake, aceitar um desses pedidos pode aplicar o template inteiro.
//
// Campo: { k, tipo, label, curto?, obrigatorio?, quando?(r), opcoes?, placeholder?, ajuda? }.
// `label`, `ajuda` e `placeholder` aceitam função das respostas. Tipos: texto, textarea,
// escolha, multi, numero, dinheiro (+ `${k}_periodo` mes|dia), data, telefone, link,
// drive (link do Google Drive conferido como público; `aceitaOutros` libera outro link),
// check e aviso (só texto, sem resposta).

const PLATAFORMAS = [
  { v: 'meta', label: 'Meta Ads', desc: 'Facebook e Instagram' },
  { v: 'google', label: 'Google Ads' },
]

const DESTINOS = [
  { v: 'whatsapp', label: 'WhatsApp' },
  { v: 'site', label: 'Landing page ou site' },
  { v: 'formulario', label: 'Formulário do Instagram' },
  { v: 'perfil', label: 'Perfil do Instagram' },
  { v: 'nao_sei', label: 'Ainda não sei' },
]

const CAMPO_DESTINO = { k: 'destino', tipo: 'escolha', label: 'Quem clicar no anúncio vai para onde?', curto: 'Destino', obrigatorio: true, opcoes: DESTINOS }
const CAMPO_DESTINO_LINK = { k: 'destino_link', tipo: 'link', label: 'Link da página', curto: 'Link do destino', obrigatorio: true, quando: (r) => r.destino === 'site', placeholder: 'https://' }
const CAMPO_OBS = { k: 'obs', tipo: 'textarea', label: 'Mais alguma coisa que a gente precisa saber?', curto: 'Observações', linhas: 3 }

export const TIPOS_PEDIDO = [
  {
    id: 'criativo_estatico', nome: 'Criativo estático', grupo: 'criacao', template: 'Criativo Estático',
    resumo: 'Arte de anúncio para feed ou story',
    prazoMsg: (n, r) => (r.situacao === 'criar' ? `Do pedido até a arte no ar costuma levar uns ${n} dias úteis, porque a copy e a arte passam pela sua aprovação.` : ''),
    campos: [
      { k: 'assunto', tipo: 'texto', label: 'Sobre o que é o anúncio?', curto: 'Assunto', obrigatorio: true, max: 160, placeholder: 'Ex.: promoção de revisão em novembro' },
      { k: 'situacao', tipo: 'escolha', label: 'Como está a arte?', curto: 'Situação', obrigatorio: true, opcoes: [
        { v: 'pronto', label: 'Já está pronta', desc: 'É só colocar nos anúncios' },
        { v: 'criar', label: 'Preciso que vocês criem', desc: 'Mando o material e o texto' },
      ] },
      { k: 'drive', tipo: 'drive', obrigatorio: true, quando: (r) => !!r.situacao, curto: 'Drive',
        label: (r) => (r.situacao === 'pronto' ? 'Link do Drive com as artes prontas' : 'Link do Drive com o material da arte'),
        ajuda: (r) => (r.situacao === 'pronto' ? 'Pode ser a pasta com todas as artes.' : 'Fotos, logo, produto, tudo que for entrar na arte.') },
      { k: 'formatos', tipo: 'multi', label: 'Em quais formatos?', curto: 'Formatos', obrigatorio: true, opcoes: [
        { v: 'feed', label: 'Feed', desc: 'Quadrado ou 4:5' },
        { v: 'story', label: 'Story e Reels', desc: 'Vertical' },
        { v: 'decidam', label: 'Vocês decidem' },
      ] },
      { k: 'quantidade', tipo: 'numero', label: 'Quantas artes?', curto: 'Quantidade', quando: (r) => r.situacao === 'criar', min: 1, max: 30, placeholder: '1' },
      { k: 'texto', tipo: 'textarea', label: 'O que precisa estar escrito na arte?', curto: 'Texto da arte', obrigatorio: true, quando: (r) => r.situacao === 'criar',
        placeholder: 'Oferta, preço, condição e prazo. Ex.: revisão completa por R$ 199 até 30/11, em até 3x no cartão' },
      { k: 'referencias', tipo: 'textarea', label: 'Referências que você gosta', curto: 'Referências', linhas: 2, quando: (r) => r.situacao === 'criar',
        placeholder: 'Links de anúncios ou perfis; prints podem ir no mesmo Drive' },
      CAMPO_DESTINO, CAMPO_DESTINO_LINK,
      { k: 'campanha', tipo: 'escolha', label: 'Em qual campanha entra?', curto: 'Campanha', opcoes: [
        { v: 'atual', label: 'Na que já está rodando' },
        { v: 'nova', label: 'Numa campanha nova' },
        { v: 'decidam', label: 'Vocês decidem' },
      ] },
      CAMPO_OBS,
    ],
    titulo: (r) => `Criativo estático · ${r.assunto}`,
  },
  {
    id: 'criativo_video', nome: 'Criativo de vídeo', grupo: 'criacao', template: 'Criativo de Vídeo',
    resumo: 'Vídeo para Reels, Stories ou feed',
    prazoMsg: (n, r) => (r.situacao === 'editar' || r.situacao === 'roteiro' ? `Do pedido até o vídeo no ar costuma levar uns ${n} dias úteis${r.situacao === 'roteiro' ? ' depois da gravação' : ''}, contando copy, edição e a sua aprovação.` : ''),
    campos: [
      { k: 'assunto', tipo: 'texto', label: 'Sobre o que é o vídeo?', curto: 'Assunto', obrigatorio: true, max: 160, placeholder: 'Ex.: lançamento do novo plano de manutenção' },
      { k: 'situacao', tipo: 'escolha', label: 'Em que pé está o vídeo?', curto: 'Situação', obrigatorio: true, opcoes: [
        { v: 'pronto', label: 'Já está pronto', desc: 'É só colocar nos anúncios' },
        { v: 'editar', label: 'Já gravei', desc: 'Preciso que vocês editem' },
        { v: 'roteiro', label: 'Ainda não gravei', desc: 'Preciso do roteiro antes' },
      ] },
      { k: 'drive', tipo: 'drive', curto: 'Drive', quando: (r) => !!r.situacao,
        obrigatorio: (r) => r.situacao !== 'roteiro',
        label: (r) => ({ pronto: 'Link do Drive com o vídeo pronto', editar: 'Link do Drive com os vídeos gravados' }[r.situacao] || 'Link do Drive com material de apoio (opcional)'),
        ajuda: (r) => (r.situacao === 'editar' ? 'Suba os arquivos originais do celular, sem passar pelo WhatsApp (ele derruba a qualidade).' : '') },
      { k: 'formatos', tipo: 'multi', label: 'Em quais formatos?', curto: 'Formatos', obrigatorio: true, opcoes: [
        { v: 'vertical', label: 'Vertical', desc: 'Reels e Stories' },
        { v: 'feed', label: 'Feed', desc: 'Quadrado ou 4:5' },
        { v: 'horizontal', label: 'Horizontal', desc: 'YouTube' },
        { v: 'decidam', label: 'Vocês decidem' },
      ] },
      { k: 'duracao', tipo: 'escolha', label: 'Duração aproximada', curto: 'Duração', quando: (r) => r.situacao && r.situacao !== 'pronto', opcoes: [
        { v: '15', label: 'Até 15 s' }, { v: '30', label: '15 a 30 s' }, { v: '60', label: '30 a 60 s' },
        { v: 'mais', label: 'Mais de 1 min' }, { v: 'decidam', label: 'Vocês decidem' },
      ] },
      { k: 'mensagem', tipo: 'textarea', label: 'Qual a mensagem principal do vídeo?', curto: 'Mensagem', obrigatorio: true, quando: (r) => r.situacao && r.situacao !== 'pronto',
        placeholder: 'O que a pessoa precisa entender e o que ela faz depois de assistir' },
      { k: 'legenda', tipo: 'escolha', label: 'Quer legenda escrita no vídeo?', curto: 'Legenda', quando: (r) => r.situacao === 'editar', opcoes: [
        { v: 'sim', label: 'Sim' }, { v: 'nao', label: 'Não' }, { v: 'decidam', label: 'Vocês decidem' },
      ] },
      { k: 'referencias', tipo: 'textarea', label: 'Referências que você gosta', curto: 'Referências', linhas: 2, quando: (r) => r.situacao && r.situacao !== 'pronto',
        placeholder: 'Links de vídeos ou perfis com o estilo que você quer' },
      CAMPO_DESTINO, CAMPO_DESTINO_LINK, CAMPO_OBS,
    ],
    titulo: (r) => `Criativo de vídeo · ${r.assunto}`,
  },
  {
    id: 'landing_page', nome: 'Landing page', grupo: 'criacao', template: 'Landing Page',
    resumo: 'Página nova ou ajuste numa que já existe',
    prazoMsg: (n, r) => (r.situacao === 'nova' ? `Uma página nova costuma levar uns ${n} dias úteis até entrar na campanha, com a copy e o layout aprovados por você.` : ''),
    campos: [
      { k: 'situacao', tipo: 'escolha', label: 'O que você precisa?', curto: 'Pedido', obrigatorio: true, opcoes: [
        { v: 'nova', label: 'Uma página nova' },
        { v: 'ajuste', label: 'Ajuste numa página que já existe' },
      ] },
      { k: 'pagina_link', tipo: 'link', label: 'Link da página', curto: 'Página', obrigatorio: true, quando: (r) => r.situacao === 'ajuste', placeholder: 'https://' },
      { k: 'ajuste', tipo: 'textarea', label: 'O que precisa mudar?', curto: 'Ajuste', obrigatorio: true, quando: (r) => r.situacao === 'ajuste',
        placeholder: 'Ex.: trocar o preço da seção de planos de R$ 297 para R$ 347 e tirar o depoimento da Ana' },
      { k: 'oferta', tipo: 'textarea', label: 'O que a página vai vender ou oferecer?', curto: 'Oferta', obrigatorio: true, quando: (r) => r.situacao === 'nova',
        placeholder: 'Produto ou serviço, preço e condição especial, se tiver' },
      { k: 'publico', tipo: 'textarea', label: 'Para quem é a página?', curto: 'Público', obrigatorio: true, quando: (r) => r.situacao === 'nova', linhas: 2,
        placeholder: 'Quem é o cliente ideal, de qual cidade, o que ele procura' },
      { k: 'objetivo', tipo: 'escolha', label: 'O que a pessoa faz na página?', curto: 'Ação na página', obrigatorio: true, quando: (r) => r.situacao === 'nova', opcoes: [
        { v: 'formulario', label: 'Preenche um formulário' },
        { v: 'whatsapp', label: 'Chama no WhatsApp' },
        { v: 'compra', label: 'Compra direto' },
        { v: 'evento', label: 'Se inscreve num evento ou aula' },
      ] },
      { k: 'drive', tipo: 'drive', curto: 'Drive', quando: (r) => !!r.situacao, label: 'Link do Drive com logo, fotos e textos (opcional)',
        ajuda: 'Se não tiver, a gente usa o que já tem da sua marca.' },
      { k: 'referencias', tipo: 'textarea', label: 'Páginas que você gosta', curto: 'Referências', linhas: 2, quando: (r) => r.situacao === 'nova', placeholder: 'Links de páginas como referência' },
      { k: 'dominio', tipo: 'texto', label: 'Em qual endereço ela vai ficar?', curto: 'Endereço', quando: (r) => r.situacao === 'nova',
        placeholder: 'Ex.: promo.suaempresa.com.br. Se não souber, a gente resolve' },
      CAMPO_OBS,
    ],
    titulo: (r) => (r.situacao === 'ajuste' ? `Ajuste na landing page · ${resumir(r.ajuste, 70)}` : `Landing page nova · ${resumir(r.oferta, 70)}`),
  },
  {
    id: 'nova_campanha', nome: 'Nova campanha', grupo: 'campanhas',
    resumo: 'Anunciar um produto, serviço ou promoção',
    campos: [
      { k: 'oferta', tipo: 'textarea', label: 'O que vamos anunciar?', curto: 'Oferta', obrigatorio: true, linhas: 3,
        placeholder: 'Produto, serviço ou promoção, com preço e condição. Ex.: Black Friday com 20% de desconto em todos os pneus' },
      { k: 'objetivo', tipo: 'escolha', label: 'O que você quer que a pessoa faça?', curto: 'Objetivo', obrigatorio: true, opcoes: [
        { v: 'whatsapp', label: 'Chame no WhatsApp' },
        { v: 'cadastro', label: 'Preencha um cadastro' },
        { v: 'site', label: 'Compre no site' },
        { v: 'loja', label: 'Ligue ou vá até a loja' },
        { v: 'alcance', label: 'Conheça a marca' },
      ] },
      { k: 'whatsapp_numero', tipo: 'telefone', label: 'Qual WhatsApp recebe os contatos?', curto: 'WhatsApp', quando: (r) => r.objetivo === 'whatsapp',
        ajuda: 'Deixe em branco se for o mesmo dos anúncios de hoje.' },
      { k: 'link', tipo: 'link', label: 'Link do site ou da página', curto: 'Link', obrigatorio: true, quando: (r) => r.objetivo === 'site', placeholder: 'https://' },
      { k: 'plataformas', tipo: 'multi', label: 'Onde anunciar?', curto: 'Plataformas', obrigatorio: true, opcoes: [...PLATAFORMAS, { v: 'decidam', label: 'Vocês decidem' }] },
      { k: 'regiao', tipo: 'texto', label: 'Para quais cidades ou regiões?', curto: 'Região', obrigatorio: true, max: 200,
        placeholder: 'Ex.: Goiânia e Aparecida, ou um raio de 10 km da loja' },
      { k: 'publico', tipo: 'textarea', label: 'Quem é o cliente ideal?', curto: 'Público', linhas: 2, placeholder: 'Idade, profissão, o que ele procura' },
      { k: 'verba', tipo: 'dinheiro', label: 'Quanto investir nessa campanha?', curto: 'Verba', obrigatorio: true, periodo: true },
      { k: 'verba_origem', tipo: 'escolha', label: 'Esse valor é…', curto: 'Origem da verba', obrigatorio: true, opcoes: [
        { v: 'nova', label: 'Dinheiro novo', desc: 'Além do que já investimos' },
        { v: 'atual', label: 'Sai do orçamento de hoje', desc: 'Tira de outras campanhas' },
      ] },
      { k: 'inicio', tipo: 'data', label: 'Quando começa?', curto: 'Início', obrigatorio: true },
      { k: 'ate', tipo: 'escolha', label: 'Até quando?', curto: 'Duração', obrigatorio: true, opcoes: [
        { v: 'sem_fim', label: 'Sem data para acabar' }, { v: 'data', label: 'Até uma data' },
      ] },
      { k: 'fim', tipo: 'data', label: 'Até que dia?', curto: 'Fim', obrigatorio: true, quando: (r) => r.ate === 'data' },
      { k: 'criativos', tipo: 'escolha', label: 'Já tem os criativos?', curto: 'Criativos', obrigatorio: true, opcoes: [
        { v: 'tenho', label: 'Tenho, estão no Drive' },
        { v: 'criar', label: 'Preciso que vocês criem' },
        { v: 'atuais', label: 'Usar os que já estão rodando' },
      ] },
      { k: 'drive', tipo: 'drive', label: 'Link do Drive com os criativos', curto: 'Drive', obrigatorio: true, quando: (r) => r.criativos === 'tenho' },
      { k: 'regras', tipo: 'textarea', label: 'Regras da oferta', curto: 'Regras', linhas: 2, placeholder: 'Validade, estoque, letras miúdas que precisam aparecer' },
      CAMPO_OBS,
    ],
    titulo: (r) => `Nova campanha · ${resumir(r.oferta, 70)}`,
  },
  {
    id: 'orcamento', nome: 'Orçamento', grupo: 'campanhas',
    resumo: 'Aumentar ou diminuir o investimento',
    campos: [
      { k: 'acao', tipo: 'escolha', label: 'O que você quer fazer?', curto: 'Mudança', obrigatorio: true, opcoes: [
        { v: 'aumentar', label: 'Aumentar o investimento' },
        { v: 'diminuir', label: 'Diminuir o investimento' },
      ] },
      { k: 'plataformas', tipo: 'multi', label: 'Em qual plataforma?', curto: 'Plataformas', obrigatorio: true, opcoes: PLATAFORMAS },
      { k: 'valor', tipo: 'dinheiro', label: 'Qual o novo valor?', curto: 'Novo valor', obrigatorio: true, periodo: true,
        ajuda: (r) => ((r.plataformas || []).length > 1 ? 'Coloque o total das duas e conte a divisão nas observações.' : '') },
      { k: 'valor_atual', tipo: 'dinheiro', label: 'Quanto é hoje?', curto: 'Valor de hoje', periodo: true, ajuda: 'Se souber.' },
      { k: 'inicio', tipo: 'data', label: 'A partir de quando?', curto: 'A partir de', obrigatorio: true },
      { k: 'ate', tipo: 'escolha', label: 'Até quando?', curto: 'Até', obrigatorio: true, opcoes: [
        { v: 'aviso', label: 'Até eu avisar' }, { v: 'data', label: 'Até uma data' },
      ] },
      { k: 'fim', tipo: 'data', label: 'Até que dia?', curto: 'Fim', obrigatorio: true, quando: (r) => r.ate === 'data' },
      { k: 'pagamento', tipo: 'escolha', label: 'O pagamento da conta já cobre o novo valor?', curto: 'Pagamento', obrigatorio: true, quando: (r) => r.acao === 'aumentar',
        ajuda: 'Em conta pré-paga (boleto ou Pix), o saldo precisa entrar antes do aumento.', opcoes: [
          { v: 'sim', label: 'Sim, já está certo' }, { v: 'ajuda', label: 'Não, preciso de ajuda' }, { v: 'nao_sei', label: 'Não sei' },
        ] },
      { k: 'motivo', tipo: 'textarea', label: 'Por que a mudança?', curto: 'Motivo', linhas: 2, placeholder: 'Ex.: promoção de Black Friday, mês mais fraco, agenda cheia' },
      CAMPO_OBS,
    ],
    titulo: (r) => `Orçamento: ${r.acao === 'diminuir' ? 'diminuir' : 'aumentar'} ${(r.plataformas || []).map((v) => PLATAFORMAS.find((p) => p.v === v)?.label || v).join(' e ')} para ${dinheiroTexto(r.valor, r.valor_periodo)}`,
  },
  {
    id: 'whatsapp', nome: 'Alteração de WhatsApp', grupo: 'campanhas',
    resumo: 'Trocar número ou mensagem dos anúncios',
    campos: [
      { k: 'mudanca', tipo: 'multi', label: 'O que muda?', curto: 'Mudança', obrigatorio: true, opcoes: [
        { v: 'trocar', label: 'Trocar o número', desc: 'Que recebe os contatos dos anúncios' },
        { v: 'mensagem', label: 'Mudar a mensagem', desc: 'Que a pessoa manda ao clicar' },
        { v: 'adicionar', label: 'Adicionar outro número', desc: 'Outra unidade ou atendente' },
        { v: 'outra', label: 'Outra coisa' },
      ] },
      { k: 'numero_atual', tipo: 'telefone', label: 'Número de hoje', curto: 'Número atual', quando: (r) => has(r.mudanca, 'trocar'), ajuda: 'Ajuda a achar os anúncios certos.' },
      { k: 'numero_novo', tipo: 'telefone', label: 'Número novo, com DDD', curto: 'Número novo', obrigatorio: true, quando: (r) => has(r.mudanca, 'trocar') || has(r.mudanca, 'adicionar') },
      { k: 'business', tipo: 'escolha', label: 'Esse número usa WhatsApp Business?', curto: 'WhatsApp Business', obrigatorio: true,
        quando: (r) => has(r.mudanca, 'trocar') || has(r.mudanca, 'adicionar'), opcoes: [
          { v: 'sim', label: 'Sim' }, { v: 'nao', label: 'Não' }, { v: 'nao_sei', label: 'Não sei' },
        ] },
      { k: 'aviso_codigo', tipo: 'aviso', quando: (r) => has(r.mudanca, 'trocar') || has(r.mudanca, 'adicionar'),
        label: 'Para ligar o número novo aos anúncios, o Facebook manda um código por SMS ou WhatsApp para ele. No dia da troca, deixe alguém com esse celular por perto.' },
      { k: 'mensagem', tipo: 'textarea', label: 'Qual mensagem a pessoa manda ao clicar?', curto: 'Mensagem', obrigatorio: true, quando: (r) => has(r.mudanca, 'mensagem'), linhas: 2,
        placeholder: 'Ex.: Olá! Vi o anúncio da revisão e quero agendar.', ajuda: 'É o texto que já vem escrito quando a conversa abre.' },
      { k: 'outra_desc', tipo: 'textarea', label: 'Conte o que precisa mudar', curto: 'Outra mudança', obrigatorio: true, quando: (r) => has(r.mudanca, 'outra'), linhas: 2 },
      { k: 'onde', tipo: 'escolha', label: 'Em quais anúncios?', curto: 'Onde', obrigatorio: true, opcoes: [
        { v: 'todos', label: 'Em todos' }, { v: 'alguns', label: 'Só em alguns' },
      ] },
      { k: 'onde_quais', tipo: 'texto', label: 'Quais?', curto: 'Quais anúncios', obrigatorio: true, quando: (r) => r.onde === 'alguns', max: 200, placeholder: 'Ex.: só os da unidade Trindade' },
      { k: 'inicio', tipo: 'data', label: 'A partir de quando?', curto: 'A partir de', obrigatorio: true },
      CAMPO_OBS,
    ],
    titulo: (r) => {
      const partes = []
      if (has(r.mudanca, 'trocar')) partes.push(`trocar o número para ${telefoneTexto(r.numero_novo)}`)
      else if (has(r.mudanca, 'adicionar')) partes.push(`adicionar o número ${telefoneTexto(r.numero_novo)}`)
      if (has(r.mudanca, 'mensagem')) partes.push('mudar a mensagem')
      if (has(r.mudanca, 'outra') && !partes.length) partes.push(resumir(r.outra_desc, 60))
      return `WhatsApp: ${partes.join(' e ') || 'alteração'}`
    },
  },
  {
    id: 'outras', nome: 'Outras', grupo: 'outras',
    resumo: 'Qualquer outro pedido, com campo livre',
    campos: [
      { k: 'resumo', tipo: 'texto', label: 'Resumo do pedido', curto: 'Resumo', obrigatorio: true, max: 160, placeholder: 'Ex.: trocar o preço da promoção nos anúncios' },
      { k: 'detalhes', tipo: 'textarea', label: 'Detalhes', curto: 'Detalhes', obrigatorio: true, linhas: 5, placeholder: 'O que precisa ser feito, onde, e como fica o pronto' },
      { k: 'arquivo', tipo: 'drive', aceitaOutros: true, label: 'Link de arquivo', curto: 'Arquivo', placeholder: 'https://', ajuda: 'Se for do Google Drive, a gente confere se está aberto.' },
    ],
    titulo: (r) => r.resumo,
  },
]

export const GRUPOS_PEDIDO = [
  { id: 'criacao', nome: 'Criativos e páginas' },
  { id: 'campanhas', nome: 'Campanhas' },
  { id: 'outras', nome: 'Outro assunto' },
]

// Etapa final, igual para todos os tipos.
export const CAMPOS_FINAIS = [
  { k: 'prazo', tipo: 'data', label: 'Para quando você precisa?', curto: 'Prazo desejado', ajuda: 'Se tiver uma data limite, como o início de uma promoção, coloque aqui.' },
  { k: 'urgente', tipo: 'check', label: 'É urgente: está atrapalhando vendas ou atendimento agora', curto: 'Urgente' },
  { k: 'nome', tipo: 'texto', label: 'Seu nome', curto: 'Pedido por', obrigatorio: true, max: 80 },
  { k: 'contato', tipo: 'texto', label: 'Seu WhatsApp ou e-mail', curto: 'Contato', obrigatorio: true, max: 120, placeholder: 'Para o time tirar dúvida rápida, se precisar' },
]

export const TIPOS_PEDIDO_MAP = Object.fromEntries(TIPOS_PEDIDO.map((t) => [t.id, t]))

// ── Helpers ──────────────────────────────────────────────────────────────────

function has(lista, v) { return Array.isArray(lista) && lista.includes(v) }
export function resumir(s, n) { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1).trim()}…` : t }
const vazio = (v) => v == null || v === '' || v === false || (Array.isArray(v) && !v.length)
export const valorDe = (v, r) => (typeof v === 'function' ? v(r) : v)

/** Campos que aparecem agora para essas respostas (do tipo + finais). */
export function camposVisiveis(tipo, r, { finais = true } = {}) {
  const lista = [...(tipo?.campos || []), ...(finais ? CAMPOS_FINAIS : [])]
  return lista.filter((c) => !c.quando || c.quando(r))
}

export function numeroBR(s) {
  if (typeof s === 'number') return s
  const t = String(s || '').replace(/[^\d,.]/g, '')
  if (!t) return NaN
  // "3.000,50" e "3000,50" → 3000.5; "3.000" → 3000; "3000.5" → 3000.5
  if (t.includes(',')) return Number(t.replace(/\./g, '').replace(',', '.'))
  return /\.\d{3}$/.test(t) ? Number(t.replace(/\./g, '')) : Number(t)
}

export function dinheiroTexto(v, periodo) {
  const n = numeroBR(v)
  if (!Number.isFinite(n)) return ''
  const fmt = n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })
  return `${fmt} ${periodo === 'dia' ? 'por dia' : 'por mês'}`
}

export function telefoneTexto(v) {
  const d = String(v || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return String(v || '').trim()
}

export function dataTexto(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''))
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

/** Valor legível de uma resposta (revisão, descrição da tarefa e Intake). */
export function valorTexto(campo, v, r = {}) {
  if (vazio(v)) return ''
  const rot = (x) => campo.opcoes?.find((o) => o.v === x)?.label || x
  switch (campo.tipo) {
    case 'escolha': return rot(v)
    case 'multi': return (Array.isArray(v) ? v : [v]).map(rot).join(', ')
    case 'dinheiro': return dinheiroTexto(v, r[`${campo.k}_periodo`])
    case 'data': return dataTexto(v)
    case 'telefone': return telefoneTexto(v)
    case 'check': return v ? 'Sim' : ''
    default: return campo.k === 'contato' && !/@/.test(v) ? telefoneTexto(v) : String(v).trim()
  }
}

// ── Links ────────────────────────────────────────────────────────────────────

export function linkValido(s) {
  try { const u = new URL(String(s || '').trim()); return u.protocol === 'https:' || u.protocol === 'http:' } catch { return false }
}

/** Reconhece link do Google Drive/Docs. Devolve { id, natureza: 'pasta'|'arquivo'|'doc' } ou null. */
export function lerLinkDrive(s) {
  let u
  try { u = new URL(String(s || '').trim()) } catch { return null }
  const host = u.hostname.replace(/^www\./, '')
  if (host !== 'drive.google.com' && host !== 'docs.google.com') return null
  const pasta = /\/folders\/([\w-]{10,})/.exec(u.pathname)
  if (pasta) return { id: pasta[1], natureza: 'pasta' }
  const arq = /\/file\/d\/([\w-]{10,})/.exec(u.pathname)
  if (arq) return { id: arq[1], natureza: 'arquivo' }
  const doc = /\/(document|spreadsheets|presentation|forms)\/d\/([\w-]{10,})/.exec(u.pathname)
  if (doc) return { id: doc[2], natureza: 'doc' }
  const id = u.searchParams.get('id')
  if (id && /^[\w-]{10,}$/.test(id)) return { id, natureza: 'arquivo' }
  return null
}

// ── Validação (página e servidor) ────────────────────────────────────────────

/**
 * Erros por campo das respostas `r`. `drive` = { [k]: { publico: true|false|null } } com o
 * resultado da conferência; sem ele, o link do Drive só é checado no formato.
 */
export function validarPedido(tipo, r, { drive = {}, campos } = {}) {
  const erros = {}
  for (const c of campos || camposVisiveis(tipo, r)) {
    if (c.tipo === 'aviso') continue
    const v = r[c.k]
    const obrig = valorDe(c.obrigatorio, r)
    if (vazio(typeof v === 'string' ? v.trim() : v)) {
      if (obrig) erros[c.k] = c.tipo === 'escolha' || c.tipo === 'multi' ? 'Escolha uma opção.' : 'Preencha este campo.'
      continue
    }
    const s = typeof v === 'string' ? v.trim() : v
    if (c.max && String(s).length > c.max) erros[c.k] = `Use até ${c.max} caracteres.`
    else if (c.tipo === 'escolha' && !c.opcoes.some((o) => o.v === s)) erros[c.k] = 'Opção inválida.'
    else if (c.tipo === 'multi' && (!Array.isArray(s) || s.some((x) => !c.opcoes.some((o) => o.v === x)))) erros[c.k] = 'Opção inválida.'
    else if (c.tipo === 'numero' && (!Number.isInteger(Number(s)) || Number(s) < (c.min ?? 0) || Number(s) > (c.max ?? 1e9))) erros[c.k] = `Use um número de ${c.min ?? 0} a ${c.max}.`
    else if (c.tipo === 'dinheiro' && !(numeroBR(s) > 0)) erros[c.k] = 'Coloque um valor em reais.'
    else if (c.tipo === 'data' && !dataTexto(s)) erros[c.k] = 'Data inválida.'
    else if (c.tipo === 'telefone' && String(s).replace(/\D/g, '').length < 10) erros[c.k] = 'Coloque o número com DDD.'
    else if (c.tipo === 'link' && !linkValido(s)) erros[c.k] = 'Cole o link completo, começando com https://'
    else if (c.tipo === 'drive') {
      const ehDrive = !!lerLinkDrive(s)
      if (!ehDrive && !c.aceitaOutros) erros[c.k] = linkValido(s) ? 'Esse não é um link do Google Drive.' : 'Cole o link do Google Drive.'
      else if (!ehDrive && !linkValido(s)) erros[c.k] = 'Cole o link completo, começando com https://'
      else if (ehDrive && drive[c.k]?.publico === false) erros[c.k] = 'Esse link está fechado. Libere para "Qualquer pessoa com o link" e confira de novo.'
      else if (ehDrive && drive[c.k]?.existe === false) erros[c.k] = 'Não achei nada nesse link. Confira se copiou inteiro.'
    }
  }
  if (r.inicio && r.fim && dataTexto(r.inicio) && dataTexto(r.fim) && r.fim < r.inicio) erros.fim = 'Tem que ser depois do início.'
  if (r.contato && !/@/.test(r.contato) && String(r.contato).replace(/\D/g, '').length < 10) erros.contato = 'Coloque o WhatsApp com DDD ou um e-mail.'
  return erros
}

/**
 * Título, descrição (markdown da tarefa) e lista de respostas legíveis do pedido.
 * `drive` = { [k]: { publico, nome } } da conferência no servidor.
 */
export function montarPedido(tipo, r, { drive = {} } = {}) {
  const campos = camposVisiveis(tipo, r)
  const itens = []
  for (const c of campos) {
    if (c.tipo === 'aviso') continue
    const texto = valorTexto(c, r[c.k], r)
    if (!texto) continue
    const item = { k: c.k, label: c.curto || valorDe(c.label, r), valor: texto, tipo: c.tipo }
    if (c.tipo === 'drive' && drive[c.k]) item.drive = drive[c.k]
    itens.push(item)
  }
  const corpo = itens.filter((i) => !['nome', 'contato'].includes(i.k)).map((i) => {
    let linha = i.valor
    if (i.drive?.publico === true) linha += ` (aberto${i.drive.nome ? `: ${i.drive.nome}` : ''})`
    else if (i.drive && i.drive.publico !== false) linha += ' (não deu para conferir se está aberto)'
    return `**${i.label}:** ${linha.includes('\n') ? `\n${linha}` : linha}`
  })
  const quem = [r.nome, valorTexto(CAMPOS_FINAIS.find((c) => c.k === 'contato'), r.contato)].map((x) => String(x || '').trim()).filter(Boolean).join(' · ')
  const descricao = [`**Pedido do cliente pelo link: ${tipo.nome}**`, '', ...corpo, '', quem ? `Pedido por ${quem}` : ''].join('\n').trim()
  return { titulo: resumir(tipo.titulo(r), 200), descricao, itens, contato: quem }
}
