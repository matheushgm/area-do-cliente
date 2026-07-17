# SPEC — Construtor de Oferta Matadora (Wizard / Linha de Produção)

> **Objetivo:** transformar `src/pages/OfertaMatadora.jsx` de um formulário plano num **wizard guiado passo-a-passo** que faz o cliente (leigo em oferta) sair sozinho com uma Grand Slam Offer aplicável, seguindo a metodologia $100M Offers (Alex Hormozi).
>
> **Base teórica:** `knowledge/100M-Offers-Hormozi.md` (livro destilado).
> **Status:** spec para validação — nenhum código alterado ainda.
> **Público:** caminho ÚNICO que serve B2B e B2C (as diferenças viram dica condicional, não fluxos separados).

---

## 1. Princípios de design

1. **Uma decisão por tela.** O cliente não vê o formulário todo — avança um passo por vez. Isso força o raciocínio na ordem causal (cada passo alimenta o próximo).
2. **Causalidade, não coleta.** O sistema não pede "escreva uma garantia" do nada. Ele extrai upstream (problemas → objeções) e usa isso para *sugerir* garantia, bônus e escassez.
3. **Micro-ensino + exemplo em cada passo.** Toda tela tem: (a) 1 frase do porquê, (b) 1 exemplo B2B e 1 B2C, (c) o campo.
4. **IA assiste por passo, não só no fim.** Botão "💡 Sugerir com IA" em cada passo pesado (problemas, soluções, garantia, nome) para o cliente que travar.
5. **Nunca trava o avanço.** Campos podem ser pulados (com aviso de que a oferta fica mais fraca). O único gate é o Passo 0.
6. **Backward compatible.** Estende `ofertaData` sem quebrar ofertas já geradas.

---

## 2. Arquitetura

### 2.1 Componente
- Reescrever `src/pages/OfertaMatadora.jsx` como **stepper** controlado por `stepIndex` (state local) + barra de progresso.
- Extrair cada passo em `src/components/OfertaWizard/steps/StepXX_*.jsx` (mantém o arquivo-página enxuto).
- Reaproveitar `KickoffOfertaMatadora.js` (diagnóstico) como **Passo 0**.
- Persistência: continua via `updateProject(project.id, { ofertaData: next })` a cada mudança (autosave já existe).

### 2.2 Navegação
- Header: `Passo X de 10 · [nome do passo]` + barra de progresso.
- Rodapé fixo: `← Voltar` | `Pular` (quando permitido) | `Continuar →`.
- Última tela: `✨ Gerar Oferta Matadora` (chama a IA que monta a versão final + pitch).
- Sidebar opcional (desktop): lista os 10 passos com check de preenchimento (navegação livre pra frente/trás).

### 2.3 Caminho único B2B + B2C
O trilho é idêntico. Onde há diferença, o passo mostra **dica condicional** baseada em `project.businessType` (ou num toggle "Meu cliente é: Empresa / Consumidor" perguntado no Passo 0). Ex.: no passo de garantia, B2C ticket baixo → sugere garantia incondicional; B2B/high-ticket → sugere condicional/serviço.

---

## 3. Modelo de dados (`ofertaData`)

Estende o objeto atual. Campos novos em **negrito**. Nada é removido (compat).

