# Checklist da tradução (português → inglês)

Começou em 09/11/2026. Última atualização: 09/11/2026 (ondas 0 a 2 completas; onda 3 parcial). Como o i18n funciona está no `CLAUDE.md`, seção "Idioma".

## Como usar

- Cada linha é um arquivo com texto de interface. O `~N` é uma **estimativa** de quantos textos em português ainda
  restam nele, contada por `node scripts/i18n_inventario.mjs` (pega texto entre tags e strings com cara de frase,
  então tem algum ruído).
- Ao traduzir um arquivo: troque os textos por `t('…')`, crie as chaves no namespace da tela
  (`src/i18n/locales/pt/<ns>.js` e `src/i18n/locales/en/<ns>.js`, mesmas chaves nos dois; reaproveite `comum`), confira com `node scripts/i18n_inventario.mjs --arquivo <arquivo>` (deve sobrar só o que não é interface) e
  marque `[x]` aqui, no mesmo commit.
- Datas e números: troque o `'pt-BR'` cravado pelo `locale` do `useI18n()`. Moeda continua em reais.
- Uma onda só fecha depois de abrir as telas dela em inglês e procurar o que sobrou em português.
- Nunca traduza valor gravado ou comparado (option value, id, texto salvo no banco): só o rótulo exibido. Os
  helpers `rotulo*` de `src/lib/constants.js` traduzem os valores das constantes de domínio.
- Fora do escopo: rotas `/dev/*` e o texto dos prompts (o prompt fica em português; a resposta segue o idioma,
  ver "Decisões").
- As regras que os tradutores seguiram nas ondas 0 e 1 estão em "Regras para traduzir", no fim deste arquivo:
  vale reaproveitar nas próximas ondas.

## Resumo

| Onda | O quê | Arquivos | Situação | Textos restantes (~) |
|---|---|---:|---|---:|
| 0 | Base, shell e UI compartilhada | 19 | ✅ 09/11/2026 | 0 |
| 1 | Telas internas fora do cliente e do VertaTask | 42 | ✅ 09/11/2026 (falta `roteirosExpress.js`, ver 1.5) | 35 |
| 2 | VertaTask (tarefas, sprints, atividades; o Chat sai) | 83 | ✅ 09/11/2026 | 0 |
| 3 | Página do cliente e módulos | 133 | 🟡 parcial (09/11/2026): moldura, menu e hub (3.1), Kickoff, Produto/Serviço, Personas e ROI (33 de 133 arquivos) | 2.858 |
| 4 | Páginas públicas (portal, formulários, aprovações) | 30 | | 905 |
| 5 | Dashboard de Tráfego | 6 | | 829 |
| 6 | PDFs, mensagens das funções `/api/*`, helpers | 75 | 🟡 PDFs de ROI, metas, Personas e Produto | 996 |

A preferência de idioma fica no perfil (`profiles.idioma`, migration 130) e vale para as ondas 0 a 3 e 5; as
páginas públicas não têm login e seguem a regra da 4.0.

## Decisões (09/11/2026)

- [x] **Idioma das páginas públicas** (4.0): `?lang=` no link → escolha salva no navegador → idioma do navegador →
      português, com seletor PT | EN na própria página.
- [x] **Mensagens das funções `/api/*`** (6.2): a tela manda o idioma e a função responde traduzida. Já pronto na
      base: `apiFetch` e `streamClaude` mandam `X-Idioma`; em `api/_http.js`, `idiomaDe(req)` e
      `msg(req, { pt, en })`. Falta usar em cada função (6.2) e nas páginas públicas, que não passam pelo `apiFetch`.
- [x] **Texto gerado pela IA** segue o idioma de quem gera: `instrucaoDeIdioma()` de `src/lib/claude.js`,
      concatenado ao `system`. **Não é automático**: muitas telas leem a saída por regex em rótulos em português
      (`# DOR`, `**GANCHO:**`, `## ROTEIRO`…), e ligar sem adaptar a leitura quebra a tela. Cada módulo liga quando a
      leitura aceitar os dois idiomas. Ligado em: Roteiros Express (interno, com `{ rotulos: true }`: os rótulos do formato também saem em inglês) e wireframes do Banco de LP/LP (rótulos e chaves do JSON ficam como estão). Testado em 09/11/2026: o Roteiros gerou os 2 cards em inglês, com HOOK/MESSAGE/POST CAPTION.
      O refino de um texto existente (`refinarMarkdown`) mantém o idioma do texto.
- [x] **Conteúdo editorial** (ADS Roadmap, playbook): traduzido junto. Para as próximas ondas (perguntas do
      Kickoff, webinar), seguir o mesmo.
- [x] **`src/components/DashboardTrafego/*`**: apagado.



## Onda 0 — Base

### 0.1 Base

- [x] `src/i18n/index.js`
- [x] `src/i18n/pt.js`
- [x] `src/i18n/en.js`

### 0.2 Shell e globais

- [x] `src/components/AppSidebar.jsx`
- [x] `src/pages/Login.jsx`
- [x] `src/components/UI/RouteFallback.jsx`
- [x] `src/components/NotificationCenter.jsx`
- [x] `src/components/OtimizacoesBridge.jsx`
- [x] `src/context/AppContext.jsx`

