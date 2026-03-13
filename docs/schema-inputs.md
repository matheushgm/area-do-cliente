# Mapeamento de Inputs do Usuário — Revenue Lab

> Levantamento completo de todos os campos inseridos pelo usuário no sistema,
> organizados por entidade/domínio, com sugestão de tipo de dado para o banco de dados.

---

## 1. Entidade: `profiles`

> Telas: **Login**, **UserManagement**
> ⚠️ Estrutura atual — não alterar.

| Campo | Tipo SQL atual | Observações |
|---|---|---|
| `id` | `UUID PRIMARY KEY` | Espelha o `id` do Supabase Auth |
| `name` | `TEXT` | Nome completo |
| `email` | `TEXT` | Email de autenticação |
| `avatar` | `TEXT` | URL da foto (Google OAuth) |
| `role` | `TEXT` | `'admin'` ou `'account'` |
| `disabled` | `BOOLEAN` | Soft delete; `false` por padrão |
| `created_at` | `TIMESTAMPTZ` | |

> `password` é gerenciado exclusivamente pelo Supabase Auth — nunca armazenado em `profiles`.

---

## 2. Entidade: `projects`

> Tela: **NewOnboarding** — dados coletados no wizard de criação de projeto

### 2.1 Dados da Empresa

| Campo | Input | Tipo SQL sugerido | Observações |
|---|---|---|---|
| `company_name` | text | `TEXT NOT NULL` | Nome da empresa cliente |
| `cnpj` | text | `TEXT` | Opcional; sem validação de formato no front |
| `business_type` | select | `TEXT NOT NULL` | Enum: `'b2b'`, `'local'`, `'ecommerce'`, `'infoproduto'` |
| `segmento` | text / select | `TEXT` | Segmento de mercado; texto livre ou lista predefinida |
| `responsible_name` | text | `TEXT NOT NULL` | Nome do responsável do cliente |
| `responsible_role` | text | `TEXT` | Cargo do responsável |

### 2.2 Contrato

| Campo | Input | Tipo SQL sugerido | Observações |
|---|---|---|---|
| `contract_model` | select | `TEXT NOT NULL` | Enum: `'aceleracao'`, `'assessoria'` |
| `contract_payment_type` | select | `TEXT` | Enum: `'unico'`, `'mensal'`; apenas para `aceleracao` |
| `contract_value` | currency | `NUMERIC(12,2)` | Valor em BRL |
| `contract_date` | date | `DATE NOT NULL` | Data de assinatura |
| `competitors` | lista dinâmica | `TEXT[]` | Array de nomes de concorrentes |

### 2.3 Equipe e Maturidade

| Campo | Input | Tipo SQL sugerido | Observações |
|---|---|---|---|
| `has_sales_team` | radio (sim/não) | `BOOLEAN` | Nullable — tristate: sim, não, não informado |
| `digital_maturity` | select (1–5) | `SMALLINT` | Escala 1 (Iniciante) a 5 (Expert) |
| `upsell_potential` | radio (sim/não) | `BOOLEAN` | Nullable — tristate |
| `upsell_notes` | textarea | `TEXT` | Notas livres sobre potencial de upsell |
| `other_people` | lista dinâmica | `JSONB` | Array de `{name: TEXT, role: TEXT}` |

### 2.4 Serviços Contratados

| Campo | Input | Tipo SQL sugerido | Observações |
|---|---|---|---|
| `services` | checkbox array | `TEXT[]` | Lista de IDs de serviços selecionados |
| `services_data` | sub-campos dinâmicos | `JSONB` | `{serviceId: {qty, nivel, imagemQty, videoQty, ...}}` |

### 2.5 Documentos

| Campo | Input | Tipo SQL sugerido | Observações |
|---|---|---|---|
| `raio_x_file_url` | file upload | `TEXT` | URL do arquivo no storage; PDF/imagem, máx 8 MB |
| `sla_file_url` | file upload | `TEXT` | URL do arquivo no storage; PDF/imagem, máx 8 MB |

### 2.6 Metadados do Projeto

