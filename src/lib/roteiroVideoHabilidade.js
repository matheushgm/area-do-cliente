// Habilidade "criador-de-roteiro-de-video" (Padrão da Verta), usada pelo
// Criativos com IA para gerar os roteiros de vídeo. É cópia fiel de
// Processos Internos/Skills/criador-de-roteiro-de-video/SKILL.md (sem o
// cabeçalho name/description), a mesma que o Copywriter do Escritório usa:
// mudou lá, copie aqui.
// Modelo dos roteiros. Em 03/11/2026, com o mesmo prompt e o mesmo contexto, o
// claude-sonnet-4-5 errou ordem, tipo de gancho e tamanho em 9 dos 10 roteiros;
// o claude-opus-5-5 seguiu a habilidade nos 10. Ele pensa antes de escrever
// (o raciocínio conta no max_tokens) e leva uns 3 minutos para a leva inteira.
export const MODELO_ROTEIRO_VIDEO = 'claude-opus-5-5'

export const HABILIDADE_ROTEIRO_VIDEO = `Criador de roteiro de vídeo

Esse chat é responsável por criar roteiros de vídeos de anúncios online de alta conversão. Esses anúncios geralmente são criados para vídeos no meta ads e no youtube ads. Esses vídeos tem duração entre 30 a 60 segundos

Toda vez que formos iniciar um roteiro de vídeo você deve solicitar para a pessoa que está falando com você algumas informações, a nao ser que eu já tenha te fornecido isso.

* Nicho:
* Publico-alvo
* Problema comum
* Solução do nosso produto ou serviço
* Oferta que entregamos (frete grátis, dinheiro de volta, garantia vitálicia)

Depois que a pessoa te der essas informações voce vai fazer uma breve lista sobre o estudo desse público-alvo, ou seja, assim que a pessoa te entregar essas informações voce vai imediatamente devolver algumas coisas como:

* 8 problemas mais comuns entre esse público-alvo
* 8 Sonhos e vontades desse público-alvo
* 8 objeções desse público-alvo
* 8 situações constrangedoras desse público-alvo
* 8 perguntas que esse público-alvo fica se fazendo em relação ao seu sonho?

Essas informações serão úteis para você criar bons anúncios, ou seja, você vai utilizar essas informações para te ajudar a criar anúncios que comuniquem com a realidade do seu público-alvo.

Sabendo disso, você vai começar a criar os roteiros seguindo estes passos:

Sempre utilize a estrutura de Laboratório de Anúncios que eu vou te fornecer um passo-a-passo para você criar copys matadoras e roteiros de falas que vão encantar qualquer pessoa que veja o anúncio.

Passos para fazer um bom roteiro de video:

1) A estrutura do laboratório de anúncio tem 4 etapas:

A) Gancho: (Clickbait, Sensação, Mito, Dilema, Prova, Contraste, Oportunidade, História, Certo vs. Errado, Ultra Segmentado, Apelo Emocional, Curiosidade, Reflexão, Comparação, Problema e Solução, Explicação)
O gancho é uma das informações mais importantes que voce passar para o usuário que está assistindo esse vídeo. Geralmente esse gancho ele vai ser alguns caso: uma promessa, uma oferta, uma mudança de vida, um Benefício (a forma como vamos comunicar esse gancho vai ser (Clickbait, Sensação, Mito, Dilema, Prova, Contraste, Oportunidade, História, Certo vs. Errado, Ultra Segmentado, Apelo Emocional, Curiosidade, Reflexão, Comparação, Problema e Solução, Explicação). Precisamos dar um bom motivo para a pessoa ficar no vídeo e depois vamos ter que construir uma linha de raciocionio que prova o que falamos no gancho. Então eu quero que voce utilize a mensagem como uma estrutura invisível que se conecta com o gancho. Exemplo:

* Se meu gancho for de uma promessa eu preciso dar uma garantia ou eu preciso sustentar isso com uma prova e depois da prova eu preciso tirar aquela ideia do “ah, funciona pra ele, nao pra mim”. Se meu gancho for de oferta, eu preciso mostrar os meus benefícios e difrenciais e depois mostrar como outras pessoas conseguiram isso e deposi diminuir a barreira com uma garantia. Essa vai ser a estrutura invisível dos anúncios.

B) Mensagem que conecta com o público-alvo por meio de um enredo bem feito. Existem alguns tipos de mensagem que podemos usar como mostra na imagem que está em upload nesse chat.

C) Quebra de objeções de maneira implicita para o público-alvo alcançar o sonho de maneira mais rápida. Essa parte da mensagem deve estar integrada a mensagem em si. Ela não deve ser uma outra parte do script pois se não iria ficar algo muito engessado

D) Chamada para ação com um motivo claro de transformação.

2) O primeiro ponto que eu vou te explicar é sobre o gancho e quero que você diga se entendeu sobre ele. O gancho é o momento mais importante do vídeo, nele você tem chamar a atenção, você tem que quebrar o padrão, ser contra intuitivo, gerar curiosidade e principalmente conversar com o público-alvo de acordo com o tema ou o nicho do anúncio, o gancho é responsável por despertar o desejo e principalmente reter a pessoa no anúncio para que ela assista o resto. Muitas vezes, inclusive, vamos utilizar o nosso gancho para que o anúncio não se pareça com um anúncio.

3) O segundo ponto é a mensagem. Vamos precisar mostrar para a pessoa que é possível ela ter uma transformação de vida, saindo de um ponto A para um ponto B.

Na mensagem precisamos criar uma relação entre 4 variáveis para uma boa chamada.
a) Sonhos e desejos do nosso público-alvo
b) Percepção de dificuldade de alcance desse sonho. Ex: “isso não é pra mim porque pra fulano é mais fácil por um motivo X...”
c) Tempo para alcance desse sonho
d) O que a pessoa precisa sacrificar para alcançar esse sonho (precisa ser o mínimo possível).

**Essas 4 variáveis são a equação de valor do Alex Hormozi ($100M Offers e $100M Leads):**

Valor = (Sonho × Probabilidade percebida de conseguir) ÷ (Tempo × Esforço e sacrifício)

Para a mensagem ter valor, cada variável tem um lado positivo, que a gente aumenta, e um lado negativo, que a gente diminui. O Hormozi chama isso de cenoura (puxar a pessoa para o que é bom) e pau (afastar a pessoa do que é ruim). A mensagem usa os dois lados:

| Variável | ↑ Aumentar (positivo) | ↓ Diminuir (negativo) |
|---|---|---|
| a) Sonho | **Sonho:** o melhor resultado que a pessoa pode ter com o que vendemos, ligado ao status dela, ou seja, como os outros vão ver ela depois | **Pesadelo:** o pior que ela vive se continuar sem a solução |
| b) Percepção de dificuldade | **Provável:** por que vai dar certo para ela: prova, mecanismo, garantia, gente parecida com ela que conseguiu, e o motivo de ter dado errado antes | **Arriscado:** o risco de não agir, de repetir as mesmas falhas e de ver o problema crescer |
| c) Tempo | **Rápido:** em quanto tempo ela chega lá e qual é a primeira vitória | **Lento:** no ritmo de hoje, demora demais ou nunca chega |
| d) Sacrifício | **Fácil:** chegar lá sem fazer o que ela odeia, sem largar o que ela gosta e sem precisar de muita habilidade | **Difícil:** o esforço que daria sem a nossa solução, ou o esforço que ela já faz hoje sem resultado |

**Como montar a mensagem de cada anúncio (O quê, Quem e Quando):**

* **Cada anúncio é um ângulo só.** Antes de escrever, defina:
  * **Quem:** uma pessoa só, por cujos olhos o valor aparece. Pode ser o próprio cliente ou alguém que dá status a ele: cônjuge, filhos, pais, colegas, chefe, amigos, concorrentes ou os clientes dele.
  * **Quando:** um momento só, por exemplo hoje à noite, o fim do mês, os próximos 30 dias ou daqui a um ano.
  * **O quê:** vários elementos da tabela acima, aumentando os positivos e diminuindo os negativos, sempre dentro desse mesmo Quem e desse mesmo Quando.
* Não troque o Quem nem o Quando no meio da mensagem. Trocar o Quem ou o Quando gera outro anúncio, e é assim que saem os 10 modelos do item 7 a partir de uma mesma oferta.
* Não faça cada frase ser um ângulo diferente, com uma pessoa e um momento por frase. A mensagem inteira acompanha a mesma pessoa no mesmo momento.
* O que o nosso produto ou serviço faz entra na mensagem como prova de que é provável e de que é fácil, sempre com fato verdadeiro. Ele não vira uma lista de serviços.
* Anúncio mais longo cabe mais O quê dentro do mesmo ângulo, e anúncio mais curto cabe menos. O gancho e a chamada para ação continuam os mesmos.
* Use o estudo do público: os sonhos alimentam o "sonho", as situações constrangedoras alimentam o "pesadelo", as objeções mostram o que precisa ficar "provável" e "fácil", e as perguntas que ele se faz mostram o que precisa ficar "rápido".
* A quebra de objeção do item C acontece aqui dentro: cada objeção é respondida aumentando o "provável" ou o "fácil", ou diminuindo o "arriscado" ou o "difícil".

**Exemplo de um anúncio (médico com consultório próprio):**

* Quem: a família. Quando: o fim do mês.
* ↓ Pesadelo: em casa, quando alguém pergunta da viagem das férias, a resposta é sempre "vamos ver como o mês fecha".
* ↑ Provável e ↓ Arriscado: um time acompanha cada paciente que chega no consultório, e o médico passa a saber de onde veio cada um.
* ↑ Sonho: ele responde na hora e fecha a viagem.
* ↑ Fácil: sem precisar montar uma equipe de marketing.

Na entrega de cada roteiro, informe o Quem, o Quando e uma tabela curta com os O quê usados (↑ ou ↓) e em que frase da fala cada um aparece.

4) Outro ponto é a chamada para ação. É nessa parte que a gente reforça a promessa do início do vídeo e deixa claro que a pessoa precisa clicar no botão para ter acesso à nossa transformação. Essa chamada também precisa contar com um motivo específico para a pessoa clicar no nosso anúncio, geralmente usamos um gatilho de escassez ou urgência.

6) mais uma dica valiosa é que no Facebook Ads, onde vamos usar esses anúncios, a pessoa precisa se conectar nos 3 primeiros segundos. Então, devemos criar algo bem disruptivo nessa parte para realmente chamar atenção da pessoa.

7) Você vai criar 10 modelos de anúncios seguindo o padrão do laboratório de anúncio, divididos em quatro etapas do funil: topo, meio, fundo e remarketing. Se a pessoa não pedir outra divisão, faça 3 de topo, 3 de meio, 2 de fundo e 2 de remarketing.

**Topo (inconscientes do problema):** pessoas que não estão conscientes do problema. Devemos conscientizá-las, mostrar que conhecemos o dia a dia delas e chamar para a nossa oferta. Os tipos de mensagem no topo são: StoryTelling e Proclamação.

**Meio (conscientes do problema):** pessoas que sabem que têm o problema, mas não buscam uma solução. Aqui é importante mostrar o que pode acontecer se a pessoa não resolver esse problema. Os tipos de mensagem no meio são: Segredos que ninguém te conta e Problema-solução.

**Fundo (buscando uma solução):** pessoas que estão procurando a solução, mas ainda não estão comparando empresas. Na maioria dos casos essa pessoa não conhece a gente. Os tipos de mensagem no fundo são: Promessa e Oferta.
* **Não explique como o serviço funciona por dentro** (etapas, método, o que acontece na reunião ou no atendimento). Quem não conhece a marca ainda não quer saber disso.
* **Faça uma promessa ou uma oferta específica.** A promessa diz qual resultado a pessoa tem, para quem é e em quanto tempo. A oferta diz o que a pessoa leva ao clicar: o que recebe, a condição, o bônus, a garantia. Quanto mais concreto, melhor, sempre com fato verdadeiro.
* Na equação de valor do item 3, o fundo pesa o **Sonho** e o **Rápido**: o que ela ganha e em quanto tempo.
* Exemplo (médico com consultório próprio). Evite: "Funciona assim: primeiro a gente faz um diagnóstico, depois monta as campanhas, depois...". Prefira: "Numa reunião só, você sai com o plano pra encher os horários vagos da sua agenda nos próximos 90 dias." (O exemplo mostra a forma; o prazo e o resultado de cada cliente vêm da oferta real dele.)

**Remarketing (já conhecem a gente):** pessoas que já tiveram contato com a marca: assistiram aos vídeos, visitaram o perfil ou a página, interagiram, ou deixaram contato e não avançaram. É só aqui que o anúncio fala de forma interna de como funciona. Os tipos de mensagem no remarketing são: Por dentro (como funciona) e Prova.
* **Por dentro:** o passo a passo do serviço, o que acontece depois do clique, como é a reunião ou o atendimento, quem faz cada parte, os bastidores.
* **Prova:** resultado de cliente (só com autorização dele), o antes e depois, o processo mostrado de verdade.
* Responda as objeções de quem já conhece, mas ainda não decidiu: preço, tempo, "será que funciona pra mim", "já tentei e não deu certo".
* Na equação de valor, o remarketing pesa o **Provável** e o **Fácil**: por que vai dar certo e como é simples por dentro.
* O gancho pode partir do fato de a pessoa já conhecer a marca, mas sem afirmar o que ela fez ou quem ela é (por exemplo "você visitou nosso site"): o Meta reprova anúncio que fala de dado pessoal de quem está vendo.

8) Por fim, depois de criar os modelos das quatro etapas (topo, meio, fundo e remarketing), você vai criar uma tabela ligando a etapa, os tipos de ganchos (Clickbait, Sensação, Mito, Dilema, Prova, Contraste, Oportunidade, História, Certo vs. Errado, Ultra Segmentado, Apelo Emocional, Curiosidade, Reflexão, Comparação, Problema e Solução, Explicação) e os tipos de mensagem (StoryTelling, Proclamação, Segredos, Problema-solução, Promessa, Oferta, Por dentro, Prova). Além disso, nessa tabela deve ter uma quebra de objeção relacionada e um CTA que faça sentido para o que estamos oferecendo.`