### 0.3 UI compartilhada

- [x] `src/components/UI/AnexoPreview.jsx`
- [x] `src/components/UI/ObservacoesCampo.jsx`
- [x] `src/components/UI/PercentInput.jsx`
- [x] `src/components/UI/ResizeHandle.jsx`
- [x] `src/components/Editor/FloatingToolbarPlugin.jsx`
- [x] `src/components/Editor/MarkdownEditor.jsx`
- [x] `src/components/Editor/TextoEditavelIA.jsx`
- [x] `src/components/VideoGuide.jsx`
- [x] `src/components/RatingSelector.jsx`
- [x] `src/components/Criativos/MarkdownBlock.jsx`
- [x] `src/components/Editor/MarkdownView.jsx`
- [x] `src/components/Editor/LexicalMarkdownEditor.jsx`
- [x] header `X-Idioma` e `instrucaoDeIdioma()` em `src/lib/api.js` e `src/lib/claude.js` (6.3)
- [x] `api/_http.js` (`idiomaDe`, `msg`)

## Onda 1 — Telas internas

### 1.1 Home `/` (lista de clientes e crescimento)

- [x] `src/pages/Dashboard.jsx`
- [x] `src/components/Dashboard/Crescimento.jsx`
- [x] `src/components/Dashboard/OtimizacoesBanner.jsx`
- [x] `src/components/Dashboard/UnsignedAtaPopups.jsx`
- [x] `src/lib/dashboardCounts.js`
- [x] `src/lib/growth.js`
- [x] `src/lib/constants.js`
- [x] `src/lib/utils.js`

### 1.2 Otimizações `/otimizacoes`

> `playbookSugestoes.js` é copiado para o viewer do Dashboard (`scripts/sync-playbook-vendor.mjs`): traduzir só na origem.
> Os textos ficam em `src/lib/playbookTextos.js` (sem imports, copiado junto), e o idioma vem de
> `localStorage.rl_lang`. `chave`, `tipo` e `prioridade` continuam em português (são gravados). Decisão antiga mostra
> o texto salvo no `payload` (português).

- [x] `src/pages/Otimizacoes.jsx`
- [x] `src/components/ProjetoHub/SugestoesPlaybook.jsx`
- [x] `src/lib/playbookSugestoes.js`
- [x] `src/lib/otimizacoesLeigo.js`
- [x] `src/lib/aceitarSugestao.js`
- [x] `src/hooks/useSugestoesGlobais.js`
- [x] `src/lib/playbookTextos.js` (novo)

### 1.3 Gestão de usuários `/usuarios`

- [x] `src/pages/UserManagement.jsx`

### 1.4 Novo cliente `/cliente/novo`

- [x] `src/pages/NewOnboarding.jsx`

### 1.5 Ferramentas e biblioteca

> `roteirosExpress.js` (perguntas e mensagens de erro) só aparece em português na página pública
> `/roteiros/:token`: fica para a onda 4.4. A tela interna traduz as perguntas no componente.
> `site-plataforma/index.html` tem um mini-i18n próprio (`data-i18n`, dicionário no `<script>`, lê `rl_lang`):
> se o HTML for regerado fora do app, refaça a marcação.
> ADS Roadmap: o conteúdo em inglês fica em `src/lib/adsRoadmap.en.js`, na mesma estrutura do `.js` (mudou um, mude o
> outro). Faixa de verba que só existe na página do ClickUp aparece com a tabela em português.
> O PDF da Calculadora de ROI (`exportPDF.js`) ainda é português: onda 6.1.

- [x] `src/pages/Atividades15min.jsx`
- [x] `src/pages/RoteirosExpress.jsx`
- [ ] `src/lib/roteirosExpress.js` — ~35
- [x] `src/pages/FunilCanvas.jsx`
- [x] `src/pages/CalculadoraROI.jsx`
- [x] `src/components/ROICalculator.jsx`
- [x] `src/pages/SitePlataforma.jsx`
- [ ] `src/pages/FerramentaPrecificacao.jsx` — ~3 (nova em 09/11/2026: iframe de `public/ferramentas/precificacao/index.html`, que precisa de mini-i18n como o do Site da Plataforma)
- [ ] `public/ferramentas/precificacao/index.html`
- [x] `public/ferramentas/site-plataforma/index.html`
- [x] `src/pages/BancoDeAnuncios.jsx`
- [x] `src/pages/BancoDeLPs.jsx`
- [x] `src/components/Wireframes/AplicacaoWireframe.jsx`
- [x] `src/components/Wireframes/SaasWireframe.jsx`
- [x] `src/components/Wireframes/VSLWireframe.jsx`
- [x] `src/components/Wireframes/WebinarWireframe.jsx`
- [x] `src/components/Wireframes/aplicacaoGenerate.js`
- [x] `src/components/Wireframes/aplicacaoSchema.js`
- [x] `src/components/Wireframes/index.js`
- [x] `src/components/Wireframes/saasGenerate.js`
- [x] `src/components/Wireframes/saasSchema.js`
- [x] `src/components/Wireframes/vslGenerate.js`
- [x] `src/components/Wireframes/vslSchema.js`
- [x] `src/components/Wireframes/webinarGenerate.js`
- [x] `src/components/Wireframes/webinarSchema.js`
- [x] `src/pages/AdsRoadmap.jsx`
- [x] `src/lib/adsRoadmap.js`
- [x] `src/lib/adsRoadmap.en.js` (novo)
- [x] `src/pages/SquadsReport.jsx`