| Campo | Origem | Tipo SQL sugerido | Observações |
|---|---|---|---|
| `id` | gerado | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `account_id` | auth | `UUID NOT NULL REFERENCES profiles(id)` | Account manager responsável |
| `status` | derivado | `TEXT NOT NULL DEFAULT 'onboarding'` | Enum: `'onboarding'`, `'active'` |
| `completed_steps` | sistema | `TEXT[]` | Etapas concluídas: `['roi', 'strategy', 'oferta']` |
| `created_at` | sistema | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |
| `updated_at` | sistema | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |

---

## 3. Entidade: `roi_calculators`

> Tela: **ProjectDetail → ROICalculator** (etapa obrigatória 1)
> Um projeto pode ter múltiplos cenários — a FK `project_id` sem `UNIQUE` já permite isso.
> Adicionar `name` é suficiente para diferenciar os cenários (ex: "Conservador", "Agressivo").

| Campo | Input | Tipo SQL sugerido | Observações |
|---|---|---|---|
| `id` | gerado | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `project_id` | FK | `UUID NOT NULL REFERENCES projects(id)` | Sem UNIQUE — permite múltiplos por projeto |
| `name` | text | `TEXT NOT NULL DEFAULT 'Principal'` | Label do cenário |
| `media_orcamento` | number | `NUMERIC(12,2)` | Orçamento em mídia; default 5000 |
| `custo_marketing` | number | `NUMERIC(12,2)` | Management fee; default 2000 |
| `ticket_medio` | number | `NUMERIC(12,2)` | Ticket médio; default 500 |
| `qtd_compras` | number | `SMALLINT` | Compras por cliente (LTV); mín 1; default 1 |
| `margem_bruta` | number (%) | `NUMERIC(5,2)` | 0–100%; default 40 |
| `roi_desejado` | range slider | `NUMERIC(6,2)` | 0–500%; default 0 |
| `taxa_lead_mql` | number (%) | `NUMERIC(5,2)` | Conversão Lead→MQL; default 30 |
| `taxa_mql_sql` | number (%) | `NUMERIC(5,2)` | Conversão MQL→SQL; default 50 |
| `taxa_sql_venda` | number (%) | `NUMERIC(5,2)` | Conversão SQL→Venda; default 20 |
| `benchmark_type` | select | `TEXT` | Enum: `'b2b'`, `'b2c'` |
| `created_at` | sistema | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |

---

## 4. Entidade: `personas`

> Tela: **ProjectDetail → PersonaCreator** (etapa obrigatória 2)

| Campo | Input | Tipo SQL sugerido | Observações |
|---|---|---|---|
| `id` | gerado | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `project_id` | FK | `UUID NOT NULL REFERENCES projects(id)` | |
| `name` | text | `TEXT NOT NULL` | Nome da persona (label da aba) |
| `answers` | multi-input dinâmico | `JSONB NOT NULL` | `{resultado: TEXT[], acoes: TEXT[], tempo: TEXT[], objecoes: TEXT[], sonhos: TEXT[], erros: TEXT[], medos: TEXT[], sinais: TEXT[], valores: TEXT[], habitos: TEXT[]}` — máx 10 respostas por questão |
| `generated_content` | IA | `TEXT` | Markdown gerado pelo Claude após submissão do formulário |
| `generated_at` | sistema | `TIMESTAMPTZ` | Momento da geração |
| `created_at` | sistema | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |

---

## 5. Entidade: `ofertas`

> Tela: **ProjectDetail → OfertaMatadora** (etapa obrigatória 3)

| Campo | Input | Tipo SQL sugerido | Observações |
|---|---|---|---|
| `id` | gerado | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `project_id` | FK | `UUID NOT NULL REFERENCES projects(id)` | |
| `answers` | multi-input | `JSONB NOT NULL` | `{nome: TEXT, resultado_sonho: TEXT, porque_vai_funcionar: TEXT, velocidade: TEXT, esforco_minimo: TEXT, bonus: TEXT[], garantia: TEXT, escassez: TEXT}` |
| `generated_content` | IA | `TEXT` | Markdown gerado pelo Claude após submissão do formulário |
| `generated_at` | sistema | `TIMESTAMPTZ` | Momento da geração |
| `created_at` | sistema | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |

