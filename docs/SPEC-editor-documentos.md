# SPEC — Editor de documentos internos ("Docs"), inspirado no Codex da SellFlux

> **Objetivo:** ter na Área do Cliente um módulo de documentos internos (playbooks, processos,
> atas longas, base de conhecimento) com editor rico estilo Notion, árvore de pastas, abas,
> histórico de versões e um painel de IA que edita o documento aberto.
>
> **Referência analisada:** `app.sellflux.com/funnel/codex?workspace=internal_doc` em 2026-10-07
> (sessão logada, inspeção de DOM, chunks, rede e instância do editor).
> **Status:** spec para validação — nenhum código alterado ainda.

---

## 1. Como o editor da SellFlux funciona

### 1.1 Stack (o que carrega no browser)

| Camada | O que é | Evidência |
|---|---|---|
| App | SPA React + Vite, Tailwind, tema `html.dark`, Redux, i18n, Lucide | chunks `vendor-react`, `vendor-redux`, `vendor-i18n`, `vendor-lucide`, `tailwindish` no DOM, `#root` com fiber |
| Editor visual | **Lexical** (Meta) | `.lexical-content-editable[data-lexical-editor]`, `__lexicalEditor` no root, chunk `vendor-lexical` |
| Editor de código | **Monaco** (linguagem `markdown`) | `window.monaco.editor.getModels()[0].getLanguageId() === 'markdown'` |
| Blocos ricos | **mermaid** (SVG) e **Chart.js** (canvas) | chunks `vendor-mermaid`, `DIV.mermaid-wrapper`, `DIV.chart-wrapper > canvas` |
| Tempo real | **socket.io** | chunks `vendor-socket`, `sync-codex-live-from-socket` — a IA escreve no doc ao vivo |
| Outros no bundle | draft.js (editor legado), craft.js (page builder), fullcalendar, xlsx, dnd | chunks `vendor-*` — não fazem parte do editor de docs |
| Fonte | Pathway Extreme + Inter (Google Fonts) | `fonts.googleapis.com/css2` |
| API | REST separada em `apiv4-main.sellflux.com` | ver 1.5 |

### 1.2 O editor em si (Lexical)

**Nós registrados** (27): `root, text, linebreak, tab, paragraph, artificial, heading, quote,
list, listitem, link, autolink, code, code-highlight, table, tablerow, tablecell,
horizontalrule, mention, attachment-link, image, image-placeholder, mermaid, chart, callout,
toggle, toggle-content`. 54 comandos registrados.

Isso mapeia quase 1:1 para os pacotes oficiais: `@lexical/rich-text` (heading, quote),
`@lexical/list` (incl. checklist), `@lexical/link` (link + autolink), `@lexical/code`
(code + code-highlight com Prism — as classes `code-keyword`, `code-comment`… estão no CSS),
`@lexical/table`, `@lexical/markdown` (import/export). Os demais são **DecoratorNodes
próprios**: `mention`, `attachment-link`, `image`/`image-placeholder` (upload com placeholder
enquanto sobe), `mermaid`, `chart`, `callout`, `toggle`/`toggle-content`.

**Classes de tema** (`.lexical-*`): `h1…h6`, `bold/italic/underline/strikethrough/code-inline`,
`link`, `ul/ol/li`, `li-checked/li-unchecked` (role `checkbox`), `li-nested`, `code-block`,
`quote`, `hr`, `table/table-row/table-cell/table-cell-header`, `align-*`, `image-preview-*`
(lightbox da imagem).

**DOM dos blocos customizados** (observado):

```
DIV.callout-block.callout-NOTE            ← callout (NOTE | WARNING | TIP | …)
DETAILS.toggle-block > SUMMARY.toggle-header + DIV.toggle-content
DIV.mermaid-wrapper > svg
DIV.chart-wrapper  > canvas               ← Chart.js
DIV.image-wrapper  > img
```

### 1.3 Usabilidade (o que o usuário vê)

- **Menu `/`** (typeahead) abre só em linha vazia. Grupos e itens, na ordem:
  - LISTAS: Checklist · Lista · Lista Numerada
  - MÍDIA: Imagem (inserir imagem) · Arquivo (sobe arquivo e insere link)
  - BLOCOS: Código · Divisor · Toggle (conteúdo colapsável)
  - CALLOUTS: Informação · Aviso · Sucesso · Erro · Dica
  - FORMATAÇÃO: Título 1 · Título 2 · Título 3
  - Não há no menu: tabela, citação, mermaid, gráfico (entram por Markdown ou pela IA).