## Onda 2 — VertaTask

> Valores que vêm do ClickUp (status, tipo de tarefa, dificuldade, departamento, nomes de pasta, lista e view) são
> dados: o valor não muda e a tela traduz os conhecidos por `rotuloStatus`, `rotuloPrioridade`, `rotuloTipoTarefa`,
> `rotuloDificuldade` e `rotuloDepartamento` de `src/lib/tarefas.js`. Em português eles mostram o valor como veio.
> O que vai para o ClickUp pela outbox (título padrão "Nova tarefa", nome "Sprint N"…) continua em português.
> View padrão sem nome digitado mostra o rótulo traduzido; o `nome` gravado continua em pt.

### 2.1 VertaTask: moldura e tarefas

- [x] `src/pages/Tarefas.jsx`
- [x] `src/components/Tarefas/TarefasSidebar.jsx`
- [x] `src/components/Tarefas/AreaTarefas.jsx`
- [x] `src/components/Tarefas/BarraViews.jsx`
- [x] `src/components/Tarefas/BarraSelecao.jsx`
- [x] `src/components/Tarefas/ListaView.jsx`
- [x] `src/components/Tarefas/QuadroView.jsx`
- [x] `src/components/Tarefas/Calendario.jsx`
- [x] `src/components/Tarefas/CalendarioView.jsx`
- [x] `src/components/Tarefas/GanttLista.jsx`
- [x] `src/components/Tarefas/GanttView.jsx`
- [x] `src/components/Tarefas/ColunasLista.jsx`
- [x] `src/components/Tarefas/PainelFiltros.jsx`
- [x] `src/components/Tarefas/PainelView.jsx`
- [x] `src/components/Tarefas/Campos.jsx`
- [x] `src/components/Tarefas/Confirmacao.jsx`
- [x] `src/components/Tarefas/TarefaPanel.jsx`
- [x] `src/components/Tarefas/TarefaExtras.jsx`
- [x] `src/components/Tarefas/SecoesTarefa.jsx`
- [x] `src/components/Tarefas/RelacaoCampo.jsx`
- [x] `src/components/Tarefas/NovaTarefaPanel.jsx`
- [x] `src/components/Tarefas/EntregaPainel.jsx`
- [x] `src/components/Tarefas/ModelosMenu.jsx`
- [x] `src/lib/tarefas.js`
- [x] `src/lib/viewsTarefas.js`
- [x] `src/lib/filtrosTarefas.js`
- [x] `src/lib/cascata.js`
- [x] `src/lib/gantt.js`
- [x] `src/lib/buscaRelacao.js`
- [x] `src/hooks/useTarefas.js`
- [x] `src/hooks/useCascata.js`
- [x] `src/hooks/useBuscaRelacao.js`
- [x] `src/hooks/useBloqueios.js`

### 2.2 VertaTask: Intake, Cycles, Templates, Pages, Analytics, Sincronização

- [x] `src/components/Tarefas/IntakeView.jsx`
- [x] `src/components/Tarefas/CiclosView.jsx`
- [x] `src/components/Tarefas/TemplateEditor.jsx`
- [x] `src/components/Tarefas/TemplatesView.jsx`
- [x] `src/components/Tarefas/AplicarTemplateView.jsx`
- [x] `src/components/Tarefas/PaginasView.jsx`
- [x] `src/components/Tarefas/AnalyticsView.jsx`
- [x] `src/components/Tarefas/SincronizacaoView.jsx`
- [x] `src/lib/vertatask.js`
- [x] `src/lib/templates.js`
- [x] `src/lib/rascunhoTemplate.js`
- [x] `src/lib/sincronizacao.js`
- [x] `src/hooks/useVertaTask.js`
- [x] `src/hooks/usePaginas.js`
- [x] `src/hooks/useSincronizacao.js`

### 2.3 VertaTask: Sprints

- [x] `src/components/Tarefas/SprintAcompanhar.jsx`
- [x] `src/components/Tarefas/SprintBacklog.jsx`
- [x] `src/components/Tarefas/SprintComum.jsx`
- [x] `src/components/Tarefas/SprintFechar.jsx`
- [x] `src/components/Tarefas/SprintMetas.jsx`
- [x] `src/components/Tarefas/SprintPlanejar.jsx`
- [x] `src/components/Tarefas/SprintsView.jsx`
- [x] `src/lib/sprints.js`
- [x] `src/hooks/useSprints.js`

### 2.4 VertaTask: Atividades (capacidade do time)