---

## 6. Entidade: `campaign_plans`

> Múltiplos planos por projeto — sem `UNIQUE` em `project_id`.

| Campo | Input | Tipo SQL sugerido | Observações |
|---|---|---|---|
| `id` | gerado | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `project_id` | FK | `UUID NOT NULL REFERENCES projects(id)` | Sem UNIQUE — permite múltiplos planos por projeto |
| `name` | text | `TEXT NOT NULL DEFAULT 'Principal'` | Label do plano (ex: "Lançamento", "Manutenção") |
| `answers` | estrutura aninhada | `JSONB NOT NULL` | `{orcamento_total: number, valor_ja_usado: number, channels: [{name, percentage, stages: [{name, percentage, campaigns: [{name, percentage}]}]}]}` — `budget_disponivel` é derivado (orcamento_total − valor_ja_usado) e não precisa ser salvo; valores de `name`: `'Meta Ads'`, `'Google Ads'`, `'LinkedIn Ads'`, `'TikTok Ads'`, `'YouTube Ads'` |
| `created_at` | sistema | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |

---

## 7. Entidade: `resultados` (tracking de métricas)


| Campo | Input | Tipo SQL sugerido | Observações |
|---|---|---|---|
| `id` | gerado | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `project_id` | FK | `UUID NOT NULL REFERENCES projects(id)` | `business_model` vem do projeto |
| `period` | navegação | `DATE NOT NULL` | Data exata da semana registrada (ex: `2025-03-01`); semana derivada pelo dia: 1–7 = S1, 8–14 = S2, 15–21 = S3, 22+ = S4 |
| `investido` | number | `NUMERIC(12,2)` | Verba investida em mídia no período (BRL) |
| `leads` | number | `INTEGER` | Leads gerados no período |
| `mql` | number | `INTEGER` | Marketing Qualified Leads |
| `sql` | number | `INTEGER` | Sales Qualified Leads |
| `vendas` | number | `INTEGER` | Vendas fechadas |
| `valor_vendas` | number | `NUMERIC(12,2)` | Receita de vendas no período (BRL); relevante principalmente para B2C/e-commerce |

> **Nota:** a separação B2B/B2C é derivada do campo `business_type` do projeto — não é armazenada em `resultados`.

---

## 8. Entidade: `criativos`

> Múltiplos registros por projeto — sem `UNIQUE` em `project_id`.

| Campo | Input | Tipo SQL sugerido | Observações |
|---|---|---|---|
| `id` | gerado | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `project_id` | FK | `UUID NOT NULL REFERENCES projects(id)` | Sem UNIQUE — permite múltiplos ao longo do tempo |
| `answers` | multi-input | `JSONB NOT NULL` | `{ad_type: TEXT, format: TEXT, quantity: SMALLINT}` — `ad_type`: 18 tipos (`'clickbait'`, `'sensacao'`, `'mito'`, `'dilema'`, `'prova'`, `'contraste'`, `'visual'`, etc.); `format`: `'static'` ou `'video'`; `quantity`: 1, 2, 3, 5 ou 10 |
| `generated_content` | IA | `TEXT` | Markdown dos criativos gerados pelo Claude |
| `rating` | RatingSelector | `TEXT` | Enum: `'bom'`, `'medio'`, `'ruim'`; nullable |
| `generated_at` | sistema | `TIMESTAMPTZ` | Momento da geração |
| `created_at` | sistema | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |

---

## 9. Entidade: `google_ads`

> Múltiplos registros por projeto — sem `UNIQUE` em `project_id`.

