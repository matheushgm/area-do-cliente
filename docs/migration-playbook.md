# Migration Playbook — Revenue Lab Schema v2

> Receita para executar a migração do schema JSONB (`projects.data`) para o schema normalizado (`projects_v2` + tabelas filhas) em ambiente de produção.

---

## Pré-requisitos

- [ ] Backup completo da tabela `projects` (export via Supabase Dashboard → Table Editor → Export)
- [ ] `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` disponíveis localmente
- [ ] Node.js ≥ 18 instalado
- [ ] Todas as migrations `001–015` já aplicadas no projeto Supabase
- [ ] Buckets Storage criados: `project-docs`, `brand-media`, `brand-logos`, `attachments`

---

## Ordem de execução

### Passo 1 — Freeze de escrita (opcional, recomendado para produção)

Colocar banner de manutenção ou desabilitar acesso ao app por 5–10 minutos durante a migração.

### Passo 2 — Executar script de migração de dados

```bash
# Dry run primeiro (não escreve nada)
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-from-legacy.js --dry-run

# Migração real
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-from-legacy.js
```

O script gera um arquivo `scripts/id-map-<timestamp>.json` com o mapeamento `legacyId → newUUID`.

**Nota:** Arquivos base64 (fotos, vídeos, logos, anexos) **não são migrados automaticamente**. Ver Passo 3.

### Passo 3 — Upload manual de arquivos para Storage

Para cada projeto que continha arquivos base64 (identificados pelos avisos `⚠️` do script):

1. Baixar o JSONB legado via Supabase Dashboard ou SQL:
   ```sql
   SELECT id, data->>'companyName', data->'brandFotos', data->'brandVideos',
          data->'brandKit'->>'logo', data->'attachments'
   FROM projects
   WHERE data->'brandFotos' IS NOT NULL OR data->'attachments' IS NOT NULL;
   ```

2. Para cada arquivo base64, fazer upload para o bucket correto:
   - `brand-media/{newProjectId}/{filename}` — fotos e vídeos
   - `brand-logos/{newProjectId}/logo` — logotipo
   - `attachments/{newProjectId}/{filename}` — anexos

3. Atualizar `banco_midia.logo_url`, `banco_midia.photos[].url`, `banco_midia.videos[].url` e `attachments.storage_path` com as URLs do Storage.

### Passo 4 — Verificar integridade

```sql
-- Contagem geral
SELECT
  (SELECT count(*) FROM projects)    AS legado,
  (SELECT count(*) FROM projects_v2) AS novo;

-- Verificar projetos sem account_id (possível erro de migração)
SELECT id, legacy_id FROM projects_v2 WHERE account_id IS NULL;

-- Verificar projetos com completedSteps mas sem relações correspondentes
SELECT p.id, p.legacy_id, p.completed_steps
FROM projects_v2 p
LEFT JOIN roi_calculators r ON r.project_id = p.id
WHERE 'roi' = ANY(p.completed_steps) AND r.id IS NULL;
```

### Passo 5 — Deploy do código novo

Fazer deploy da versão com:
- `AppContext.jsx` reescrito (usa `projects_v2`)
- `NewOnboarding.jsx` com campos snake_case
- Migrations `001–015` aplicadas

### Passo 6 — Limpeza do localStorage nos clientes

Cada usuário precisa limpar o localStorage antigo na primeira sessão. Para forçar isso automaticamente, adicionar ao `AppProvider` no mount:

```js
// Migração do localStorage: remover chave antiga
useEffect(() => {
  const hadLegacy = localStorage.getItem('rl_projects');
  if (hadLegacy) {
    localStorage.removeItem('rl_projects');
    localStorage.removeItem('rl_new_onboarding_draft');
    // A chave nova rl_projects_v2 será populada via sbFetchAll()
  }
}, []);
```

Ou via console do browser:
```js
localStorage.removeItem('rl_projects');
localStorage.removeItem('rl_new_onboarding_draft');
```

---

## Passos finais (pós-validação em produção)

Após confirmar que tudo funciona corretamente com `projects_v2`:

```sql
-- 1. Dropar tabela legada
DROP TABLE projects;

-- 2. Renomear projects_v2 → projects
ALTER TABLE projects_v2 RENAME TO projects;

-- 3. Renomear constraints e triggers
ALTER INDEX projects_v2_pkey RENAME TO projects_pkey;
ALTER TRIGGER projects_v2_updated_at ON projects RENAME TO projects_updated_at;

-- 4. Atualizar FKs das tabelas filhas
-- (se usou ON DELETE CASCADE, as FKs continuam válidas após rename)
```

---

## Rollback

Se algo der errado **antes** do Passo Final:

1. Fazer revert do deploy para a versão que usa `projects` (JSONB)
2. As tabelas `projects_v2` e filhas podem ser dropadas sem afetar o sistema legado:
   ```sql
   DROP TABLE IF EXISTS attachments, estrategia_v2, estrategia,
     banco_midia, landing_pages, google_ads, criativos,
     resultados, campaign_plans, ofertas, personas,
     roi_calculators, projects_v2 CASCADE;
   ```
3. Restaurar `projects` a partir do backup se necessário

---

## Pendências (Phase 5 — componentes)

Os seguintes componentes precisam ser atualizados para usar Storage em vez de base64:

| Componente | Trabalho necessário |
|---|---|
| `AnexosModule.jsx` | Substituir FileReader base64 por upload direto ao Supabase Storage (bucket `attachments`); salvar `storage_path` em vez de `data` |
| `BancoMidiaModule.jsx` | Upload de fotos/vídeos para `brand-media`, logo para `brand-logos`; salvar URLs em vez de base64 |
| `ResultadosModule.jsx` | Adaptar estrutura `b2b{month{week{...}}}` para array de rows `{ period: DATE, leads, mql, sql, vendas, investido, valor_vendas }` |

Até essa migração, os dados de Anexos e Banco de Mídia continuam funcionando em base64 (localStorage), e Resultados permanece em formato legado (não persistido na tabela `resultados`).

---

## Checklist de validação end-to-end

- [ ] Criar novo projeto pelo fluxo de onboarding → confirmar row em `projects_v2`
- [ ] Abrir projeto existente (migrado) → verificar que todos os módulos carregam dados
- [ ] Editar ROI / gerar persona / gerar oferta → confirmar upsert nas tabelas corretas
- [ ] Upload de arquivo (após Phase 5) → confirmar arquivo no Storage e metadata em tabela
- [ ] ResultadosModule: inserir dados → confirmar rows em `resultados` (após Phase 5)
- [ ] Checar RLS: usuário account não vê projetos de outros
- [ ] Verificar realtime: alterar projeto em tab A → ver atualização em tab B