- [x] `src/components/Atividades/AtividadePanel.jsx`
- [x] `src/components/Atividades/AtividadesModulo.jsx`
- [x] `src/components/Atividades/CargaDiaria.jsx`
- [x] `src/components/Atividades/ConfigModal.jsx`
- [x] `src/components/Atividades/IssueList.jsx`
- [x] `src/components/Atividades/KpiStrip.jsx`
- [x] `src/components/Atividades/NovaAtividadePanel.jsx`
- [x] `src/components/Atividades/PersonPanel.jsx`
- [x] `src/components/Atividades/PlannerFloat.jsx`
- [x] `src/components/Atividades/RelatorioConcluidas.jsx`
- [x] `src/components/Atividades/TeamHeatLine.jsx`
- [x] `src/components/Atividades/TeamTable.jsx`
- [x] `src/lib/atividadesCarga.js`
- [x] `src/lib/atividadesConcluidas.js`
- [x] `src/hooks/usePlanejador.js`
- [x] `src/hooks/useCargaTime.js`
- [x] `src/hooks/useConcluidas.js`

### 2.5 VertaTask: Chat — fora do escopo

> O Chat vai ser removido (decisão de 09/11/2026): não traduzir. Só o rótulo "Chat" da coluna esquerda é traduzido.

- [–] `src/components/Chat/ChatMarkdown.jsx`
- [–] `src/components/Chat/ChatModulo.jsx`
- [–] `src/components/Chat/ChatSidebar.jsx`
- [–] `src/components/Chat/Composer.jsx`
- [–] `src/components/Chat/MessageList.jsx`
- [–] `src/components/Chat/NovoDialogs.jsx`
- [–] `src/components/Chat/ThreadPanel.jsx`
- [–] `src/lib/chat.js`
- [–] `src/hooks/useChat.js`

## Onda 3 — Página do cliente

> **09/11/2026: feito só o que o dono pediu primeiro**: Kickoff, Produto/Serviço, Personas e Cenários de ROI (mais a
> Calculadora de ROI da onda 1), com os PDFs deles em `exportPDF.js` (`exportROIPDF`, `exportMetasSemanaisPDF`,
> `exportPersonasPDF`, `exportProdutoServicoPDF`). A moldura do cliente (cartão, menu, hub) e os outros módulos ficam
> para depois. Depois, no mesmo dia, entrou a moldura inteira (3.1: coluna esquerda, menu, hub, Modo Apresentação).
> Os módulos que o menu abre e ainda não foram traduzidos (Cadastro, Oferta, Resultados…) continuam em português.
> Uma rodada anterior desta onda foi interrompida e revertida; o trabalho parcial não foi aproveitado.
> - As perguntas de `KickoffQuestions.js`, Produto e Persona viraram getters que chamam `t()` na leitura (o portal e
>   a Central também recebem traduzido). O que é **gravado** (`stageLabel`, `nextSteps`, `verdictLabel`) e os
>   **prompts** usam o texto em pt: por isso `KickoffQuestions.js`, `ProdutoServicoModule.jsx` e `PersonaCreator.jsx`
>   importam o dicionário pt direto (`locales/pt/…`), exceção à regra.
> - IA: análise do Kickoff e briefing do Produto seguem o idioma (`{ rotulos: true }`). **Personas continuam gerando
>   em português**: o `generatedProfile` é lido por regex (`PRINCIPAIS DORES`, `- Dor:`, `- Nome:`) em
>   `CriativosModule.parseDores` e em `api/criativos-public.js`; ligar exige adaptar os dois.
> - A pontuação de respostas livres do Kickoff usa regex em português: resposta digitada em inglês pontua menos.

### 3.1 Página do cliente: moldura e hub

> `ClientProfile.jsx` tem também a seção Dados (`OnboardingContent`), o `OnboardingEditForm` e o `ProjectDocs`.

- [x] `src/pages/ProjectDetail.jsx`
- [x] `src/pages/ClientProfile.jsx`
- [x] `src/components/ProjetoHub/HubCentro.jsx`
- [x] `src/components/ProjetoHub/HubInformacoes.jsx`
- [x] `src/components/ProjetoHub/MenuCliente.jsx`
- [x] `src/components/ProjetoHub/ModulosMenu.jsx`
- [x] `src/components/ProjetoHub/NovaTarefaClickUpModal.jsx`
- [x] `src/components/ProjetoHub/RegistroModal.jsx`
- [x] `src/components/ProjetoHub/ResumoHub.jsx`
- [x] `src/components/Tarefas/TarefasDoCliente.jsx`
- [x] `src/components/ModoApresentacao/ModoApresentacao.jsx`
- [x] `src/components/Debriefing/PendingAdsBanner.jsx`
- [x] `src/lib/clientSections.js`
- [x] `src/lib/resumoProjeto.js`
- [x] `src/hooks/useProjetoHub.js`
- [x] `src/hooks/useApresentacaoTarefas.js`

### 3.2 Cliente › Cadastro

- [ ] `src/components/BancoMidiaModule.jsx` — ~22
- [ ] `src/components/LinksModule.jsx` — ~11
- [ ] `src/components/AnexosModule.jsx` — ~12
- [ ] `src/components/CompartilhamentoModule.jsx` — ~32
- [ ] `src/lib/portalModules.js` — ~11

### 3.3 Cliente › Estratégia

