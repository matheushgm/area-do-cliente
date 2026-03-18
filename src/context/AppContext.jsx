import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import { supabase, isSupabaseReady } from "../lib/supabase";

const AppContext = createContext();

// ─── localStorage schema versioning ───────────────────────────────────────────
const LS_KEY      = "rl_projects_v2";
const LS_VER_KEY  = "rl_projects_schema_v";
const SCHEMA_VERSION = 1;

/**
 * Migrações incrementais do cache local.
 * Adicione um bloco `if (v < N)` para cada versão futura.
 */
function migrateProjects(data, fromVersion) {
  let v = fromVersion;
  // Exemplo de migração futura:
  // if (v < 2) { data = data.map(p => ({ ...p, newField: p.oldField ?? null })); v = 2; }
  void v;
  return data;
}

function loadFromStorage() {
  try {
    const raw     = localStorage.getItem(LS_KEY);
    const version = Number(localStorage.getItem(LS_VER_KEY) || 0);
    const data    = raw ? JSON.parse(raw) : [];
    if (version < SCHEMA_VERSION) {
      const migrated = migrateProjects(data, version);
      saveToStorage(migrated);
      return migrated;
    }
    return data;
  } catch { return []; }
}

function saveToStorage(data) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
    localStorage.setItem(LS_VER_KEY, String(SCHEMA_VERSION));
  } catch { /* quota exceeded — ignorar */ }
}

// ─── Helpers de usuário ────────────────────────────────────────────────────────
function enrichUser(authUser) {
  if (!authUser) return null;
  const meta    = authUser.user_metadata || {};
  const appMeta = authUser.app_metadata  || {};
  return {
    id:     authUser.id,
    email:  authUser.email,
    name:   meta.name   || authUser.email.split("@")[0],
    avatar: meta.avatar || authUser.email.slice(0, 2).toUpperCase(),
    role:   appMeta.role || "member",
  };
}

