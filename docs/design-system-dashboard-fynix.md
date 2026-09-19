# Dashboard de Tráfego, novo visual (tema "Fynix")

> **2026-09-19:** a paleta verde-lima da referência foi trocada pelo azul da marca Revenue Lab a pedido do Matheus. Os nomes das variáveis CSS (`--fx-lime`, `--fx-green`) continuam os mesmos.

Piloto de redesign da **página de cliente** do Dashboard de Tráfego (viewer em
`public/dash-teste/viewer.html`), baseado no projeto
[AI Finance Management SaaS Dashboard](https://www.behance.net/gallery/234937291/AI-Finance-Management-SaaS-UX-UI-DashboardDesign)
(Behance, marca fictícia "Fynix").

**Estado:** desde 2026-09-19 o tema entra na página de **todas as contas**
(`newLookFor = () => true` no viewer), inclusive nos links públicos. Só a lista
da home segue no visual antigo. Para voltar a restringir, trocar `newLookFor`
por um `Set` de nomes de conta (coluna `account` de `dash_insights`), como era
no piloto (só Matheus Business, 18/09).

## Onde mora

| Arquivo | O que faz |
|---|---|
| `public/dash-teste/vendor/theme-fynix.css` | Todo o tema. Escopado em `body.th-fynix` e `.dt-root.th-fynix`; nada vaza para fora dessas classes. |
| `public/dash-teste/viewer.html` (bloco "Novo visual") | `newLookFor()`, `setNewLook()` (liga/desliga as classes e injeta a fonte), `ic()` (emoji → ícone de linha), `pal()` + `limeGradient` + `fxLegend` (gráficos), `kpiGridHTML()` (hero + cards de KPI). |

Como o viewer é a mesma página para todas as contas, o tema é ligado e desligado
em tempo de execução: `renderClient()` chama `setNewLook(newLookFor(client))` e
`render()` (home) chama `setNewLook(false)`. A fonte Urbanist (Google Fonts) só é
pedida quando o tema entra, então as outras contas e o link público continuam
sem nenhuma dependência de terceiro. Quando a fonte termina de carregar, os
gráficos abertos são redesenhados (`redrawChartsWhenFontLoads`).

## Paleta

### Da prancha de cores do projeto

| Papel | Hex | Uso no dashboard |
|---|---|---|
| Azul de ação (Revenue Lab) | `#154490` | Card hero do investido (texto branco), botão "Link", sublinhado das abas, barras "Atual", preenchimento das barras de progresso |
| Navy (Revenue Lab) | `#020027` | Títulos, valores, botão ativo do período, série "anterior" dos gráficos |
| Cinza | `#7B7B7B` | Texto secundário. No tema entra como `#6F6F6F`: o cinza da prancha rende 4,2:1 sobre branco e o texto vai a 11 px, então foi escurecido para passar de 4,5:1 |
| Branco | `#FFFFFF` | Cards |

### Derivados para o tema (medidos nas telas, não na prancha)

| Papel | Hex | Uso |
|---|---|---|
| Azul 2 / Azul 3 | `#2F6BD4` / `#123C86` | Linhas de gráfico sobre branco / links e hover do botão primário |
| Azul suave | `#E5EDFB` | Fundo dos círculos de ícone, filtros ativos, trilho das barras de progresso |
| Verde suave | `#EAF8DF` / `#EEF9E6` | Pílulas positivas e status ATIVO (semântico, não é cor de marca) |
| Fundo | `#F2F3F4` | Fundo da página |
| Superfície 2 | `#F7F8F9` | Cabeçalho de tabela e áreas internas |
| Borda | `#E7E9EB` / `#EEF0F2` | Cards / divisórias internas |
| Positivo | `#2E8B3D` sobre `#EAF8DF` | Variações boas, "dentro da meta" |
| Negativo | `#D64545` sobre `#FDECEC` | Variações ruins, alertas de gasto sem resultado |
| Atenção | `#B8780E` sobre `#FFF4DB` | CPL entre o alvo e +30 %, status "outro" |

## Tipografia

Urbanist (Google Fonts), pesos 400 a 700. É a fonte geométrica das telas da
referência (a prancha lista Space Grotesk, Urbanist e Plus Jakarta Sans; as telas
usam Urbanist). Cabeçalhos de tabela em peso 500 e 11 px, caixa normal (a
referência usa cabeçalho leve, sem caixa alta). Números das tabelas com
`tabular-nums`.

## Forma e componentes

- Cards brancos, raio 16 px, borda de 1 px e sombra bem leve. O hero lima tem a
  mesma elevação dos vizinhos (sem brilho ao redor), como o "Total Balance" da
  referência.
- **Botões, filtros e inputs com raio 10 px** (retângulo arredondado, como os
  dropdowns "This Month" e o "Download" da referência). Pílula (raio 999) só nos
  chips do hero, nas variações e nas pílulas de meta/pace. Primário = lima com
  texto verde-escuro; ativo/escuro = verde-escuro com texto branco; neutro =
  branco com borda.
- **Hero de KPI** (o card "Total Balance"): investido do período sobre lima, com
  dois anéis translúcidos decorativos e chips com o período anterior e a variação.
- **Cards de KPI** com ícone em círculo lima-suave, rótulo cinza, valor grande
  em verde-escuro e variação em pílula.
- Abas com sublinhado lima de 3 px; sub-abas idem.
- Tabelas com cabeçalho cinza-claro leve, status como etiqueta arredondada de
  8 px (verde sobre verde-claro para ATIVO, cinza para PAUSADO), linha com hover
  suave.
- Barras de progresso (funil Lead → MQL, tarefas do ClickUp): preenchido em
  verde-escuro sobre trilho lima, como o "Finance Score" da referência.
- Gráficos: investimento em linha lima-3 com degradê lima embaixo e o período
  anterior em verde-escuro fino tracejado; conversões em **barras** (atual lima,
  anterior cinza) como o gráfico de fluxo da referência; legenda com quadradinho
  arredondado sólido e rótulo verde-escuro, alinhada à direita; sem linhas
  verticais de grade.
- Emojis dos rótulos (abas, botões, filtros, títulos dos cards de IA e de
  Parâmetros, modais) trocados por ícones de linha (traço, estilo Lucide)
  embutidos como SVG. O 🏆 da melhor campanha e o 🚨 de gasto sem resultado
  ficam: são marcadores de dado, não decoração.

## Grade dos KPIs por largura

| Largura do iframe | Layout |
|---|---|
| > 1450 px | hero + 5 cards numa linha |
| 1024 a 1450 px | hero na linha inteira, 5 cards embaixo |
| 769 a 1023 px | hero, depois 3 cards e 2 cards mais largos |
| ≤ 768 px | hero, cards em 2 colunas (o último ocupa a linha) |

## O que NÃO mudou

- Estrutura da página (KPIs, período, abas Resultados/Campanhas/Atividades/
  Parâmetros, quadrantes, drill campanha → conjunto → anúncio, Análise IA) e
  toda a lógica de dados.
- Visual da home e das demais contas. As únicas mudanças fora do tema foram
  trocar estilos inline por classes com os **mesmos valores** (para o tema poder
  sobrescrevê-los) e uma correção de formatação no plano de ação da Análise IA
  (o CPL alvo saía como `R$ 22.727272…`; agora `R$ 22,73`, em todas as contas).