- [x] `src/components/Kickoff/KickoffAIAnalysisPanel.jsx`
- [x] `src/components/Kickoff/KickoffAnswersModal.jsx`
- [x] `src/components/Kickoff/KickoffFunnelRecommendations.js`
- [x] `src/components/Kickoff/KickoffFunnelRecommendationsPanel.jsx`
- [x] `src/components/Kickoff/KickoffModule.jsx`
- [x] `src/components/Kickoff/KickoffOfertaMatadora.js`
- [x] `src/components/Kickoff/KickoffOfertaMatadoraPanel.jsx`
- [x] `src/components/Kickoff/KickoffPillarBars.jsx`
- [x] `src/components/Kickoff/KickoffQuestionForm.jsx`
- [x] `src/components/Kickoff/KickoffQuestions.js`
- [x] `src/components/Kickoff/KickoffRadar.jsx`
- [x] `src/components/Kickoff/KickoffResultView.jsx`
- [x] `src/components/Kickoff/kickoffViewHelpers.js`
- [x] `src/lib/kickoffPDF.js`
- [x] `src/components/ProdutoServicoModule.jsx`
- [x] `src/pages/PersonaCreator.jsx`
- [ ] `src/pages/OfertaMatadora.jsx` — ~11
- [ ] `src/components/OfertaWizard/OfertaWizardShell.jsx` — ~15
- [ ] `src/components/OfertaWizard/StepComponents.jsx` — ~114
- [ ] `src/components/OfertaWizard/ofertaShared.js` — ~81
- [ ] `src/components/EstrategiaV2Module.jsx` — ~73
- [ ] `src/components/FerramentasModule.jsx` — ~16
- [ ] `src/components/PromessaModule.jsx` — ~62
- [ ] `src/components/PlanejamentoAnualModule.jsx` — ~46
- [ ] `src/components/PlanejamentoMarketingModule.jsx` — ~50
- [ ] `src/components/Precificacao/PrecificacaoCard.jsx` — ~5
- [ ] `src/components/Precificacao/PrecificacaoItemModal.jsx` — ~20
- [ ] `src/components/Precificacao/PrecificacaoModule.jsx` — ~8
- [ ] `src/components/Precificacao/PrecificacaoProdutoForm.jsx` — ~9
- [ ] `src/components/Precificacao/PrecificacaoSaasForm.jsx` — ~29
- [ ] `src/components/Precificacao/PrecificacaoServicoForm.jsx` — ~17
- [ ] `src/components/Precificacao/precificacaoMath.js` — ~5
- [ ] `src/components/MecanismoUnico/Fields.jsx` — ~2
- [ ] `src/components/MecanismoUnico/MecanismoUnicoModule.jsx` — ~106
- [ ] `src/components/MecanismoUnico/MecanismoWizardShell.jsx` — ~1
- [ ] `src/components/MecanismoUnico/WizardSteps.jsx` — ~67
- [ ] `src/components/MecanismoUnico/mecanismoShared.js` — ~20
- [ ] `src/components/MecanismoUnico/mecanismoUnicoData.js` — ~83
- [ ] `src/lib/mecanismoUnicoPDF.js` — ~42
- [ ] `src/components/MatrizObjecao/MatrizObjecaoModule.jsx` — ~20
- [ ] `src/components/Webinar/WebinarModule.jsx` — ~46
- [ ] `src/components/Webinar/webinarData.js` — ~341
- [ ] `src/components/PropostaComercialModule.jsx` — ~1
- [ ] `src/lib/propostaComercial.js` — ~42

### 3.4 Cliente › Projetos

- [ ] `src/components/Jornada/JornadaModule.jsx` — ~4
- [ ] `src/components/Jornada/jornadaPhases.js` — ~37
- [ ] `src/components/NPSModule.jsx` — ~67
- [ ] `src/components/MeetingMinutesModule.jsx` — ~69

### 3.5 Cliente › Resultados

- [ ] `src/components/ResultadosModule.jsx` — ~6
- [ ] `src/components/Resultados/AutofillResultados.jsx` — ~7
- [ ] `src/components/Resultados/B2BResultados.jsx` — ~25
- [ ] `src/components/Resultados/B2CResultados.jsx` — ~18
- [ ] `src/components/Resultados/ComparativoCanais.jsx` — ~19
- [ ] `src/components/Resultados/ContasVinculadas.jsx` — ~13
- [ ] `src/components/Resultados/FunilDoMes.jsx` — ~2
- [ ] `src/components/Resultados/GraficosEvolucao.jsx` — ~2
- [ ] `src/components/Resultados/ModelSelector.jsx` — ~7
- [ ] `src/components/Resultados/PlanoVsRealizado.jsx` — ~4
- [ ] `src/components/Resultados/ProjectTrafficDashboard.jsx` — ~5
- [ ] `src/components/Resultados/ResultadosCharts.jsx` — ~3
- [ ] `src/components/Resultados/SaveBar.jsx` — ~5
- [ ] `src/components/Resultados/VendasPorUnidade.jsx` — ~16
- [ ] `src/components/Resultados/resultadosHelpers.js` — ~6
- [ ] `src/lib/autofillResultados.js`
- [ ] `src/components/ClarityModule.jsx` — ~25
- [ ] `src/lib/clarity.js` — ~3
- [ ] `src/components/CRMModule.jsx` — ~11
- [ ] `src/components/BancoDeDadosModule.jsx` — ~98
- [ ] `src/hooks/useResultadosSave.js`

### 3.6 Cliente › Planejamento