| Campo | Input | Tipo SQL sugerido | Observações |
|---|---|---|---|
| `id` | gerado | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `project_id` | FK | `UUID NOT NULL REFERENCES projects(id)` | Sem UNIQUE — permite múltiplos ao longo do tempo |
| `answers` | multi-input | `JSONB NOT NULL` | `{campaign_types: TEXT[], keywords: TEXT, landing_page: TEXT, main_offer: TEXT, city: TEXT, objections: TEXT, custom_note: TEXT}` — `campaign_types`: um ou mais de `'marca'`, `'generico'`, `'concorrentes'`, `'problema'`; `keywords` obrigatório |
| `generated_content` | IA | `TEXT` | Markdown gerado pelo Claude |
| `rating` | RatingSelector | `TEXT` | Enum: `'bom'`, `'medio'`, `'ruim'`; nullable |
| `generated_at` | sistema | `TIMESTAMPTZ` | Momento da geração |
| `created_at` | sistema | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |

---

## 10. Entidade: `landing_pages`

> Múltiplos registros por projeto — sem `UNIQUE` em `project_id`.

| Campo | Input | Tipo SQL sugerido | Observações |
|---|---|---|---|
| `id` | gerado | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `project_id` | FK | `UUID NOT NULL REFERENCES projects(id)` | Sem UNIQUE — permite múltiplos ao longo do tempo |
| `generated_content` | IA | `TEXT` | Markdown com todas as dobras gerado pelo Claude |
| `rating` | RatingSelector | `TEXT` | Enum: `'bom'`, `'medio'`, `'ruim'`; nullable |
| `generated_at` | sistema | `TIMESTAMPTZ` | Momento da geração |
| `created_at` | sistema | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |

---

## 11. Entidade: `banco_midia`

> Biblioteca de marca do projeto — 1:1 com `projects`. Atualizada incrementalmente ao longo do tempo.
> Não confundir com `documentos` (2.5 — dois arquivos fixos do onboarding) nem com `attachments` (13 — uploads avulsos).

| Campo | Input | Tipo SQL sugerido | Observações |
|---|---|---|---|
| `project_id` | FK | `UUID PRIMARY KEY REFERENCES projects(id)` | PK e FK ao mesmo tempo — garante 1:1 sem coluna `id` extra |
| `photos` | file upload (múltiplos) | `JSONB` | Array de `{url: TEXT, name: TEXT, size: INTEGER}`; .png/.jpg/.jpeg; máx 8 MB por arquivo; arquivos no Supabase Storage |
| `videos` | file upload (múltiplos) | `JSONB` | Array de `{url: TEXT, name: TEXT, size: INTEGER}`; máx 50 MB por arquivo; arquivos no Supabase Storage |
| `color_palette` | texto + cor | `JSONB` | Array de `{hex: TEXT, nome: TEXT}`; dado estruturado, não arquivo |
| `logo_url` | file upload | `TEXT` | URL do logotipo no Storage (bucket `brand-logos`); NULL enquanto base64 legado |
| `fonte_principal` | text | `TEXT` | Nome da fonte principal da marca |
| `fonte_secundaria` | text | `TEXT` | Nome da fonte secundária da marca |
| `fonte_obs` | textarea | `TEXT` | Observações sobre tipografia (variações, uso, restrições) |
| `observacoes` | textarea | `TEXT` | Campo "O que evitar" — orientações livres sobre o que não usar nos criativos |
| `updated_at` | sistema | `TIMESTAMPTZ NOT NULL DEFAULT now()` | Atualizado a cada modificação na biblioteca |

---

## 12. Entidade: `estrategia`

> Documento executivo gerado por IA a partir dos dados dos outros módulos — sem inputs próprios do usuário.
> 1:1 com o projeto; pode ser regenerada a qualquer momento.

| Campo | Input | Tipo SQL sugerido | Observações |
|---|---|---|---|
| `project_id` | FK | `UUID PRIMARY KEY REFERENCES projects(id)` | PK e FK ao mesmo tempo — garante 1:1 |
| `narrativa` | IA | `TEXT` | Markdown com a estratégia digital completa (7 seções) gerado pelo Claude |
| `generated_at` | sistema | `TIMESTAMPTZ` | Atualizado a cada regeneração |

---

## 13. Entidade: `estrategia_v2`

> Análise estratégica estruturada com inputs do usuário — complementar à narrativa gerada por IA da `estrategia`.
> 1:1 com o projeto; seções de ICPs, ROI e campanhas são read-only (lidas de outras entidades, não salvas aqui).