// ─── Monta objeto de projeto em memória a partir da row + relações ─────────────
// Expõe TANTO snake_case (DB) quanto camelCase (compat com componentes existentes)
function assembleProject(row, rel = {}) {
  const {
    rois        = [],
    personas    = [],
    ofertas     = [],
    campaigns   = [],
    criativos   = [],
    googleAds   = [],
    landingPages = [],
    bancoMidia  = null,
    estrategia  = null,
    estrategiaV2 = null,
    attachments = [],
    resultados  = [],
    produtos    = [],
  } = rel;

  const progress = Math.min(
    100,
    Math.round(
      ((row.completed_steps || []).filter((s) => ["roi", "strategy", "oferta"].includes(s)).length / 3) * 100,
    ),
  );

  return {
    // ── Campos DB snake_case ────────────────────────────────────────────────
    ...row,
    completed_steps: row.completed_steps || [],
    services:        row.services        || [],
    competitors:     row.competitors     || [],
    other_people:    row.other_people    || [],

    // ── Aliases camelCase para compat com componentes existentes ───────────
    companyName:          row.company_name,
    businessType:         row.business_type,
    segmento:             row.segmento,
    responsibleName:      row.responsible_name,
    responsibleRole:      row.responsible_role,
    contractModel:        row.contract_model,
    contractPaymentType:  row.contract_payment_type,
    contractValue:        row.contract_value,
    contractDate:         row.contract_date,
    hasSalesTeam:         row.has_sales_team,
    digitalMaturity:      row.digital_maturity,
    upsellPotential:      row.upsell_potential,
    upsellNotes:          row.upsell_notes,
    otherPeople:          row.other_people || [],
    servicesData:         row.services_data,
    raioXFileName:        row.raio_x_file_url,
    slaFileName:          row.sla_file_url,
    logoUrl:              row.logo_url,
    dashboardUrl:         row.dashboard_url || null,
    squad:                row.squad || null,
    accountId:            row.account_id,
    completedSteps:       row.completed_steps || [],
    createdAt:            row.created_at,
    progress,

    // ── Relações ────────────────────────────────────────────────────────────
    // Personas: mapear generated_content (DB) → generatedProfile (componente)
    personas: personas.map((p) => ({
      ...p,
      generatedProfile: p.generated_content ?? null,
    })),

    roiCalc: rois[0] ? {
      ...rois[0],
      // aliases camelCase com números — formato esperado pelo ROICalculator
      mediaOrcamento: rois[0].media_orcamento,
      custoMarketing: rois[0].custo_marketing,
      ticketMedio:    rois[0].ticket_medio,
      qtdCompras:     rois[0].qtd_compras,
      margemBruta:    rois[0].margem_bruta,
      roiDesejado:    rois[0].roi_desejado,
      taxaLead2MQL:   rois[0].taxa_lead_mql,
      taxaMQL2SQL:    rois[0].taxa_mql_sql,
      taxaSQL2Venda:  rois[0].taxa_sql_venda,
      benchmarkType:  rois[0].benchmark_type,
    } : null,
    roiResult:    rois[0]?.result ?? null,
    ofertaData: ofertas[0] ? {
      id:           ofertas[0].id,
      // Suporta tanto a row bruta do DB (com answers + generated_content)
      // quanto o objeto já montado (flat, passado pelo handler de realtime)
      ...(typeof ofertas[0].answers === 'object' && ofertas[0].answers !== null
        ? ofertas[0].answers
        : ofertas[0]),
      generatedOffer: ofertas[0].generated_content ?? ofertas[0].generatedOffer ?? null,
    } : null,
    campaignPlan: campaigns[0] ? {
      id:   campaigns[0].id,
      name: campaigns[0].name,
      ...(typeof campaigns[0].answers === 'object' && campaigns[0].answers !== null
        ? campaigns[0].answers
        : campaigns[0]),
    } : null,
    creatives: criativos.map((c) => ({
      id:      c.id,
      rating:  c.rating  ?? null,
      ...(typeof c.answers === 'object' && c.answers !== null ? c.answers : c),
      content: c.generated_content ?? c.content ?? null,
    })),
    googleAds: googleAds.map((g) => ({
      id:      g.id,
      rating:  g.rating  ?? null,
      ...(typeof g.answers === 'object' && g.answers !== null ? g.answers : g),
      content: g.generated_content ?? g.content ?? null,
    })),
    landingPages: landingPages.map((lp) => ({
      id:      lp.id,
      rating:  lp.rating ?? null,
      content: lp.generated_content ?? lp.content ?? null,
    })),
    // resultados: usa o campo JSONB `data` que preserva o objeto aninhado do componente
    resultados: resultados[0]?.data ?? {},
    attachments,

    // banco_midia: expõe tanto o objeto completo quanto aliases diretos
    bancoMidia,
    brandFotos:   bancoMidia?.photos       ?? [],
    brandVideos:  bancoMidia?.videos       ?? [],
    brandKit: bancoMidia ? {
      cores:          bancoMidia.color_palette  ?? [],
      logo:           bancoMidia.logo_url        ?? null, // path no Storage; BancoMidiaModule gera signed URL
      fontePrincipal: bancoMidia.fonte_principal ?? "",
      fonteSecundaria:bancoMidia.fonte_secundaria ?? "",
      fonteObs:       bancoMidia.fonte_obs        ?? "",
    } : null,
    observacoesMidia: bancoMidia?.observacoes ?? "",

    // estrategia
    estrategia:   estrategia
      ? { narrativa: estrategia.narrativa, updatedAt: estrategia.generated_at }
      : null,
    estrategiaV2: estrategiaV2 ?? null,

    // Links
    links: row.links || {},

    // Produtos / Serviços
    produtos: produtos.map((p) => ({
      id:      p.id,
      nome:    p.nome    || '',
      tipo:    p.tipo    || 'produto',
      answers: p.answers || {},
    })),
  };
}