- [x] `src/components/ROIScenariosModule.jsx`
- [ ] `src/components/CampaignPlanner.jsx` — ~45
- [ ] `src/components/CampaignPlanner/AdAccountSection.jsx` — ~1
- [ ] `src/components/CampaignPlanner/CampaignRow.jsx` — ~6
- [ ] `src/components/CampaignPlanner/ChannelRow.jsx` — ~10
- [ ] `src/components/CampaignPlanner/FunnelTable.jsx` — ~1
- [ ] `src/components/CampaignPlanner/PaceCard.jsx` — ~21
- [ ] `src/components/CampaignPlanner/campaignHelpers.js` — ~5
- [ ] `src/components/CampaignPlanner/pullFromDashboard.js` — ~3
- [ ] `src/components/MetaLabModule.jsx` — ~76
- [ ] `src/lib/metaLabPDF.js` — ~101
- [ ] `src/components/GoogleAdsModule.jsx` — ~33
- [ ] `src/components/GoogleAds/AdsHistory.jsx` — ~9

### 3.7 Cliente › Criação

> `funis.js` e `niveisConsciencia.js` misturam rótulos e trechos de prompt.

- [ ] `src/components/CriativosModule.jsx` — ~153
- [ ] `src/components/Criativos/AdWireframePanel.jsx` — ~9
- [ ] `src/components/Criativos/ContextPreview.jsx` — ~4
- [ ] `src/components/Criativos/CopyAprovacaoModal.jsx` — ~19
- [ ] `src/components/Criativos/CreativeCard.jsx` — ~7
- [ ] `src/components/Criativos/CreativeHistory.jsx` — ~8
- [ ] `src/components/Criativos/CreativeResultBlock.jsx` — ~14
- [ ] `src/components/Criativos/CriativoVisualPanel.jsx` — ~26
- [ ] `src/components/Criativos/ResultBlock.jsx` — ~1
- [ ] `src/components/Criativos/adWireframes/destaqueDuasFotos.js` — ~19
- [ ] `src/components/Criativos/adWireframes/shared.js` — ~2
- [ ] `src/components/Criativos/adWireframes/textoLateral.js` — ~12
- [ ] `src/components/Criativos/templates/quote.js` — ~1
- [ ] `src/components/Criativos/templates/tweet.js` — ~1
- [ ] `src/lib/creativoPDF.js` — ~11
- [ ] `src/lib/criativoTemplate.js` — ~7
- [ ] `src/lib/roteiroVideoPDF.js` — ~7
- [ ] `src/lib/copyLevas.js` — ~1
- [ ] `src/lib/funis.js` — ~32
- [ ] `src/lib/niveisConsciencia.js` — ~19
- [ ] `src/components/Debriefing/CentralAprovacaoModal.jsx` — ~24
- [ ] `src/components/Debriefing/CreativeTestModal.jsx` — ~18
- [ ] `src/components/Debriefing/DebriefingAdModal.jsx` — ~67
- [ ] `src/components/Debriefing/DebriefingModule.jsx` — ~69
- [ ] `src/components/Debriefing/GrupoAnunciosModal.jsx` — ~36
- [ ] `src/components/Debriefing/debriefingData.js` — ~12
- [ ] `src/components/LPCentral/LPCentralModal.jsx` — ~27
- [ ] `src/components/LPCentral/LPCentralModule.jsx` — ~18
- [ ] `src/components/LPCentral/lpCentralData.js` — ~2
- [ ] `src/components/LandingPageModule.jsx` — ~49

## Onda 4 — Páginas públicas

### 4.0 Base das páginas públicas

> Sem login, o idioma não vem do perfil. Decidido: `?lang=en` no link → escolha salva no navegador → idioma do
> navegador → português, com um seletor PT | EN na própria página. As chamadas às funções públicas mandam `X-Idioma`.

### 4.1 Portal do cliente

- [ ] `src/pages/Portal.jsx` — ~13
- [ ] `src/components/Portal/PortalModule.jsx` — ~82
- [ ] `src/components/Portal/PortalResultados.jsx` — ~6
- [ ] `src/lib/portal.js`

### 4.2 Formulários do cliente

- [ ] `src/pages/ResetPassword.jsx` — ~10
- [ ] `src/pages/ClientForm.jsx` — ~108
- [ ] `src/pages/B2CClientForm.jsx` — ~11
- [ ] `src/pages/B2BClientForm.jsx` — ~10
- [ ] `src/pages/NPSClientForm.jsx` — ~53
- [ ] `src/pages/PedidoPublico.jsx` — ~32
- [ ] `src/lib/pedidoTipos.js` — ~221
- [ ] `src/lib/printDoc.js` — ~2

### 4.3 Aprovações

- [ ] `src/pages/AprovacaoAnunciosPublico.jsx` — ~33
- [ ] `src/pages/AprovacaoCopyPublico.jsx` — ~45
- [ ] `src/pages/RevisaoCopyInterna.jsx`
- [ ] `src/lib/copyParaCliente.js`

### 4.4 Ferramentas públicas

