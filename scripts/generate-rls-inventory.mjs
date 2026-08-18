#!/usr/bin/env node

/**
 * Generates docs/security/RLS_TABLE_INVENTORY.md and rls-inventory.json from prisma/schema.prisma.
 * Run after schema changes: node scripts/generate-rls-inventory.mjs
 */

import fs from "node:fs";
import path from "node:path";

const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
const schema = fs.readFileSync(schemaPath, "utf8");

const SECURITY_SENSITIVE_MODELS = new Set([
  "ProviderCredential",
  "OAuthTransaction",
  "SocialCredential",
  "ProviderConnectionSecret",
  "EncryptionKeyRotation",
  "Session",
  "UserSession",
  "ApiKey",
]);

const GLOBAL_REFERENCE_MODELS = new Set([
  "Provider",
  "ProviderDefinition",
  "ProviderCapability",
  "ProviderOperation",
  "OutboundOperation",
  "MarketingChannel",
  "NotificationEventType",
  "ComplianceRuleTemplate",
  "SeoIssueType",
  "BillingPlan",
  "EntitlementDefinition",
]);

const SERVER_ONLY_PATTERNS = [
  /Job$/i,
  /Queue$/i,
  /Attempt$/i,
  /Worker/i,
  /Webhook/i,
  /SyncRun/i,
  /SyncFailure/i,
  /Inbox$/i,
  /DeadLetter/i,
  /Outbox$/i,
  /EventLog$/i,
  /ProcessingState$/i,
  /ReconciliationRun$/i,
  /AuditEvent$/i,
  /DomainEvent$/i,
];

const USER_OWNED_HINTS = ["UserProfile", "UserPreference", "UserNotificationPreference", "OnboardingProgress"];

function parseModels(source) {
  const models = [];
  const modelRegex = /^model\s+(\w+)\s*\{([^}]*)\}/gm;
  let match;
  while ((match = modelRegex.exec(source)) !== null) {
    const name = match[1];
    const body = match[2];
    const mapMatch = body.match(/@@map\("([^"]+)"\)/);
    const tableName = mapMatch ? mapMatch[1] : name;
    const fields = new Set();
    for (const line of body.split("\n")) {
      const fieldMatch = line.trim().match(/^(\w+)\s+/);
      if (fieldMatch && !line.trim().startsWith("@@")) {
        fields.add(fieldMatch[1]);
      }
    }
    models.push({ model: name, tableName, fields });
  }
  return models;
}

function classify({ model, fields }) {
  if (model === "_prisma_migrations") {
    return {
      category: "F",
      categoryLabel: "System / migration",
      ownership: "Prisma migration metadata",
      browserAccess: false,
      roles: "postgres (owner) only",
      strategy: "RLS_ENABLED_NO_CLIENT_POLICIES",
      policies: [],
      reason: "Migration history must not be exposed to Supabase API roles.",
    };
  }

  if (SECURITY_SENSITIVE_MODELS.has(model) || fields.has("accessToken") || fields.has("refreshToken")) {
    return {
      category: "E",
      categoryLabel: "Security-sensitive",
      ownership: fields.has("organisationId") ? "organisationId + encrypted credential metadata" : "server credential store",
      browserAccess: false,
      roles: "postgres (Prisma server) only",
      strategy: "RLS_ENABLED_NO_CLIENT_POLICIES",
      policies: [],
      reason: "OAuth tokens and credential material are server-only; never exposed via Data API.",
    };
  }

  if (GLOBAL_REFERENCE_MODELS.has(model)) {
    return {
      category: "C",
      categoryLabel: "Shared/global reference",
      ownership: "platform-wide reference",
      browserAccess: false,
      roles: "postgres (Prisma server) only",
      strategy: "RLS_ENABLED_NO_CLIENT_POLICIES",
      policies: [],
      reason: "Reference metadata served through application APIs, not direct SQL.",
    };
  }

  if (SERVER_ONLY_PATTERNS.some((pattern) => pattern.test(model))) {
    return {
      category: "D",
      categoryLabel: "Internal server-only",
      ownership: fields.has("organisationId") ? "organisationId (server-enforced)" : "worker infrastructure",
      browserAccess: false,
      roles: "postgres (Prisma server / workers) only",
      strategy: "RLS_ENABLED_NO_CLIENT_POLICIES",
      policies: [],
      reason: "Jobs, queues, and worker state are not browser-addressable.",
    };
  }

  if (USER_OWNED_HINTS.includes(model) || (fields.has("userId") && !fields.has("organisationId"))) {
    return {
      category: "B",
      categoryLabel: "User-owned",
      ownership: fields.has("userProfileId") ? "userProfileId" : "userId",
      browserAccess: false,
      roles: "postgres (Prisma server) only",
      strategy: "RLS_ENABLED_NO_CLIENT_POLICIES",
      policies: [],
      reason: "User profile data accessed via authenticated API routes with tenancy guards.",
    };
  }

  if (fields.has("organisationId")) {
    return {
      category: "A",
      categoryLabel: "Tenant-owned application data",
      ownership: "organisationId",
      browserAccess: false,
      roles: "postgres (Prisma server) only",
      strategy: "RLS_ENABLED_NO_CLIENT_POLICIES",
      policies: [],
      reason:
        "Tenant isolation enforced in application layer; RLS enabled with zero permissive policies blocks PostgREST access.",
    };
  }

  return {
    category: "D",
    categoryLabel: "Internal server-only (unscoped)",
    ownership: "server-managed",
    browserAccess: false,
    roles: "postgres (Prisma server) only",
    strategy: "RLS_ENABLED_NO_CLIENT_POLICIES",
    policies: [],
    reason: "No direct client access; default-deny RLS posture.",
  };
}