```js
function newOferta() {
  return {
    // ── Passo 0: diagnóstico ──
    diagnostico: null,           // { answers:{}, totalScore, verdict } — reusa computeOmDiagnosis
    tipoCliente: '',             // 'b2b' | 'b2c'  (dirige as dicas condicionais)

    // ── Passo 1: sonho ──
    dorAtual: '',                // NOVO — estado atual/dor de hoje
    resultadoSonho: '',          // (existe) estado desejado
    statusGanho: '',             // NOVO — como o cliente será visto pelos outros

    // ── Passo 2: problemas ──
    problemas: [],               // NOVO — [{ id, texto, driver }] driver ∈ valor|probabilidade|esforco|tempo

    // ── Passo 3: soluções ──
    solucoes: [],                // NOVO — [{ id, problemaId, comoResolve }]

    // ── Passo 4: entrega ──
    entrega: {                   // NOVO
      atencao: '',               // '1a1' | 'grupo' | 'muitos'
      esforcoModelo: '',         // 'dfy' | 'dwy' | 'diy'
      meio: '',                  // presencial|video|... (livre/multi)
    },

    // ── Passo 5: núcleo + stack + preço ──
    nucleo: '',                  // NOVO — o entregável principal (1 frase)
    itensStack: [],              // NOVO — [{ id, nome, tipo:'nucleo'|'bonus', valor:Number, resolveProblemaId }]
    preco: '',                   // NOVO — preço final cobrado
    valorTotalCalc: 0,           // derivado da soma de itensStack.valor
    velocidade: '',              // (existe) 1ª vitória / tempo
    esforcoMinimo: '',           // (existe) o que o cliente precisa fazer

    // ── Passo 6: escassez/urgência ──
    escassezTipo: '',            // NOVO — 'vagas' | 'crescimento' | 'cohort' | 'honesta' | 'nenhuma'
    escassez: '',                // (existe) texto final
    urgenciaTipo: '',            // NOVO — 'cohort' | 'sazonal' | 'preco' | 'oportunidade' | 'nenhuma'
    urgencia: '',                // NOVO — texto final (separado de escassez)

    // ── Passo 7: bônus ──
    bonus: [''],                 // (existe) — manter; migração p/ itensStack é opcional

    // ── Passo 8: garantia ──
    garantiaTipo: '',            // NOVO — 'incondicional' | 'condicional' | 'anti' | 'implicita'
    garantia: '',                // (existe) texto final "se não X em Y, então Z"

    // ── Passo 9: nome (M-A-G-I-C) ──
    nomeBlocks: {                // NOVO — montador guiado
      magnet: '', avatar: '', goal: '', interval: '', container: '',
    },
    nome: '',                    // (existe) nome final montado/editado

    // ── Output ──
    generatedOffer: null,        // (existe)
  }
}
```

> **Migração `localStorage`:** incrementar `SCHEMA_VERSION` e adicionar bloco `if (v < N)` que preenche os campos novos com defaults em ofertas antigas (ver CLAUDE.md → "Versionamento do cache local").
> **Supabase:** tabela `ofertas` já guarda o form em JSONB (`answers`) — os campos novos entram sem migration de schema.

---

## 4. Os 10 passos (spec detalhada)

Formato de cada passo: **Objetivo · Campos · Copy de ajuda · Exemplos B2B/B2C · Validação · IA**.

---

### PASSO 0 — Cabe uma oferta matadora? (gate)
**Objetivo:** rodar o diagnóstico de viabilidade antes de deixar montar. Reusa `OM_QUESTIONS` + `computeOmDiagnosis` já existentes.

- **Campos:** as 6 perguntas de `KickoffOfertaMatadora.js` + toggle **"Meu cliente é: 🏢 Empresa (B2B) / 🙋 Consumidor (B2C)"** → grava `tipoCliente`.
- **Ajuda:** "Antes de construir, vamos checar se o cenário favorece uma oferta agressiva."
- **Comportamento por veredito:**
  - `Cabe` (75-100) → "✅ Bora construir" (segue).
  - `Talvez` (50-74) → segue, mas mostra os pilares fracos como alerta.
  - `Não cabe` (0-49) → banner: "Oferta matadora pode queimar verba aqui. Recomendamos autoridade/conteúdo antes." + botão "Entendi, quero construir mesmo assim" (não bloqueia, só educa).
- **Validação:** responder as 6 pra liberar o Continuar.
- **IA:** —

---

### PASSO 1 — O Sonho do seu cliente (Dream Outcome)
**Objetivo:** definir o destino (não o produto) e amarrar a status.

- **Campos:**
  - `dorAtual` (textarea) — "Onde seu cliente está HOJE (a dor)?"
  - `resultadoSonho` (textarea) — "Onde ele quer chegar (o sonho)?"
  - `statusGanho` (text) — "Como ele vai ser visto pelos outros depois?"
- **Ajuda:** "Venda a *transformação*, não o produto. E lembre: as pessoas compram **status** — como serão vistas."
- **Exemplos:**
  - B2B: dor="perde negócio por não saber o CAC" → sonho="máquina de aquisição previsível, R$X/mês" → status="visto como o dono que 'destravou' o crescimento".
  - B2C: dor="acorda com dor nas costas" → sonho="dormir a noite toda e acordar disposto" → status="o amigo que 'resolveu' e recomenda pra todo mundo".
- **Validação:** `resultadoSonho` obrigatório pra continuar.
- **IA:** "💡 Refinar meu sonho" — reescreve os 3 campos mais específicos e com status.

---

### PASSO 2 — Todos os problemas e objeções ⭐ (o passo que falta hoje)
**Objetivo:** enumerar TUDO que impede o cliente de comprar/ter resultado, classificado nos 4 drivers da Equação de Valor. É a matéria-prima de bônus e garantia.