- [ ] `src/pages/OfertaMatadoraPublico.jsx` — ~12
- [ ] `src/pages/MecanismoUnicoPublico.jsx` — ~12
- [ ] `src/pages/MatrizObjecaoPublico.jsx` — ~15
- [ ] `src/pages/PrecificacaoPublico.jsx` — ~10
- [ ] `src/pages/WebinarPublico.jsx` — ~9
- [ ] `src/pages/CriativosPublico.jsx` — ~68
- [ ] `src/lib/criativosPublic.js` — ~30
- [ ] `src/pages/RoteirosExpressPublico.jsx` — ~29

### 4.5 Visualizações compartilhadas

- [ ] `src/pages/MeetingMinutePublico.jsx` — ~28
- [ ] `src/pages/CampanhasPublico.jsx` — ~23
- [ ] `src/pages/CRMPublico.jsx` — ~11
- [ ] `src/pages/BancoDadosPublico.jsx` — ~12
- [ ] `src/pages/BancoDeAnunciosPublico.jsx` — ~12
- [ ] `src/pages/BancoDeLPsPublico.jsx` — ~8

## Onda 5 — Dashboard de Tráfego

### 5.1 Dashboard de Tráfego (viewer)

> O viewer é HTML estático (não importa de `src/`): precisa de um mini-i18n próprio que leia `localStorage.rl_lang`, como já faz com o tema, e acompanhe a troca pelo evento `storage`. No link público (`?shared=1`) vale a regra das páginas públicas. `vendor/dashboardData.js` é cópia à mão de `src/lib/dashboardData.js`; `vendor/playbookSugestoes.js` e `vendor/dashCache.js` são gerados (traduzir na origem). O texto das sugestões já segue `rl_lang` no viewer; os rótulos em volta ("Conta:", "O que fazer:") e o
`PRIORIDADE_LABEL` ficam para esta onda (use `rotuloPrioridade`/`rotuloTipo` de `playbookSugestoes.js`).

- [ ] `src/pages/DashboardApiTeste.jsx` — ~2
- [ ] `public/dash-teste/viewer.html` — ~791
- [ ] `public/dash-teste/vendor/dashboardData.js`
- [ ] `src/lib/dashboardData.js` — ~33
- [ ] `src/lib/dashCache.js` — ~3
- [ ] `src/hooks/useDashboardData.js`

## Onda 6 — Transversais

### 6.1 PDFs

> Os outros geradores de PDF estão nas ondas das telas que os usam. O PDF sai no idioma de quem gera.

- [ ] `src/utils/exportPDF.js` — ~207

### 6.2 Mensagens que vêm das funções `/api/*`

> Decidido: a tela manda `X-Idioma` e a função responde traduzida com `msg(req, { pt, en })` de `api/_http.js`.

- [ ] `api/_atividades_engine.js` — ~24
- [ ] `api/_atividades_fonte.js` — ~5
- [ ] `api/_chat_sync_core.js` — ~13
- [ ] `api/_clickup_fotos.js` — ~3
- [ ] `api/_crm.js` — ~4
- [ ] `api/_http.js` — ~3
- [ ] `api/_intake.js` — ~1
- [ ] `api/_portal_auth.js` — ~4
- [ ] `api/_tarefas_clickup_map.js` — ~21
- [ ] `api/_tarefas_push_core.js` — ~46
- [ ] `api/_tarefas_relacoes.js` — ~5
- [ ] `api/_tarefas_sync_core.js` — ~23
- [ ] `api/_tarefas_webhook_core.js` — ~8
- [ ] `api/_tarefas_webhook_saude.js` — ~5
- [ ] `api/activate-ad.js` — ~11
- [ ] `api/ad-link.js` — ~5
- [ ] `api/ad-media.js` — ~14
- [ ] `api/ad-preview-public.js` — ~15
- [ ] `api/ad-preview.js` — ~8
- [ ] `api/admin-users.js` — ~9
- [ ] `api/ads-roadmap.js` — ~4
- [ ] `api/anthropic.js` — ~4
- [ ] `api/anuncios-aprovacao.js` — ~14
- [ ] `api/atividades.js` — ~29
- [ ] `api/b2b-results.js` — ~7
- [ ] `api/b2c-results.js` — ~7
- [ ] `api/banco-dados-public.js` — ~5
- [ ] `api/campaign-budgets.js` — ~5
- [ ] `api/campanhas-public.js` — ~4
- [ ] `api/chat-sync.js` — ~4
- [ ] `api/clarity.js` — ~12
- [ ] `api/clickup-webhook.js` — ~3
- [ ] `api/clickup.js` — ~11
- [ ] `api/client-form.js` — ~11
- [ ] `api/copy-aprovacao.js` — ~20
- [ ] `api/criativos-public.js` — ~114
- [ ] `api/criativos-share-token.js` — ~4
- [ ] `api/criativos-users.js` — ~16
- [ ] `api/crm-assist.js` — ~18
- [ ] `api/crm-test.js` — ~4
- [ ] `api/dash-benchmark.js` — ~3
- [ ] `api/dash-data.js` — ~5
- [ ] `api/dash-public.js` — ~7
- [ ] `api/dash-rollup.js` — ~11
- [ ] `api/dash-share-token.js` — ~5
- [ ] `api/intake-publico.js` — ~14
- [ ] `api/launch-creative.js` — ~3
- [ ] `api/lead-capture.js` — ~6
- [ ] `api/matriz-objecao.js` — ~7
- [ ] `api/meeting-minute.js` — ~10
- [ ] `api/meta-activities.js` — ~14
- [ ] `api/meta-pages.js` — ~3
- [ ] `api/nps.js` — ~9
- [ ] `api/portal.js` — ~23
- [ ] `api/precificacao-form.js` — ~7
- [ ] `api/resultados-autofill.js` — ~10
- [ ] `api/roteiros-express.js` — ~22
- [ ] `api/roteiros-validados.js` — ~9
- [ ] `api/slack.js` — ~13
- [ ] `api/tarefas-push.js` — ~3
- [ ] `api/tarefas-sync.js` — ~3
- [ ] `api/transcribe-ad.js` — ~14
- [ ] `api/trigger-sync.js` — ~3
- [ ] `api/webinar-public.js` — ~7