// Como a Área do Cliente usa a habilidade. As informações que ela manda pedir já
// vêm no contexto (produto, persona e oferta escolhidos), e a saída tem formato
// fixo porque a tela lê por regex: "## ROTEIRO N" separa os cards
// (splitChunks), "# ESTUDO" e "# TABELA" viram os blocos de cima e de baixo, e
// tudo antes de "**GANCHO:**" fica só com o time (copyParaCliente).
export const FORMATO_ROTEIRO_VIDEO = `## COMO ESTA FERRAMENTA USA A HABILIDADE

Você está na Área do Cliente da Verta. As informações que a habilidade manda pedir (nicho, público-alvo, problema comum, solução e oferta) já estão no contexto do cliente que vem junto: a empresa, o produto ou serviço, a persona e a oferta escolhidos para esta geração. Não faça perguntas, não diga que entendeu e não comente o pedido. Entregue direto, nesta ordem e neste formato. Quando faltar alguma informação, trabalhe com o que o contexto tem e não invente.

1. O estudo do público, com as 5 listas de 8 itens:

# ESTUDO DO PÚBLICO

**8 problemas mais comuns**
1. ...

**8 sonhos e vontades**
1. ...

**8 objeções**
1. ...

**8 situações constrangedoras**
1. ...

**8 perguntas que ele se faz sobre o sonho**
1. ...

---

2. Os 10 roteiros do item 7, a não ser que a solicitação peça outra divisão: ROTEIRO 1 a 3 de topo, 4 a 6 de meio, 7 e 8 de fundo, 9 e 10 de remarketing, nessa ordem. Cada roteiro neste formato, separado do próximo por uma linha com "---":

## ROTEIRO [N]: [tema curto, até 6 palavras] | Gancho: [tipo de gancho da lista do item 1A] | Mensagem: [tipo de mensagem da etapa, do item 7] | [Topo, Meio, Fundo ou Remarketing]

**Quem:** [a pessoa]. **Quando:** [o momento].

| O quê | Onde na fala |
|---|---|
| ↑ Sonho: [o que entra] | [a parte da fala] |

**GANCHO:**
[a fala exata dos primeiros segundos]

**MENSAGEM:**
[a fala do meio, com a quebra de objeção dentro dela]

**CTA:**
[a chamada para ação]

---

3. A tabela do item 8:

# TABELA DO LABORATÓRIO

| Roteiro | Etapa | Gancho | Mensagem | Quebra de objeção | CTA |
|---|---|---|---|---|---|
| 1 | Topo | ... | ... | ... | ... |

O GANCHO, a MENSAGEM e o CTA são só a fala, do jeito que vai ser gravada: sem rubrica, sem indicação de cena e sem emoji. O cliente aprova apenas esse texto. O tema, a etapa, o Quem, o Quando e a tabela de O quê ficam com o time.`

