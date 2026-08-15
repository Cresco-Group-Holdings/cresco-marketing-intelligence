#!/usr/bin/env node

/**
 * Generates a machine-readable inventory of Prisma models for Supabase RLS planning.
 * Run: node scripts/generate-rls-inventory.mjs
 */

import fs from "node:fs";
import path from "node:path";

const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
const outputPath = path.join(process.cwd(), "docs", "SUPABASE_RLS_INVENTORY.json");

const schema = fs.readFileSync(schemaPath, "utf8");
const modelPattern = /^model (\w+) \{([\s\S]*?)^\}/gm;

const CATEGORY_LABELS = {
  A: "Tenant-owned application data",
  B: "User-owned application data",
  C: "Global/reference data",
  D: "Internal system tables",
  E: "Background job / queue tables",
  F: "Webhook/event tables",
  G: "Audit/security tables",
  H: "Prisma/internal migration tables",
  I: "Tables that should never be exposed through Supabase Data API",
  J: "Other",
};

function classifyModel(name, body) {
  const lower = name.toLowerCase();

  if (name === "_prisma_migrations" || lower.includes("prisma_migration")) {
    return "H";
  }
  if (lower.includes("audit") || lower.includes("security")) {
    return "G";
  }
  if (lower.includes("webhook") || (lower.includes("event") && !lower.includes("prevent"))) {
    return "F";
  }
  if (
    lower.includes("job") ||
    lower.includes("queue") ||
    lower.includes("schedule") ||
    lower.includes("sync") ||
    lower.includes("processing")
  ) {
    return "E";
  }
  if (body.includes("organisationId")) {
    return "A";
  }
  if (name === "UserProfile" || (body.includes("userId") && !body.includes("organisationId"))) {
    return "B";
  }
  if (
    ["Organisation", "Project", "Brand", "OrganisationMembership", "Invitation"].includes(name)
  ) {
    return "A";
  }
  return "D";
}

const models = [];
let match;
while ((match = modelPattern.exec(schema)) !== null) {
  const [, name, body] = match;
  const category = classifyModel(name, body);
  models.push({
    model: name,
    table: name,
    schema: "public",
    category,
    categoryLabel: CATEGORY_LABELS[category],
    tenantKey: body.includes("organisationId")
      ? "organisationId"
      : body.includes("brandId")
        ? "brandId"
        : body.includes("userId")
          ? "userId"
          : null,
    rlsRequired: true,
    dataApiExposure: false,
    prismaAccess: true,
    frontendDirectAccess: false,
    recommendedPolicy: category === "A" || category === "B" ? "RLS enabled, no client policies (server-only via Prisma)" : "RLS enabled, revoke anon/authenticated grants",
  });
}

const summary = Object.fromEntries(
  Object.keys(CATEGORY_LABELS).map((key) => [key, models.filter((m) => m.category === key).length]),
);

const inventory = {
  generatedAt: new Date().toISOString(),
  totalModels: models.length,
  summaryByCategory: summary,
  categoryLabels: CATEGORY_LABELS,
  accessModel: {
    prisma: "DATABASE_URL / DIRECT_URL (postgres role, bypasses RLS)",
    supabaseClient: "Auth + Storage only (no public table queries)",
    dataApiExposure: "None — all application tables server-only",
    canonicalTenantKey: "organisationId",
    brandScopeKey: "brandId",
  },
  models,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(inventory, null, 2)}\n`);
console.log(`RLS inventory written to ${outputPath} (${models.length} models).`);