- **Toolbar flutuante** na seleção: seletor de bloco (Parágrafo, Título 1–4) · B · I · U · S ·
  link · código inline · limpar formatação · comentário · IA (sparkles).
- **Sem** drag handle de bloco e **sem** atalhos Markdown ao vivo (`# `, `- ` ficam como texto;
  só viram título/lista ao passar pelo modo Código).
- **Modo Código** (Monaco) mostra o Markdown do documento; voltar para Visual reimporta.
- **Salvar é manual** (botão "Salvar"; a aba ganha o ponto `• Doc` quando está suja; recarregar
  descarta). Não há autosave nem draft local.
- **Versões**: painel à direita com `v1 · save · 07/10/2026 14:46 · autor` e botão restaurar.
- **Configurações do documento** (modal): Título · URL (`pasta/slug`) · Público
  (Rascunho / …) · Capa · Excluir. **Painel "Artigo"**: descrição + URL pública
  `/artigos/<pasta>/<slug>` (publicação como artigo).
- **Imprimir** (abre o print do browser).
- **Shell**: árvore de pastas à esquerda (Administrativo, RH, Produto, Marketing, Comercial,
  Operações, Jurídico, Financeiro, Outros), clique-direito na pasta → "Novo documento",
  itens arrastáveis entre pastas, botão de busca que troca a árvore por uma lista filtrada.
  **Abas múltiplas** (`?tabs=197&fileId=197`), ponto de "não salvo" por aba.
- **Workspace switcher** no topo (Páginas, E-mail, Skills, RAG, Regras da empresa, Central de
  ajuda, Docs internos, Copilot Time, Copilot de Leads, Widgets) — o mesmo editor serve
  vários tipos de conteúdo; as configurações do workspace abrem **como uma aba** no centro
  (Workspaces · Ferramentas do agente · Modelos · Skills).
- **URL carrega o estado**: `tabs`, `fileId`, `workspace`, `panel=chat|settings`,
  `mode=visual|code`.

### 1.4 Painel de IA (direita, `panel=chat`)

- Composer também é Lexical (nós `mention-chip` e `skill-chip`): `@` menciona pessoas,
  `/` lista skills ("Nenhuma skill cadastrada. Crie em Configurações → Skills").
- Seletor de modelo multi-provedor com preço por 1M tokens (Claude Opus 4.6 / 5 / 4.5,
  GPT 5.5, Grok 4.6 / 4.5, Gemini, Kimi K2.6…) e seletor de esforço (`high`).
- Indicador "Editando: Doc" (alvo da edição), botão "Novo" (nova conversa), anexar imagem.
- Placeholder: "Peça alterações no documento aberto ou use / para invocar uma skill."
- As alterações pedidas chegam no documento **ao vivo via socket** (chunk
  `sync-codex-live-from-socket`), não como texto no chat.

### 1.5 Formato persistido e API

O documento é **Markdown** (GFM + extensões). Round-trip Visual ↔ Código confirmado com:

| Bloco | Sintaxe que funcionou |
|---|---|
| Título, negrito, itálico, código inline | `# `, `**x**`, `_x_`, `` `x` `` |
| Tabela | GFM (`\| a \| b \|` + linha `\|---\|---\|`) |
| Checklist | `- [ ]` / `- [x]` |
| Lista numerada, divisor, imagem, link | `1.`, `---`, `![alt](url)`, `[t](url)` |
| Citação | `> texto` |
| Callout | alertas do GitHub: `> [!NOTE]` / `[!WARNING]` / `[!TIP]`… (`:::info` **não** funciona) |
| Toggle | `:::toggle Título` … `:::` |
| Mermaid | ```` ```mermaid ```` |
| Gráfico | ```` ```chart ```` com JSON de configuração do Chart.js |

Endpoints (REST, JWT próprio):

```
GET sacv1/internal-docs/tree?status=all            árvore de pastas/documentos
GET sacv1/internal-docs/articles/:id               documento (markdown + metadados)
GET sacv1/codex-document/internal_doc/:id/history  versões
GET sacv1/codex/workspace · sacv1/codex/skill       workspaces e skills do agente
GET sacv1/ai/models?app=page                       modelos disponíveis (com preço)
GET sacv1/team                                      pessoas para @menção
```

### 1.6 Requisitos que a SellFlux atende (checklist para a nossa versão)

1. Editor rico com Markdown como fonte da verdade (portável, diffável, bom para IA).
2. Menu `/`, toolbar flutuante, checklist, tabela, código com highlight, callouts, toggle,
   imagem e anexo com upload, mermaid e gráfico.