| Campo | Input | Tipo SQL sugerido | Observações |
|---|---|---|---|
| `project_id` | FK | `UUID PRIMARY KEY REFERENCES projects(id)` | PK e FK ao mesmo tempo — garante 1:1 |
| `problemas` | lista dinâmica | `TEXT[]` | Problemas identificados no kickoff; máx 10 itens |
| `swot` | textarea por quadrante | `JSONB NOT NULL` | `{forcas: TEXT, fraquezas: TEXT, oportunidades: TEXT, ameacas: TEXT}` |
| `concorrentes` | formulário dinâmico | `JSONB` | Array de `{nome: TEXT, metaAds: BOOLEAN, googleAds: BOOLEAN, linkBiblioteca: TEXT, grandePromessa: TEXT, comunicacao: TEXT}` — `linkBiblioteca` só preenchido quando `metaAds = true` |
| `riscos` | tabela dinâmica | `JSONB` | Array de `{problema: TEXT, riscoGerado: TEXT, impacto: TEXT, nivel: TEXT}` — `nivel`: `'baixo'`, `'medio'`, `'alto'` |
| `funis` | checkbox múltiplo | `TEXT[]` | Funis selecionados; opções: `'Funil de Webinar'`, `'Funil de Aplicação'`, `'Funil de Diagnóstico'`, `'Funil de E-commerce (Venda Direta)'`, `'Funil de Webinar Pago'`, `'Funil de Isca Digital'`, `'Funil de VSL'`, `'Funil de Quiz'`, `'Lançamento'`, `'Funil de Desafio'`, `'Funil Win-Your-Money-Back'` |
| `updated_at` | sistema | `TIMESTAMPTZ NOT NULL DEFAULT now()` | Atualizado a cada salvamento |

---

## 14. Entidade: `attachments`

> ⚠️ Atualmente os arquivos são armazenados como **base64 no JSONB** de `projects.data` — isso não escala. Na migração, o conteúdo físico deve ir para o **Supabase Storage** e apenas os metadados ficam nesta tabela.

| Campo | Input | Tipo SQL sugerido | Observações |
|---|---|---|---|
| `id` | gerado | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `project_id` | FK | `UUID NOT NULL REFERENCES projects(id)` | |
| `name` | upload | `TEXT NOT NULL` | Nome original do arquivo |
| `size` | upload | `INTEGER NOT NULL` | Tamanho em bytes; máx 8 MB por arquivo, 30 MB total por projeto |
| `type` | upload | `TEXT NOT NULL` | MIME type (ex: `'application/pdf'`, `'image/png'`) |
| `storage_path` | sistema | `TEXT NOT NULL` | Caminho no Supabase Storage bucket (substitui o `data` base64 atual) |
| `uploaded_at` | sistema | `TIMESTAMPTZ NOT NULL DEFAULT now()` | |

---

## Resumo de Tipos por Categoria

| Categoria de Input | Tipo SQL Recomendado |
|---|---|
| Textos livres curtos | `TEXT` |
| Textos longos / markdown | `TEXT` |
| Emails | `TEXT NOT NULL UNIQUE` |
| Valores monetários (BRL) | `NUMERIC(12,2)` |
| Percentuais | `NUMERIC(5,2)` |
| Contagens / quantidades | `INTEGER` ou `SMALLINT` |
| Escalas (1–5) | `SMALLINT` |
| Datas | `DATE` |
| Timestamps | `TIMESTAMPTZ NOT NULL DEFAULT now()` |
| Booleanos (sim/não) | `BOOLEAN` (nullable para tristate) |
| Enums simples | `TEXT` com check constraint |
| Arrays simples | `TEXT[]` |
| Estruturas aninhadas / dinâmicas | `JSONB` |
| IDs externos / URLs | `TEXT` |
| PKs | `UUID DEFAULT gen_random_uuid()` |
| FKs | `UUID NOT NULL REFERENCES tabela(id)` |
| Outputs de IA | `TEXT` (markdown) |