- **Campo:** `problemas[]` — lista dinâmica. Cada item: `texto` (input) + `driver` (select com 4 opções).
- **Os 4 drivers (select):**
  - `valor` — "Não vale a pena / é caro"
  - `probabilidade` — "Não vai funcionar pra mim / não vou conseguir manter"
  - `esforco` — "Muito difícil, confuso, trabalhoso"
  - `tempo` — "Vai demorar / não vai ser conveniente"
- **UX:** 4 colunas (uma por driver), estilo kanban leve, o cliente adiciona cards em cada. Meta visível: "quanto mais problemas, melhor — mire 8+".
- **Ajuda:** "Liste tudo que passa na cabeça do cliente ANTES, DURANTE e DEPOIS da compra. Cada objeção aqui vira um bônus ou uma garantia depois."
- **Exemplos:**
  - B2B (esforço): "vou ter que reorganizar meu financeiro pra passar pra vocês".
  - B2C (probabilidade): "e se eu comprar o colchão e continuar com dor?".
- **Validação:** mínimo 3 pra continuar (aviso amigável).
- **IA:** "💡 Sugerir objeções do meu público" — a IA gera 8-12 problemas já classificados por driver (o cliente aceita/edita/remove). **Este é o assist mais importante do wizard.**

---

### PASSO 3 — Vire cada problema em solução
**Objetivo:** transformar cada problema do Passo 2 em "Como resolvo isso".

- **Campo:** `solucoes[]` — renderiza automaticamente 1 linha por problema do Passo 2. Cada linha: mostra o `problema` (read-only) + input `comoResolve` (prefixado com "Como...").
- **Ajuda:** "Para cada travamento, responda: o que eu preciso mostrar/entregar pra resolver? Comece com 'Como...'."
- **Exemplos:**
  - Problema "passar o financeiro dá trabalho" → "Como sair do caos em 14 dias sem você organizar nada."
  - Problema "e se eu não gostar do colchão?" → "Como testar dormindo 90 noites em casa, sem risco."
- **Validação:** nenhuma dura (pode deixar em branco algumas), mas mostra contador "X de Y resolvidos".
- **IA:** "💡 Sugerir soluções" — preenche o `comoResolve` de todos a partir dos problemas.

---

### PASSO 4 — Como você entrega (Delivery Cube)
**Objetivo:** definir o formato de entrega — é o que diferencia e escala.

- **Campos (`entrega`):**
  - `atencao` (cards de escolha): 1-a-1 · Pequeno grupo · Um-para-muitos.
  - `esforcoModelo` (cards): **DFY** (faço por ele) · **DWY** (faço com ele) · **DIY** (ele faz sozinho).
  - `meio` (multi-select livre): presencial, vídeo, áudio, texto, Zoom, dashboard, app...
- **Ajuda:** "Quanto menos esforço pro cliente (DFY) e quanto mais 'um-para-muitos', maior a margem. Escolha o ponto que você consegue entregar bem."
- **Exemplos:**
  - B2B: 1-a-1 + DFY + Zoom/relatório (consultoria high-ticket).
  - B2C: um-para-muitos + DWY + app/vídeo (programa escalável).
- **Validação:** escolher pelo menos `atencao` e `esforcoModelo`.
- **IA:** dica contextual (sem geração): "Com base no seu ticket, o ideal costuma ser…".

---

### PASSO 5 — Núcleo + Empacotamento + Preço (Trim & Stack)
**Objetivo:** definir o entregável-núcleo, empilhar itens com valor, e cravar preço com a meta "valor ≈ 10x preço".

- **Campos:**
  - `nucleo` (text) — "Qual é a entrega PRINCIPAL da oferta?"
  - `itensStack[]` — lista: `nome` + `tipo` (núcleo/bônus) + `valor` (R$) + `resolveProblemaId` (link opcional ao Passo 2).
  - `velocidade` (text) — "1ª vitória em quanto tempo?" (driver tempo)
  - `esforcoMinimo` (textarea) — "O mínimo que o cliente precisa fazer?" (driver esforço)
  - `preco` (number) — preço final.
  - **Derivado:** `valorTotalCalc` = soma dos `valor`; mostrar badge **"Valor total R$X • Preço R$Y • cliente paga Z%"** e um alerta verde/amarelo se a razão valor/preço ≥ 10x (ideal) / < 3x (fraca).