// ─── Supabase: busca todos os projetos + relações ──────────────────────────────
async function sbFetchAll() {
  if (!supabase) return null;

  const { data: projects, error: pErr } = await supabase
    .from("projects_v2")
    .select("*")
    .order("created_at", { ascending: false });

  if (pErr) { console.error("[Supabase] fetch projects_v2:", pErr.message); return null; }
  if (!projects.length) return [];

  const ids = projects.map((p) => p.id);

  const [
    { data: rois },
    { data: personasData },
    { data: ofertasData },
    { data: campaignsData },
    { data: criativosData },
    { data: googleAdsData },
    { data: lpData },
    { data: bancoData },
    { data: estrategiaData },
    { data: ev2Data },
    { data: attachmentsData },
    { data: resultadosData },
    { data: produtosData },
  ] = await Promise.all([
    supabase.from("roi_calculators").select("*").in("project_id", ids),
    supabase.from("personas").select("*").in("project_id", ids),
    supabase.from("ofertas").select("*").in("project_id", ids),
    supabase.from("campaign_plans").select("*").in("project_id", ids).order("created_at", { ascending: false }),
    supabase.from("criativos").select("*").in("project_id", ids),
    supabase.from("google_ads").select("*").in("project_id", ids),
    supabase.from("landing_pages").select("*").in("project_id", ids),
    supabase.from("banco_midia").select("*").in("project_id", ids),
    supabase.from("estrategia").select("*").in("project_id", ids),
    supabase.from("estrategia_v2").select("*").in("project_id", ids),
    supabase.from("attachments").select("*").in("project_id", ids),
    supabase.from("resultados").select("*").in("project_id", ids),
    supabase.from("produtos").select("*").in("project_id", ids),
  ]);

  return projects.map((p) =>
    assembleProject(p, {
      rois:         (rois         || []).filter((r) => r.project_id === p.id),
      personas:     (personasData || []).filter((r) => r.project_id === p.id),
      ofertas:      (ofertasData  || []).filter((r) => r.project_id === p.id),
      campaigns:    (campaignsData|| []).filter((r) => r.project_id === p.id),
      criativos:    (criativosData|| []).filter((r) => r.project_id === p.id),
      googleAds:    (googleAdsData|| []).filter((r) => r.project_id === p.id),
      landingPages: (lpData       || []).filter((r) => r.project_id === p.id),
      bancoMidia:   (bancoData    || []).find ((r) => r.project_id === p.id) ?? null,
      estrategia:   (estrategiaData || []).find((r) => r.project_id === p.id) ?? null,
      estrategiaV2: (ev2Data      || []).find ((r) => r.project_id === p.id) ?? null,
      attachments:  (attachmentsData || []).filter((r) => r.project_id === p.id),
      resultados:   (resultadosData  || []).filter((r) => r.project_id === p.id),
      produtos:     (produtosData || []).filter((r) => r.project_id === p.id),
    }),
  );
}

// ─── Mapeamento patch → coluna projects_v2 ────────────────────────────────────
const PROJECT_FIELD_MAP = {
  // camelCase → snake_case
  companyName:         "company_name",
  businessType:        "business_type",
  segmento:            "segmento",
  responsibleName:     "responsible_name",
  responsibleRole:     "responsible_role",
  contractModel:       "contract_model",
  contractPaymentType: "contract_payment_type",
  contractValue:       "contract_value",
  contractDate:        "contract_date",
  competitors:         "competitors",
  hasSalesTeam:        "has_sales_team",
  digitalMaturity:     "digital_maturity",
  upsellPotential:     "upsell_potential",
  upsellNotes:         "upsell_notes",
  otherPeople:         "other_people",
  services:            "services",
  servicesData:        "services_data",
  raioXFileName:       "raio_x_file_url",
  slaFileName:         "sla_file_url",
  logoUrl:             "logo_url",
  dashboardUrl:        "dashboard_url",
  squad:               "squad",
  status:              "status",
  completedSteps:      "completed_steps",
  // snake_case passthrough (quando NewOnboarding já envia snake_case)
  company_name:         "company_name",
  business_type:        "business_type",
  responsible_name:     "responsible_name",
  responsible_role:     "responsible_role",
  contract_model:       "contract_model",
  contract_payment_type:"contract_payment_type",
  contract_value:       "contract_value",
  contract_date:        "contract_date",
  has_sales_team:       "has_sales_team",
  digital_maturity:     "digital_maturity",
  upsell_potential:     "upsell_potential",
  upsell_notes:         "upsell_notes",
  other_people:         "other_people",
  services_data:        "services_data",
  raio_x_file_url:      "raio_x_file_url",
  sla_file_url:         "sla_file_url",
  logo_url:             "logo_url",
  completed_steps:      "completed_steps",
  account_id:           "account_id",
  cnpj:                 "cnpj",
  links:                "links",
};