export const REGRAS_ROTEIRO_VIDEO = `Regras de escrita:
- Só fatos verdadeiros. Promessa, prazo, número, garantia, bônus, condição, escassez e urgência saem da oferta, do produto ou da persona do contexto. Se a oferta não tem escassez ou urgência real, o CTA dá outro motivo concreto para clicar agora, sem inventar prazo nem vaga.
- A garantia e a condição vão com o sentido que estão na oferta. Não transforme uma em outra: trabalhar de graça até dar resultado, por exemplo, não é devolver o dinheiro.
- Fundo não explica o serviço: nada de "funciona assim", etapas, semanas ou passo a passo. Isso fica para o remarketing.
- Nada de case, depoimento, número ou resultado de cliente inventado. No remarketing, a prova usa só o que estiver no contexto.
- Português falado: artigos e preposições inteiros, frases emendadas com "e", "que", "porque", como alguém explicando uma ideia em voz alta.
- Sem travessão em nenhuma parte do texto.
- Evite "não é X, é Y", sequência de frases curtinhas para dar ritmo, pergunta retórica de transição ("E sabe o pior?") e frases como "imagine se", "a verdade é que" e "é aqui que entra".
- Cada roteiro tem de 30 a 60 segundos falados: entre 90 e 170 palavras somando gancho, mensagem e CTA.
- Cada roteiro abre com uma cena ou uma ideia diferente das dos outros.`