### 6.3 Demais helpers e hooks

- [x] `src/lib/api.js`
- [ ] `src/lib/buildContext.js` — ~28
- [x] `src/lib/claude.js`
- [ ] `src/lib/clickup.js` — ~2
- [ ] `src/lib/roasPorUnidade.js` — ~1
- [ ] `src/lib/roteiroVideoHabilidade.js` — ~18
- [ ] `src/lib/slack.js` — ~1
- [ ] `src/lib/supabase.js` — ~1
- [ ] `src/lib/wireframeHtml.js` — ~3
- [ ] `src/routes/legacyRedirects.jsx` — ~1

## Regras para traduzir

### Regras
1. **Traduza todo texto visível**: conteúdo de tags, `placeholder`, `title`, `aria-label`, `alt`, toasts, `confirm`/`alert`, mensagens de erro mostradas na tela, rótulos de opções, textos de estado vazio, tooltips, cabeçalhos de tabela e o conteúdo de PDF ou documento gerado pela tela. Comentários de código ficam em português e não se traduzem.
2. **Nunca mude dado gravado ou comparado.** Valores de `<option value>`, ids, chaves de objeto, valores salvos no Supabase e strings comparadas com `===` ou usadas como chave continuam iguais. Traduza só o **rótulo** exibido. Se hoje o rótulo e o valor gravado são a mesma string em português (por exemplo, um select que grava "Ativo"), mantenha o valor em português e mostre a tradução: `t(\`ns.status.${valor}\`)` ou um mapa valor → chave.
3. **Constantes exportadas usadas por outros arquivos** (`src/lib/*.js`) não podem mudar de formato: outras telas ainda não traduzidas as consomem. Mantenha o export como está e acrescente um helper de tradução (por exemplo, `rotuloSegmento(id)`) ou traduza no render da sua tela.
4. **Datas e números:** troque `'pt-BR'` cravado por `locale` (do hook) ou `localeAtual()`. A moeda continua `BRL`.
5. **Texto gerado pela IA** deve seguir o idioma de quem gera. `src/lib/claude.js` exporta `instrucaoDeIdioma()`, que devolve `''` em português e uma instrução "write in English" em inglês. Concatene ao `system` **somente** se a saída da IA não for lida por regex ou `split` em rótulos em português. Se for lida assim, adapte o parser para aceitar os dois idiomas ou não ligue; em qualquer caso, diga no relatório o que fez. O prompt em si fica em português.
6. O inglês deve ser natural, de produto SaaS americano, e não tradução literal. Nomes de marca e de produto continuam iguais: VertaTask, Verta, Revenue Lab, Meta Ads, Google Ads, ClickUp, Looker Studio. Termos de tráfego pago seguem o uso do mercado: CPL, CTR, CPM, ROAS, lead, MQL, SQL, funnel, top/middle/bottom of funnel, ad set, campaign, creative.
7. Mantenha o estilo do arquivo (aspas, ponto e vírgula, indentação). Não reformate nem refatore nada além do necessário.
8. Os seus namespaces estão listados na sua tarefa. Crie os dois arquivos de cada um (pt e en) com **as mesmas chaves** e chaves curtas em camelCase português (`titulo`, `semClientes`, `filtros.squad`). No topo do arquivo pt, ponha um comentário de uma linha dizendo a qual tela ele pertence.

### Para conferir antes de terminar
- `npx eslint <seus arquivos>`: zero errors.
- `node scripts/i18n_inventario.mjs --arquivo <arquivo>` para cada arquivo da lista. O script estima os textos em português que sobraram; deve restar só o que não é interface (comentário mal detectado, valor gravado, prompt). Leia o que sobrou e justifique no relatório.
- Confira que pt e en têm as mesmas chaves: `node --input-type=module -e "import a from './src/i18n/locales/pt/NS.js'; import b from './src/i18n/locales/en/NS.js'; const f=(o,p='')=>Object.entries(o).flatMap(([k,v])=>v&&typeof v==='object'&&!('other' in v)?f(v,p+k+'.'):[p+k]); const x=f(a),y=f(b); console.log(x.filter(k=>!y.includes(k)), y.filter(k=>!x.includes(k)))"`, trocando NS pelo namespace.
- Ao fim da onda: `npm run lint`, `npm run build`, abrir as telas em inglês e marcar aqui.