- **Ajuda:** "Some o valor de cada peça. A meta é o valor percebido ser ~10x o preço — 'R$100 mil de valor por R$10 mil'. E lembre: nunca dê desconto, adicione peça."
- **Exemplos:** ver bundle do BPO/Colchão no doc de conhecimento (stack nomeado com R$ por item).
- **Validação:** `nucleo` + `preco` + ≥1 item.
- **IA:** "💡 Montar o stack" — sugere nomes sedutores + valores por item a partir das soluções do Passo 3.

---

### PASSO 6 — Escassez & Urgência (menu guiado)
**Objetivo:** dar "por que agir AGORA" sem o cliente inventar do nada.

- **Campos:**
  - `escassezTipo` (radio + campo que se adapta):
    - `vagas` → "Só atendo X clientes" · `crescimento` → "X vagas por semana" · `cohort` → "X por turma" · `honesta` → "Estamos a X% da capacidade" · `nenhuma`.
  - `escassez` (text) — frase final (pré-preenchida conforme o tipo).
  - `urgenciaTipo` (radio): `cohort` (turma começa dia X) · `sazonal` (promo por estação) · `preco` (condição muda em X semanas) · `oportunidade` (janela que expira) · `nenhuma`.
  - `urgencia` (text) — frase final.
- **Ajuda:** "Escassez = quantidade limitada. Urgência = prazo. Use uma de cada. **Tem que ser real** — deadline falso queima credibilidade."
- **Exemplos:** B2B "5 vagas/mês, restam 2" + "implantação grátis fechando este mês"; B2C "lote de 8 unidades" + "Semana do Sono até domingo".
- **Validação:** nenhuma (pode escolher "nenhuma").
- **IA:** botão preenche a frase final a partir do tipo escolhido.

---

### PASSO 7 — Bônus (1 por objeção)
**Objetivo:** empilhar bônus que matam objeções específicas do Passo 2. A soma deve superar o núcleo.

- **Campo:** `bonus[]` (mantém o existente) — mas cada bônus agora sugere link a um `problemaId` ainda não resolvido no stack. Placeholder já pede nome + valor R$.
- **Ajuda:** "Cada bônus resolve UMA objeção. Ferramentas e checklists valem mais que treinamentos (menos esforço). A soma dos bônus deve valer mais que o produto principal. Nunca desconto — bônus."
- **Exemplos:** "Régua de Cobrança Automática (R$1.500) — recupera inadimplência" (B2B); "Par de Travesseiros Ergonômicos (R$400) — resolve dor no pescoço" (B2C).
- **Validação:** nenhuma.
- **IA:** "💡 Sugerir bônus" — cria bônus nomeados/precificados para as objeções ainda não cobertas.

---

### PASSO 8 — Garantia (menu dos 4 tipos)
**Objetivo:** reverter o risco com estrutura "se não X em Y, então Z", escolhendo o tipo certo pro ticket.

- **Campos:**
  - `garantiaTipo` (cards, com dica condicional por `tipoCliente`):
    - `incondicional` ("dinheiro de volta sem perguntas") — *dica: melhor pra B2C/ticket baixo*.
    - `condicional` ("se fez X,Y,Z e não teve resultado…") — *dica: melhor pra B2B/high-ticket*.
    - `anti` ("todas as vendas finais — porque…") — *dica: produto copiável/consumível*.
    - `implicita` ("só pago se der resultado — revshare/performance") — *dica: quando dá pra medir o resultado*.
  - `garantia` (textarea) — texto final no formato **"Se você não [X] em [Y], então [Z]."**
- **Ajuda:** "A maior objeção é o risco. Garantia com 'dentes' tem o 'ou o quê' (Z). Ex: '20 clientes em 30 dias, ou devolvo seu dinheiro + o que você gastou em anúncios.'"
- **Validação:** nenhuma (mas fortemente recomendada).
- **IA:** "💡 Escrever minha garantia" — gera a frase no tipo escolhido, usando sonho + prazo do Passo 1/5.

---

### PASSO 9 — Nome da Oferta (montador M-A-G-I-C)
**Objetivo:** montar o nome com 3-5 blocos, guiado.

- **Campos (`nomeBlocks`):** 5 inputs curtos com exemplo em cada:
  - **M**agnet (motivo): "Grátis / 88% OFF / Inauguração…"
  - **A**vatar: "Donos de Restaurante / Mães de [bairro]…"
  - **G**oal: "Dobre o Faturamento / Sem Dor nas Costas…"
  - **I**nterval: "30 Dias / 6 Semanas…" (⚠️ aviso: claim + prazo pode ser barrado por plataforma)
  - **C**ontainer: "Sistema / Método / Desafio / Blueprint…"
  - **Preview** montado ao vivo + `nome` (text) editável (aceita 3-5 blocos, não precisa todos).