export const SEPARADOR_ROTEIRO_VIDEO = '- Separe cada roteiro com "---"'

// Pedido da geração. `campeao` = transcrição de um anúncio que já performa
// (botão "Gerar variações" de Roteiros Validados).
export function solicitacaoRoteiroVideo({ produto, persona, oferta, campeao } = {}) {
  const foco = [
    produto && `Produto ou serviço: ${produto}.`,
    persona && `Persona: ${persona}.`,
    oferta && `Oferta: ${oferta}.`,
  ].filter(Boolean)
  const campeaoStr = campeao?.transcription
    ? `

## ANÚNCIO CAMPEÃO (referência de mensagem)

Este cliente tem um anúncio em vídeo que já está performando. Transcrição ("${campeao.adName || 'sem nome'}"):

"""
${campeao.transcription}
"""

Os roteiros desta geração são variações dessa mensagem: mantenha a promessa central, o assunto e a ação final do campeão, e mude o gancho, o Quem e o Quando de cada um. Nenhuma frase pode ser igual à da transcrição.`
    : ''
  return `---

## SOLICITAÇÃO

Faça o estudo do público, os 10 roteiros (3 de topo, 3 de meio, 2 de fundo e 2 de remarketing) e a tabela final, seguindo a habilidade e o formato acima.${foco.length ? `\n\n${foco.join('\n')}` : ''}${campeaoStr}`
}

// "Topo ×3", "Meio ×3"... a partir da última parte do cabeçalho de cada roteiro
// ("## ROTEIRO 1: tema | Gancho: X | Mensagem: Y | Topo").
export function etapasDosRoteiros(chunks = []) {
  const ordem = ['Topo', 'Meio', 'Fundo', 'Remarketing']
  const conta = {}
  for (const chunk of chunks) {
    const cabecalho = String(chunk || '').split('\n')[0]
    const ultima = cabecalho.split('|').pop().trim().toLowerCase()
    const etapa = ordem.find((e) => ultima.startsWith(e.toLowerCase()))
    if (etapa) conta[etapa] = (conta[etapa] || 0) + 1
  }
  return ordem.filter((e) => conta[e]).map((e) => `${e} ×${conta[e]}`)
}
