#!/usr/bin/env node
/**
 * migrate-attachments-to-storage.js
 * Faz upload dos arquivos base64 da tabela legada `projects` para o Supabase Storage
 * e atualiza storage_path em `attachments` e logo_url em `banco_midia`.
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-attachments-to-storage.js
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Ler mapeamento legacyId → newUUID (pega o mais recente)
const mapFiles = (await import("fs")).readdirSync("./scripts").filter(f => f.startsWith("id-map-")).sort();
if (!mapFiles.length) { console.error("❌ Nenhum id-map-*.json encontrado em scripts/"); process.exit(1); }
const idMap = JSON.parse(readFileSync(`./scripts/${mapFiles.at(-1)}`, "utf8"));
console.log(`📋 Usando mapeamento: ${mapFiles.at(-1)}\n`);

// ─── Helper: base64 data URI → Buffer + contentType ───────────────────────────
function parseDataUri(dataUri) {
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) return null;
  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

// ─── Helper: sanitiza nome de arquivo para Storage ────────────────────────────
function safeName(name) {
  return name.replace(/[^a-zA-Z0-9._\-]/g, "_").replace(/_+/g, "_");
}

// ─── Upload para Storage ──────────────────────────────────────────────────────
async function upload(bucket, path, buffer, contentType) {
  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Storage upload (${bucket}/${path}): ${error.message}`);
  return path;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const { data: legacyRows } = await supabase.from("projects").select("id, data");

let totalUploaded = 0, totalErrors = 0;

for (const row of legacyRows) {
  const d        = row.data ?? {};
  const newId    = idMap[String(row.id)];
  const name     = d.companyName ?? d.company_name ?? row.id;

  if (!newId) { console.warn(`⚠️  Sem mapeamento para ${row.id} — pulando`); continue; }

  // ── Anexos (PDFs / docs) ─────────────────────────────────────────────────
  const attachments = (d.attachments ?? []).filter(a => a.data?.startsWith("data:"));
  if (attachments.length) {
    console.log(`\n📁 ${name} — ${attachments.length} anexo(s)`);
    for (const a of attachments) {
      const parsed = parseDataUri(a.data);
      if (!parsed) { console.warn(`  ⚠️  Formato inválido: ${a.name}`); continue; }

      const storagePath = `${newId}/${safeName(a.name)}`;
      try {
        await upload("attachments", storagePath, parsed.buffer, parsed.contentType);
        // Atualizar storage_path na tabela attachments
        const { error } = await supabase
          .from("attachments")
          .update({ storage_path: storagePath })
          .eq("project_id", newId)
          .eq("name", a.name);
        if (error) throw new Error(error.message);
        console.log(`  ✓ ${a.name} (${Math.round(parsed.buffer.length / 1024)} KB)`);
        totalUploaded++;
      } catch (err) {
        console.error(`  ❌ ${a.name}: ${err.message}`);
        totalErrors++;
      }
    }
  }

  // ── Logo ─────────────────────────────────────────────────────────────────
  const logo = d.brandKit?.logo;
  if (logo?.startsWith("data:")) {
    const parsed = parseDataUri(logo);
    if (parsed) {
      const ext = parsed.contentType.split("/")[1] ?? "png";
      const storagePath = `${newId}/logo.${ext}`;
      try {
        await upload("brand-logos", storagePath, parsed.buffer, parsed.contentType);
        const { error } = await supabase
          .from("banco_midia")
          .upsert({ project_id: newId, logo_url: storagePath }, { onConflict: "project_id" });
        if (error) throw new Error(error.message);
        console.log(`\n🏷  ${name} — logo migrada (${Math.round(parsed.buffer.length / 1024)} KB)`);
        totalUploaded++;
      } catch (err) {
        console.error(`\n❌ ${name} logo: ${err.message}`);
        totalErrors++;
      }
    }
  }
}

console.log(`\n─────────────────────────────────`);
console.log(`✅ Uploads: ${totalUploaded} | ❌ Erros: ${totalErrors}`);
if (totalErrors === 0) console.log(`\n🎉 Todos os arquivos migrados com sucesso!`);
else console.log(`\n⚠️  Verifique os erros acima e rode novamente se necessário.`);