3. Visão Código para quem prefere Markdown (e para colar saída de IA).
4. Árvore de pastas + busca + abas + estado na URL.
5. Salvar explícito + versões com restauração + autor.
6. Painel de IA que edita o documento aberto, com modelo/esforço escolhíveis.
7. Publicação opcional (status + slug + URL pública) e impressão.

---

## 2. Plano para a Área do Cliente

> Ponto de partida (inventário de 2026-10-07): o repo **não tem** nenhuma lib de editor, árvore,
> drag-and-drop, chat de IA com várias trocas nem histórico de versões. O que se reaproveita:
> o frame `.ln` e o painel lateral de 480px de `/tarefas`, o `Popover` de `Campos.jsx`, o
> `Composer` do chat (menções `@`), as assinaturas realtime do `useChat`/`useTarefas`, o
> `streamClaude` + `api/anthropic.js`, `uploadFile`/`getSignedUrl`, `printDocument` e o padrão
> de RLS `*_team` das tabelas internas do time (migrations 084/089).

### 2.1 Decisões de arquitetura

| Tema | Decisão | Por quê |
|---|---|---|
| Editor | **Lexical 0.48** (`lexical` + `@lexical/react` + pacotes oficiais) | É o que a referência usa; MIT; bindings React; `@lexical/markdown` faz o round-trip; nós customizados são `DecoratorNode` simples. Alternativa: Tiptap (ProseMirror) tem mais peças prontas, mas as melhores (drag handle, tabelas avançadas, comentários) são pagas. |
| Fonte da verdade | **Markdown** em coluna `text` (GFM + extensões da tabela da 1.5) | Igual à SellFlux: portável, diffável, legível pela IA, renderizável fora do editor (portal, PDF, chat). |
| Visão Código | **CodeMirror 6** (`@uiw/react-codemirror` + `@codemirror/lang-markdown`), lazy | Monaco pesa ~2 MB; CodeMirror entrega o mesmo para Markdown com ~1/8 do tamanho. |
| Leitura fora do editor | `react-markdown` + **`remark-gfm`** (novo) + componentes para callout/toggle | `remark-gfm` já faltava: sem ele tabela, tachado e checklist não renderizam em lugar nenhum do app (`.prose-tarefa` tem CSS de tabela morto). |
| Blocos ricos | `mermaid` (lazy, só quando há bloco) e `chart.js` (já instalado) | Mesma sintaxe da referência (```` ```mermaid ````, ```` ```chart ````). |
| IA | Só Anthropic (é a chave que temos), via `api/anthropic.js` estendido; **tool use com streaming** | A SellFlux edita o doc ao vivo por socket; aqui o stream já chega no mesmo cliente que tem o editor, então o próprio front aplica as edições — sem socket. |
| Tempo real / colaboração | **Sem edição simultânea** (Yjs fica fora). Salvar explícito cria versão; `versao` inteira detecta conflito; Supabase Realtime avisa "fulano salvou". | Time de 6 pessoas, docs internos: o custo de CRDT (provider Yjs + servidor) não se paga agora. |
| Layout | Frame `.ln` como `/tarefas`: árvore 240px · abas + editor · aside 480px (chat / versões / config) com o mesmo empurra/sobrepõe | Visual já consolidado; `useLarguraDoConteudo` vira hook compartilhado em vez de 3ª cópia. |
| Melhorias sobre a referência | **Rascunho local** (localStorage) contra perda do buffer; atalhos Markdown ao vivo (`# `, `- `, `> `, ```` ``` ````); tabela e citação no menu `/`; `Ctrl+S`; aviso `beforeunload` | Na própria inspeção um clique errado apagou o buffer e o Ctrl+Z não recuperou — só o reload salvou. |

**Pacotes a instalar**

```bash
npm i lexical @lexical/react @lexical/rich-text @lexical/list @lexical/link @lexical/code @lexical/table @lexical/markdown @lexical/utils @lexical/selection @lexical/html remark-gfm @uiw/react-codemirror @codemirror/lang-markdown mermaid
```

Tudo entra por `lazy()` na página `/documentos`; **não** adicionar `manualChunks` (CLAUDE.md:
forçar chunk puxa para o grafo de entrada). Estimativa gzip: Lexical + pacotes ≈ 130 kB,
CodeMirror ≈ 100 kB (só ao abrir a visão Código), mermaid ≈ 450 kB (só ao renderizar um bloco).

### 2.2 Modelo de dados — migration `092_docs.sql`

```sql
create table public.docs_pastas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  parent_id   uuid references public.docs_pastas(id) on delete cascade,  -- null = raiz
  project_id  uuid references public.projects_v2(id) on delete set null, -- pasta de um cliente (opcional)
  emoji       text,
  posicao     int  not null default 0,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.docs_itens (
  id            uuid primary key default gen_random_uuid(),
  pasta_id      uuid not null references public.docs_pastas(id) on delete cascade,
  project_id    uuid references public.projects_v2(id) on delete set null,
  titulo        text not null default 'Sem título',
  slug          text,                                 -- url pública: pasta/slug
  resumo        text,
  capa_path     text,                                 -- bucket docs-media
  conteudo_md   text not null default '',
  status        text not null default 'rascunho'
                check (status in ('rascunho','publicado','arquivado')),
  share_token   uuid unique default gen_random_uuid(),-- link público (como meeting_minutes)
  versao        int  not null default 0,              -- incrementa a cada salvar; detecta conflito
  posicao       int  not null default 0,
  created_by    uuid references public.profiles(id),
  updated_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  busca         tsvector generated always as
                (to_tsvector('portuguese', coalesce(titulo,'') || ' ' || coalesce(conteudo_md,''))) stored
);
create index docs_itens_busca_idx on public.docs_itens using gin (busca);
create unique index docs_itens_slug_idx on public.docs_itens (pasta_id, slug) where slug is not null;

create table public.docs_versoes (
  id          bigserial primary key,
  doc_id      uuid not null references public.docs_itens(id) on delete cascade,
  versao      int  not null,
  titulo      text not null,
  conteudo_md text not null,
  motivo      text not null default 'salvar'          -- salvar | ia | restaurar | importacao
                check (motivo in ('salvar','ia','restaurar','importacao')),
  autor_id    uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  unique (doc_id, versao)
);

-- Opcional (fase 3): histórico do chat de IA por documento
create table public.docs_ia_mensagens (
  id          bigserial primary key,
  doc_id      uuid not null references public.docs_itens(id) on delete cascade,
  conversa_id uuid not null,
  role        text not null check (role in ('user','assistant')),
  content     jsonb not null,                          -- blocos da API (text / tool_use / tool_result)
  autor_id    uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);
```

- **Versão por trigger**: `after update of conteudo_md, titulo on docs_itens` → se mudou,
  `versao = versao + 1` e insere em `docs_versoes` com `autor_id = auth.uid()` (padrão
  `SECURITY DEFINER` de `contract_value_history`, migrations 036/037). O front manda
  `versao_esperada` no update (`.eq('versao', n)`); zero linhas afetadas = conflito.
- **`updated_at`**: trigger plpgsql como `tarefas_touch_updated_at`.
- **RLS**: `create policy "docs_*_team" … to authenticated using (true) with check (true)` nas
  4 tabelas (padrão 084/089). Se um dia houver doc sigiloso, trocar por policy por squad via
  `project_id` → `is_squad_member`.
- **Realtime**: `alter publication supabase_realtime add table docs_itens, docs_pastas`.
- **Storage**: bucket privado `docs-media` (path `{docId}/{Date.now()}-{nome}`) com policies
  para `authenticated`, no mesmo molde da 040 (`task-attachments`), mas **sem** o join com a
  tabela antiga `tasks` que aquela policy carrega.

### 2.3 Rotas, menu e página

- `src/routes/appRoutes.jsx`: `const Documentos = lazy(() => import('../pages/Documentos'))` e
  duas rotas no shell, `/documentos` e `/documentos/:id` (v6 não aceita `?` no path).
- `AppSidebar.jsx`: item `{ id: 'documentos', label: 'Documentos', Icon: FileText, type: 'route', to: '/documentos' }`
  na seção Operação. O ativo hoje é `pathname === to` exato → usar `startsWith` para
  `/documentos/:id`. O item "Playbook" (link externo para o ClickUp Docs) continua até a
  importação da fase 5.
- **Estado na URL** (mesma filosofia de `/tarefas`): `/documentos/:id` (doc aberto),
  `?pasta=`, `?abas=id1,id2` (abas abertas, também em `localStorage['docs.abas']`),
  `?painel=chat|versoes|config`, `?modo=visual|codigo`.
- **Atalhos**: `C` novo doc (na pasta atual), `Ctrl/⌘+S` salvar, `Ctrl/⌘+K` busca,
  `Esc` fecha painel, `[` já recolhe a sidebar global (ignora `isContentEditable`).

```
┌ .ln frame ───────────────────────────────────────────────────────────────────────┐
│ ▸ Documentos · 12 docs              [Visual][Código]  ⚙  🖨  [Salvar] [IA][⏱][⚙] │  h-11
├──────────┬────────────────────────────────────────────────┬──────────────────────┤
│ 🔍 busca │ ● Playbook Ads ×  │ Onboarding ×  │ +         │ aside 480px          │
│ ▾ Operação│────────────────────────────────────────────────│ chat | versões |     │
│   Playbook│                                                │ config               │
│   Onboard.│   # Título                                     │                      │
│ ▾ Comercial│  texto… (max-w 760px, 15px/1.7)               │ (empurra ≥1200,      │
│ ▾ Clientes│                                                │  sobrepõe abaixo)    │
│   ▾ Acme │   / menu · toolbar flutuante · drag handle      │                      │
│ 240px    │                                                │ composer @ /         │
└──────────┴────────────────────────────────────────────────┴──────────────────────┘
```

### 2.4 Estrutura de arquivos

```
src/pages/Documentos.jsx                 orquestra: URL, abas, painel, atalhos, salvar/conflito
src/hooks/useDocs.js                     árvore + doc aberto + CRUD otimista + realtime (molde useTarefas)
src/hooks/useLarguraDoConteudo.js        extraído de Tarefas.jsx / Atividades.jsx (3º uso)
src/components/Docs/
  DocsArvore.jsx                         pastas recursivas, criar/renomear inline (CampoNome), menu Popover,
                                         drag HTML5 nativo entre pastas (como QuadroView), busca FTS
  DocsAbas.jsx                           abas com ponto de sujo, fechar, reordenar
  DocsToolbar.jsx                        Visual/Código, salvar, imprimir, botões do aside
  DocsPainel.jsx                         aside 480 com 3 modos (copiar o <aside> de Tarefas.jsx:441-498)
  PainelVersoes.jsx                      lista + restaurar (+ diff simples por linha)
  PainelConfig.jsx                       título, pasta, cliente vinculado, slug, status, capa, excluir
  Editor/
    DocEditor.jsx                        LexicalComposer + plugins + tema; props { markdown, onChange, onSalvar }
    CodigoEditor.jsx                     CodeMirror (lazy)
    theme.js                             mapa Lexical → classes .doc-*
    markdown/transformers.js             TRANSFORMERS + CHECK_LIST + TABLE + CALLOUT + TOGGLE + MERMAID + CHART + IMAGE
    nodes/CalloutNode.jsx                > [!NOTE|TIP|WARNING|SUCCESS|ERROR]
    nodes/ToggleNode.jsx                 :::toggle Título … :::   (details/summary, conteúdo editável aninhado)
    nodes/ImageNode.jsx                  placeholder durante upload + lightbox + URL assinada
    nodes/AnexoNode.jsx                  chip de arquivo (ícone, nome, tamanho)
    nodes/MermaidNode.jsx                render lazy; clique abre o código
    nodes/ChartNode.jsx                  chart.js a partir do JSON
    nodes/MentionNode.jsx                @Nome_Sobrenome (mesmo formato do chat)
    plugins/SlashMenuPlugin.jsx          LexicalTypeaheadMenuPlugin com "/"
    plugins/FloatingToolbarPlugin.jsx    seleção → bloco, B/I/U/S, link, código, limpar, IA
    plugins/DraggableBlockPlugin.jsx     @lexical/react/LexicalDraggableBlockPlugin (opcional)
    plugins/UploadPlugin.jsx             drop/paste de imagem e arquivo → docs-media
    plugins/MentionsPlugin.jsx           typeahead com "@" (membros de teamMembers)
    plugins/AtalhosPlugin.jsx            Ctrl+S, Ctrl+K
  IA/
    PainelIA.jsx                         conversa + composer + seletor de modelo/esforço + "Editando: X"
    useEditorIA.js                       loop de tool use, aplica edições no editor, estado de streaming
    ferramentas.js                       definições das tools + system prompt
  Leitura/
    DocMarkdown.jsx                      react-markdown + remark-gfm + callout/toggle/mermaid/chart (portal, público, PDF)
src/lib/docs.js                          slug, markdown helpers, aplicar edição (busca/substitui), resolver mídia
api/anthropic.js                         whitelist: + tools, tool_choice, output_config, thinking
src/lib/claude.js                        streamClaude ganha onEvent (tool_use) sem quebrar quem usa onChunk
supabase/migrations/092_docs.sql
```

### 2.5 Editor: plugins, nós e tema

| Recurso | Pacote / origem | Observação |
|---|---|---|
| Parágrafo, títulos, citação | `@lexical/rich-text` (`RichTextPlugin`, `HeadingNode`, `QuoteNode`) | |
| Listas + checklist | `@lexical/list` (`ListPlugin`, `CheckListPlugin`) | checklist com `role=checkbox` como na referência |
| Link + autolink | `@lexical/link` (`LinkPlugin`, `AutoLinkPlugin`, `ClickableLinkPlugin`) | |
| Código com highlight | `@lexical/code` (`CodeNode`, `CodeHighlightNode`, `registerCodeHighlighting`) | Prism já vem junto; classes `doc-code-*` |
| Tabela | `@lexical/table` (`TablePlugin`) + transformer TABLE copiado do playground | menu de célula pode ficar para depois |
| Divisor | `@lexical/react/LexicalHorizontalRuleNode` | |
| Histórico (undo/redo) | `@lexical/react/LexicalHistoryPlugin` | |
| Atalhos Markdown | `@lexical/react/LexicalMarkdownShortcutPlugin` com os mesmos transformers | melhoria sobre a referência |
| Menu `/` e menções `@` | `@lexical/react/LexicalTypeaheadMenuPlugin` | grupos iguais à SellFlux + Tabela, Citação, Mermaid, Gráfico |
| Indentação por Tab | `@lexical/react/LexicalTabIndentationPlugin` | |
| Drag handle | `@lexical/react/LexicalDraggableBlockPlugin` | opcional; a referência não tem |
| Toolbar flutuante | copiar do playground (`FloatingTextFormatToolbarPlugin`) | + botão IA (2.6) |
| Colar HTML | `@lexical/html` + `@lexical/clipboard` | colar do Google Docs / ClickUp |
| Markdown ↔ editor | `@lexical/markdown` (`$convertFromMarkdownString`, `$convertToMarkdownString`) | avaliar a nova API mdast do 0.48 (`MdastHtmlExtension`) depois; os transformers clássicos são o caminho seguro |

**Tema**: classes `.doc-*` em `src/index.css` dentro de `.ln` (tokens `--ln-*`, com `.dark`
automático). Corpo do documento em 15px / 1.7 e `max-w-[760px]` (o `.ln` é 13px, bom para
listas, ruim para leitura longa). Nenhuma cor cravada: a regra do CLAUDE.md vale (cor nova
se declara nos dois blocos de tokens, não na regra).

**Round-trip**: `DocEditor` recebe `markdown` e só reimporta quando a string vinda de fora
muda (troca de aba, restaurar versão, edição da IA, voltar da visão Código). A exportação
roda com debounce de 300 ms no `OnChangePlugin` → `onChange(markdown)` → rascunho local.

### 2.6 Salvar, rascunho, versões e conflito

1. Cada tecla → estado do editor; a cada 300 ms exporta Markdown → `localStorage['docs.rascunho.<id>']`
   `{ md, versaoBase, em }`. Ao abrir um doc com rascunho mais novo que `updated_at`, oferece
   "Restaurar rascunho / Descartar".
2. **Salvar** (botão, `Ctrl+S`) → `update docs_itens set conteudo_md, titulo, updated_by where id and versao = versaoBase`.
   0 linhas → conflito: mostra "Alguém salvou a v{n} há X min" com opções *ver diferença* /
   *sobrescrever* / *recarregar*. Sucesso → trigger cria `docs_versoes` e incrementa `versao`;
   limpa o rascunho; toast.
3. **Realtime** em `docs_itens` (UPDATE): se o doc aberto mudou por outro usuário e o buffer
   está limpo, recarrega em silêncio; se está sujo, mostra banner.
4. **Versões** (aside): lista `v{n} · {motivo} · {data} · {autor}`; *Restaurar* carrega o
   conteúdo no editor (sujo) — gravar é um novo salvar com `motivo='restaurar'`. Diff por
   linha com a lib `diff` (opcional, 2 kB).
5. `beforeunload` quando há aba suja.

### 2.7 Painel de IA (edita o documento aberto)

**Proxy** (`api/anthropic.js`): ampliar a whitelist para `tools`, `tool_choice`,
`output_config`, `thinking` (hoje só `model, max_tokens, system, messages, stream`). Opcional:
repassar um header `anthropic-beta` vindo do front para `fallbacks: "default"`
(`server-side-fallback-2026-07-01`) — o cliente nunca vê a chave, só o proxy.

**Cliente** (`src/lib/claude.js`): manter `streamClaude` como está para os 20 chamadores e
acrescentar `onEvent(evento)` que entrega `content_block_start` (`tool_use`: id, name),
`content_block_delta` com `input_json_delta.partial_json`, `content_block_stop`,
`message_delta.stop_reason`. `useEditorIA` monta o loop manual: `stop_reason === 'tool_use'`
→ aplica → responde com `tool_result` → continua até `end_turn` (máx. 4 voltas).

**Ferramentas** (todas com `strict: true`, `additionalProperties: false` e
`eager_input_streaming: true` para o Markdown chegar em streaming):

| Tool | Entrada | Efeito no editor |
|---|---|---|
| `substituir_trecho` | `{ busca, novo }` — `busca` copiado literalmente e único | troca no Markdown atual, reimporta, destaca o bloco por 3 s |
| `inserir` | `{ posicao: 'inicio' \| 'fim' \| 'apos', referencia?, markdown }` | idem |
| `reescrever_documento` | `{ markdown }` | substitui tudo (confirmação se o doc tem > 2 000 caracteres) |
| `responder` | texto normal do assistente | vai para o chat |

Cada aplicação marca a aba como suja e empilha no `HistoryPlugin` → `Ctrl+Z` desfaz a edição
da IA. Chip no chat: "IA alterou 2 trechos · Desfazer". Na visão Código a edição cai no
CodeMirror do mesmo jeito (mesma string).

**Request** (modelo e parâmetros confirmados na referência da API em 2026-10):

```js
{
  model: 'claude-opus-5-5',            // padrão; seletor com Sonnet 5.5 e Haiku 4.5
  max_tokens: 64000, stream: true,
  output_config: { effort: 'medium' }, // seletor "Esforço": low | medium | high
  system: [
    { type: 'text', text: PROMPT_EDITOR, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: contextoDoCliente },          // buildContext(project) se o doc tem project_id
    { type: 'text', text: `<documento>\n${markdownAtual}\n</documento>`, cache_control: { type: 'ephemeral' } },
  ],
  tools: [...],  tool_choice: { type: 'auto' },         // 'any'/'tool' dão 400 no Opus 5.5
  messages: [...historico, { role: 'user', content: pedido + trechoSelecionado }],
}
```

- Thinking fica adaptativo por padrão no Opus 5.5 (não enviar `thinking`); o esforço é o
  único controle. **Sem prefill** de assistant.
- O documento entra no `system` com `cache_control` para as voltas seguintes custarem ~10 %.
- "Trecho selecionado" vai junto quando o usuário selecionou texto antes de pedir.
- **Seletor de modelo** (preço por 1M tokens, entrada/saída): Opus 5.5 `claude-opus-5-5`
  $4/$20 · Sonnet 5.5 `claude-sonnet-5-5` $2/$10 · Haiku 4.5 `claude-haiku-4-5` $1/$5.
  Mostrar `usage` da resposta como custo estimado da conversa (a referência mostra preço por modelo).
- **Ações rápidas** no botão IA da toolbar flutuante (melhorar, encurtar, expandir, corrigir,
  traduzir): mesma rota, sem tools, substituem a seleção com streaming (molde
  `makeRefineHandler` do `LandingPageModule`).
- Conversa por doc em memória na fase 3; persistir em `docs_ia_mensagens` só se o time
  sentir falta. "Novo" zera a conversa. Composer = `Composer.jsx` (já tem `@`), `/` para
  prompts salvos fica para a fase 5.
- `vercel.json` tem `maxDuration: 60`: reescritas longas em Opus podem passar disso no Hobby;
  streaming mantém a conexão viva, mas vale cortar `max_tokens` por ação e preferir
  `substituir_trecho` a `reescrever_documento` no prompt.

### 2.8 Mídia, menções, busca, publicação, PDF

- **Imagens e anexos**: drop/paste → `uploadFile('docs-media', '<docId>/<ts>-<nome>')` (o
  retorno `getPublicUrl` não serve em bucket privado — guardar o path). No Markdown fica
  `![alt](docs-media:<docId>/<arquivo>)`; `resolverMidia()` troca por URL assinada (1 h) com
  cache em memória, usado pelo `ImageNode`, pelo `AnexoNode` e pelo `DocMarkdown`. Alternativa
  mais simples: bucket público como `ad-bank` — decidir em 2.11.
- **Menções**: `@Nome_Sobrenome` (formato do chat, `slugDe`/`extrairMencoes` de `src/lib/chat.js`);
  ao salvar, para cada menção nova, insere em `notifications` com `link = /documentos/<id>`
  (o `NotificationCenter` já navega pelo `link`).
- **Busca**: `Ctrl+K` → `docs_itens.busca @@ plainto_tsquery('portuguese', q)` + título por `ilike`.
- **Publicação**: `status = 'publicado'` + `share_token` → rota pública `/doc/:token`
  (`publicRoutes.jsx` + `api/doc-publico.js` com chave de serviço, molde `api/meeting-minute.js`)
  renderizando `DocMarkdown`. Depois, módulo `documentos` no Portal (`portalModules.js` +
  `LOADERS` em `api/portal.js`) para liberar docs ao cliente.
- **Imprimir / PDF**: `printDocument({ title, body: markdownToHtml(md) })` de `printDoc.js`
  (precisa do `remark-gfm` e dos componentes de callout/toggle no `markdownToHtml`).
- **Vínculo com cliente**: `project_id` em pasta/doc → seção "Documentos" no `HubDireita`
  do `ClientProfile` listando os docs do cliente (id novo em `clientSections.js`, sem mexer
  nos ids existentes).

### 2.9 Fases e estimativas

| Fase | Entrega | Esforço |
|---|---|---|
| 0 — Base | deps, migration 092, bucket, rota, item de menu, página com frame e árvore vazia | ½ dia |
| 1 — Editor + CRUD | árvore (criar/renomear/mover/arquivar), abas, Lexical com rich-text/listas/checklist/link/código/tabela/hr/citação, round-trip Markdown, salvar + rascunho local + conflito, `Ctrl+S` | 3 dias |
| 2 — Usabilidade Notion | menu `/`, toolbar flutuante, atalhos Markdown, callouts, toggle, imagem e anexo com upload, visão Código, imprimir, `useLarguraDoConteudo` compartilhado | 2 dias |
| 3 — Versões + IA | trigger de versão, painel de versões com restaurar, proxy com tools, `onEvent` no `streamClaude`, `useEditorIA` com loop, painel de chat, ações rápidas na seleção, realtime "alguém salvou" | 3 dias |
| 4 — Extras | mermaid, gráfico, menções com notificação, busca `Ctrl+K`, drag handle, publicação pública + exportar PDF, docs do cliente no hub | 2 dias |
| 5 — Opcional | importar o Playbook do ClickUp (`scripts/importar_clickup_docs.mjs`, API v3 `content_format=text/md` como em `api/ads-roadmap.js`), módulo no Portal, prompts salvos (`/` no composer), comentários ancorados, diff entre versões | a combinar |

Total até a fase 4: **~10 dias úteis** de uma pessoa. A fase 1 já entrega um editor usável
(só sem `/` e sem IA).

### 2.10 Riscos e pontos de atenção

- **Round-trip Markdown perde o que não tem transformer** (ex.: HTML colado, alinhamento).
  Regra: bloco desconhecido vira bloco de código com a sintaxe original, nunca some.
- **Edição da IA por `busca` literal** falha se o trecho não for único: devolver `tool_result`
  com `is_error: true` e a lista de ocorrências para o modelo refinar (é o comportamento
  esperado do loop, não um bug).
- **`eager_input_streaming`** desliga a validação do JSON no servidor: validar o input de cada
  tool no cliente antes de aplicar; `stop_reason === 'max_tokens'` no meio de uma tool = descartar.
- **URL assinada expira em 1 h**: resolver na renderização (não no Markdown) e renovar sob demanda.
- **Lexical muda rápido** (0.4x mensal): fixar versões exatas no `package.json` e subir junto.
- **Peso**: `/documentos` é a rota mais pesada do app (≈ +130 kB gzip); mermaid só carrega
  quando existe bloco. Conferir no `npm run build` que o chunk de entrada não cresceu.
- **Hobby da Vercel**: `maxDuration 60` e sem cron frequente; nada do plano depende de cron.
- **Policy do bucket `task-attachments` (migration 040)** aponta para a tabela antiga `tasks`;
  não copiar esse join para `docs-media`.
- Botão de menu mobile em `/tarefas`, `/atividades` e `/chat` chama `openSidebar` sem `()`
  (achado do inventário); não repetir em `Documentos.jsx`.

### 2.11 Decisões para validar antes de começar

1. **Lexical** (igual à referência, recomendado) ou Tiptap.
2. **Docs globais com pastas** + vínculo opcional a cliente (recomendado) ou só por cliente.
3. **Salvar explícito + rascunho local** (recomendado) ou autosave contínuo gravando no banco.
4. **Bucket privado com URL assinada** (consistente com o app) ou público como `ad-bank`.
5. **Modelo padrão** `claude-opus-5-5` com seletor (recomendado) ou fixar Sonnet 5.5 por custo.
6. Edição simultânea (Yjs) fica **fora**; conflito por `versao` basta para 6 pessoas.
7. Importar o Playbook do ClickUp na fase 5 e aposentar o link externo da sidebar.