// ─── Supabase: update roteado por tabela ──────────────────────────────────────
async function sbUpdateProjectV2(id, patch) {
  if (!supabase) return { blocked: false };

  // ── 1. Campos da tabela projects_v2 ────────────────────────────────────────
  const projectCols = {};
  for (const [key, val] of Object.entries(patch)) {
    if (PROJECT_FIELD_MAP[key]) projectCols[PROJECT_FIELD_MAP[key]] = val;
  }
  // progress é derivado — não persiste
  if (Object.keys(projectCols).length > 0) {
    const { data, error } = await supabase.from("projects_v2").update(projectCols).eq("id", id).select("id");
    if (error) console.error("[Supabase] update projects_v2:", error.message);
    if (!error && data && data.length === 0) return { blocked: true };
  }

  // ── 2. ROI Calculator ────────────────────────────────────────────────────
  if (patch.roiCalc !== undefined) {
    const roi = patch.roiCalc || {};
    const roiId = roi.id || crypto.randomUUID();
    const { error } = await supabase.from("roi_calculators").upsert({
      id:             roiId,
      project_id:     id,
      name:           roi.name           || "Principal",
      media_orcamento:roi.mediaOrcamento  ?? roi.media_orcamento  ?? null,
      custo_marketing:roi.custoMarketing  ?? roi.custo_marketing  ?? null,
      ticket_medio:   roi.ticketMedio     ?? roi.ticket_medio     ?? null,
      qtd_compras:    roi.qtdCompras      ?? roi.qtd_compras      ?? null,
      margem_bruta:   roi.margemBruta     ?? roi.margem_bruta     ?? null,
      roi_desejado:   roi.roiDesejado     ?? roi.roi_desejado     ?? null,
      taxa_lead_mql:  roi.taxaLead2MQL    ?? roi.taxaLeadMql     ?? roi.taxa_lead_mql    ?? null,
      taxa_mql_sql:   roi.taxaMQL2SQL     ?? roi.taxaMqlSql      ?? roi.taxa_mql_sql     ?? null,
      taxa_sql_venda: roi.taxaSQL2Venda   ?? roi.taxaSqlVenda    ?? roi.taxa_sql_venda   ?? null,
      benchmark_type: roi.benchmarkType   ?? roi.benchmark_type   ?? null,
      result:         patch.roiResult     ?? roi.result           ?? null,
    }, { onConflict: "id" });
    if (error) console.error("[Supabase] upsert roi_calculators:", error.message);
  }

  // ── 3. Personas ─────────────────────────────────────────────────────────
  if (patch.personas !== undefined) {
    await supabase.from("personas").delete().eq("project_id", id);
    if (Array.isArray(patch.personas) && patch.personas.length > 0) {
      const { error } = await supabase.from("personas").insert(
        patch.personas.map((p) => ({
          id:               p.id || crypto.randomUUID(),
          project_id:       id,
          name:             p.name             || "Persona",
          answers:          p.answers          || {},
          generated_content:p.generatedProfile  ?? p.generatedContent ?? p.generated_content ?? null,
          generated_at:     p.generatedAt      ?? p.generated_at      ?? null,
        })),
      );
      if (error) console.error("[Supabase] insert personas:", error.message);
    }
  }

  // ── 4. Oferta ────────────────────────────────────────────────────────────
  if (patch.ofertaData !== undefined) {
    const oferta = patch.ofertaData || {};
    const { error } = await supabase.from("ofertas").upsert({
      id:               oferta.id || crypto.randomUUID(),
      project_id:       id,
      answers:          oferta.answers || oferta,
      generated_content:oferta.generatedOffer ?? oferta.generatedContent ?? oferta.generated_content ?? null,
      generated_at:     oferta.generatedAt    ?? oferta.generated_at    ?? null,
    }, { onConflict: "project_id" });
    if (error) console.error("[Supabase] upsert ofertas:", error.message);
  }

  // ── 5. Campaign plan ─────────────────────────────────────────────────────
  if (patch.campaignPlan !== undefined) {
    await supabase.from("campaign_plans").delete().eq("project_id", id);
    const plan = patch.campaignPlan || {};
    const hasContent = Array.isArray(plan.channels) ? plan.channels.length > 0 : (plan.orcamentoTotal > 0 || plan.totalBudget > 0);
    if (plan && hasContent) {
      const { id: _planId, ...answers } = plan;
      const { error } = await supabase.from("campaign_plans").insert({
        id:         crypto.randomUUID(),
        project_id: id,
        name:       plan.name || "Principal",
        answers,
      });
      if (error) console.error("[Supabase] insert campaign_plans:", error.message);
    }
  }

  // ── 6. Criativos ─────────────────────────────────────────────────────────
  if (patch.creatives !== undefined) {
    await supabase.from("criativos").delete().eq("project_id", id);
    if (Array.isArray(patch.creatives) && patch.creatives.length > 0) {
      const { error } = await supabase.from("criativos").insert(
        patch.creatives.map((c) => ({
          id:               c.id || crypto.randomUUID(),
          project_id:       id,
          answers:          { adTypeLabels: c.adTypeLabels, quantity: c.quantity, customNote: c.customNote, isVideo: c.isVideo },
          generated_content:c.content       ?? null,
          rating:           c.rating        ?? null,
          generated_at:     c.createdAt     ?? null,
        })),
      );
      if (error) console.error("[Supabase] insert criativos:", error.message);
    }
  }

  // ── 7. Google Ads ────────────────────────────────────────────────────────
  if (patch.googleAds !== undefined) {
    await supabase.from("google_ads").delete().eq("project_id", id);
    if (Array.isArray(patch.googleAds) && patch.googleAds.length > 0) {
      const { error } = await supabase.from("google_ads").insert(
        patch.googleAds.map((g) => ({
          id:               g.id || crypto.randomUUID(),
          project_id:       id,
          answers:          { campaignTypes: g.campaignTypes, keywordGroups: g.keywordGroups ?? [], isDraft: g.isDraft ?? false, customNote: g.customNote ?? '' },
          generated_content:g.content    ?? null,
          rating:           g.rating     ?? null,
          generated_at:     g.createdAt  ?? null,
        })),
      );
      if (error) console.error("[Supabase] insert google_ads:", error.message);
    }
  }

  // ── 8. Landing Pages ─────────────────────────────────────────────────────
  if (patch.landingPages !== undefined) {
    await supabase.from("landing_pages").delete().eq("project_id", id);
    if (Array.isArray(patch.landingPages) && patch.landingPages.length > 0) {
      const { error } = await supabase.from("landing_pages").insert(
        patch.landingPages.map((lp) => ({
          id:               lp.id || crypto.randomUUID(),
          project_id:       id,
          generated_content:lp.content     ?? lp.generatedContent ?? null,
          rating:           lp.rating      ?? null,
          generated_at:     lp.createdAt   ?? lp.generated_at     ?? null,
        })),
      );
      if (error) console.error("[Supabase] insert landing_pages:", error.message);
    }
  }

  // ── 9. Banco de Mídia ────────────────────────────────────────────────────
  const bmFields = {};
  if (patch.brandFotos  !== undefined) bmFields.photos = patch.brandFotos;
  if (patch.brandVideos !== undefined) bmFields.videos = patch.brandVideos;
  if (patch.brandKit) {
    const kit = patch.brandKit;
    if (kit.cores           !== undefined) bmFields.color_palette   = kit.cores;
    if (kit.logo            !== undefined) bmFields.logo_url        = kit.logo;
    if (kit.fontePrincipal  !== undefined) bmFields.fonte_principal = kit.fontePrincipal;
    if (kit.fonteSecundaria !== undefined) bmFields.fonte_secundaria= kit.fonteSecundaria;
    if (kit.fonteObs        !== undefined) bmFields.fonte_obs       = kit.fonteObs;
  }
  if (patch.observacoesMidia !== undefined) bmFields.observacoes = patch.observacoesMidia;
  if (Object.keys(bmFields).length > 0) {
    const { error } = await supabase.from("banco_midia").upsert(
      { project_id: id, ...bmFields },
      { onConflict: "project_id" },
    );
    if (error) console.error("[Supabase] upsert banco_midia:", error.message);
  }

  // ── 10. Estratégia ───────────────────────────────────────────────────────
  if (patch.estrategia !== undefined) {
    const narrativa = typeof patch.estrategia === "string"
      ? patch.estrategia
      : patch.estrategia?.narrativa ?? null;
    const { error } = await supabase.from("estrategia").upsert(
      { project_id: id, narrativa, generated_at: new Date().toISOString() },
      { onConflict: "project_id" },
    );
    if (error) console.error("[Supabase] upsert estrategia:", error.message);
  }

  // ── 11. Estratégia V2 ────────────────────────────────────────────────────
  if (patch.estrategiaV2 !== undefined) {
    const ev2 = patch.estrategiaV2 || {};
    const { error } = await supabase.from("estrategia_v2").upsert(
      {
        project_id:  id,
        problemas:   ev2.problemas    || [],
        swot:        ev2.swot         || {},
        concorrentes:ev2.concorrentes || [],
        riscos:      ev2.riscos       || [],
        funis:       ev2.funis        || [],
      },
      { onConflict: "project_id" },
    );
    if (error) console.error("[Supabase] upsert estrategia_v2:", error.message);
  }

  // ── 12. Resultados ───────────────────────────────────────────────────────────
  if (patch.resultados !== undefined) {
    const { error } = await supabase.from("resultados").upsert(
      { project_id: id, period: "1900-01-01", data: patch.resultados },
      { onConflict: "project_id,period" },
    );
    if (error) console.error("[Supabase] upsert resultados:", error.message);
  }

  // ── 13. Produtos / Serviços ───────────────────────────────────────────────
  if (patch.produtos !== undefined) {
    await supabase.from("produtos").delete().eq("project_id", id);
    if (Array.isArray(patch.produtos) && patch.produtos.length > 0) {
      const { error } = await supabase.from("produtos").insert(
        patch.produtos.map((p) => ({
          id:         crypto.randomUUID(), // always fresh UUID — delete+insert pattern
          project_id: id,
          nome:       p.nome    || '',
          tipo:       p.tipo    || 'produto',
          answers:    p.answers || {},
        })),
      );
      if (error) console.error("[Supabase] insert produtos:", error.message);
    }
  }

  // ── 14. Attachments (base64 por enquanto; storage_path nullable até Phase 5) ──
  if (patch.attachments !== undefined) {
    await supabase.from("attachments").delete().eq("project_id", id);
    if (Array.isArray(patch.attachments) && patch.attachments.length > 0) {
      const rows = patch.attachments
        .filter((a) => a.name && a.size && a.type)
        .map((a) => ({
          id:           a.id || crypto.randomUUID(),
          project_id:   id,
          name:         a.name,
          size:         a.size,
          type:         a.type,
          storage_path: a.storage_path ?? null, // null até migração para Storage
        }));
      if (rows.length > 0) {
        const { error } = await supabase.from("attachments").insert(rows);
        if (error) console.error("[Supabase] insert attachments:", error.message);
      }
    }
  }

  // ── 13. Resultados (TODO Phase 5: ResultadosModule devolverá array de rows) ──
  // Por enquanto não persiste: a estrutura legada (nested object) não mapeia
  // diretamente para a tabela normalizada. Será tratado em Phase 5.

  return { blocked: false };
}

