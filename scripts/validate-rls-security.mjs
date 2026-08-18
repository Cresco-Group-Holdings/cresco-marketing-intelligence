#!/usr/bin/env node

/**
 * CI guard: ensures Supabase RLS hardening migrations, inventory, and controls are present.
 */

import fs from "node:fs";
import path from "node:path";

const errors = [];
const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
const hardeningMigration = "20260811120000_supabase_rls_hardening";
const reconciliationMigration = "20260818120000_supabase_rls_reconciliation";
const hardeningSqlPath = path.join(migrationsDir, hardeningMigration, "migration.sql");
const reconciliationSqlPath = path.join(migrationsDir, reconciliationMigration, "migration.sql");
const inventoryPath = path.join(process.cwd(), "docs", "security", "rls-inventory.json");
const exceptionsPath = path.join(process.cwd(), "docs", "security", "rls-exceptions.json");
const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");

function countPrismaModels(schema) {
  return (schema.match(/^model\s+\w+\s*\{/gm) ?? []).length;
}

function assertMigrationFragments(sqlPath, migrationName, fragments) {
  if (!fs.existsSync(sqlPath)) {
    errors.push(`Missing required migration: ${migrationName}`);
    return;
  }

  const sql = fs.readFileSync(sqlPath, "utf8");

  for (const fragment of fragments) {
    if (!sql.includes(fragment)) {
      errors.push(`${migrationName} missing required fragment: ${fragment}`);
    }
  }

  if (/USING\s*\(\s*true\s*\)/i.test(sql)) {
    errors.push(`${migrationName} contains permissive USING (true) policy — not allowed.`);
  }
}

assertMigrationFragments(hardeningSqlPath, hardeningMigration, [
  "ENABLE ROW LEVEL SECURITY",
  "ARRAY['anon', 'authenticated', 'service_role']",
  "REVOKE ALL ON ALL TABLES IN SCHEMA public",
  "REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC",
  "REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC",
  "ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public",
  "ensure_public_table_rls",
  "ensure_public_function_privileges",
  "trg_ensure_public_table_rls",
  "trg_ensure_public_function_privileges",
  "_prisma_migrations",
  "SET search_path = public, pg_temp",
  "pg_roles WHERE rolname = api_role",
]);

assertMigrationFragments(reconciliationSqlPath, reconciliationMigration, [
  "is_organisation_member",
  "ENABLE ROW LEVEL SECURITY",
  "REVOKE ALL ON ALL TABLES IN SCHEMA public",
  "REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC",
  "_prisma_migrations",
  "SET search_path = public, pg_temp",
]);

if (!fs.existsSync(inventoryPath)) {
  errors.push("Missing docs/security/rls-inventory.json — run: node scripts/generate-rls-inventory.mjs");
} else if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, "utf8");
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
  const modelCount = countPrismaModels(schema);
  const inventoryCount = inventory.tables?.length ?? 0;

  if (inventoryCount !== modelCount) {
    errors.push(
      `RLS inventory out of date: ${inventoryCount} tables documented, ${modelCount} Prisma models. Run node scripts/generate-rls-inventory.mjs`,
    );
  }

  for (const table of inventory.tables ?? []) {
    if (!table.strategy || !table.strategy.includes("RLS_ENABLED")) {
      errors.push(`Table ${table.tableName} lacks RLS_ENABLED strategy in inventory.`);
    }
    if (table.browserAccess === true && table.category !== "C") {
      errors.push(`Table ${table.tableName} claims browser access without global-reference category.`);
    }
  }
}

if (!fs.existsSync(exceptionsPath)) {
  errors.push("Missing docs/security/rls-exceptions.json");
} else {
  const exceptions = JSON.parse(fs.readFileSync(exceptionsPath, "utf8"));
  if (!Array.isArray(exceptions.exceptions)) {
    errors.push("rls-exceptions.json must define an exceptions array.");
  }
}

const requiredDocs = [
  "docs/security/RLS_ACCESS_MODEL.md",
  "docs/security/RLS_TABLE_INVENTORY.md",
  "docs/security/RLS_GRANTS_AUDIT.md",
  "docs/security/SUPABASE_RLS_DEPLOYMENT.md",
];

for (const doc of requiredDocs) {
  if (!fs.existsSync(path.join(process.cwd(), doc))) {
    errors.push(`Missing required security doc: ${doc}`);
  }
}

const migrationFolders = fs
  .readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const hardeningIndex = migrationFolders.indexOf(hardeningMigration);
if (hardeningIndex === -1) {
  errors.push("RLS hardening migration folder not found.");
} else {
  for (const folder of migrationFolders.slice(hardeningIndex + 1)) {
    const sqlPath = path.join(migrationsDir, folder, "migration.sql");
    if (!fs.existsSync(sqlPath)) {
      continue;
    }

    const sql = fs.readFileSync(sqlPath, "utf8");

    if (/GRANT\s+.*\s+TO\s+(anon|authenticated|service_role|PUBLIC)/i.test(sql)) {
      errors.push(`Migration ${folder} grants privileges to API-facing or PUBLIC roles.`);
    }

    if (/GRANT\s+EXECUTE\s+ON\s+FUNCTION/i.test(sql) && /TO\s+PUBLIC/i.test(sql)) {
      errors.push(`Migration ${folder} grants EXECUTE on functions to PUBLIC.`);
    }

    if (/USING\s*\(\s*true\s*\)/i.test(sql)) {
      errors.push(`Migration ${folder} contains permissive USING (true) RLS policy.`);
    }

    if (/DISABLE ROW LEVEL SECURITY/i.test(sql)) {
      errors.push(`Migration ${folder} disables row level security.`);
    }
  }
}

if (errors.length > 0) {
  console.error("RLS security validation failed:\n");
  for (const message of errors) {
    console.error(`- ${message}`);
  }
  process.exit(1);
}

console.log("RLS security validation passed.");