- **Ajuda:** "Use 3 a 5 blocos. Curto e punchy vence. Rime ou use aliteração se rolar."
- **Exemplos:** "Sistema Caixa Blindado — Financeiro Organizado em 30 Dias" (B2B); "Programa Sono dos Sonhos — Sem Dor nas Costas em 30 Noites" (B2C).
- **Validação:** `nome` final não vazio.
- **IA:** "💡 Sugerir 5 nomes" — gera opções combinando os blocos.

---

### TELA FINAL — Gerar Oferta Matadora
- Botão `✨ Gerar Oferta Matadora` → chama a IA (prompt do §5) que consolida TUDO em 3 GOMs + pitch (mantém o layout `OfertaResult` atual).
- Mantém export PDF (`exportOfertaPDF`) e `onSave`.

---

## 5. Prompt da IA (atualizado)

O `GOM_SYSTEM_PROMPT` atual é bom — manter a estrutura das 3 GOMs. **Mudança:** o `buildPrompt()` passa a enviar TODO o raciocínio estruturado que o wizard coletou (problemas por driver, soluções, entrega, stack com valores, tipos escolhidos), em vez dos poucos campos de hoje. Assim a IA refina em vez de inventar.

Novo `buildPrompt()` (esboço):
```
EMPRESA: {companyName} · NICHO: {businessType} · CLIENTE: {tipoCliente}

SONHO: hoje="{dorAtual}" → sonho="{resultadoSonho}" → status="{statusGanho}"

PROBLEMAS POR DRIVER:
- Valor: {problemas.filter(valor)}
- Probabilidade: {...}
- Esforço: {...}
- Tempo: {...}

SOLUÇÕES: {solucoes.map(problema → comoResolve)}

ENTREGA: {atencao} · {esforcoModelo} · {meio}
1ª vitória: {velocidade} · Esforço do cliente: {esforcoMinimo}

STACK (núcleo="{nucleo}"): {itensStack: nome — R$valor — resolve}
Valor total: R${valorTotalCalc} · Preço: R${preco}

ESCASSEZ ({escassezTipo}): {escassez}
URGÊNCIA ({urgenciaTipo}): {urgencia}
BÔNUS: {bonus}
GARANTIA ({garantiaTipo}): {garantia}
NOME base: {nome}

Gere as 3 GOMs refinando este material. Cada GOM usa um ângulo (garantia agressiva / bônus empilhados / performance). Mantenha valores e prazos coerentes com o que foi informado.
```

Instrução extra no system prompt: *"O usuário já passou por um wizard estruturado; seu trabalho é REFINAR e tornar irresistível, não inventar dados que contradigam o que foi preenchido. Preencha lacunas com o mínimo de suposição e sinalize suposições entre colchetes."*

---

## 6. Impacto / esforço

| Área | Mudança | Risco |
|---|---|---|
| `OfertaMatadora.jsx` | Reescrita como stepper | Médio (isolar em `OfertaWizard/`) |
| `KickoffOfertaMatadora.js` | Reuso como Passo 0 (import) | Baixo |
| `ofertaData` schema | +12 campos, backward-compat | Baixo (JSONB) |
| `localStorage` migração | +1 `SCHEMA_VERSION` bloco | Baixo |
| `exportPDF.js` / `kickoffPDF.js` | Incluir novos campos no PDF | Baixo |
| IA `buildPrompt` | Enviar contexto estruturado | Baixo |

**Sem mudança de banco (Supabase)** — `ofertas.answers` é JSONB.

---

## 7. Decisões em aberto (validar com o Matheus)

1. **Wizard puro** (uma tela por passo, esconde o resto) ou **acordeão** (todos os passos numa página, expansíveis)? Spec assume wizard puro.
2. **Passo 0 obrigatório** ou pulável? Spec deixa passar mesmo com "não cabe" (só educa).
3. **Migrar `bonus[]` para `itensStack[]`** (unificar) ou manter os dois (menos refactor)? Spec mantém os dois por segurança.
4. **IA por passo** custa mais tokens. Confirmar se pode (assist opcional, sob clique — custo controlado).
5. Perguntar `tipoCliente` no Passo 0 ou derivar de `project.businessType`?

---

*Spec criada em 2026-07-17. Fonte metodológica: `knowledge/100M-Offers-Hormozi.md`. Próximo passo após validação: implementar `OfertaWizard/` + steps.*