async function sbDeleteProject(id) {
  if (!supabase) return;
  const { error } = await supabase.from("projects_v2").delete().eq("id", id);
  if (error) console.error("[Supabase] delete projects_v2:", error.message);
}

async function syncProfileIfExists(authUser) {
  if (!supabase || !authUser) return false;
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", authUser.id)
    .maybeSingle();
  if (error) { console.error("[Supabase] profile check:", error.message); return false; }
  if (!data) return false;
  const profile = enrichUser(authUser);
  await supabase.from("profiles").update({
    name:   profile.name,
    email:  profile.email,
    avatar: profile.avatar,
  }).eq("id", profile.id);
  return true;
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AppProvider({ children }) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const [user, setUser]             = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authError, setAuthError]   = useState(null);

  // ── Projects ──────────────────────────────────────────────────────────────
  const [projects, setProjects] = useState(loadFromStorage);

  const [loadingProjects, setLoadingProjects] = useState(isSupabaseReady);
  const pendingWrites = useRef(0);
  const upsertTimers  = useRef({});

  // ── Team members ──────────────────────────────────────────────────────────
  const [teamMembers, setTeamMembers] = useState([]);

  // ── Squads ────────────────────────────────────────────────────────────────
  const [squads, setSquads] = useState([]);

  // ── Auth session restore + listener ───────────────────────────────────────
  useEffect(() => {
    if (!supabase) { setLoadingAuth(false); return; }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(enrichUser(session?.user ?? null));
      setLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        syncProfileIfExists(session.user).then((exists) => {
          if (!exists) {
            supabase.auth.signOut();
            setAuthError("Acesso não autorizado. Entre em contato com o administrador.");
          } else {
            setAuthError(null);
            setUser(enrichUser(session.user));
          }
        });
      } else {
        setUser(enrichUser(session?.user ?? null));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Cloud sync — re-executa quando usuário muda (login/logout) ───────────
  useEffect(() => {
    if (!isSupabaseReady) return;

    if (!user) {
      setProjects([]);
      saveToStorage([]);
      setLoadingProjects(false);
      return;
    }

    setLoadingProjects(true);
    sbFetchAll()
      .then((rows) => {
        if (rows !== null) {
          setProjects(rows);
          saveToStorage(rows);
        }
      })
      .catch((err) => console.error("Erro ao carregar projetos:", err))
      .finally(() => setLoadingProjects(false));

    supabase
      .from("profiles")
      .select("*")
      .eq("disabled", false)
      .then(({ data, error }) => {
        if (error) { console.error("Erro ao carregar membros:", error); return; }
        if (data) setTeamMembers(data);
      });

    supabase
      .from("squads")
      .select("*")
      .order("created_at")
      .then(({ data, error }) => {
        if (error) { console.error("Erro ao carregar squads:", error); return; }
        if (data) setSquads(data);
      });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Real-time subscription (projects_v2) ──────────────────────────────────
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("projects-v2-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "projects_v2" },
        ({ new: row }) => {
          if (pendingWrites.current > 0) return;
          const project = assembleProject(row);
          setProjects((prev) => {
            const updated = [project, ...prev];
            saveToStorage(updated);
            return updated;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "projects_v2" },
        ({ new: row }) => {
          if (pendingWrites.current > 0) return;
          setProjects((prev) => {
            const updated = prev.map((p) => {
              if (p.id !== row.id) return p;
              // Preservar relações que não vêm do realtime
              return assembleProject(row, {
                rois:        p.roiCalc ? [{ ...p.roiCalc, result: p.roiResult }] : [],
                personas:    p.personas    || [],
                ofertas:     p.ofertaData  ? [p.ofertaData] : [],
                campaigns:   p.campaignPlan? [p.campaignPlan] : [],
                criativos:   p.creatives   || [],
                googleAds:   p.googleAds   || [],
                landingPages:p.landingPages|| [],
                bancoMidia:  p.bancoMidia  || null,
                estrategia:  p.estrategia ? { narrativa: p.estrategia.narrativa } : null,
                estrategiaV2:p.estrategiaV2|| null,
                attachments: p.attachments || [],
                resultados:  p.resultados  || [],
                produtos:    p.produtos    || [],
              });
            });
            saveToStorage(updated);
            return updated;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "projects_v2" },
        ({ old: row }) => {
          if (pendingWrites.current > 0) return;
          setProjects((prev) => {
            const updated = prev.filter((p) => p.id !== row.id);
            saveToStorage(updated);
            return updated;
          });
        },
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  // ── Auth actions ──────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    if (!supabase) return { ok: false, error: "Supabase não configurado." };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    return { ok: true, user: enrichUser(data.user) };
  }, []);

  const logout = useCallback(async () => {
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_VER_KEY);
    if (supabase) await supabase.auth.signOut();
  }, []);

  const loginWithGoogle = useCallback(async () => {
    if (!supabase) return { ok: false, error: "Supabase não configurado." };
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }, []);

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const addProject = useCallback(
    (data) => {
      const id  = data.id || crypto.randomUUID();
      const now = new Date().toISOString();

      // Aceita tanto snake_case (NewOnboarding atualizado) quanto camelCase (legado)
      const row = {
        id,
        legacy_id:             null,
        company_name:          data.company_name          ?? data.companyName          ?? "",
        cnpj:                  data.cnpj                  ?? null,
        business_type:         data.business_type         ?? data.businessType         ?? "",
        segmento:              data.segmento              ?? null,
        responsible_name:      data.responsible_name      ?? data.responsibleName      ?? "",
        responsible_role:      data.responsible_role      ?? data.responsibleRole      ?? null,
        contract_model:        data.contract_model        ?? data.contractModel        ?? "",
        contract_payment_type: data.contract_payment_type ?? data.contractPaymentType  ?? null,
        contract_value:        data.contract_value        ?? data.contractValue        ?? null,
        contract_date:         data.contract_date         ?? data.contractDate         ?? null,
        competitors:           data.competitors           ?? [],
        has_sales_team:        data.has_sales_team        ?? data.hasSalesTeam         ?? null,
        digital_maturity:      data.digital_maturity      ?? data.digitalMaturity      ?? null,
        upsell_potential:      data.upsell_potential      ?? data.upsellPotential      ?? null,
        upsell_notes:          data.upsell_notes          ?? data.upsellNotes          ?? null,
        other_people:          data.other_people          ?? data.otherPeople          ?? [],
        services:              data.services              ?? [],
        services_data:         data.services_data         ?? data.servicesData         ?? null,
        raio_x_file_url:       data.raio_x_file_url       ?? data.raioXFileName        ?? null,
        sla_file_url:          data.sla_file_url          ?? data.slaFileName          ?? null,
        account_id:            user?.id,
        status:                "onboarding",
        completed_steps:       [],
        created_at:            now,
        updated_at:            now,
      };

      const project = assembleProject(row);

      setProjects((prev) => {
        const updated = [project, ...prev];
        saveToStorage(updated);
        return updated;
      });

      pendingWrites.current += 1;
      supabase?.from("projects_v2").insert(row)
        .then(({ error }) => { if (error) console.error("[Supabase] addProject:", error.message); })
        .finally(() => { pendingWrites.current -= 1; });

      return project;
    },
    [user],
  );

  const updateProject = useCallback((id, patch) => {
    setProjects((prev) => {
      const before = prev.find((p) => p.id === id);
      const updated = prev.map((p) => {
        if (p.id !== id) return p;
        const merged = { ...p, ...patch };
        // Sync snake_case ↔ camelCase para campos de projects_v2
        if (patch.completedSteps !== undefined) merged.completed_steps = patch.completedSteps;
        if (patch.completed_steps !== undefined) merged.completedSteps = patch.completed_steps;
        if (patch.status !== undefined) merged.status = patch.status;
        return merged;
      });

      const merged = updated.find((p) => p.id === id);
      if (merged) {
        clearTimeout(upsertTimers.current[id]);
        upsertTimers.current[id] = setTimeout(() => {
          pendingWrites.current += 1;
          sbUpdateProjectV2(id, patch)
            .then(({ blocked }) => {
              if (blocked && before) {
                setProjects((cur) => {
                  const reverted = cur.map((p) => p.id === id ? before : p);
                  saveToStorage(reverted);
                  return reverted;
                });
              }
            })
            .catch((err) => console.error("Erro ao atualizar:", err))
            .finally(() => { pendingWrites.current -= 1; });
        }, 1000);
      }

      saveToStorage(updated);
      return updated;
    });
  }, []);

  const deleteProject = useCallback((id) => {
    setProjects((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      saveToStorage(updated);
      return updated;
    });
    sbDeleteProject(id);
  }, []);

  // ── Squads CRUD ───────────────────────────────────────────────────────────
  const addSquad = useCallback(async (data) => {
    if (!supabase) return { error: "Supabase não configurado." };
    const { data: row, error } = await supabase
      .from("squads")
      .insert({ name: data.name, emoji: data.emoji || null, members: data.members || [] })
      .select()
      .single();
    if (error) return { error: error.message };
    setSquads((prev) => [...prev, row]);
    return { data: row };
  }, []);

  const updateSquad = useCallback(async (id, data) => {
    if (!supabase) return { error: "Supabase não configurado." };
    const { data: row, error } = await supabase
      .from("squads")
      .update({ name: data.name, emoji: data.emoji ?? null, members: data.members || [] })
      .eq("id", id)
      .select()
      .single();
    if (error) return { error: error.message };
    setSquads((prev) => prev.map((s) => (s.id === id ? row : s)));
    return { data: row };
  }, []);

  const deleteSquad = useCallback(async (id) => {
    if (!supabase) return { error: "Supabase não configurado." };
    const { error } = await supabase.from("squads").delete().eq("id", id);
    if (error) return { error: error.message };
    setSquads((prev) => prev.filter((s) => s.id !== id));
    return {};
  }, []);

  // ── Context value ─────────────────────────────────────────────────────────
  const value = {
    user,
    loadingAuth,
    authError,
    projects,
    loadingProjects,
    login,
    logout,
    loginWithGoogle,
    addProject,
    updateProject,
    deleteProject,
    isSupabaseReady,
    teamMembers,
    squads,
    addSquad,
    updateSquad,
    deleteSquad,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be inside AppProvider");
  return ctx;
};
