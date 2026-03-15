# Fluxo de Preenchimento de Novo Cliente

> Versão: 2026-03-15
> Branch de referência: `main` (pós-merge feat/resolve-open-issues)

---

## Visão Geral

O cadastro e ativação de um cliente envolve duas partes distintas:

1. **Cadastro inicial** — formulário em `/onboarding/new` (`NewOnboarding.jsx`) com 5 etapas
2. **Jornada de onboarding** — fluxo em `/project/:id` (`ProjectDetail.jsx`) com 3 etapas assistidas por IA

---

## Parte 1 — Cadastro Inicial (5 etapas)

### Etapa 1 — Empresa

| Campo | Tipo | Obrigatório |
|---|---|---|
| Tipo de Negócio | enum: `b2b` / `local` / `ecommerce` / `infoproduto` | ✅ Sim |
| Nome da Empresa | text | ✅ Sim |
| Nome do Responsável | text | ✅ Sim |
| CNPJ | text (máscara) | ❌ Opcional |
| Cargo do Responsável | text | ❌ Opcional |
| Segmento | text livre + chips de sugestão | ❌ Opcional |

### Etapa 2 — Documentos

| Campo | Tipo | Obrigatório |
|---|---|---|
| Raio-X do Cliente | file (PDF/DOC/DOCX/PNG/JPG) | ❌ Opcional |
| SLA — Passagem de Bastão | file (PDF/DOC/DOCX/PNG/JPG) | ❌ Opcional |

> Nenhum campo obrigatório nesta etapa. O usuário pode avançar sem fazer upload.

### Etapa 3 — Serviços Contratados

| Campo | Tipo | Obrigatório |
|---|---|---|
| Seleção de serviços (mínimo 1) | multiselect | ✅ Sim |
| Sub-campos por serviço (quantidades, nível) | number / select | ❌ Opcionais |

**Serviços disponíveis:**
- 📘 Gestão de Meta Ads
- 🔍 Gestão de Google Ads
- 🎵 Gestão de TikTok Ads
- ✏️ Criação de Roteiros de Criativos *(qtd. imagens + qtd. vídeos)*
- 🎬 Edição de Criativos *(qtd. estáticos + qtd. vídeos)*
- 💼 Assessoria Comercial *(Nível 1 / 2 / 3)*
- 📊 Consultoria
- 🎓 Mentoria
- 📱 Social Media
- 📧 E-mail Marketing
- 🤖 AI no WhatsApp
- 🌐 Criação de Landing Page *(qtd. páginas)*

### Etapa 4 — Contrato & Concorrência

| Campo | Tipo | Obrigatório |
|---|---|---|
| Modelo de Contratação | enum: `aceleracao` / `assessoria` | ✅ Sim |
| Data de Assinatura | date | ✅ Sim |
| Tipo de Pagamento *(só Aceleração)* | enum: `unico` / `mensal` | ❌ Opcional |
| Valor do Contrato / Valor Mensal | currency (BRL) | ❌ Opcional |
| Sites dos Concorrentes | array de URLs | ❌ Opcional |

### Etapa 5 — Equipe & Potencial

| Campo | Tipo | Obrigatório |
|---|---|---|
| Tem equipe comercial? | boolean (Sim / Não) | ✅ Sim |
| Maturidade Digital | enum nível 1–5 | ✅ Sim |
| Possibilidade de Upsell? | boolean (Sim / Não) | ✅ Sim |
| Outras pessoas envolvidas | array `{ name, role }` | ❌ Opcional |
| Observações de upsell | text | ❌ Opcional |

**Níveis de maturidade digital:**
- 1 — Nunca anunciou online
- 2 — Iniciante (já anunciou, sem resultados consistentes)
- 3 — Intermediário (tem resultados, quer escalar)
- 4 — Avançado (anunciante experiente, busca otimização)
- 5 — Expert (estrutura sólida, foco em performance máxima)

Ao concluir a etapa 5, o projeto é criado no Supabase (`projects_v2`) e o usuário vê a tela de sucesso com opções de "Ver Projeto" ou "Voltar ao Dashboard".

---

## Parte 2 — Jornada de Onboarding (3 etapas + perfil)

Acessível em `/project/:id`. As etapas são sequenciais e bloqueadas — a anterior precisa estar em `completedSteps[]` para desbloquear a próxima.

| Ordem | ID | Label | Ferramenta | Salva em |
|---|---|---|---|---|
| 1 | `roi` | Calculadora de ROI | Formulário manual | `roi_calculators` → `roiCalc` + `roiResult` |
| 2 | `strategy` | Criação de ICP | IA (Claude API) | `personas` → `personas[]` |
| 3 | `oferta` | Oferta Matadora | IA (Claude API) | `ofertas` → `ofertaData` |
| — | `profile` | Perfil do Cliente | Visualização | — |

**Regras de desbloqueio:**
- `strategy` só habilita após `roi` estar em `completedSteps`
- `oferta` só habilita após `strategy` estar em `completedSteps`
- `profile` (visualização) só habilita após os 3 core steps concluídos

**Ao concluir as 3 etapas:**
- Modal de conclusão é exibido (primeira vez)
- A página `/project/:id` passa a renderizar diretamente o `ClientProfile`
- Badge no topo muda para "Perfil Completo"
- `progress` vai a 100%

---

## Resumo — Campos estritamente obrigatórios

### Cadastro (NewOnboarding)
1. Tipo de negócio
2. Nome da empresa
3. Nome do responsável
4. Ao menos 1 serviço selecionado
5. Modelo de contratação
6. Data de assinatura do contrato
7. Resposta sobre equipe comercial (sim/não)
8. Maturidade digital (nível 1–5)
9. Potencial de upsell (sim/não)

### Jornada (ProjectDetail)
1. Completar ROI Calculator e salvar
2. Completar Criação de ICP/Personas e salvar
3. Completar Oferta Matadora e salvar

---

## Draft & Persistência

- O formulário de cadastro é **auto-salvo em `localStorage`** (`rl_new_onboarding_draft`) a cada mudança
- O rascunho é restaurado automaticamente na próxima visita a `/onboarding/new`
- Arquivos (Raio-X, SLA) **não são persistidos no draft** (File objects não são serializáveis)
- O rascunho é limpo automaticamente ao finalizar o cadastro