const models = parseModels(schema);
const inventory = models.map((model) => ({
  ...model,
  ...classify(model),
}));

const counts = inventory.reduce(
  (acc, row) => {
    acc[row.category] = (acc[row.category] ?? 0) + 1;
    return acc;
  },
  {},
);

const outDir = path.join(process.cwd(), "docs", "security");
fs.mkdirSync(outDir, { recursive: true });

const jsonPath = path.join(outDir, "rls-inventory.json");
fs.writeFileSync(
  jsonPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      prismaModelCount: models.length,
      categoryCounts: counts,
      tables: inventory.map(({ model, tableName, category, categoryLabel, ownership, browserAccess, roles, strategy, policies, reason }) => ({
        model,
        tableName,
        category,
        categoryLabel,
        ownership,
        browserAccess,
        roles,
        strategy,
        policies,
        reason,
      })),
    },
    null,
    2,
  ),
);

const mdLines = [
  "# RLS Table Inventory",
  "",
  `Generated: ${new Date().toISOString().slice(0, 10)}`,
  "",
  "## Summary",
  "",
  `| Metric | Count |`,
  `|--------|------:|`,
  `| Prisma models | ${models.length} |`,
  `| Category A — tenant-owned | ${counts.A ?? 0} |`,
  `| Category B — user-owned | ${counts.B ?? 0} |`,
  `| Category C — global/reference | ${counts.C ?? 0} |`,
  `| Category D — server-only | ${counts.D ?? 0} |`,
  `| Category E — security-sensitive | ${counts.E ?? 0} |`,
  `| Category F — system/migration | ${counts.F ?? 0} |`,
  "",
  "## Access posture",
  "",
  "All application tables use **RLS enabled with no permissive client policies** and **revoked grants**",
  "for `anon`, `authenticated`, and `service_role` on the `public` schema. Application access is",
  "exclusively through server-side Prisma as the `postgres` table owner.",
  "",
  "## Table inventory",
  "",
  "| Table | Prisma model | Category | Ownership | Browser access | Roles | RLS strategy | Reason |",
  "|-------|--------------|----------|-----------|----------------|-------|--------------|--------|",
];

for (const row of inventory) {
  mdLines.push(
    `| \`${row.tableName}\` | ${row.model} | ${row.category} (${row.categoryLabel}) | ${row.ownership} | ${row.browserAccess ? "yes" : "no"} | ${row.roles} | ${row.strategy} | ${row.reason} |`,
  );
}

fs.writeFileSync(path.join(outDir, "RLS_TABLE_INVENTORY.md"), `${mdLines.join("\n")}\n`);

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${path.join(outDir, "RLS_TABLE_INVENTORY.md")}`);
console.log("Category counts:", counts);
