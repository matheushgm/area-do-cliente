#!/usr/bin/env node
/**
 * migrate-from-legacy.js
 * Migra dados da tabela `projects` (JSONB) para o schema normalizado (projects_v2 + tabelas filhas).
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-from-legacy.js
 *
 * Flags opcionais:
 *   --dry-run   Apenas lê e mostra o que seria migrado, sem escrever no banco
 *   --project-id=<id>  Migra apenas um projeto específico (legacy_id)
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { writeFileSync } from "fs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DRY_RUN     = process.argv.includes("--dry-run");
const TARGET_ID   = process.argv.find((a) => a.startsWith("--project-id="))?.split("=")[1];
const idMap       = {};   // legacyId → newUUID

// ─── Helpers ────────────────────────────────────────────────────────────────
function log(...args) { console.log(...args); }
function warn(...args) { console.warn("⚠️ ", ...args); }

async function insert(table, rows) {
  if (DRY_RUN) { log(`  [dry] INSERT ${table} (${rows.length} rows)`); return; }
  const { error } = await supabase.from(table).insert(rows);
  if (error) warn(`INSERT ${table}: ${error.message}`);
}

async function upsert(table, rows, opts = {}) {
  if (DRY_RUN) { log(`  [dry] UPSERT ${table} (${rows.length} rows)`); return; }
  const { error } = await supabase.from(table).upsert(rows, opts);
  if (error) warn(`UPSERT ${table}: ${error.message}`);
}

// ─── Converte data legada → row de projects_v2 ────────────────────────────────
function buildProjectRow(legacyId, d, accountId) {
  return {
    id:                    randomUUID(),
    legacy_id:             String(legacyId),
    company_name:          d.companyName          ?? d.company_name          ?? "",
    cnpj:                  d.cnpj                 ?? null,
    business_type:         d.businessType         ?? d.business_type         ?? "b2b",
    segmento:              d.segmento             ?? null,
    responsible_name:      d.responsibleName      ?? d.responsible_name      ?? "",
    responsible_role:      d.responsibleRole      ?? d.responsible_role      ?? null,
    contract_model:        d.contractModel        ?? d.contract_model        ?? "aceleracao",
    contract_payment_type: d.contractPaymentType  ?? d.contract_payment_type ?? null,
    contract_value:        d.contractValue        ?? d.contract_value        ?? null,
    contract_date:         d.contractDate         ?? d.contract_date         ?? null,
    competitors:           d.competitors          ?? [],
    has_sales_team:        d.hasSalesTeam         ?? d.has_sales_team        ?? null,
    digital_maturity:      d.digitalMaturity      ?? d.digital_maturity      ?? null,
    upsell_potential:      d.upsellPotential      ?? d.upsell_potential      ?? null,
    upsell_notes:          d.upsellNotes          ?? d.upsell_notes          ?? null,
    other_people:          d.otherPeople          ?? d.other_people          ?? [],
    services:              d.services             ?? [],
    services_data:         d.servicesData         ?? d.services_data         ?? null,
    raio_x_file_url:       d.raioXFileName        ?? d.raio_x_file_url       ?? null,
    sla_file_url:          d.slaFileName          ?? d.sla_file_url          ?? null,
    account_id:            d.accountId            ?? accountId,
    status:                d.status               ?? "onboarding",
    completed_steps:       d.completedSteps       ?? d.completed_steps       ?? [],
    created_at:            d.createdAt            ?? d.created_at            ?? new Date().toISOString(),
    updated_at:            d.updatedAt            ?? d.updated_at            ?? new Date().toISOString(),
  };
}

// ─── Migra roi_calculators ────────────────────────────────────────────────────
async function migrateROI(projectId, d) {
  const roi = d.roiCalc ?? d.roi_calc;
  if (!roi) return;
  await upsert("roi_calculators", [{
    id:              randomUUID(),
    project_id:      projectId,
    name:            roi.name            ?? "Principal",
    media_orcamento: roi.mediaOrcamento  ?? roi.media_orcamento  ?? null,
    custo_marketing: roi.custoMarketing  ?? roi.custo_marketing  ?? null,
    ticket_medio:    roi.ticketMedio     ?? roi.ticket_medio     ?? null,
    qtd_compras:     roi.qtdCompras      ?? roi.qtd_compras      ?? null,
    margem_bruta:    roi.margemBruta     ?? roi.margem_bruta     ?? null,
    roi_desejado:    roi.roiDesejado     ?? roi.roi_desejado     ?? null,
    taxa_lead_mql:   roi.taxaLead2MQL    ?? roi.taxaLeadMql     ?? roi.taxa_lead_mql    ?? null,
    taxa_mql_sql:    roi.taxaMQL2SQL     ?? roi.taxaMqlSql      ?? roi.taxa_mql_sql     ?? null,
    taxa_sql_venda:  roi.taxaSQL2Venda   ?? roi.taxaSqlVenda    ?? roi.taxa_sql_venda   ?? null,
    benchmark_type:  roi.benchmarkType   ?? roi.benchmark_type   ?? null,
    result:          d.roiResult         ?? null,
  }], { onConflict: "id" });
}

// ─── Migra personas ───────────────────────────────────────────────────────────
async function migratePersonas(projectId, d) {
  const personas = d.personas;
  if (!Array.isArray(personas) || personas.length === 0) return;
  await insert("personas", personas.map((p) => ({
    id:               randomUUID(),
    project_id:       projectId,
    name:             p.name             ?? "Persona",
    answers:          p.answers          ?? {},
    generated_content:p.generatedProfile  ?? p.generatedContent ?? p.generated_content ?? null,
    generated_at:     p.generatedAt      ?? p.generated_at      ?? null,
  })));
}

// ─── Migra ofertas ────────────────────────────────────────────────────────────
async function migrateOferta(projectId, d) {
  const oferta = d.ofertaData ?? d.oferta_data;
  if (!oferta) return;
  await upsert("ofertas", [{
    id:               randomUUID(),
    project_id:       projectId,
    answers:          oferta.answers ?? oferta,
    generated_content:oferta.generatedOffer ?? oferta.generatedContent ?? oferta.generated_content ?? null,
    generated_at:     oferta.generatedAt    ?? oferta.generated_at     ?? null,
  }], { onConflict: "project_id" });
}

// ─── Migra campaign_plans ─────────────────────────────────────────────────────
async function migrateCampaignPlan(projectId, d) {
  const plan = d.campaignPlan ?? d.campaign_plan;
  if (!plan) return;
  await upsert("campaign_plans", [{
    id:         randomUUID(),
    project_id: projectId,
    name:       plan.name    ?? "Principal",
    answers:    plan.answers ?? plan,
  }], { onConflict: "id" });
}

// ─── Migra criativos ──────────────────────────────────────────────────────────
async function migrateCriativos(projectId, d) {
  const creatives = d.creatives ?? [];
  if (!Array.isArray(creatives) || creatives.length === 0) return;
  await insert("criativos", creatives.map((c) => ({
    id:               randomUUID(),
    project_id:       projectId,
    answers:          { adTypeLabels: c.adTypeLabels, quantity: c.quantity, customNote: c.customNote, isVideo: c.isVideo },
    generated_content:c.content    ?? null,
    rating:           c.rating     ?? null,
    generated_at:     c.createdAt  ?? null,
  })));
}

// ─── Migra google_ads ─────────────────────────────────────────────────────────
async function migrateGoogleAds(projectId, d) {
  const ads = d.googleAds ?? d.google_ads ?? [];
  if (!Array.isArray(ads) || ads.length === 0) return;
  await insert("google_ads", ads.map((g) => ({
    id:               randomUUID(),
    project_id:       projectId,
    answers:          { campaignTypes: g.campaignTypes, keywords: g.keywords, city: g.city },
    generated_content:g.content   ?? null,
    rating:           g.rating    ?? null,
    generated_at:     g.createdAt ?? null,
  })));
}

// ─── Migra landing_pages ──────────────────────────────────────────────────────
async function migrateLandingPages(projectId, d) {
  const lps = d.landingPages ?? d.landing_pages ?? [];
  if (!Array.isArray(lps) || lps.length === 0) return;
  await insert("landing_pages", lps.map((lp) => ({
    id:               randomUUID(),
    project_id:       projectId,
    generated_content:lp.content ?? lp.generatedContent ?? null,
    rating:           lp.rating  ?? null,
    generated_at:     lp.createdAt ?? lp.generated_at ?? null,
  })));
}

// ─── Migra estrategia ─────────────────────────────────────────────────────────
async function migrateEstrategia(projectId, d) {
  const e = d.estrategia;
  if (!e) return;
  const narrativa = typeof e === "string" ? e : e.narrativa ?? null;
  if (!narrativa) return;
  await upsert("estrategia", [{
    project_id:   projectId,
    narrativa,
    generated_at: e.updatedAt ?? e.generated_at ?? null,
  }], { onConflict: "project_id" });
}

// ─── Migra estrategia_v2 ──────────────────────────────────────────────────────
async function migrateEstrategiaV2(projectId, d) {
  const ev2 = d.estrategiaV2 ?? d.estrategia_v2;
  if (!ev2) return;
  await upsert("estrategia_v2", [{
    project_id:   projectId,
    problemas:    ev2.problemas    ?? [],
    swot:         ev2.swot         ?? {},
    concorrentes: ev2.concorrentes ?? [],
    riscos:       ev2.riscos       ?? [],
    funis:        ev2.funis        ?? [],
  }], { onConflict: "project_id" });
}

// ─── Migra banco_midia (sem upload de binários) ───────────────────────────────
async function migrateBancoMidia(projectId, d) {
  const kit  = d.brandKit   ?? {};
  const fotos  = d.brandFotos  ?? [];
  const videos = d.brandVideos ?? [];

  // Filtra base64 (fotos/vídeos que têm campo `data` são base64 — precisam de Storage)
  const photosClean = fotos.map(({ data: _omit, ...rest }) => rest);
  const videosClean = videos.map(({ data: _omit, ...rest }) => rest);

  const hasData = photosClean.length > 0 || videosClean.length > 0 ||
    kit.colorPalette?.length > 0 || kit.fontePrincipal || d.observacoesMidia;
  if (!hasData) return;

  await upsert("banco_midia", [{
    project_id:      projectId,
    photos:          photosClean.length ? photosClean : null,
    videos:          videosClean.length ? videosClean : null,
    color_palette:   kit.colorPalette    ?? null,
    logo_url:        null,   // base64 logo não migrado; fazer upload manual
    fonte_principal: kit.fontePrincipal  ?? null,
    fonte_secundaria:kit.fonteSecundaria ?? null,
    fonte_obs:       kit.fonteObs        ?? null,
    observacoes:     d.observacoesMidia  ?? null,
  }], { onConflict: "project_id" });

  if (fotos.some((f) => f.data) || videos.some((v) => v.data) || kit.logo) {
    warn(`Projeto ${projectId}: arquivos base64 (fotos/vídeos/logo) não migrados → fazer upload manual para Storage`);
  }
}

// ─── Migra attachments (sem upload de binários) ───────────────────────────────
async function migrateAttachments(projectId, d) {
  const attachments = d.attachments ?? [];
  if (!Array.isArray(attachments) || attachments.length === 0) return;
  const rows = attachments.map((a) => ({
    id:           randomUUID(),
    project_id:   projectId,
    name:         a.name,
    size:         a.size,
    type:         a.type ?? "application/octet-stream",
    storage_path: null,   // base64 não migrado; null até upload manual
    uploaded_at:  a.uploadedAt ?? a.uploaded_at ?? new Date().toISOString(),
  }));
  await insert("attachments", rows);
  if (attachments.some((a) => a.data)) {
    warn(`Projeto ${projectId}: ${attachments.filter((a) => a.data).length} anexo(s) base64 não migrados → fazer upload manual`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  log(`\n🚀 Iniciando migração${DRY_RUN ? " (DRY RUN)" : ""}...\n`);

  // Buscar projetos legados
  let query = supabase.from("projects").select("id, data");
  if (TARGET_ID) query = query.eq("id", TARGET_ID);
  const { data: legacyRows, error } = await query;
  if (error) { console.error("❌ Erro ao ler tabela projects:", error.message); process.exit(1); }

  log(`📦 ${legacyRows.length} projeto(s) encontrado(s) na tabela legada\n`);

  for (const row of legacyRows) {
    const legacyId = row.id;
    const d        = row.data ?? {};
    log(`─── Projeto legado: ${legacyId} (${d.companyName ?? d.company_name ?? "sem nome"})`);

    const projectRow = buildProjectRow(legacyId, d, d.accountId ?? d.account_id);
    const newId      = projectRow.id;
    idMap[legacyId]  = newId;

    // 1. projects_v2
    if (DRY_RUN) {
      log(`  [dry] INSERT projects_v2 → ${newId}`);
    } else {
      const { error: pErr } = await supabase.from("projects_v2").insert(projectRow);
      if (pErr) { warn(`INSERT projects_v2: ${pErr.message}`); continue; }
      log(`  ✓ projects_v2 → ${newId}`);
    }

    // 2. Tabelas filhas
    await migrateROI(newId, d);
    await migratePersonas(newId, d);
    await migrateOferta(newId, d);
    await migrateCampaignPlan(newId, d);
    await migrateCriativos(newId, d);
    await migrateGoogleAds(newId, d);
    await migrateLandingPages(newId, d);
    await migrateEstrategia(newId, d);
    await migrateEstrategiaV2(newId, d);
    await migrateBancoMidia(newId, d);
    await migrateAttachments(newId, d);

    log(`  ✓ Relações migradas\n`);
  }

  // Salvar mapeamento
  const mapPath = `./scripts/id-map-${Date.now()}.json`;
  writeFileSync(mapPath, JSON.stringify(idMap, null, 2));
  log(`\n✅ Migração concluída. Mapeamento salvo em: ${mapPath}`);
  log(`\n📌 Próximos passos:`);
  log(`   1. Verificar integridade: SELECT count(*) FROM projects_v2;`);
  log(`   2. Fazer upload manual dos arquivos base64 para Supabase Storage`);
  log(`   3. Limpar localStorage no browser: localStorage.clear()`);
  log(`   4. Em produção: após validar, dropar projects e renomear projects_v2 → projects`);
}

main().catch((err) => { console.error("❌ Erro fatal:", err); process.exit(1); });
